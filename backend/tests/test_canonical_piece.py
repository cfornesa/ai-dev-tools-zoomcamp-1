import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from scenes.models import (
    ArtPiece,
    ArtPieceVersion,
    Project,
    Project3D,
    PublicProfile,
    SceneVersion,
    SceneVersion3D,
)


def _published_piece(user, title):
    piece = ArtPiece.objects.create(
        owner=user,
        title=title,
        prompt="A test prompt",
        engine=ArtPiece.Engine.SVG,
        status=ArtPiece.Status.PUBLISHED,
    )
    version = ArtPieceVersion.objects.create(piece=piece, sequence=1, source="<svg />")
    piece.current_version = version
    piece.save(update_fields=["current_version"])
    return piece


@pytest.mark.django_db
def test_canonical_piece_resolves_public_piece_and_suffixes_collisions(client):
    user = get_user_model().objects.create_user(username="artist")
    PublicProfile.objects.create(user=user, handle="artist", is_public=True)
    first = _published_piece(user, "Sunset Study")
    second = _published_piece(user, "Sunset Study")

    url = reverse(
        "public-piece-by-slug", kwargs={"handle": "artist", "piece_slug": first.public_slug}
    )
    response = client.get(url)
    assert response.status_code == 200
    assert response.json()["canonical_url"].endswith("/sunset-study")
    assert response.json()["type"] == "generated"
    assert response.json()["piece"]["public_slug"] == "sunset-study"
    assert second.public_slug == "sunset-study-2"


@pytest.mark.django_db
def test_profile_and_gallery_cards_use_the_generated_piece_canonical_url(client):
    user = get_user_model().objects.create_user(username="profile-artist")
    PublicProfile.objects.create(user=user, handle="profile-artist", is_public=True)
    piece = _published_piece(user, "Profile Study")

    profile = client.get("/api/users/@profile-artist/")
    assert profile.status_code == 200
    card = next(item for item in profile.json()["pieces"] if item["id"] == str(piece.public_id))
    assert card["regular_url"] == "/users/@profile-artist/pieces/profile-study"

    gallery = client.get("/api/public/gallery/")
    assert gallery.status_code == 200
    gallery_card = next(
        item for item in gallery.json()["results"] if item["id"] == str(piece.public_id)
    )
    assert gallery_card["viewer_url"] == "/users/@profile-artist/pieces/profile-study"


@pytest.mark.django_db
def test_profile_cards_expose_canonical_urls_for_authored_piece_families(client):
    user = get_user_model().objects.create_user(username="profile-authored")
    PublicProfile.objects.create(user=user, handle="profile-authored", is_public=True)
    project = Project.objects.create(owner=user, title="Canvas study", public_slug="canvas-study")
    project.current_version = SceneVersion.objects.create(
        project=project, sequence=1, scene_json={}, created_by=user
    )
    project.visibility = Project.Visibility.PUBLIC
    project.published_at = timezone.now()
    project.save(update_fields=["current_version", "visibility", "published_at"])
    project3d = Project3D.objects.create(
        owner=user, title="Spatial study", public_slug="spatial-study"
    )
    project3d.current_version = SceneVersion3D.objects.create(
        project=project3d,
        sequence=1,
        scene_json={
            "schemaVersion": 1,
            "documentType": "scene3d",
            "id": "profile-spatial-study",
            "scene": {"backgroundColor": "#808080"},
            "camera": {
                "position": {"x": 0, "y": 5, "z": 10},
                "target": {"x": 0, "y": 0, "z": 0},
                "fov": 50,
                "near": 0.1,
                "far": 1000,
            },
            "lights": [],
            "groups": [],
            "objects": [],
            "randomness": {"seed": 0, "enabled": False},
        },
        created_by=user,
    )
    project3d.visibility = Project3D.Visibility.PUBLIC
    project3d.published_at = timezone.now()
    project3d.save(update_fields=["current_version", "visibility", "published_at"])

    response = client.get("/api/users/@profile-authored/")
    assert response.status_code == 200
    cards = {item["title"]: item for item in response.json()["pieces"]}
    assert cards["Canvas study"]["regular_url"] == "/users/@profile-authored/pieces/canvas-study"
    assert cards["Spatial study"]["regular_url"] == "/users/@profile-authored/pieces/spatial-study"


@pytest.mark.django_db
def test_canonical_piece_does_not_expose_private_or_unknown_piece(client):
    user = get_user_model().objects.create_user(username="private-artist")
    PublicProfile.objects.create(user=user, handle="private-artist", is_public=True)
    piece = ArtPiece.objects.create(
        owner=user,
        title="Private Study",
        prompt="A test prompt",
        engine=ArtPiece.Engine.SVG,
    )
    response = client.get(
        reverse(
            "public-piece-by-slug",
            kwargs={"handle": "private-artist", "piece_slug": piece.public_slug},
        )
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_canonical_piece_404s_for_unknown_handle(client):
    response = client.get(
        reverse(
            "public-piece-by-slug",
            kwargs={"handle": "nobody-with-this-handle", "piece_slug": "anything"},
        )
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_canonical_piece_404s_for_a_published_piece_on_a_private_profile(client):
    user = get_user_model().objects.create_user(username="hidden-artist")
    PublicProfile.objects.create(user=user, handle="hidden-artist", is_public=False)
    piece = _published_piece(user, "Hidden Study")

    response = client.get(
        reverse(
            "public-piece-by-slug",
            kwargs={"handle": "hidden-artist", "piece_slug": piece.public_slug},
        )
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_owner_editor_slug_resolver_is_owner_only(client):
    user = get_user_model().objects.create_user(username="editor-artist")
    other = get_user_model().objects.create_user(username="other-artist")
    PublicProfile.objects.create(user=user, handle="editor-artist", is_public=False)
    piece = _published_piece(user, "Editor Study")
    url = reverse(
        "owner-art-piece-by-slug",
        kwargs={"handle": "editor-artist", "piece_slug": piece.public_slug},
    )

    assert client.get(url).status_code == 404
    client.force_login(other)
    assert client.get(url).status_code == 404
    client.force_login(user)
    response = client.get(url)
    assert response.status_code == 200
    assert response.json()["canonical_url"] == "/users/@editor-artist/edit/editor-study"
    assert response.json()["piece"]["owner_id"] == user.id
