"""Google Gemini adapter for the shared 2D/3D structured-scene contracts.

The adapter uses Gemini's JSON REST endpoint directly so the project does not
need an additional SDK dependency.  ``client`` is injectable and deliberately
small: tests can exercise all provider/error paths without opening a socket.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen

from ai_provider.errors import (
    AIProviderCancelledError,
    AIProviderQuotaError,
    AIProviderRejectionError,
    AIProviderTimeoutError,
)
from ai_provider.interface import (
    AICreateSceneRequest,
    AIEditSceneRequest,
    AIError,
    AIErrorCategory,
    AIOperation,
    AIOperationResult,
    AISceneProvider,
    AIUsageMetadata,
    execute,
)
from ai_provider.interface3d import (
    AICreateScene3DRequest,
    AIEditScene3DRequest,
    AIOperationResult3D,
    AIScene3DProvider,
    execute3d,
)
from scenes.patch import PatchError, apply_patch, validate_patch_operations, worst_reason
from scenes.patch3d import validate_patch_operations3d
from scenes.validation import SCENE_SCHEMA
from scenes.validation3d import SCENE3D_SCHEMA

MAX_RAW_RESPONSE_BYTES = 400_000


class GeminiResponse:
    def __init__(self, text: str, prompt_tokens: int = 0, completion_tokens: int = 0):
        self.text = text
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens


@dataclass(frozen=True)
class GeminiEditResult:
    result: AIOperationResult
    patch: list[dict[str, Any]] | None = None
    change_summary: str | None = None


@dataclass(frozen=True)
class GeminiEdit3DResult:
    result: AIOperationResult3D
    patch: list[dict[str, Any]] | None = None
    change_summary: str | None = None


class GeminiHttpClient:
    """Minimal Gemini REST client; the API key is sent only as a header."""

    def __init__(self, api_key: str, timeout_seconds: float = 30.0):
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    def generate(
        self, *, model: str, system_instruction: str, prompt: str, response_schema: dict
    ) -> GeminiResponse:
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{quote(model, safe='')}:generateContent"
        )
        body = {
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": response_schema,
            },
        }
        request = Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json", "x-goog-api-key": self.api_key},
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:  # nosec B310
                payload = json.loads(response.read(MAX_RAW_RESPONSE_BYTES + 1))
        except TimeoutError as exc:
            raise AIProviderTimeoutError("Gemini did not respond in time.") from exc
        except OSError as exc:
            if getattr(exc, "status", None) == 429:
                raise AIProviderQuotaError("Gemini quota was exceeded.") from exc
            raise AIProviderRejectionError("Gemini provider request failed.") from exc
        try:
            candidate = payload["candidates"][0]["content"]["parts"][0]["text"]
            usage = payload.get("usageMetadata", {})
            return GeminiResponse(
                candidate,
                int(usage.get("promptTokenCount", 0)),
                int(usage.get("candidatesTokenCount", 0)),
            )
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise AIProviderRejectionError("Gemini returned an unusable response.") from exc


_CREATE_INSTRUCTIONS = (
    "Return only one JSON object matching the supplied scene schema. "
    "Never return code, XML, markdown, or prose."
)
_EDIT_INSTRUCTIONS = (
    "Return only a JSON Patch array. Use only add, replace, or remove "
    "operations on the existing allowlisted scene paths. Return [] when "
    "the edit is not expressible."
)


class GeminiSceneProvider(AISceneProvider, AIScene3DProvider):
    """Gemini provider whose every result goes through the shared validators."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str = "gemini-2.5-flash",
        client: Any | None = None,
    ):
        if client is None and not api_key:
            raise ValueError("Gemini API key is required.")
        self.model = model
        self._client = client or GeminiHttpClient(api_key or "")

    def _call(self, system: str, prompt: str, schema: dict) -> GeminiResponse:
        try:
            response = self._client.generate(
                model=self.model,
                system_instruction=system,
                prompt=prompt,
                response_schema=schema,
            )
        except (
            AIProviderTimeoutError,
            AIProviderCancelledError,
            AIProviderQuotaError,
            AIProviderRejectionError,
        ):
            raise
        except Exception as exc:
            raise AIProviderRejectionError("Gemini provider request failed.") from exc
        too_large = (
            not isinstance(response.text, str)
            or len(response.text.encode("utf-8")) > MAX_RAW_RESPONSE_BYTES
        )
        if too_large:
            raise AIProviderRejectionError(
                "response_too_large: Gemini response exceeded the size limit."
            )
        return response

    @staticmethod
    def _usage(response: GeminiResponse) -> AIUsageMetadata:
        return AIUsageMetadata(
            prompt_tokens=max(0, response.prompt_tokens),
            completion_tokens=max(0, response.completion_tokens),
            estimated_cost_usd=0.0,
        )

    @staticmethod
    def _error(operation, exc, usage=None):
        if isinstance(exc, AIProviderTimeoutError):
            category = AIErrorCategory.TIMEOUT
        elif isinstance(exc, AIProviderCancelledError):
            category = AIErrorCategory.CANCELLED
        elif isinstance(exc, AIProviderQuotaError):
            category = AIErrorCategory.QUOTA_EXCEEDED
        else:
            category = AIErrorCategory.PROVIDER_REJECTION
        return AIOperationResult(
            operation=operation,
            usage=usage or AIUsageMetadata(0, 0, 0.0),
            error=AIError(category=category, message=str(exc)),
        )

    @staticmethod
    def _error3d(operation, exc, usage=None):
        result = GeminiSceneProvider._error(operation, exc, usage)
        return AIOperationResult3D(
            operation=result.operation,
            usage=result.usage,
            error=result.error,
        )

    def _json(self, response: GeminiResponse) -> dict[str, Any]:
        try:
            value = json.loads(response.text)
        except (TypeError, ValueError) as exc:
            raise AIProviderRejectionError("Gemini returned invalid JSON.") from exc
        if not isinstance(value, dict):
            raise AIProviderRejectionError("Gemini returned an invalid structured response.")
        return value

    def create_scene(self, request: AICreateSceneRequest) -> AIOperationResult:
        try:
            response = self._call(_CREATE_INSTRUCTIONS, request.prompt, SCENE_SCHEMA)
        except (
            AIProviderTimeoutError,
            AIProviderCancelledError,
            AIProviderQuotaError,
            AIProviderRejectionError,
        ) as exc:
            return self._error(AIOperation.CREATE_SCENE, exc)
        return execute(
            AIOperation.CREATE_SCENE, self._usage(response), lambda: self._json(response)
        )

    def edit_scene(self, request: AIEditSceneRequest) -> AIOperationResult:
        outcome = self.edit_scene_with_patch(request)
        return outcome.result

    def edit_scene_with_patch(self, request: AIEditSceneRequest) -> GeminiEditResult:
        try:
            response = self._call(
                _EDIT_INSTRUCTIONS,
                json.dumps({"prompt": request.prompt, "scene": request.current_scene}),
                {"type": "array", "items": {"type": "object"}},
            )
        except (
            AIProviderTimeoutError,
            AIProviderCancelledError,
            AIProviderQuotaError,
            AIProviderRejectionError,
        ) as exc:
            return GeminiEditResult(self._error(AIOperation.EDIT_SCENE, exc))
        usage = self._usage(response)
        try:
            operations = json.loads(response.text)
            if not isinstance(operations, list):
                raise ValueError("patch must be an array")
            if not operations:
                raise AIProviderRejectionError("empty_patch: Gemini proposed no changes.")
            errors = validate_patch_operations(
                operations, scene=request.current_scene, prompt=request.prompt
            )
            if errors:
                detail = "; ".join(f"[{error.index}] {error.message}" for error in errors[:5])
                raise AIProviderRejectionError(f"invalid_patch:{worst_reason(errors)} {detail}")
            scene = apply_patch(request.current_scene, operations)
        except PatchError as exc:
            return GeminiEditResult(
                self._error(
                    AIOperation.EDIT_SCENE,
                    AIProviderRejectionError(f"patch_apply_failed: {exc}"),
                    usage,
                )
            )
        except AIProviderRejectionError as exc:
            return GeminiEditResult(self._error(AIOperation.EDIT_SCENE, exc, usage))
        except (TypeError, ValueError, KeyError):
            return GeminiEditResult(
                self._error(
                    AIOperation.EDIT_SCENE,
                    AIProviderRejectionError("Gemini returned an invalid edit patch."),
                    usage,
                )
            )
        result = execute(AIOperation.EDIT_SCENE, usage, lambda: scene)
        return GeminiEditResult(result, operations)

    def create_scene3d(self, request: AICreateScene3DRequest) -> AIOperationResult3D:
        try:
            response = self._call(_CREATE_INSTRUCTIONS, request.prompt, SCENE3D_SCHEMA)
        except (
            AIProviderTimeoutError,
            AIProviderCancelledError,
            AIProviderQuotaError,
            AIProviderRejectionError,
        ) as exc:
            return self._error3d(AIOperation.CREATE_SCENE, exc)
        return execute3d(
            AIOperation.CREATE_SCENE, self._usage(response), lambda: self._json(response)
        )

    def edit_scene3d(self, request: AIEditScene3DRequest) -> AIOperationResult3D:
        return self.edit_scene3d_with_patch(request).result

    def edit_scene3d_with_patch(self, request: AIEditScene3DRequest) -> GeminiEdit3DResult:
        try:
            response = self._call(
                _EDIT_INSTRUCTIONS,
                json.dumps({"prompt": request.prompt, "scene": request.current_scene}),
                {"type": "array", "items": {"type": "object"}},
            )
        except (
            AIProviderTimeoutError,
            AIProviderCancelledError,
            AIProviderQuotaError,
            AIProviderRejectionError,
        ) as exc:
            return GeminiEdit3DResult(self._error3d(AIOperation.EDIT_SCENE, exc))
        usage = self._usage(response)
        try:
            operations = json.loads(response.text)
            if not isinstance(operations, list):
                raise ValueError("patch must be an array")
            if not operations:
                raise AIProviderRejectionError("empty_patch: Gemini proposed no changes.")
            errors = validate_patch_operations3d(
                operations, scene=request.current_scene, prompt=request.prompt
            )
            if errors:
                detail = "; ".join(f"[{error.index}] {error.message}" for error in errors[:5])
                raise AIProviderRejectionError(f"invalid_patch:{worst_reason(errors)} {detail}")
            scene = apply_patch(request.current_scene, operations)
        except PatchError as exc:
            error = AIProviderRejectionError(f"patch_apply_failed: {exc}")
            return GeminiEdit3DResult(self._error3d(AIOperation.EDIT_SCENE, error, usage))
        except AIProviderRejectionError as exc:
            return GeminiEdit3DResult(self._error3d(AIOperation.EDIT_SCENE, exc, usage))
        except (TypeError, ValueError, KeyError):
            error = AIProviderRejectionError("Gemini returned an invalid 3D edit patch.")
            return GeminiEdit3DResult(self._error3d(AIOperation.EDIT_SCENE, error, usage))
        return GeminiEdit3DResult(
            execute3d(AIOperation.EDIT_SCENE, usage, lambda: scene), operations
        )
