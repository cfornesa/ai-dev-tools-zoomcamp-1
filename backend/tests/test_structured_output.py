"""Issue #816: bounded extraction and repair for non-native schema models."""

from __future__ import annotations

import pytest

from ai_provider.structured_output import StructuredOutputError, parse_structured_output


def _scene_validator(value):
    if not isinstance(value, dict) or value.get("kind") != "scene":
        raise ValueError("expected scene object")


@pytest.mark.parametrize(
    "text",
    [
        '{"kind":"scene"}',
        '```json\n{"kind":"scene"}\n```',
        'Here is the result:\n{"kind":"scene"}\nThanks.',
    ],
)
def test_clean_fenced_and_prose_wrapped_json_is_extracted(text):
    result = parse_structured_output(text, validate=_scene_validator)
    assert result.value == {"kind": "scene"}
    assert result.repair_attempts == 0


def test_truncated_json_gets_one_repair_attempt_and_succeeds():
    calls = []

    def repair(error):
        calls.append(error)
        return '{"kind":"scene"}'

    result = parse_structured_output('{"kind":', validate=_scene_validator, repair=repair)

    assert result.value == {"kind": "scene"}
    assert result.repair_attempts == 1
    assert len(calls) == 1


def test_invalid_schema_gets_one_repair_attempt_then_structured_error():
    calls = []

    def repair(error):
        calls.append(error)
        return '{"kind":"still-wrong"}'

    with pytest.raises(StructuredOutputError, match="expected scene object"):
        parse_structured_output('{"kind":"not-a-scene"}', validate=_scene_validator, repair=repair)

    assert len(calls) == 1


def test_repair_is_never_called_more_than_once():
    calls = []

    def repair(error):
        calls.append(error)
        return "not json"

    with pytest.raises(StructuredOutputError):
        parse_structured_output("truncated", repair=repair)

    assert len(calls) == 1
