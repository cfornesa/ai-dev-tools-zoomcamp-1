"""Focused protocol coverage for issue #509."""

import hashlib
import uuid

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from scenes.models import CloudBackupBlob, CloudBackupProject, Plan, Project, SiteSettings


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="backup-owner", password="pw")


@pytest.fixture
def other(db):
    return get_user_model().objects.create_user(username="backup-other", password="pw")


@pytest.fixture
def project(owner, db):
    return Project.objects.create(owner=owner, title="Local project")


@pytest.fixture(autouse=True)
def backup_policy(db):
    SiteSettings.objects.update_or_create(pk=1, defaults={"cloud_sync_enabled": True})
    Plan.objects.update_or_create(
        plan_key="free",
        defaults={
            "daily_ai_requests": 5,
            "feature_keys": [],
            "active": True,
            "cloud_storage_bytes": 10,
            "cloud_storage_files": 1,
        },
    )


@pytest.mark.django_db
def test_kill_switch_fails_before_creating_backup(client, owner, project):
    client.force_login(owner)
    settings_row = SiteSettings.get_solo()
    settings_row.cloud_sync_enabled = False
    settings_row.save(update_fields=["cloud_sync_enabled"])
    response = client.post(reverse("cloud-backup", args=[project.public_id]), {"enabled": True})
    assert response.status_code == 409
    assert not CloudBackupProject.objects.filter(project=project).exists()


@pytest.mark.django_db
def test_owner_manifest_and_blob_are_idempotent_and_isolated(client, owner, other, project):
    client.force_login(owner)
    base = reverse("cloud-backup", args=[project.public_id])
    assert client.post(base, {"enabled": True}).status_code == 201
    manifest_url = reverse("cloud-backup-manifest", args=[project.public_id])
    manifest = {"project_id": str(project.public_id), "scenes": [{"id": "scene-1"}]}
    payload = {"revision": 0, "idempotency_key": "manifest-1", "manifest": manifest}
    first = client.put(manifest_url, payload, content_type="application/json")
    replay = client.put(manifest_url, payload, content_type="application/json")
    assert first.status_code == replay.status_code == 200
    assert first.json() == replay.json()

    asset_id = uuid.uuid4()
    blob = b"123456"
    checksum = hashlib.sha256(blob).hexdigest()
    blob_url = reverse("cloud-backup-blob", args=[project.public_id, asset_id])
    uploaded = client.put(
        blob_url,
        blob,
        content_type="image/png",
        HTTP_X_ASSET_CHECKSUM=checksum,
        HTTP_X_ASSET_MIME_TYPE="image/png",
        HTTP_X_IDEMPOTENCY_KEY="asset-1",
    )
    assert uploaded.status_code == 200
    assert (
        client.put(
            blob_url,
            blob,
            content_type="image/png",
            HTTP_X_ASSET_CHECKSUM=checksum,
            HTTP_X_ASSET_MIME_TYPE="image/png",
            HTTP_X_IDEMPOTENCY_KEY="asset-1",
        ).status_code
        == 200
    )
    assert CloudBackupBlob.objects.filter(backup__project=project).count() == 1

    client.force_login(other)
    assert client.get(manifest_url).status_code == 404
    assert client.get(blob_url).status_code == 404


@pytest.mark.django_db
def test_blob_checksum_and_quota_fail_without_writing(client, owner, project):
    client.force_login(owner)
    client.post(reverse("cloud-backup", args=[project.public_id]), {"enabled": True})
    blob = b"too-large"
    response = client.put(
        reverse("cloud-backup-blob", args=[project.public_id, uuid.uuid4()]),
        blob,
        content_type="application/octet-stream",
        HTTP_X_ASSET_CHECKSUM="wrong",
        HTTP_X_IDEMPOTENCY_KEY="bad-checksum",
    )
    assert response.status_code == 409
    assert CloudBackupBlob.objects.count() == 0
    blob = b"01234567890"
    checksum = hashlib.sha256(blob).hexdigest()
    response = client.put(
        reverse("cloud-backup-blob", args=[project.public_id, uuid.uuid4()]),
        blob,
        content_type="application/octet-stream",
        HTTP_X_ASSET_CHECKSUM=checksum,
        HTTP_X_IDEMPOTENCY_KEY="too-large",
    )
    assert response.status_code == 413
    assert CloudBackupBlob.objects.count() == 0
