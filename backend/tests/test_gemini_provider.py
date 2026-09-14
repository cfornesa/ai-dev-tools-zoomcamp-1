"""Deterministic Gemini adapter contract tests; no live provider calls."""

import copy
import json
from pathlib import Path

from ai_provider.errors import AIProviderQuotaError, AIProviderTimeoutError
from ai_provider.gemini_provider import GeminiResponse, GeminiSceneProvider
from ai_provider.interface import AICreateSceneRequest, AIEditSceneRequest, AIErrorCategory
from ai_provider.interface3d import AIConvertScene2DTo3DRequest, AICreateScene3DRequest


def _scene():
    with (Path(__file__).parents[2] / "schema/fixtures/valid/blank.json").open() as stream:
        return json.load(stream)


class FakeGeminiClient:
    def __init__(self, value):
        self.value = value
        self.calls = []

    def generate(self, **kwargs):
        self.calls.append(kwargs)
        if isinstance(self.value, Exception):
            raise self.value
        return GeminiResponse(json.dumps(self.value), 11, 7)


def test_gemini_create_uses_json_contract_and_shared_validation():
    scene = _scene()
    client = FakeGeminiClient(scene)
    provider = GeminiSceneProvider(client=client, model="gemini-2.5-flash")
    result = provider.create_scene(AICreateSceneRequest("make a blank scene"))

    assert result.success
    assert result.scene == scene
    assert client.calls[0]["model"] == "gemini-2.5-flash"
    assert client.calls[0]["response_schema"]["$id"]


def test_gemini_create_maps_timeout_quota_and_invalid_output():
    for exception in (AIProviderTimeoutError("slow"), AIProviderQuotaError("full")):
        result = GeminiSceneProvider(client=FakeGeminiClient(exception)).create_scene(
            AICreateSceneRequest("draw")
        )
        assert result.error is not None
        assert result.error.category in {AIErrorCategory.TIMEOUT, AIErrorCategory.QUOTA_EXCEEDED}

    result = GeminiSceneProvider(client=FakeGeminiClient({"schemaVersion": 1})).create_scene(
        AICreateSceneRequest("draw")
    )
    assert result.error is not None
    assert result.error.category is AIErrorCategory.INVALID_STRUCTURED_OUTPUT


def test_gemini_edit_returns_validated_patch_and_rejects_unsafe_patch():
    scene = _scene()
    changed = copy.deepcopy(scene)
    changed["canvas"]["backgroundColor"] = "#123456"
    good = GeminiSceneProvider(
        client=FakeGeminiClient(
            [{"op": "replace", "path": "/canvas/backgroundColor", "value": "#123456"}]
        )
    ).edit_scene(AIEditSceneRequest("change the background", scene))
    assert good.success and good.scene == changed

    bad = GeminiSceneProvider(
        client=FakeGeminiClient([{"op": "replace", "path": "/id", "value": "stolen"}])
    ).edit_scene(AIEditSceneRequest("change the background", scene))
    assert bad.error is not None
    assert bad.error.category is AIErrorCategory.PROVIDER_REJECTION
    assert "stolen" not in bad.error.message


def test_gemini_implements_the_3d_create_contract():
    with (Path(__file__).parents[2] / "schema/fixtures3d/valid/minimal.json").open() as stream:
        scene = json.load(stream)
    result = GeminiSceneProvider(client=FakeGeminiClient(scene)).create_scene3d(
        AICreateScene3DRequest("make a blank 3d scene")
    )
    assert result.success
    assert result.scene == scene


def test_gemini_implements_the_convert_2d_to_3d_contract():
    with (Path(__file__).parents[2] / "schema/fixtures3d/valid/minimal.json").open() as stream:
        scene = json.load(stream)
    client = FakeGeminiClient(scene)
    source_2d = {"shapes": [{"type": "circle", "id": "c1"}]}

    result = GeminiSceneProvider(client=client).convert_scene_2d_to_3d(
        AIConvertScene2DTo3DRequest(source_scene=source_2d, prompt="make it 3D")
    )

    assert result.success
    assert result.scene == scene
    sent_prompt = json.loads(client.calls[0]["prompt"])
    assert sent_prompt["source_scene_2d"] == source_2d
    assert sent_prompt["prompt"] == "make it 3D"
