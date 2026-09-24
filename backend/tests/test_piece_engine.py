"""#770: structured pieces resolve an explicit rendering library, backward compatibly."""

import json
from pathlib import Path

import pytest

from scenes.piece_engine import resolve_scene2d_engine, resolve_scene3d_engine
from scenes.validation3d import validate_scene3d

FIXTURES = Path(__file__).resolve().parent.parent.parent / "schema" / "fixtures3d"


def _fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def test_legacy_scene3d_without_a_renderer_resolves_to_threejs():
    legacy = _fixture("valid/minimal.json")
    assert "renderer" not in legacy
    assert validate_scene3d(legacy).valid
    assert resolve_scene3d_engine(legacy) == "threejs"


@pytest.mark.parametrize(
    ("fixture", "expected"),
    [("valid/renderer_threejs.json", "threejs"), ("valid/renderer_aframe.json", "aframe")],
)
def test_explicit_scene3d_renderer_is_valid_and_resolved(fixture, expected):
    scene = _fixture(fixture)
    assert validate_scene3d(scene).valid
    assert resolve_scene3d_engine(scene) == expected


def test_unknown_scene3d_renderer_is_rejected_by_the_validator():
    scene = _fixture("invalid/unsupported_renderer.json")
    result = validate_scene3d(scene)
    assert not result.valid
    assert any("renderer" in error.path for error in result.errors)


def test_scene3d_resolution_is_defensive_for_unexpected_documents():
    assert resolve_scene3d_engine(None) == "threejs"
    assert resolve_scene3d_engine({"renderer": "aframe"}) == "threejs"
    assert resolve_scene3d_engine({"renderer": {"preferred": "babylon"}}) == "threejs"


@pytest.mark.parametrize(
    ("preferred", "expected"),
    [("p5", "p5js"), ("canvas2d", "canvas2d"), ("svg", "svg")],
)
def test_scene2d_renderer_maps_to_registry_engine_ids(preferred, expected):
    assert resolve_scene2d_engine({"renderer": {"preferred": preferred}}) == expected
    assert resolve_scene2d_engine(None) == "p5js"
