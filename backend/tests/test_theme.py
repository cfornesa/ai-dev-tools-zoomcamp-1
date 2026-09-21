"""Finite, CSS-injection-safe theme/presentation token validation (#521/#576)."""

from scenes.theme import (
    DEFAULT_LIGHT_THEME,
    DEFAULT_PRESENTATION,
    DEFAULT_THEME,
    effective_presentation,
    effective_profile_theme,
    effective_theme,
    effective_theme_palettes,
    sanitize_presentation,
    sanitize_theme,
    sanitize_theme_config,
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


def test_effective_theme_resolves_default_style_and_override_per_mode():
    assert (
        effective_theme(
            {"light": {"accent": "#333333"}},
            style_tokens={"light": {"accent": "#222222"}},
            mode="light",
        )["accent"]
        == "#333333"
    )
    assert (
        effective_theme(
            {"light": {"accent": "#333333"}},
            style_tokens={"light": {"background": "#eeeeee"}},
            mode="light",
        )["background"]
        == "#eeeeee"
    )


def test_paired_theme_config_resolves_modes_and_legacy_values_as_dark():
    paired = sanitize_theme_config({"light": {"accent": "#111111"}, "dark": {"accent": "#222222"}})
    assert paired["light"] == {"accent": "#111111"}
    assert paired["dark"] == {"accent": "#222222"}
    palettes = effective_theme_palettes({"accent": "#333333"}, {"light": {"text": "#444444"}})
    assert palettes["light"]["accent"] == DEFAULT_LIGHT_THEME["accent"]
    assert palettes["light"]["text"] == "#444444"
    assert palettes["dark"]["accent"] == "#333333"


def test_paired_theme_config_rejects_mixed_and_injection_values():
    for bad in (
        {"light": {"accent": "red"}},
        {"dark": {"unknown": "#123456"}},
        {"light": {"accent": "#123456"}, "accent": "#654321"},
        {"light": {"accent": "url(javascript:alert(1))"}},
    ):
        try:
            sanitize_theme_config(bad)
            raise AssertionError(f"expected ValueError for {bad!r}")
        except ValueError:
            pass


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
