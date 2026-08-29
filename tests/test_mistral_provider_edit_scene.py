"""Tests for `MistralSceneProvider.edit_scene_with_patch` (Task 50).

Every test injects a fake Mistral client via the constructor's `client=`
parameter -- none of them open a socket or require a real
`MISTRAL_API_KEY`. Covers: successful patch generation/application/
validation, protected-field rejection, invalid-path rejection, oversized
patch rejection, the documented empty-patch policy, malformed patch
documents, the resulting-scene validation backstop, and provider
error-taxonomy normalization (timeout/quota/network/5xx).
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from types import SimpleNamespace

import httpx

from ai_provider.interface import AIEditSceneRequest, AIErrorCategory
from ai_provider.mistral_provider import (
    EMPTY_PATCH_PREFIX,
    INVALID_PATCH_PREFIX,
    PATCH_APPLY_FAILED_PREFIX,
    MistralSceneProvider,
)
from scenes.patch import PatchErrorReason

_FIXTURE_PATH = (
    Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
)
BLANK_SCENE = json.loads(_FIXTURE_PATH.read_text())


def _fake_response(content: str, *, prompt_tokens=30, completion_tokens=15):
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


def _request(prompt="make it black", scene=None) -> AIEditSceneRequest:
    return AIEditSceneRequest(prompt=prompt, current_scene=scene or copy.deepcopy(BLANK_SCENE))


# --- Success ---------------------------------------------------------------


def test_success_applies_patch_and_returns_patch_scene_and_summary():
    patch = [{"op": "replace", "path": "/canvas/backgroundColor", "value": "#000000"}]
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(patch)))

    outcome = provider.edit_scene_with_patch(_request())

    assert outcome.result.success
    assert outcome.result.scene["canvas"]["backgroundColor"] == "#000000"
    assert outcome.patch == patch
    assert outcome.change_summary == "1 change: 1 canvas property updated."
    assert outcome.result.usage.prompt_tokens == 30


def test_success_never_mutates_the_input_current_scene():
    original = copy.deepcopy(BLANK_SCENE)
    patch = [{"op": "replace", "path": "/canvas/backgroundColor", "value": "#000000"}]
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(patch)))

    request = _request(scene=original)
    provider.edit_scene_with_patch(request)

    assert original == BLANK_SCENE  # untouched
    assert request.current_scene == BLANK_SCENE  # untouched


def test_requests_json_schema_response_format_for_a_patch_array():
    captured = {}

    def handler(**kwargs):
        captured.update(kwargs)
        patch = [{"op": "replace", "path": "/canvas/backgroundColor", "value": "#000000"}]
        return _fake_response(json.dumps(patch))

    provider = _provider_with(handler)
    provider.edit_scene_with_patch(_request())

    assert captured["response_format"]["type"] == "json_schema"
    assert captured["response_format"]["json_schema"]["name"] == "scene_json_patch"
    schema = captured["response_format"]["json_schema"]["schema_definition"]
    assert schema["type"] == "array"

    user_message = next(m for m in captured["messages"] if m["role"] == "user")
    assert "make it black" in user_message["content"]
    assert '"schemaVersion"' in user_message["content"]  # current scene embedded


def test_edit_scene_system_prompt_instructs_addressing_elements_by_name():
    """#222: the model should be able to address an existing shape by its
    `name` field (e.g. "the shape named Sun"), not just its raw id."""
    captured = {}

    def handler(**kwargs):
        captured.update(kwargs)
        patch = [{"op": "replace", "path": "/canvas/backgroundColor", "value": "#000000"}]
        return _fake_response(json.dumps(patch))

    provider = _provider_with(handler)
    provider.edit_scene_with_patch(_request())

    system_message = next(m for m in captured["messages"] if m["role"] == "system")
    assert '"name"' in system_message["content"]


def test_edit_scene_abc_method_returns_only_the_operation_result():
    patch = [{"op": "replace", "path": "/canvas/backgroundColor", "value": "#000000"}]
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(patch)))

    result = provider.edit_scene(_request())

    assert result.success
    assert result.scene["canvas"]["backgroundColor"] == "#000000"


# --- Empty-patch policy: rejected, not a trivial success -------------------


def test_empty_patch_is_rejected_not_a_trivial_success():
    provider = _provider_with(lambda **kw: _fake_response("[]"))

    outcome = provider.edit_scene_with_patch(_request())

    assert not outcome.result.success
    assert outcome.result.error.category == AIErrorCategory.PROVIDER_REJECTION
    assert outcome.result.error.message.startswith(EMPTY_PATCH_PREFIX)
    assert outcome.patch is None
    assert outcome.change_summary is None


# --- Protected fields / invalid paths / malformed / oversized --------------


def test_patch_touching_a_protected_field_is_rejected():
    patch = [{"op": "replace", "path": "/id", "value": "hijacked"}]
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(patch)))

    outcome = provider.edit_scene_with_patch(_request())

    assert not outcome.result.success
    assert outcome.result.error.category == AIErrorCategory.PROVIDER_REJECTION
    message = outcome.result.error.message
    assert message.startswith(INVALID_PATCH_PREFIX)
    assert PatchErrorReason.PROTECTED_FIELD in message


def test_whole_item_replace_renaming_an_existing_shape_id_is_rejected():
    # QA-reported bypass: a "replace" at an existing item's own index
    # (not a bare array replace, not a path literally ending in "id")
    # can still rename the item's id through the operation's value.
    def circle(shape_id, fill="#14b8a6"):
        return {
            "id": shape_id,
            "type": "circle",
            "layerId": "layer-1",
            "groupId": None,
            "transform": {"x": 0, "y": 0, "scaleX": 1, "scaleY": 1, "rotation": 0, "opacity": 1},
            "style": {"fill": fill, "stroke": None, "strokeWidth": 0},
            "radius": 10,
        }

    scene = copy.deepcopy(BLANK_SCENE)
    scene["shapes"] = [circle("shape-1")]

    patch = [{"op": "replace", "path": "/shapes/0", "value": circle("renamed-id")}]
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(patch)))

    outcome = provider.edit_scene_with_patch(_request(scene=scene))

    assert not outcome.result.success
    message = outcome.result.error.message
    assert message.startswith(INVALID_PATCH_PREFIX)
    assert PatchErrorReason.PROTECTED_FIELD in message


def test_patch_targeting_a_disallowed_path_is_rejected():
    patch = [{"op": "replace", "path": "/renderer/preferred", "value": "svg"}]
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(patch)))

    outcome = provider.edit_scene_with_patch(_request())

    assert not outcome.result.success
    assert PatchErrorReason.INVALID_PATH in outcome.result.error.message


def test_malformed_patch_document_from_mistral_is_rejected():
    provider = _provider_with(lambda **kw: _fake_response("not a json array"))

    outcome = provider.edit_scene_with_patch(_request())

    assert not outcome.result.success
    assert outcome.result.error.category == AIErrorCategory.PROVIDER_REJECTION


def test_patch_json_that_is_not_an_array_is_rejected():
    provider = _provider_with(lambda **kw: _fake_response(json.dumps({"op": "replace"})))

    outcome = provider.edit_scene_with_patch(_request())

    assert not outcome.result.success
    assert outcome.result.error.category == AIErrorCategory.PROVIDER_REJECTION


def test_oversized_patch_is_rejected():
    patch = [
        {"op": "replace", "path": "/canvas/backgroundColor", "value": f"#{i:06x}"}
        for i in range(100)
    ]
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(patch)))

    outcome = provider.edit_scene_with_patch(_request())

    assert not outcome.result.success
    assert PatchErrorReason.OVERSIZED in outcome.result.error.message


def test_patch_that_cannot_mechanically_apply_is_rejected():
    # Schema-valid allowlisted path, but the target index doesn't exist on
    # this (shapeless) scene -- allowlist passes, apply fails.
    patch = [{"op": "replace", "path": "/shapes/0/style/fill", "value": "#ff0000"}]
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(patch)))

    outcome = provider.edit_scene_with_patch(_request())

    assert not outcome.result.success
    assert outcome.result.error.message.startswith(PATCH_APPLY_FAILED_PREFIX)


# --- Resulting-scene validation backstop ------------------------------------


def test_patch_producing_an_over_limit_scene_is_rejected():
    def circle(shape_id):
        return {
            "id": shape_id,
            "type": "circle",
            "layerId": "layer-1",
            "groupId": None,
            "transform": {"x": 0, "y": 0, "scaleX": 1, "scaleY": 1, "rotation": 0, "opacity": 1},
            "style": {"fill": "#14b8a6", "stroke": None, "strokeWidth": 0},
            "radius": 10,
        }

    # 201 add ops exceeds MAX_PATCH_OPERATIONS, so build a scene starting
    # with 199 shapes and add 2 more via patch to cross maxShapes (200)
    # while staying under the patch op-count bound.
    scene = copy.deepcopy(BLANK_SCENE)
    scene["shapes"] = [circle(f"shape-{i}") for i in range(199)]

    patch = [
        {"op": "add", "path": "/shapes/-", "value": circle("shape-199")},
        {"op": "add", "path": "/shapes/-", "value": circle("shape-200")},
    ]
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(patch)))

    outcome = provider.edit_scene_with_patch(_request(scene=scene))

    assert not outcome.result.success
    assert outcome.result.error.category == AIErrorCategory.INVALID_STRUCTURED_OUTPUT
    assert outcome.patch is None


# --- Provider error taxonomy -------------------------------------------------


def test_timeout_is_mapped_and_carries_zero_usage():
    def handler(**kwargs):
        raise httpx.TimeoutException("timed out")

    provider = _provider_with(handler)
    outcome = provider.edit_scene_with_patch(_request())

    assert not outcome.result.success
    assert outcome.result.error.category == AIErrorCategory.TIMEOUT
    assert outcome.result.usage.prompt_tokens == 0


def test_network_error_maps_to_provider_rejection():
    def handler(**kwargs):
        raise httpx.ConnectError("connection refused")

    provider = _provider_with(handler)
    outcome = provider.edit_scene_with_patch(_request())

    assert not outcome.result.success
    assert outcome.result.error.category == AIErrorCategory.PROVIDER_REJECTION


def _mistral_error(status_code: int):
    from mistralai.client.errors import MistralError

    request = httpx.Request("POST", "https://api.mistral.ai/v1/chat/completions")
    response = httpx.Response(status_code=status_code, request=request, content=b'{"detail": "x"}')
    return MistralError("provider error", raw_response=response)


def test_429_maps_to_quota_exceeded():
    def handler(**kwargs):
        raise _mistral_error(429)

    provider = _provider_with(handler)
    outcome = provider.edit_scene_with_patch(_request())

    assert not outcome.result.success
    assert outcome.result.error.category == AIErrorCategory.QUOTA_EXCEEDED


def test_5xx_maps_to_provider_rejection():
    def handler(**kwargs):
        raise _mistral_error(500)

    provider = _provider_with(handler)
    outcome = provider.edit_scene_with_patch(_request())

    assert not outcome.result.success
    assert outcome.result.error.category == AIErrorCategory.PROVIDER_REJECTION


# --- Successful path never touches SceneVersion/database (no DB access) ----


def test_provider_module_has_no_database_access(db):  # noqa: ARG001 -- ensures DB is set up, unused
    from scenes.models import SceneVersion

    patch = [{"op": "replace", "path": "/canvas/backgroundColor", "value": "#000000"}]
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(patch)))

    provider.edit_scene_with_patch(_request())

    assert SceneVersion.objects.count() == 0
