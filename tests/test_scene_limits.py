"""Boundary tests for schema/limits.json (Task 7).

Every limit is checked at exactly the cap (accepted) and exactly one over
(rejected), generated programmatically from `schema/limits.json` itself
rather than hand-written per-count fixtures — the limits stay the single
source of truth and a future change to a number in that file doesn't
require hand-editing dozens of JSON files. See
`frontend/src/validation/limits.test.ts` for the equivalent TS suite.
"""

import copy
import json
from pathlib import Path

from scenes.validation import LIMITS, validate_scene

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "schema" / "fixtures"

BLANK_SCENE = json.loads((FIXTURES_DIR / "valid" / "blank.json").read_text())


def _base_scene():
    return copy.deepcopy(BLANK_SCENE)


def _circle(shape_id, layer_id="layer-1", group_id=None):
    return {
        "id": shape_id,
        "type": "circle",
        "layerId": layer_id,
        "groupId": group_id,
        "transform": {"x": 0, "y": 0, "scaleX": 1, "scaleY": 1, "rotation": 0, "opacity": 1},
        "style": {"fill": "#ffffff", "stroke": None, "strokeWidth": 0},
        "radius": 10,
    }


def _particle_emitter(shape_id, rate=1, layer_id="layer-1"):
    return {
        "id": shape_id,
        "type": "particleEmitter",
        "layerId": layer_id,
        "groupId": None,
        "transform": {"x": 0, "y": 0, "scaleX": 1, "scaleY": 1, "rotation": 0, "opacity": 1},
        "style": {"fill": "#ffffff", "stroke": None, "strokeWidth": 0},
        "rate": rate,
        "size": 1,
        "lifespan": 1,
        "speed": 1,
        "palette": ["#ffffff"],
    }


def _layer(layer_id, order):
    return {"id": layer_id, "name": layer_id, "order": order, "visible": True, "locked": False}


def _group(group_id, layer_id="layer-1", child_ids=None):
    return {
        "id": group_id,
        "name": group_id,
        "layerId": layer_id,
        "childIds": child_ids or [],
        "transform": {"x": 0, "y": 0, "scaleX": 1, "scaleY": 1, "rotation": 0, "opacity": 1},
        "visible": True,
        "locked": False,
    }


def _binding(binding_id, target_id, target_scope="shape"):
    return {
        "id": binding_id,
        "signal": "indexTipX",
        "handTarget": "primary",
        "targetScope": target_scope,
        "targetId": target_id,
        "targetProperty": "positionX",
        "composition": "replace",
    }


def _node(node_id, family="transform", node_type="mapRange"):
    return {
        "id": node_id,
        "family": family,
        "type": node_type,
        "params": {},
        "position": {"x": 0, "y": 0},
    }


def _connection(conn_id, from_id, to_id):
    return {
        "id": conn_id,
        "fromNodeId": from_id,
        "fromPort": "out",
        "toNodeId": to_id,
        "toPort": "in",
    }


def test_max_shapes_at_limit_accepted():
    scene = _base_scene()
    scene["shapes"] = [_circle(f"shape-{i}") for i in range(LIMITS["maxShapes"])]

    assert validate_scene(scene).valid is True


def test_max_shapes_over_limit_rejected():
    scene = _base_scene()
    scene["shapes"] = [_circle(f"shape-{i}") for i in range(LIMITS["maxShapes"] + 1)]

    result = validate_scene(scene)

    assert result.valid is False
    error = next(e for e in result.errors if e.rule == "limitExceeded")
    assert "maxShapes" in error.message
    assert str(LIMITS["maxShapes"] + 1) in error.message


def test_max_layers_boundary():
    at_limit = _base_scene()
    at_limit["layers"] = [_layer(f"layer-{i}", i) for i in range(LIMITS["maxLayers"])]
    assert validate_scene(at_limit).valid is True

    over_limit = _base_scene()
    over_limit["layers"] = [_layer(f"layer-{i}", i) for i in range(LIMITS["maxLayers"] + 1)]
    result = validate_scene(over_limit)
    assert result.valid is False
    assert any("maxLayers" in e.message for e in result.errors)


def test_max_groups_boundary():
    at_limit = _base_scene()
    at_limit["groups"] = [_group(f"group-{i}") for i in range(LIMITS["maxGroups"])]
    assert validate_scene(at_limit).valid is True

    over_limit = _base_scene()
    over_limit["groups"] = [_group(f"group-{i}") for i in range(LIMITS["maxGroups"] + 1)]
    result = validate_scene(over_limit)
    assert result.valid is False
    assert any("maxGroups" in e.message for e in result.errors)


def test_max_group_child_ids_boundary():
    limit = LIMITS["maxGroupChildIds"]

    at_limit = _base_scene()
    at_limit["shapes"] = [_circle(f"shape-{i}", group_id="group-1") for i in range(limit)]
    at_limit["groups"] = [_group("group-1", child_ids=[f"shape-{i}" for i in range(limit)])]
    assert validate_scene(at_limit).valid is True

    over_limit = _base_scene()
    over_limit["shapes"] = [_circle(f"shape-{i}", group_id="group-1") for i in range(limit + 1)]
    over_limit["groups"] = [_group("group-1", child_ids=[f"shape-{i}" for i in range(limit + 1)])]
    result = validate_scene(over_limit)
    assert result.valid is False
    assert any("maxGroupChildIds" in e.message for e in result.errors)


def test_max_bindings_boundary():
    limit = LIMITS["maxBindings"]

    at_limit = _base_scene()
    at_limit["shapes"] = [_circle("shape-1")]
    at_limit["bindings"] = [_binding(f"binding-{i}", "shape-1") for i in range(limit)]
    assert validate_scene(at_limit).valid is True

    over_limit = _base_scene()
    over_limit["shapes"] = [_circle("shape-1")]
    over_limit["bindings"] = [_binding(f"binding-{i}", "shape-1") for i in range(limit + 1)]
    result = validate_scene(over_limit)
    assert result.valid is False
    assert any("maxBindings" in e.message for e in result.errors)


def test_max_graph_nodes_and_connections_boundary():
    node_limit = LIMITS["maxGraphNodes"]

    at_limit = _base_scene()
    at_limit["graph"]["nodes"] = [_node(f"node-{i}") for i in range(node_limit)]
    assert validate_scene(at_limit).valid is True

    over_limit = _base_scene()
    over_limit["graph"]["nodes"] = [_node(f"node-{i}") for i in range(node_limit + 1)]
    result = validate_scene(over_limit)
    assert result.valid is False
    assert any("maxGraphNodes" in e.message for e in result.errors)

    conn_limit = LIMITS["maxGraphConnections"]
    at_conn_limit = _base_scene()
    at_conn_limit["graph"]["nodes"] = [_node("a"), _node("b")]
    at_conn_limit["graph"]["connections"] = [
        _connection(f"conn-{i}", "a", "b") for i in range(conn_limit)
    ]
    assert validate_scene(at_conn_limit).valid is True

    over_conn_limit = _base_scene()
    over_conn_limit["graph"]["nodes"] = [_node("a"), _node("b")]
    over_conn_limit["graph"]["connections"] = [
        _connection(f"conn-{i}", "a", "b") for i in range(conn_limit + 1)
    ]
    result = validate_scene(over_conn_limit)
    assert result.valid is False
    assert any("maxGraphConnections" in e.message for e in result.errors)


def test_max_conditional_nodes_is_exactly_three():
    assert LIMITS["maxConditionalNodes"] == 3

    at_limit = _base_scene()
    at_limit["graph"]["nodes"] = [
        _node(f"cond-{i}", family="condition", node_type="ifElse") for i in range(3)
    ]
    assert validate_scene(at_limit).valid is True

    over_limit = _base_scene()
    over_limit["graph"]["nodes"] = [
        _node(f"cond-{i}", family="condition", node_type="ifElse") for i in range(4)
    ]
    result = validate_scene(over_limit)
    assert result.valid is False
    assert any("maxConditionalNodes" in e.message for e in result.errors)


def test_max_particle_emitters_and_total_rate_boundary():
    emitter_limit = LIMITS["maxParticleEmitters"]
    rate_limit = LIMITS["maxTotalParticleRate"]
    # Two emitters, each within the schema's own per-field rate cap (500), whose
    # combined rate straddles the scene-wide maxTotalParticleRate boundary.
    rate_each_at_limit = rate_limit // 2

    at_limit = _base_scene()
    at_limit["shapes"] = [
        _particle_emitter("emitter-0", rate=rate_each_at_limit),
        _particle_emitter("emitter-1", rate=rate_limit - rate_each_at_limit),
    ]
    assert validate_scene(at_limit).valid is True

    too_many_emitters = _base_scene()
    too_many_emitters["shapes"] = [
        _particle_emitter(f"emitter-{i}", rate=1) for i in range(emitter_limit + 1)
    ]
    result = validate_scene(too_many_emitters)
    assert result.valid is False
    assert any("maxParticleEmitters" in e.message for e in result.errors)

    over_rate = _base_scene()
    over_rate["shapes"] = [
        _particle_emitter("emitter-0", rate=rate_each_at_limit),
        _particle_emitter("emitter-1", rate=rate_limit - rate_each_at_limit + 1),
    ]
    result = validate_scene(over_rate)
    assert result.valid is False
    assert any("maxTotalParticleRate" in e.message for e in result.errors)


def test_max_path_points_boundary():
    limit = LIMITS["maxPathPoints"]

    def _path(point_count):
        return {
            "id": "path-1",
            "type": "path",
            "layerId": "layer-1",
            "groupId": None,
            "transform": {"x": 0, "y": 0, "scaleX": 1, "scaleY": 1, "rotation": 0, "opacity": 1},
            "style": {"fill": None, "stroke": "#000000", "strokeWidth": 1},
            "points": [{"x": i, "y": i} for i in range(point_count)],
            "closed": False,
        }

    at_limit = _base_scene()
    at_limit["shapes"] = [_path(limit)]
    assert validate_scene(at_limit).valid is True

    over_limit = _base_scene()
    over_limit["shapes"] = [_path(limit + 1)]
    result = validate_scene(over_limit)
    assert result.valid is False
    assert any("maxPathPoints" in e.message for e in result.errors)


def test_max_scene_payload_bytes_boundary():
    """Exercised directly against `_check_limits`: a scene this large legitimately
    can't be built while also respecting every other per-field/per-collection
    limit (e.g. layer name maxLength 200, maxLayers 20), so this isolates the
    payload-size check the way `validate_scene`'s combined pipeline cannot.
    """
    from scenes.validation import _check_limits

    limit = LIMITS["maxScenePayloadBytes"]

    def _sized(byte_target):
        data = {
            "shapes": [],
            "groups": [],
            "layers": [],
            "bindings": [],
            "graph": {"nodes": [], "connections": []},
            "padding": "",
        }
        # ASCII "x" characters cost exactly one byte each and need no JSON
        # escaping, so the gap to the target can be filled in one shot
        # instead of growing the string one character (and one re-serialize)
        # at a time.
        baseline = len(json.dumps(data).encode("utf-8"))
        data["padding"] = "x" * (byte_target - baseline)
        return data

    at_limit = _sized(limit)
    assert len(json.dumps(at_limit).encode("utf-8")) == limit
    assert not any(
        e.rule == "limitExceeded" and "maxScenePayloadBytes" in e.message
        for e in _check_limits(at_limit)
    )

    over_limit = _sized(limit + 1)
    assert len(json.dumps(over_limit).encode("utf-8")) == limit + 1
    errors = _check_limits(over_limit)
    assert any("maxScenePayloadBytes" in e.message for e in errors)


def test_nesting_cannot_bypass_max_shapes():
    """Wrapping shapes in nested groups must not change the flat shape count that's capped."""
    scene = _base_scene()
    limit = LIMITS["maxShapes"]
    scene["shapes"] = [_circle(f"shape-{i}", group_id="group-1") for i in range(limit + 1)]
    scene["groups"] = [_group("group-1", child_ids=[f"shape-{i}" for i in range(limit + 1)])]

    result = validate_scene(scene)

    assert result.valid is False
    assert any(e.rule == "limitExceeded" and "maxShapes" in e.message for e in result.errors)


def test_duplicate_identifiers_cannot_bypass_limits():
    """Reusing an id for extra objects is rejected, not silently deduplicated into headroom."""
    scene = _base_scene()
    scene["shapes"] = [_circle("shape-1"), _circle("shape-1")]

    result = validate_scene(scene)

    assert result.valid is False
    assert any(e.rule == "duplicateId" for e in result.errors)


def test_max_group_nesting_depth_boundary():
    limit = LIMITS["maxGroupNestingDepth"]

    def _chain(depth):
        groups = []
        for i in range(depth):
            child_ids = [f"group-{i + 1}"] if i + 1 < depth else ["shape-leaf"]
            groups.append(_group(f"group-{i}", child_ids=child_ids))
        return groups

    at_limit = _base_scene()
    at_limit["shapes"] = [_circle("shape-leaf", group_id=f"group-{limit - 1}")]
    at_limit["groups"] = _chain(limit)
    assert validate_scene(at_limit).valid is True

    over_limit = _base_scene()
    over_limit["shapes"] = [_circle("shape-leaf", group_id=f"group-{limit}")]
    over_limit["groups"] = _chain(limit + 1)
    result = validate_scene(over_limit)
    assert result.valid is False
    assert any("maxGroupNestingDepth" in e.message for e in result.errors)


def test_every_limits_json_key_is_enforced_by_the_validator():
    """Guard against a limit being defined in limits.json but never wired into _check_limits."""
    import scenes.validation as validation_module

    source = Path(validation_module.__file__).read_text()
    for limit_key in LIMITS:
        assert limit_key in source, (
            f"'{limit_key}' is defined in limits.json but not referenced in validation.py"
        )
