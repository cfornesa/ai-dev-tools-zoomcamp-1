"""Validate canonical 3D scene documents against schema/scene3d.schema.json.

Mirrors `frontend/src/validation/scene3d.ts` — both load the same schema
files from `schema/` and apply the same three-stage pipeline: schema
version/document type, then JSON Schema structure, then referential
integrity and complexity/payload limits. See `schema/README3d.md` for why
the pipeline is split this way, and `scenes/validation.py` for the
identical pattern this mirrors for the 2D schema (issue #211 is the 3D
counterpart of that file).

This is a genuinely separate document family from the 2D canonical scene
(see #208's decision): a `scene3d` document is never valid input to
`scenes.validation.validate_scene`, and vice versa.
"""

import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

SCHEMA_DIR = Path(__file__).resolve().parent.parent / "schema"

with (SCHEMA_DIR / "scene3d.schema.json").open() as _f:
    SCENE3D_SCHEMA: dict = json.load(_f)

with (SCHEMA_DIR / "limits3d.json").open() as _f:
    _raw_limits: dict = json.load(_f)
LIMITS3D: dict[str, int] = {k: v for k, v in _raw_limits.items() if not k.startswith("$")}

_STRUCTURAL_VALIDATOR = Draft202012Validator(SCENE3D_SCHEMA)

SUPPORTED_SCHEMA_VERSION = 1
SUPPORTED_DOCUMENT_TYPE = "scene3d"


@dataclass
class Scene3DValidationError:
    path: str
    rule: str
    message: str


@dataclass
class Scene3DValidationResult:
    errors: list[Scene3DValidationError] = field(default_factory=list)

    @property
    def valid(self) -> bool:
        return not self.errors


def _format_path(absolute_path) -> str:
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
    if error.validator == "additionalProperties" or error.validator == "unevaluatedProperties":
        return "unknownField"
    if error.validator == "type":
        return "wrongType"
    if error.validator in ("enum", "const", "pattern", "oneOf"):
        return "invalidValue"
    return "invalid"


def _check_structure(data: Any) -> list[Scene3DValidationError]:
    errors = []
    for error in _STRUCTURAL_VALIDATOR.iter_errors(data):
        errors.append(
            Scene3DValidationError(
                path=_format_path(error.absolute_path),
                rule=_structural_rule_for(error),
                message=error.message,
            )
        )
    return errors


def _check_non_finite_numbers(data: Any, path: str = "$") -> list[Scene3DValidationError]:
    """Reject `NaN`/`Infinity`/`-Infinity` anywhere in the document.

    See `scenes/validation.py`'s identical check for the full rationale
    (Python's `json` module accepts these as a non-standard extension;
    `minimum`/`maximum` comparisons against `NaN` are always `False`, so a
    `NaN` silently passes range validation and would otherwise propagate
    into `_check_limits`' arithmetic uncaught).
    """
    errors: list[Scene3DValidationError] = []
    if isinstance(data, float) and not math.isfinite(data):
        errors.append(
            Scene3DValidationError(
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


def _duplicate_ids(items: list[dict], collection: str) -> list[Scene3DValidationError]:
    seen: set[str] = set()
    errors = []
    for item in items:
        item_id = str(item.get("id"))
        if item_id in seen:
            errors.append(
                Scene3DValidationError(
                    path=f"$.{collection}",
                    rule="duplicateId",
                    message=f"Duplicate id '{item_id}' in {collection}.",
                )
            )
        seen.add(item_id)
    return errors


def _check_references(data: dict) -> list[Scene3DValidationError]:
    """Check cross-references JSON Schema cannot express (schema/README3d.md's
    "Fixtures and the schema/validator split" section): ids that must be
    unique within their collection, and an object's groupId must resolve
    to a real group or be null.
    """
    errors: list[Scene3DValidationError] = []

    lights = data.get("lights", [])
    groups = data.get("groups", [])
    objects = data.get("objects", [])

    errors += _duplicate_ids(lights, "lights")
    errors += _duplicate_ids(groups, "groups")
    errors += _duplicate_ids(objects, "objects")

    group_ids = {group["id"] for group in groups}
    for index, obj in enumerate(objects):
        group_id = obj.get("groupId")
        if group_id is not None and group_id not in group_ids:
            errors.append(
                Scene3DValidationError(
                    path=f"$.objects[{index}].groupId",
                    rule="danglingReference",
                    message=f"groupId '{group_id}' does not match any group.",
                )
            )

    return errors


def _check_limits(data: dict) -> list[Scene3DValidationError]:
    """Enforce schema/limits3d.json scene-wide complexity and payload caps."""
    errors: list[Scene3DValidationError] = []

    def _cap(path: str, count: int, limit_key: str):
        limit = LIMITS3D[limit_key]
        if count > limit:
            errors.append(
                Scene3DValidationError(
                    path=path,
                    rule="limitExceeded",
                    message=f"{limit_key} exceeded: {count} exceeds the limit of {limit}.",
                )
            )

    objects = data.get("objects", [])
    groups = data.get("groups", [])
    lights = data.get("lights", [])

    _cap("$.objects", len(objects), "maxObjects")
    _cap("$.groups", len(groups), "maxGroups")
    _cap("$.lights", len(lights), "maxLights")

    payload_bytes = len(json.dumps(data).encode("utf-8"))
    _cap("$", payload_bytes, "maxScenePayloadBytes")

    return errors


def validate_scene3d(data: Any) -> Scene3DValidationResult:
    """Validate a 3D scene document, safe to call with untrusted/malformed input.

    Runs schema version/document type, then JSON Schema structure, then
    referential integrity, then complexity/payload limits — each stage
    short-circuits the next so errors stay specific instead of cascading
    into noise. Mirrors `scenes.validation.validate_scene`'s pipeline.
    """
    if not isinstance(data, dict):
        return Scene3DValidationResult(
            errors=[
                Scene3DValidationError(
                    path="$", rule="wrongType", message="Scene document must be a JSON object."
                )
            ]
        )

    schema_version = data.get("schemaVersion")
    if schema_version != SUPPORTED_SCHEMA_VERSION:
        return Scene3DValidationResult(
            errors=[
                Scene3DValidationError(
                    path="$.schemaVersion",
                    rule="unsupportedSchemaVersion",
                    message=(
                        f"Unsupported schema version: {schema_version!r}. "
                        f"Only version {SUPPORTED_SCHEMA_VERSION} is supported."
                    ),
                )
            ]
        )

    document_type = data.get("documentType")
    if document_type != SUPPORTED_DOCUMENT_TYPE:
        return Scene3DValidationResult(
            errors=[
                Scene3DValidationError(
                    path="$.documentType",
                    rule="invalidValue",
                    message=(
                        f"Unsupported documentType: {document_type!r}. "
                        f"Only {SUPPORTED_DOCUMENT_TYPE!r} is supported."
                    ),
                )
            ]
        )

    structural_errors = _check_structure(data)
    if structural_errors:
        return Scene3DValidationResult(errors=structural_errors)

    non_finite_errors = _check_non_finite_numbers(data)
    if non_finite_errors:
        return Scene3DValidationResult(errors=non_finite_errors)

    reference_errors = _check_references(data)
    if reference_errors:
        return Scene3DValidationResult(errors=reference_errors)

    return Scene3DValidationResult(errors=_check_limits(data))
