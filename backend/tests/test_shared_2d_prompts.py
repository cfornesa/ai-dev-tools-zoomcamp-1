"""Issue #809: all structured 2D providers use one prompt contract."""

from __future__ import annotations

import json
from types import SimpleNamespace

from ai_provider.deepseek_provider import DeepSeekSceneProvider
from ai_provider.gemini_provider import GeminiResponse, GeminiSceneProvider
from ai_provider.interface import AICreateSceneRequest, AIEditSceneRequest
from ai_provider.mistral_provider import MistralSceneProvider


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


def test_2d_create_and_edit_prompts_are_byte_identical_across_vendors():
    for operation in ("create", "edit"):
        gemini_client = _GeminiClient({} if operation == "create" else [])
        deepseek_client = _GeminiClient({} if operation == "create" else [])
        mistral_client = _MistralClient({} if operation == "create" else [])
        gemini = GeminiSceneProvider(client=gemini_client)
        deepseek = DeepSeekSceneProvider(client=deepseek_client)
        mistral = MistralSceneProvider(client=mistral_client)

        if operation == "create":
            request = AICreateSceneRequest("a circle")
            gemini.create_scene(request)
            deepseek.create_scene(request)
            mistral.create_scene(request)
            gemini_prompt = gemini_client.calls[0]["system_instruction"]
            deepseek_prompt = deepseek_client.calls[0]["system_instruction"]
            mistral_prompt = mistral_client.calls[0]["messages"][0]["content"]
        else:
            request = AIEditSceneRequest(prompt="add a circle", current_scene={})
            gemini.edit_scene(request)
            deepseek.edit_scene(request)
            mistral.edit_scene(request)
            gemini_prompt = gemini_client.calls[0]["system_instruction"]
            deepseek_prompt = deepseek_client.calls[0]["system_instruction"]
            mistral_prompt = mistral_client.calls[0]["messages"][0]["content"]

        assert gemini_prompt == deepseek_prompt == mistral_prompt
