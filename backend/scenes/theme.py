"""Finite, CSS-injection-safe theme tokens for issue #521."""

import re

DEFAULT_THEME = {
    "background": "#0b0d12",
    "surface": "#151923",
    "text": "#f3f4f6",
    "muted": "#9ca3af",
    "accent": "#c084fc",
}
THEME_KEYS = frozenset(DEFAULT_THEME)
_HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


def sanitize_theme(value: object) -> dict[str, str]:
    if not isinstance(value, dict):
        raise ValueError("theme_config must be an object")
    unknown = set(value) - THEME_KEYS
    if unknown:
        raise ValueError("Unknown theme token")
    for key, token in value.items():
        if not isinstance(token, str) or not _HEX_COLOR.fullmatch(token):
            raise ValueError(f"Invalid theme token: {key}")
    return {key: value[key] for key in value}


def effective_theme(value: object) -> dict[str, str]:
    try:
        override = sanitize_theme(value)
    except ValueError:
        override = {}
    return {**DEFAULT_THEME, **override}


def effective_profile_theme(style_tokens: object, legacy_overrides: object) -> dict[str, str]:
    """Resolve a catalog style plus the legacy safe token override contract."""
    try:
        style = sanitize_theme(style_tokens)
    except ValueError:
        style = {}
    try:
        legacy = sanitize_theme(legacy_overrides)
    except ValueError:
        legacy = {}
    return {**DEFAULT_THEME, **style, **legacy}
