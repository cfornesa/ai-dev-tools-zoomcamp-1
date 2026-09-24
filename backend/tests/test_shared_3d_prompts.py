"""Issue #810: all structured 3D providers use the same prompt contracts."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from types import SimpleNamespace

from ai_provider.deepseek_provider import DeepSeekSceneProvider
from ai_provider.gemini_provider import GeminiResponse, GeminiSceneProvider
from ai_provider.interface3d import (
    AIConvertScene2DTo3DRequest,
    AICreateScene3DRequest,
    AIEditScene3DRequest,
)
from ai_provider.mistral_provider import MistralSceneProvider

MINIMAL_SCENE = json.loads(
    (Path(__file__).parents[2] / "schema/fixtures3d/valid/minimal.json").read_text()
)


class _GeminiClient:
    def __init__(self, value):
        self.value = value
        self.calls = []

    def generate(self, **kwargs):
        self.calls.append(kwargs)
        return GeminiResponse(json.dumps(self.value))


class _MistralClient:
    def __init__(self, value):
        self.value = value
        self.calls = []
        self.chat = self

    def complete(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=1, completion_tokens=1),
            choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(self.value)))],
        )


def test_3d_operation_prompts_are_byte_identical_across_vendors():
    for operation in ("create", "convert", "edit"):
        gemini_client = _GeminiClient(MINIMAL_SCENE if operation != "edit" else [])
        mistral_client = _MistralClient(MINIMAL_SCENE if operation != "edit" else [])
        deepseek_client = _GeminiClient(MINIMAL_SCENE if operation != "edit" else [])
        gemini = GeminiSceneProvider(client=gemini_client)
        deepseek = DeepSeekSceneProvider(client=deepseek_client)
        mistral = MistralSceneProvider(client=mistral_client)

        if operation == "create":
            request = AICreateScene3DRequest("stage")
            gemini.create_scene3d(request)
            deepseek.create_scene3d(request)
            mistral.create_scene3d(request)
            gemini_prompt = gemini_client.calls[0]["system_instruction"]
            deepseek_prompt = deepseek_client.calls[0]["system_instruction"]
            mistral_prompt = mistral_client.calls[0]["messages"][0]["content"]
        elif operation == "convert":
            request = AIConvertScene2DTo3DRequest(source_scene={"shapes": []}, prompt="convert")
            gemini.convert_scene_2d_to_3d(request)
            deepseek.convert_scene_2d_to_3d(request)
            mistral.convert_scene_2d_to_3d(request)
            gemini_prompt = gemini_client.calls[0]["system_instruction"]
            deepseek_prompt = deepseek_client.calls[0]["system_instruction"]
            mistral_prompt = mistral_client.calls[0]["messages"][0]["content"]
        else:
            request = AIEditScene3DRequest(prompt="add a plane", current_scene=MINIMAL_SCENE)
            gemini.edit_scene3d(request)
            deepseek.edit_scene3d(request)
            mistral.edit_scene3d(request)
            gemini_prompt = gemini_client.calls[0]["system_instruction"]
            deepseek_prompt = deepseek_client.calls[0]["system_instruction"]
            mistral_prompt = mistral_client.calls[0]["messages"][0]["content"]

        assert gemini_prompt == deepseek_prompt == mistral_prompt


def test_fake_gemini_drawing_plane_patch_is_validated_and_proportionalized():
    plane = {
        "id": "poster",
        "type": "drawingPlane",
        "width": 4,
        "height": 3,
        "groupId": None,
        "transform": {
            "position": {"x": 0, "y": 0, "z": 0},
            "rotation": {"x": 0, "y": 0, "z": 0},
            "scale": {"x": 1, "y": 1, "z": 1},
            "opacity": 1,
        },
        "material": {"color": "#ffffff"},
        "visible": True,
        "drawing": {"width": 1024, "height": 768, "background": "#ffffff", "shapes": []},
    }
    patch = [{"op": "add", "path": "/objects/-", "value": plane}]
    scene = copy.deepcopy(MINIMAL_SCENE)
    client = _GeminiClient(patch)

    result = GeminiSceneProvider(client=client).edit_scene3d(
        AIEditScene3DRequest(prompt="add a drawing plane", current_scene=scene)
    )

    assert result.success
    assert result.scene["objects"][0]["type"] == "drawingPlane"
    assert result.scene["objects"][0]["width"] == 4
    assert result.scene["objects"][0]["height"] == 3
