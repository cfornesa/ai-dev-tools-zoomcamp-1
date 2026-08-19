"""Task 66/issue #66: deterministic `AISceneProvider` construction for the
Playwright AI/recovery end-to-end suite (`frontend/e2e/aiAndRecovery.spec.ts`).

## Wiring

`scenes.ai_api.get_ai_provider()` calls `build_e2e_provider(scenario)`
instead of constructing a real `MistralSceneProvider()` when, and only
when, `ai_provider.config.use_fake_ai_provider()` is true (`AI_PROVIDER=
fake` in the server process's environment). `scenario` comes from
`ai_provider.e2e_scenario.get_current_scenario()`, itself populated
per-request by `E2EScenarioMiddleware` from the `X-E2E-AI-Scenario`
request header a Playwright test sets. None of this can ever affect a
real deployment: no `.env`/`.env.example` in this repo sets
`AI_PROVIDER`, and every code path here is additive — `get_ai_provider()`
still returns a real `MistralSceneProvider()` by default.

## Why one provider class handles both create-scene and edit-scene

`AICreateSceneView` calls `provider.create_scene(...)`;
`AIEditSceneView` calls `provider.edit_scene_with_patch(...)` — a method
only `MistralSceneProvider` (not the `AISceneProvider` ABC or
`FakeAISceneProvider`) implements, because only it returns the patch
document/change summary the edit endpoint's response needs (see
`ai_provider.mistral_provider`'s own module docstring). `E2ETestProvider`
below therefore composes both:

- `create_scene` delegates to a real `FakeAISceneProvider` (Task 45) —
  already a complete, correct implementation of every create-scene
  scenario this suite needs (success, invalid structured output, quota,
  timeout), reused rather than reimplemented.
- `edit_scene`/`edit_scene_with_patch` delegate to a real
  `MistralSceneProvider`, constructed with an injected fake HTTP client
  (`_E2EFakeClient`, below) — the exact same injection point
  `tests/test_ai_edit_scene_api.py` already uses
  (`MistralSceneProvider(client=<fake>)`). This is deliberate: patch
  validation (protected-field/allowlist rejection, `scenes.patch`),
  patch application, and re-validation of the resulting scene are all
  real production code paths, not reimplemented here — only the raw
  "what did the model say" step is faked, exactly like the pytest
  suite's own `_mistral_provider_returning`/`_mistral_provider_raising`
  fixtures.

## Scenario -> outcome mapping

`X-E2E-AI-Scenario` value -> create-scene outcome -> edit-scene (patch) outcome:

- `success` (default) -> a valid scene -> `/canvas/backgroundColor`
  replace (allowlisted, applies cleanly).
- `invalid_structured_output` -> a schema-invalid scene (missing
  `canvas`) -> `/accessibility/reducedMotion` set to an out-of-enum
  value (an allowlisted path, but the *patched result* fails schema
  validation).
- `forbidden_patch` -> not meaningful for create, behaves like `success`
  -> `/schemaVersion` replace, a protected field
  `scenes.patch.validate_patch_operations` rejects outright.
- `quota_exceeded` -> `AIProviderQuotaError` -> a real `MistralError`
  with `status_code=429`, which `MistralSceneProvider._invoke_edit`
  itself maps to `AIProviderQuotaError`.
- `timeout` -> `AIProviderTimeoutError` -> `httpx.TimeoutException`,
  mapped the same way by `_invoke_edit`.

Unrecognized/missing scenario values default to `success` — a client
that doesn't opt in to a scenario always gets the deterministic happy
path, never a hidden failure.
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

import httpx

from ai_provider.errors import AIProviderQuotaError, AIProviderTimeoutError
from ai_provider.fake_provider import FakeAIProviderScenario, FakeAISceneProvider
from ai_provider.interface import (
    AICreateSceneRequest,
    AIEditSceneRequest,
    AIOperationResult,
    AISceneProvider,
)
from ai_provider.mistral_provider import AIEditScenePatchResult, MistralSceneProvider

_CREATE_SCENARIO_MAP: dict[str, FakeAIProviderScenario] = {
    "success": FakeAIProviderScenario.SUCCESS,
    "invalid_structured_output": FakeAIProviderScenario.INVALID_STRUCTURED_OUTPUT,
    "quota_exceeded": FakeAIProviderScenario.QUOTA_EXCEEDED,
    "timeout": FakeAIProviderScenario.TIMEOUT,
}

# Minimal, deterministic JSON Patch documents per edit scenario -- see this
# module's docstring table for what each is chosen to exercise.
_EDIT_PATCH_SUCCESS: list[dict[str, Any]] = [
    {"op": "replace", "path": "/canvas/backgroundColor", "value": "#123456"}
]
_EDIT_PATCH_INVALID_STRUCTURED_OUTPUT: list[dict[str, Any]] = [
    {"op": "replace", "path": "/accessibility/reducedMotion", "value": "not-a-real-enum-value"}
]
_EDIT_PATCH_FORBIDDEN: list[dict[str, Any]] = [
    {"op": "replace", "path": "/schemaVersion", "value": 2}
]

_EDIT_PATCH_BY_SCENARIO: dict[str, list[dict[str, Any]]] = {
    "success": _EDIT_PATCH_SUCCESS,
    "invalid_structured_output": _EDIT_PATCH_INVALID_STRUCTURED_OUTPUT,
    "forbidden_patch": _EDIT_PATCH_FORBIDDEN,
}


def _e2e_mistral_error(status_code: int, message: str) -> Exception:
    """Builds a real `mistralai.client.errors.MistralError` carrying the
    given HTTP status -- the exact exception type/shape
    `MistralSceneProvider._invoke`/`_invoke_edit` inspect to distinguish
    quota (429) from a generic provider failure. Imported lazily, matching
    `MistralSceneProvider.client`'s own lazy-import convention, so nothing
    in this module requires the `mistralai` package at import time.
    """
    from mistralai.client.errors import MistralError

    raw_response = httpx.Response(
        status_code=status_code, request=httpx.Request("POST", "https://e2e-fake.invalid/")
    )
    return MistralError(message, raw_response=raw_response)


class _E2EFakeChat:
    """Stands in for a real Mistral SDK client's `.chat` attribute --
    `MistralSceneProvider._invoke`/`_invoke_edit` only ever call
    `self.client.chat.complete(**kwargs)`, exactly like
    `tests/test_ai_create_scene_api.py`'s `_FakeChat`."""

    def __init__(self, scenario: str):
        self.scenario = scenario

    def complete(self, **kwargs: Any) -> Any:
        if self.scenario == "timeout":
            raise httpx.TimeoutException("E2E fake provider: simulated timeout (AI_PROVIDER=fake).")
        if self.scenario == "quota_exceeded":
            raise _e2e_mistral_error(429, "E2E fake provider: simulated quota exhaustion.")

        schema_name = kwargs.get("response_format", {}).get("json_schema", {}).get("name")
        if schema_name == "scene_json_patch":
            content = json.dumps(_EDIT_PATCH_BY_SCENARIO.get(self.scenario, _EDIT_PATCH_SUCCESS))
        else:
            # create-scene requests never reach this fake client (routed
            # through FakeAISceneProvider instead -- see E2ETestProvider),
            # but a deterministic fallback is kept here for robustness.
            content = json.dumps(FakeAISceneProvider()._produce_scene(seed_id="scene-e2e-fake"))

        return SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=42, completion_tokens=64),
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        )


class _E2EFakeClient:
    def __init__(self, scenario: str):
        self.chat = _E2EFakeChat(scenario)


class E2ETestProvider(AISceneProvider):
    """The single provider `scenes.ai_api.get_ai_provider()` returns for
    every AI endpoint when `AI_PROVIDER=fake` is set -- see this module's
    docstring for why it composes a `FakeAISceneProvider` (create-scene)
    with a `MistralSceneProvider(client=_E2EFakeClient(...))` (edit-scene).
    """

    def __init__(self, scenario: str):
        self.scenario = scenario
        self._create_provider = FakeAISceneProvider(
            _CREATE_SCENARIO_MAP.get(scenario, FakeAIProviderScenario.SUCCESS)
        )
        self._edit_provider = MistralSceneProvider(client=_E2EFakeClient(scenario))

    def create_scene(self, request: AICreateSceneRequest) -> AIOperationResult:
        return self._create_provider.create_scene(request)

    def edit_scene(self, request: AIEditSceneRequest) -> AIOperationResult:
        return self.edit_scene_with_patch(request).result

    def edit_scene_with_patch(self, request: AIEditSceneRequest) -> AIEditScenePatchResult:
        return self._edit_provider.edit_scene_with_patch(request)


def build_e2e_provider(scenario: str) -> AISceneProvider:
    return E2ETestProvider(scenario)


# Re-exported for callers that want to raise these directly in future
# scenarios without importing ai_provider.errors themselves.
__all__ = [
    "AIProviderQuotaError",
    "AIProviderTimeoutError",
    "E2ETestProvider",
    "build_e2e_provider",
]
