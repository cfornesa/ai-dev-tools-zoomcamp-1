"""Tests for `ai_provider.mistral_provider.MistralSceneProvider` (Task 46/47).

Every test here injects a fake/mock Mistral client via the constructor's
`client=` parameter -- none of them open a socket, read `MISTRAL_API_KEY`,
or otherwise touch the network. `MistralSceneProvider` builds a real
`mistralai.client.Mistral` only lazily, inside the `client` property, and
only when no client was injected -- see that class's docstring.
"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import httpx

from ai_provider.interface import AICreateSceneRequest, AIEditSceneRequest, AIErrorCategory
from ai_provider.mistral_provider import (
    MAX_RAW_RESPONSE_BYTES,
    RESPONSE_TOO_LARGE_PREFIX,
    MistralSceneProvider,
)

_FIXTURE_PATH = (
    Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
)
BLANK_SCENE = json.loads(_FIXTURE_PATH.read_text())


def _fake_response(content: str, *, prompt_tokens=50, completion_tokens=120):
    """Build a minimal stand-in for `models.ChatCompletionResponse` --
    only the attributes `MistralSceneProvider._invoke` actually reads."""
    return SimpleNamespace(
        usage=SimpleNamespace(prompt_tokens=prompt_tokens, completion_tokens=completion_tokens),
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
    )


class _FakeChat:
    def __init__(self, handler):
        self._handler = handler

    def complete(self, **kwargs):
        return self._handler(**kwargs)


class _FakeClient:
    def __init__(self, handler):
        self.chat = _FakeChat(handler)


def _provider_with(handler) -> MistralSceneProvider:
    return MistralSceneProvider(client=_FakeClient(handler))


# --- Success -------------------------------------------------------------


def test_create_scene_success_returns_validated_scene_and_real_usage():
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(BLANK_SCENE)))
    result = provider.create_scene(AICreateSceneRequest(prompt="a calm field of teal circles"))

    assert result.success
    assert result.scene == BLANK_SCENE
    assert result.usage.prompt_tokens == 50
    assert result.usage.completion_tokens == 120
    assert result.usage.estimated_cost_usd > 0


def test_create_scene_accepts_a_named_shape():
    """Regression test for issue #214: schema/scene.schema.json's shape
    $defs previously declared a base `name` property but every type-
    specific `allOf` branch's closed `additionalProperties: false`
    silently rejected it -- so any Mistral response naming a shape
    (a routine, schema-legal thing for the model to do, since
    response_format is built from this exact schema) 100% failed
    scenes.validation.validate_scene with an `unknownField` error on
    `name`. This must succeed now that every branch allows it.
    """
    named_shape = {
        "id": "shape-sun",
        "type": "circle",
        "layerId": "layer-1",
        "groupId": None,
        "transform": {"x": 0, "y": 0, "scaleX": 1, "scaleY": 1, "rotation": 0, "opacity": 1},
        "style": {"fill": "#14b8a6", "stroke": None, "strokeWidth": 0},
        "name": "Sun",
        "radius": 10,
    }
    scene = {**BLANK_SCENE, "shapes": [named_shape]}
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(scene)))

    result = provider.create_scene(AICreateSceneRequest(prompt="add a sun named 'Sun'"))

    assert result.success
    assert result.scene["shapes"][0]["name"] == "Sun"


def test_create_scene_requests_json_schema_response_format_and_forbids_prose():
    captured = {}

    def handler(**kwargs):
        captured.update(kwargs)
        return _fake_response(json.dumps(BLANK_SCENE))

    provider = _provider_with(handler)
    provider.create_scene(AICreateSceneRequest(prompt="a scene"))

    assert captured["response_format"]["type"] == "json_schema"
    assert captured["response_format"]["json_schema"]["name"] == "canonical_scene"
    assert "schema_definition" in captured["response_format"]["json_schema"]
    # The system message instructs against prose/JavaScript, reinforcing
    # the schema constraint rather than relying on it alone.
    system_message = next(m for m in captured["messages"] if m["role"] == "system")
    assert "ONLY a single JSON object" in system_message["content"]
    assert "JavaScript" in system_message["content"]


def test_create_scene_system_prompt_lists_every_binding_targetproperty_and_signal():
    """Issue #204: `response_format`'s `strict: False` mode is documented as
    "a strong hint, not a guarantee" -- a real Mistral call for a common
    prompt ("a happy face") produced bindings with `targetProperty: 'width'`
    and `'height'`, neither a valid enum value, rejected by
    `scenes.validation.validate_scene` with a raw schema-path error surfaced
    to the user. Reinforcing the schema's constrained enums in the
    natural-language system prompt too (redundant with, not a replacement
    for, the JSON Schema response_format) is a standard mitigation for
    non-strict structured output. This test fails if the schema's
    `targetProperty`/`signal` enums and the system prompt's own restated
    list ever drift apart, so a future schema change can't silently
    reintroduce this gap."""
    from scenes.validation import SCENE_SCHEMA

    captured = {}

    def handler(**kwargs):
        captured.update(kwargs)
        return _fake_response(json.dumps(BLANK_SCENE))

    provider = _provider_with(handler)
    provider.create_scene(AICreateSceneRequest(prompt="a scene"))

    system_message = next(m for m in captured["messages"] if m["role"] == "system")
    content = system_message["content"]

    for value in SCENE_SCHEMA["$defs"]["binding"]["properties"]["targetProperty"]["enum"]:
        assert f'"{value}"' in content, f"targetProperty {value!r} missing from system prompt"
    for value in SCENE_SCHEMA["$defs"]["signal"]["enum"]:
        assert f'"{value}"' in content, f"signal {value!r} missing from system prompt"


def test_create_scene_system_prompt_instructs_naming_implied_shapes():
    """#222: the model should set shape.name when the prompt implies one
    (e.g. "add a sun"), so a later edit prompt can address it back by name."""
    captured = {}

    def handler(**kwargs):
        captured.update(kwargs)
        return _fake_response(json.dumps(BLANK_SCENE))

    provider = _provider_with(handler)
    provider.create_scene(AICreateSceneRequest(prompt="a scene"))

    system_message = next(m for m in captured["messages"] if m["role"] == "system")
    assert "name" in system_message["content"]


def test_create_scene_passes_the_bounded_timeout():
    captured = {}

    def handler(**kwargs):
        captured.update(kwargs)
        return _fake_response(json.dumps(BLANK_SCENE))

    provider = MistralSceneProvider(client=_FakeClient(handler), timeout_ms=5_000)
    provider.create_scene(AICreateSceneRequest(prompt="a scene"))

    assert captured["timeout_ms"] == 5_000


# --- Schema-invalid / unsupported-version / oversized output rejected ----


def test_create_scene_rejects_schema_invalid_output_before_success():
    malformed = {**BLANK_SCENE}
    del malformed["canvas"]  # required field missing
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(malformed)))

    result = provider.create_scene(AICreateSceneRequest(prompt="anything"))

    assert not result.success
    assert result.error.category == AIErrorCategory.INVALID_STRUCTURED_OUTPUT
    assert result.scene is None


def test_create_scene_rejects_unsupported_schema_version():
    bad_version = {**BLANK_SCENE, "schemaVersion": 2}
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(bad_version)))

    result = provider.create_scene(AICreateSceneRequest(prompt="anything"))

    assert not result.success
    assert result.error.category == AIErrorCategory.INVALID_STRUCTURED_OUTPUT


def _schema_valid_circle(shape_id: str) -> dict:
    return {
        "id": shape_id,
        "type": "circle",
        "layerId": "layer-1",
        "groupId": None,
        "transform": {"x": 0, "y": 0, "scaleX": 1, "scaleY": 1, "rotation": 0, "opacity": 1},
        "style": {"fill": "#14b8a6", "stroke": None, "strokeWidth": 0},
        "radius": 10,
    }


def test_create_scene_rejects_over_limit_output():
    # Task 7's maxShapes limit (200) -- see schema/limits.json. Each shape
    # is otherwise schema-valid, so this exercises the complexity-cap path
    # specifically, not a structural schema error.
    too_many_shapes = {
        **BLANK_SCENE,
        "shapes": [_schema_valid_circle(f"shape-{i}") for i in range(201)],
    }
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(too_many_shapes)))

    result = provider.create_scene(AICreateSceneRequest(prompt="anything"))

    assert not result.success
    assert result.error.category == AIErrorCategory.INVALID_STRUCTURED_OUTPUT


def test_create_scene_rejects_raw_response_over_the_size_safety_net():
    huge_content = "x" * (MAX_RAW_RESPONSE_BYTES + 1)
    provider = _provider_with(lambda **kw: _fake_response(huge_content))

    result = provider.create_scene(AICreateSceneRequest(prompt="anything"))

    assert not result.success
    assert result.error.category == AIErrorCategory.PROVIDER_REJECTION
    assert result.error.message.startswith(RESPONSE_TOO_LARGE_PREFIX)
    # Real (non-zero) usage is still attached even on this failure, since
    # the response did come back from Mistral before being rejected.
    assert result.usage.prompt_tokens == 50


def test_create_scene_rejects_non_json_content():
    provider = _provider_with(lambda **kw: _fake_response("not json at all"))
    result = provider.create_scene(AICreateSceneRequest(prompt="anything"))
    assert not result.success
    assert result.error.category == AIErrorCategory.PROVIDER_REJECTION


def test_create_scene_rejects_non_object_json_content():
    provider = _provider_with(lambda **kw: _fake_response(json.dumps([1, 2, 3])))
    result = provider.create_scene(AICreateSceneRequest(prompt="anything"))
    assert not result.success
    assert result.error.category == AIErrorCategory.PROVIDER_REJECTION


# --- Timeout / quota / provider-failure normalization ---------------------


def test_create_scene_maps_httpx_timeout_to_timeout_category():
    def handler(**kwargs):
        raise httpx.TimeoutException("timed out")

    provider = _provider_with(handler)
    result = provider.create_scene(AICreateSceneRequest(prompt="anything"))

    assert not result.success
    assert result.error.category == AIErrorCategory.TIMEOUT
    assert result.usage.prompt_tokens == 0  # no response ever came back


def test_create_scene_maps_network_error_to_provider_rejection():
    def handler(**kwargs):
        raise httpx.ConnectError("connection refused")

    provider = _provider_with(handler)
    result = provider.create_scene(AICreateSceneRequest(prompt="anything"))

    assert not result.success
    assert result.error.category == AIErrorCategory.PROVIDER_REJECTION


def _mistral_error(status_code: int):
    from mistralai.client.errors import MistralError

    request = httpx.Request("POST", "https://api.mistral.ai/v1/chat/completions")
    response = httpx.Response(status_code=status_code, request=request, content=b'{"detail": "x"}')
    return MistralError("provider error", raw_response=response)


def test_create_scene_maps_429_to_quota_exceeded():
    def handler(**kwargs):
        raise _mistral_error(429)

    provider = _provider_with(handler)
    result = provider.create_scene(AICreateSceneRequest(prompt="anything"))

    assert not result.success
    assert result.error.category == AIErrorCategory.QUOTA_EXCEEDED


def test_create_scene_maps_5xx_to_provider_rejection():
    def handler(**kwargs):
        raise _mistral_error(500)

    provider = _provider_with(handler)
    result = provider.create_scene(AICreateSceneRequest(prompt="anything"))

    assert not result.success
    assert result.error.category == AIErrorCategory.PROVIDER_REJECTION


def test_create_scene_maps_504_to_timeout():
    def handler(**kwargs):
        raise _mistral_error(504)

    provider = _provider_with(handler)
    result = provider.create_scene(AICreateSceneRequest(prompt="anything"))

    assert not result.success
    assert result.error.category == AIErrorCategory.TIMEOUT


# --- edit_scene (Task 50) -- see tests/test_mistral_provider_edit_scene.py
# for the full patch-generation/allowlist/apply/empty-patch/error-mapping
# coverage. This file keeps only the ABC-compliance smoke test.


def test_edit_scene_returns_ai_operation_result_via_the_abc_method():
    patch = [{"op": "replace", "path": "/canvas/backgroundColor", "value": "#000000"}]
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(patch)))

    request = AIEditSceneRequest(prompt="make it black", current_scene=BLANK_SCENE)
    result = provider.edit_scene(request)

    assert result.success
    assert result.scene["canvas"]["backgroundColor"] == "#000000"


# --- API key handling: never required unless a real client is built ------


def test_provider_never_reads_the_env_var_when_a_client_is_injected(monkeypatch):
    monkeypatch.delenv("MISTRAL_API_KEY", raising=False)
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(BLANK_SCENE)))
    result = provider.create_scene(AICreateSceneRequest(prompt="anything"))
    assert result.success  # no ImproperlyConfigured raised


def test_client_property_lazily_builds_a_real_client_using_the_env_var(monkeypatch):
    import ai_provider.mistral_provider as mistral_provider_module

    monkeypatch.setenv("MISTRAL_API_KEY", "sk-fake-test-value-not-real")

    constructed = {}

    class _FakeMistralSDKClass:
        def __init__(self, api_key):
            constructed["api_key"] = api_key

    monkeypatch.setattr("mistralai.client.Mistral", _FakeMistralSDKClass, raising=False)

    provider = mistral_provider_module.MistralSceneProvider()
    client = provider.client

    assert isinstance(client, _FakeMistralSDKClass)
    assert constructed["api_key"] == "sk-fake-test-value-not-real"
