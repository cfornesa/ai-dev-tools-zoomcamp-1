"""Validate scenes/validation.py against the shared schema/fixtures/*.

`schema/fixtures/expectations.json` is the single source of truth for
what each fixture should do; `frontend/src/validation/scene.test.ts`
asserts the same expectations against the TypeScript validator. Neither
suite runs the other's validator — they're checked for agreement
indirectly, through this shared file (see schema/README.md).
"""

import json
from pathlib import Path

import pytest

from scenes.validation import SUPPORTED_SCHEMA_VERSION, validate_scene

SCHEMA_DIR = Path(__file__).resolve().parent.parent / "schema"
FIXTURES_DIR = SCHEMA_DIR / "fixtures"

with (FIXTURES_DIR / "expectations.json").open() as _f:
    _raw_expectations = json.load(_f)
EXPECTATIONS = {k: v for k, v in _raw_expectations.items() if not k.startswith("$")}


@pytest.mark.parametrize("fixture_path", sorted(EXPECTATIONS))
def test_fixture_matches_expectation(fixture_path):
    expectation = EXPECTATIONS[fixture_path]
    data = json.loads((FIXTURES_DIR / fixture_path).read_text())

    result = validate_scene(data)

    assert result.valid == expectation["valid"], (
        f"{fixture_path}: expected valid={expectation['valid']}, got {result.valid} "
        f"({[(e.path, e.rule) for e in result.errors]})"
    )
    if not expectation["valid"]:
        assert any(error.rule == expectation["rule"] for error in result.errors), (
            f"{fixture_path}: expected an error with rule '{expectation['rule']}', "
            f"got {[e.rule for e in result.errors]}"
        )


def test_errors_never_include_a_traceback_or_python_internals():
    data = json.loads((FIXTURES_DIR / "invalid/wrong_type.json").read_text())

    result = validate_scene(data)

    for error in result.errors:
        assert "Traceback" not in error.message
        assert "jsonschema" not in error.message.lower()


def test_unsupported_schema_version_is_reported_before_other_errors():
    data = json.loads((FIXTURES_DIR / "valid/blank.json").read_text())
    data["schemaVersion"] = 999
    del data["canvas"]  # would also be a missingRequired error, but version wins

    result = validate_scene(data)

    assert result.valid is False
    assert len(result.errors) == 1
    assert result.errors[0].rule == "unsupportedSchemaVersion"


def test_missing_schema_version_is_unsupported():
    data = json.loads((FIXTURES_DIR / "valid/blank.json").read_text())
    del data["schemaVersion"]

    result = validate_scene(data)

    assert result.valid is False
    assert result.errors[0].rule == "unsupportedSchemaVersion"


def test_supported_schema_version_constant_matches_fixtures():
    blank = json.loads((FIXTURES_DIR / "valid/blank.json").read_text())
    assert blank["schemaVersion"] == SUPPORTED_SCHEMA_VERSION
