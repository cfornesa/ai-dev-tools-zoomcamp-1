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
- A `replace` targeting an *existing* item by index (e.g. `/shapes/0`,
  `/graph/nodes/2`) whose replacement value's own `id` differs from the
  current item's `id` at that path. The per-field rule above only
  catches `.../id` as the literal *path*; a whole-object `replace` at
  the item's own index changes the id through the operation's *value*
  instead, without the path ever ending in `id` -- an identity rename
  smuggled through unless checked separately. `validate_patch_operations`
  therefore takes the current scene (when the caller has one, which
  `ai_provider.mistral_provider.edit_scene_with_patch` always does) and
  compares each such `replace`'s value id against the item currently at
  that path, rejecting a mismatch as a protected-field violation --
  independent of whether anything else in the document still references
  the old id (referential-integrity validation only happens to catch
  the *referenced* case, and only as a side effect, not by design).

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

## Prompt-element reference check (issue #158)

Everything above bounds *what kind* of change a patch may make. It says
nothing about *which* shape/group/binding/layer/graph node/connection a
patch touches versus what the prompt that produced it actually asked
about -- a prompt like "make the sun bigger" could, before this check
existed, still legally remove an unrelated shape nobody asked about,
because removing a shape is an allowed *kind* of operation. The project
owner's request was explicit: AI edits should "simply manipulat[e] or
add[] specified layers without touching those that are not referred to,"
and never destroy layers "unless explicitly stated."

`validate_patch_operations` takes an optional `prompt` string alongside
`scene`. When both are supplied, a second pass checks every operation
that touches one whole *existing* element in `shapes`/`groups`/
`bindings`/`layers`/`graph.nodes`/`graph.connections` (an "existing
element" here means `_get_at_path` resolves the operation's element-level
prefix, e.g. `/shapes/2` for an operation at `/shapes/2/style/fill`, to
something already in `scene` -- a brand-new item being added, e.g.
`/shapes/-` or an out-of-range index, is exempt: the prompt cannot be
expected to name something that doesn't exist yet) against a small set of
"reference candidates" built from that element:

- its own `id` (always present -- every element-level item's schema
  requires one),
- its `name` field, for `layers`/`groups` (the only two element kinds
  the schema gives a user-facing display name -- see
  `schema/scene.schema.json`'s `layer`/`group` `$defs`),
- for `shapes` specifically (which carry no `name` field of their own),
  a derived label matching the frontend's own convention
  (`frontend/src/pages/sceneShapes.ts`'s `shapeLabel`: type display name
  + 1-based ordinal among same-type shapes in array order, e.g.
  "Circle 2") -- `_shape_label` below reimplements that same convention
  server-side, since `scene` here is exactly the same JSON that function
  reads client-side.

An operation is flagged as `PatchErrorReason.UNREFERENCED_ELEMENT` if
none of that element's reference candidates appears (case-insensitive
substring match -- deliberately simple: exact/fuzzy name-or-id matching
is enough for this task, not a full NLP/entity-resolution system) inside
the prompt text, UNLESS the prompt is itself judged "bulk-scope" (see
below), in which case every element-level operation is exempt from this
check regardless of what it touches.

### The bulk-scope heuristic (deliberate simplification, not a hidden
limitation)

A prompt is treated as bulk/global in scope if it contains, as a whole
word (word-boundary regex, so e.g. "small" does not accidentally match
"all"), any of: "all", "every", "everything", "entire", "whole". This is
a fixed, small, first-pass word list -- exactly what this task's own
constraints call for ("matching a small fixed list of bulk-scope
words/phrases ... is an acceptable first pass") -- not an attempt to
understand scope semantically. A prompt that says "recolor everything"
or "reduce the opacity of all layers" is exempted entirely; a prompt that
merely happens to contain one of these words in an unrelated sense (rare
in practice, and only ever *widens* what's allowed, never narrows it) is
the accepted false-negative cost of keeping this heuristic small and
auditable.

This check only ever adds a *new* rejection reason on top of every
existing allowlist/protected-field/size check above -- it never changes
what those checks themselves accept or reject, and it is entirely
inert unless a caller passes `prompt` (every existing caller/test that
doesn't is completely unaffected -- see `validate_patch_operations`'s own
docstring).
"""

from __future__ import annotations

import copy
import json
import re
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
    # Issue #158: an operation touches one whole *existing* shape/group/
    # binding/layer/graph node/connection that the prompt text gives no
    # reasonable reference to, and the prompt isn't itself bulk/global in
    # scope. See this module's docstring's "Prompt-element reference
    # check" section.
    UNREFERENCED_ELEMENT = "unreferenced_element"


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
    segments = [_unescape(seg) for seg in pointer.split("/")[1:]]
    for segment in segments:
        if "/" in segment:
            # A `~1`-escaped literal `/` inside one segment. No real scene
            # field name or array index (id pattern `^[A-Za-z0-9_-]{1,64}$`,
            # every other key a fixed identifier) ever contains one, so a
            # segment carrying one here can only be an attempt to make two
            # path segments (e.g. the array index `0` and the protected
            # field `id`) collapse into what `_path_rejection_reason`'s
            # protected-suffix check (`segments[-1] == "id"`) and
            # `_ELEMENT_LEVEL_ROOTS` granularity check see as *one*
            # segment -- smuggling e.g. `/shapes/0/id` past both checks as
            # `/shapes/0~1id`, which splits+unescapes to `["shapes",
            # "0/id"]` instead of `["shapes", "0", "id"]`. Previously this
            # was only ever caught later, and only by accident, when
            # `apply_patch` tried to use `"0/id"` as a literal array index
            # or dict key and failed mechanically (`PatchError`, still no
            # scene produced -- so this was never an actual data-corruption
            # bypass) -- rejecting it explicitly here instead gives it the
            # same clear, safe, field-level error every other malformed
            # patch gets, rather than relying on that accident.
            raise PatchError(
                f"path segment {segment!r} contains an escaped '/' "
                f"(~1); no real scene path segment ever does: {pointer!r}"
            )
    return segments


def _unescape(segment: str) -> str:
    return segment.replace("~1", "/").replace("~0", "~")


# Roots whose array elements carry their own identity (`id`), for the
# whole-item-replace identity-preservation check below. `graph` is handled
# separately since its identity-bearing arrays are one level deeper
# (`/graph/nodes/<n>`, `/graph/connections/<n>`), not `/graph/<n>`.
_IDENTITY_BEARING_ELEMENT_ROOTS = frozenset({"shapes", "groups", "bindings", "layers"})


def _is_identity_bearing_element_path(segments: list[str]) -> bool:
    """True for a path that addresses one *whole* existing array element in
    an identity-bearing container -- e.g. `/shapes/0`, `/graph/nodes/2` --
    as opposed to a property beneath one (`/shapes/0/style/fill`) or the
    array itself (`/shapes`)."""
    if len(segments) == 2 and segments[0] in _IDENTITY_BEARING_ELEMENT_ROOTS:
        return segments[1].isdigit()
    if len(segments) == 3 and segments[0] == "graph" and segments[1] in ("nodes", "connections"):
        return segments[2].isdigit()
    return False


def _get_at_path(document: Any, segments: list[str]) -> tuple[bool, Any]:
    """Resolve `segments` against `document`. Returns `(True, value)` if the
    full path resolves to something, else `(False, None)` -- never raises,
    since this is used for a best-effort lookup during validation (a path
    that doesn't resolve here is either already invalid for other reasons
    or will separately fail `apply_patch`)."""
    node = document
    for segment in segments:
        if isinstance(node, dict):
            if segment not in node:
                return False, None
            node = node[segment]
        elif isinstance(node, list):
            if not segment.isdigit():
                return False, None
            idx = int(segment)
            if idx < 0 or idx >= len(node):
                return False, None
            node = node[idx]
        else:
            return False, None
    return True, node


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


# --- Issue #158: prompt-element reference check helpers --------------------

# Mirrors frontend/src/pages/sceneShapes.ts's SHAPE_TYPE_DISPLAY_NAMES --
# duplicated here (not imported -- this is Python, that's TypeScript) so
# `_shape_label` can reconstruct the exact same "Circle 2"-style label the
# editor UI shows a user for the same shape, from the same scene JSON.
_SHAPE_TYPE_DISPLAY_NAMES = {
    "circle": "Circle",
    "rect": "Rectangle",
    "line": "Line",
    "path": "Polygon",
}

# Deliberately small, fixed, first-pass word list (see this module's
# docstring's "The bulk-scope heuristic" section) -- word-boundary matched
# so e.g. "small"/"recall" never accidentally match "all".
_BULK_SCOPE_PATTERN = re.compile(r"\b(all|every|everything|entire|whole)\b", re.IGNORECASE)


def _is_bulk_scope_prompt(prompt: str) -> bool:
    return bool(_BULK_SCOPE_PATTERN.search(prompt))


def _shape_label(item: dict[str, Any], scene: dict[str, Any]) -> str | None:
    """Reimplements `frontend/src/pages/sceneShapes.ts`'s `shapeLabel`
    convention server-side: `<type display name> <1-based ordinal among
    same-type shapes in array order>` (e.g. "Circle 2"). Returns None if
    `item`/`scene` don't carry enough shape data to compute this (should
    not happen for a real scene document, but this function never raises)."""
    shape_type = item.get("type")
    if not isinstance(shape_type, str):
        return None
    shapes = scene.get("shapes")
    if not isinstance(shapes, list):
        return None
    item_id = item.get("id")
    same_type = [s for s in shapes if isinstance(s, dict) and s.get("type") == shape_type]
    ordinal = next(
        (i + 1 for i, s in enumerate(same_type) if s.get("id") == item_id and item_id is not None),
        len(same_type) + 1,
    )
    display = _SHAPE_TYPE_DISPLAY_NAMES.get(shape_type, shape_type.capitalize())
    return f"{display} {ordinal}"


def _reference_candidates(root: str, item: dict[str, Any], scene: dict[str, Any]) -> list[str]:
    """The strings a prompt could plausibly use to refer to `item` (an
    existing element at top-level section `root`, e.g. "shapes" or
    "graph.nodes"): its own id, its `name` field when it has one
    (layers/groups only), and -- for shapes specifically, which carry no
    `name` of their own -- its derived display label."""
    candidates: list[str] = []
    item_id = item.get("id")
    if isinstance(item_id, str) and item_id:
        candidates.append(item_id)
    name = item.get("name")
    if isinstance(name, str) and name:
        candidates.append(name)
    if root == "shapes":
        label = _shape_label(item, scene)
        if label:
            candidates.append(label)
    return candidates


def _prompt_references(prompt_lower: str, candidates: list[str]) -> bool:
    return any(candidate.lower() in prompt_lower for candidate in candidates)


def _touched_element_path(segments: list[str]) -> tuple[str, list[str]] | None:
    """For an allowlisted patch path's segments, returns `(root_label,
    element_segments)` -- the path prefix addressing the one whole element
    (shape/group/binding/layer/graph node/connection) this operation
    touches -- or None if `segments` doesn't address an element-level
    section at all (e.g. `/canvas/backgroundColor`, `/accessibility/...`,
    `/demoSignals`, `/randomness/enabled` -- scene-wide settings, not
    individual elements, and out of this check's scope)."""
    top = segments[0]
    if top in _ELEMENT_LEVEL_ROOTS and len(segments) >= 2:
        return top, segments[:2]
    if top == "graph" and len(segments) >= 3 and segments[1] in ("nodes", "connections"):
        return f"graph.{segments[1]}", segments[:3]
    return None


def validate_patch_operations(
    patch: Any, *, scene: dict[str, Any] | None = None, prompt: str | None = None
) -> list[PatchOperationError]:
    """Validate a proposed patch document against the allowlist, structure,
    and size bounds. Returns an empty list iff the patch is acceptable --
    never raises for malformed *content* (only for a non-list `patch`, via
    an explicit error entry at index -1, so callers get one uniform
    reporting shape).

    `scene` is the current scene the patch would be applied to. When
    provided, an additional check runs: a `replace` targeting one whole
    existing array element by index (e.g. `/shapes/0`) whose replacement
    value's own `id` differs from that element's current `id` is rejected
    as a protected-field violation (see this module's docstring's
    "Protected paths" section for why -- the per-field `.../id` path rule
    alone doesn't catch an identity change smuggled through a whole-object
    replace's *value*). Callers that already have the scene on hand (every
    real caller does -- `ai_provider.mistral_provider.edit_scene_with_patch`
    is about to apply the patch to it) should always pass it; omitting it
    only skips this one check, not the rest of allowlist validation.

    `prompt` is the natural-language edit request the patch was generated
    from. When both `scene` and `prompt` are provided, a further check
    runs (issue #158, see this module's docstring's "Prompt-element
    reference check" section): any operation touching one whole *existing*
    shape/group/binding/layer/graph node/connection the prompt text gives
    no reasonable reference to is rejected as
    `PatchErrorReason.UNREFERENCED_ELEMENT`, unless the prompt is itself
    judged bulk/global in scope. Omitting `prompt` (or `scene`) only skips
    this one check, not the rest of allowlist validation --
    `ai_provider.mistral_provider.edit_scene_with_patch` is the one real
    caller with both on hand, and always passes them.
    """
    errors: list[PatchOperationError] = []
    bulk_scope = prompt is not None and _is_bulk_scope_prompt(prompt)
    prompt_lower = prompt.lower() if prompt is not None else ""

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
            continue

        if (
            scene is not None
            and op_name == "replace"
            and _is_identity_bearing_element_path(segments)
        ):
            value = op.get("value")
            if isinstance(value, dict) and "id" in value:
                found, current_item = _get_at_path(scene, segments)
                if (
                    found
                    and isinstance(current_item, dict)
                    and "id" in current_item
                    and current_item["id"] != value["id"]
                ):
                    errors.append(
                        PatchOperationError(
                            index=index,
                            reason=PatchErrorReason.PROTECTED_FIELD,
                            message=(
                                f"replace at {path!r} would change this item's id from "
                                f"{current_item['id']!r} to {value['id']!r}; whole-item "
                                "replace must preserve the existing id."
                            ),
                        )
                    )

        # Issue #158: prompt-element reference check -- only runs when both
        # `scene` and `prompt` were supplied (see docstring above), and only
        # exempted entirely when the prompt is bulk/global in scope.
        if scene is not None and prompt is not None and not bulk_scope:
            touched = _touched_element_path(segments)
            if touched is not None:
                root, element_segments = touched
                found, item = _get_at_path(scene, element_segments)
                if found and isinstance(item, dict):
                    candidates = _reference_candidates(root, item, scene)
                    if candidates and not _prompt_references(prompt_lower, candidates):
                        errors.append(
                            PatchOperationError(
                                index=index,
                                reason=PatchErrorReason.UNREFERENCED_ELEMENT,
                                message=(
                                    f"path {path!r} touches an existing {root} element "
                                    f"({candidates[0]!r}) the prompt text doesn't appear to "
                                    "reference; name it explicitly, or make the prompt "
                                    "explicitly broad in scope (e.g. \"all\"/\"every\"/"
                                    '"everything"/"entire"/"whole"), to allow this change.'
                                ),
                            )
                        )

    return errors


# Priority order for picking one representative reason when a patch fails
# for more than one kind of reason at once (oversized patches are checked
# up front and may co-occur with per-operation errors) -- protected-field
# violations are surfaced first since they're the most security-relevant.
_REASON_PRIORITY = (
    PatchErrorReason.PROTECTED_FIELD,
    PatchErrorReason.UNREFERENCED_ELEMENT,
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
