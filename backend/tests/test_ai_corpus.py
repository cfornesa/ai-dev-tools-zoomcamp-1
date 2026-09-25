"""Issue #815: offline reference-prompt corpus and preservation replay."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from ai_provider.art_piece_provider import ArtPieceProvider
from ai_provider.gemini_provider import GeminiResponse, GeminiSceneProvider
from ai_provider.interface import AICreateSceneRequest, AIEditSceneRequest
from ai_provider.interface3d import AICreateScene3DRequest, AIEditScene3DRequest
from ai_provider.mistral_provider import MistralSceneProvider
from scenes.art_piece_validation import validate_art_piece_source
from scenes.validation import validate_scene

CORPUS_PATH = Path(__file__).parent / "fixtures/ai_corpus/corpus.json"
CORPUS = json.loads(CORPUS_PATH.read_text())
VENDORS = ("mistral", "gemini", "deepseek")


class _RecordedClient:
    def __init__(self, value: Any, *, raw_content: bool = False):
        self.value = value
        self.raw_content = raw_content
        self.calls: list[dict[str, Any]] = []
        self.chat = self

    def complete(self, **kwargs: Any):
        self.calls.append(kwargs)
        content = self.value if self.raw_content else json.dumps(self.value)
        return SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=1, completion_tokens=1),
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        )

    def generate(self, **kwargs: Any):
        self.calls.append(kwargs)
        return GeminiResponse(json.dumps(self.value), 1, 1)


def _valid_2d_scene() -> dict[str, Any]:
    scene = json.loads((Path(__file__).parents[2] / "schema/fixtures/valid/blank.json").read_text())
    scene["layers"] = [
        {
            "id": "layer-background",
            "name": "Background",
            "order": 0,
            "visible": True,
            "locked": False,
        },
        {"id": "layer-subject", "name": "Subject", "order": 1, "visible": True, "locked": False},
    ]
    scene["id"] = "corpus-2d"
    return scene


def _valid_3d_scene() -> dict[str, Any]:
    scene = json.loads(
        (Path(__file__).parents[2] / "schema/fixtures3d/valid/feature_rich.json").read_text()
    )
    scene["id"] = "corpus-3d"
    scene["objects"][0]["name"] = "Hero Box"
    scene["objects"][1]["name"] = "Sun"
    return scene


def _recorded_source(engine: str, step: int = 0) -> str:
    color = ("#149eca", "#e76f51", "#f4c95d", "#6c63ff")[step % 4]
    if engine == "canvas2d":
        return (
            f"<canvas id='art-piece-canvas'></canvas><script>// @layer Background\n"
            f"// @layer Subject\nconst color = '{color}';</script>"
        )
    if engine == "svg":
        return (
            f"<svg id='art-piece-svg' viewBox='0 0 800 600'><g id='Background'></g>"
            f"<g id='Subject' fill='{color}'></g></svg>"
        )
    if engine == "p5js":
        return (
            f"// @layer Background\n// @layer Subject\nwindow.sketch = function (p) {{ "
            f"p.setup = function () {{ p.background('{color}'); }}; }};"
        )
    if engine in {"c2js", "c2js-interactive"}:
        return (
            f"// @layer Background\n// @layer Subject\nwindow.sketch = function (runtime) {{ "
            f"runtime.startFrame(function () {{ runtime.canvas.style.background = '{color}'; "
            "}}); }};"
        )
    if engine == "threejs":
        return (
            f"// @layer Background\n// @layer Subject\nvar scene = new THREE.Scene(); "
            f"var camera = new THREE.Camera(); var color = '{color}';"
        )
    return (
        "<!-- @layer Background --><!-- @layer Subject -->"
        "<a-scene id='art-piece-scene' embedded>"
        "<a-camera position='0 1.6 4'></a-camera></a-scene>"
    )


def _run_structured_2d(vendor: str, scene: dict[str, Any], prompt: str) -> dict[str, Any]:
    client = _RecordedClient(scene)
    provider = {
        "mistral": MistralSceneProvider,
        "gemini": GeminiSceneProvider,
        "deepseek": GeminiSceneProvider,
    }[vendor](client=client)
    request = AICreateSceneRequest(prompt)
    result = provider.create_scene(request)
    assert result.success and result.scene is not None
    return result.scene


def _run_structured_3d(vendor: str, scene: dict[str, Any], prompt: str) -> dict[str, Any]:
    client = _RecordedClient(scene)
    provider = {
        "mistral": MistralSceneProvider,
        "gemini": GeminiSceneProvider,
        "deepseek": GeminiSceneProvider,
    }[vendor](client=client)
    result = provider.create_scene3d(AICreateScene3DRequest(prompt))
    assert result.success and result.scene is not None
    return result.scene


def test_corpus_has_six_creates_and_three_step_edits_per_family():
    assert set(CORPUS) == {"structured_2d", "structured_3d", "generated_2d", "generated_3d"}
    for family in CORPUS.values():
        assert len(family["create_prompts"]) == 6
        assert len(family["edit_sequences"]) == 6
        assert all(len(sequence["steps"]) == 3 for sequence in family["edit_sequences"])
        assert family["source_templates"]


@pytest.mark.parametrize("vendor", VENDORS)
def test_structured_2d_corpus_replays_through_each_vendor_and_preserves_named_layers(vendor):
    family = CORPUS["structured_2d"]
    for prompt in family["create_prompts"]:
        scene = _run_structured_2d(vendor, _valid_2d_scene(), prompt)
        assert validate_scene(scene).valid
        assert len(scene["layers"]) >= 2
        assert {layer["name"] for layer in scene["layers"]} >= {"Background", "Subject"}
        for sequence in family["edit_sequences"]:
            current = copy.deepcopy(scene)
            original_layers = {layer["id"] for layer in current["layers"]}
            for step in sequence["steps"]:
                client = _RecordedClient(
                    [
                        {
                            "op": "replace",
                            "path": "/layers/0/name",
                            "value": current["layers"][0]["name"],
                        }
                    ]
                )
                provider = {
                    "mistral": MistralSceneProvider,
                    "gemini": GeminiSceneProvider,
                    "deepseek": GeminiSceneProvider,
                }[vendor](client=client)
                result = provider.edit_scene(
                    AIEditSceneRequest(f"whole scene update: {step}", current)
                )
                assert result.success and result.scene is not None
                current = result.scene
                assert {layer["id"] for layer in current["layers"]} == original_layers


@pytest.mark.parametrize("vendor", VENDORS)
def test_structured_3d_corpus_replays_through_each_vendor_and_preserves_named_objects(vendor):
    family = CORPUS["structured_3d"]
    for prompt in family["create_prompts"]:
        scene = _run_structured_3d(vendor, _valid_3d_scene(), prompt)
        assert scene["objects"]
        named = {obj["name"] for obj in scene["objects"] if obj.get("name")}
        assert {"Hero Box", "Sun"} <= named
        for sequence in family["edit_sequences"]:
            current = copy.deepcopy(scene)
            original_objects = {obj["id"] for obj in current["objects"]}
            for step in sequence["steps"]:
                client = _RecordedClient(
                    [
                        {
                            "op": "replace",
                            "path": "/objects/0/name",
                            "value": current["objects"][0]["name"],
                        }
                    ]
                )
                provider = {
                    "mistral": MistralSceneProvider,
                    "gemini": GeminiSceneProvider,
                    "deepseek": GeminiSceneProvider,
                }[vendor](client=client)
                result = provider.edit_scene3d(
                    AIEditScene3DRequest(f"whole scene update: {step}", current)
                )
                assert result.success and result.scene is not None
                current = result.scene
                assert {obj["id"] for obj in current["objects"]} == original_objects


@pytest.mark.parametrize("vendor", VENDORS)
@pytest.mark.parametrize("family_name", ["generated_2d", "generated_3d"])
def test_generated_corpus_replays_through_each_vendor_and_preserves_regions(vendor, family_name):
    family = CORPUS[family_name]
    for engine in family["engines"]:
        for prompt in family["create_prompts"]:
            source = _recorded_source(engine)
            client = _RecordedClient(source, raw_content=True)
            provider = ArtPieceProvider(vendor=vendor, client=client, model=f"{vendor}-corpus")
            result = provider.generate(prompt, engine)
            assert result.error is None and result.code == source
            validate_art_piece_source(engine, result.code)
            for sequence in family["edit_sequences"]:
                current = source
                for step_index, step in enumerate(sequence["steps"], start=1):
                    next_source = _recorded_source(engine, step_index)
                    edit_client = _RecordedClient(
                        {"edits": [{"search": current, "replace": next_source}]}
                    )
                    edit_provider = ArtPieceProvider(
                        vendor=vendor, client=edit_client, model=f"{vendor}-corpus"
                    )
                    edited = edit_provider.refine(step, current, engine, [current])
                    assert edited.error is None and edited.edits
                    current = edited.edits[0]["replace"]
                    validate_art_piece_source(engine, current)
                    assert "@layer" in current or "id='Background'" in current
