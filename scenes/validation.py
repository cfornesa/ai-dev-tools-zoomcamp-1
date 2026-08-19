"""Validate canonical scene documents against schema/scene.schema.json.

Mirrors `frontend/src/validation/scene.ts` — both load the same schema
files from `schema/` and apply the same three-stage pipeline: schema
version, then JSON Schema structure, then referential integrity and
complexity/payload limits. See `schema/README.md` for why the pipeline is
split this way.

Server validation here is authoritative and independent of whatever the
browser already checked (see Task 6): callers must invoke `validate_scene`
before save, AI-proposal acceptance, publish, and export, never trusting
client-side validation alone.
"""

import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

SCHEMA_DIR = Path(__file__).resolve().parent.parent / "schema"

with (SCHEMA_DIR / "scene.schema.json").open() as _f:
    SCENE_SCHEMA: dict = json.load(_f)

with (SCHEMA_DIR / "limits.json").open() as _f:
    _raw_limits: dict = json.load(_f)
LIMITS: dict[str, int] = {k: v for k, v in _raw_limits.items() if not k.startswith("$")}

with (SCHEMA_DIR / "node_types.json").open() as _f:
    _raw_node_types: dict = json.load(_f)
ALLOWED_NODE_TYPES_BY_FAMILY: dict[str, list[str]] = {
    k: v for k, v in _raw_node_types.items() if not k.startswith("$")
}

_STRUCTURAL_VALIDATOR = Draft202012Validator(SCENE_SCHEMA)

SUPPORTED_SCHEMA_VERSION = 1


@dataclass
class SceneValidationError:
    path: str
    rule: str
    message: str


@dataclass
class SceneValidationResult:
    errors: list[SceneValidationError] = field(default_factory=list)

    @property
    def valid(self) -> bool:
        return not self.errors


def _format_path(absolute_path) -> str:
    """Render a jsonschema error's absolute_path as a dotted/bracketed path string."""
    parts = ["$"]
    for segment in absolute_path:
        if isinstance(segment, int):
            parts[-1] += f"[{segment}]"
        else:
            parts.append(str(segment))
    return ".".join(parts) if len(parts) > 1 else parts[0]


def _structural_rule_for(error) -> str:
    if error.validator == "required":
        return "missingRequired"
    if error.validator == "additionalProperties":
        return "unknownField"
    if error.validator == "type":
        return "wrongType"
    if error.validator in ("enum", "const", "pattern"):
        return "invalidValue"
    return "invalid"


def _check_structure(data: Any) -> list[SceneValidationError]:
    errors = []
    for error in _STRUCTURAL_VALIDATOR.iter_errors(data):
        errors.append(
            SceneValidationError(
                path=_format_path(error.absolute_path),
                rule=_structural_rule_for(error),
                message=error.message,
            )
        )
    return errors


def _check_non_finite_numbers(data: Any, path: str = "$") -> list[SceneValidationError]:
    """Reject `NaN`/`Infinity`/`-Infinity` anywhere in the document.

    Python's `json` module accepts these three tokens as a non-standard
    extension (unlike strict JSON -- `JSON.parse` on the frontend rejects
    them outright, and so does the browser-side ajv validator once a value
    reaches it). Plain JSON Schema `minimum`/`maximum` checks do not catch
    this on their own: comparisons against `NaN` are always `False` in
    Python (`nan < minimum` and `nan > maximum` both evaluate to `False`),
    so a `NaN` silently passes range validation entirely, and an unbounded
    numeric field (e.g. `graphNode.params`, `binding.mapping.inMin`) has no
    `minimum`/`maximum` to even attempt catching `Infinity` with. This scan
    is a dedicated, explicit backstop run right after structural
    validation passes and before any downstream check (referential
    integrity, complexity/payload limits) that could itself be fooled by a
    non-finite value silently propagating through, e.g. `sum()` of a
    `NaN` particle emitter rate short-circuiting the `maxTotalParticleRate`
    comparison the same way.
    """
    errors: list[SceneValidationError] = []
    if isinstance(data, float) and not math.isfinite(data):
        errors.append(
            SceneValidationError(
                path=path,
                rule="nonFiniteNumber",
                message=f"{data!r} is not a finite number; NaN and Infinity are not allowed.",
            )
        )
    elif isinstance(data, dict):
        for key, value in data.items():
            errors.extend(_check_non_finite_numbers(value, f"{path}.{key}"))
    elif isinstance(data, list):
        for index, value in enumerate(data):
            errors.extend(_check_non_finite_numbers(value, f"{path}[{index}]"))
    return errors


def _check_forbidden_node_types(data: dict) -> list[SceneValidationError]:
    """Reject a graph node whose `type` isn't allowlisted for its `family`
    (`schema/node_types.json`, Task 37/38/40's node registries).

    `scene.schema.json` intentionally only pattern-checks `type` (any
    short alnum string), not an enum, so new node types can be added
    without a schema migration -- the allowlist itself previously lived
    only in `frontend/src/runtime/behaviorRuntime.ts`, enforced at graph
    *execution* time. That left a gap: a scene carrying a forbidden or
    outright garbage node `type` (e.g. `"type": "evalCode"` under the
    `transform` family) still passed schema validation, referential
    integrity, and complexity limits, so it could be saved as a
    `SceneVersion`, published to the public gallery, and included in an
    HTML export -- only the interactive runtime, which is not on any of
    those paths, would ever refuse to run it. This check closes that gap
    at the same authoritative choke point every other structural rule
    goes through. The `output` family is deliberately exempt: it is a
    reserved, forward-looking family with no allowlisted type yet (see
    `schema/node_types.json`'s `$emptyFamilyMeansUnenforced`), and
    `schema/fixtures/valid/feature_rich.json` deliberately carries an
    `output`/`previewTarget` node to prove the schema doesn't hardcode
    today's node registry.
    """
    errors: list[SceneValidationError] = []
    nodes = data.get("graph", {}).get("nodes", [])
    for index, node in enumerate(nodes):
        family = node.get("family")
        node_type = node.get("type")
        allowed = ALLOWED_NODE_TYPES_BY_FAMILY.get(family)
        if not allowed:
            continue  # unknown/reserved family: schema enum or the family check above applies
        if node_type not in allowed:
            errors.append(
                SceneValidationError(
                    path=f"$.graph.nodes[{index}].type",
                    rule="forbiddenNodeType",
                    message=f"type {node_type!r} is not allowlisted for family {family!r}.",
                )
            )
    return errors


def _duplicate_ids(items: list[dict], collection: str) -> list[SceneValidationError]:
    seen: set[str] = set()
    errors = []
    for item in items:
        item_id = str(item.get("id"))
        if item_id in seen:
            errors.append(
                SceneValidationError(
                    path=f"$.{collection}",
                    rule="duplicateId",
                    message=f"Duplicate id '{item_id}' in {collection}.",
                )
            )
        seen.add(item_id)
    return errors


def _group_cycle(group_id: str, groups_by_id: dict[str, dict], visiting: set[str]) -> bool:
    if group_id in visiting:
        return True
    visiting = visiting | {group_id}
    for child_id in groups_by_id.get(group_id, {}).get("childIds", []):
        if child_id in groups_by_id and _group_cycle(child_id, groups_by_id, visiting):
            return True
    return False


def _find_graph_cycle(node_ids: list[str], edges: list[tuple[str, str]]) -> str | None:
    """Detect a cycle anywhere in `graph.connections`' directed edges using
    standard three-color DFS. Mirrors `frontend/src/validation/scene.ts`'s
    `findCycle` (which `frontend/src/runtime/behaviorRuntime.ts` also
    uses, via re-export, for its own execution-time check). Previously
    this check existed ONLY in `behaviorRuntime.ts` -- a scene with a
    cyclic graph (e.g. node A's output feeding back into node A) passed
    `validate_scene` cleanly and could be saved, published, and exported;
    only the interactive runtime, which is not on any of those paths,
    would ever refuse to run it (Task 72). Returns the id of one node
    participating in a cycle, or `None` if the graph is acyclic.
    """
    adjacency: dict[str, list[str]] = {node_id: [] for node_id in node_ids}
    for from_id, to_id in edges:
        if from_id in adjacency:
            adjacency[from_id].append(to_id)

    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[str, int] = {node_id: WHITE for node_id in node_ids}
    cycle_node: str | None = None

    def visit(node_id: str) -> None:
        nonlocal cycle_node
        if cycle_node is not None:
            return
        color[node_id] = GRAY
        for next_id in adjacency.get(node_id, []):
            if cycle_node is not None:
                return
            next_color = color.get(next_id)
            if next_color == GRAY:
                cycle_node = next_id
                return
            if next_color == WHITE:
                visit(next_id)
        color[node_id] = BLACK

    for node_id in node_ids:
        if cycle_node is not None:
            break
        if color.get(node_id) == WHITE:
            visit(node_id)
    return cycle_node


def _check_references(data: dict) -> list[SceneValidationError]:
    """Check cross-references JSON Schema cannot express: ids that must resolve to a real object."""
    errors: list[SceneValidationError] = []

    layers = data.get("layers", [])
    shapes = data.get("shapes", [])
    groups = data.get("groups", [])
    nodes = data.get("graph", {}).get("nodes", [])
    connections = data.get("graph", {}).get("connections", [])
    bindings = data.get("bindings", [])

    errors += _duplicate_ids(layers, "layers")
    errors += _duplicate_ids(shapes, "shapes")
    errors += _duplicate_ids(groups, "groups")
    errors += _duplicate_ids(nodes, "graph.nodes")
    errors += _duplicate_ids(connections, "graph.connections")
    errors += _duplicate_ids(bindings, "bindings")

    layer_ids = {layer["id"] for layer in layers}
    shape_ids = {shape["id"] for shape in shapes}
    group_ids = {group["id"] for group in groups}
    node_ids = {node["id"] for node in nodes}

    for index, shape in enumerate(shapes):
        if shape.get("layerId") not in layer_ids:
            errors.append(
                SceneValidationError(
                    path=f"$.shapes[{index}].layerId",
                    rule="danglingReference",
                    message=f"layerId '{shape.get('layerId')}' does not match any layer.",
                )
            )
        group_id = shape.get("groupId")
        if group_id is not None and group_id not in group_ids:
            errors.append(
                SceneValidationError(
                    path=f"$.shapes[{index}].groupId",
                    rule="danglingReference",
                    message=f"groupId '{group_id}' does not match any group.",
                )
            )

    groups_by_id = {group["id"]: group for group in groups}
    for index, group in enumerate(groups):
        if group.get("layerId") not in layer_ids:
            errors.append(
                SceneValidationError(
                    path=f"$.groups[{index}].layerId",
                    rule="danglingReference",
                    message=f"layerId '{group.get('layerId')}' does not match any layer.",
                )
            )
        for child_index, child_id in enumerate(group.get("childIds", [])):
            if child_id == group["id"]:
                errors.append(
                    SceneValidationError(
                        path=f"$.groups[{index}].childIds[{child_index}]",
                        rule="danglingReference",
                        message="A group cannot list itself as a child.",
                    )
                )
            elif child_id not in shape_ids and child_id not in group_ids:
                errors.append(
                    SceneValidationError(
                        path=f"$.groups[{index}].childIds[{child_index}]",
                        rule="danglingReference",
                        message=f"childId '{child_id}' does not match any shape or group.",
                    )
                )
        if _group_cycle(group["id"], groups_by_id, set()):
            errors.append(
                SceneValidationError(
                    path=f"$.groups[{index}].childIds",
                    rule="cyclicReference",
                    message=f"Group '{group['id']}' contains a cycle through its children.",
                )
            )

    for index, binding in enumerate(bindings):
        scope = binding.get("targetScope")
        target_id = binding.get("targetId")
        if scope == "shape" and target_id not in shape_ids:
            errors.append(
                SceneValidationError(
                    path=f"$.bindings[{index}].targetId",
                    rule="danglingReference",
                    message=f"targetId '{target_id}' does not match any shape.",
                )
            )
        elif scope == "group" and target_id not in group_ids:
            errors.append(
                SceneValidationError(
                    path=f"$.bindings[{index}].targetId",
                    rule="danglingReference",
                    message=f"targetId '{target_id}' does not match any group.",
                )
            )
        elif scope in ("scene", "interaction") and target_id is not None:
            errors.append(
                SceneValidationError(
                    path=f"$.bindings[{index}].targetId",
                    rule="invalidValue",
                    message=f"targetId must be null when targetScope is '{scope}'.",
                )
            )

    errors += _check_forbidden_node_types(data)

    graph_cycle_node = _find_graph_cycle(
        list(node_ids),
        [
            (c.get("fromNodeId"), c.get("toNodeId"))
            for c in connections
            if isinstance(c.get("fromNodeId"), str) and isinstance(c.get("toNodeId"), str)
        ],
    )
    if graph_cycle_node is not None:
        errors.append(
            SceneValidationError(
                path="$.graph.connections",
                rule="graphCycle",
                message=f"Graph contains a cycle through node '{graph_cycle_node}'.",
            )
        )

    for index, connection in enumerate(connections):
        from_node_id = connection.get("fromNodeId")
        if from_node_id not in node_ids:
            errors.append(
                SceneValidationError(
                    path=f"$.graph.connections[{index}].fromNodeId",
                    rule="danglingReference",
                    message=f"fromNodeId '{from_node_id}' does not match any graph node.",
                )
            )
        to_node_id = connection.get("toNodeId")
        if to_node_id not in node_ids:
            errors.append(
                SceneValidationError(
                    path=f"$.graph.connections[{index}].toNodeId",
                    rule="danglingReference",
                    message=f"toNodeId '{to_node_id}' does not match any graph node.",
                )
            )

    return errors


def _check_limits(data: dict) -> list[SceneValidationError]:
    """Enforce schema/limits.json scene-wide complexity and payload caps (Task 7)."""
    errors: list[SceneValidationError] = []

    def _cap(path: str, count: int, limit_key: str):
        limit = LIMITS[limit_key]
        if count > limit:
            errors.append(
                SceneValidationError(
                    path=path,
                    rule="limitExceeded",
                    message=f"{limit_key} exceeded: {count} exceeds the limit of {limit}.",
                )
            )

    shapes = data.get("shapes", [])
    groups = data.get("groups", [])
    layers = data.get("layers", [])
    bindings = data.get("bindings", [])
    nodes = data.get("graph", {}).get("nodes", [])
    connections = data.get("graph", {}).get("connections", [])

    _cap("$.shapes", len(shapes), "maxShapes")
    _cap("$.groups", len(groups), "maxGroups")
    _cap("$.layers", len(layers), "maxLayers")
    _cap("$.bindings", len(bindings), "maxBindings")
    _cap("$.graph.nodes", len(nodes), "maxGraphNodes")
    _cap("$.graph.connections", len(connections), "maxGraphConnections")

    conditional_count = sum(1 for node in nodes if node.get("family") == "condition")
    _cap("$.graph.nodes", conditional_count, "maxConditionalNodes")

    for index, group in enumerate(groups):
        _cap(f"$.groups[{index}].childIds", len(group.get("childIds", [])), "maxGroupChildIds")

    for index, shape in enumerate(shapes):
        if shape.get("type") == "path":
            _cap(f"$.shapes[{index}].points", len(shape.get("points", [])), "maxPathPoints")

    emitters = [shape for shape in shapes if shape.get("type") == "particleEmitter"]
    _cap("$.shapes", len(emitters), "maxParticleEmitters")
    total_rate = sum(emitter.get("rate", 0) for emitter in emitters)
    _cap("$.shapes", total_rate, "maxTotalParticleRate")

    max_depth = LIMITS["maxGroupNestingDepth"]
    groups_by_id = {group["id"]: group for group in groups}

    def _depth(group_id: str, seen: frozenset[str]) -> int:
        if group_id in seen:
            return 0  # a cycle is reported separately by _check_references
        group = groups_by_id.get(group_id)
        if group is None:
            return 0
        child_group_ids = [c for c in group.get("childIds", []) if c in groups_by_id]
        if not child_group_ids:
            return 1
        return 1 + max(_depth(c, seen | {group_id}) for c in child_group_ids)

    for index, group in enumerate(groups):
        depth = _depth(group["id"], frozenset())
        if depth > max_depth:
            errors.append(
                SceneValidationError(
                    path=f"$.groups[{index}]",
                    rule="limitExceeded",
                    message=(
                        f"maxGroupNestingDepth exceeded: {depth} exceeds the limit of {max_depth}."
                    ),
                )
            )

    payload_bytes = len(json.dumps(data).encode("utf-8"))
    _cap("$", payload_bytes, "maxScenePayloadBytes")

    return errors


def validate_scene(data: Any) -> SceneValidationResult:
    """Validate a scene document, safe to call with untrusted/malformed input.

    Runs schema version, then JSON Schema structure, then referential
    integrity, then complexity/payload limits — each stage short-circuits
    the next so errors stay specific instead of cascading into noise.
    """
    if not isinstance(data, dict):
        return SceneValidationResult(
            errors=[
                SceneValidationError(
                    path="$", rule="wrongType", message="Scene document must be a JSON object."
                )
            ]
        )

    schema_version = data.get("schemaVersion")
    if schema_version != SUPPORTED_SCHEMA_VERSION:
        return SceneValidationResult(
            errors=[
                SceneValidationError(
                    path="$.schemaVersion",
                    rule="unsupportedSchemaVersion",
                    message=(
                        f"Unsupported schema version: {schema_version!r}. "
                        f"Only version {SUPPORTED_SCHEMA_VERSION} is supported."
                    ),
                )
            ]
        )

    structural_errors = _check_structure(data)
    if structural_errors:
        return SceneValidationResult(errors=structural_errors)

    non_finite_errors = _check_non_finite_numbers(data)
    if non_finite_errors:
        return SceneValidationResult(errors=non_finite_errors)

    reference_errors = _check_references(data)
    if reference_errors:
        return SceneValidationResult(errors=reference_errors)

    return SceneValidationResult(errors=_check_limits(data))
