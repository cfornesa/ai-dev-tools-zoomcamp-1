"""Tests for scenes/patch3d.py -- the 3D counterpart of test_scene_patch.py."""

from scenes.patch import PatchErrorReason, apply_patch
from scenes.patch3d import validate_patch_operations3d


def _scene():
    return {
        "schemaVersion": 1,
        "documentType": "scene3d",
        "id": "scene3d-1",
        "scene": {"backgroundColor": "#000000"},
        "camera": {
            "position": {"x": 0, "y": 5, "z": 10},
            "target": {"x": 0, "y": 0, "z": 0},
            "fov": 50,
            "near": 0.1,
            "far": 1000,
        },
        "lights": [
            {"id": "light-sun", "name": "Sun", "type": "ambient", "color": "#fff", "intensity": 1}
        ],
        "groups": [
            {
                "id": "group-1",
                "name": "Furniture",
                "transform": {
                    "position": {"x": 0, "y": 0, "z": 0},
                    "rotation": {"x": 0, "y": 0, "z": 0},
                    "scale": {"x": 1, "y": 1, "z": 1},
                    "opacity": 1,
                },
                "visible": True,
                "locked": False,
            }
        ],
        "objects": [
            {"id": "obj-box", "name": "Table", "type": "box", "groupId": "group-1"},
            {"id": "obj-sphere", "type": "sphere", "groupId": None},
        ],
        "randomness": {"seed": 0, "enabled": False},
    }


def test_patch_referencing_an_object_by_name_is_allowed():
    scene = _scene()
    patch = [{"op": "replace", "path": "/objects/0/material/color", "value": "#8b5a2b"}]

    assert validate_patch_operations3d(patch, scene=scene, prompt="paint the Table brown") == []


def test_patch_touching_an_unreferenced_object_is_rejected():
    scene = _scene()
    patch = [
        {"op": "replace", "path": "/objects/0/material/color", "value": "#8b5a2b"},
        {"op": "remove", "path": "/objects/1"},  # never mentioned
    ]

    errs = validate_patch_operations3d(patch, scene=scene, prompt="paint the Table brown")

    assert len(errs) == 1
    assert errs[0].index == 1
    assert errs[0].reason == PatchErrorReason.UNREFERENCED_ELEMENT


def test_patch_referencing_a_light_by_name_is_allowed():
    scene = _scene()
    patch = [{"op": "replace", "path": "/lights/0/intensity", "value": 2}]

    assert validate_patch_operations3d(patch, scene=scene, prompt="make Sun brighter") == []


def test_bulk_scope_prompts_are_never_blocked():
    scene = _scene()
    patch = [
        {"op": "remove", "path": "/objects/1"},
        {"op": "replace", "path": "/objects/0/visible", "value": False},
    ]

    assert validate_patch_operations3d(patch, scene=scene, prompt="hide everything") == []


def test_camera_property_edits_are_always_allowed_and_never_flagged_unreferenced():
    scene = _scene()
    patch = [{"op": "replace", "path": "/camera/fov", "value": 70}]

    assert validate_patch_operations3d(patch, scene=scene, prompt="zoom out a bit") == []


def test_protected_paths_are_rejected():
    for path in ["/schemaVersion", "/documentType", "/id", "/randomness/seed"]:
        errs = validate_patch_operations3d([{"op": "replace", "path": path, "value": "x"}])
        assert len(errs) == 1
        assert errs[0].reason == PatchErrorReason.PROTECTED_FIELD, path


def test_renaming_an_existing_object_id_via_whole_item_replace_is_rejected():
    scene = _scene()
    patch = [
        {
            "op": "replace",
            "path": "/objects/0",
            "value": {**scene["objects"][0], "id": "renamed"},
        }
    ]

    errs = validate_patch_operations3d(patch, scene=scene)

    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.PROTECTED_FIELD


def test_adding_a_brand_new_object_is_never_flagged_as_unreferenced():
    scene = _scene()
    patch = [{"op": "add", "path": "/objects/-", "value": {"id": "obj-new", "type": "box"}}]

    assert validate_patch_operations3d(patch, scene=scene, prompt="add a box") == []


def test_disallowed_path_is_rejected():
    errs = validate_patch_operations3d([{"op": "replace", "path": "/scene/width", "value": 1}])

    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.INVALID_PATH


def test_oversized_patch_is_rejected():
    patch = [{"op": "replace", "path": "/objects/0/name", "value": str(i)} for i in range(50)]

    errs = validate_patch_operations3d(patch)

    assert any(e.reason == PatchErrorReason.OVERSIZED for e in errs)


def test_apply_patch_is_reused_unmodified_and_works_against_a_scene3d_document():
    scene = _scene()
    patch = [{"op": "replace", "path": "/camera/fov", "value": 80}]

    result = apply_patch(scene, patch)

    assert result["camera"]["fov"] == 80
    assert scene["camera"]["fov"] == 50  # original untouched
