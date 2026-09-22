"""Safe, bounded AI custom-theme workflow for issue #725."""

from __future__ import annotations

import copy
import os
import re
import uuid
from typing import Any

from django.db import transaction

from ai_provider.config import use_fake_ai_provider
from scenes.models import ProfileStyle, ThemeGenerationAttempt
from scenes.theme import (
    DEFAULT_PRESENTATION,
    DESIGN_PALETTE_KEYS,
    PALETTE_DEFINITIONS,
    effective_design_palettes,
    sanitize_palette_overrides,
    sanitize_presentation,
)

MAX_PROMPT_CHARS = 2000
MAX_CODE_CHARS = 8000
MAX_ATTEMPTS = 3
FORBIDDEN_CODE = re.compile(
    r"(?:<script|javascript:|@import|url\s*\(|fetch\s*\(|XMLHttpRequest|document\.cookie|window\.location|eval\s*\(|new\s+Function)",
    re.IGNORECASE,
)


class ThemeGenerationError(ValueError):
    pass


def _fake_definition(prompt: str, current: dict[str, Any] | None = None) -> dict[str, Any]:
    base = copy.deepcopy(current) if current else {}
    key = "custom-" + uuid.uuid4().hex[:10]
    definition = {
        "key": base.get("key", key),
        "label": base.get("label", "AI Custom Theme"),
        "description": f"Generated from: {prompt[:180]}",
        "presentation": {
            **DEFAULT_PRESENTATION,
            "font_family": "serif" if "serif" in prompt.lower() else "system",
            "backdrop": "cosmic" if "cosmic" in prompt.lower() else "gradient",
        },
        "palettes": copy.deepcopy(PALETTE_DEFINITIONS["celestial"]),
        "code": {
            "css": ".ai-theme-preview { letter-spacing: 0.01em; }",
            "html": "<p class=\"ai-theme-preview\">A safe generated theme preview.</p>",
            "js": "",
        },
    }
    if base:
        definition["key"] = base.get("key", definition["key"])
        definition["label"] = base.get("label", definition["label"])
    return definition


def validate_theme_definition(value: object) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ThemeGenerationError("Theme output must be an object.")
    key = value.get("key")
    label = value.get("label")
    description = value.get("description", "")
    if not isinstance(key, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,47}", key):
        raise ThemeGenerationError("Theme key must use lowercase letters, numbers, and hyphens.")
    if not isinstance(label, str) or not label.strip() or len(label) > 80:
        raise ThemeGenerationError("Theme label must be non-empty and at most 80 characters.")
    if not isinstance(description, str) or len(description) > 240:
        raise ThemeGenerationError("Theme description is too long.")
    try:
        presentation = sanitize_presentation(value.get("presentation", {}))
    except ValueError as exc:
        raise ThemeGenerationError(str(exc)) from exc
    raw_palettes = value.get("palettes")
    if not isinstance(raw_palettes, dict) or set(raw_palettes) != {
        "label",
        "description",
        "light",
        "dark",
    }:
        raise ThemeGenerationError("Theme output must include light and dark palettes.")
    try:
        light = sanitize_palette_overrides({"light": raw_palettes["light"]})["light"]
        dark = sanitize_palette_overrides({"dark": raw_palettes["dark"]})["dark"]
    except (KeyError, ValueError) as exc:
        raise ThemeGenerationError(str(exc)) from exc
    if set(light) != set(DESIGN_PALETTE_KEYS) or set(dark) != set(DESIGN_PALETTE_KEYS):
        raise ThemeGenerationError("Both palettes must provide every semantic color token.")
    code = value.get("code", {})
    if not isinstance(code, dict) or set(code) - {"css", "html", "js"}:
        raise ThemeGenerationError("Theme code must contain only css, html, and js fields.")
    clean_code: dict[str, str] = {}
    for field in ("css", "html", "js"):
        raw = code.get(field, "")
        if not isinstance(raw, str) or len(raw) > MAX_CODE_CHARS:
            raise ThemeGenerationError(f"Theme {field} exceeds the safe size limit.")
        if FORBIDDEN_CODE.search(raw):
            raise ThemeGenerationError(
                "Theme preview code contains forbidden executable or network behavior."
            )
        clean_code[field] = raw
    return {
        "key": key,
        "label": label.strip(),
        "description": description.strip(),
        "presentation": {**DEFAULT_PRESENTATION, **presentation},
        "palettes": {
            "label": str(raw_palettes["label"])[:80],
            "description": str(raw_palettes["description"])[:240],
            "light": light,
            "dark": dark,
        },
        "code": clean_code,
    }


def _definition_from_style(style: ProfileStyle | None) -> dict[str, Any]:
    if style is None:
        return _fake_definition("default")
    tokens = style.tokens if isinstance(style.tokens, dict) else {}
    design = effective_design_palettes(tokens, "celestial", {})
    definition = validate_theme_definition(
        {
            "key": style.key,
            "label": style.label,
            "description": style.description,
            "presentation": style.presentation,
            "palettes": {
                "label": "Original",
                "description": "Current style colors.",
                "light": design["light"],
                "dark": design["dark"],
            },
            "code": {},
        }
    )
    # Keep the source representation so restore is byte-for-byte for legacy
    # styles that still use the compact five-token shape.
    definition["_style_tokens"] = copy.deepcopy(tokens)
    return definition


def generate_definition(prompt: str, current: dict[str, Any] | None = None) -> dict[str, Any]:
    prompt = prompt.strip()
    if not prompt or len(prompt) > MAX_PROMPT_CHARS:
        raise ThemeGenerationError("Prompt is required and must be at most 2,000 characters.")
    if not use_fake_ai_provider():
        raise ThemeGenerationError(
            "AI theme generation requires the configured server-side provider."
        )
    return validate_theme_definition(_fake_definition(prompt, current))


def _attempt_payload(row: ThemeGenerationAttempt) -> dict[str, Any]:
    return {
        "id": row.pk,
        "operation": row.operation,
        "state": row.state,
        "prompt": row.prompt,
        "original_prompt": row.original_prompt,
        "source": row.source,
        "revision": row.revision,
        "attempt_number": row.attempt_number,
        "sequence_token": row.sequence_token,
        "definition": row.definition,
        "error": row.error,
        "created_at": row.created_at.isoformat(),
    }


@transaction.atomic
def create_attempt(
    *,
    actor,
    prompt: str,
    operation: str,
    attempt_number: int = 1,
    current: dict[str, Any] | None = None,
    style: ProfileStyle | None = None,
) -> dict[str, Any]:
    if attempt_number > MAX_ATTEMPTS:
        raise ThemeGenerationError(
            "Maximum theme attempts reached; retry after changing the prompt."
        )
    definition = generate_definition(prompt, current)
    row = ThemeGenerationAttempt.objects.create(
        actor=actor,
        style=style,
        operation=operation,
        prompt=prompt.strip(),
        original_prompt=prompt.strip(),
        source="fake" if use_fake_ai_provider() else os.environ.get("AI_PROVIDER", "configured"),
        attempt_number=attempt_number,
        sequence_token=uuid.uuid4().hex,
        definition=definition,
        previous_definition=current or {},
    )
    return _attempt_payload(row)


@transaction.atomic
def accept_attempt(*, actor, attempt_id: int, expected_revision: int) -> dict[str, Any]:
    # PostgreSQL rejects FOR UPDATE across a nullable outer join, so the row
    # must be locked on its own; the nullable `style` relation is then
    # resolved as a separate, unlocked lookup.
    row = ThemeGenerationAttempt.objects.select_for_update().get(pk=attempt_id, actor=actor)
    if row.state != ThemeGenerationAttempt.State.DRAFT or row.revision != expected_revision:
        raise ThemeGenerationError("This draft is stale or is no longer editable.")
    definition = validate_theme_definition(row.definition)
    previous = _definition_from_style(row.style)
    style = row.style
    if style is None:
        style = ProfileStyle.objects.create(
            key=definition["key"],
            label=definition["label"],
            description=definition["description"],
            tokens={
                "light": definition["palettes"]["light"],
                "dark": definition["palettes"]["dark"],
            },
            presentation=definition["presentation"],
            enabled=True,
        )
        row.style = style
    else:
        style.key = definition["key"]
        style.label = definition["label"]
        style.description = definition["description"]
        style.tokens = {
            "light": definition["palettes"]["light"],
            "dark": definition["palettes"]["dark"],
        }
        style.presentation = definition["presentation"]
        style.revision += 1
        style.save()
    row.previous_definition = previous
    row.definition = definition
    row.state = ThemeGenerationAttempt.State.ACCEPTED
    row.revision += 1
    row.save()
    return _attempt_payload(row)


@transaction.atomic
def reject_attempt(*, actor, attempt_id: int, expected_revision: int) -> dict[str, Any]:
    row = ThemeGenerationAttempt.objects.select_for_update().get(pk=attempt_id, actor=actor)
    if row.state != ThemeGenerationAttempt.State.DRAFT or row.revision != expected_revision:
        raise ThemeGenerationError("This draft is stale or is no longer editable.")
    row.state = ThemeGenerationAttempt.State.REJECTED
    row.revision += 1
    row.save(update_fields=["state", "revision", "updated_at"])
    return _attempt_payload(row)


@transaction.atomic
def restore_attempt(*, actor, attempt_id: int) -> dict[str, Any]:
    # See accept_attempt: FOR UPDATE cannot join the nullable style relation.
    row = ThemeGenerationAttempt.objects.select_for_update().get(pk=attempt_id, actor=actor)
    if row.state != ThemeGenerationAttempt.State.ACCEPTED or not row.previous_definition:
        raise ThemeGenerationError("No accepted snapshot is available to restore.")
    if row.style is None:
        raise ThemeGenerationError("The accepted style no longer exists.")
    raw_previous = row.previous_definition
    previous = validate_theme_definition(raw_previous)
    style = row.style
    style.key = previous["key"]
    style.label = previous["label"]
    style.description = previous["description"]
    style.tokens = copy.deepcopy(
        raw_previous.get("_style_tokens")
        if isinstance(raw_previous, dict)
        else None or {"light": previous["palettes"]["light"], "dark": previous["palettes"]["dark"]}
    )
    style.presentation = previous["presentation"]
    style.revision += 1
    style.save()
    return _attempt_payload(row)
