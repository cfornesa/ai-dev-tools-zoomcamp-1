"""Owner collection domain/API tests for #567."""

import copy
import io
import json
from datetime import timedelta
from pathlib import Path
from zipfile import ZipFile

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from scenes.collections import collection_payload, public_collection_context
from scenes.models import (
    ArtPiece,
    ArtPieceVersion,
    Collection,
    CollectionItem,
    CollectionSlugRedirect,
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
def test_collection_payload_batches_mixed_item_lookups(owner_client, owner):
    project = _published_project(owner, "Mixed 2D")
    second_project = _published_project(owner, "Mixed 2D second")
    project3d = _published_project3d(owner, "Mixed 3D")
    piece = _published_piece(owner, "Mixed generated")
    payload = _create_collection(owner_client, "Mixed collection")
    collection = Collection.objects.get(public_id=payload["id"])
    CollectionItem.objects.bulk_create(
        [
            CollectionItem(
                collection=collection,
                kind=CollectionItem.Kind.PROJECT,
                item_id=project.public_id,
                position=0,
            ),
            CollectionItem(
                collection=collection,
                kind=CollectionItem.Kind.PROJECT3D,
                item_id=project3d.public_id,
                position=2,
            ),
            CollectionItem(
                collection=collection,
                kind=CollectionItem.Kind.ART_PIECE,
                item_id=piece.public_id,
                position=3,
            ),
            CollectionItem(
                collection=collection,
                kind=CollectionItem.Kind.PROJECT,
                item_id=second_project.public_id,
                position=1,
            ),
        ]
    )

    with CaptureQueriesContext(connection) as queries:
        result = collection_payload(collection, public=True)

    assert [item["title"] for item in result["items"]] == [
        "Mixed 2D",
        "Mixed 2D second",
        "Mixed 3D",
        "Mixed generated",
    ]
    assert len(queries) <= 11


@pytest.mark.django_db
def test_public_collection_context_batches_profile_lookup(owner_client, owner):
    project = _published_project(owner, "Context project")
    for index in range(3):
        collection = _create_collection(owner_client, f"Context collection {index}")
        assert (
            owner_client.post(
                f"/api/account/collections/{collection['id']}/items/",
                {"items": [{"kind": "project", "id": str(project.public_id)}]},
                format="json",
            ).status_code
            == 200
        )
        assert (
            owner_client.post(f"/api/account/collections/{collection['id']}/publish/").status_code
            == 200
        )

    with CaptureQueriesContext(connection) as queries:
        result = public_collection_context("project", project.public_id)

    assert [item["title"] for item in result] == [
        "Context collection 0",
        "Context collection 1",
        "Context collection 2",
    ]
    assert len(queries) <= 1


@pytest.mark.django_db
def test_owner_can_create_stable_slug_and_update_collection(owner_client, owner):
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

    renamed = owner_client.patch(
        f"/api/account/collections/{first['id']}/",
        {"public_slug": "Curated / works"},
        format="json",
    )
    assert renamed.status_code == 200
    assert renamed.json()["slug"] == "curated-works"
    assert CollectionSlugRedirect.objects.filter(owner=owner, old_slug="my-collection").exists()

    old_response = owner_client.get("/api/account/collections/")
    assert old_response.status_code == 200
    renamed_payload = next(item for item in old_response.json() if item["id"] == first["id"])
    assert renamed_payload["canonical_url"].endswith("/collections/curated-works")


@pytest.mark.django_db
def test_collection_status_controls_public_visibility_and_owner_listing(
    owner_client, anonymous_client
):
    collection = _create_collection(owner_client, "Status collection")
    collection_id = collection["id"]
    public_url = "/api/public/collections/collection-owner/status-collection/"

    drafted = owner_client.patch(
        f"/api/account/collections/{collection_id}/",
        {"status": "draft"},
        format="json",
    )
    assert drafted.status_code == 200
    assert drafted.json()["status"] == "draft"
    assert (
        owner_client.post(f"/api/account/collections/{collection_id}/publish/").status_code == 200
    )
    assert anonymous_client.get(public_url).status_code == 404

    archived = owner_client.patch(
        f"/api/account/collections/{collection_id}/",
        {"status": "archived"},
        format="json",
    )
    assert archived.status_code == 200
    assert archived.json()["status"] == "archived"
    assert all(
        item["id"] != collection_id for item in owner_client.get("/api/account/collections/").json()
    )


@pytest.mark.django_db
def test_collection_comments_require_enabled_flag_and_are_rate_limited(
    owner_client, anonymous_client
):
    collection = _create_collection(owner_client, "Comment collection")
    url = "/api/public/collections/collection-owner/comment-collection/comments/"
    assert owner_client.post(url, {"body": "blocked"}, format="json").status_code == 404
    assert anonymous_client.post(url, {"body": "anonymous"}, format="json").status_code == 401

    owner_client.patch(
        f"/api/account/collections/{collection['id']}/",
        {"comments_enabled": True},
        format="json",
    )
    owner_client.post(f"/api/account/collections/{collection['id']}/publish/")
    cache.clear()
    created = owner_client.post(url, {"body": "hello"}, format="json")
    assert created.status_code == 201
    assert created.json()["body"] == "hello"
    assert owner_client.post(url, {"body": "again"}, format="json").status_code == 429


@pytest.mark.django_db
def test_collection_slugs_cannot_shadow_public_namespaces(owner_client):
    generated = _create_collection(owner_client, "Pieces")
    assert generated["slug"] == "pieces-2"

    response = owner_client.patch(
        f"/api/account/collections/{generated['id']}/",
        {"public_slug": "immersive"},
        format="json",
    )
    assert response.status_code == 400
    assert "reserved" in str(response.json()["detail"])


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
def test_public_collection_slug_change_redirects_and_exposes_canonical_links(
    owner_client, anonymous_client
):
    collection = _create_collection(owner_client, "Canonical collection")
    assert (
        owner_client.post(f"/api/account/collections/{collection['id']}/publish/").status_code
        == 200
    )
    renamed = owner_client.patch(
        f"/api/account/collections/{collection['id']}/",
        {"public_slug": "Curated / Collection"},
        format="json",
    )
    assert renamed.status_code == 200

    old_response = anonymous_client.get(
        "/api/public/collections/collection-owner/canonical-collection/",
        follow=False,
    )
    assert old_response.status_code == 301
    assert old_response["Location"].endswith(
        "/api/public/collections/collection-owner/curated-collection/"
    )

    current = anonymous_client.get("/api/public/collections/collection-owner/curated-collection/")
    assert current.status_code == 200
    assert (
        current.json()["canonical_url"] == "/users/@collection-owner/collections/curated-collection"
    )
    assert current.json()["immersive_url"].endswith("/collections/curated-collection/immersive")


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
    assert response.json()["items"][0]["viewer_url"].startswith("/users/@collection-owner/pieces/")

    project.visibility = Project.Visibility.PRIVATE
    project.published_at = None
    project.save(update_fields=["visibility", "published_at"])
    response = anonymous_client.get(
        f"/api/public/collections/collection-owner/{collection['slug']}/"
    )
    assert response.status_code == 200
    assert [item["kind"] for item in response.json()["items"]] == ["art_piece"]


@pytest.mark.django_db
def test_public_collection_download_is_a_visibility_safe_ordered_zip(
    owner_client, anonymous_client, owner
):
    collection = _create_collection(owner_client, "Download collection")
    project = _published_project(owner, "Download project")
    assert (
        owner_client.post(
            f"/api/account/collections/{collection['id']}/items/",
            {"items": [{"kind": "project", "id": str(project.public_id)}]},
            format="json",
        ).status_code
        == 200
    )
    assert (
        owner_client.post(f"/api/account/collections/{collection['id']}/publish/").status_code
        == 200
    )

    response = anonymous_client.get(
        f"/api/public/collections/collection-owner/{collection['slug']}/download/"
    )
    assert response.status_code == 200
    assert response["Content-Type"] == "application/zip"
    assert response["Content-Disposition"] == 'attachment; filename="download-collection.zip"'
    with ZipFile(io.BytesIO(response.content)) as archive:
        manifest = json.loads(archive.read("collection.json"))
    assert manifest["title"] == "Download collection"
    assert [item["title"] for item in manifest["items"]] == ["Download project"]
    assert (
        anonymous_client.get(
            "/api/public/collections/collection-owner/missing/download/"
        ).status_code
        == 404
    )


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
            "url": "/users/@collection-owner/collections/public-work",
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
    assert "Hidden collection" not in {item["title"] for item in all_response.json()["results"]}

    profile = owner.public_profile
    profile.is_public = False
    profile.save(update_fields=["is_public"])
    assert anonymous_client.get("/api/public/gallery/?type=collections").json()["results"] == []


@pytest.mark.django_db
def test_public_list_returns_newest_first_with_exact_safe_card_payload(
    owner_client, anonymous_client, owner
):
    older = _create_collection(owner_client, "Older collection")
    newer = _create_collection(owner_client, "Newer collection")
    assert owner_client.post(f"/api/account/collections/{older['id']}/publish/").status_code == 200
    assert owner_client.post(f"/api/account/collections/{newer['id']}/publish/").status_code == 200
    Collection.objects.filter(public_id=older["id"]).update(published_at=timezone.now())
    Collection.objects.filter(public_id=newer["id"]).update(
        published_at=timezone.now() + timedelta(seconds=1)
    )

    response = anonymous_client.get("/api/collections/public/")

    assert response.status_code == 200
    assert response.json()["has_more"] is False
    assert response.json()["next_cursor"] is None
    assert [item["title"] for item in response.json()["results"]] == [
        "Newer collection",
        "Older collection",
    ]
    assert set(response.json()["results"][0]) == {
        "id",
        "title",
        "owner_handle",
        "cover_url",
        "item_count",
        "published_at",
        "viewer_url",
    }
    assert response.json()["results"][0]["owner_handle"] == "collection-owner"
    assert response.json()["results"][0]["cover_url"] is None
    assert response.json()["results"][0]["item_count"] == 0
    assert response.json()["results"][0]["viewer_url"].endswith("/newer-collection")


@pytest.mark.django_db
def test_public_list_cursor_round_trip_is_keyset_paginated(owner_client, anonymous_client):
    collections = [_create_collection(owner_client, f"Collection {index}") for index in range(3)]
    for index, collection in enumerate(collections):
        assert (
            owner_client.post(f"/api/account/collections/{collection['id']}/publish/").status_code
            == 200
        )
        Collection.objects.filter(public_id=collection["id"]).update(
            published_at=timezone.now() + timedelta(seconds=index)
        )

    first = anonymous_client.get("/api/collections/public/?page_size=2")
    assert first.status_code == 200
    assert first.json()["has_more"] is True
    assert first.json()["next_cursor"]

    second = anonymous_client.get(
        "/api/collections/public/", {"page_size": 2, "cursor": first.json()["next_cursor"]}
    )
    assert second.status_code == 200
    assert second.json()["has_more"] is False
    assert second.json()["next_cursor"] is None
    first_ids = {item["id"] for item in first.json()["results"]}
    second_ids = {item["id"] for item in second.json()["results"]}
    assert first_ids.isdisjoint(second_ids)
    assert len(first_ids | second_ids) == 3


@pytest.mark.django_db
def test_public_list_excludes_draft_archived_private_and_deleted_collections(
    owner_client, anonymous_client
):
    visible = _create_collection(owner_client, "Visible collection")
    draft = _create_collection(owner_client, "Draft collection")
    archived = _create_collection(owner_client, "Archived collection")
    private = _create_collection(owner_client, "Private collection")
    deleted = _create_collection(owner_client, "Deleted collection")
    for collection in (visible, draft, archived, private, deleted):
        Collection.objects.filter(public_id=collection["id"]).update(published_at=timezone.now())
    Collection.objects.filter(public_id=visible["id"]).update(
        visibility=Collection.Visibility.PUBLIC, status=Collection.Status.ACTIVE
    )
    Collection.objects.filter(public_id=draft["id"]).update(
        visibility=Collection.Visibility.PUBLIC, status=Collection.Status.DRAFT
    )
    Collection.objects.filter(public_id=archived["id"]).update(
        visibility=Collection.Visibility.PUBLIC, status=Collection.Status.ARCHIVED
    )
    Collection.objects.filter(public_id=deleted["id"]).update(
        visibility=Collection.Visibility.PUBLIC, is_deleted=True
    )

    response = anonymous_client.get("/api/collections/public/")

    assert response.status_code == 200
    assert [item["title"] for item in response.json()["results"]] == ["Visible collection"]


@pytest.mark.django_db
def test_public_list_counts_only_currently_public_collection_members(
    owner_client, anonymous_client, owner
):
    first = _published_project(owner, "Public member")
    second = _published_project(owner, "Member that becomes private")
    collection = _create_collection(owner_client, "Counted collection")
    assert (
        owner_client.post(
            f"/api/account/collections/{collection['id']}/items/",
            {
                "items": [
                    {"kind": "project", "id": str(first.public_id)},
                    {"kind": "project", "id": str(second.public_id)},
                ]
            },
            format="json",
        ).status_code
        == 200
    )
    assert (
        owner_client.post(f"/api/account/collections/{collection['id']}/publish/").status_code
        == 200
    )
    second.visibility = Project.Visibility.PRIVATE
    second.published_at = None
    second.save(update_fields=["visibility", "published_at"])

    response = anonymous_client.get("/api/collections/public/")

    assert response.status_code == 200
    assert response.json()["results"][0]["item_count"] == 1


@pytest.mark.django_db
def test_public_list_returns_empty_result_without_authentication(anonymous_client):
    response = anonymous_client.get("/api/collections/public/")

    assert response.status_code == 200
    assert response.json() == {"results": [], "next_cursor": None, "has_more": False}


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


@pytest.mark.django_db
@pytest.mark.parametrize(
    "bad_seo_config",
    [
        {"title": "x" * 201},
        {"unknown_field": "nope"},
        {"canonical_policy": "everywhere"},
        {"og_image_url": "javascript:alert(1)"},
        {"structured_data": "not-an-object"},
    ],
)
def test_collection_seo_config_rejects_invalid_values(owner_client, bad_seo_config):
    collection = _create_collection(owner_client)
    response = owner_client.patch(
        f"/api/account/collections/{collection['id']}/",
        {"seo_config": bad_seo_config},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_published_collection_exposes_configured_seo_metadata_publicly(
    owner_client, anonymous_client
):
    collection = _create_collection(owner_client, "SEO collection")
    seo_config = {
        "title": "SEO collection — AugmentrART",
        "description": "A curated set of public work.",
        "canonical_policy": "self",
        "indexing": "index",
        "og_image_url": "https://example.com/collection.png",
        "structured_data": {"@type": "CollectionPage"},
    }
    assert (
        owner_client.patch(
            f"/api/account/collections/{collection['id']}/",
            {"seo_config": seo_config},
            format="json",
        ).status_code
        == 200
    )
    assert (
        owner_client.post(f"/api/account/collections/{collection['id']}/publish/").status_code
        == 200
    )

    response = anonymous_client.get("/api/public/collections/collection-owner/seo-collection/")
    assert response.status_code == 200
    assert response.json()["seo_config"] == seo_config


@pytest.mark.django_db
def test_private_and_deleted_collection_do_not_leak_seo_metadata(owner_client, anonymous_client):
    collection = _create_collection(owner_client, "Hidden collection")
    seo_config = {"description": "Should never be public."}
    owner_client.patch(
        f"/api/account/collections/{collection['id']}/",
        {"seo_config": seo_config},
        format="json",
    )

    private_response = anonymous_client.get(
        "/api/public/collections/collection-owner/hidden-collection/"
    )
    assert private_response.status_code == 404

    owner_client.post(f"/api/account/collections/{collection['id']}/publish/")
    owner_client.delete(f"/api/account/collections/{collection['id']}/")
    deleted_response = anonymous_client.get(
        "/api/public/collections/collection-owner/hidden-collection/"
    )
    assert deleted_response.status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize(
    "bad_seo_config",
    [
        {"title": "x" * 201},
        {"unknown_field": "nope"},
        {"twitter_card": "huge"},
        {"og_image_url": "javascript:alert(1)"},
    ],
)
def test_art_piece_seo_config_rejects_invalid_values(owner_client, owner, bad_seo_config):
    piece = _published_piece(owner)
    response = owner_client.patch(
        f"/api/art-pieces/{piece.public_id}/",
        {"seo_config": bad_seo_config},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_published_art_piece_exposes_configured_seo_metadata_publicly(
    owner_client, anonymous_client, owner
):
    piece = _published_piece(owner)
    piece.description = "A meaningful description."
    piece.save(update_fields=["description"])
    seo_config = {
        "title": "Published piece — AugmentrART",
        "answer_summary": "A generated public art piece.",
        "structured_data": {"@type": "CreativeWork"},
    }
    assert (
        owner_client.patch(
            f"/api/art-pieces/{piece.public_id}/",
            {"seo_config": seo_config},
            format="json",
        ).status_code
        == 200
    )

    response = anonymous_client.get(f"/api/public/art-pieces/{piece.public_id}/")
    assert response.status_code == 200
    assert response.json()["seo_config"] == seo_config
