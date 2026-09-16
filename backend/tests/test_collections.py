"""Owner collection domain/API tests for #567."""

import copy
import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from scenes.models import (
    ArtPiece,
    ArtPieceVersion,
    Collection,
    CollectionItem,
    Project,
    Project3D,
    PublicProfile,
    SceneVersion,
    SceneVersion3D,
)

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures"
        / "valid"
        / "blank.json"
    ).read_text()
)
MINIMAL_SCENE_3D = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures3d"
        / "valid"
        / "minimal.json"
    ).read_text()
)


@pytest.fixture
def owner(db):
    user = get_user_model().objects.create_user(
        username="collection-owner", email="collection-owner@example.com"
    )
    PublicProfile.objects.create(user=user, handle="collection-owner", is_public=True)
    return user


@pytest.fixture
def other(db):
    return get_user_model().objects.create_user(username="collection-other")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.fixture
def anonymous_client():
    return APIClient()


def _published_project(owner, title="Published 2D"):
    project = Project.objects.create(owner=owner, title=title, description="A public work")
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=copy.deepcopy(BLANK_SCENE),
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = version
    project.visibility = Project.Visibility.PUBLIC
    project.published_at = timezone.now()
    project.save(update_fields=["current_version", "visibility", "published_at"])
    return project


def _published_project3d(owner, title="Published 3D"):
    project = Project3D.objects.create(owner=owner, title=title)
    version = SceneVersion3D.objects.create(
        project=project, sequence=1, scene_json=copy.deepcopy(MINIMAL_SCENE_3D), created_by=owner
    )
    project.current_version = version
    project.visibility = Project3D.Visibility.PUBLIC
    project.published_at = timezone.now()
    project.save(update_fields=["current_version", "visibility", "published_at"])
    return project


def _published_piece(owner, title="Published piece"):
    piece = ArtPiece.objects.create(
        owner=owner,
        title=title,
        prompt="a public piece",
        engine=ArtPiece.Engine.CANVAS2D,
        status=ArtPiece.Status.PUBLISHED,
        published_at=timezone.now(),
    )
    version = ArtPieceVersion.objects.create(piece=piece, sequence=1, source="<canvas></canvas>")
    piece.current_version = version
    piece.save(update_fields=["current_version"])
    return piece


def _create_collection(client, title="My collection"):
    response = client.post("/api/account/collections/", {"title": title}, format="json")
    assert response.status_code == 201
    return response.json()


@pytest.mark.django_db
def test_owner_can_create_stable_slug_and_update_collection(owner_client):
    first = _create_collection(owner_client)
    second = _create_collection(owner_client)
    assert first["slug"] == "my-collection"
    assert second["slug"] == "my-collection-2"

    response = owner_client.patch(
        f"/api/account/collections/{first['id']}/",
        {"title": "Renamed collection", "description": "A description"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["slug"] == first["slug"]
    assert response.json()["title"] == "Renamed collection"


@pytest.mark.django_db
def test_items_require_owned_published_records_and_preserve_order(owner_client, owner, other):
    collection = _create_collection(owner_client)
    project = _published_project(owner)
    project3d = _published_project3d(owner)
    piece = _published_piece(owner)
    private = Project.objects.create(owner=owner, title="Private")
    foreign = _published_project(other, title="Foreign")

    response = owner_client.post(
        f"/api/account/collections/{collection['id']}/items/",
        {
            "items": [
                {"kind": "art_piece", "id": str(piece.public_id)},
                {"kind": "project3d", "id": str(project3d.public_id)},
                {"kind": "project", "id": str(project.public_id)},
            ]
        },
        format="json",
    )
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [
        str(piece.public_id),
        str(project3d.public_id),
        str(project.public_id),
    ]
    assert [item.position for item in CollectionItem.objects.order_by("position")] == [0, 1, 2]

    for invalid in (private.public_id, foreign.public_id):
        response = owner_client.post(
            f"/api/account/collections/{collection['id']}/items/",
            {"items": [{"kind": "project", "id": str(invalid)}]},
            format="json",
        )
        assert response.status_code == 400
        assert CollectionItem.objects.filter(collection__public_id=collection["id"]).count() == 3


@pytest.mark.django_db
def test_duplicate_items_are_rejected_without_mutation(owner_client, owner):
    collection = _create_collection(owner_client)
    project = _published_project(owner)
    payload = {"items": [{"kind": "project", "id": str(project.public_id)}]}
    assert (
        owner_client.post(
            f"/api/account/collections/{collection['id']}/items/", payload, format="json"
        ).status_code
        == 200
    )

    duplicate = {
        "items": [
            {"kind": "project", "id": str(project.public_id)},
            {"kind": "project", "id": str(project.public_id)},
        ]
    }
    response = owner_client.post(
        f"/api/account/collections/{collection['id']}/items/", duplicate, format="json"
    )
    assert response.status_code == 400
    assert CollectionItem.objects.filter(collection__public_id=collection["id"]).count() == 1


@pytest.mark.django_db
def test_public_collection_is_ordered_and_filters_items_that_become_private(
    owner_client, anonymous_client, owner
):
    collection = _create_collection(owner_client)
    project = _published_project(owner)
    piece = _published_piece(owner)
    owner_client.post(
        f"/api/account/collections/{collection['id']}/items/",
        {
            "items": [
                {"kind": "project", "id": str(project.public_id)},
                {"kind": "art_piece", "id": str(piece.public_id)},
            ]
        },
        format="json",
    )
    assert (
        owner_client.post(f"/api/account/collections/{collection['id']}/publish/").status_code
        == 200
    )

    response = anonymous_client.get(
        f"/api/public/collections/collection-owner/{collection['slug']}/"
    )
    assert response.status_code == 200
    assert [item["kind"] for item in response.json()["items"]] == ["project", "art_piece"]
    assert response.json()["items"][0]["viewer_url"].startswith("/p/")

    project.visibility = Project.Visibility.PRIVATE
    project.published_at = None
    project.save(update_fields=["visibility", "published_at"])
    response = anonymous_client.get(
        f"/api/public/collections/collection-owner/{collection['slug']}/"
    )
    assert response.status_code == 200
    assert [item["kind"] for item in response.json()["items"]] == ["art_piece"]


@pytest.mark.django_db
def test_private_collection_and_foreign_mutation_are_not_disclosed(owner_client, other, owner):
    collection = _create_collection(owner_client)
    foreign_client = APIClient()
    foreign_client.force_authenticate(other)
    assert foreign_client.get(f"/api/account/collections/{collection['id']}/").status_code == 404
    assert (
        foreign_client.patch(
            f"/api/account/collections/{collection['id']}/", {"title": "nope"}, format="json"
        ).status_code
        == 404
    )
    assert (
        APIClient()
        .get(f"/api/public/collections/collection-owner/{collection['slug']}/")
        .status_code
        == 404
    )


@pytest.mark.django_db
def test_public_item_detail_exposes_only_public_collection_context(
    owner_client, anonymous_client, owner
):
    project = _published_project(owner)
    public = _create_collection(owner_client, "Public work")
    private = _create_collection(owner_client, "Private work")
    for collection in (public, private):
        assert (
            owner_client.post(
                f"/api/account/collections/{collection['id']}/items/",
                {"items": [{"kind": "project", "id": str(project.public_id)}]},
                format="json",
            ).status_code
            == 200
        )
    assert owner_client.post(f"/api/account/collections/{public['id']}/publish/").status_code == 200

    response = anonymous_client.get(f"/api/public/projects/{project.public_id}/")
    assert response.status_code == 200
    assert response.json()["collections"] == [
        {
            "title": "Public work",
            "handle": "collection-owner",
            "slug": "public-work",
            "url": "/users/@collection-owner/public-work",
        }
    ]


@pytest.mark.django_db
def test_public_gallery_collections_mode_is_profile_and_visibility_filtered(
    owner_client, anonymous_client, owner
):
    public = _create_collection(owner_client, "Gallery collection")
    _create_collection(owner_client, "Hidden collection")
    assert owner_client.post(f"/api/account/collections/{public['id']}/publish/").status_code == 200

    collections_response = anonymous_client.get("/api/public/gallery/?type=collections")
    assert collections_response.status_code == 200
    assert [item["kind"] for item in collections_response.json()["results"]] == ["collection"]
    assert collections_response.json()["results"][0]["title"] == "Gallery collection"

    all_response = anonymous_client.get("/api/public/gallery/?type=all")
    assert all_response.status_code == 200
    assert {item["title"] for item in all_response.json()["results"]} >= {"Gallery collection"}
    assert "Hidden collection" not in {
        item["title"] for item in all_response.json()["results"]
    }

    profile = owner.public_profile
    profile.is_public = False
    profile.save(update_fields=["is_public"])
    assert anonymous_client.get("/api/public/gallery/?type=collections").json()["results"] == []


@pytest.mark.django_db
def test_publish_unpublish_and_soft_delete_are_safe_and_idempotent(owner_client, owner):
    collection = _create_collection(owner_client)
    public_id = collection["id"]
    assert owner_client.post(f"/api/account/collections/{public_id}/publish/").status_code == 200
    assert owner_client.post(f"/api/account/collections/{public_id}/publish/").status_code == 200
    assert owner_client.post(f"/api/account/collections/{public_id}/unpublish/").status_code == 200
    assert owner_client.delete(f"/api/account/collections/{public_id}/").status_code == 204
    assert owner_client.delete(f"/api/account/collections/{public_id}/").status_code == 404
    assert Collection.objects.get(public_id=public_id).is_deleted is True


@pytest.mark.django_db
def test_account_collection_endpoints_require_authentication(anonymous_client):
    assert anonymous_client.get("/api/account/collections/").status_code == 401
    assert anonymous_client.post("/api/account/collections/", {"title": "Nope"}).status_code == 401
