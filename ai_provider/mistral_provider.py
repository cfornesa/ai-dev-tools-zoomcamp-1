"""A real `AISceneProvider` backed by the Mistral API (Task 46/47).

`_docs/plan.md`'s "AI provider and cost control" section: "Use Mistral API
through Django server-side endpoints as the initial hosted provider ...
AI returns strict schema-constrained JSON, never arbitrary JavaScript."

`MistralSceneProvider.create_scene` is the only implemented operation —
`edit_scene` (prompt + current scene -> patch) is Task 47 (issue #50) and
deliberately raises `NotImplementedError` here, per that task's "out of
scope" note.

## How the schema constraint is enforced

Two independent layers, per `_docs/plan.md`'s "AI output rules" ("Server
validates output ... before preview" — never trust the provider alone):

1. **Provider-side constraint**: the chat request's `response_format` is
   set to Mistral's `json_schema` mode
   (https://docs.mistral.ai/capabilities/structured-output/), passing
   `scenes.validation.SCENE_SCHEMA` (the same canonical schema the
   frontend and `scenes.validation.validate_scene` already enforce) as
   the target shape. This is the "constrained" half of the acceptance
   criteria's "instructed or constrained" — it makes Mistral emit JSON
   matching the schema's shape directly, not prose or JavaScript wrapped
   in markdown fences.
2. **Server-side re-validation**: `_invoke` never returns validated
   output directly — it hands its raw parsed JSON to
   `ai_provider.interface.execute()`, which runs
   `scenes.validation.validate_scene` (schema + `schema/limits.json`
   complexity/payload caps) before any result is considered a success.
   This is the "instructed" half's backstop: `response_format` is a
   strong hint, not a guarantee (a model can still violate `strict`
   schemas in edge cases, and older/other Mistral models don't support
   `json_schema` mode at all), so nothing this provider produces reaches
   a caller without passing the exact same validator a manual save does.

## Timeout, size, and failure handling

- `REQUEST_TIMEOUT_MS` bounds how long one Mistral call may run before
  it is treated as `AIProviderTimeoutError` (-> `AIErrorCategory.TIMEOUT`).
- `MAX_RAW_RESPONSE_BYTES` bounds the raw response text *before* it is
  even JSON-parsed — a safety net independent of (and larger than)
  `schema/limits.json`'s `maxScenePayloadBytes`, which only applies to a
  document that has already parsed as JSON and reached
  `scenes.validation.validate_scene`. A response that fails this earlier,
  cruder check is reported as `AIProviderRejectionError` with a
  `response_too_large:`-prefixed message so `scenes/ai_api.py` can map it
  to its own explicit HTTP status distinct from a generic provider
  rejection (see that module's `_RESULT_TO_RESPONSE`).
- Any other Mistral SDK/HTTP failure (5xx, malformed response, connection
  error) is normalized to `AIProviderRejectionError` ("provider failure").
  A 429 (or a Mistral-reported rate/quota error) is normalized to
  `AIProviderQuotaError` instead, distinct from this server's own
  independent per-user quota/rate limiting in `scenes/ai_api.py`.

## API key handling

The Mistral client is constructed lazily, on first use, via
`ai_provider.config.get_provider_api_key(MISTRAL_API_KEY_ENV_VAR)` —
never at import time and never accepting a key as a constructor/request
parameter (see that module's docstring and
`tests/test_ai_provider_key_and_logging_safety.py`). Tests construct
`MistralSceneProvider(client=<mock>)` directly, which skips key lookup
entirely — no real `MISTRAL_API_KEY` is ever required to exercise this
module.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import httpx

from ai_provider.config import MISTRAL_API_KEY_ENV_VAR, get_provider_api_key
from ai_provider.errors import (
    AIProviderQuotaError,
    AIProviderRejectionError,
    AIProviderTimeoutError,
)
from ai_provider.interface import (
    AICreateSceneRequest,
    AIEditSceneRequest,
    AIOperation,
    AIOperationResult,
    AISceneProvider,
    AIUsageMetadata,
    execute,
)
from scenes.validation import SCENE_SCHEMA

# The model used for scene creation. Overridable via the MISTRAL_MODEL
# environment variable (optional -- unlike MISTRAL_API_KEY, this has a
# sane default and is never required to be set).
DEFAULT_MODEL = "mistral-large-latest"

# How long one create_scene call may run before it's treated as a timeout.
# _docs/plan.md doesn't pin an exact number; 20s is chosen as generous
# enough for a large structured-output completion while still bounding a
# single HTTP request in a synchronous Django view.
REQUEST_TIMEOUT_MS = 20_000

# A crude, pre-JSON-parse safety net on the raw response text, independent
# of (and deliberately larger than) schema/limits.json's
# maxScenePayloadBytes (307200 / 300KB), which only applies to a document
# that already parsed as JSON. 400KB gives headroom for whitespace/
# formatting the model might emit around the JSON payload while still
# bounding worst-case memory/parse cost.
MAX_RAW_RESPONSE_BYTES = 400_000

# Estimated, non-authoritative USD-per-1K-token rates for cost-metadata
# logging only (Task 45's AIUsageMetadata.estimated_cost_usd). Not wired
# to real Mistral billing; update if/when a billing integration lands.
_ESTIMATED_PROMPT_COST_PER_1K = 0.002
_ESTIMATED_COMPLETION_COST_PER_1K = 0.006

# Public: scenes/ai_api.py inspects a PROVIDER_REJECTION error's message
# for this prefix to give an oversized-response failure its own explicit
# HTTP status (413) distinct from a generic provider failure (502) --
# AIErrorCategory itself has no dedicated "response too large" member.
RESPONSE_TOO_LARGE_PREFIX = "response_too_large:"

_SYSTEM_PROMPT = """You generate a single canonical scene document for a gesture-reactive \
animation editor. Follow these rules exactly:

- Respond with ONLY a single JSON object -- no prose, no markdown code \
fences, no explanation before or after it.
- The JSON object must conform to the provided JSON Schema (schemaVersion, \
canvas, renderer, layers, shapes, groups, bindings, graph, accessibility, \
and randomness are the top-level fields).
- Never include executable JavaScript, code strings, or anything a runtime \
would eval() -- node "params" accept only number/string/boolean/null leaf \
values.
- schemaVersion must be exactly 1.
- Keep the scene well within these limits: at most 200 shapes, 50 groups, \
20 layers, 100 graph nodes, 150 graph connections, 3 conditional nodes, \
100 bindings, and 4 particle emitters.
- Every id referenced by a binding, group, or connection must exist \
elsewhere in the document."""


def _estimate_cost_usd(prompt_tokens: int, completion_tokens: int) -> float:
    return round(
        (prompt_tokens / 1000) * _ESTIMATED_PROMPT_COST_PER_1K
        + (completion_tokens / 1000) * _ESTIMATED_COMPLETION_COST_PER_1K,
        6,
    )


def _raiser(exc: BaseException) -> Callable[[], dict[str, Any]]:
    def _raise() -> dict[str, Any]:
        raise exc

    return _raise


def _coerce_message_content_to_text(content: Any) -> str:
    """Mistral's assistant message content can be a plain string or a list of
    content chunks; join text-shaped chunks defensively rather than assuming
    a shape json_schema mode should never actually produce."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for chunk in content:
            if isinstance(chunk, str):
                parts.append(chunk)
            elif isinstance(chunk, dict) and isinstance(chunk.get("text"), str):
                parts.append(chunk["text"])
            else:
                text_attr = getattr(chunk, "text", None)
                if isinstance(text_attr, str):
                    parts.append(text_attr)
        return "".join(parts)
    return ""


# A response_format-compatible JSON Schema derived from the canonical
# schema. $schema/$id are stripped: they describe the schema document
# itself, not the response shape, and some providers reject unrecognized
# top-level schema metadata keywords in structured-output mode.
_RESPONSE_JSON_SCHEMA: dict[str, Any] = {
    k: v for k, v in SCENE_SCHEMA.items() if k not in ("$schema", "$id")
}


class MistralSceneProvider(AISceneProvider):
    """`AISceneProvider` backed by the real Mistral API. `create_scene` only
    (Task 46/47) -- `edit_scene` is Task 47 (issue #50)."""

    def __init__(
        self,
        client: Any | None = None,
        *,
        model: str | None = None,
        timeout_ms: int = REQUEST_TIMEOUT_MS,
    ):
        # `client` is an injection point: tests pass a mock/fake client so
        # this provider never opens a socket or reads MISTRAL_API_KEY under
        # test. A real caller (the create-scene view) constructs this with
        # no arguments, and the real client is built lazily on first use.
        self._client = client
        self.model = model or DEFAULT_MODEL
        self.timeout_ms = timeout_ms

    @property
    def client(self) -> Any:
        if self._client is None:
            # Imported lazily so importing this module never requires the
            # mistralai package's transitive dependencies to be usable in
            # environments that only need the fake/interface for tests.
            from mistralai.client import Mistral

            api_key = get_provider_api_key(MISTRAL_API_KEY_ENV_VAR)
            self._client = Mistral(api_key=api_key)
        return self._client

    def create_scene(self, request: AICreateSceneRequest) -> AIOperationResult:
        usage, produce = self._invoke(request.prompt, request.schema_version)
        return execute(AIOperation.CREATE_SCENE, usage, produce)

    def edit_scene(self, request: AIEditSceneRequest) -> AIOperationResult:
        raise NotImplementedError(
            "MistralSceneProvider.edit_scene is Task 47 (issue #50) -- "
            "patch-based editing is out of scope for Task 46/47's "
            "create-scene endpoint."
        )

    def _invoke(
        self, prompt: str, schema_version: int
    ) -> tuple[AIUsageMetadata, Callable[[], dict[str, Any]]]:
        """Perform the real (or mocked) Mistral call and return the usage
        metadata to attach plus a zero-arg callable for `execute()`'s
        `produce_scene`: it either returns the raw parsed scene dict, or
        raises one of the four documented `ai_provider.errors` exceptions.
        Doing the network call here (rather than inside the callable
        `execute()` invokes) is what lets real token-usage metadata --
        only known once Mistral responds -- be attached to the result even
        on failure, matching `AIOperationResult.usage`'s "always present"
        contract without duplicating `execute()`'s own validation/error
        normalization.
        """
        zero_usage = AIUsageMetadata(prompt_tokens=0, completion_tokens=0, estimated_cost_usd=0.0)

        try:
            response = self.client.chat.complete(
                model=self.model,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "canonical_scene",
                        "schema_definition": _RESPONSE_JSON_SCHEMA,
                        "strict": False,
                    },
                },
                temperature=0.2,
                timeout_ms=self.timeout_ms,
            )
        except httpx.TimeoutException:
            return zero_usage, _raiser(
                AIProviderTimeoutError(f"Mistral did not respond within {self.timeout_ms}ms.")
            )
        except httpx.HTTPError:
            return zero_usage, _raiser(
                AIProviderRejectionError("Mistral request failed (network/connection error).")
            )
        except Exception as exc:  # Mistral SDK error types (lazy-imported below)
            from mistralai.client.errors import MistralError

            if not isinstance(exc, MistralError):
                raise  # a genuine bug, not a documented provider condition

            status = getattr(exc, "status_code", None)
            if status == 429:
                return zero_usage, _raiser(
                    AIProviderQuotaError(
                        "Mistral reported its account/API rate limit or quota was exceeded."
                    )
                )
            if status in (408, 504):
                return zero_usage, _raiser(
                    AIProviderTimeoutError(f"Mistral reported a request timeout (status {status}).")
                )
            return zero_usage, _raiser(
                AIProviderRejectionError(f"Mistral provider request failed (status {status}).")
            )

        usage_info = getattr(response, "usage", None)
        prompt_tokens = int(getattr(usage_info, "prompt_tokens", 0) or 0)
        completion_tokens = int(getattr(usage_info, "completion_tokens", 0) or 0)
        usage = AIUsageMetadata(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            estimated_cost_usd=_estimate_cost_usd(prompt_tokens, completion_tokens),
        )

        try:
            choice = response.choices[0]
            content = choice.message.content
        except (AttributeError, IndexError, TypeError):
            return usage, _raiser(
                AIProviderRejectionError("Mistral response contained no message content.")
            )

        text = _coerce_message_content_to_text(content)
        raw_bytes = len(text.encode("utf-8"))
        if raw_bytes > MAX_RAW_RESPONSE_BYTES:
            return usage, _raiser(
                AIProviderRejectionError(
                    f"{RESPONSE_TOO_LARGE_PREFIX} Mistral's response was {raw_bytes} bytes, "
                    f"exceeding the {MAX_RAW_RESPONSE_BYTES}-byte limit."
                )
            )

        try:
            scene = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return usage, _raiser(AIProviderRejectionError("Mistral response was not valid JSON."))

        if not isinstance(scene, dict):
            return usage, _raiser(
                AIProviderRejectionError("Mistral response JSON was not a scene object.")
            )

        return usage, (lambda: scene)


__all__ = [
    "DEFAULT_MODEL",
    "MAX_RAW_RESPONSE_BYTES",
    "REQUEST_TIMEOUT_MS",
    "RESPONSE_TOO_LARGE_PREFIX",
    "MistralSceneProvider",
]
