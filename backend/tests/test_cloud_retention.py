"""Admin policy and remote-copy lifecycle coverage for issue #522."""

import uuid
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from scenes.cloud_backup import mark_backup_read_only_for_user
from scenes.models import (
    AdminContentAuditEvent,
    ApplicationAdmin,
    CloudBackupBlob,
    CloudBackupManifest,
    CloudBackupProject,
    CloudRetentionPolicy,
    Project,
    SiteSettings,
)

pytestmark = pytest.mark.django_db


def _user(username):
    return get_user_model().objects.create_user(username=username, password="test-password")


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_retention_admin_api_is_admin_only():
    anonymous = APIClient()
    ordinary = _user("ordinary-retention")
    admin = _user("retention-admin")
    ApplicationAdmin.objects.create(user=admin)
    url = reverse("admin-cloud-retention")
    assert anonymous.get(url).status_code == 401
    assert _client(ordinary).get(url).status_code == 403
    response = _client(admin).get(url)
    assert response.status_code == 200
    assert response.json()["deleted_grace_days"] == 30


def test_policy_update_is_revision_checked_and_atomic():
    admin = _user("retention-admin-update")
    ApplicationAdmin.objects.create(user=admin)
    client = _client(admin)
    url = reverse("admin-cloud-retention")
    current = client.get(url).json()
    updated = client.patch(
        url,
        {
            **current,
            "deleted_grace_days": 45,
            "entitlement_grace_days": 60,
            "disabled_sync_grace_days": 15,
        },
        format="json",
    )
    assert updated.status_code == 200
    assert updated.json()["deleted_grace_days"] == 45
    stale = client.patch(
        url,
        {**current, "deleted_grace_days": 1},
        format="json",
    )
    assert stale.status_code == 409
    policy = CloudRetentionPolicy.objects.get(pk=1)
    assert (policy.deleted_grace_days, policy.entitlement_grace_days) == (45, 60)
    assert (
        AdminContentAuditEvent.objects.filter(resource_type="cloud_retention_policy").count() == 1
    )


def test_pause_and_entitlement_loss_record_bounded_retention_state():
    owner = _user("retention-owner")
    project = Project.objects.create(owner=owner, title="Local work")
    backup = CloudBackupProject.objects.create(project=project, enabled=True)
    SiteSettings.objects.update_or_create(pk=1, defaults={"cloud_sync_enabled": True})
    from scenes.cloud_backup import pause_backup

    paused = pause_backup(owner, project)
    assert paused.retention_state == CloudBackupProject.RetentionState.SYNC_DISABLED
    assert paused.retain_until is not None
    assert paused.retain_until > timezone.now()
    assert mark_backup_read_only_for_user(owner) == 1
    backup.refresh_from_db()
    assert backup.retention_state == CloudBackupProject.RetentionState.ENTITLEMENT_EXPIRED
    assert backup.read_only is True
    assert backup.retain_until > timezone.now()


def test_purge_requires_confirmation_is_bounded_idempotent_and_preserves_local_work():
    owner = _user("retention-purge-owner")
    admin = _user("retention-purge-admin")
    ApplicationAdmin.objects.create(user=admin)
    SiteSettings.objects.update_or_create(pk=1, defaults={"cloud_sync_enabled": True})
    project = Project.objects.create(owner=owner, title="Keep local work")
    active_project = Project.objects.create(owner=owner, title="Keep active remote work")
    active_backup = CloudBackupProject.objects.create(project=active_project, enabled=True)
    backup = CloudBackupProject.objects.create(
        project=project,
        enabled=True,
        retention_state=CloudBackupProject.RetentionState.DELETED,
        retain_until=timezone.now() - timedelta(days=1),
    )
    asset_id = uuid.uuid4()
    CloudBackupBlob.objects.create(
        backup=backup,
        asset_id=asset_id,
        checksum="a" * 64,
        mime_type="image/png",
        byte_size=1,
        data=b"x",
        idempotency_key="retention-asset",
    )
    CloudBackupManifest.objects.create(
        backup=backup,
        revision=1,
        idempotency_key="retention-manifest",
        checksum="b" * 64,
        manifest={"project_id": str(project.public_id), "scenes": [{"id": "scene-1"}]},
    )
    client = _client(admin)
    purge_url = reverse("admin-cloud-retention-purge")
    assert client.post(purge_url, {"limit": 1}, format="json").status_code == 409
    confirmed = client.post(purge_url, {"limit": 1, "confirm_retroactive": True}, format="json")
    assert confirmed.status_code == 200
    assert confirmed.json()["purged_backups"] == 1
    assert not CloudBackupProject.objects.filter(pk=backup.pk).exists()
    assert CloudBackupProject.objects.filter(pk=active_backup.pk, retention_state="active").exists()
    assert Project.all_objects.filter(pk=project.pk, is_deleted=False).exists()
    repeated = client.post(purge_url, {"limit": 1, "confirm_retroactive": True}, format="json")
    assert repeated.status_code == 200
    assert repeated.json()["purged_backups"] == 0
