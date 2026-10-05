from collections.abc import Mapping
from typing import Any

from django.conf import settings
from django.http import HttpRequest


def site_theme(request: HttpRequest) -> dict[str, Any]:
    """Expose the same safe palette and presentation tokens used by the SPA."""
    from scenes.admin_settings import effective_site_style
    from scenes.models import SiteSettings
    from scenes.theme import (
        effective_design_palettes,
        effective_legacy_theme_palettes,
        effective_presentation,
    )

    row = SiteSettings.get_solo()
    style = effective_site_style(row)
    tokens = style.tokens if style else {}
    palettes = effective_legacy_theme_palettes(
        tokens, row.palette_key, row.palette_overrides, row.theme_config
    )
    design = effective_design_palettes(tokens, row.palette_key, row.palette_overrides)
    presentation = effective_presentation(
        {**(style.presentation if style else {}), **row.presentation_overrides}
    )
    return {
        "site_title": row.site_title,
        "site_theme_palettes": palettes,
        "site_design_palettes": design,
        "site_presentation": presentation,
        "site_theme_css": {
            mode: palette_css_tokens(palettes[mode], design[mode]) for mode in ("light", "dark")
        },
        "site_theme_presentation_tokens": presentation_css_tokens(presentation),
    }


def palette_css_tokens(palette: Mapping[str, str], design: Mapping[str, str]) -> dict[str, str]:
    return {
        "bg": palette["background"],
        "surface": palette["surface"],
        "text_h": palette["text"],
        "text": palette["muted"],
        "accent": palette["accent"],
        "accent_foreground": design["accent_foreground"],
    }


def presentation_css_tokens(presentation: Mapping[str, str]) -> dict[str, str]:
    """Map sanitized presentation choices to fixed CSS-safe font stacks and sizes."""
    fonts = {
        "system": (
            "system-ui, 'Segoe UI', Roboto, sans-serif",
            "system-ui, 'Segoe UI', Roboto, sans-serif",
        ),
        "serif": ("Georgia, 'Times New Roman', serif", "Georgia, 'Times New Roman', serif"),
        "mono": ("ui-monospace, Consolas, monospace", "ui-monospace, Consolas, monospace"),
        "script": (
            "Lora, Georgia, 'Times New Roman', serif",
            "'Pinyon Script', Georgia, 'Times New Roman', serif",
        ),
    }
    font, heading = fonts[presentation["font_family"]]
    return {
        "sans": "system-ui, 'Segoe UI', Roboto, sans-serif",
        "site_font": font,
        "heading": heading,
        "density": "12px" if presentation["density"] == "compact" else "20px",
        "radius": {"sharp": "2px", "soft": "8px", "pill": "999px"}[presentation["radius"]],
        "border_style": "none"
        if presentation["border_style"] == "none"
        else presentation["border_style"],
    }


def recaptcha(request):
    """Expose only the public signup key and harmless verification metadata."""
    return {
        "recaptcha_site_key": settings.RECAPTCHA_SITE_KEY if settings.RECAPTCHA_ENABLED else "",
        "recaptcha_action": settings.RECAPTCHA_ACTION,
    }
