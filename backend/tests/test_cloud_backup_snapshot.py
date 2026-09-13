"""Tests for the scheduled cloud-backup snapshot cadence/archive policy
(issues #529/#530): `scenes.cloud_backup.snapshot_schedule` (what a client
reads to decide whether a silent snapshot is due) and the free-tier
trim-to-latest-snapshot behavior inside `put_manifest`.
"""

import hashlib
import uuid

import pytest
from django.contrib.auth import get_user_model

from scenes.cloud_backup import enable_backup, put_blob, put_manifest, snapshot_schedule
from scenes.models import CloudBackupBlob, CloudBackupManifest, Plan, Project, SiteSettings


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="snapshot-owner", password="pw")


@pytest.fixture
def project(owner, db):
    return Project.objects.create(owner=owner, title="Snapshot project")


@pytest.fixture(autouse=True)
def site_enabled(db):
    SiteSettings.objects.update_or_create(pk=1, defaults={"cloud_sync_enabled": True})


def _free_plan(**overrides):
    defaults = {
        "daily_ai_requests": 5,
        "feature_keys": ["cloud_project_sync"],
        "active": True,
        "cloud_storage_bytes": 10_000,
        "cloud_storage_files": 10,
        "cloud_snapshot_cadence_days": 7,
        "cloud_snapshot_archive_enabled": False,
    }
    defaults.update(overrides)
    Plan.objects.update_or_create(plan_key="free", defaults=defaults)


def _manifest(project, *asset_ids: uuid.UUID) -> dict:
    return {
        "project_id": str(project.public_id),
        "scenes": [{"id": "scene-1"}],
        "assets": [
            {"id": str(asset_id), "checksum": "x" * 64, "byte_size": 1} for asset_id in asset_ids
        ],
    }


def _put_blob(owner, project, asset_id, payload: bytes, key: str):
    return put_blob(
        owner,
        project,
        asset_id,
        payload,
        checksum=hashlib.sha256(payload).hexdigest(),
        mime_type="application/octet-stream",
        idempotency_key=key,
    )


@pytest.mark.django_db
def test_snapshot_schedule_reports_plan_cadence_and_no_snapshot_yet(owner, project):
    _free_plan()
    enable_backup(owner, project)

    schedule = snapshot_schedule(owner, project)

    assert schedule["snapshot_cadence_days"] == 7
    assert schedule["snapshot_archive_enabled"] is False
    assert schedule["last_snapshot_at"] is None


@pytest.mark.django_db
def test_snapshot_schedule_reports_last_snapshot_at_after_a_write(owner, project):
    _free_plan()
    enable_backup(owner, project)

    row = put_manifest(
        owner,
        project,
        expected_revision=0,
        idempotency_key="first",
        manifest=_manifest(project),
    )

    schedule = snapshot_schedule(owner, project)
    assert schedule["last_snapshot_at"] == row.created_at.isoformat()


@pytest.mark.django_db
def test_free_plan_trims_prior_manifest_revisions_and_orphaned_blobs(owner, project):
    _free_plan()
    enable_backup(owner, project)
    asset_a, asset_b = uuid.uuid4(), uuid.uuid4()
    _put_blob(owner, project, asset_a, b"asset-a-bytes", "blob-a")

    put_manifest(
        owner,
        project,
        expected_revision=0,
        idempotency_key="snapshot-1",
        manifest=_manifest(project, asset_a),
    )
    assert CloudBackupManifest.objects.filter(backup__project=project).count() == 1
    assert CloudBackupBlob.objects.filter(backup__project=project).count() == 1

    # A second snapshot references a *different* asset -- asset_a is now
    # orphaned and must be trimmed along with the first manifest revision.
    _put_blob(owner, project, asset_b, b"asset-b-bytes", "blob-b")
    put_manifest(
        owner,
        project,
        expected_revision=1,
        idempotency_key="snapshot-2",
        manifest=_manifest(project, asset_b),
    )

    manifests = CloudBackupManifest.objects.filter(backup__project=project)
    assert manifests.count() == 1
    assert manifests.first().idempotency_key == "snapshot-2"
    blobs = CloudBackupBlob.objects.filter(backup__project=project)
    assert blobs.count() == 1
    assert blobs.first().asset_id == asset_b


@pytest.mark.django_db
def test_paid_plan_with_archive_enabled_keeps_full_history(owner, project):
    _free_plan(cloud_snapshot_archive_enabled=True, cloud_snapshot_cadence_days=1)
    enable_backup(owner, project)
    asset_a, asset_b = uuid.uuid4(), uuid.uuid4()
    _put_blob(owner, project, asset_a, b"asset-a-bytes", "archive-blob-a")

    put_manifest(
        owner,
        project,
        expected_revision=0,
        idempotency_key="archive-snapshot-1",
        manifest=_manifest(project, asset_a),
    )
    _put_blob(owner, project, asset_b, b"asset-b-bytes", "archive-blob-b")
    put_manifest(
        owner,
        project,
        expected_revision=1,
        idempotency_key="archive-snapshot-2",
        manifest=_manifest(project, asset_b),
    )

    assert CloudBackupManifest.objects.filter(backup__project=project).count() == 2
    assert CloudBackupBlob.objects.filter(backup__project=project).count() == 2

    schedule = snapshot_schedule(owner, project)
    assert schedule["snapshot_cadence_days"] == 1
    assert schedule["snapshot_archive_enabled"] is True


@pytest.mark.django_db
def test_snapshot_schedule_fails_closed_without_a_resolvable_plan(owner, project):
    _free_plan()
    enable_backup(owner, project)
    Plan.objects.filter(plan_key="free").delete()

    schedule = snapshot_schedule(owner, project)

    assert schedule["snapshot_cadence_days"] == 7
    assert schedule["snapshot_archive_enabled"] is False
