"""Acceptance coverage for issue #658's bounded art-piece refine route."""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

import scenes.art_piece_api as art_piece_api
from ai_provider.art_piece_provider import ArtPieceRefineResult
from ai_provider.interface import AIUsageMetadata
from scenes import art_piece_refine
from scenes.models import AIRetryPreference, ArtPiece, ArtPieceVersion

SOURCE = '<canvas id="art-piece-canvas"></canvas>\n<script>const color = "red";</script>'
USAGE = AIUsageMetadata(prompt_tokens=3, completion_tokens=5, estimated_cost_usd=0.01)


class _Provider:
    def __init__(self, results):
        self.results = list(results)
        self.calls = 0

    def refine(self, instruction, source, library, target_references):
        self.calls += 1
        return self.results.pop(0)


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="refine-owner")


@pytest.fixture
def piece(owner):
    art_piece = ArtPiece.objects.create(
        owner=owner,
        prompt="a red canvas",
        engine=ArtPiece.Engine.CANVAS2D,
        title="Red",
        description="A red piece",
    )
    version = ArtPieceVersion.objects.create(piece=art_piece, sequence=1, source=SOURCE)
    art_piece.current_version = version
    art_piece.save(update_fields=["current_version"])
    return art_piece


def _result(search, replace):
    return ArtPieceRefineResult(usage=USAGE, edits=[{"search": search, "replace": replace}])


@pytest.mark.django_db
def test_refine_applies_all_edits_and_creates_immutable_current_version(monkeypatch, owner, piece):
    provider = _Provider([_result('color = "red"', 'color = "blue"')])
    monkeypatch.setattr(art_piece_refine, "_provider_for_user", lambda *args: provider)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "make it blue", "target_references": ["canvas"]},
        format="json",
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "accepted"
    assert body["attempts"] == 1
    piece.refresh_from_db()
    assert piece.current_version.sequence == 2
    assert 'color = "blue"' in piece.current_version.source
    assert piece.versions.count() == 2
    assert provider.calls == 1


@pytest.mark.django_db
def test_unmatched_edit_is_all_or_none_and_disabled_retry_stops_once(monkeypatch, owner, piece):
    provider = _Provider([_result("not in source", "replacement")])
    monkeypatch.setattr(art_piece_refine, "_provider_for_user", lambda *args: provider)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "make it impossible"},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["status"] == "failed"
    assert response.json()["attempts"] == 1
    piece.refresh_from_db()
    assert piece.current_version.sequence == 1
    assert piece.current_version.source == SOURCE
    assert provider.calls == 1


@pytest.mark.django_db
def test_refine_retries_with_real_source_and_preference_budget(monkeypatch, owner, piece):
    provider = _Provider(
        [
            _result("missing", "replacement"),
            _result("color = \"red\"", "color = \"green\""),
        ]
    )
    monkeypatch.setattr(art_piece_refine, "_provider_for_user", lambda *args: provider)
    AIRetryPreference.objects.create(owner=owner, auto_retry_enabled=True, max_retries=1)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "make it green"},
        format="json",
    )

    assert response.json()["status"] == "accepted"
    assert response.json()["attempts"] == 2
    assert response.json()["repairs"] == 1
    assert provider.calls == 2
    assert piece.versions.count() == 2


@pytest.mark.django_db
def test_refine_is_owner_only(monkeypatch, piece):
    other = get_user_model().objects.create_user(username="other-refine-owner")
    client = APIClient()
    client.force_authenticate(other)
    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "make it blue"},
        format="json",
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_fake_provider_reports_a_failed_refinement_when_its_fixture_token_is_absent(
    monkeypatch, owner, piece
):
    monkeypatch.setattr(art_piece_api, "use_fake_ai_provider", lambda: True)
    client = APIClient()
    client.force_authenticate(owner)

    response = client.post(
        f"/api/art-pieces/{piece.public_id}/refine/",
        {"instruction": "make the accent warmer"},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["status"] == "failed"
    assert response.json()["attempts"] == 1
    piece.refresh_from_db()
    assert piece.current_version.sequence == 1
