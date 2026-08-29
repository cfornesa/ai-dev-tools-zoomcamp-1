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


# --- Task 72: adversarial patch cases -----------------------------------
# Forbidden operations, protected paths, and oversized patches already
# have dedicated coverage above (Task 47/50). This section adds the
# remaining categories: path traversal/escaping, stale bases (documented
# as an ai_api.py-level concern, not scenes/patch.py's), and confirming a
# patched scene that would violate schema/limits.json is caught before
# any persistence, via `AIAcceptProposalView`'s re-validation.


def test_escaped_slash_smuggling_shapes_index_and_id_into_one_segment_is_rejected():
    # `/shapes/0~1id` is `~1`-escaped: split+unescape naively would yield
    # ["shapes", "0/id"] as ONE trailing segment, rather than the three
    # segments (`shapes`, `0`, `id`) `/shapes/0/id` would produce -- an
    # attempt to smuggle a protected `.../id` path past both the
    # `segments[-1] == "id"` check and the plain `/shapes/0/id` string
    # comparison. No real scene id or field name ever contains a literal
    # `/`, so this is rejected outright as malformed rather than allowed
    # through only to fail later, differently, inside apply_patch.
    errs = validate_patch_operations([{"op": "replace", "path": "/shapes/0~1id", "value": "x"}])
    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.MALFORMED


def test_escaped_slash_in_add_dash_index_is_rejected():
    # `/shapes/-~1id` similarly tries to collapse the `-` append marker
    # and `id` into one segment.
    errs = validate_patch_operations([{"op": "add", "path": "/shapes/-~1id", "value": {"id": "x"}}])
    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.MALFORMED


def test_tilde_escaping_round_trips_correctly_for_an_ordinary_allowed_path():
    # `~0`/`~1` unescaping itself must still work for the (nonexistent in
    # this schema, but RFC 6901-legal) case of a segment that needs no
    # escaping at all -- confirms the new "reject any segment containing a
    # literal /" check in _split_pointer doesn't misfire on ordinary
    # escaped tildes (`~0` -> `~`, no `/` produced).
    errs = validate_patch_operations(
        [{"op": "replace", "path": "/canvas/backgroundColor", "value": "#000000"}]
    )
    assert errs == []


@pytest.mark.parametrize(
    "path",
    [
        "/shapes/0~1style",
        "/graph/nodes/0~1id",
        "/bindings/0~1targetId",
    ],
)
def test_escaped_slash_paths_are_rejected_across_every_identity_bearing_root(path):
    errs = validate_patch_operations([{"op": "replace", "path": path, "value": "x"}])
    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.MALFORMED


def test_result_limit_violation_patch_is_caught_by_scene_revalidation_after_apply():
    # scenes/patch.py's own allowlist has no scene-wide complexity/limits
    # (or Task 111/#142 shared-layerId) awareness by design (schema/limits.json
    # and scenes/validation.py's job) -- a patch that would push the
    # *resulting* scene over a limit (e.g. maxShapes) is allowed by
    # validate_patch_operations, applies mechanically without error, and is
    # only caught by re-validating the patched scene with validate_scene --
    # exactly what ai_provider.mistral_provider.edit_scene_with_patch and
    # AIAcceptProposalView both do before ever returning/persisting
    # anything. This test documents and pins that contract at the
    # scenes.patch/scenes.validation boundary.
    #
    # Since every shape now needs its own layerId (Task 111/#142), and the
    # patch mechanism can only append to /shapes/- (never to /layers), a
    # 201st shape necessarily either reuses an existing layerId
    # (duplicateLayerAssignment) or references a layerId absent from
    # /layers (danglingReference) -- both, like limitExceeded, are
    # validate_scene rejections the patch allowlist has no opinion on and
    # only re-validation catches, so this test reuses an existing layerId
    # rather than attempting an unreachable "add a shape with no reference
    # error" maxShapes-only overflow.
    from scenes.validation import validate_scene

    scene = copy.deepcopy(BLANK_SCENE)
    scene["shapes"] = [{**_circle(f"shape-{i}"), "layerId": f"layer-{i}"} for i in range(200)]
    scene["layers"] = [
        {"id": f"layer-{i}", "name": f"layer-{i}", "order": i, "visible": True, "locked": False}
        for i in range(200)
    ]  # at maxShapes
    assert validate_scene(scene).valid is True

    over_limit_shape = {**_circle("shape-over-limit"), "layerId": "layer-0"}
    patch = [{"op": "add", "path": "/shapes/-", "value": over_limit_shape}]
    assert validate_patch_operations(patch, scene=scene) == []  # allowlist has no opinion

    patched = apply_patch(scene, patch)  # applies mechanically, no error
    result = validate_scene(patched)

    assert result.valid is False
    assert any(e.rule == "duplicateLayerAssignment" for e in result.errors)


# --- Issue #158: prompt-element reference check -----------------------


def _scene_with_named_layers_and_shapes() -> dict:
    scene = copy.deepcopy(BLANK_SCENE)
    scene["layers"] = [
        {"id": "layer-1", "name": "Background", "order": 0, "visible": True, "locked": False},
    ]
    scene["shapes"] = [
        {**_circle("shape-sun", fill="#facc15"), "layerId": "layer-1"},
        {**_circle("shape-moon", fill="#e5e7eb"), "layerId": "layer-1"},
        {**_circle("shape-star", fill="#ffffff"), "layerId": "layer-1"},
    ]
    return scene


def test_patch_touching_only_the_named_shape_is_allowed():
    scene = _scene_with_named_layers_and_shapes()
    # "Circle 1" is shape-sun's derived label (first circle in array order).
    patch = [{"op": "replace", "path": "/shapes/0/style/fill", "value": "#ff0000"}]

    assert validate_patch_operations(patch, scene=scene, prompt="make circle 1 bigger") == []


def test_patch_touching_an_unreferenced_shape_is_rejected():
    # A prompt naming one shape must never let the patch also touch an
    # unrelated shape it never mentioned (the core false-negative risk).
    scene = _scene_with_named_layers_and_shapes()
    patch = [
        {"op": "replace", "path": "/shapes/0/style/fill", "value": "#ff0000"},
        {"op": "remove", "path": "/shapes/2"},  # shape-star, never mentioned
    ]

    errs = validate_patch_operations(patch, scene=scene, prompt="make circle 1 bigger")

    assert len(errs) == 1
    assert errs[0].index == 1
    assert errs[0].reason == PatchErrorReason.UNREFERENCED_ELEMENT


def test_patch_touching_an_unreferenced_layer_by_name_is_rejected():
    scene = _scene_with_named_layers_and_shapes()
    patch = [{"op": "replace", "path": "/layers/0/visible", "value": False}]

    errs = validate_patch_operations(patch, scene=scene, prompt="rename the sun shape")

    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.UNREFERENCED_ELEMENT


def test_patch_touching_a_layer_referenced_by_name_is_allowed():
    scene = _scene_with_named_layers_and_shapes()
    patch = [{"op": "replace", "path": "/layers/0/visible", "value": False}]

    assert validate_patch_operations(patch, scene=scene, prompt="hide the Background layer") == []


@pytest.mark.parametrize(
    "prompt",
    [
        "recolor everything",
        "reduce the opacity of all layers",
        "make every shape bigger",
        "clear the entire scene",
        "reset the whole scene",
    ],
)
def test_explicitly_bulk_scope_prompts_are_never_blocked(prompt):
    # False-positive risk: a legitimately broad prompt must not be blocked
    # just because it touches many/every element.
    scene = _scene_with_named_layers_and_shapes()
    patch = [
        {"op": "replace", "path": "/shapes/0/style/fill", "value": "#111111"},
        {"op": "replace", "path": "/shapes/1/style/fill", "value": "#222222"},
        {"op": "remove", "path": "/shapes/2"},
        {"op": "replace", "path": "/layers/0/visible", "value": False},
    ]

    assert validate_patch_operations(patch, scene=scene, prompt=prompt) == []


def test_bulk_scope_word_does_not_false_positive_on_a_substring():
    # "all" must not match inside "small"/"recall" etc. -- word-boundary
    # matched, not a plain substring check.
    scene = _scene_with_named_layers_and_shapes()
    patch = [{"op": "remove", "path": "/shapes/2"}]  # shape-star, unreferenced

    errs = validate_patch_operations(
        patch, scene=scene, prompt="make it a small, recall-worthy scene"
    )

    assert len(errs) == 1
    assert errs[0].reason == PatchErrorReason.UNREFERENCED_ELEMENT


def test_unreferenced_element_check_is_skipped_without_a_prompt_argument():
    # Documented: omitting `prompt` only skips this one check, matching
    # `scene`'s own documented opt-out behavior for the identity check.
    scene = _scene_with_named_layers_and_shapes()
    patch = [{"op": "remove", "path": "/shapes/2"}]

    assert validate_patch_operations(patch, scene=scene) == []


def test_unreferenced_element_check_is_skipped_without_a_scene_argument():
    patch = [{"op": "remove", "path": "/shapes/2"}]

    assert validate_patch_operations(patch, prompt="make circle 1 bigger") == []


def test_adding_a_brand_new_shape_is_never_flagged_as_unreferenced():
    # A prompt cannot be expected to name something that doesn't exist
    # yet -- appending a new element is exempt from this check entirely.
    scene = _scene_with_named_layers_and_shapes()
    patch = [{"op": "add", "path": "/shapes/-", "value": _circle("shape-new")}]

    assert validate_patch_operations(patch, scene=scene, prompt="add a new circle") == []


def test_referencing_a_shape_by_its_raw_id_is_allowed():
    scene = _scene_with_named_layers_and_shapes()
    patch = [{"op": "remove", "path": "/shapes/2"}]

    assert validate_patch_operations(patch, scene=scene, prompt="delete shape-star please") == []


def test_patch_touching_a_shape_referenced_by_its_name_field_is_allowed():
    """#222: shape.name (fixed by #214) is a valid reference candidate,
    same as a layer's name -- "the shape named Sun" should resolve."""
    scene = _scene_with_named_layers_and_shapes()
    scene["shapes"][0]["name"] = "Sun"
    patch = [{"op": "replace", "path": "/shapes/0/style/fill", "value": "#ff0000"}]

    assert validate_patch_operations(patch, scene=scene, prompt="rename Sun to Moon") == []


def test_patch_touching_an_unmentioned_named_shape_is_still_rejected():
    # A named-but-unmentioned shape must stay protected exactly like an
    # unnamed one -- naming a shape must never widen what a patch may touch.
    scene = _scene_with_named_layers_and_shapes()
    scene["shapes"][0]["name"] = "Sun"
    scene["shapes"][2]["name"] = "Star"
    patch = [
        {"op": "replace", "path": "/shapes/0/style/fill", "value": "#ff0000"},
        {"op": "remove", "path": "/shapes/2"},  # named "Star", never mentioned
    ]

    errs = validate_patch_operations(patch, scene=scene, prompt="rename Sun to Moon")

    assert len(errs) == 1
    assert errs[0].index == 1
    assert errs[0].reason == PatchErrorReason.UNREFERENCED_ELEMENT


def test_worst_reason_prioritizes_unreferenced_element_over_invalid_path():
    scene = _scene_with_named_layers_and_shapes()
    errs = validate_patch_operations(
        [
            {"op": "remove", "path": "/shapes/2"},
            {"op": "replace", "path": "/notARealField", "value": "x"},
        ],
        scene=scene,
        prompt="make circle 1 bigger",
    )
    assert worst_reason(errs) == PatchErrorReason.UNREFERENCED_ELEMENT


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
