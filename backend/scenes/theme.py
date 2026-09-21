"""Finite, CSS-injection-safe theme tokens for issue #521."""

import re

DEFAULT_THEME = {
    "background": "#0b0d12",
    "surface": "#151923",
    "text": "#f3f4f6",
    "muted": "#9ca3af",
    "accent": "#c084fc",
}
DEFAULT_LIGHT_THEME = {
    "background": "#f8fafc",
    "surface": "#ffffff",
    "text": "#111827",
    "muted": "#64748b",
    "accent": "#7c3aed",
}
DEFAULT_PRESENTATION = {
    "font_family": "system",
    "density": "comfortable",
    "radius": "soft",
    "border_style": "solid",
}
PRESENTATION_CHOICES = {
    "font_family": frozenset({"system", "serif", "mono"}),
    "density": frozenset({"comfortable", "compact"}),
    "radius": frozenset({"sharp", "soft", "pill"}),
    "border_style": frozenset({"solid", "dashed", "none"}),
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


def sanitize_theme_config(value: object) -> dict[str, object]:
    """Validate either the legacy flat override or paired mode overrides."""
    if not isinstance(value, dict):
        raise ValueError("theme_config must be an object")
    if not value:
        return {}
    if set(value) & THEME_KEYS:
        return dict(sanitize_theme(value))
    unknown = set(value) - {"light", "dark"}
    if unknown:
        raise ValueError("Unknown theme palette")
    result: dict[str, object] = {}
    for mode in ("light", "dark"):
        if mode in value:
            result[mode] = sanitize_theme(value[mode])
    return result


def effective_theme(value: object) -> dict[str, str]:
    try:
        override = sanitize_theme(value)
    except ValueError:
        override = {}
    return {**DEFAULT_THEME, **override}


def effective_theme_palettes(style_tokens: object, overrides: object) -> dict[str, dict[str, str]]:
    """Resolve independent light/dark palettes without changing legacy storage."""
    try:
        style = sanitize_theme_config(style_tokens)
    except ValueError:
        style = {}
    try:
        override = sanitize_theme_config(overrides)
    except ValueError:
        override = {}

    palettes = {
        "light": {**DEFAULT_LIGHT_THEME},
        "dark": {**DEFAULT_THEME},
    }
    for source in (style, override):
        if set(source) & THEME_KEYS:
            palettes["dark"].update(source)  # type: ignore[arg-type]
        else:
            for mode in ("light", "dark"):
                mode_values = source.get(mode, {})
                if isinstance(mode_values, dict):
                    palettes[mode].update(mode_values)
    return palettes


def sanitize_presentation(value: object) -> dict[str, str]:
    if not isinstance(value, dict):
        raise ValueError("presentation must be an object")
    unknown = set(value) - set(PRESENTATION_CHOICES)
    if unknown:
        raise ValueError("Unknown presentation option")
    for key, option in value.items():
        if not isinstance(option, str) or option not in PRESENTATION_CHOICES[key]:
            raise ValueError(f"Invalid presentation option: {key}")
    return {key: value[key] for key in value}


def effective_presentation(value: object) -> dict[str, str]:
    try:
        override = sanitize_presentation(value)
    except ValueError:
        override = {}
    return {**DEFAULT_PRESENTATION, **override}


def effective_profile_theme(style_tokens: object, legacy_overrides: object) -> dict[str, str]:
    """Resolve a catalog style plus the legacy safe token override contract."""
    return effective_theme_palettes(style_tokens, legacy_overrides)["dark"]
