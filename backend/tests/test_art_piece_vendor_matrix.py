"""Issue #811: generated art pieces use the same contract for every vendor."""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from ai_provider.art_piece_provider import ArtPieceProvider
from ai_provider.gemini_provider import GeminiResponse
from scenes.art_piece_contract import SUPPORTED_ART_PIECE_ENGINES

_SNIPPETS = {
    "canvas2d": "<canvas></canvas><script>const c = 'teal';</script>",
    "svg": "<svg fill='teal'></svg>",
    "p5js": "window.sketch = function (p) { p.setup = function () {}; };",
    "c2js": "window.sketch = function () { runtime.startFrame(function () {}); };",
    "c2js-interactive": "window.sketch = function () { runtime.startFrame(function () {}); };",
    "threejs": "var scene = new THREE.Scene(); var camera = new THREE.Camera();",
    "aframe": '<a-scene id="art-piece-scene" embedded></a-scene>',
}


class _VendorChat:
    def __init__(self, content: str):
        self.content = content
        self.calls: list[dict] = []

    def complete(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=3, completion_tokens=4),
            choices=[SimpleNamespace(message=SimpleNamespace(content=self.content))],
        )


class _VendorClient:
    def __init__(self, content: str):
        self.content = content
        self.chat = _VendorChat(content)
        self.calls: list[dict] = []

    def generate(self, **kwargs):
        self.calls.append(kwargs)
        return GeminiResponse(self.content, 3, 4)


@pytest.mark.parametrize("vendor", ["mistral", "gemini", "deepseek"])
@pytest.mark.parametrize("library", sorted(SUPPORTED_ART_PIECE_ENGINES))
def test_generate_matrix_supports_every_library_for_every_vendor(vendor, library):
    client = _VendorClient(_SNIPPETS[library])
    provider = ArtPieceProvider(vendor=vendor, model=f"{vendor}-test-model", client=client)

    result = provider.generate("a warm geometric study", library)

    assert result.error is None
    assert result.code == _SNIPPETS[library]
    calls = client.chat.calls if vendor == "mistral" else client.calls
    assert calls[0]["model"] == f"{vendor}-test-model"


@pytest.mark.parametrize("vendor", ["mistral", "gemini", "deepseek"])
def test_refine_matrix_uses_the_selected_vendor_transport(vendor):
    content = json.dumps({"edits": [{"search": "teal", "replace": "#e76f51"}]})
    client = _VendorClient(content)
    provider = ArtPieceProvider(vendor=vendor, model=f"{vendor}-test-model", client=client)

    result = provider.refine("make it warmer", "teal", "svg", ["teal"])

    assert result.error is None
    assert result.edits == [{"search": "teal", "replace": "#e76f51"}]
    calls = client.chat.calls if vendor == "mistral" else client.calls
    assert calls[0]["model"] == f"{vendor}-test-model"


def test_gemini_json_string_transport_is_unwrapped_for_raw_piece_code():
    class QuotedClient:
        def generate(self, **kwargs):
            return GeminiResponse(json.dumps(_SNIPPETS["svg"]), 1, 1)

    result = ArtPieceProvider(
        vendor="gemini", model="gemini-2.5-flash", client=QuotedClient()
    ).generate("a teal mark", "svg")

    assert result.error is None
    assert result.code == _SNIPPETS["svg"]
