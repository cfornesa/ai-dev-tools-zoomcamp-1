"""Unpublish-retention policy, restore, and bounded purge coverage (#944)."""

import copy
import json
from datetime import timedelta
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from scenes.models import (
    AdminContentAuditEvent,
    ApplicationAdmin,
    ArtPiece,
    ArtPieceVersion,
    Collection,
    CollectionItem,
    Project,
    Project3D,
    SceneVersion,
    SceneVersion3D,
    UnpublishRetentionPolicy,
)
from scenes.unpublish_retention import purge_eligible_at

pytestmark = pytest.mark.django_db

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


def _user(username):
    return get_user_model().objects.create_user(username=username, password="test-password")


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _published_project(owner):
    project = Project.objects.create(
        owner=owner, title="Retained piece", description="Something meaningful."
    )
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = version
    project.visibility = Project.Visibility.PUBLIC
    project.published_at = timezone.now()
    project.save(update_fields=["current_version", "visibility", "published_at"])
    return project


def _published_project3d(owner):
    project = Project3D.objects.create(owner=owner, title="Retained 3D piece")
    version = SceneVersion3D.objects.create(
        project=project,
        sequence=1,
        scene_json=copy.deepcopy(MINIMAL_SCENE_3D),
        created_by=owner,
    )
    project.current_version = version
    project.visibility = Project3D.Visibility.PUBLIC
    project.published_at = timezone.now()
    project.save(update_fields=["current_version", "visibility", "published_at"])
    return project


def _published_art_piece(owner):
    piece = ArtPiece.objects.create(
        owner=owner,
        title="Retained generated piece",
        description="A generated composition.",
        prompt="anything",
        engine=ArtPiece.Engine.SVG,
        status=ArtPiece.Status.PUBLISHED,
        published_at=timezone.now(),
    )
    version = ArtPieceVersion.objects.create(
        piece=piece, sequence=1, source="<svg></svg>", capabilities={}
    )
    piece.current_version = version
    piece.save(update_fields=["current_version"])
    return piece


# --- Unpublish sets the clock; republish restores ---


def test_unpublish_2d_starts_retention_clock_and_republish_clears_it():
    owner = _user("retention-2d-owner")
    project = _published_project(owner)
    client = _client(owner)

    unpublished = client.post(f"/api/projects/{project.public_id}/unpublish/")
    assert unpublished.status_code == 200
    project.refresh_from_db()
    assert project.unpublished_at is not None

    republished = client.post(f"/api/projects/{project.public_id}/publish/")
    assert republished.status_code == 200
    project.refresh_from_db()
    assert project.unpublished_at is None
    assert project.visibility == Project.Visibility.PUBLIC


def test_unpublish_3d_starts_retention_clock_and_republish_clears_it():
    owner = _user("retention-3d-owner")
    project = _published_project3d(owner)
    client = _client(owner)

    unpublished = client.post(f"/api/projects3d/{project.public_id}/unpublish/")
    assert unpublished.status_code == 200
    project.refresh_from_db()
    assert project.unpublished_at is not None

    republished = client.post(f"/api/projects3d/{project.public_id}/publish/")
    assert republished.status_code == 200
    project.refresh_from_db()
    assert project.unpublished_at is None


def test_art_piece_status_transition_away_from_published_starts_clock():
    owner = _user("retention-art-owner")
    piece = _published_art_piece(owner)
    client = _client(owner)

    response = client.patch(
        f"/api/art-pieces/{piece.public_id}/", {"status": "draft"}, format="json"
    )
    assert response.status_code == 200
    piece.refresh_from_db()
    assert piece.unpublished_at is not None
    assert piece.published_at is None

    restored = client.patch(
        f"/api/art-pieces/{piece.public_id}/", {"status": "published"}, format="json"
    )
    assert restored.status_code == 200
    piece.refresh_from_db()
    assert piece.unpublished_at is None


def test_a_never_published_draft_gets_no_retention_clock():
    owner = _user("retention-art-draft-owner")
    piece = ArtPiece.objects.create(
        owner=owner,
        title="Never published",
        prompt="anything",
        engine=ArtPiece.Engine.SVG,
        status=ArtPiece.Status.DRAFT,
    )
    client = _client(owner)
    response = client.patch(
        f"/api/art-pieces/{piece.public_id}/", {"title": "Still draft"}, format="json"
    )
    assert response.status_code == 200
    piece.refresh_from_db()
    assert piece.unpublished_at is None


# --- Admin policy API ---


def test_unpublish_retention_admin_api_is_admin_only():
    anonymous = APIClient()
    ordinary = _user("ordinary-unpublish-retention")
    admin = _user("unpublish-retention-admin")
    ApplicationAdmin.objects.create(user=admin)
    url = reverse("admin-unpublish-retention")
    assert anonymous.get(url).status_code == 401
    assert _client(ordinary).get(url).status_code == 403
    response = _client(admin).get(url)
    assert response.status_code == 200
    assert response.json()["unpublished_grace_days"] == 30


def test_unpublish_retention_policy_update_is_revision_checked():
    admin = _user("unpublish-retention-admin-update")
    ApplicationAdmin.objects.create(user=admin)
    client = _client(admin)
    url = reverse("admin-unpublish-retention")
    current = client.get(url).json()
    updated = client.patch(
        url, {"unpublished_grace_days": 14, "revision": current["revision"]}, format="json"
    )
    assert updated.status_code == 200
    assert updated.json()["unpublished_grace_days"] == 14

    stale = client.patch(
        url, {"unpublished_grace_days": 5, "revision": current["revision"]}, format="json"
    )
    assert stale.status_code == 409
    policy = UnpublishRetentionPolicy.objects.get(pk=1)
    assert policy.unpublished_grace_days == 14
    assert (
        AdminContentAuditEvent.objects.filter(resource_type="unpublish_retention_policy").count()
        == 1
    )


# --- Purge: bounded, confirmed, audited ---


def test_purge_requires_confirmation_and_is_bounded_and_audited():
    owner = _user("retention-purge-owner")
    admin = _user("retention-purge-admin")
    ApplicationAdmin.objects.create(user=admin)
    client = _client(admin)

    project = _published_project(owner)
    project.visibility = Project.Visibility.PRIVATE
    project.unpublished_at = timezone.now() - timedelta(days=31)
    project.save(update_fields=["visibility", "unpublished_at"])

    still_in_window = _published_project(owner)
    still_in_window.visibility = Project.Visibility.PRIVATE
    still_in_window.unpublished_at = timezone.now() - timedelta(days=1)
    still_in_window.save(update_fields=["visibility", "unpublished_at"])

    purge_url = reverse("admin-unpublish-retention-purge")
    unconfirmed = client.post(purge_url, {"confirm_retroactive": False}, format="json")
    assert unconfirmed.status_code == 409
    project.refresh_from_db()
    assert project.is_deleted is False

    confirmed = client.post(purge_url, {"confirm_retroactive": True}, format="json")
    assert confirmed.status_code == 200
    body = confirmed.json()
    assert body["purged_project"] == 1
    assert body["scanned"] == 1

    project.refresh_from_db()
    assert project.is_deleted is True
    assert project.deleted_at is not None

    still_in_window.refresh_from_db()
    assert still_in_window.is_deleted is False

    assert (
        AdminContentAuditEvent.objects.filter(
            resource_type="project", action="unpublished_piece_purged"
        ).count()
        == 1
    )


def test_purge_limit_bounds_how_many_pieces_are_purged_in_one_call():
    owner = _user("retention-purge-limit-owner")
    admin = _user("retention-purge-limit-admin")
    ApplicationAdmin.objects.create(user=admin)
    client = _client(admin)

    projects = []
    for index in range(3):
        project = _published_project(owner)
        project.visibility = Project.Visibility.PRIVATE
        project.unpublished_at = timezone.now() - timedelta(days=31, hours=index)
        project.save(update_fields=["visibility", "unpublished_at"])
        projects.append(project)

    purge_url = reverse("admin-unpublish-retention-purge")
    result = client.post(purge_url, {"confirm_retroactive": True, "limit": 2}, format="json")
    assert result.status_code == 200
    assert result.json()["scanned"] == 2
    purged_count = sum(1 for p in projects if Project.all_objects.get(pk=p.pk).is_deleted)
    assert purged_count == 2


def test_purge_ordinary_user_rejected():
    ordinary = _user("ordinary-purge-attempt")
    purge_url = reverse("admin-unpublish-retention-purge")
    response = _client(ordinary).post(purge_url, {"confirm_retroactive": True}, format="json")
    assert response.status_code == 403


# --- Owner-facing retained-pieces list ---


def test_my_unpublished_pieces_lists_across_kinds_with_purge_eligibility():
    owner = _user("retention-list-owner")
    client = _client(owner)

    project = _published_project(owner)
    client.post(f"/api/projects/{project.public_id}/unpublish/")

    response = client.get(reverse("account-unpublished-pieces"))
    assert response.status_code == 200
    body = response.json()
    assert body["unpublished_grace_days"] == 30
    assert len(body["pieces"]) == 1
    row = body["pieces"][0]
    assert row["kind"] == "project"
    assert row["purge_eligible_at"] is not None


def test_purge_eligible_at_helper_matches_policy_window():
    policy = UnpublishRetentionPolicy.get_solo()
    now = timezone.now()
    assert purge_eligible_at(None, policy) is None
    eligible_at = purge_eligible_at(now, policy)
    assert eligible_at == now + timedelta(days=policy.unpublished_grace_days)


# --- Collections: hidden-from-public flag in the owner's own view ---


def test_owner_collection_view_flags_an_unpublished_item_as_hidden_from_public():
    owner = _user("retention-collection-owner")
    project = _published_project(owner)
    collection = Collection.objects.create(owner=owner, title="A collection")
    CollectionItem.objects.create(
        collection=collection,
        kind=CollectionItem.Kind.PROJECT,
        item_id=project.public_id,
        position=0,
    )

    from scenes.collections import collection_payload

    owner_view = collection_payload(collection, public=False)
    assert owner_view["items"][0]["is_hidden_from_public"] is False

    client = _client(owner)
    client.post(f"/api/projects/{project.public_id}/unpublish/")

    owner_view_after = collection_payload(collection, public=False)
    assert owner_view_after["items"][0]["is_hidden_from_public"] is True
