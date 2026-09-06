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

from ai_provider.art_piece_provider import ArtPieceProvider


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
