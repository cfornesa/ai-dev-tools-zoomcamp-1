"""Finite, CSS-injection-safe theme tokens for issue #521."""

import re
from typing import cast

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
    "shadow": "none",
    "backdrop": "plain",
}
DESIGN_PALETTE_KEYS = (
    "background",
    "foreground",
    "muted",
    "muted_foreground",
    "primary",
    "primary_foreground",
    "secondary",
    "secondary_foreground",
    "accent",
    "accent_foreground",
    "destructive",
    "destructive_foreground",
)
DEFAULT_PALETTE_KEY = "original"


def _hsl(value: str) -> str:
    return f"hsl({value})"


# The palette values intentionally retain the HSL vocabulary from the original
# applications.  They are CSS-color data, not executable theme code.
PALETTE_DEFINITIONS: dict[str, dict[str, object]] = {
    "original": {
        "label": "Original",
        "description": "Cream, navy, and lime.",
        "light": {
            "background": _hsl("40 49% 94%"),
            "foreground": _hsl("201 56% 19%"),
            "muted": _hsl("37 50% 88%"),
            "muted_foreground": _hsl("197 42% 32%"),
            "primary": _hsl("88 60% 53%"),
            "primary_foreground": _hsl("0 0% 100%"),
            "secondary": _hsl("189 51% 57%"),
            "secondary_foreground": _hsl("0 0% 100%"),
            "accent": _hsl("33 90% 60%"),
            "accent_foreground": _hsl("0 0% 0%"),
            "destructive": _hsl("0 72% 51%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
        "dark": {
            "background": _hsl("206 55% 11%"),
            "foreground": _hsl("203 36% 90%"),
            "muted": _hsl("206 45% 16%"),
            "muted_foreground": _hsl("203 37% 65%"),
            "primary": _hsl("88 60% 53%"),
            "primary_foreground": _hsl("0 0% 0%"),
            "secondary": _hsl("189 51% 57%"),
            "secondary_foreground": _hsl("0 0% 0%"),
            "accent": _hsl("33 90% 60%"),
            "accent_foreground": _hsl("0 0% 0%"),
            "destructive": _hsl("0 72% 51%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
    },
    "bauhaus": {
        "label": "Bauhaus",
        "description": "Red, blue, and yellow geometry.",
        "light": {
            "background": _hsl("234 100% 87%"),
            "foreground": _hsl("0 0% 0%"),
            "muted": _hsl("0 0% 90%"),
            "muted_foreground": _hsl("0 0% 20%"),
            "primary": _hsl("240 100% 35%"),
            "primary_foreground": _hsl("0 0% 100%"),
            "secondary": _hsl("280 100% 30%"),
            "secondary_foreground": _hsl("0 0% 100%"),
            "accent": _hsl("50 100% 50%"),
            "accent_foreground": _hsl("0 0% 0%"),
            "destructive": _hsl("0 100% 40%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
        "dark": {
            "background": _hsl("0 0% 5%"),
            "foreground": _hsl("0 0% 95%"),
            "muted": _hsl("0 0% 15%"),
            "muted_foreground": _hsl("0 0% 80%"),
            "primary": _hsl("240 100% 65%"),
            "primary_foreground": _hsl("0 0% 0%"),
            "secondary": _hsl("280 100% 70%"),
            "secondary_foreground": _hsl("0 0% 0%"),
            "accent": _hsl("50 100% 50%"),
            "accent_foreground": _hsl("0 0% 0%"),
            "destructive": _hsl("0 100% 55%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
    },
    "monochrome": {
        "label": "Monochrome",
        "description": "Pure greyscale.",
        "light": {
            "background": _hsl("0 0% 98%"),
            "foreground": _hsl("0 0% 5%"),
            "muted": _hsl("0 0% 92%"),
            "muted_foreground": _hsl("0 0% 35%"),
            "primary": _hsl("0 0% 10%"),
            "primary_foreground": _hsl("0 0% 100%"),
            "secondary": _hsl("0 0% 30%"),
            "secondary_foreground": _hsl("0 0% 100%"),
            "accent": _hsl("0 0% 50%"),
            "accent_foreground": _hsl("0 0% 100%"),
            "destructive": _hsl("0 60% 45%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
        "dark": {
            "background": _hsl("0 0% 8%"),
            "foreground": _hsl("0 0% 92%"),
            "muted": _hsl("0 0% 15%"),
            "muted_foreground": _hsl("0 0% 65%"),
            "primary": _hsl("0 0% 90%"),
            "primary_foreground": _hsl("0 0% 8%"),
            "secondary": _hsl("0 0% 70%"),
            "secondary_foreground": _hsl("0 0% 8%"),
            "accent": _hsl("0 0% 50%"),
            "accent_foreground": _hsl("0 0% 100%"),
            "destructive": _hsl("0 60% 55%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
    },
    "newsprint": {
        "label": "Newsprint",
        "description": "Cream paper with red ink.",
        "light": {
            "background": _hsl("43 35% 92%"),
            "foreground": _hsl("0 0% 10%"),
            "muted": _hsl("43 25% 85%"),
            "muted_foreground": _hsl("0 0% 35%"),
            "primary": _hsl("0 75% 40%"),
            "primary_foreground": _hsl("0 0% 100%"),
            "secondary": _hsl("0 0% 20%"),
            "secondary_foreground": _hsl("0 0% 100%"),
            "accent": _hsl("30 80% 45%"),
            "accent_foreground": _hsl("0 0% 100%"),
            "destructive": _hsl("0 72% 45%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
        "dark": {
            "background": _hsl("30 15% 12%"),
            "foreground": _hsl("43 25% 88%"),
            "muted": _hsl("30 10% 18%"),
            "muted_foreground": _hsl("43 15% 65%"),
            "primary": _hsl("0 65% 55%"),
            "primary_foreground": _hsl("0 0% 100%"),
            "secondary": _hsl("0 0% 70%"),
            "secondary_foreground": _hsl("0 0% 10%"),
            "accent": _hsl("30 70% 55%"),
            "accent_foreground": _hsl("0 0% 0%"),
            "destructive": _hsl("0 65% 55%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
    },
    "ocean": {
        "label": "Ocean",
        "description": "Cool blues and teal.",
        "light": {
            "background": _hsl("200 30% 97%"),
            "foreground": _hsl("210 60% 15%"),
            "muted": _hsl("200 25% 90%"),
            "muted_foreground": _hsl("210 40% 35%"),
            "primary": _hsl("199 89% 40%"),
            "primary_foreground": _hsl("0 0% 100%"),
            "secondary": _hsl("175 60% 40%"),
            "secondary_foreground": _hsl("0 0% 100%"),
            "accent": _hsl("220 80% 55%"),
            "accent_foreground": _hsl("0 0% 100%"),
            "destructive": _hsl("0 72% 51%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
        "dark": {
            "background": _hsl("216 45% 10%"),
            "foreground": _hsl("200 30% 92%"),
            "muted": _hsl("216 35% 16%"),
            "muted_foreground": _hsl("200 25% 65%"),
            "primary": _hsl("199 80% 55%"),
            "primary_foreground": _hsl("0 0% 0%"),
            "secondary": _hsl("175 55% 50%"),
            "secondary_foreground": _hsl("0 0% 0%"),
            "accent": _hsl("220 70% 65%"),
            "accent_foreground": _hsl("0 0% 0%"),
            "destructive": _hsl("0 65% 55%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
    },
    "forest": {
        "label": "Forest",
        "description": "Deep greens and earth tones.",
        "light": {
            "background": _hsl("90 20% 96%"),
            "foreground": _hsl("140 40% 10%"),
            "muted": _hsl("90 15% 88%"),
            "muted_foreground": _hsl("140 30% 30%"),
            "primary": _hsl("130 45% 35%"),
            "primary_foreground": _hsl("0 0% 100%"),
            "secondary": _hsl("30 55% 40%"),
            "secondary_foreground": _hsl("0 0% 100%"),
            "accent": _hsl("80 50% 45%"),
            "accent_foreground": _hsl("0 0% 100%"),
            "destructive": _hsl("0 65% 45%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
        "dark": {
            "background": _hsl("140 30% 8%"),
            "foreground": _hsl("90 20% 90%"),
            "muted": _hsl("140 20% 14%"),
            "muted_foreground": _hsl("90 15% 65%"),
            "primary": _hsl("130 40% 50%"),
            "primary_foreground": _hsl("0 0% 0%"),
            "secondary": _hsl("30 50% 55%"),
            "secondary_foreground": _hsl("0 0% 0%"),
            "accent": _hsl("80 45% 55%"),
            "accent_foreground": _hsl("0 0% 0%"),
            "destructive": _hsl("0 60% 55%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
    },
    "sunset": {
        "label": "Sunset",
        "description": "Warm orange and pink.",
        "light": {
            "background": _hsl("20 60% 97%"),
            "foreground": _hsl("330 40% 10%"),
            "muted": _hsl("20 40% 90%"),
            "muted_foreground": _hsl("330 25% 35%"),
            "primary": _hsl("15 90% 55%"),
            "primary_foreground": _hsl("0 0% 100%"),
            "secondary": _hsl("340 75% 55%"),
            "secondary_foreground": _hsl("0 0% 100%"),
            "accent": _hsl("45 95% 55%"),
            "accent_foreground": _hsl("0 0% 0%"),
            "destructive": _hsl("0 72% 51%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
        "dark": {
            "background": _hsl("335 40% 8%"),
            "foreground": _hsl("20 50% 92%"),
            "muted": _hsl("335 30% 14%"),
            "muted_foreground": _hsl("20 30% 65%"),
            "primary": _hsl("15 80% 60%"),
            "primary_foreground": _hsl("0 0% 0%"),
            "secondary": _hsl("340 65% 65%"),
            "secondary_foreground": _hsl("0 0% 0%"),
            "accent": _hsl("45 90% 60%"),
            "accent_foreground": _hsl("0 0% 0%"),
            "destructive": _hsl("0 65% 55%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
    },
    "sepia": {
        "label": "Sepia",
        "description": "Aged paper and brown ink.",
        "light": {
            "background": _hsl("35 40% 93%"),
            "foreground": _hsl("25 40% 15%"),
            "muted": _hsl("35 30% 85%"),
            "muted_foreground": _hsl("25 30% 35%"),
            "primary": _hsl("20 55% 35%"),
            "primary_foreground": _hsl("35 40% 93%"),
            "secondary": _hsl("35 45% 45%"),
            "secondary_foreground": _hsl("0 0% 100%"),
            "accent": _hsl("15 70% 40%"),
            "accent_foreground": _hsl("0 0% 100%"),
            "destructive": _hsl("0 65% 40%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
        "dark": {
            "background": _hsl("25 35% 10%"),
            "foreground": _hsl("35 30% 88%"),
            "muted": _hsl("25 25% 16%"),
            "muted_foreground": _hsl("35 20% 65%"),
            "primary": _hsl("20 50% 55%"),
            "primary_foreground": _hsl("0 0% 0%"),
            "secondary": _hsl("35 40% 55%"),
            "secondary_foreground": _hsl("0 0% 0%"),
            "accent": _hsl("15 65% 55%"),
            "accent_foreground": _hsl("0 0% 0%"),
            "destructive": _hsl("0 60% 55%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
    },
    "high-contrast": {
        "label": "High Contrast",
        "description": "Maximum WCAG contrast.",
        "light": {
            "background": _hsl("0 0% 100%"),
            "foreground": _hsl("0 0% 0%"),
            "muted": _hsl("0 0% 94%"),
            "muted_foreground": _hsl("0 0% 20%"),
            "primary": _hsl("220 100% 30%"),
            "primary_foreground": _hsl("0 0% 100%"),
            "secondary": _hsl("0 0% 20%"),
            "secondary_foreground": _hsl("0 0% 100%"),
            "accent": _hsl("40 100% 35%"),
            "accent_foreground": _hsl("0 0% 0%"),
            "destructive": _hsl("0 100% 35%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
        "dark": {
            "background": _hsl("0 0% 0%"),
            "foreground": _hsl("0 0% 100%"),
            "muted": _hsl("0 0% 10%"),
            "muted_foreground": _hsl("0 0% 80%"),
            "primary": _hsl("220 100% 70%"),
            "primary_foreground": _hsl("0 0% 0%"),
            "secondary": _hsl("0 0% 80%"),
            "secondary_foreground": _hsl("0 0% 0%"),
            "accent": _hsl("40 100% 60%"),
            "accent_foreground": _hsl("0 0% 0%"),
            "destructive": _hsl("0 100% 60%"),
            "destructive_foreground": _hsl("0 0% 0%"),
        },
    },
    "pastel": {
        "label": "Pastel",
        "description": "Soft, low-saturation washes.",
        "light": {
            "background": _hsl("300 30% 98%"),
            "foreground": _hsl("270 30% 20%"),
            "muted": _hsl("300 20% 92%"),
            "muted_foreground": _hsl("270 20% 45%"),
            "primary": _hsl("260 60% 70%"),
            "primary_foreground": _hsl("0 0% 100%"),
            "secondary": _hsl("180 50% 65%"),
            "secondary_foreground": _hsl("0 0% 100%"),
            "accent": _hsl("340 65% 70%"),
            "accent_foreground": _hsl("0 0% 100%"),
            "destructive": _hsl("0 65% 65%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
        "dark": {
            "background": _hsl("270 30% 12%"),
            "foreground": _hsl("300 20% 92%"),
            "muted": _hsl("270 20% 18%"),
            "muted_foreground": _hsl("300 15% 70%"),
            "primary": _hsl("260 55% 75%"),
            "primary_foreground": _hsl("0 0% 0%"),
            "secondary": _hsl("180 45% 70%"),
            "secondary_foreground": _hsl("0 0% 0%"),
            "accent": _hsl("340 60% 75%"),
            "accent_foreground": _hsl("0 0% 0%"),
            "destructive": _hsl("0 60% 65%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
    },
    "celestial": {
        "label": "Celestial",
        "description": "Parchment and amber on cosmic black.",
        "light": {
            "background": _hsl("44 40% 93%"),
            "foreground": _hsl("267 25% 15%"),
            "muted": _hsl("44 30% 87%"),
            "muted_foreground": _hsl("267 20% 38%"),
            "primary": _hsl("33 60% 38%"),
            "primary_foreground": _hsl("44 40% 93%"),
            "secondary": _hsl("231 45% 30%"),
            "secondary_foreground": _hsl("44 40% 93%"),
            "accent": _hsl("33 60% 38%"),
            "accent_foreground": _hsl("44 40% 93%"),
            "destructive": _hsl("0 65% 40%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
        "dark": {
            "background": _hsl("0 0% 0%"),
            "foreground": _hsl("44 47% 83%"),
            "muted": _hsl("30 8% 10%"),
            "muted_foreground": _hsl("38 30% 62%"),
            "primary": _hsl("38 53% 51%"),
            "primary_foreground": _hsl("0 0% 0%"),
            "secondary": _hsl("231 55% 55%"),
            "secondary_foreground": _hsl("44 47% 83%"),
            "accent": _hsl("38 53% 51%"),
            "accent_foreground": _hsl("0 0% 0%"),
            "destructive": _hsl("0 65% 55%"),
            "destructive_foreground": _hsl("0 0% 100%"),
        },
    },
}
PRESENTATION_CHOICES = {
    "font_family": frozenset({"system", "serif", "mono", "script"}),
    "density": frozenset({"comfortable", "compact"}),
    "radius": frozenset({"sharp", "soft", "pill"}),
    "border_style": frozenset({"solid", "dashed", "none"}),
    "shadow": frozenset({"none", "soft", "offset"}),
    "backdrop": frozenset({"plain", "gradient", "cosmic"}),
}
THEME_KEYS = frozenset(DEFAULT_THEME)
_HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
_HSL_COLOR = re.compile(r"^hsl\(\d{1,3} \d{1,3}% \d{1,3}%\)$")


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


def _sanitize_design_palette(value: object) -> dict[str, str]:
    if not isinstance(value, dict):
        raise ValueError("palette values must be an object")
    unknown = set(value) - set(DESIGN_PALETTE_KEYS)
    if unknown:
        raise ValueError("Unknown design palette token")
    result: dict[str, str] = {}
    for key, color in value.items():
        if not isinstance(color, str) or not (
            _HEX_COLOR.fullmatch(color) or _HSL_COLOR.fullmatch(color)
        ):
            raise ValueError(f"Invalid design palette token: {key}")
        result[key] = color
    return result


def sanitize_palette_overrides(value: object) -> dict[str, dict[str, str]]:
    if not isinstance(value, dict):
        raise ValueError("palette_overrides must be an object")
    unknown = set(value) - {"light", "dark"}
    if unknown:
        raise ValueError("Unknown palette mode")
    return {
        mode: _sanitize_design_palette(value[mode]) for mode in ("light", "dark") if mode in value
    }


def available_palettes() -> list[dict[str, object]]:
    return [
        {
            "key": key,
            "label": values["label"],
            "description": values["description"],
            "values": {
                mode: dict(cast(dict[str, str], values[mode])) for mode in ("light", "dark")
            },
        }
        for key, values in PALETTE_DEFINITIONS.items()
    ]


def _style_design_values(style_tokens: object) -> dict[str, dict[str, str]]:
    try:
        style = sanitize_theme_config(style_tokens)
    except ValueError:
        return {"light": {}, "dark": {}}
    result: dict[str, dict[str, str]] = {"light": {}, "dark": {}}
    if set(style) & THEME_KEYS:
        for mode in result:
            result[mode].update(
                {
                    "background": cast(str, style.get("background", "")),
                    "muted": cast(str, style.get("surface", "")),
                    "foreground": cast(str, style.get("text", "")),
                    "muted_foreground": cast(str, style.get("muted", "")),
                    "accent": cast(str, style.get("accent", "")),
                }
            )
    else:
        for mode in result:
            raw = style.get(mode, {})
            if isinstance(raw, dict):
                result[mode].update(
                    {
                        "background": cast(str, raw.get("background", "")),
                        "muted": cast(str, raw.get("surface", "")),
                        "foreground": cast(str, raw.get("text", "")),
                        "muted_foreground": cast(str, raw.get("muted", "")),
                        "accent": cast(str, raw.get("accent", "")),
                    }
                )
    return {
        mode: {key: value for key, value in values.items() if value}
        for mode, values in result.items()
    }


def effective_design_palettes(
    style_tokens: object, palette_key: str | None, overrides: object
) -> dict[str, dict[str, str]]:
    selected = PALETTE_DEFINITIONS.get(palette_key or DEFAULT_PALETTE_KEY)
    if selected is None:
        selected = PALETTE_DEFINITIONS[DEFAULT_PALETTE_KEY]
    result: dict[str, dict[str, str]] = {
        mode: dict(cast(dict[str, str], selected[mode])) for mode in ("light", "dark")
    }
    # `original` is the compatibility palette: it preserves the established
    # style-specific colors.  Every named palette is intentionally independent
    # of the style colors so switching palettes is a visible, useful choice.
    if palette_key in {None, DEFAULT_PALETTE_KEY}:
        for mode, values in _style_design_values(style_tokens).items():
            result[mode].update(values)
    try:
        cleaned = sanitize_palette_overrides(overrides)
    except ValueError:
        cleaned = {}
    for mode, values in cleaned.items():
        result[mode].update(values)
    return result


def legacy_theme_palettes(design_palettes: dict[str, dict[str, str]]) -> dict[str, dict[str, str]]:
    return {
        mode: {
            "background": values["background"],
            "surface": values["muted"],
            "text": values["foreground"],
            "muted": values["muted_foreground"],
            "accent": values["accent"],
        }
        for mode, values in design_palettes.items()
    }


def effective_legacy_theme_palettes(
    style_tokens: object,
    palette_key: str | None,
    palette_overrides: object,
    legacy_overrides: object,
) -> dict[str, dict[str, str]]:
    """Expose the new semantic palette through the five-token legacy API."""
    palettes = legacy_theme_palettes(
        effective_design_palettes(style_tokens, palette_key, palette_overrides)
    )
    try:
        override = sanitize_theme_config(legacy_overrides)
    except ValueError:
        override = {}
    if set(override) & THEME_KEYS:
        palettes["dark"].update(cast(dict[str, str], override))
    else:
        for mode in ("light", "dark"):
            values = override.get(mode, {})
            if isinstance(values, dict):
                palettes[mode].update(cast(dict[str, str], values))
    return palettes


def effective_theme(
    value: object, *, style_tokens: object = None, mode: str = "dark"
) -> dict[str, str]:
    """Resolve one mode using default, catalog style, then owner override."""
    if mode not in {"light", "dark"}:
        raise ValueError("mode must be light or dark")
    return effective_theme_palettes(style_tokens, value)[mode]


def effective_theme_palettes(style_tokens: object, overrides: object) -> dict[str, dict[str, str]]:
    """Resolve independent light/dark palettes without changing legacy storage."""
    palettes = {
        "light": {
            "background": DEFAULT_LIGHT_THEME["background"],
            "surface": DEFAULT_LIGHT_THEME["surface"],
            "text": DEFAULT_LIGHT_THEME["text"],
            "muted": DEFAULT_LIGHT_THEME["muted"],
            "accent": DEFAULT_LIGHT_THEME["accent"],
        },
        "dark": dict(DEFAULT_THEME),
    }
    try:
        style = sanitize_theme_config(style_tokens)
    except ValueError:
        style = {}
    for source in (style,):
        if set(source) & THEME_KEYS:
            palettes["dark"].update(cast(dict[str, str], source))
        else:
            for mode in ("light", "dark"):
                values = source.get(mode, {})
                if isinstance(values, dict):
                    palettes[mode].update(cast(dict[str, str], values))
    try:
        override = sanitize_theme_config(overrides)
    except ValueError:
        override = {}
    for mode in ("light", "dark"):
        if set(override) & THEME_KEYS:
            if mode == "dark":
                palettes[mode].update(cast(dict[str, str], override))
        else:
            mode_values: object = override.get(mode, {})
            if isinstance(mode_values, dict):
                palettes[mode].update(cast(dict[str, str], mode_values))
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
