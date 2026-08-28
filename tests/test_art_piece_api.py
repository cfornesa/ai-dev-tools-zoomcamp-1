"""Tests for POST /api/ai/art-pieces/generate/ (issue #199, the Canvas2D
first-slice implementation of the multi-library AI art generation epic).

Mirrors `test_ai_create_scene_api.py`'s mocking boundary: every test
monkeypatches `scenes.art_piece_api.get_art_piece_provider` to a fake or a
`ArtPieceProvider(client=<fake>)`, so none of them open a socket or
require a real `MISTRAL_API_KEY`. This endpoint is deliberately not
project-scoped (see `scenes/art_piece_api.py`'s module docstring), so
these tests need no `Project` fixture at all.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

import scenes.art_piece_api as art_piece_api
from ai_provider.art_piece_provider import ArtPieceProvider
from scenes.models import MistralCredential

URL = "/api/ai/art-pieces/generate/"


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="alice")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


def _use_provider(monkeypatch, provider):
    monkeypatch.setattr(art_piece_api, "get_art_piece_provider", lambda: provider)


class _FakeChat:
    def __init__(self, handler):
        self._handler = handler

    def complete(self, **kwargs):
        return self._handler(**kwargs)


class _FakeClient:
    def __init__(self, handler):
        self.chat = _FakeChat(handler)


def _mistral_provider_returning(content: str) -> ArtPieceProvider:
    def handler(**kwargs):
        return SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=10, completion_tokens=20),
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        )

    return ArtPieceProvider(client=_FakeClient(handler))


_VALID_SNIPPET = (
    '<canvas id="art-piece-canvas"></canvas>'
    "<script>const c=document.getElementById('art-piece-canvas');"
    "const ctx=c.getContext('2d');ctx.fillRect(0,0,10,10);</script>"
)


@pytest.mark.django_db
def test_success_returns_the_generated_snippet_and_usage(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(_VALID_SNIPPET))

    response = owner_client.post(
        URL, {"library": "canvas2d", "prompt": "a calm field of teal circles"}, format="json"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["library"] == "canvas2d"
    assert body["code"] == _VALID_SNIPPET
    assert set(body["usage"]) == {
        "prompt_tokens",
        "completion_tokens",
        "total_tokens",
        "estimated_cost_usd",
    }


@pytest.mark.django_db
def test_response_stripped_of_a_stray_markdown_fence(owner_client, monkeypatch):
    fenced = f"```html\n{_VALID_SNIPPET}\n```"
    _use_provider(monkeypatch, _mistral_provider_returning(fenced))

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "anything"}, format="json")

    assert response.status_code == 200
    assert response.json()["code"] == _VALID_SNIPPET


@pytest.mark.django_db
def test_output_missing_canvas_or_script_is_rejected_with_422(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning("<p>not a canvas piece</p>"))

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "anything"}, format="json")

    assert response.status_code == 422
    assert response.json()["error"] == "invalid_structured_output"


@pytest.mark.django_db
def test_empty_output_is_rejected_with_422(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning("   "))

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "anything"}, format="json")

    assert response.status_code == 422


@pytest.mark.django_db
def test_oversized_raw_response_is_rejected_with_413(owner_client, monkeypatch):
    from ai_provider.art_piece_provider import MAX_RAW_RESPONSE_BYTES

    huge = "x" * (MAX_RAW_RESPONSE_BYTES + 1)
    _use_provider(monkeypatch, _mistral_provider_returning(huge))

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "anything"}, format="json")

    assert response.status_code == 413
    assert response.json()["error"] == "response_too_large"


@pytest.mark.django_db
def test_unsupported_library_is_rejected_with_400(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(_VALID_SNIPPET))

    response = owner_client.post(URL, {"library": "threejs", "prompt": "anything"}, format="json")

    assert response.status_code == 400


@pytest.mark.django_db
def test_blank_prompt_is_rejected_with_400(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(_VALID_SNIPPET))

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": ""}, format="json")

    assert response.status_code == 400
    assert response.json()["error"] == "prompt_invalid"


@pytest.mark.django_db
def test_malformed_model_id_is_rejected_with_400_and_model_invalid(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(_VALID_SNIPPET))

    response = owner_client.post(
        URL,
        {"library": "canvas2d", "prompt": "anything", "model": "Not A Valid Model!"},
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["error"] == "model_invalid"


@pytest.mark.django_db
def test_fake_provider_seam_needs_no_personal_key(owner_client, monkeypatch):
    """`AI_PROVIDER=fake` (`ai_provider/config.py`) short-circuits
    `get_art_piece_provider` before any credential lookup, mirroring
    `scenes.ai_api.get_ai_provider`'s identical seam -- an owner with no
    `MistralCredential` at all still gets a deterministic success."""
    monkeypatch.setattr(art_piece_api, "use_fake_ai_provider", lambda: True)

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "x"}, format="json")

    assert response.status_code == 200
    assert "<canvas" in response.json()["code"]


@pytest.mark.django_db
def test_anonymous_request_is_rejected_with_401():
    client = APIClient()
    response = client.post(URL, {"library": "canvas2d", "prompt": "anything"}, format="json")

    assert response.status_code == 401


@pytest.mark.django_db
def test_own_request_rate_limit_returns_429(owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(_VALID_SNIPPET))

    for _ in range(art_piece_api.RATE_LIMIT_MAX_ATTEMPTS):
        owner_client.post(URL, {"library": "canvas2d", "prompt": "x"}, format="json")

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "x"}, format="json")

    assert response.status_code == 429
    assert response.json()["error"] == "rate_limited"


@pytest.mark.django_db
def test_own_daily_quota_returns_429(owner, owner_client, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(_VALID_SNIPPET))
    cache.set(
        art_piece_api._quota_cache_key(owner.id),
        art_piece_api.DAILY_QUOTA_MAX_SUCCESSES,
        timeout=60,
    )

    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "x"}, format="json")

    assert response.status_code == 429
    assert response.json()["error"] == "quota_exceeded"


@pytest.mark.django_db
def test_missing_personal_key_returns_424(owner_client):
    # No monkeypatch: exercises the real `get_art_piece_provider`, which
    # requires a personal `MistralCredential` -- none exists for `owner`.
    response = owner_client.post(URL, {"library": "canvas2d", "prompt": "x"}, format="json")

    assert response.status_code == 424
    assert response.json()["error"] == "personal_key_required"


@pytest.mark.django_db
def test_owner_key_and_model_reach_the_real_provider(owner, monkeypatch):
    """Mirrors `test_mistral_credentials.py`'s `test_owner_key_is_selected_
    for_real_provider`/`test_caller_supplied_model_reaches_the_real_provider`
    -- calls `_provider_for_user` directly rather than through the HTTP
    view, since this only needs to verify what `ArtPieceProvider` is
    constructed with, not exercise the full request/response cycle."""
    credential = MistralCredential(user=owner)
    credential.set_key("sk-owner-only-key-12345")
    credential.save()
    captured = {}

    class CapturingProvider:
        def __init__(self, *, api_key, model=None):
            captured["api_key"] = api_key
            captured["model"] = model

    monkeypatch.setattr(art_piece_api, "ArtPieceProvider", CapturingProvider)

    art_piece_api._provider_for_user(owner, "codestral-2405")

    assert captured == {"api_key": "sk-owner-only-key-12345", "model": "codestral-2405"}
