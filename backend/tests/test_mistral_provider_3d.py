"""Tests for MistralSceneProvider's 3D methods (issue #232):
create_scene3d/edit_scene3d/edit_scene3d_with_patch."""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

from ai_provider.interface import AIErrorCategory
from ai_provider.interface3d import AICreateScene3DRequest, AIEditScene3DRequest
from ai_provider.mistral_provider import (
    _EDIT_SYSTEM_PROMPT_3D,
    _SYSTEM_PROMPT_3D,
    MistralSceneProvider,
)

_FIXTURE_PATH = (
    Path(__file__).resolve().parent.parent.parent
    / "schema"
    / "fixtures3d"
    / "valid"
    / "minimal.json"
)
MINIMAL_SCENE_3D = json.loads(_FIXTURE_PATH.read_text())


def _fake_response(content: str, *, prompt_tokens=40, completion_tokens=90):
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


def _provider_with(handler, *, persona_prompt: str | None = None) -> MistralSceneProvider:
    return MistralSceneProvider(client=_FakeClient(handler), persona_prompt=persona_prompt)


# --- create_scene3d --------------------------------------------------------


def test_create_scene3d_success_returns_validated_scene():
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(MINIMAL_SCENE_3D)))
    result = provider.create_scene3d(AICreateScene3DRequest(prompt="a bare stage"))

    assert result.success
    assert result.scene == MINIMAL_SCENE_3D
    assert result.usage.prompt_tokens == 40


def test_create_scene3d_requests_json_schema_targeting_scene3d():
    captured = {}

    def handler(**kwargs):
        captured.update(kwargs)
        return _fake_response(json.dumps(MINIMAL_SCENE_3D))

    provider = _provider_with(handler)
    provider.create_scene3d(AICreateScene3DRequest(prompt="a bare stage"))

    assert captured["response_format"]["type"] == "json_schema"
    assert captured["response_format"]["json_schema"]["name"] == "canonical_scene3d"
    system_message = next(m for m in captured["messages"] if m["role"] == "system")
    assert "scene3d" in system_message["content"] or "documentType" in system_message["content"]


def test_create_scene3d_invalid_structured_output_is_rejected():
    provider = _provider_with(lambda **kw: _fake_response(json.dumps({"not": "a scene3d"})))
    result = provider.create_scene3d(AICreateScene3DRequest(prompt="anything"))

    assert not result.success
    assert result.error.category == AIErrorCategory.INVALID_STRUCTURED_OUTPUT


# --- edit_scene3d_with_patch -----------------------------------------------


def _edit_request(prompt="make it brighter"):
    return AIEditScene3DRequest(prompt=prompt, current_scene=MINIMAL_SCENE_3D)


def test_edit_scene3d_applies_patch_and_returns_patched_scene_and_summary():
    patch = [{"op": "replace", "path": "/camera/fov", "value": 70}]
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(patch)))

    result = provider.edit_scene3d_with_patch(_edit_request())

    assert result.result.success
    assert result.result.scene["camera"]["fov"] == 70
    assert result.patch == patch
    assert result.change_summary


def test_edit_scene3d_requests_json_schema_for_a_patch_array():
    captured = {}
    patch = [{"op": "replace", "path": "/camera/fov", "value": 70}]

    def handler(**kwargs):
        captured.update(kwargs)
        return _fake_response(json.dumps(patch))

    provider = _provider_with(handler)
    provider.edit_scene3d_with_patch(_edit_request("zoom out"))

    assert captured["response_format"]["json_schema"]["name"] == "scene3d_json_patch"
    user_message = next(m for m in captured["messages"] if m["role"] == "user")
    assert "zoom out" in user_message["content"]
    assert '"documentType"' in user_message["content"]


def test_edit_scene3d_empty_patch_is_rejected_not_a_trivial_success():
    provider = _provider_with(lambda **kw: _fake_response(json.dumps([])))
    result = provider.edit_scene3d_with_patch(_edit_request())

    assert not result.result.success
    assert result.result.error.category == AIErrorCategory.PROVIDER_REJECTION
    assert "empty_patch" in result.result.error.message


def test_edit_scene3d_patch_touching_a_protected_path_is_rejected():
    patch = [{"op": "replace", "path": "/id", "value": "x"}]
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(patch)))

    result = provider.edit_scene3d_with_patch(_edit_request())

    assert not result.result.success
    assert "invalid_patch" in result.result.error.message


def test_edit_scene3d_patch_touching_an_unreferenced_object_is_rejected():
    scene = {
        **MINIMAL_SCENE_3D,
        "objects": [
            {
                "id": "obj-1",
                "name": "Cube",
                "type": "box",
                "groupId": None,
                "transform": {
                    "position": {"x": 0, "y": 0, "z": 0},
                    "rotation": {"x": 0, "y": 0, "z": 0},
                    "scale": {"x": 1, "y": 1, "z": 1},
                    "opacity": 1,
                },
                "material": {"color": "#ffffff"},
                "visible": True,
                "width": 1,
                "height": 1,
                "depth": 1,
            }
        ],
    }
    patch = [{"op": "remove", "path": "/objects/0"}]
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(patch)))

    result = provider.edit_scene3d_with_patch(
        AIEditScene3DRequest(prompt="zoom out the camera", current_scene=scene)
    )

    assert not result.result.success
    assert "invalid_patch" in result.result.error.message


def test_edit_scene3d_abc_method_returns_only_the_operation_result():
    patch = [{"op": "replace", "path": "/camera/fov", "value": 70}]
    provider = _provider_with(lambda **kw: _fake_response(json.dumps(patch)))

    result = provider.edit_scene3d(_edit_request())

    assert result.success
    assert result.scene["camera"]["fov"] == 70


# --- Issue #260: Persona additive prompt composition (3D) ----------------


def test_create_scene3d_appends_persona_as_a_second_system_message():
    captured = {}

    def handler(**kwargs):
        captured.update(kwargs)
        return _fake_response(json.dumps(MINIMAL_SCENE_3D))

    provider = _provider_with(handler, persona_prompt="Favor bold geometric forms.")
    provider.create_scene3d(AICreateScene3DRequest(prompt="a bare stage"))

    system_messages = [m for m in captured["messages"] if m["role"] == "system"]
    assert len(system_messages) == 2
    assert system_messages[0]["content"] == _SYSTEM_PROMPT_3D
    assert system_messages[1]["content"] == "Favor bold geometric forms."


def test_create_scene3d_mandatory_prompt_is_unchanged_with_or_without_a_persona():
    captured_without: dict = {}
    captured_with: dict = {}

    def handler_without(**kwargs):
        captured_without.update(kwargs)
        return _fake_response(json.dumps(MINIMAL_SCENE_3D))

    def handler_with(**kwargs):
        captured_with.update(kwargs)
        return _fake_response(json.dumps(MINIMAL_SCENE_3D))

    _provider_with(handler_without).create_scene3d(AICreateScene3DRequest(prompt="a bare stage"))
    _provider_with(handler_with, persona_prompt="Be theatrical.").create_scene3d(
        AICreateScene3DRequest(prompt="a bare stage")
    )

    mandatory_without = captured_without["messages"][0]["content"]
    mandatory_with = captured_with["messages"][0]["content"]
    assert mandatory_without == mandatory_with == _SYSTEM_PROMPT_3D


def test_edit_scene3d_appends_persona_as_a_second_system_message():
    captured = {}
    patch = [{"op": "replace", "path": "/camera/fov", "value": 70}]

    def handler(**kwargs):
        captured.update(kwargs)
        return _fake_response(json.dumps(patch))

    provider = _provider_with(handler, persona_prompt="Prefer wide-angle shots.")
    provider.edit_scene3d_with_patch(_edit_request("zoom out"))

    system_messages = [m for m in captured["messages"] if m["role"] == "system"]
    assert len(system_messages) == 2
    assert system_messages[0]["content"] == _EDIT_SYSTEM_PROMPT_3D
    assert system_messages[1]["content"] == "Prefer wide-angle shots."
