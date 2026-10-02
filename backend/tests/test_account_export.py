"""Tests for the owner-scoped account data export (issue #442)."""

import json
from datetime import timedelta
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse
from django.utils import timezone

from scenes.models import (
    ArtPiece,
    ArtPieceVersion,
    Project,
    Project3D,
    ProjectActivity,
    ProviderCredential,
    SceneVersion,
    SceneVersion3D,
    Subscription,
)


def _make_user(username):
    return get_user_model().objects.create_user(username=username, password="not-used")


_MINIMAL_SCENE_3D = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures3d"
        / "valid"
        / "minimal.json"
    ).read_text()
)


@pytest.mark.django_db
def test_requires_authentication(client):
    response = client.get(reverse("account-data-export"))
    assert response.status_code == 401


@pytest.mark.django_db
def test_export_includes_schema_version_and_profile():
    user = _make_user("owner")
    client = Client()
    client.force_login(user)

    response = client.get(reverse("account-data-export"))

    assert response.status_code == 200
    body = response.json()
    assert body["schema_version"] == 1
    assert body["profile"] == {"username": "owner", "email": ""}


@pytest.mark.django_db
def test_export_never_exposes_credential_key_material():
    user = _make_user("owner")
    ProviderCredential.objects.create(owner=user, vendor="mistral", encrypted_key=b"not-a-real-key")
    ProviderCredential.objects.create(owner=user, vendor="gemini", encrypted_key=b"also-not-real")
    client = Client()
    client.force_login(user)

    response = client.get(reverse("account-data-export"))

    body = response.json()
    assert body["ai_credentials"] == {
        "mistral_configured": True,
        "provider_credentials": ["gemini", "mistral"],
    }
    # Never even the encrypted bytes, let alone anything decrypted.
    assert b"not-a-real-key" not in response.content
    assert b"also-not-real" not in response.content


@pytest.mark.django_db
def test_export_includes_owned_projects_and_versions_including_soft_deleted():
    user = _make_user("owner")
    project = Project.objects.create(owner=user, title="My animation", brief="limited palette")
    SceneVersion.objects.create(
        project=project, sequence=1, scene_json={"shapes": []}, origin=SceneVersion.Origin.MANUAL
    )
    deleted_project = Project.objects.create(owner=user, title="Deleted animation")
    deleted_project.is_deleted = True
    deleted_project.save(update_fields=["is_deleted"])

    client = Client()
    client.force_login(user)
    response = client.get(reverse("account-data-export"))

    body = response.json()
    titles = {p["title"] for p in body["projects"]}
    assert titles == {"My animation", "Deleted animation"}
    project_export = next(p for p in body["projects"] if p["title"] == "My animation")
    assert len(project_export["versions"]) == 1
    assert project_export["versions"][0]["scene_json"] == {"shapes": []}
    assert project_export["brief"] == "limited palette"
    deleted_export = next(p for p in body["projects"] if p["title"] == "Deleted animation")
    assert deleted_export["is_deleted"] is True


@pytest.mark.django_db
def test_export_includes_owned_3d_projects_and_art_pieces():
    user = _make_user("owner")
    project3d = Project3D.objects.create(owner=user, title="My 3D scene")
    SceneVersion3D.objects.create(
        project=project3d,
        sequence=1,
        scene_json=_MINIMAL_SCENE_3D,
        origin=SceneVersion3D.Origin.MANUAL,
    )
    event = ProjectActivity.objects.create(
        project3d=project3d,
        actor=user,
        action_type=ProjectActivity.ActionType.VERSION_SAVED,
        metadata={"sequence": 1, "origin": "manual", "private_marker": "hidden"},
    )
    piece = ArtPiece.objects.create(
        owner=user,
        title="My art piece",
        prompt="a red rectangle",
        engine=ArtPiece.Engine.CANVAS2D,
    )
    ArtPieceVersion.objects.create(piece=piece, sequence=1, source="<canvas></canvas>")

    client = Client()
    client.force_login(user)
    response = client.get(reverse("account-data-export"))

    body = response.json()
    assert len(body["projects_3d"]) == 1
    assert body["projects_3d"][0]["activity"] == [
        {
            "id": event.pk,
            "action_type": ProjectActivity.ActionType.VERSION_SAVED,
            "label": "Version saved",
            "actor_display": user.username,
            "created_at": event.created_at.isoformat(),
            "details": {"sequence": 1, "origin": "manual"},
        }
    ]
    assert b"private_marker" not in response.content
    assert body["projects_3d"][0]["title"] == "My 3D scene"
    assert len(body["projects_3d"][0]["versions"]) == 1
    assert len(body["art_pieces"]) == 1
    assert body["art_pieces"][0]["title"] == "My art piece"
    assert body["art_pieces"][0]["versions"][0]["source"] == "<canvas></canvas>"


@pytest.mark.django_db
def test_export_includes_subscription_status_without_payment_payload():
    user = _make_user("owner")
    Subscription.objects.create(
        user=user,
        paypal_subscription_id="I-REALSUBID123",
        plan_key="pro",
        status=Subscription.Status.ACTIVE,
    )
    client = Client()
    client.force_login(user)

    response = client.get(reverse("account-data-export"))

    body = response.json()
    assert body["subscription"] == {"status": "active", "plan_key": "pro", "paid_through": None}
    # The PayPal subscription id is not a secret, but it's not part of
    # this export's contract either -- keep the shape exactly bounded.
    assert "paypal_subscription_id" not in body["subscription"]


@pytest.mark.django_db
def test_export_never_includes_another_users_data():
    owner = _make_user("owner")
    other = _make_user("other")
    Project.objects.create(owner=other, title="Someone else's animation")
    ArtPiece.objects.create(
        owner=other, title="Someone else's art", prompt="x", engine=ArtPiece.Engine.CANVAS2D
    )

    client = Client()
    client.force_login(owner)
    response = client.get(reverse("account-data-export"))

    body = response.json()
    assert body["projects"] == []
    assert body["art_pieces"] == []
    assert b"Someone else" not in response.content


@pytest.mark.django_db
def test_export_is_a_safe_idempotent_repeat_request():
    user = _make_user("owner")
    Project.objects.create(owner=user, title="Repeatable fixture")
    client = Client()
    client.force_login(user)

    first = client.get(reverse("account-data-export"))
    second = client.get(reverse("account-data-export"))

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["projects"] == second.json()["projects"]


@pytest.mark.django_db
def test_export_includes_allowlisted_activity_for_soft_deleted_owned_project_only():
    owner = get_user_model().objects.create_user(
        username="activity-owner", email="owner-sentinel@example.test"
    )
    other = get_user_model().objects.create_user(
        username="activity-other", email="other-owner-sentinel@example.test"
    )
    project = Project.objects.create(
        owner=owner, title="Retained activity project", is_deleted=True, deleted_at=timezone.now()
    )
    SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json={"scene-sentinel": "preserved"},
        origin=SceneVersion.Origin.MANUAL,
    )
    foreign_project = Project.objects.create(owner=other, title="Foreign activity sentinel")
    first = ProjectActivity.objects.create(
        project=project,
        actor=owner,
        action_type=ProjectActivity.ActionType.VERSION_SAVED,
        metadata={"sequence": 4, "origin": "manual", "unknown_marker": "must-not-export"},
    )
    second = ProjectActivity.objects.create(
        project=project,
        actor=None,
        action_type=ProjectActivity.ActionType.AI_PROPOSAL_REJECTED,
        metadata={"reason": "owner-rejected-sentinel", "unlisted": "must-not-export"},
    )
    foreign_activity = ProjectActivity.objects.create(
        project=foreign_project,
        actor=other,
        action_type=ProjectActivity.ActionType.VERSION_SAVED,
        metadata={"sequence": 999, "reason": "foreign-activity-sentinel"},
    )
    equal_timestamp = timezone.now() - timedelta(minutes=1)
    ProjectActivity.objects.filter(pk__in=[first.pk, second.pk]).update(created_at=equal_timestamp)

    client = Client()
    client.force_login(owner)
    first_response = client.get(reverse("account-data-export"))
    second_response = client.get(reverse("account-data-export"))

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    body = first_response.json()
    assert second_response.json()["projects"] == body["projects"]
    assert len(body["projects"]) == 1
    exported_project = body["projects"][0]
    assert exported_project["is_deleted"] is True
    assert exported_project["versions"][0]["scene_json"] == {"scene-sentinel": "preserved"}
    assert [item["id"] for item in exported_project["activity"]] == [second.pk, first.pk]
    rejected, saved = exported_project["activity"]
    assert set(rejected) == {"id", "action_type", "label", "actor_display", "created_at", "details"}
    assert rejected["action_type"] == ProjectActivity.ActionType.AI_PROPOSAL_REJECTED
    assert (
        rejected["label"]
        == ProjectActivity(
            action_type=ProjectActivity.ActionType.AI_PROPOSAL_REJECTED
        ).get_action_type_display()
    )
    assert rejected["actor_display"] is None
    assert rejected["details"] == {"reason": "owner-rejected-sentinel"}
    assert saved["action_type"] == ProjectActivity.ActionType.VERSION_SAVED
    assert saved["actor_display"] == owner.username
    assert saved["details"] == {"sequence": 4, "origin": "manual"}
    assert foreign_activity.pk not in {item["id"] for item in exported_project["activity"]}
    assert b"other-owner-sentinel@example.test" not in first_response.content
    assert b"Foreign activity sentinel" not in first_response.content
    assert b"must-not-export" not in first_response.content
