"""Focused protocol coverage for issue #509."""

import hashlib
import uuid

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from scenes.cloud_backup import mark_backup_read_only_for_user
from scenes.models import (
    CloudBackupBlob,
    CloudBackupBlobTransfer,
    CloudBackupProject,
    Plan,
    Project,
    SiteSettings,
)


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
            "feature_keys": ["cloud_project_sync"],
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
    stale = client.put(
        manifest_url,
        {**payload, "idempotency_key": "manifest-stale"},
        content_type="application/json",
    )
    assert stale.status_code == 409

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
def test_owner_can_pause_backup_without_affecting_local_project(client, owner, project):
    client.force_login(owner)
    base = reverse("cloud-backup", args=[project.public_id])
    assert client.post(base, {"action": "enable"}).status_code == 201
    paused = client.post(base, {"action": "pause"})
    assert paused.status_code == 201
    assert paused.json()["paused"] is True
    assert client.get(base).json()["paused"] is True


@pytest.mark.django_db
def test_sync_entitlement_is_fail_closed(owner, project):
    from scenes.cloud_backup import CloudBackupConflict, enable_backup

    Plan.objects.filter(plan_key="free").update(feature_keys=[])
    with pytest.raises(CloudBackupConflict):
        enable_backup(owner, project)


@pytest.mark.django_db
def test_entitlement_loss_turns_future_writes_into_read_only_retention(owner, project):
    from scenes.cloud_backup import (
        CloudBackupReadOnly,
        enable_backup,
        mark_backup_read_only_for_user,
        put_manifest,
    )

    enable_backup(owner, project)
    Plan.objects.filter(plan_key="free").update(feature_keys=[])
    assert mark_backup_read_only_for_user(owner) == 1
    with pytest.raises(CloudBackupReadOnly):
        put_manifest(
            owner,
            project,
            expected_revision=0,
            idempotency_key="lost-entitlement",
            manifest={"project_id": str(project.public_id), "scenes": [{"id": "scene-1"}]},
        )
    assert CloudBackupProject.objects.get(project=project).read_only is True


@pytest.mark.django_db
def test_entitlement_loss_retains_remote_copy_as_read_only(owner, project):
    from scenes.cloud_backup import enable_backup, put_blob

    backup = enable_backup(owner, project)
    blob = b"asset"
    checksum = hashlib.sha256(blob).hexdigest()
    put_blob(
        owner,
        project,
        uuid.uuid4(),
        blob,
        checksum=checksum,
        mime_type="image/png",
        idempotency_key="retained-asset",
    )
    assert mark_backup_read_only_for_user(owner) == 1
    backup.refresh_from_db()
    assert backup.read_only is True
    assert CloudBackupBlob.objects.filter(backup=backup).exists()


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


@pytest.mark.django_db
def test_chunk_upload_resumes_idempotently_and_promotes_after_checksum_match(
    client, owner, project
):
    client.force_login(owner)
    Plan.objects.update_or_create(
        plan_key="free",
        defaults={
            "daily_ai_requests": 5,
            "feature_keys": ["cloud_project_sync"],
            "active": True,
            "cloud_storage_bytes": 100,
            "cloud_storage_files": 2,
        },
    )
    client.post(reverse("cloud-backup", args=[project.public_id]), {"enabled": True})
    payload = b"abcdefgh"
    checksum = hashlib.sha256(payload).hexdigest()
    asset_id = uuid.uuid4()
    url = reverse("cloud-backup-blob-chunk", args=[project.public_id, asset_id])
    headers = {
        "HTTP_X_ASSET_CHECKSUM": checksum,
        "HTTP_X_ASSET_MIME_TYPE": "image/png",
        "HTTP_X_IDEMPOTENCY_KEY": "chunked-asset-1",
    }
    first = client.put(
        url,
        payload[:4],
        content_type="application/octet-stream",
        HTTP_CONTENT_RANGE="bytes 0-3/8",
        **headers,
    )
    assert first.status_code == 200
    assert first.json()["acknowledged_ranges"] == [{"start": 0, "end": 4}]
    replay = client.put(
        url,
        payload[:4],
        content_type="application/octet-stream",
        HTTP_CONTENT_RANGE="bytes 0-3/8",
        **headers,
    )
    assert replay.status_code == 200
    final = client.put(
        url,
        payload[4:],
        content_type="application/octet-stream",
        HTTP_CONTENT_RANGE="bytes 4-7/8",
        **headers,
    )
    assert final.status_code == 200
    assert final.json()["complete"] is True
    assert CloudBackupBlobTransfer.objects.count() == 0
    assert CloudBackupBlob.objects.get(asset_id=asset_id).data == payload


@pytest.mark.django_db
def test_chunk_upload_garbage_collects_invalid_complete_object_on_checksum_failure(
    client, owner, project
):
    client.force_login(owner)
    client.post(reverse("cloud-backup", args=[project.public_id]), {"enabled": True})
    asset_id = uuid.uuid4()
    url = reverse("cloud-backup-blob-chunk", args=[project.public_id, asset_id])
    response = client.put(
        url,
        b"wrong",
        content_type="application/octet-stream",
        HTTP_CONTENT_RANGE="bytes 0-4/5",
        HTTP_X_ASSET_CHECKSUM="0" * 64,
        HTTP_X_IDEMPOTENCY_KEY="bad-chunk",
    )
    assert response.status_code == 409
    assert CloudBackupBlob.objects.count() == 0
    assert not CloudBackupBlobTransfer.objects.filter(asset_id=asset_id).exists()
