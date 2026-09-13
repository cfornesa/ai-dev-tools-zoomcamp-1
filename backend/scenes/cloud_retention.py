"""Admin-owned lifecycle policy and bounded purge for cloud backup copies (#522)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone

from scenes.admin_settings import get_site_settings
from scenes.models import AdminContentAuditEvent, CloudBackupProject, CloudRetentionPolicy

MAX_PURGE_LIMIT = 100
RETENTION_STATES = frozenset(
    {
        CloudBackupProject.RetentionState.DELETED,
        CloudBackupProject.RetentionState.ENTITLEMENT_EXPIRED,
        CloudBackupProject.RetentionState.SYNC_DISABLED,
    }
)


class CloudRetentionValidationFailed(Exception):
    pass


class CloudRetentionConflict(Exception):
    pass


class CloudRetentionConfirmationRequired(CloudRetentionConflict):
    pass


@dataclass(frozen=True)
class CloudRetentionPolicyView:
    deleted_grace_days: int
    entitlement_grace_days: int
    disabled_sync_grace_days: int
    revision: int
    updated_at: str


def _policy_view(policy: CloudRetentionPolicy) -> CloudRetentionPolicyView:
    return CloudRetentionPolicyView(
        deleted_grace_days=policy.deleted_grace_days,
        entitlement_grace_days=policy.entitlement_grace_days,
        disabled_sync_grace_days=policy.disabled_sync_grace_days,
        revision=policy.revision,
        updated_at=policy.updated_at.isoformat(),
    )


def get_policy() -> CloudRetentionPolicyView:
    return _policy_view(CloudRetentionPolicy.get_solo())


def _days_for_state(policy: CloudRetentionPolicy, state: str) -> int | None:
    if state == CloudBackupProject.RetentionState.DELETED:
        return policy.deleted_grace_days
    if state == CloudBackupProject.RetentionState.ENTITLEMENT_EXPIRED:
        return policy.entitlement_grace_days
    if state == CloudBackupProject.RetentionState.SYNC_DISABLED:
        return policy.disabled_sync_grace_days
    return None


def _deadline(policy: CloudRetentionPolicy, state: str, now: datetime) -> datetime | None:
    days = _days_for_state(policy, state)
    return None if days is None else now + timedelta(days=days)


def _validate_days(value: object, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 3650:
        raise CloudRetentionValidationFailed(f"{field} must be an integer from 0 through 3650.")
    return value


@transaction.atomic
def update_policy(
    *,
    actor,
    expected_revision: int,
    deleted_grace_days: int,
    entitlement_grace_days: int,
    disabled_sync_grace_days: int,
) -> CloudRetentionPolicyView:
    values = {
        "deleted_grace_days": _validate_days(deleted_grace_days, "deleted_grace_days"),
        "entitlement_grace_days": _validate_days(entitlement_grace_days, "entitlement_grace_days"),
        "disabled_sync_grace_days": _validate_days(
            disabled_sync_grace_days, "disabled_sync_grace_days"
        ),
    }
    if isinstance(expected_revision, bool) or not isinstance(expected_revision, int):
        raise CloudRetentionValidationFailed("revision must be an integer.")
    policy = CloudRetentionPolicy.objects.select_for_update().get(pk=1)
    if policy.revision != expected_revision:
        raise CloudRetentionConflict("The retention policy has changed; reload before saving.")
    for field, value in values.items():
        setattr(policy, field, value)
    policy.revision += 1
    policy.updated_by = actor
    policy.save()
    AdminContentAuditEvent.objects.create(
        resource_type="cloud_retention_policy",
        resource_id="1",
        actor=actor,
        action="policy_updated",
        detail=(
            f"deleted={policy.deleted_grace_days};"
            f"entitlement={policy.entitlement_grace_days};"
            f"disabled_sync={policy.disabled_sync_grace_days}"
        ),
    )
    return _policy_view(policy)


@transaction.atomic
def mark_backup_state(backup: CloudBackupProject, state: str, *, now=None) -> None:
    if state not in RETENTION_STATES:
        raise CloudRetentionValidationFailed("Unsupported cloud retention state.")
    now = now or timezone.now()
    policy = CloudRetentionPolicy.objects.select_for_update().get(pk=1)
    backup.retention_state = state
    backup.retain_until = _deadline(policy, state, now)
    backup.save(update_fields=["retention_state", "retain_until", "updated_at"])


def _synchronize_states(policy: CloudRetentionPolicy, now) -> None:
    site_sync_enabled = get_site_settings().cloud_sync_enabled
    active_backups = (
        CloudBackupProject.objects.select_for_update()
        .select_related("project")
        .filter(enabled=True, retention_state=CloudBackupProject.RetentionState.ACTIVE)
    )
    for backup in active_backups:
        if backup.project.is_deleted:
            state = CloudBackupProject.RetentionState.DELETED
        elif backup.paused or not site_sync_enabled:
            state = CloudBackupProject.RetentionState.SYNC_DISABLED
        else:
            continue
        backup.retention_state = state
        backup.retain_until = _deadline(policy, state, now)
        backup.save(update_fields=["retention_state", "retain_until", "updated_at"])


@transaction.atomic
def purge_expired(*, actor, limit: int, confirm_retroactive: bool) -> dict[str, int]:
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= MAX_PURGE_LIMIT:
        raise CloudRetentionValidationFailed("limit must be an integer from 1 through 100.")
    policy = CloudRetentionPolicy.objects.select_for_update().get(pk=1)
    now = timezone.now()
    _synchronize_states(policy, now)
    candidates = list(
        CloudBackupProject.objects.select_for_update()
        .select_related("project")
        .filter(retention_state__in=RETENTION_STATES, retain_until__lte=now)
        .order_by("retain_until", "id")[:limit]
    )
    if candidates and not confirm_retroactive:
        raise CloudRetentionConfirmationRequired(
            "This purge may delete existing remote copies; confirm_retroactive=true is required."
        )
    purged_backups = 0
    purged_blobs = 0
    purged_manifests = 0
    for backup in candidates:
        purged_blobs += backup.blobs.count()
        purged_manifests += backup.manifests.count()
        AdminContentAuditEvent.objects.create(
            resource_type="cloud_backup",
            resource_id=str(backup.project.public_id),
            actor=actor,
            action="remote_copy_purged",
            detail=f"state={backup.retention_state};policy_revision={policy.revision}",
        )
        backup.delete()
        purged_backups += 1
    return {
        "scanned": len(candidates),
        "purged_backups": purged_backups,
        "purged_blobs": purged_blobs,
        "purged_manifests": purged_manifests,
        "retained": 0,
    }
