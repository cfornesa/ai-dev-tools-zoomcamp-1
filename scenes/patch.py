"""A small, hand-written, allowlisted JSON Patch subset for AI scene edits (Task 47/50).

`_docs/plan.md`'s "AI actions" section: "Edit scene: prompt + current
scene JSON -> minimal structured patch -> preview -> accept/reject ...
Server validates output, patch operations, resource limits ... before
preview." This module is the "patch operations" half of that sentence:
a deliberately small, controlled RFC 6902-flavored patch dialect scoped
to exactly the operations and paths an AI edit proposal is allowed to
touch, plus a matching apply function.

## Why hand-written instead of a general RFC 6902 library

A generic JSON Patch library (e.g. `jsonpatch`) applies *any* operation
at *any* path -- exactly what this task must not allow. Every AI-proposed
patch has to be checked against a small, protected-field-aware allowlist
before it is ever applied, so a generic apply-first library would still
need this same allowlist layer wrapped around it. Hand-writing the (very
small) apply logic scoped to only `add`/`replace`/`remove` avoids a new
dependency decision (see `AGENTS.md`: "Dependencies are added in
`pyproject.toml`. Do not add one without asking") for no real savings.

## Operations

Only `add`, `replace`, and `remove` are accepted -- no `move`, `copy`, or
`test`. `_docs/plan.md` calls for a "minimal structured patch"; three
operations are already sufficient to express any shape/group/binding/
node/connection/layer addition, property change, or removal, and keeping
the op set small keeps both the allowlist and the apply logic easy to
reason about and to keep safe.

## Protected paths (never patchable)

- `/schemaVersion` -- schema-version identity; changing it out from under
  validation would let a patch silently target a different contract.
- `/id` -- the scene document's own identity.
- `/randomness/seed` -- `_docs/plan.md`'s "Visual randomness" section:
  "Editor or AI generates seeds; users do not manually re-roll seeds in
  V1 ... duplicating, forking, restoring, and exporting preserve the
  seed." An edit patch re-rolling the seed would be exactly the
  "manually re-roll" the plan rules out; `randomness.enabled` (whether
  seeded randomness is used at all) remains patchable.
- Any operation whose final JSON Pointer path segment is exactly `id`
  (e.g. `/shapes/3/id`, `/groups/0/id`, `/graph/nodes/2/id`) -- renaming
  an existing item's identity in place would silently break every
  binding/connection/group reference that points at the old id.
  Removing or adding a *whole* item (whose own body may contain an
  `id`) is unaffected by this rule; only altering an existing item's id
  field in isolation is blocked.

## Allowed paths

Only paths rooted at one of a fixed set of scene sections, and only at
element/property granularity -- never a bare whole-array replace (e.g.
`/shapes` on its own is rejected; `/shapes/-` or `/shapes/2/style/fill`
is allowed). Blocking whole-array replacement closes an otherwise-open
loophole: a single `replace` at `/shapes` could smuggle an id rename
past the "final segment is `id`" rule above, since the *path* of that
operation never ends in `id` even though its *value* silently changes
one. Requiring element/property granularity means every id already
present in the document can only move via whole-item add/remove, never
via an in-place field edit.

- `/shapes/...`, `/groups/...`, `/bindings/...`, `/layers/...` -- add,
  replace, or remove whole items or their properties.
- `/graph/nodes/...`, `/graph/connections/...` -- same, scoped under the
  graph's two arrays specifically (not `/graph` itself).
- `/accessibility/...` -- accessibility properties (e.g. `reducedMotion`).
- `/demoSignals` or any path under it -- demo/synthetic-signal config.
- `/canvas/backgroundColor` exactly -- the one canvas property small
  enough to fit "a minimal structured patch"; canvas width/height and
  `/renderer` are deliberately excluded (resizing the canvas or
  switching renderers has scene-wide coordinate/compatibility
  consequences out of scope for a "small revision").
- `/randomness/enabled` exactly (not `/randomness/seed`, per above).

Everything else -- including any path the schema doesn't even define --
is rejected.
"""

from __future__ import annotations

import copy
import json
from dataclasses import dataclass
from typing import Any

# --- Bounds (this task's own documented choices; _docs/plan.md requires
# bounding "AI prompt, AI output, and patch sizes" without pinning exact
# numbers) ---

# At most this many operations in one proposed patch. Generous enough to
# express a meaningfully sized edit (e.g. recoloring a dozen shapes) while
# still being "minimal" and bounding apply/validation cost.
MAX_PATCH_OPERATIONS = 40

# At most this many bytes for the patch document's own JSON serialization
# (independent of, and much smaller than, schema/limits.json's
# maxScenePayloadBytes, which bounds the *scene*, not the patch).
MAX_PATCH_BYTES = 20_000

_ALLOWED_OPS = frozenset({"add", "replace", "remove"})

_PROTECTED_EXACT_PATHS = frozenset({"/schemaVersion", "/id", "/randomness/seed"})

_ELEMENT_LEVEL_ROOTS = frozenset({"shapes", "groups", "bindings", "layers"})


class PatchError(Exception):
    """Raised when a proposed patch fails allowlist validation or apply."""


class PatchErrorReason:
    """Coarse-grained reasons `validate_patch_operations` can report, used by
    `scenes/ai_api.py` to give each rejection kind its own explicit HTTP
    response (per this task's acceptance criteria distinguishing "invalid
    path", "protected field", and "oversized")."""

    MALFORMED = "malformed"
    PROTECTED_FIELD = "protected_field"
    INVALID_PATH = "invalid_path"
    OVERSIZED = "oversized"


@dataclass(frozen=True)
class PatchOperationError:
    index: int
    message: str
    reason: str = PatchErrorReason.MALFORMED


def _split_pointer(pointer: str) -> list[str]:
    if pointer == "":
        return []
    if not pointer.startswith("/"):
        raise PatchError(f"path must start with '/': {pointer!r}")
    return [_unescape(seg) for seg in pointer.split("/")[1:]]


def _unescape(segment: str) -> str:
    return segment.replace("~1", "/").replace("~0", "~")


def _path_rejection_reason(pointer: str, segments: list[str]) -> str | None:
    """Return None if `pointer` is an allowed patch path, else the
    `PatchErrorReason` explaining why not."""
    if not segments:
        return PatchErrorReason.INVALID_PATH
    if pointer in _PROTECTED_EXACT_PATHS or segments[-1] == "id":
        return PatchErrorReason.PROTECTED_FIELD

    top = segments[0]
    if top in _ELEMENT_LEVEL_ROOTS:
        allowed = len(segments) >= 2
    elif top == "graph":
        allowed = len(segments) >= 3 and segments[1] in ("nodes", "connections")
    elif top == "accessibility":
        allowed = len(segments) >= 2
    elif top == "demoSignals":
        allowed = True
    elif top == "canvas":
        allowed = pointer == "/canvas/backgroundColor"
    elif top == "randomness":
        allowed = pointer == "/randomness/enabled"
    else:
        allowed = False

    return None if allowed else PatchErrorReason.INVALID_PATH


def validate_patch_operations(patch: Any) -> list[PatchOperationError]:
    """Validate a proposed patch document against the allowlist, structure,
    and size bounds. Returns an empty list iff the patch is acceptable --
    never raises for malformed *content* (only for a non-list `patch`, via
    an explicit error entry at index -1, so callers get one uniform
    reporting shape).
    """
    errors: list[PatchOperationError] = []

    if not isinstance(patch, list):
        return [
            PatchOperationError(
                index=-1,
                message="Patch document must be a JSON array.",
                reason=PatchErrorReason.MALFORMED,
            )
        ]

    serialized_bytes = len(json.dumps(patch).encode("utf-8"))
    if serialized_bytes > MAX_PATCH_BYTES:
        errors.append(
            PatchOperationError(
                index=-1,
                message=f"Patch is {serialized_bytes} bytes, exceeding the "
                f"{MAX_PATCH_BYTES}-byte limit.",
                reason=PatchErrorReason.OVERSIZED,
            )
        )

    if len(patch) > MAX_PATCH_OPERATIONS:
        errors.append(
            PatchOperationError(
                index=-1,
                message=f"Patch has {len(patch)} operations, exceeding the "
                f"{MAX_PATCH_OPERATIONS}-operation limit.",
                reason=PatchErrorReason.OVERSIZED,
            )
        )

    for index, op in enumerate(patch):
        if not isinstance(op, dict):
            errors.append(
                PatchOperationError(
                    index=index,
                    message="Operation must be an object.",
                    reason=PatchErrorReason.MALFORMED,
                )
            )
            continue

        op_name = op.get("op")
        path = op.get("path")

        if op_name not in _ALLOWED_OPS:
            errors.append(
                PatchOperationError(
                    index=index,
                    message=f"Unsupported op {op_name!r}; only add/replace/remove are allowed.",
                    reason=PatchErrorReason.MALFORMED,
                )
            )
            continue

        if not isinstance(path, str):
            errors.append(
                PatchOperationError(
                    index=index, message="path must be a string.", reason=PatchErrorReason.MALFORMED
                )
            )
            continue

        try:
            segments = _split_pointer(path)
        except PatchError as exc:
            errors.append(
                PatchOperationError(
                    index=index, message=str(exc), reason=PatchErrorReason.MALFORMED
                )
            )
            continue

        rejection_reason = _path_rejection_reason(path, segments)
        if rejection_reason is not None:
            errors.append(
                PatchOperationError(
                    index=index,
                    message=f"path {path!r} is not an allowed/patchable scene path.",
                    reason=rejection_reason,
                )
            )
            continue

        if op_name in ("add", "replace") and "value" not in op:
            errors.append(
                PatchOperationError(
                    index=index,
                    reason=PatchErrorReason.MALFORMED,
                    message=f"op {op_name!r} at {path!r} requires a 'value'.",
                )
            )

    return errors


# Priority order for picking one representative reason when a patch fails
# for more than one kind of reason at once (oversized patches are checked
# up front and may co-occur with per-operation errors) -- protected-field
# violations are surfaced first since they're the most security-relevant.
_REASON_PRIORITY = (
    PatchErrorReason.PROTECTED_FIELD,
    PatchErrorReason.INVALID_PATH,
    PatchErrorReason.OVERSIZED,
    PatchErrorReason.MALFORMED,
)


def worst_reason(errors: list[PatchOperationError]) -> str:
    """Pick one representative `PatchErrorReason` from a non-empty error
    list, for callers (e.g. `scenes/ai_api.py`) that map to a single HTTP
    response per rejected patch."""
    present = {e.reason for e in errors}
    for reason in _REASON_PRIORITY:
        if reason in present:
            return reason
    return PatchErrorReason.MALFORMED


def apply_patch(scene: dict[str, Any], patch: list[dict[str, Any]]) -> dict[str, Any]:
    """Apply an already-allowlist-validated patch to a deep copy of `scene`.

    Never mutates `scene` in place. Raises `PatchError` if an operation
    cannot be mechanically applied (e.g. an out-of-range array index, or
    a path through a non-existent parent) -- this is a distinct failure
    mode from allowlist rejection, checked only after the allowlist has
    already passed, and callers should treat it the same way (no draft,
    no version, no state change).
    """
    working = copy.deepcopy(scene)
    for index, op in enumerate(patch):
        try:
            _apply_one(working, op)
        except PatchError as exc:
            raise PatchError(f"operation {index}: {exc}") from exc
    return working


def _apply_one(document: dict[str, Any], op: dict[str, Any]) -> None:
    op_name = op["op"]
    segments = _split_pointer(op["path"])
    parent, last = _resolve_parent(document, segments)

    if op_name == "remove":
        _remove(parent, last)
    elif op_name == "add":
        _add(parent, last, copy.deepcopy(op["value"]))
    elif op_name == "replace":
        _replace(parent, last, copy.deepcopy(op["value"]))


def _resolve_parent(document: dict[str, Any], segments: list[str]) -> tuple[Any, str]:
    if len(segments) < 1:
        raise PatchError("path must reference at least one segment.")
    node = document
    for segment in segments[:-1]:
        if isinstance(node, dict):
            if segment not in node:
                raise PatchError(f"path segment {segment!r} does not exist.")
            node = node[segment]
        elif isinstance(node, list):
            node = _index_into_list(node, segment)
        else:
            raise PatchError(f"cannot traverse into a leaf value at segment {segment!r}.")
    return node, segments[-1]


def _index_into_list(node: list[Any], segment: str) -> Any:
    if not segment.isdigit():
        raise PatchError(f"expected a numeric array index, got {segment!r}.")
    idx = int(segment)
    if idx < 0 or idx >= len(node):
        raise PatchError(f"array index {idx} out of range (length {len(node)}).")
    return node[idx]


def _remove(parent: Any, key: str) -> None:
    if isinstance(parent, dict):
        if key not in parent:
            raise PatchError(f"cannot remove nonexistent key {key!r}.")
        del parent[key]
    elif isinstance(parent, list):
        if not key.isdigit() or int(key) >= len(parent):
            raise PatchError(f"cannot remove out-of-range array index {key!r}.")
        del parent[int(key)]
    else:
        raise PatchError("cannot remove from a non-container value.")


def _add(parent: Any, key: str, value: Any) -> None:
    if isinstance(parent, dict):
        parent[key] = value
    elif isinstance(parent, list):
        if key == "-":
            parent.append(value)
        else:
            if not key.isdigit() or int(key) > len(parent):
                raise PatchError(f"cannot add at out-of-range array index {key!r}.")
            parent.insert(int(key), value)
    else:
        raise PatchError("cannot add into a non-container value.")


def _replace(parent: Any, key: str, value: Any) -> None:
    if isinstance(parent, dict):
        if key not in parent:
            raise PatchError(f"cannot replace nonexistent key {key!r}.")
        parent[key] = value
    elif isinstance(parent, list):
        if not key.isdigit() or int(key) >= len(parent):
            raise PatchError(f"cannot replace out-of-range array index {key!r}.")
        parent[int(key)] = value
    else:
        raise PatchError("cannot replace within a non-container value.")


# --- Change summary (Task 42's local-draft summary is diff-based over a
# scene document, not a patch -- this is a new pattern scoped to patch
# operations specifically, deterministic and content-free enough to log
# and display safely) ---


def summarize_patch(patch: list[dict[str, Any]]) -> str:
    """A concise, deterministic, human-readable summary of a patch's shape,
    e.g. "3 changes: 2 shapes updated, 1 binding added." Counts by
    top-level section and op type; never includes raw values (which may
    echo prompt-influenced content) -- only counts and section/op labels.
    """
    if not patch:
        return "No changes."

    counts: dict[tuple[str, str], int] = {}
    for op in patch:
        segments = _split_pointer(op["path"]) if op.get("path") else []
        section = segments[0] if segments else "scene"
        verb = {"add": "added", "remove": "removed", "replace": "updated"}.get(
            op.get("op", ""), "changed"
        )
        counts[(section, verb)] = counts.get((section, verb), 0) + 1

    parts = [
        f"{count} {_label(section, count)} {verb}"
        for (section, verb), count in sorted(counts.items())
    ]
    total = len(patch)
    plural = "change" if total == 1 else "changes"
    return f"{total} {plural}: " + ", ".join(parts) + "."


def _label(section: str, count: int) -> str:
    singular = {
        "shapes": "shape",
        "groups": "group",
        "bindings": "binding",
        "layers": "layer",
        "graph": "graph node/connection",
        "accessibility": "accessibility setting",
        "demoSignals": "demo signal",
        "canvas": "canvas property",
        "randomness": "randomness setting",
    }
    label = singular.get(section, section)
    if count == 1 or label.endswith("connection"):
        return label
    return f"{label}s"


__all__ = [
    "MAX_PATCH_BYTES",
    "MAX_PATCH_OPERATIONS",
    "PatchError",
    "PatchErrorReason",
    "PatchOperationError",
    "apply_patch",
    "summarize_patch",
    "validate_patch_operations",
    "worst_reason",
]
