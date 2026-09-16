"""Finite, CSS-injection-safe theme/presentation token validation (#521/#576)."""

from scenes.theme import (
    DEFAULT_PRESENTATION,
    DEFAULT_THEME,
    effective_presentation,
    effective_profile_theme,
    effective_theme,
    sanitize_presentation,
    sanitize_theme,
)


def test_sanitize_theme_accepts_only_known_hex_tokens():
    value = sanitize_theme({"background": "#123abc", "accent": "#FF00FF"})
    assert value == {"background": "#123abc", "accent": "#FF00FF"}


def test_sanitize_theme_rejects_unknown_keys_and_non_hex_values():
    for bad in (
        {"unknown_field": "#123abc"},
        {"background": "red"},
        {"background": "javascript:alert(1)"},
        {"background": "<script>"},
        "not-a-dict",
        None,
        ["background", "#123abc"],
    ):
        try:
            sanitize_theme(bad)
            raise AssertionError(f"expected ValueError for {bad!r}")
        except ValueError:
            pass


def test_effective_theme_fails_closed_to_the_documented_default():
    assert effective_theme({"background": "not-a-color"}) == DEFAULT_THEME
    assert effective_theme("not-a-dict") == DEFAULT_THEME
    assert effective_theme(None) == DEFAULT_THEME


def test_effective_theme_applies_a_valid_partial_override_over_defaults():
    result = effective_theme({"accent": "#dc2626"})
    assert result["accent"] == "#dc2626"
    assert result["background"] == DEFAULT_THEME["background"]


def test_sanitize_presentation_accepts_only_documented_choices():
    value = sanitize_presentation({"font_family": "serif", "density": "compact"})
    assert value == {"font_family": "serif", "density": "compact"}


def test_sanitize_presentation_rejects_unknown_keys_and_invalid_choices():
    for bad in (
        {"font_family": "comic-sans"},
        {"unknown_option": "value"},
        {"radius": "javascript:alert(1)"},
        "not-a-dict",
        None,
    ):
        try:
            sanitize_presentation(bad)
            raise AssertionError(f"expected ValueError for {bad!r}")
        except ValueError:
            pass


def test_effective_presentation_fails_closed_to_the_documented_default():
    assert effective_presentation({"font_family": "invalid"}) == DEFAULT_PRESENTATION
    assert effective_presentation(None) == DEFAULT_PRESENTATION


def test_effective_profile_theme_legacy_override_takes_precedence_over_catalog_style():
    """The individual profile's own legacy token override must win over the
    selected catalog style, matching the documented cascade: global
    defaults < catalog style < the profile's own override (#576)."""
    style_tokens = {"accent": "#dc2626", "background": "#f4efe6"}
    legacy_override = {"accent": "#00ff00"}

    result = effective_profile_theme(style_tokens, legacy_override)

    assert result["accent"] == "#00ff00"
    assert result["background"] == "#f4efe6"
    assert result["text"] == DEFAULT_THEME["text"]


def test_effective_profile_theme_fails_closed_when_either_input_is_malformed():
    result = effective_profile_theme("not-a-dict", {"accent": "not-a-color"})
    assert result == DEFAULT_THEME
