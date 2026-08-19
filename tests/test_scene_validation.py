"""Validate scenes/validation.py against the shared schema/fixtures/*.

`schema/fixtures/expectations.json` is the single source of truth for
what each fixture should do; `frontend/src/validation/scene.test.ts`
asserts the same expectations against the TypeScript validator. Neither
suite runs the other's validator — they're checked for agreement
indirectly, through this shared file (see schema/README.md).
"""

import json
import math
from pathlib import Path

import pytest

from scenes.validation import ALLOWED_NODE_TYPES_BY_FAMILY, SUPPORTED_SCHEMA_VERSION, validate_scene

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


# --- Task 72: NaN/Infinity fixtures excluded from the shared expectations.json
# loop (see its "$maliciousComment") because they're written with literal
# NaN/Infinity/-Infinity tokens -- a non-standard JSON extension Python's
# `json` module accepts by default but JS's strict `JSON.parse` rejects
# outright. Tested directly here instead of through the generic loop.


@pytest.mark.parametrize(
    "fixture_path,expected_path",
    [
        ("malicious/nan_opacity.json.txt", "$.shapes[0].transform.opacity"),
        ("malicious/infinity_unbounded_field.json.txt", "$.bindings[0].mapping.inMax"),
        ("malicious/negative_infinity_rotation.json.txt", "$.shapes[0].transform.rotation"),
    ],
)
def test_non_finite_number_fixtures_are_rejected(fixture_path, expected_path):
    # Confirms these fixtures parse successfully via Python's permissive
    # json.loads (proving the vulnerability class is real: the tokens do
    # reach validate_scene as float('nan')/float('inf')/float('-inf')) and
    # that validate_scene explicitly rejects them.
    data = json.loads((FIXTURES_DIR / fixture_path).read_text())

    result = validate_scene(data)

    assert result.valid is False
    assert any(e.path == expected_path for e in result.errors)


def test_json_loads_accepts_nan_and_infinity_by_default():
    # Documents the root cause this module's _check_non_finite_numbers
    # guards against: unlike strict JSON (and unlike JS's JSON.parse),
    # Python's json module accepts these three tokens as a non-standard
    # extension. If this assertion ever starts failing, it means Python's
    # json module (or however request bodies get parsed upstream) changed
    # its default behavior -- _check_non_finite_numbers would then be
    # unreachable-but-harmless defense in depth rather than a load-bearing
    # fix, which is worth knowing.
    parsed = json.loads('{"a": NaN, "b": Infinity, "c": -Infinity}')
    assert math.isnan(parsed["a"])
    assert math.isinf(parsed["b"]) and parsed["b"] > 0
    assert math.isinf(parsed["c"]) and parsed["c"] < 0


def test_nan_bypasses_plain_jsonschema_minimum_maximum_without_the_explicit_check():
    # Documents exactly why a dedicated non-finite-number check is
    # necessary and not redundant with scene.schema.json's minimum/maximum
    # keywords: NaN comparisons are always False in Python, so
    # `nan < minimum` and `nan > maximum` both evaluate False and
    # jsonschema's minimum/maximum validators never fire for it.
    from jsonschema import Draft202012Validator

    bounded = Draft202012Validator({"type": "number", "minimum": 0, "maximum": 1})
    assert list(bounded.iter_errors(math.nan)) == []


def test_forbidden_node_type_fixture_matches_the_shared_node_types_registry():
    data = json.loads((FIXTURES_DIR / "malicious/forbidden_node_type.json").read_text())
    node = data["graph"]["nodes"][0]
    assert node["family"] in ALLOWED_NODE_TYPES_BY_FAMILY
    assert node["type"] not in ALLOWED_NODE_TYPES_BY_FAMILY[node["family"]]


def test_output_family_node_types_are_not_enforced_by_validate_scene():
    # schema/fixtures/valid/feature_rich.json deliberately carries a
    # forward-looking output/previewTarget node -- the shared registry
    # (schema/node_types.json) deliberately leaves `output` unenforced
    # here (only frontend/src/runtime/behaviorRuntime.ts's execution-time
    # check rejects every output-family node, since it has an empty
    # allowlisted-type Set) -- see schema/node_types.json's
    # `$emptyFamilyMeansUnenforced`.
    feature_rich = json.loads((FIXTURES_DIR / "valid/feature_rich.json").read_text())
    output_nodes = [n for n in feature_rich["graph"]["nodes"] if n["family"] == "output"]
    assert output_nodes, "fixture must still exercise an output-family node"
    assert validate_scene(feature_rich).valid is True


def test_prototype_like_keys_are_ordinary_schema_valid_data_not_a_bypass():
    # __proto__/constructor/prototype as graph node param keys: schema-
    # legal (params accepts any string key with a leaf value), and safe --
    # Python dicts have no prototype chain, so this is inert server-side.
    # This fixture documents that "prototype-like keys" is a category with
    # no real Python-side vulnerability, not one this module needs to
    # special-case reject.
    data = json.loads((FIXTURES_DIR / "malicious/prototype_like_keys.json").read_text())
    result = validate_scene(data)
    assert result.valid is True
    assert data["graph"]["nodes"][0]["params"]["__proto__"] == "polluted"
