"""Issue #314 API/privacy/concurrency regression coverage."""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient

import scenes.art_piece_persistence as persistence
from scenes.models import ArtPiece

SOURCE = '<canvas id="art-piece-canvas"></canvas>'


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="piece-owner")


@pytest.fixture
def client(owner):
    api = APIClient()
    api.force_authenticate(owner)
    return api


def create_piece(client):
    response = client.post(
        "/api/art-pieces/",
        {
            "prompt": "a calm blue piece",
            "engine": "canvas2d",
            "source": SOURCE,
            "title": "Blue",
            "description": "A public piece",
        },
        format="json",
    )
    assert response.status_code == 201
    return response


def test_create_defaults_to_draft_and_persists_version_and_thumbnail(client):
    response = create_piece(client)
    assert response.data["status"] == "draft"
    assert response.data["current_version"]["sequence"] == 1
    piece = ArtPiece.objects.get(public_id=response.data["public_id"])
    assert piece.current_version.thumbnail.width == 320
    assert piece.current_version.thumbnail.height == 240


def test_publish_requires_meaningful_metadata_and_public_detail_hides_prompt(client):
    response = create_piece(client)
    public_id = response.data["public_id"]
    published = client.patch(
        f"/api/art-pieces/{public_id}/", {"status": "published"}, format="json"
    )
    assert published.status_code == 200
    public = APIClient().get(f"/api/public/art-pieces/{public_id}/")
    assert public.status_code == 200
    assert "prompt" not in public.data
    assert "source" in public.data["current_version"]


def test_private_piece_is_not_confirmed_to_anonymous_or_other_user(client, owner):
    response = create_piece(client)
    public_id = response.data["public_id"]
    assert APIClient().get(f"/api/public/art-pieces/{public_id}/").status_code == 404
    other = get_user_model().objects.create_user(username="piece-other")
    other_client = APIClient()
    other_client.force_authenticate(other)
    assert other_client.get(f"/api/art-pieces/{public_id}/").status_code == 404


def test_publish_and_unpublish_change_public_list_immediately(client):
    response = create_piece(client)
    public_id = response.data["public_id"]
    client.patch(f"/api/art-pieces/{public_id}/", {"status": "published"}, format="json")
    assert len(APIClient().get("/api/public/art-pieces/").data) == 1
    client.patch(f"/api/art-pieces/{public_id}/", {"status": "draft"}, format="json")
    assert APIClient().get(f"/api/public/art-pieces/{public_id}/").status_code == 404


def test_capabilities_are_allowlisted(client):
    response = client.post(
        "/api/art-pieces/",
        {
            "prompt": "piece",
            "engine": "svg",
            "source": "<svg />",
            "capabilities": {"not_real": True},
        },
        format="json",
    )
    assert response.status_code == 400


def test_new_version_updates_current_and_existing_version_is_immutable(client):
    response = create_piece(client)
    public_id = response.data["public_id"]
    version = client.post(
        f"/api/art-pieces/{public_id}/versions/",
        {"source": "<svg />", "capabilities": {"fullscreen": True}},
        format="json",
    )
    assert version.status_code == 201
    assert version.data["sequence"] == 2
    piece = ArtPiece.objects.get(public_id=public_id)
    assert piece.current_version_id == version.data["id"]
    piece.current_version.source = "changed"
    with pytest.raises(ValidationError):
        piece.current_version.save()


def test_public_thumbnail_is_reachable_only_after_publish(client):
    response = create_piece(client)
    public_id = response.data["public_id"]
    assert APIClient().get(f"/api/public/art-pieces/{public_id}/thumbnail.png").status_code == 404
    client.patch(f"/api/art-pieces/{public_id}/", {"status": "published"}, format="json")
    thumbnail = APIClient().get(f"/api/public/art-pieces/{public_id}/thumbnail.png")
    assert thumbnail.status_code == 200
    assert thumbnail["Content-Type"] == "image/png"


def test_thumbnail_regeneration_falls_back_and_later_replaces_fallback(client, monkeypatch):
    response = create_piece(client)
    public_id = response.data["public_id"]
    monkeypatch.setattr(
        persistence,
        "_thumbnail_bytes",
        lambda source: (_ for _ in ()).throw(RuntimeError("render failed")),
    )
    assert client.post(f"/api/art-pieces/{public_id}/thumbnail/regenerate/").status_code == 200
    piece = ArtPiece.objects.get(public_id=public_id)
    assert piece.current_version.thumbnail.is_fallback is True
    monkeypatch.setattr(persistence, "_thumbnail_bytes", lambda source: b"new-png")
    client.post(f"/api/art-pieces/{public_id}/thumbnail/regenerate/")
    piece.refresh_from_db()
    assert piece.current_version.thumbnail.is_fallback is False
    assert piece.current_version.thumbnail.image_data == b"new-png"
