"""Issue #818 region-marker prompts, parsing, and generated response metadata."""

from types import SimpleNamespace

import pytest

from ai_provider.art_piece_provider import ArtPieceProvider, parse_regions
from ai_provider.prompts import art_piece_2d_prompt, art_piece_region_rule


@pytest.mark.parametrize("library", ("canvas2d", "svg", "p5js", "c2js", "c2js-interactive"))
def test_every_2d_prompt_describes_a_library_specific_region_marker(library):
    prompt = art_piece_2d_prompt(library)
    assert ("id=\"Background\"" in prompt) if library == "svg" else ("@layer" in prompt)
    assert "Background" in prompt


@pytest.mark.parametrize("library", ("threejs", "aframe"))
def test_every_3d_prompt_exposes_a_region_rule(library):
    assert "@layer" in art_piece_region_rule(library)


def test_parse_regions_handles_order_duplicates_and_nested_markers():
    code = "\n".join(
        [
            "// @layer Background",
            "drawBackground();",
            "// @layer Foreground",
            "if (true) {",
            "  // @layer Background",
            "  drawForeground();",
            "}",
        ]
    )
    assert parse_regions(code, "threejs") == [
        {"name": "Background", "start": 1, "end": 2},
        {"name": "Foreground", "start": 3, "end": 4},
        {"name": "Background 2", "start": 5, "end": 7},
    ]


def test_parse_regions_handles_nested_svg_groups():
    code = '<svg>\n  <g id="Outer">\n    <g id="Inner">\n    </g>\n  </g>\n</svg>'
    assert parse_regions(code, "svg") == [
        {"name": "Outer", "start": 2, "end": 5},
        {"name": "Inner", "start": 3, "end": 4},
    ]


def test_generate_returns_regions_and_non_blocking_warning_when_unmarked():
    response = SimpleNamespace(
        usage=SimpleNamespace(prompt_tokens=2, completion_tokens=3),
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content=(
                        "// no marker\nwindow.sketch = function (p) { p.setup = function () {}; };"
                    )
                )
            )
        ],
    )
    client = SimpleNamespace(chat=SimpleNamespace(complete=lambda **_: response))
    result = ArtPieceProvider(client=client).generate("a sketch", "p5js")
    assert result.code is not None
    assert result.regions == []
    assert result.warnings == ["missing_layer_markers"]
