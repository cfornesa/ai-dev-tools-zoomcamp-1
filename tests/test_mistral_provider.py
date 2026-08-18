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
import pytest

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


# --- edit_scene is explicitly out of scope for this task -----------------


def test_edit_scene_is_not_implemented():
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(BLANK_SCENE)))
    with pytest.raises(NotImplementedError):
        provider.edit_scene(AIEditSceneRequest(prompt="edit it", current_scene=BLANK_SCENE))


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
