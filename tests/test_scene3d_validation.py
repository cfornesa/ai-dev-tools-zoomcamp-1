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
    validate_scene3d,
)

SCHEMA_DIR = Path(__file__).resolve().parent.parent / "schema"
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
