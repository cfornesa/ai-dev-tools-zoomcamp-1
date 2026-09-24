"""Provider-neutral extraction for models without native schema output."""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

MAX_REPAIR_ATTEMPTS = 1


class StructuredOutputError(ValueError):
    """Raised when extraction and the single bounded repair both fail."""


@dataclass(frozen=True)
class StructuredOutput:
    value: Any
    repair_attempts: int = 0


def extract_json(text: str) -> Any:
    """Extract one JSON value from clean, fenced, or prose-wrapped text."""
    if not isinstance(text, str) or not text.strip():
        raise StructuredOutputError("structured output was empty")
    candidate = text.strip()
    if candidate.startswith("```"):
        first_newline = candidate.find("\n")
        if first_newline < 0:
            raise StructuredOutputError("structured output fence was incomplete")
        candidate = candidate[first_newline + 1 :]
        if candidate.rstrip().endswith("```"):
            candidate = candidate.rstrip()[:-3].rstrip()
    decoder = json.JSONDecoder()
    for index, character in enumerate(candidate):
        if character not in "[{":
            continue
        try:
            value, _ = decoder.raw_decode(candidate[index:])
        except json.JSONDecodeError:
            continue
        return value
    raise StructuredOutputError("structured output did not contain valid JSON")


def parse_structured_output(
    text: str,
    *,
    validate: Callable[[Any], None] | None = None,
    repair: Callable[[str], str] | None = None,
) -> StructuredOutput:
    """Parse and validate output, allowing exactly one bounded repair call."""
    first_error: Exception | None = None
    try:
        value = extract_json(text)
        if validate is not None:
            validate(value)
        return StructuredOutput(value)
    except (StructuredOutputError, ValueError, TypeError) as exc:
        first_error = exc

    if repair is None:
        raise StructuredOutputError(str(first_error)) from first_error

    repaired = repair(str(first_error))
    try:
        value = extract_json(repaired)
        if validate is not None:
            validate(value)
    except (StructuredOutputError, ValueError, TypeError) as exc:
        raise StructuredOutputError(str(exc)) from exc
    return StructuredOutput(value, repair_attempts=1)


__all__ = [
    "MAX_REPAIR_ATTEMPTS",
    "StructuredOutput",
    "StructuredOutputError",
    "extract_json",
    "parse_structured_output",
]
