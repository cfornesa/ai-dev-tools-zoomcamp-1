"""Regression coverage for issue #203: `ArtPieceProvider.generate()` raised
an unhandled 500 in production because its `client` property imported
`from mistralai import Mistral` (no such top-level export in the installed
`mistralai` SDK) instead of `mistral_provider.py`'s correct
`from mistralai.client import Mistral`. Every other art-piece test
(`test_art_piece_api.py`) monkeypatches `get_art_piece_provider` or injects
a fake `client=...`, so none of them ever executed this property's real
import -- exactly the gap issue #203 asked future coverage to close.
Mirrors `test_mistral_provider.py`'s
`test_client_property_lazily_builds_a_real_client_using_the_env_var`.
"""

from __future__ import annotations

from types import SimpleNamespace

import httpx
import pytest

import ai_provider.art_piece_provider as art_piece_provider
from ai_provider.art_piece_provider import (
    ArtPieceProvider,
    _looks_like_requested_showcase,
    _looks_like_snippet,
    extract_snippet,
)


class _CapturingChat:
    def __init__(self):
        self.last_kwargs: dict | None = None

    def complete(self, **kwargs):
        self.last_kwargs = kwargs
        return SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=1, completion_tokens=1),
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        content='<a-scene id="art-piece-scene" embedded></a-scene>'
                    )
                )
            ],
        )


class _CapturingClient:
    def __init__(self):
        self.chat = _CapturingChat()


def test_aframe_system_prompt_gives_concrete_camera_placement_guidance():
    """Regression for #236: the A-Frame system prompt only said to
    position the camera "to frame the scene" -- vague guidance Mistral
    didn't reliably follow (it placed the camera at a negative Z offset
    with no rotation, which A-Frame's default orientation convention
    means looks *away* from origin-centered content, not toward it,
    rendering nothing visible). The prompt must state the actual
    positive-Z convention explicitly, mirroring #204's "restate the
    constraint concretely" mitigation for vague AI guidance."""
    client = _CapturingClient()
    provider = ArtPieceProvider(client=client)

    provider.generate("a red circle", "aframe")

    system_message = next(m for m in client.chat.last_kwargs["messages"] if m["role"] == "system")
    content = system_message["content"]
    assert "positive" in content.lower()
    assert "-Z" in content or "negative Z" in content or "negative z" in content.lower()


def test_aframe_system_prompt_warns_flat_shapes_can_be_edge_on_to_the_camera():
    """Regression for #236's second live-production retest: fixing camera
    placement alone was not enough. Mistral consistently laid a plain "a
    red circle" flat as a floor (rotation="-90 0 0", face pointing +Y)
    while placing the camera on the positive-Z axis looking horizontally
    back toward the origin -- correct per the first fix, but the flat
    shape's visible face now points straight up, so it is edge-on (and
    thus effectively invisible) to that camera regardless of
    `material: side: double`. Reproduced twice in a row live against
    production before this prompt guidance was added."""
    client = _CapturingClient()
    provider = ArtPieceProvider(client=client)

    provider.generate("a red circle", "aframe")

    system_message = next(m for m in client.chat.last_kwargs["messages"] if m["role"] == "system")
    content = system_message["content"].lower()
    assert "edge-on" in content
    assert "floor" in content or "ground" in content


def test_threejs_system_prompt_tells_the_model_to_register_a_steerable_camera():
    """Issue #455: real hand-gesture steering needs a piece to opt into
    `window.__registerArtPieceCamera(...)` (the hook `artPieceSandbox.ts`'s
    trusted wrapper code already drives) -- A-Frame's own system prompt
    can never ask for this (it forbids all custom JavaScript), so this is
    Three.js-only. Without this instruction, a generated piece has no
    controllable camera and hand-steering has nothing to steer."""
    client = _CapturingClient()
    provider = ArtPieceProvider(client=client)

    provider.generate("a spinning cube", "threejs")

    system_message = next(m for m in client.chat.last_kwargs["messages"] if m["role"] == "system")
    content = system_message["content"]
    assert "__registerArtPieceCamera" in content
    assert "getPose" in content and "setPose" in content


def test_threejs_orbital_showcase_prompt_requires_hierarchy_and_shadows():
    client = _CapturingClient()
    provider = ArtPieceProvider(client=client)

    provider.generate(
        "sun planet moon hierarchical orbital system with shadows",
        "threejs",
    )

    system_message = next(m for m in client.chat.last_kwargs["messages"] if m["role"] == "system")
    content = system_message["content"].lower()
    assert "planet" in content and "moon" in content
    assert "shadow" in content


def test_threejs_orbital_showcase_rejects_generic_cube_fallback():
    source = """
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    var renderer = new THREE.WebGLRenderer();
    var cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    scene.add(cube);
    window.__registerArtPieceCamera({getPose: function () { return {}; }, setPose: function () {}});
    """
    assert not _looks_like_requested_showcase(
        source,
        "sun planet moon hierarchical orbital system with shadows",
        "threejs",
    )[0]


def test_threejs_ordinary_prompt_keeps_accepting_non_orbital_source():
    source = "const scene = new THREE.Scene(); const cube = new THREE.Mesh();"
    assert _looks_like_requested_showcase(source, "a rotating teal cube", "threejs")[0]


def test_aframe_light_switch_showcase_rejects_empty_static_fallback():
    source = '<a-scene><a-box id="lamp"></a-box></a-scene>'
    assert not _looks_like_requested_showcase(
        source,
        "light-switch custom component toggles two lamps",
        "aframe",
    )[0]


def test_aframe_light_switch_showcase_accepts_structural_component():
    source = """
    <a-scene>
      <a-entity id="lamp-one"></a-entity>
      <a-entity id="lamp-two"></a-entity>
      <script>
        AFRAME.registerComponent('light-switch', {
          init: function () {
            this.el.addEventListener('click', function () {
              this.setAttribute('light', 'intensity', 0.5);
            });
          }
        });
      </script>
    </a-scene>
    """
    assert _looks_like_requested_showcase(
        source, "click light-switch to toggle the lamp", "aframe"
    ) == (True, None)


def test_aframe_ordinary_prompt_keeps_accepting_static_source():
    source = '<a-scene><a-box color="#2a9d8f"></a-box></a-scene>'
    assert _looks_like_requested_showcase(source, "a teal box", "aframe")[0]


def test_aframe_light_switch_allows_required_inline_component_script():
    source = """
    <a-scene>
      <a-entity id="lamp-one"></a-entity>
      <a-entity id="lamp-two"></a-entity>
      <a-entity light-switch></a-entity>
      <script>
        AFRAME.registerComponent('light-switch', {
          init: function () { this.el.addEventListener('click', function () {}); }
        });
      </script>
    </a-scene>
    """
    assert _looks_like_snippet(
        source,
        "aframe",
        "lamp toggle custom component toggles two lamps",
    )[0]


def test_svg_inline_script_is_allowed_but_external_script_is_rejected():
    inline = '<svg id="art-piece-svg"><script>const value = 1;</script></svg>'
    external = '<svg id="art-piece-svg"><script src="https://example.test/app.js"></script></svg>'
    assert _looks_like_snippet(inline, "svg", "animated gauge")[0]
    assert not _looks_like_snippet(external, "svg", "animated gauge")[0]


def test_aframe_inline_script_is_prompt_wording_independent_but_external_is_rejected():
    inline = "<a-scene><script>AFRAME.registerComponent('lamp-toggle', {});</script></a-scene>"
    external = '<a-scene><script src="https://example.test/app.js"></script></a-scene>'
    assert _looks_like_snippet(inline, "aframe", "lamp toggle")[0]
    assert not _looks_like_snippet(
        external,
        "aframe",
        "lamp toggle custom component toggles two lamps",
    )[0]


def test_inline_script_flag_restores_previous_aframe_showcase_boundary(monkeypatch):
    source = "<a-scene><script>AFRAME.registerComponent('lamp-toggle', {});</script></a-scene>"
    monkeypatch.setattr(art_piece_provider, "ART_PIECE_ALLOW_INLINE_SCRIPT", False)

    assert not _looks_like_snippet(source, "aframe", "lamp toggle")[0]
    assert _looks_like_snippet(source, "aframe", "light-switch")[0]


@pytest.mark.parametrize(
    ("text", "library", "expected"),
    [
        ("```svg\n<svg id='one'></svg>\n```", "svg", "<svg id='one'></svg>"),
        (
            "Here is the result:\n```html\n<a-scene></a-scene>\n```\nDone.",
            "aframe",
            "<a-scene></a-scene>",
        ),
        ("Prose <svg id='bare'></svg> after", "svg", "<svg id='bare'></svg>"),
        (
            "```svg\n<svg id='first'></svg>\n```\n```svg\n<svg id='second'></svg>\n```",
            "svg",
            "<svg id='first'></svg>",
        ),
        ("<svg id='truncated'>", "svg", "<svg id='truncated'>"),
        ("", "svg", ""),
    ],
)
def test_extract_snippet_table(text, library, expected):
    assert extract_snippet(text, library) == expected


def test_extract_snippet_handles_script_based_libraries():
    assert extract_snippet("Result: <canvas></canvas><script>draw()</script>", "canvas2d") == (
        "<canvas></canvas><script>draw()</script>"
    )
    assert extract_snippet("Result: window.sketch = function () {};", "p5js") == (
        "window.sketch = function () {};"
    )


def test_extract_snippet_preserves_a_snippet_at_the_validated_size_cap():
    body = "x" * (150_000 - len("<svg></svg>"))
    snippet = f"Model response:\n<svg>{body}</svg>"

    extracted = extract_snippet(snippet, "svg")

    assert extracted == f"<svg>{body}</svg>"
    assert len(extracted) == 150_000


def test_extract_snippet_flag_off_matches_existing_fence_strip(monkeypatch):
    monkeypatch.setattr(art_piece_provider, "ART_PIECE_EXTRACT", False)
    text = "Prose ```svg\n<svg id='one'></svg>\n``` trailing"
    assert extract_snippet(text, "svg") == text.strip()


def test_p5_n_body_showcase_rejects_generic_single_circle_fallback():
    source = (
        "window.sketch = function (p) { p.setup = function () {}; "
        "p.draw = function () { p.circle(10, 10, 5); }; };"
    )
    assert not _looks_like_requested_showcase(
        source,
        "eight particles with gravity and elastic collision response",
        "p5js",
    )[0]


def test_p5_ordinary_prompt_keeps_accepting_simple_source():
    source = "window.sketch = function (p) { p.setup = function () {}; p.draw = function () {}; };"
    assert _looks_like_requested_showcase(source, "a teal circle", "p5js")[0]


def test_c2js_fractal_showcase_rejects_empty_static_canvas_fallback():
    source = "window.sketch = function (runtime) { runtime.startFrame(function () {}); };"
    assert not _looks_like_requested_showcase(
        source,
        "recursive fractal tree with eight levels",
        "c2js",
    )[0]


def test_c2js_ordinary_prompt_keeps_accepting_simple_source():
    source = (
        "window.sketch = function (runtime) { runtime.startFrame(function () { "
        "runtime.canvas.stroke(); }); };"
    )
    assert _looks_like_requested_showcase(source, "a teal procedural line", "c2js")[0]


def test_c2js_interactive_paint_showcase_rejects_static_canvas_fallback():
    source = "window.sketch = function (runtime) { runtime.startFrame(function () {}); };"
    assert not _looks_like_requested_showcase(
        source,
        "interactive multi-stroke paint tool with color controls and undo redo",
        "c2js-interactive",
    )[0]


def test_c2js_interactive_ordinary_prompt_keeps_accepting_simple_source():
    source = "window.sketch = function (runtime) { runtime.startFrame(function () {}); };"
    assert _looks_like_requested_showcase(source, "an interactive teal line", "c2js-interactive")[0]


def test_svg_gauge_showcase_rejects_blank_static_ring_fallback():
    source = '<svg viewBox="0 0 100 100"><circle r="40" /></svg>'
    assert not _looks_like_requested_showcase(
        source,
        "animated gauge or progress-ring with clipPath and gradient",
        "svg",
    )[0]


def test_svg_gauge_showcase_requires_animation_and_circumference_math():
    source = """
    <svg id="art-piece-svg" viewBox="0 0 100 100">
      <defs>
        <clipPath id="gauge-clip"><circle cx="50" cy="50" r="40" /></clipPath>
        <linearGradient id="gauge-gradient">
          <stop offset="0%" /><stop offset="100%" />
        </linearGradient>
      </defs>
      <circle r="40" fill="url(#gauge-gradient)" clip-path="url(#gauge-clip)"
        stroke-dasharray="2*pi*r" stroke-dashoffset="circumference * (1 - progress)">
        <animate attributeName="stroke-dashoffset" values="0;251.2" dur="2s"
          repeatCount="indefinite" />
      </circle>
      <script>
        const circle = document.querySelector('circle');
        const radius = Number(circle.getAttribute('r'));
        const circumference = 2 * Math.PI * radius;
        circle.setAttribute('stroke-dasharray', circumference);
      </script>
    </svg>
    """
    assert _looks_like_requested_showcase(
        source,
        "animated gauge or progress-ring with clipPath and gradient",
        "svg",
    ) == (True, None)


@pytest.mark.parametrize(
    ("source", "library", "prompt", "reason"),
    [
        ("", "svg", "anything", "empty_snippet"),
        ("<p>x</p>", "canvas2d", "anything", "missing_canvas_root"),
        ("<canvas></canvas>", "canvas2d", "anything", "missing_canvas_script"),
        ("<svg><script src='x'></script></svg>", "svg", "anything", "script_src_external"),
        ("const x = 1;", "threejs", "anything", "missing_threejs_marker"),
        (
            "<script>THREE.Scene = THREE.Scene;</script>",
            "threejs",
            "anything",
            "threejs_wrapped_markup",
        ),
        ("p.setup = function () {};", "p5js", "anything", "missing_p5_sketch"),
        ("window.sketch = function () {};", "p5js", "anything", "missing_p5_setup"),
        ("p.setup = function () {};", "c2js", "anything", "missing_c2_sketch"),
        ("window.sketch = function () {};", "c2js", "anything", "missing_start_frame"),
        ("<div></div>", "aframe", "anything", "missing_aframe_root"),
    ],
)
def test_structural_snippet_rejections_have_distinct_reason_codes(source, library, prompt, reason):
    assert _looks_like_snippet(source, library, prompt) == (False, reason)


def test_legacy_rubric_remains_selectable(monkeypatch):
    monkeypatch.setattr(art_piece_provider, "ART_PIECE_RUBRIC", "legacy")
    source = """
    <svg viewBox="0 0 100 100">
      <defs><clipPath id="clip"><circle r="40" /></clipPath>
      <linearGradient id="gradient"><stop offset="0%" /></linearGradient></defs>
      <circle clip-path="url(#clip)" fill="url(#gradient)"
        stroke-dasharray="2*pi*r" stroke-dashoffset="circumference">
        <animate attributeName="stroke-dashoffset" />
      </circle>
    </svg>
    """
    assert _looks_like_requested_showcase(
        source, "animated gauge or progress-ring with clipPath and gradient", "svg"
    ) == (True, None)


def test_generate_appends_persona_as_a_second_system_message():
    client = _CapturingClient()
    provider = ArtPieceProvider(client=client, persona_prompt="Use bright solar colors.")

    result = provider.generate("a solar halo", "aframe")

    assert result.code is not None
    system_messages = [m for m in client.chat.last_kwargs["messages"] if m["role"] == "system"]
    assert len(system_messages) == 2
    assert system_messages[1]["content"] == "Use bright solar colors."


def test_client_property_builds_a_real_client_from_the_real_sdk_import_path():
    """Exercises the actual `from mistralai.client import Mistral` import
    -- no mock, no injected client. This is the exact statement that used
    to be `from mistralai import Mistral` and raised `ImportError` against
    the installed SDK, which is what produced issue #203's fast unhandled
    500."""
    provider = ArtPieceProvider(api_key="sk-fake-test-value-not-real")

    client = provider.client

    from mistralai.client import Mistral as RealMistralClient

    assert isinstance(client, RealMistralClient)


def _real_mistral_error(status_code: int):
    from mistralai.client.errors import MistralError

    request = httpx.Request("POST", "https://api.mistral.ai/v1/chat/completions")
    response = httpx.Response(status_code=status_code, request=request, content=b'{"detail":"x"}')
    return MistralError("provider error", raw_response=response)


class _RaisingChat:
    def __init__(self, exc: Exception):
        self._exc = exc

    def complete(self, **kwargs):
        raise self._exc


class _ProviderClient:
    def __init__(self, exc: Exception):
        self.chat = _RaisingChat(exc)


class _ScriptedChat:
    def __init__(self, contents):
        self.contents = iter(contents)
        self.calls = []

    def complete(self, **kwargs):
        self.calls.append(kwargs)
        content = next(self.contents)
        return SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=2, completion_tokens=3),
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        )


class _ScriptedClient:
    def __init__(self, contents):
        self.chat = _ScriptedChat(contents)


_VALID_CANVAS = "<canvas></canvas><script>const ctx = 1;</script>"


def test_generate_repairs_invalid_output_and_sends_max_tokens(monkeypatch):
    client = _ScriptedClient(["<p>bad</p>", _VALID_CANVAS])
    provider = ArtPieceProvider(client=client)

    result = provider.generate("a calm field", "canvas2d")

    assert result.code == _VALID_CANVAS
    assert len(client.chat.calls) == 2
    assert all(
        call["max_tokens"] == art_piece_provider.ART_PIECE_MAX_TOKENS for call in client.chat.calls
    )
    assert "missing_canvas_root" in client.chat.calls[1]["messages"][-1]["content"]
    assert result.warnings == [
        "attempt=1 reason=missing_canvas_root model=mistral-small-latest",
        "missing_layer_markers",
    ]


def test_generate_exhausts_repairs_with_reason_evidence_and_escalates(monkeypatch):
    client = _ScriptedClient(["<p>bad</p>", "<p>still bad</p>", "<p>last bad</p>"])
    monkeypatch.setenv("ART_PIECE_ESCALATION_MODEL", "mistral-large-latest")
    provider = ArtPieceProvider(client=client)

    result = provider.generate("a calm field", "canvas2d")

    assert result.code is None
    assert result.error == "empty_or_malformed:missing_canvas_root"
    assert len(client.chat.calls) == 3
    assert [call["model"] for call in client.chat.calls] == [
        "mistral-small-latest",
        "mistral-small-latest",
        "mistral-large-latest",
    ]
    assert result.warnings == [
        "attempt=1 reason=missing_canvas_root model=mistral-small-latest",
        "attempt=2 reason=missing_canvas_root model=mistral-small-latest",
        "attempt=3 reason=missing_canvas_root model=mistral-large-latest",
    ]


def test_generate_zero_repairs_restores_single_call(monkeypatch):
    client = _ScriptedClient(["<p>bad</p>", _VALID_CANVAS])
    monkeypatch.setenv("ART_PIECE_MAX_REPAIRS", "0")
    provider = ArtPieceProvider(client=client)

    result = provider.generate("a calm field", "canvas2d")

    assert result.error == "empty_or_malformed:missing_canvas_root"
    assert len(client.chat.calls) == 1


@pytest.mark.parametrize(
    ("status_code", "expected_message_fragment"),
    [
        (429, "rate limit or quota"),
        (504, "request timeout"),
        (500, "request failed"),
    ],
)
def test_generate_classifies_a_real_mistralerror_without_reraising(
    status_code, expected_message_fragment
):
    """Uses the real SDK's `MistralError` class (not a string/mock), so
    this fails the same way issue #203 did if the `isinstance(exc,
    MistralError)` check ever stops matching what the real SDK raises."""
    provider = ArtPieceProvider(client=_ProviderClient(_real_mistral_error(status_code)))

    result = provider.generate("a red circle", "canvas2d")

    assert result.code is None
    assert expected_message_fragment in result.error
