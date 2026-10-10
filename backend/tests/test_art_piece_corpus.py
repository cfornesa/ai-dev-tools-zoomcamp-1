from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest

from ai_provider.art_piece_provider import (
    ArtPieceProvider,
    _looks_like_requested_showcase,
    _looks_like_snippet,
    extract_snippet,
)

CORPUS = Path(__file__).parent / "fixtures" / "art_piece_corpus"


@pytest.mark.parametrize(
    ("filename", "library", "prompt", "expected"),
    [
        ("prose_wrapped_canvas.txt", "canvas2d", "calm field", (True, None)),
        ("fenced_svg.txt", "svg", "teal circle", (True, None)),
        ("truncated_aframe.txt", "aframe", "a box", (True, None)),
        (
            "inline_script_aframe.txt",
            "aframe",
            "click switch to dim the light",
            (True, None),
        ),
        (
            "hardcoded_gauge.svg",
            "svg",
            "animated gauge with gradient and clipPath",
            (False, "hardcoded_dash_value"),
        ),
        (
            "runtime_gauge.svg",
            "svg",
            "animated gauge with gradient and clipPath",
            (True, None),
        ),
        ("empty.txt", "svg", "anything", (False, "empty_snippet")),
        ("wrapped_threejs.txt", "threejs", "a scene", (False, "threejs_wrapped_markup")),
    ],
)
def test_corpus_extracts_then_validates(filename, library, prompt, expected):
    raw = (CORPUS / filename).read_text()
    snippet = extract_snippet(raw, library)
    snippet_result = _looks_like_snippet(snippet, library, prompt)
    showcase_result = _looks_like_requested_showcase(snippet, prompt, library)

    if expected[0]:
        assert snippet_result[0] is True
        assert showcase_result == (True, None)
    else:
        assert expected == (snippet_result if not snippet_result[0] else showcase_result)


def test_corpus_replays_failure_then_repair_without_network():
    responses = iter(
        [
            (CORPUS / "hardcoded_gauge.svg").read_text(),
            (CORPUS / "runtime_gauge.svg").read_text(),
        ]
    )
    calls = []

    class ScriptedChat:
        def complete(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(
                usage=SimpleNamespace(prompt_tokens=1, completion_tokens=1),
                choices=[SimpleNamespace(message=SimpleNamespace(content=next(responses)))],
            )

    provider = ArtPieceProvider(client=SimpleNamespace(chat=ScriptedChat()))
    result = provider.generate(
        "animated gauge with gradient and clipPath", "svg", auto_retry_enabled=True
    )

    assert result.error is None
    assert result.code == (CORPUS / "runtime_gauge.svg").read_text().strip()
    assert len(calls) == 2
    assert "hardcoded_dash_value" in calls[1]["messages"][-1]["content"]
