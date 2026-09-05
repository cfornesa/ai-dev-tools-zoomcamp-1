"""DeepSeek adapter using its OpenAI-compatible JSON HTTP endpoint."""

from __future__ import annotations

import json
from urllib.request import Request, urlopen

from ai_provider.gemini_provider import GeminiResponse, GeminiSceneProvider


class DeepSeekHttpClient:
    """Small dependency-free DeepSeek client; the key is header-only."""

    def __init__(self, api_key: str, timeout_seconds: float = 30.0):
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    def generate(self, *, model: str, system_instruction: str, prompt: str, response_schema: dict):
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }
        request = Request(
            "https://api.deepseek.com/chat/completions",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:  # nosec B310
                payload = json.loads(response.read(400_001))
        except TimeoutError as exc:
            from ai_provider.errors import AIProviderTimeoutError

            raise AIProviderTimeoutError("DeepSeek did not respond in time.") from exc
        except OSError as exc:
            from ai_provider.errors import AIProviderQuotaError, AIProviderRejectionError

            if getattr(exc, "status", None) == 429:
                raise AIProviderQuotaError("DeepSeek quota was exceeded.") from exc
            raise AIProviderRejectionError("DeepSeek provider request failed.") from exc
        try:
            message = payload["choices"][0]["message"]["content"]
            usage = payload.get("usage", {})
            return GeminiResponse(
                message,
                int(usage.get("prompt_tokens", 0)),
                int(usage.get("completion_tokens", 0)),
            )
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            from ai_provider.errors import AIProviderRejectionError

            raise AIProviderRejectionError("DeepSeek returned an unusable response.") from exc


class DeepSeekSceneProvider(GeminiSceneProvider):
    """DeepSeek implementation of the same validated 2D/3D operations."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str = "deepseek-chat",
        client=None,
    ):
        if client is None and not api_key:
            raise ValueError("DeepSeek API key is required.")
        self.model = model
        self._client = client or DeepSeekHttpClient(api_key or "")
