"""The 3D counterpart of `scenes/patch.py`'s allowlisted JSON Patch subset
(issue #232, generalizing #222/#158 for the `scene3d` document family).

Per #208's decision, `scene3d` is a genuinely separate document family
from the 2D canonical scene -- this module does not extend `patch.py`'s
allowlist, it defines its own, scoped to `schema/scene3d.schema.json`'s
shape. The mechanically generic pieces (JSON Pointer parsing, patch
application, size bounds, the bulk-scope heuristic, patch summarization)
are genuinely schema-agnostic and are imported from `patch.py` rather
than duplicated; only the allowlist and the prompt-element reference
check (which both need to know the 3D document's actual sections) are
reimplemented here.

## Allowed paths

- `/objects/...`, `/groups/...`, `/lights/...` -- add, replace, or
  remove whole items or their properties (mirrors `patch.py`'s
  `shapes`/`groups`/`layers`, at element/property granularity only --
  never a bare `/objects` whole-array replace).
- `/camera/...` -- property-level only (position/target/fov/near/far);
  there is exactly one camera, so this is always property-level, never
  a "whole element" subject to the unreferenced-element check below.
- `/scene/backgroundColor` exactly.
- `/randomness/enabled` exactly (not `/randomness/seed`).

## Protected paths

Same shape as `patch.py`: `/schemaVersion`, `/documentType`, `/id`,
`/randomness/seed`, and any path whose final segment is exactly `id`.

## Prompt-element reference check

Mirrors #222's generalization of issue #158 for `object`/`light`: an
operation touching one whole existing `objects`/`groups`/`lights`
element is rejected as `PatchErrorReason.UNREFERENCED_ELEMENT` unless
the prompt references that element by its `id` or its `name` (#230),
or the prompt is bulk-scope. `camera` is a singular element (not an
array), never subject to this check -- there is nothing to disambiguate.
"""

from __future__ import annotations

import json
from typing import Any

from scenes.patch import (
    MAX_PATCH_BYTES,
    MAX_PATCH_OPERATIONS,
    PatchError,
    PatchErrorReason,
    PatchOperationError,
    _get_at_path,
    _is_bulk_scope_prompt,
    _split_pointer,
)

__all__ = [
    "MAX_PATCH_BYTES",
    "MAX_PATCH_OPERATIONS",
    "PatchError",
    "PatchErrorReason",
    "PatchOperationError",
    "validate_patch_operations3d",
]

_ALLOWED_OPS = frozenset({"add", "replace", "remove"})

_PROTECTED_EXACT_PATHS = frozenset({"/schemaVersion", "/documentType", "/id", "/randomness/seed"})

_ELEMENT_LEVEL_ROOTS = frozenset({"objects", "groups", "lights"})

_IDENTITY_BEARING_ELEMENT_ROOTS = frozenset({"objects", "groups", "lights"})


def _is_identity_bearing_element_path(segments: list[str]) -> bool:
    return (
        len(segments) == 2
        and segments[0] in _IDENTITY_BEARING_ELEMENT_ROOTS
        and segments[1].isdigit()
    )


def _path_rejection_reason(pointer: str, segments: list[str]) -> str | None:
    if not segments:
        return PatchErrorReason.INVALID_PATH
    if pointer in _PROTECTED_EXACT_PATHS or segments[-1] == "id":
        return PatchErrorReason.PROTECTED_FIELD

    top = segments[0]
    if top in _ELEMENT_LEVEL_ROOTS:
        allowed = len(segments) >= 2
    elif top == "camera":
        allowed = len(segments) >= 2
    elif top == "scene":
        allowed = pointer == "/scene/backgroundColor"
    elif top == "randomness":
        allowed = pointer == "/randomness/enabled"
    else:
        allowed = False

    return None if allowed else PatchErrorReason.INVALID_PATH


def _reference_candidates(item: dict[str, Any]) -> list[str]:
    """Mirrors `patch.py`'s `_reference_candidates`, simplified: every 3D
    element kind (`object`/`group`/`light`) carries an `id`, and
    `object`/`light` optionally carry a `name` (#230); `group` always
    has a `name` (required by `schema/scene3d.schema.json`'s `group3d`)."""
    candidates: list[str] = []
    item_id = item.get("id")
    if isinstance(item_id, str) and item_id:
        candidates.append(item_id)
    name = item.get("name")
    if isinstance(name, str) and name:
        candidates.append(name)
    return candidates


def _prompt_references(prompt_lower: str, candidates: list[str]) -> bool:
    return any(candidate.lower() in prompt_lower for candidate in candidates)


def _touched_element_path(segments: list[str]) -> tuple[str, list[str]] | None:
    top = segments[0]
    if top in _ELEMENT_LEVEL_ROOTS and len(segments) >= 2:
        return top, segments[:2]
    return None


def validate_patch_operations3d(
    patch: Any, *, scene: dict[str, Any] | None = None, prompt: str | None = None
) -> list[PatchOperationError]:
    """The `scene3d` counterpart of `patch.py`'s `validate_patch_operations`
    -- same contract (empty list iff acceptable, `scene`/`prompt` both
    optional, each independently gating one additional check), scoped to
    the 3D document's own sections. See this module's docstring."""
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
                    message=f"path {path!r} is not an allowed/patchable scene3d path.",
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

        if scene is not None and prompt is not None and not bulk_scope:
            touched = _touched_element_path(segments)
            if touched is not None:
                root, element_segments = touched
                found, item = _get_at_path(scene, element_segments)
                if found and isinstance(item, dict):
                    candidates = _reference_candidates(item)
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
