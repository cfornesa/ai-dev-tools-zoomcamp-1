"""Provider-neutral PostgreSQL cloud-backup protocol (#509).

The service is deliberately separate from views: the site kill switch is
checked before touching a backup row, every project decision goes through the
central permission service, and all writes are transactional/idempotent.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from scenes.admin_settings import get_site_settings
from scenes.entitlements import get_effective_cap, get_user_plan_key
from scenes.models import (
    CloudBackupBlob,
    CloudBackupBlobTransfer,
    CloudBackupManifest,
    CloudBackupProject,
    CloudRetentionPolicy,
    Plan,
    Project,
)
from scenes.permissions import Action, require


class CloudBackupError(Exception):
    status_code = 409
    code = "cloud_backup_error"


class CloudBackupDisabled(CloudBackupError):
    code = "cloud_sync_disabled"


class CloudBackupReadOnly(CloudBackupError):
    code = "cloud_backup_read_only"


class CloudBackupPaused(CloudBackupError):
    code = "cloud_backup_paused"


class CloudBackupConflict(CloudBackupError):
    code = "cloud_backup_conflict"


class CloudBackupQuotaExceeded(CloudBackupError):
    status_code = 413
    code = "cloud_backup_quota_exceeded"


class CloudBackupChecksumMismatch(CloudBackupError):
    code = "checksum_mismatch"


def _enabled() -> None:
    if not get_site_settings().cloud_sync_enabled:
        raise CloudBackupDisabled("Cloud sync is disabled by the site administrator.")


def _owned(user, project: Project, action: Action) -> None:
    require(user, action, project)


def _backup(project: Project) -> CloudBackupProject:
    try:
        return CloudBackupProject.objects.get(project=project)
    except CloudBackupProject.DoesNotExist as exc:
        raise CloudBackupConflict("This project has not opted into cloud backup.") from exc


def _require_writable(backup: CloudBackupProject, user) -> None:
    if backup.read_only:
        raise CloudBackupReadOnly("This backup is retained read-only.")
    if backup.paused:
        raise CloudBackupPaused("This backup is paused; local project editing remains available.")
    if get_effective_cap(user, "cloud_project_sync") <= 0:
        policy = CloudRetentionPolicy.objects.select_for_update().get(pk=1)
        backup.retention_state = CloudBackupProject.RetentionState.ENTITLEMENT_EXPIRED
        backup.retain_until = timezone.now() + timedelta(days=policy.entitlement_grace_days)
        backup.read_only = True
        backup.save(update_fields=["read_only", "retention_state", "retain_until", "updated_at"])
        raise CloudBackupReadOnly("Sync eligibility ended; the remote copy is retained read-only.")


def _user_plan(user) -> Plan | None:
    plan = Plan.objects.filter(plan_key=get_user_plan_key(user), active=True).first()
    if plan is None:
        plan = Plan.objects.filter(plan_key="free", active=True).first()
    return plan


def _plan_quota(user) -> tuple[int, int]:
    plan = _user_plan(user)
    if plan is None:
        return 0, 0
    return plan.cloud_storage_bytes, plan.cloud_storage_files


def _snapshot_policy(user) -> tuple[int, bool]:
    """`(cadence_days, archive_enabled)` for the owner's current plan
    (issue #529/#530). Fails closed to a conservative 7-day, no-archive
    default if no plan can be resolved at all."""
    plan = _user_plan(user)
    if plan is None:
        return 7, False
    return plan.cloud_snapshot_cadence_days, plan.cloud_snapshot_archive_enabled


def _trim_to_latest_snapshot(backup: CloudBackupProject, latest: CloudBackupManifest) -> None:
    """Issue #530: for a plan without archive retention, keep only the
    single latest manifest revision and the blobs it still references --
    older revisions and now-orphaned assets are deleted. Never touches a
    read-only/retained backup's existing data outside of a fresh write,
    and only ever runs as part of the same atomic `put_manifest` write
    that produced `latest`.
    """
    referenced_asset_ids: set[uuid.UUID] = set()
    for item in latest.manifest.get("assets", []):
        if not isinstance(item, dict):
            continue
        try:
            referenced_asset_ids.add(uuid.UUID(str(item.get("id"))))
        except (ValueError, AttributeError, TypeError):
            continue
    CloudBackupManifest.objects.filter(backup=backup).exclude(pk=latest.pk).delete()
    backup.blobs.exclude(asset_id__in=referenced_asset_ids).delete()


def _validate_manifest(project: Project, manifest: dict) -> None:
    """Require the stable identity/checksum shape used by the sync protocol."""
    if manifest.get("project_id") != str(project.public_id):
        raise CloudBackupConflict("The manifest project_id does not match the project.")
    scenes = manifest.get("scenes")
    assets = manifest.get("assets", [])
    if not isinstance(scenes, list) or not scenes:
        raise CloudBackupConflict("The manifest must contain a non-empty scenes list.")
    if not isinstance(assets, list):
        raise CloudBackupConflict("The manifest assets field must be a list.")
    scene_ids = [item.get("id") if isinstance(item, dict) else None for item in scenes]
    if any(not isinstance(value, str) or not value for value in scene_ids):
        raise CloudBackupConflict("Every scene must have a stable id.")
    if len(set(scene_ids)) != len(scene_ids):
        raise CloudBackupConflict("Scene ids must be unique within a manifest.")
    asset_ids = []
    for item in assets:
        if not isinstance(item, dict):
            raise CloudBackupConflict("Every asset must be an object.")
        asset_id = item.get("id")
        if not isinstance(asset_id, str) or not asset_id:
            raise CloudBackupConflict("Every asset must have a stable id.")
        if not isinstance(item.get("checksum"), str) or not item["checksum"]:
            raise CloudBackupConflict("Every asset must include a checksum.")
        if not isinstance(item.get("byte_size"), int) or item["byte_size"] < 0:
            raise CloudBackupConflict("Every asset must include a non-negative byte_size.")
        asset_ids.append(asset_id)
    if len(set(asset_ids)) != len(asset_ids):
        raise CloudBackupConflict("Asset ids must be unique within a manifest.")


@transaction.atomic
def enable_backup(user, project: Project) -> CloudBackupProject:
    _enabled()
    _owned(user, project, Action.CLOUD_BACKUP_WRITE)
    if get_effective_cap(user, "cloud_project_sync") <= 0:
        raise CloudBackupConflict("This account is not eligible for project cloud sync.")
    backup, _ = CloudBackupProject.objects.select_for_update().get_or_create(project=project)
    if backup.read_only:
        raise CloudBackupReadOnly("This backup is retained read-only.")
    backup.enabled = True
    backup.paused = False
    backup.retention_state = CloudBackupProject.RetentionState.ACTIVE
    backup.retain_until = None
    backup.save(
        update_fields=["enabled", "paused", "retention_state", "retain_until", "updated_at"]
    )
    return backup


@transaction.atomic
def pause_backup(user, project: Project) -> CloudBackupProject:
    _enabled()
    _owned(user, project, Action.CLOUD_BACKUP_WRITE)
    backup = _backup(project)
    backup.paused = True
    policy = CloudRetentionPolicy.objects.select_for_update().get(pk=1)
    backup.retention_state = CloudBackupProject.RetentionState.SYNC_DISABLED
    backup.retain_until = timezone.now() + timedelta(days=policy.disabled_sync_grace_days)
    backup.save(update_fields=["paused", "retention_state", "retain_until", "updated_at"])
    return backup


def get_backup(user, project: Project) -> CloudBackupProject:
    _enabled()
    _owned(user, project, Action.CLOUD_BACKUP_READ)
    return _backup(project)


@transaction.atomic
def put_manifest(
    user, project: Project, *, expected_revision: int, idempotency_key: str, manifest: dict
) -> CloudBackupManifest:
    _enabled()
    _owned(user, project, Action.CLOUD_BACKUP_WRITE)
    backup = CloudBackupProject.objects.select_for_update().get(project=project)
    if not backup.enabled:
        raise CloudBackupConflict("Enable backup before uploading a manifest.")
    _require_writable(backup, user)
    if not idempotency_key or len(idempotency_key) > 128:
        raise CloudBackupConflict("A bounded idempotency key is required.")
    prior = CloudBackupManifest.objects.filter(
        backup=backup, idempotency_key=idempotency_key
    ).first()
    if prior is not None:
        return prior
    if expected_revision != backup.revision:
        raise CloudBackupConflict("The manifest revision is stale.")
    if not isinstance(manifest, dict):
        raise CloudBackupConflict("The manifest must be a JSON object.")
    _validate_manifest(project, manifest)
    encoded = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
    row = CloudBackupManifest.objects.create(
        backup=backup,
        revision=backup.revision + 1,
        idempotency_key=idempotency_key,
        checksum=hashlib.sha256(encoded).hexdigest(),
        manifest=manifest,
    )
    backup.revision = row.revision
    backup.save(update_fields=["revision", "updated_at"])
    _, archive_enabled = _snapshot_policy(user)
    if not archive_enabled:
        _trim_to_latest_snapshot(backup, row)
    return row


def latest_manifest(user, project: Project) -> CloudBackupManifest | None:
    backup = get_backup(user, project)
    return backup.manifests.order_by("-revision").first()


def snapshot_schedule(user, project: Project) -> dict:
    """Issue #530: the plan-resolved cadence/archive policy plus the
    timestamp of the most recent successful manifest write, so a client
    can decide for itself whether a silent scheduled snapshot is due.
    Never triggers a snapshot itself -- purely informational."""
    cadence_days, archive_enabled = _snapshot_policy(user)
    latest = latest_manifest(user, project)
    return {
        "snapshot_cadence_days": cadence_days,
        "snapshot_archive_enabled": archive_enabled,
        "last_snapshot_at": latest.created_at.isoformat() if latest is not None else None,
    }


@transaction.atomic
def put_blob(
    user,
    project: Project,
    asset_id: uuid.UUID,
    data: bytes,
    *,
    checksum: str,
    mime_type: str,
    idempotency_key: str,
) -> CloudBackupBlob:
    _enabled()
    _owned(user, project, Action.CLOUD_BACKUP_WRITE)
    backup = CloudBackupProject.objects.select_for_update().get(project=project)
    if not backup.enabled:
        raise CloudBackupConflict("Enable backup before uploading an asset.")
    _require_writable(backup, user)
    actual = hashlib.sha256(data).hexdigest()
    if checksum != actual:
        raise CloudBackupChecksumMismatch("The supplied checksum does not match the asset.")
    prior_key = CloudBackupBlob.objects.filter(
        backup=backup, idempotency_key=idempotency_key
    ).first()
    if prior_key is not None:
        if prior_key.checksum != checksum:
            raise CloudBackupChecksumMismatch("The idempotency key was reused for another asset.")
        return prior_key
    prior_asset = CloudBackupBlob.objects.filter(backup=backup, asset_id=asset_id).first()
    if prior_asset is not None:
        if prior_asset.checksum != checksum:
            raise CloudBackupChecksumMismatch("The asset ID already has another checksum.")
        return prior_asset
    max_bytes, max_files = _plan_quota(user)
    used_bytes = sum(backup.blobs.values_list("byte_size", flat=True))
    used_files = backup.blobs.count()
    if used_bytes + len(data) > max_bytes:
        raise CloudBackupQuotaExceeded("The configured cloud byte quota was exceeded.")
    if used_files + 1 > max_files:
        raise CloudBackupQuotaExceeded("The configured cloud file quota was exceeded.")
    return CloudBackupBlob.objects.create(
        backup=backup,
        asset_id=asset_id,
        checksum=checksum,
        mime_type=mime_type[:128],
        byte_size=len(data),
        data=data,
        idempotency_key=idempotency_key,
    )


def _merge_ranges(ranges: list[dict[str, int]]) -> list[dict[str, int]]:
    ordered = sorted(ranges, key=lambda item: (item["start"], item["end"]))
    merged: list[dict[str, int]] = []
    for current in ordered:
        previous = merged[-1] if merged else None
        if previous is not None and current["start"] <= previous["end"]:
            previous["end"] = max(previous["end"], current["end"])
        else:
            merged.append({"start": current["start"], "end": current["end"]})
    return merged


def _ranges_cover(ranges: list[dict[str, int]], byte_length: int) -> bool:
    return len(ranges) == 1 and ranges[0] == {"start": 0, "end": byte_length}


@transaction.atomic
def put_blob_chunk(
    user,
    project: Project,
    asset_id: uuid.UUID,
    data: bytes,
    *,
    start: int,
    end: int,
    byte_length: int,
    checksum: str,
    mime_type: str,
    idempotency_key: str,
) -> dict[str, object]:
    """Store one idempotent byte range and promote it atomically when complete."""
    _enabled()
    _owned(user, project, Action.CLOUD_BACKUP_WRITE)
    if start < 0 or end <= start or end > byte_length or len(data) != end - start:
        raise ValueError("The byte range does not match the supplied chunk.")
    backup = CloudBackupProject.objects.select_for_update().get(project=project)
    if not backup.enabled:
        raise CloudBackupConflict("Enable backup before uploading an asset.")
    _require_writable(backup, user)
    existing = CloudBackupBlob.objects.filter(backup=backup, asset_id=asset_id).first()
    if existing is not None:
        if existing.checksum != checksum or existing.byte_size != byte_length:
            raise CloudBackupChecksumMismatch("The asset ID already has another checksum.")
        return {
            "asset_id": str(asset_id),
            "checksum": existing.checksum,
            "byte_size": existing.byte_size,
            "complete": True,
            "acknowledged_ranges": [{"start": 0, "end": byte_length}],
        }
    max_bytes, max_files = _plan_quota(user)
    used_bytes = sum(backup.blobs.values_list("byte_size", flat=True))
    if used_bytes + byte_length > max_bytes:
        raise CloudBackupQuotaExceeded("The configured cloud byte quota was exceeded.")
    transfer, created = CloudBackupBlobTransfer.objects.select_for_update().get_or_create(
        backup=backup,
        asset_id=asset_id,
        defaults={
            "checksum": checksum,
            "mime_type": mime_type[:128],
            "byte_length": byte_length,
            "data": b"\x00" * byte_length,
            "idempotency_key": idempotency_key,
        },
    )
    if not created and (
        transfer.checksum != checksum
        or transfer.byte_length != byte_length
        or transfer.idempotency_key != idempotency_key
    ):
        raise CloudBackupChecksumMismatch("The asset transfer identity was reused incorrectly.")
    if created and used_bytes + 1 > max_files:
        raise CloudBackupQuotaExceeded("The configured cloud file quota was exceeded.")
    merged_data = bytearray(transfer.data)
    merged_data[start:end] = data
    ranges = _merge_ranges([*transfer.acknowledged_ranges, {"start": start, "end": end}])
    transfer.data = bytes(merged_data)
    transfer.acknowledged_ranges = ranges
    transfer.save(update_fields=["data", "acknowledged_ranges", "updated_at"])
    if not _ranges_cover(ranges, byte_length):
        return {
            "asset_id": str(asset_id),
            "checksum": checksum,
            "byte_size": byte_length,
            "complete": False,
            "acknowledged_ranges": ranges,
        }
    actual = hashlib.sha256(bytes(merged_data)).hexdigest()
    if actual != checksum:
        raise CloudBackupChecksumMismatch("The completed transfer checksum does not match.")
    if CloudBackupBlob.objects.filter(backup=backup).count() + 1 > max_files:
        raise CloudBackupQuotaExceeded("The configured cloud file quota was exceeded.")
    blob = CloudBackupBlob.objects.create(
        backup=backup,
        asset_id=asset_id,
        checksum=checksum,
        mime_type=transfer.mime_type,
        byte_size=byte_length,
        data=bytes(merged_data),
        idempotency_key=idempotency_key,
    )
    transfer.delete()
    return {
        "asset_id": str(blob.asset_id),
        "checksum": blob.checksum,
        "byte_size": blob.byte_size,
        "complete": True,
        "acknowledged_ranges": [{"start": 0, "end": byte_length}],
    }


def get_blob(user, project: Project, asset_id: uuid.UUID) -> CloudBackupBlob:
    backup = get_backup(user, project)
    try:
        return backup.blobs.get(asset_id=asset_id)
    except CloudBackupBlob.DoesNotExist as exc:
        raise CloudBackupConflict("The requested asset is not backed up.") from exc


@transaction.atomic
def mark_backup_read_only_for_user(user) -> int:
    """Retain a user's remote copies as read-only after entitlement loss."""
    policy = CloudRetentionPolicy.objects.get(pk=1)
    deadline = timezone.now() + timedelta(days=policy.entitlement_grace_days)
    return CloudBackupProject.objects.filter(project__owner=user, enabled=True).update(
        read_only=True,
        retention_state=CloudBackupProject.RetentionState.ENTITLEMENT_EXPIRED,
        retain_until=deadline,
    )
