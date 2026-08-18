"""Tests for `scenes.patch` (Task 50): the allowlisted JSON Patch subset
used by AI edit proposals -- op/path allowlist, protected fields, apply,
size bounds, and the deterministic change summary.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from scenes.patch import (
    MAX_PATCH_BYTES,
    MAX_PATCH_OPERATIONS,
    PatchError,
    PatchErrorReason,
    apply_patch,
    summarize_patch,
    validate_patch_operations,
    worst_reason,
)

_FIXTURE_PATH = (
    Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
)
BLANK_SCENE = json.loads(_FIXTURE_PATH.read_text())


def _circle(shape_id: str, fill: str = "#14b8a6") -> dict:
    return {
        "id": shape_id,
        "type": "circle",
        "layerId": "layer-1",
        "groupId": None,
        "transform": {"x": 0, "y": 0, "scaleX": 1, "scaleY": 1, "rotation": 0, "opacity": 1},
        "style": {"fill": fill, "stroke": None, "strokeWidth": 0},
        "radius": 10,
    }


def _scene_with_shape() -> dict:
    scene = copy.deepcopy(BLANK_SCENE)
    scene["shapes"] = [_circle("shape-1")]
    return scene


# --- Allowed operations ----------------------------------------------------


def test_add_shape_is_allowed_and_applies():
    patch = [{"op": "add", "path": "/shapes/-", "value": _circle("shape-new")}]
    assert validate_patch_operations(patch) == []

    result = apply_patch(BLANK_SCENE, patch)
    assert result["shapes"] == [_circle("shape-new")]
    assert BLANK_SCENE["shapes"] == []  # original untouched


def test_replace_shape_property_is_allowed_and_applies():
    scene = _scene_with_shape()
    patch = [{"op": "replace", "path": "/shapes/0/style/fill", "value": "#ff0000"}]
    assert validate_patch_operations(patch) == []

    result = apply_patch(scene, patch)
    assert result["shapes"][0]["style"]["fill"] == "#ff0000"
    assert scene["shapes"][0]["style"]["fill"] == "#14b8a6"  # original untouched


def test_remove_shape_is_allowed_and_applies():
    scene = _scene_with_shape()
    patch = [{"op": "remove", "path": "/shapes/0"}]
    assert validate_patch_operations(patch) == []

    result = apply_patch(scene, patch)
    assert result["shapes"] == []
    assert scene["shapes"] == [_circle("shape-1")]  # original untouched


def test_canvas_background_color_is_allowed():
    patch = [{"op": "replace", "path": "/canvas/backgroundColor", "value": "#000000"}]
    assert validate_patch_operations(patch) == []


def test_randomness_enabled_is_allowed_but_seed_is_not():
    enabled_patch = [{"op": "replace", "path": "/randomness/enabled", "value": True}]
    assert validate_patch_operations(enabled_patch) == []

    errs = validate_patch_operations([{"op": "replace", "path": "/randomness/seed", "value": 999}])
    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.PROTECTED_FIELD


def test_graph_nodes_and_connections_are_allowed():
    patch = [
        {
            "op": "add",
            "path": "/graph/nodes/-",
            "value": {"id": "node-1", "type": "timer", "params": {}},
        }
    ]
    assert validate_patch_operations(patch) == []


# --- Protected fields --------------------------------------------------


@pytest.mark.parametrize(
    "path",
    ["/schemaVersion", "/id", "/randomness/seed"],
)
def test_protected_exact_paths_are_rejected(path):
    errs = validate_patch_operations([{"op": "replace", "path": path, "value": "x"}])
    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.PROTECTED_FIELD


def test_renaming_an_existing_item_id_in_place_is_rejected():
    errs = validate_patch_operations([{"op": "replace", "path": "/shapes/0/id", "value": "new-id"}])
    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.PROTECTED_FIELD


def test_whole_array_replace_cannot_smuggle_an_id_change():
    # A bare "/shapes" replace could otherwise rewrite every shape's id in
    # one operation without the path ever literally ending in "id".
    errs = validate_patch_operations([{"op": "replace", "path": "/shapes", "value": []}])
    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.INVALID_PATH


def test_whole_item_replace_at_an_existing_index_cannot_smuggle_an_id_change_when_unreferenced():
    # QA-reported bypass: a "replace" at the item's own index (not a bare
    # "/shapes" array replace, and not a path literally ending in "id")
    # can still rename an existing item's id through the operation's
    # *value*. Nothing else in the scene references shape-1's id, so
    # validate_scene's referential-integrity check would never catch this
    # on its own -- the allowlist itself must reject it.
    scene = _scene_with_shape()
    renamed = {**_circle("shape-1"), "id": "renamed-id"}
    patch = [{"op": "replace", "path": "/shapes/0", "value": renamed}]

    errs = validate_patch_operations(patch, scene=scene)

    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.PROTECTED_FIELD


def test_whole_item_replace_id_change_is_rejected_even_when_the_old_id_is_referenced():
    # The referenced case: validate_scene's referential-integrity check
    # would incidentally catch this as a dangling reference if the patch
    # were allowed through, but that's not a designed protection -- the
    # allowlist must reject it directly, before anything downstream runs.
    scene = _scene_with_shape()
    scene["groups"] = [
        {"id": "group-1", "name": "Group 1", "childIds": ["shape-1"], "parentId": None}
    ]
    renamed = {**_circle("shape-1"), "id": "renamed-id"}
    patch = [{"op": "replace", "path": "/shapes/0", "value": renamed}]

    errs = validate_patch_operations(patch, scene=scene)

    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.PROTECTED_FIELD


def test_whole_item_replace_preserving_the_same_id_is_still_allowed():
    scene = _scene_with_shape()
    same_id = {**_circle("shape-1"), "style": {"fill": "#000000", "stroke": None, "strokeWidth": 0}}
    patch = [{"op": "replace", "path": "/shapes/0", "value": same_id}]

    assert validate_patch_operations(patch, scene=scene) == []


def test_identity_preservation_check_is_skipped_without_a_scene_argument():
    # Documented: omitting `scene` only skips this one check, not the rest
    # of allowlist validation -- callers that always have the scene on
    # hand (every real caller) should always pass it.
    renamed = {**_circle("shape-1"), "id": "renamed-id"}
    patch = [{"op": "replace", "path": "/shapes/0", "value": renamed}]

    assert validate_patch_operations(patch) == []


def test_graph_node_whole_item_replace_id_change_is_rejected():
    scene = copy.deepcopy(BLANK_SCENE)
    scene["graph"]["nodes"] = [{"id": "node-1", "type": "timer", "params": {}}]
    patch = [
        {
            "op": "replace",
            "path": "/graph/nodes/0",
            "value": {"id": "node-renamed", "type": "timer", "params": {}},
        }
    ]

    errs = validate_patch_operations(patch, scene=scene)

    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.PROTECTED_FIELD


# --- Invalid / disallowed paths ----------------------------------------


@pytest.mark.parametrize(
    "path",
    ["/renderer/preferred", "/canvas/width", "/canvas", "/notARealField", ""],
)
def test_disallowed_paths_are_rejected(path):
    errs = validate_patch_operations([{"op": "replace", "path": path, "value": "x"}])
    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.INVALID_PATH


# --- Malformed operations ------------------------------------------------


def test_non_list_patch_is_rejected():
    errs = validate_patch_operations({"op": "replace"})
    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.MALFORMED


def test_unsupported_op_is_rejected():
    errs = validate_patch_operations([{"op": "move", "path": "/shapes/-", "from": "/shapes/0"}])
    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.MALFORMED


def test_missing_value_on_add_is_rejected():
    errs = validate_patch_operations([{"op": "add", "path": "/shapes/-"}])
    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.MALFORMED


def test_empty_patch_list_is_valid_structurally():
    # scenes.patch itself doesn't enforce the empty-patch *policy* -- that
    # is ai_provider.mistral_provider.edit_scene_with_patch's decision
    # (reject, per its documented policy). This module only guarantees an
    # empty list has no allowlist/structural errors to report.
    assert validate_patch_operations([]) == []


# --- Oversized patches -----------------------------------------------------


def test_too_many_operations_is_rejected_as_oversized():
    patch = [
        {"op": "add", "path": "/shapes/-", "value": _circle(f"shape-{i}")}
        for i in range(MAX_PATCH_OPERATIONS + 1)
    ]
    errs = validate_patch_operations(patch)
    assert any(e.reason == PatchErrorReason.OVERSIZED for e in errs)


def test_oversized_byte_patch_is_rejected():
    huge_value = "x" * (MAX_PATCH_BYTES + 1)
    patch = [{"op": "replace", "path": "/canvas/backgroundColor", "value": huge_value}]
    errs = validate_patch_operations(patch)
    assert any(e.reason == PatchErrorReason.OVERSIZED for e in errs)


def test_worst_reason_prioritizes_protected_field():
    errs = validate_patch_operations(
        [
            {"op": "replace", "path": "/id", "value": "x"},
            {"op": "replace", "path": "/notARealField", "value": "x"},
        ]
    )
    assert worst_reason(errs) == PatchErrorReason.PROTECTED_FIELD


# --- Apply failures (mechanical, after allowlist passes) -------------------


def test_apply_out_of_range_index_raises_patch_error():
    with pytest.raises(PatchError):
        apply_patch(BLANK_SCENE, [{"op": "replace", "path": "/shapes/0/style/fill", "value": "x"}])


def test_apply_never_mutates_the_input_scene():
    scene = _scene_with_shape()
    before = copy.deepcopy(scene)
    apply_patch(scene, [{"op": "remove", "path": "/shapes/0"}])
    assert scene == before


# --- Change summary ---------------------------------------------------


def test_summarize_empty_patch():
    assert summarize_patch([]) == "No changes."


def test_summarize_patch_is_deterministic_and_content_free():
    patch = [
        {"op": "replace", "path": "/shapes/0/style/fill", "value": "#ff0000"},
        {"op": "replace", "path": "/shapes/1/style/fill", "value": "#00ff00"},
        {"op": "add", "path": "/bindings/-", "value": {"id": "b1"}},
    ]
    summary = summarize_patch(patch)
    assert summary == "3 changes: 1 binding added, 2 shapes updated."
    assert "#ff0000" not in summary
    assert "#00ff00" not in summary
