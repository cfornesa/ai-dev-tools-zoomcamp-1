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

import httpx
import pytest

from ai_provider.art_piece_provider import ArtPieceProvider


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
