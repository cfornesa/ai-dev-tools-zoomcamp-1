"""#784: AI proposals can create and edit drawing planes, keeping them proportional unless asked."""

from __future__ import annotations

import copy
import json
from types import SimpleNamespace
from typing import Any

import pytest

from ai_provider.e2e_provider import build_e2e_provider
from ai_provider.interface3d import AIEditScene3DRequest
from ai_provider.mistral_provider import (
    _DRAWING_PLANE_RULES_3D,
    _EDIT_SYSTEM_PROMPT_3D,
    _SYSTEM_PROMPT_3D,
    MistralSceneProvider,
)
from scenes.patch import apply_patch
from scenes.patch3d import has_stretch_intent, proportionalize_drawing_plane_patch
from scenes.validation3d import normalize_scene3d_ai_output, validate_scene3d


def plane(number: int = 1, width: float = 4, height: float = 3) -> dict[str, Any]:
    return {
        "id": f"drawing-plane-{number}",
        "name": f"Drawing plane {number}",
        "type": "drawingPlane",
        "groupId": None,
        "transform": {
            "position": {"x": 0, "y": 0, "z": 0},
            "rotation": {"x": 0, "y": 0, "z": 0},
            "scale": {"x": 1, "y": 1, "z": 1},
            "opacity": 1,
        },
        "material": {"color": "#ffffff"},
        "visible": True,
        "width": width,
        "height": height,
        "doubleSided": True,
        "drawing": {"width": 1024, "height": 768, "background": "#ffffff", "shapes": []},
    }


@pytest.fixture
def scene() -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "documentType": "scene3d",
        "id": "scene-dp",
        "scene": {"backgroundColor": "#000000"},
        "camera": {
            "position": {"x": 0, "y": 0, "z": 8},
            "target": {"x": 0, "y": 0, "z": 0},
            "fov": 50,
            "near": 0.1,
            "far": 1000,
        },
        "lights": [{"id": "amb", "type": "ambient", "color": "#ffffff", "intensity": 1}],
        "groups": [],
        "objects": [plane()],
        "randomness": {"seed": 0, "enabled": False},
    }


def edit(scene: dict[str, Any], prompt: str, scenario: str = "success"):
    provider = build_e2e_provider(scenario)
    return provider.edit_scene3d_with_patch(
        AIEditScene3DRequest(prompt=prompt, current_scene=scene)
    )


def drawing_plane(result, number: int = 1) -> dict[str, Any]:
    assert result.result.success, result.result.error
    return next(o for o in result.result.scene["objects"] if o["id"] == f"drawing-plane-{number}")


class TestPhrasings:
    def test_add_a_drawing_plane_creates_a_valid_plane(self, scene):
        result = edit(scene, "Add a drawing plane")
        assert result.result.success, result.result.error
        planes = [o for o in result.result.scene["objects"] if o["type"] == "drawingPlane"]
        assert [p["name"] for p in planes] == ["Drawing plane 1", "Drawing plane 2"]
        assert planes[1]["drawing"]["shapes"] == []
        assert validate_scene3d(result.result.scene).valid

    def test_expand_keeps_proportions_by_default(self, scene):
        result = edit(scene, "Expand Drawing plane 1")
        plane1 = drawing_plane(result)
        assert plane1["width"] > 4 and plane1["height"] > 3
        assert plane1["width"] / plane1["height"] == pytest.approx(4 / 3, rel=1e-3)
        # The change summary/patch reflects the normalization so the reviewer sees what lands.
        paths = [op["path"] for op in result.patch]
        assert "/objects/0/width" in paths and "/objects/0/height" in paths

    def test_elongate_stretches_only_on_explicit_request(self, scene):
        result = edit(scene, "Elongate Drawing plane 1")
        plane1 = drawing_plane(result)
        assert plane1["width"] == 8 and plane1["height"] == 3
        assert [op["path"] for op in result.patch] == ["/objects/0/width"]

    def test_rotate_vertically_and_horizontally(self, scene):
        flat = edit(scene, "Rotate Drawing plane 1 horizontally")
        assert drawing_plane(flat)["transform"]["rotation"]["x"] == -90
        upright_scene = copy.deepcopy(flat.result.scene)
        upright = edit(upright_scene, "Rotate Drawing plane 1 vertically")
        assert drawing_plane(upright)["transform"]["rotation"]["x"] == 0

    def test_animate_sets_a_validated_animation(self, scene):
        result = edit(scene, "Make Drawing plane 1 spin")
        assert drawing_plane(result)["animation"] == {"kind": "rotate", "axis": "y", "speed": 45}

    def test_prompts_not_naming_the_plane_are_rejected(self, scene):
        result = edit(scene, "Expand it")
        assert not result.result.success  # unreferenced element, unless the prompt is bulk-scope


class TestInvalidProposalsAreRejected:
    def test_forbidden_paths_and_invalid_structured_output_are_rejected(self, scene):
        assert not edit(scene, "Expand Drawing plane 1", scenario="forbidden_patch").result.success
        invalid = edit(scene, "Expand Drawing plane 1", scenario="invalid_structured_output")
        assert not invalid.result.success

    def test_out_of_schema_drawing_content_is_rejected(self, scene):
        bad = copy.deepcopy(scene)
        bad["objects"][0]["drawing"]["shapes"] = [{"id": "x", "type": "script", "src": "evil()"}]
        assert not validate_scene3d(bad).valid


class TestProportionalizePatch:
    def test_width_only_change_is_completed_proportionally(self, scene):
        patch = [{"op": "replace", "path": "/objects/0/width", "value": 8}]
        fixed = proportionalize_drawing_plane_patch(patch, scene, "Expand Drawing plane 1")
        draft = apply_patch(scene, fixed)
        width, height = draft["objects"][0]["width"], draft["objects"][0]["height"]
        assert width / height == pytest.approx(4 / 3, rel=1e-3)
        assert width * height == pytest.approx(8 * 3, rel=1e-3)  # geometric-mean scale

    def test_both_dimensions_scaled_differently_are_evened_out(self, scene):
        patch = [
            {"op": "replace", "path": "/objects/0/width", "value": 8},
            {"op": "replace", "path": "/objects/0/height", "value": 3.0},
        ]
        draft = apply_patch(scene, proportionalize_drawing_plane_patch(patch, scene, "grow it"))
        assert draft["objects"][0]["width"] / draft["objects"][0]["height"] == pytest.approx(
            4 / 3, rel=1e-3
        )

    def test_already_proportional_and_stretch_requests_are_untouched(self, scene):
        proportional = [
            {"op": "replace", "path": "/objects/0/width", "value": 8},
            {"op": "replace", "path": "/objects/0/height", "value": 6},
        ]
        assert proportionalize_drawing_plane_patch(proportional, scene, "Expand it") == proportional
        one_axis = [{"op": "replace", "path": "/objects/0/width", "value": 8}]
        assert (
            proportionalize_drawing_plane_patch(one_axis, scene, "Elongate Drawing plane 1")
            == one_axis
        )

    def test_new_planes_and_non_planes_define_their_own_size(self, scene):
        patch = [{"op": "add", "path": "/objects/-", "value": plane(2, 10, 1)}]
        assert proportionalize_drawing_plane_patch(patch, scene, "Add a drawing plane") == patch

    def test_clamps_to_the_schema_size_limits(self, scene):
        patch = [{"op": "replace", "path": "/objects/0/width", "value": 1e9}]
        draft = apply_patch(scene, proportionalize_drawing_plane_patch(patch, scene, "grow"))
        assert draft["objects"][0]["width"] <= 10000 and draft["objects"][0]["height"] <= 10000


@pytest.mark.parametrize(
    ("prompt", "expected"),
    [
        ("elongate layer Drawing plane 1", True),
        ("Stretch it", True),
        ("make Drawing plane 1 wider", True),
        ("squash the plane", True),
        ("expand Drawing plane 1", False),
        ("make it bigger", False),
        ("rotate it vertically", False),
        ("", False),
    ],
)
def test_stretch_intent_detection(prompt, expected):
    assert has_stretch_intent(prompt) is expected


class TestPromptsAndNormalization:
    def test_prompts_restate_the_vocabulary_and_the_proportional_rule(self):
        for text in (_SYSTEM_PROMPT_3D, _EDIT_SYSTEM_PROMPT_3D):
            assert '"drawingPlane"' in text
            for enum in ('"rect"', '"ellipse"', '"line"', '"path"', '"rotate"', '"orbit"'):
                assert enum in text
            assert "rotation.x = -90" in text
            assert "SAME factor" in text
        assert "add" in _EDIT_SYSTEM_PROMPT_3D and "never emit code" in _EDIT_SYSTEM_PROMPT_3D
        assert "500 shapes" in _DRAWING_PLANE_RULES_3D

    def test_created_planes_get_default_size_and_blank_drawing(self, scene):
        proposal = copy.deepcopy(scene)
        bare = {k: v for k, v in plane().items() if k not in ("width", "height", "drawing")}
        proposal["objects"] = [bare]
        normalized = normalize_scene3d_ai_output(proposal)
        assert normalized["objects"][0]["width"] == 4
        assert normalized["objects"][0]["drawing"]["background"] == "#ffffff"
        assert validate_scene3d(normalized).valid

    def test_the_edit_request_carries_the_stretch_flag(self, scene):
        captured: dict[str, Any] = {}

        class Chat:
            def complete(self, **kwargs: Any):
                captured.update(kwargs)
                content = json.dumps([{"op": "replace", "path": "/camera/fov", "value": 60}])
                return SimpleNamespace(
                    usage=SimpleNamespace(prompt_tokens=1, completion_tokens=1),
                    choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
                )

        provider = MistralSceneProvider(client=SimpleNamespace(chat=Chat()))
        provider.edit_scene3d_with_patch(
            AIEditScene3DRequest(prompt="Elongate Drawing plane 1", current_scene=scene)
        )
        assert captured["messages"][-1]["content"].endswith("): yes")
        provider.edit_scene3d_with_patch(
            AIEditScene3DRequest(prompt="Expand Drawing plane 1", current_scene=scene)
        )
        assert captured["messages"][-1]["content"].endswith("): no")
