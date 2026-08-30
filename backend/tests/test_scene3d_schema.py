"""Validate schema/scene3d.schema.json against schema/fixtures3d/*.

Issue #210 scopes this to the raw JSON Schema document only — there is no
Python/TypeScript validator yet (that's #211). See
schema/README3d.md's "Fixtures and the schema/validator split" section for
why three malicious/ fixtures are schema-valid on purpose.
"""

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

SCHEMA_DIR = Path(__file__).resolve().parent.parent.parent / "schema"
FIXTURES_DIR = SCHEMA_DIR / "fixtures3d"

with (SCHEMA_DIR / "scene3d.schema.json").open() as _f:
    SCHEMA = json.load(_f)

with (FIXTURES_DIR / "expectations3d.json").open() as _f:
    _raw_expectations = json.load(_f)
EXPECTATIONS = {k: v for k, v in _raw_expectations.items() if not k.startswith("$")}


def test_schema_is_valid_draft_2020_12():
    Draft202012Validator.check_schema(SCHEMA)


@pytest.mark.parametrize("fixture_path", sorted(EXPECTATIONS))
def test_fixture_matches_expectation(fixture_path):
    expectation = EXPECTATIONS[fixture_path]
    data = json.loads((FIXTURES_DIR / fixture_path).read_text())

    validator = Draft202012Validator(SCHEMA)
    errors = list(validator.iter_errors(data))

    assert (len(errors) == 0) == expectation["valid"], (
        f"{fixture_path}: expected valid={expectation['valid']}, "
        f"got errors={[e.message for e in errors]}"
    )
