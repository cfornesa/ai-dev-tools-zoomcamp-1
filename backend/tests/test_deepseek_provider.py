"""Deterministic DeepSeek adapter coverage; no live network calls."""

import json
from pathlib import Path

from ai_provider.deepseek_provider import DeepSeekSceneProvider
from ai_provider.errors import AIProviderQuotaError
from ai_provider.gemini_provider import GeminiResponse
from ai_provider.interface import AICreateSceneRequest, AIErrorCategory


def _scene():
    with (Path(__file__).parents[2] / "schema/fixtures/valid/blank.json").open() as stream:
        return json.load(stream)


class FakeDeepSeekClient:
    def __init__(self, value):
        self.value = value

    def generate(self, **kwargs):
        if isinstance(self.value, Exception):
            raise self.value
        return GeminiResponse(json.dumps(self.value), 9, 8)


def test_deepseek_create_uses_owner_client_and_shared_scene_validator():
    scene = _scene()
    result = DeepSeekSceneProvider(client=FakeDeepSeekClient(scene)).create_scene(
        AICreateSceneRequest("draw a scene")
    )
    assert result.success
    assert result.scene == scene


def test_deepseek_maps_provider_quota_and_invalid_structured_output():
    quota = DeepSeekSceneProvider(
        client=FakeDeepSeekClient(AIProviderQuotaError("full"))
    ).create_scene(AICreateSceneRequest("draw"))
    assert quota.error is not None
    assert quota.error.category is AIErrorCategory.QUOTA_EXCEEDED

    invalid = DeepSeekSceneProvider(client=FakeDeepSeekClient({"schemaVersion": 1})).create_scene(
        AICreateSceneRequest("draw")
    )
    assert invalid.error is not None
    assert invalid.error.category is AIErrorCategory.INVALID_STRUCTURED_OUTPUT
