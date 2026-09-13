import json
import uuid
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from scenes.models import (
    AdminContentAuditEvent,
    ApplicationAdmin,
    ArtPiece,
    Project,
    Project3D,
    Scene,
    SceneVersion,
)

pytestmark = pytest.mark.django_db


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _user(username):
    return get_user_model().objects.create_user(username=username, password="test-password")


def test_admin_content_is_denied_to_anonymous_and_non_admin():
    assert APIClient().get(reverse("admin-content-list")).status_code == 401
    assert _client(_user("ordinary")).get(reverse("admin-content-list")).status_code == 403


def test_admin_lists_resource_families_without_private_content():
    owner = _user("owner")
    admin = _user("admin")
    ApplicationAdmin.objects.create(user=admin)
    project = Project.objects.create(owner=owner, title="2D work", description="A 2D project.")
    Project3D.objects.create(owner=owner, title="3D work")
    ArtPiece.objects.create(
        owner=owner,
        title="Generated work",
        prompt="private prompt",
        engine=ArtPiece.Engine.SVG,
    )

    response = _client(admin).get(reverse("admin-content-list"))

    assert response.status_code == 200
    rows = response.json()
    assert {row["resource_type"] for row in rows} == {"project", "project3d", "art_piece"}
    assert {row["title"] for row in rows} == {"2D work", "3D work", "Generated work"}
    assert all("prompt" not in row for row in rows)
    assert str(project.public_id) in {row["resource_id"] for row in rows}


def test_admin_actions_publish_unpublish_delete_restore_and_audit():
    owner = _user("owner")
    admin = _user("admin")
    ApplicationAdmin.objects.create(user=admin)
    project = Project.objects.create(owner=owner, title="2D work", description="A 2D project.")
    client = _client(admin)
    url = reverse("admin-content-action")

    blocked_publish = client.post(
        url,
        {"resource_type": "project", "resource_id": str(project.public_id), "action": "publish"},
        format="json",
    )
    assert blocked_publish.status_code == 400
    project.refresh_from_db()
    assert project.visibility == Project.Visibility.PRIVATE

    scene_json = json.loads(
        (
            Path(__file__).resolve().parent.parent.parent
            / "schema"
            / "fixtures"
            / "valid"
            / "blank.json"
        ).read_text()
    )
    scene = Scene.objects.create(project=project, name="Scene", position=0)
    version = SceneVersion.objects.create(
        project=project,
        scene=scene,
        sequence=1,
        scene_json=scene_json,
        origin=SceneVersion.Origin.MANUAL,
    )
    scene.current_version = version
    scene.save(update_fields=["current_version"])
    project.current_version = version
    project.active_scene = scene
    project.save(update_fields=["current_version", "active_scene"])

    publish = client.post(
        url,
        {"resource_type": "project", "resource_id": str(project.public_id), "action": "publish"},
        format="json",
    )
    assert publish.status_code == 200
    project.refresh_from_db()
    assert project.visibility == Project.Visibility.PUBLIC
    assert project.published_at is not None

    unpublish = client.post(
        url,
        {
            "resource_type": "project",
            "resource_id": str(project.public_id),
            "action": "unpublish",
        },
        format="json",
    )
    assert unpublish.status_code == 200
    project.refresh_from_db()
    assert project.visibility == Project.Visibility.PRIVATE

    delete = client.post(
        url,
        {"resource_type": "project", "resource_id": str(project.public_id), "action": "delete"},
        format="json",
    )
    assert delete.status_code == 200
    project.refresh_from_db()
    assert project.is_deleted is True
    assert client.get(reverse("admin-content-list")).json()[0]["deleted"] is True

    restore = client.post(
        url,
        {
            "resource_type": "project",
            "resource_id": str(project.public_id),
            "action": "restore",
        },
        format="json",
    )
    assert restore.status_code == 200
    project.refresh_from_db()
    assert project.is_deleted is False
    assert AdminContentAuditEvent.objects.filter(resource_id=str(project.public_id)).count() == 4


def test_admin_access_grant_and_revoke_are_atomic_and_audited():
    admin = _user("admin")
    target = _user("target")
    ApplicationAdmin.objects.create(user=admin)
    client = _client(admin)
    url = reverse("admin-content-access")

    granted = client.post(url, {"username": target.username, "granted": True}, format="json")
    assert granted.status_code == 200
    assert ApplicationAdmin.objects.filter(user=target).exists()
    revoked = client.post(url, {"username": target.username, "granted": False}, format="json")
    assert revoked.status_code == 200
    assert not ApplicationAdmin.objects.filter(user=target).exists()
    assert AdminContentAuditEvent.objects.filter(resource_type="application_admin").count() == 2


def test_admin_rejects_invalid_or_missing_content_without_mutation():
    admin = _user("admin")
    ApplicationAdmin.objects.create(user=admin)
    client = _client(admin)
    url = reverse("admin-content-action")

    assert (
        client.post(url, {"resource_type": "media", "action": "delete"}, format="json").status_code
        == 400
    )
    assert (
        client.post(
            url,
            {"resource_type": "project", "resource_id": str(uuid.uuid4()), "action": "delete"},
            format="json",
        ).status_code
        == 409
    )
