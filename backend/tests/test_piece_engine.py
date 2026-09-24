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


def test_ensure_explicit_renderer_keeps_a_declaration_and_upgrades_legacy_scenes():
    from scenes.piece_engine import ensure_explicit_scene3d_renderer

    declared = _fixture("valid/renderer_aframe.json")
    assert ensure_explicit_scene3d_renderer(declared) is declared

    legacy = _fixture("valid/minimal.json")
    upgraded = ensure_explicit_scene3d_renderer(legacy)
    assert upgraded["renderer"] == {"preferred": "threejs"}
    assert "renderer" not in legacy  # input is never mutated
    assert validate_scene3d(upgraded).valid

    # A legacy scene saved after an A-Frame version keeps that library.
    assert ensure_explicit_scene3d_renderer(legacy, declared)["renderer"] == {"preferred": "aframe"}


# --- #778: drawingPlane scene objects ---


def test_drawing_plane_fixtures_validate_and_limits_are_enforced():
    for name in ("valid/drawing_plane.json", "valid/drawing_plane_multicolour.json"):
        assert validate_scene3d(_fixture(name)).valid, name

    too_many = validate_scene3d(_fixture("malicious/drawing_plane_too_many_shapes.json"))
    assert not too_many.valid
    assert any(e.rule == "limitExceeded" and "drawing.shapes" in e.path for e in too_many.errors)

    long_path = _fixture("valid/drawing_plane_multicolour.json")
    shapes = long_path["objects"][0]["drawing"]["shapes"]
    path = next(shape for shape in shapes if shape["type"] == "path")
    path["points"] = [{"x": i % 512, "y": i % 384} for i in range(2001)]
    result = validate_scene3d(long_path)
    assert any(e.rule == "limitExceeded" and "points" in e.path for e in result.errors)

    many_planes = _fixture("valid/drawing_plane.json")
    template = many_planes["objects"][0]
    many_planes["objects"] = [{**template, "id": f"plane-{i}"} for i in range(21)]
    result = validate_scene3d(many_planes)
    assert any(e.rule == "limitExceeded" for e in result.errors)


def test_drawing_plane_legacy_and_renderer_resolution_are_unaffected():
    plane_scene = _fixture("valid/drawing_plane.json")
    assert resolve_scene3d_engine(plane_scene) == "threejs"
