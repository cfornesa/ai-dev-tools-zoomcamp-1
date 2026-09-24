import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError
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
    assert response.json()["viewer_url"] == "/users/@artist/pieces/sunset-study"
    assert second.public_slug == "sunset-study-2"


@pytest.mark.django_db
def test_canonical_and_legacy_generated_routes_resolve_the_same_public_piece(client):
    user = get_user_model().objects.create_user(username="legacy-artist")
    PublicProfile.objects.create(user=user, handle="legacy-artist", is_public=True)
    piece = _published_piece(user, "Legacy Study")

    canonical = client.get(
        reverse(
            "public-piece-by-slug",
            kwargs={"handle": "legacy-artist", "piece_slug": piece.public_slug},
        )
    )
    legacy = client.get(f"/api/public/art-pieces/{piece.public_id}/")

    assert canonical.status_code == 200
    assert legacy.status_code == 200
    assert canonical.json()["piece"]["public_id"] == legacy.json()["public_id"]
    assert canonical.json()["piece"]["public_slug"] == piece.public_slug
    assert canonical.json()["viewer_url"] == "/users/@legacy-artist/pieces/legacy-study"


@pytest.mark.django_db
def test_canonical_generated_piece_exposes_edit_url_only_to_owner(client):
    user = get_user_model().objects.create_user(username="canonical-owner")
    PublicProfile.objects.create(user=user, handle="canonical-owner", is_public=True)
    piece = _published_piece(user, "Owner Study")
    url = reverse(
        "public-piece-by-slug",
        kwargs={"handle": "canonical-owner", "piece_slug": piece.public_slug},
    )

    anonymous = client.get(url)
    assert anonymous.status_code == 200
    assert "edit_url" not in anonymous.json()

    client.force_login(user)
    owner = client.get(url)
    assert owner.status_code == 200
    assert owner.json()["edit_url"] == "/users/@canonical-owner/edit/owner-study"


@pytest.mark.django_db
def test_canonical_generated_piece_exposes_safe_public_version_summaries(client):
    user = get_user_model().objects.create_user(username="version-artist")
    PublicProfile.objects.create(user=user, handle="version-artist", is_public=True)
    piece = _published_piece(user, "Version Study")
    piece.prompt = "A long public prompt"
    piece.save(update_fields=["prompt"])
    piece.versions.create(
        sequence=2,
        source="private source that must not be serialized",
        capabilities={"microphone": True},
        generation_metadata={"model_label": "Mistral Small", "private": "omit"},
    )

    response = client.get(
        reverse(
            "public-piece-by-slug",
            kwargs={"handle": "version-artist", "piece_slug": piece.public_slug},
        )
    )

    assert response.status_code == 200
    versions = response.json()["piece"]["versions"]
    assert [version["sequence"] for version in versions] == [2, 1]
    assert versions[0]["engine"] == "svg"
    assert versions[0]["status"] == "published"
    assert versions[0]["prompt"] == "A long public prompt"
    assert versions[0]["model_label"] == "Mistral Small"
    assert set(versions[0]) == {
        "sequence",
        "engine",
        "status",
        "prompt",
        "created_at",
        "model_label",
    }
    assert "source" not in versions[0]
    assert "capabilities" not in versions[0]
    assert "generation_metadata" not in versions[0]


@pytest.mark.django_db
def test_profile_and_gallery_cards_use_the_generated_piece_canonical_url(client):
    user = get_user_model().objects.create_user(username="profile-artist")
    PublicProfile.objects.create(
        user=user, handle="current-profile-handle", display_name="Profile Display", is_public=True
    )
    piece = _published_piece(user, "Profile Study")

    profile = client.get("/api/users/@current-profile-handle/")
    assert profile.status_code == 200
    card = next(item for item in profile.json()["pieces"] if item["id"] == str(piece.public_id))
    assert card["regular_url"] == "/users/@current-profile-handle/pieces/profile-study"
    assert card["owner"] == "Profile Display"

    gallery = client.get("/api/public/gallery/")
    assert gallery.status_code == 200
    gallery_card = next(
        item for item in gallery.json()["results"] if item["id"] == str(piece.public_id)
    )
    assert gallery_card["viewer_url"] == "/users/@current-profile-handle/pieces/profile-study"
    assert gallery_card["owner"] == "Profile Display"


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

    canonical = client.get(
        reverse(
            "public-piece-by-slug",
            kwargs={"handle": "profile-authored", "piece_slug": "spatial-study"},
        )
    )
    assert canonical.status_code == 200
    assert canonical.json()["canonical_url"] == "/users/@profile-authored/pieces/spatial-study"
    assert canonical.json()["type"] == "3d"
    assert canonical.json()["viewer_url"] == "/users/@profile-authored/pieces/spatial-study"
    assert canonical.json()["piece"]["id"] == str(project3d.public_id)


@pytest.mark.django_db
def test_canonical_2d_piece_exposes_safe_newest_first_version_summaries(client):
    user = get_user_model().objects.create_user(username="2d-version-artist")
    PublicProfile.objects.create(user=user, handle="2d-version-artist", is_public=True)
    project = Project.objects.create(
        owner=user,
        title="Versioned Canvas",
        description="A public 2D study.",
        public_slug="versioned-canvas",
        visibility=Project.Visibility.PUBLIC,
        published_at=timezone.now(),
    )
    SceneVersion.objects.create(project=project, sequence=1, scene_json={})
    second = SceneVersion.objects.create(project=project, sequence=2, scene_json={})
    project.current_version = second
    project.save(update_fields=["current_version"])

    response = client.get(
        reverse(
            "public-piece-by-slug",
            kwargs={"handle": "2d-version-artist", "piece_slug": "versioned-canvas"},
        )
    )

    assert response.status_code == 200
    payload = response.json()["piece"]
    assert payload["description"] == "A public 2D study."
    assert payload["version_count"] == 2
    assert [version["sequence"] for version in payload["versions"]] == [2, 1]
    assert payload["versions"][0]["is_current"] is True
    assert payload["versions"][1]["is_current"] is False
    assert set(payload["versions"][0]) == {"sequence", "created_at", "is_current"}
    assert "scene_json" not in payload["versions"][0]


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
def test_canonical_piece_404s_for_an_unpublished_generated_piece(client):
    user = get_user_model().objects.create_user(username="unpublished-artist")
    PublicProfile.objects.create(user=user, handle="unpublished-artist", is_public=True)
    piece = ArtPiece.objects.create(
        owner=user,
        title="Unpublished Study",
        prompt="A private prompt",
        engine=ArtPiece.Engine.SVG,
        status=ArtPiece.Status.DRAFT,
    )
    version = ArtPieceVersion.objects.create(piece=piece, sequence=1, source="<svg />")
    piece.current_version = version
    piece.save(update_fields=["current_version"])

    response = client.get(
        reverse(
            "public-piece-by-slug",
            kwargs={"handle": "unpublished-artist", "piece_slug": piece.public_slug},
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
def test_owner_can_resolve_private_generated_piece_on_private_profile(client):
    user = get_user_model().objects.create_user(username="private-owner", password="x")
    other = get_user_model().objects.create_user(username="private-other", password="x")
    PublicProfile.objects.create(user=user, handle="private-owner", is_public=False)
    pieces = []
    for slug, engine in (
        ("private-flat", ArtPiece.Engine.SVG),
        ("private-spatial", ArtPiece.Engine.THREEJS),
    ):
        piece = ArtPiece.objects.create(
            owner=user,
            title=slug,
            prompt="Private prompt",
            engine=engine,
            public_slug=slug,
            status=ArtPiece.Status.DRAFT,
        )
        version = ArtPieceVersion.objects.create(piece=piece, sequence=1, source="<svg />")
        piece.current_version = version
        piece.save(update_fields=["current_version"])
        pieces.append(piece)

    for piece in pieces:
        url = reverse(
            "public-piece-by-slug",
            kwargs={"handle": "private-owner", "piece_slug": piece.public_slug},
        )
        client.logout()
        assert client.get(url).status_code == 404
        client.force_login(other)
        assert client.get(url).status_code == 404
        client.force_login(user)
        response = client.get(url)
        assert response.status_code == 200
        assert response.json()["piece"]["public_id"] == str(piece.public_id)
        assert response.json()["piece"]["status"] == ArtPiece.Status.DRAFT
        assert response.json()["piece"]["current_version"]["source"] == "<svg />"
        assert response.json()["edit_url"] == f"/users/@private-owner/edit/{piece.public_slug}"


@pytest.mark.django_db
def test_owner_private_slug_wins_collision_without_changing_public_resolution(client):
    user = get_user_model().objects.create_user(username="collision-owner", password="x")
    other = get_user_model().objects.create_user(username="collision-other", password="x")
    PublicProfile.objects.create(user=user, handle="collision-owner", is_public=True)
    public = _published_piece(user, "Public collision")
    public.public_slug = "shared-study"
    public.save(update_fields=["public_slug"])
    private = ArtPiece.objects.create(
        owner=user,
        title="Private collision",
        prompt="Private prompt",
        engine=ArtPiece.Engine.SVG,
        public_slug="shared-study",
        status=ArtPiece.Status.DRAFT,
    )
    version = ArtPieceVersion.objects.create(piece=private, sequence=1, source="private source")
    private.current_version = version
    private.save(update_fields=["current_version"])
    url = reverse(
        "public-piece-by-slug",
        kwargs={"handle": "collision-owner", "piece_slug": "shared-study"},
    )

    anonymous = client.get(url)
    assert anonymous.status_code == 200
    assert anonymous.json()["piece"]["public_id"] == str(public.public_id)
    client.force_login(other)
    assert client.get(url).json()["piece"]["public_id"] == str(public.public_id)
    client.force_login(user)
    owner = client.get(url)
    assert owner.status_code == 200
    assert owner.json()["piece"]["public_id"] == str(private.public_id)
    assert owner.json()["piece"]["current_version"]["source"] == "private source"


@pytest.mark.django_db
def test_art_piece_slug_constraints_allow_one_public_and_one_private_but_not_two_private_rows():
    user = get_user_model().objects.create_user(username="slug-policy")
    public = ArtPiece.objects.create(
        owner=user,
        prompt="public",
        engine=ArtPiece.Engine.SVG,
        public_slug="same-slug",
        status=ArtPiece.Status.PUBLISHED,
    )
    private = ArtPiece.objects.create(
        owner=user,
        prompt="private",
        engine=ArtPiece.Engine.SVG,
        public_slug="same-slug",
        status=ArtPiece.Status.DRAFT,
    )
    assert public.public_slug == private.public_slug == "same-slug"
    with pytest.raises(IntegrityError):
        ArtPiece.objects.create(
            owner=user,
            prompt="another private",
            engine=ArtPiece.Engine.SVG,
            public_slug="same-slug",
            status=ArtPiece.Status.ARCHIVED,
        )


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


@pytest.mark.django_db
def test_owner_editor_slug_resolver_mounts_structured_2d_and_3d_pieces(client):
    user = get_user_model().objects.create_user(username="structured-editor")
    PublicProfile.objects.create(user=user, handle="structured-editor", is_public=True)
    project = Project.objects.create(owner=user, title="Canvas Study")
    project3d = Project3D.objects.create(owner=user, title="Spatial Study")
    client.force_login(user)

    two_d = client.get(
        reverse(
            "owner-art-piece-by-slug",
            kwargs={"handle": "structured-editor", "piece_slug": project.public_slug},
        )
    )
    three_d = client.get(
        reverse(
            "owner-art-piece-by-slug",
            kwargs={"handle": "structured-editor", "piece_slug": project3d.public_slug},
        )
    )

    assert two_d.status_code == 200
    assert two_d.json()["type"] == "2d"
    assert two_d.json()["piece"]["id"] == str(project.public_id)
    assert three_d.status_code == 200
    assert three_d.json()["type"] == "3d"
    assert three_d.json()["piece"]["id"] == str(project3d.public_id)


# --- #790: the owner can open the regular view of their own private structured piece ---


_MINIMAL_SCENE_3D = json.loads(
    (Path(__file__).resolve().parents[2] / "schema/fixtures3d/valid/minimal.json").read_text()
)


def _private_structured(user):
    project = Project.objects.create(
        owner=user, title="Private Canvas", public_slug="private-canvas"
    )
    version = SceneVersion.objects.create(project=project, sequence=1, scene_json={"a": 1})
    project.current_version = version
    project.save(update_fields=["current_version"])
    project3d = Project3D.objects.create(
        owner=user, title="Private Scene", public_slug="private-scene"
    )
    version3d = SceneVersion3D.objects.create(
        project=project3d, sequence=1, scene_json=_MINIMAL_SCENE_3D
    )
    project3d.current_version = version3d
    project3d.save(update_fields=["current_version"])
    return project, project3d


@pytest.mark.django_db
@pytest.mark.parametrize(("slug", "kind"), [("private-canvas", "2d"), ("private-scene", "3d")])
def test_owner_sees_their_own_private_structured_piece_at_the_regular_route(client, slug, kind):
    user = get_user_model().objects.create_user(username="private-owner")
    PublicProfile.objects.create(user=user, handle="private-owner", is_public=True)
    _private_structured(user)
    client.force_login(user)

    response = client.get(
        reverse("public-piece-by-slug", kwargs={"handle": "private-owner", "piece_slug": slug})
    )

    assert response.status_code == 200
    body = response.json()
    assert body["type"] == kind
    assert body["piece"]["current_version"]["scene_json"]
    assert body["edit_url"] == f"/users/@private-owner/edit/{slug}"


@pytest.mark.django_db
@pytest.mark.parametrize("slug", ["private-canvas", "private-scene"])
def test_anonymous_and_other_users_never_see_a_private_structured_piece(client, slug):
    owner = get_user_model().objects.create_user(username="private-owner2")
    PublicProfile.objects.create(user=owner, handle="private-owner2", is_public=True)
    _private_structured(owner)
    url = reverse("public-piece-by-slug", kwargs={"handle": "private-owner2", "piece_slug": slug})

    assert client.get(url).status_code == 404
    other = get_user_model().objects.create_user(username="someone-else")
    client.force_login(other)
    assert client.get(url).status_code == 404


@pytest.mark.django_db
def test_a_deleted_private_structured_piece_is_not_shown_even_to_its_owner(client):
    owner = get_user_model().objects.create_user(username="private-owner3")
    PublicProfile.objects.create(user=owner, handle="private-owner3", is_public=True)
    project, project3d = _private_structured(owner)
    project.is_deleted = True
    project.save(update_fields=["is_deleted"])
    project3d.is_deleted = True
    project3d.save(update_fields=["is_deleted"])
    client.force_login(owner)
    for slug in ("private-canvas", "private-scene"):
        url = reverse(
            "public-piece-by-slug", kwargs={"handle": "private-owner3", "piece_slug": slug}
        )
        assert client.get(url).status_code == 404


@pytest.mark.django_db
def test_published_structured_pieces_expose_edit_url_only_to_their_owner(client):
    owner = get_user_model().objects.create_user(username="pub-owner")
    PublicProfile.objects.create(user=owner, handle="pub-owner", is_public=True)
    project = Project.objects.create(
        owner=owner,
        title="Published",
        public_slug="published-canvas",
        visibility=Project.Visibility.PUBLIC,
        published_at=timezone.now(),
    )
    version = SceneVersion.objects.create(project=project, sequence=1, scene_json={})
    project.current_version = version
    project.save(update_fields=["current_version"])
    url = reverse(
        "public-piece-by-slug", kwargs={"handle": "pub-owner", "piece_slug": "published-canvas"}
    )
    assert "edit_url" not in client.get(url).json()
    client.force_login(owner)
    assert client.get(url).json()["edit_url"] == "/users/@pub-owner/edit/published-canvas"
