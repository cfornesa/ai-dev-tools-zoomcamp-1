import copy
import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from scenes.models import ArtPiece, ArtPieceVersion, Project, PublicProfile, SceneVersion

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures"
        / "valid"
        / "blank.json"
    ).read_text()
)


@pytest.mark.django_db
def test_public_gallery_search_scopes_accounts_and_rejects_malformed_queries(client):
    user = get_user_model().objects.create_user(username="artist")
    PublicProfile.objects.create(
        user=user, handle="artist", display_name="The Artist", is_public=True
    )
    hidden = get_user_model().objects.create_user(username="hidden")
    PublicProfile.objects.create(user=hidden, handle="hidden", is_public=False)

    response = client.get(reverse("public-gallery-search"), {"q": "artist", "scope": "accounts"})
    assert response.status_code == 200
    assert [item["handle"] for item in response.json()["results"]] == ["artist"]

    malformed = client.get(reverse("public-gallery-search"), {"q": "x", "scope": "invalid"})
    assert malformed.status_code == 400


@pytest.mark.django_db
def test_public_gallery_content_search_matches_title_and_excludes_private(client):
    owner = get_user_model().objects.create_user(username="content-owner")
    PublicProfile.objects.create(user=owner, handle="content-owner", is_public=True)

    published = Project.objects.create(
        owner=owner, title="Sunset Study", description="A calm evening piece"
    )
    version = SceneVersion.objects.create(
        project=published,
        sequence=1,
        scene_json=copy.deepcopy(BLANK_SCENE),
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    published.current_version = version
    published.visibility = Project.Visibility.PUBLIC
    published.published_at = timezone.now()
    published.save(update_fields=["current_version", "visibility", "published_at"])

    private = Project.objects.create(owner=owner, title="Sunset Draft", description="")

    response = client.get(reverse("public-gallery-search"), {"q": "sunset", "scope": "content"})
    assert response.status_code == 200
    titles = [item["title"] for item in response.json()["results"]]
    assert titles == ["Sunset Study"]
    assert private.title not in titles


@pytest.mark.django_db
def test_public_gallery_content_search_matches_generated_pieces(client):
    owner = get_user_model().objects.create_user(username="piece-owner")
    PublicProfile.objects.create(user=owner, handle="piece-owner", is_public=True)
    piece = ArtPiece.objects.create(
        owner=owner,
        title="Aurora Field",
        description="Northern lights simulation",
        prompt="a test prompt",
        engine=ArtPiece.Engine.SVG,
        status=ArtPiece.Status.PUBLISHED,
        published_at=timezone.now(),
    )
    version = ArtPieceVersion.objects.create(piece=piece, sequence=1, source="<svg />")
    piece.current_version = version
    piece.save(update_fields=["current_version"])

    response = client.get(reverse("public-gallery-search"), {"q": "aurora", "scope": "content"})
    assert response.status_code == 200
    assert [item["title"] for item in response.json()["results"]] == ["Aurora Field"]


@pytest.mark.django_db
def test_public_gallery_search_empty_query_returns_no_results(client):
    response = client.get(reverse("public-gallery-search"), {"q": "", "scope": "content"})
    assert response.status_code == 200
    assert response.json()["results"] == []
