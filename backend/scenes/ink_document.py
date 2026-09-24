"""Ink layers for generated 2D art pieces (#776).

An ink layer is a vector drawing composited *over* a sandboxed generated piece; the generated
source is never edited. It is exactly the canonical `drawingDocument` from
`schema/scene3d.schema.json` (#778) -- the same vocabulary a 3D drawing plane uses -- so the
frontend ink editor, the drawing rasteriser, and this validator share one contract. It is stored
under `ArtPieceVersion.generation_metadata["ink"]`, so no migration is needed; versions stay
immutable and a new ink edit is a new version with identical source.
"""

from __future__ import annotations

import json
from typing import Any

from jsonschema import Draft202012Validator

from scenes.validation3d import LIMITS3D, SCENE3D_SCHEMA

INK_MAX_PAYLOAD_BYTES = 262_144

_INK_VALIDATOR = Draft202012Validator(
    {"$ref": "#/$defs/drawingDocument", "$defs": SCENE3D_SCHEMA["$defs"]}
)


def validate_ink_document(value: Any) -> list[str]:
    """Human-readable problems with `value` as an ink document; empty when valid."""
    if not isinstance(value, dict):
        return ["Ink must be an object with width, height, and shapes."]
    errors = [
        f"{'.'.join(str(part) for part in error.absolute_path) or 'ink'}: {error.message}"
        for error in sorted(_INK_VALIDATOR.iter_errors(value), key=lambda e: list(e.absolute_path))
    ][:5]
    if errors:
        return errors
    shapes = value["shapes"]
    if len(shapes) > LIMITS3D["maxDrawingShapesPerPlane"]:
        return [
            f"Ink has {len(shapes)} shapes; the limit is {LIMITS3D['maxDrawingShapesPerPlane']}."
        ]
    seen: set[str] = set()
    for index, shape in enumerate(shapes):
        if shape["id"] in seen:
            return [f"shapes[{index}]: duplicate shape id '{shape['id']}'."]
        seen.add(shape["id"])
        if shape["type"] == "path" and len(shape["points"]) > LIMITS3D["maxDrawingPointsPerPath"]:
            return [
                f"shapes[{index}]: a stroke has {len(shape['points'])} points; "
                f"the limit is {LIMITS3D['maxDrawingPointsPerPath']}."
            ]
    if len(json.dumps(value).encode("utf-8")) > INK_MAX_PAYLOAD_BYTES:
        return [f"Ink is larger than {INK_MAX_PAYLOAD_BYTES} bytes."]
    return []


def ink_from_metadata(metadata: Any) -> dict | None:
    """The valid ink document stored in a version's metadata, or None."""
    if not isinstance(metadata, dict):
        return None
    ink = metadata.get("ink")
    if isinstance(ink, dict) and not validate_ink_document(ink):
        return ink
    return None


def metadata_with_inherited_ink(previous: Any, metadata: dict) -> dict:
    """`metadata` with the previous version's ink carried forward.

    An explicit `ink` (or null, to clear) wins. A source-only edit or AI refinement therefore
    never silently drops the owner's ink.
    """
    if "ink" in metadata:
        if metadata["ink"] is None:
            return {k: v for k, v in metadata.items() if k != "ink"}
        return metadata
    inherited = ink_from_metadata(previous)
    return {**metadata, "ink": inherited} if inherited else metadata
