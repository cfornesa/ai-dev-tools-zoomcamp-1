"""Validate scenes/validation3d.py against schema/fixtures3d/*.

`schema/fixtures3d/expectations3d.json` is the single source of truth for
what each fixture should do at the raw-schema level; this file re-derives
validator-level expectations for the three fixtures where the validator
(duplicateId/danglingReference/limitExceeded) is stricter than the schema
alone (see schema/README3d.md's "Fixtures and the schema/validator
split"). `frontend/src/validation/scene3d.test.ts` asserts the same
expectations against the TypeScript validator. Mirrors
tests/test_scene_validation.py's pattern for the 2D schema.
"""

import json
from pathlib import Path

import pytest

from scenes.validation3d import (
    SUPPORTED_DOCUMENT_TYPE,
    SUPPORTED_SCHEMA_VERSION,
    normalize_scene3d_ai_output,
    validate_scene3d,
)

SCHEMA_DIR = Path(__file__).resolve().parent.parent.parent / "schema"
FIXTURES_DIR = SCHEMA_DIR / "fixtures3d"

with (FIXTURES_DIR / "expectations3d.json").open() as _f:
    _raw_expectations = json.load(_f)
EXPECTATIONS = {k: v for k, v in _raw_expectations.items() if not k.startswith("$")}

# The validator is stricter than the raw schema for these three: they are
# schema-valid (per expectations3d.json) but must be rejected once
# referential-integrity/complexity checks run.
VALIDATOR_ONLY_REJECTIONS = {
    "malicious/duplicate_ids.json": "duplicateId",
    "malicious/dangling_group_reference.json": "danglingReference",
    "malicious/oversized_document.json": "limitExceeded",
}


@pytest.mark.parametrize("fixture_path", sorted(EXPECTATIONS))
def test_fixture_matches_validator_expectation(fixture_path):
    data = json.loads((FIXTURES_DIR / fixture_path).read_text())

    result = validate_scene3d(data)

    if fixture_path in VALIDATOR_ONLY_REJECTIONS:
        assert result.valid is False, f"{fixture_path}: expected the validator to reject this"
        expected_rule = VALIDATOR_ONLY_REJECTIONS[fixture_path]
        assert any(error.rule == expected_rule for error in result.errors), (
            f"{fixture_path}: expected an error with rule '{expected_rule}', "
            f"got {[e.rule for e in result.errors]}"
        )
        return

    expectation = EXPECTATIONS[fixture_path]
    assert result.valid == expectation["valid"], (
        f"{fixture_path}: expected valid={expectation['valid']}, got {result.valid} "
        f"({[(e.path, e.rule) for e in result.errors]})"
    )
    if not expectation["valid"] and "rule" in expectation:
        assert any(error.rule == expectation["rule"] for error in result.errors), (
            f"{fixture_path}: expected an error with rule '{expectation['rule']}', "
            f"got {[e.rule for e in result.errors]}"
        )


def test_wrong_type_top_level_is_rejected():
    result = validate_scene3d([1, 2, 3])

    assert result.valid is False
    assert result.errors[0].rule == "wrongType"


def test_unsupported_schema_version_is_reported_before_other_errors():
    data = json.loads((FIXTURES_DIR / "valid/minimal.json").read_text())
    data["schemaVersion"] = 99

    result = validate_scene3d(data)

    assert result.valid is False
    assert len(result.errors) == 1  # short-circuited, not schema-structure noise
    assert result.errors[0].rule == "unsupportedSchemaVersion"


def test_wrong_document_type_is_rejected():
    data = json.loads((FIXTURES_DIR / "valid/minimal.json").read_text())
    data["documentType"] = "scene"  # the 2D document type

    result = validate_scene3d(data)

    assert result.valid is False
    assert result.errors[0].rule == "invalidValue"
    assert result.errors[0].path == "$.documentType"


def test_supported_constants_match_schema():
    assert SUPPORTED_SCHEMA_VERSION == 1
    assert SUPPORTED_DOCUMENT_TYPE == "scene3d"


def test_nan_is_rejected_as_non_finite():
    data = json.loads((FIXTURES_DIR / "valid/minimal.json").read_text())
    data["camera"]["fov"] = float("nan")

    result = validate_scene3d(data)

    assert result.valid is False
    assert any(error.rule == "nonFiniteNumber" for error in result.errors)


def test_errors_never_include_a_traceback_or_python_internals():
    data = json.loads((FIXTURES_DIR / "invalid/wrong_type.json").read_text())

    result = validate_scene3d(data)

    for error in result.errors:
        assert "Traceback" not in error.message
        assert "jsonschema" not in error.message.lower()


def test_named_object_is_accepted_for_every_object_type():
    """Regression for #230: a name on baseObjectFields must not be shadowed
    by any object3d type-specific allOf branch, mirroring #214's fix for
    the 2D shape schema."""
    data = json.loads((FIXTURES_DIR / "valid/minimal.json").read_text())
    base = {
        "groupId": None,
        "transform": {
            "position": {"x": 0, "y": 0, "z": 0},
            "rotation": {"x": 0, "y": 0, "z": 0},
            "scale": {"x": 1, "y": 1, "z": 1},
            "opacity": 1,
        },
        "material": {"color": "#ffffff"},
        "visible": True,
    }
    data["objects"] = [
        {
            "id": "b1",
            "name": "Named Box",
            "type": "box",
            "width": 1,
            "height": 1,
            "depth": 1,
            **base,
        },
        {"id": "s1", "name": "Named Sphere", "type": "sphere", "radius": 1, **base},
        {
            "id": "c1",
            "name": "Named Cylinder",
            "type": "cylinder",
            "radiusTop": 1,
            "radiusBottom": 1,
            "height": 1,
            **base,
        },
        {"id": "p1", "name": "Named Plane", "type": "plane", "width": 1, "height": 1, **base},
    ]
    data["lights"] = [
        {"id": "sun", "name": "Named Light", "type": "ambient", "color": "#ffffff", "intensity": 1}
    ]

    result = validate_scene3d(data)

    assert result.valid, [e.message for e in result.errors]


def _minimal_object(object_type: str) -> dict:
    return {
        "id": f"obj-{object_type}",
        "type": object_type,
        "groupId": None,
        "transform": {
            "position": {"x": 0, "y": 0, "z": 0},
            "rotation": {"x": 0, "y": 0, "z": 0},
            "scale": {"x": 1, "y": 1, "z": 1},
            "opacity": 1,
        },
        "material": {"color": "#ff0000"},
        "visible": True,
    }


@pytest.mark.parametrize(
    ("object_type", "expected"),
    [
        ("box", {"width": 1, "height": 1, "depth": 1}),
        ("sphere", {"radius": 1}),
        ("cylinder", {"radiusTop": 1, "radiusBottom": 1, "height": 1}),
        ("plane", {"width": 1, "height": 1}),
    ],
)
def test_ai_normalization_fills_only_the_missing_dimensions(object_type, expected):
    data = json.loads((FIXTURES_DIR / "valid/minimal.json").read_text())
    data["objects"] = [_minimal_object(object_type)]

    normalized = normalize_scene3d_ai_output(data)

    for field, value in expected.items():
        assert normalized["objects"][0][field] == value
        assert field not in data["objects"][0]
    assert validate_scene3d(normalized).valid


def test_ai_normalization_preserves_explicit_dimensions_and_does_not_mutate_input():
    data = json.loads((FIXTURES_DIR / "valid/minimal.json").read_text())
    obj = _minimal_object("box")
    obj.update({"width": 2.5, "height": 3, "depth": 4})
    data["objects"] = [obj]

    normalized = normalize_scene3d_ai_output(data)

    assert normalized["objects"][0]["width"] == 2.5
    assert normalized["objects"][0]["height"] == 3
    assert normalized["objects"][0]["depth"] == 4
    assert data["objects"][0]["width"] == 2.5
    assert data["objects"][0]["height"] == 3
    assert data["objects"][0]["depth"] == 4
    assert validate_scene3d(normalized).valid


def test_missing_box_dimensions_are_reported_precisely_without_normalization():
    data = json.loads((FIXTURES_DIR / "valid/minimal.json").read_text())
    data["objects"] = [_minimal_object("box")]

    result = validate_scene3d(data)

    assert result.valid is False
    assert [error.path for error in result.errors[:3]] == [
        "$.objects[0].width",
        "$.objects[0].height",
        "$.objects[0].depth",
    ]
    assert all(error.rule == "missingRequired" for error in result.errors[:3])
