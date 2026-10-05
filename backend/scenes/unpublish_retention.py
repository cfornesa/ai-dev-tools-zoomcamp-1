"""Admin-owned lifecycle policy and bounded purge for unpublished pieces (#944).

Sibling of `cloud_retention.py`, which governs a different lifecycle (remote
*backup* copy states, `CloudBackupProject`). This module governs when an
unpublished 2D `Project`, `Project3D`, or generated `ArtPiece` itself becomes
eligible for its existing soft-delete (`is_deleted`/`deleted_at`, the same
mechanism the owner's own delete action already uses) — never a raw SQL
DELETE, and never anything that touches local browser/IndexedDB data.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from scenes.models import (
    AdminContentAuditEvent,
    ArtPiece,
    Project,
    Project3D,
    UnpublishRetentionPolicy,
)

MAX_PURGE_LIMIT = 100


class UnpublishRetentionValidationFailed(Exception):  # noqa: N818
    pass


class UnpublishRetentionConflict(Exception):  # noqa: N818
    pass


class UnpublishRetentionConfirmationRequired(UnpublishRetentionConflict):
    pass


@dataclass(frozen=True)
class UnpublishRetentionPolicyView:
    unpublished_grace_days: int
    revision: int
    updated_at: str


def _policy_view(policy: UnpublishRetentionPolicy) -> UnpublishRetentionPolicyView:
    return UnpublishRetentionPolicyView(
        unpublished_grace_days=policy.unpublished_grace_days,
        revision=policy.revision,
        updated_at=policy.updated_at.isoformat(),
    )


def get_policy() -> UnpublishRetentionPolicyView:
    return _policy_view(UnpublishRetentionPolicy.get_solo())


def _validate_days(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 3650:
        raise UnpublishRetentionValidationFailed(
            "unpublished_grace_days must be an integer from 0 through 3650."
        )
    return value


@transaction.atomic
def update_policy(
    *, actor, expected_revision: int, unpublished_grace_days: int
) -> UnpublishRetentionPolicyView:
    days = _validate_days(unpublished_grace_days)
    if isinstance(expected_revision, bool) or not isinstance(expected_revision, int):
        raise UnpublishRetentionValidationFailed("revision must be an integer.")
    policy = UnpublishRetentionPolicy.objects.select_for_update().get(pk=1)
    if policy.revision != expected_revision:
        raise UnpublishRetentionConflict(
            "The unpublish retention policy has changed; reload before saving."
        )
    policy.unpublished_grace_days = days
    policy.revision += 1
    policy.updated_by = actor
    policy.save()
    AdminContentAuditEvent.objects.create(
        resource_type="unpublish_retention_policy",
        resource_id="1",
        actor=actor,
        action="policy_updated",
        detail=f"unpublished_grace_days={policy.unpublished_grace_days}",
    )
    return _policy_view(policy)


def purge_eligible_at(unpublished_at, policy: UnpublishRetentionPolicy):
    """The timestamp at which a piece unpublished at `unpublished_at`
    becomes purge-eligible under the current policy. `None` if the piece
    isn't unpublished at all."""
    if unpublished_at is None:
        return None
    return unpublished_at + timedelta(days=policy.unpublished_grace_days)


def _expired_rows(model, deadline) -> list[Project] | list[Project3D] | list[ArtPiece]:
    return list(
        model.all_objects.select_for_update()
        .filter(is_deleted=False, unpublished_at__isnull=False, unpublished_at__lte=deadline)
        .order_by("unpublished_at", "id")
    )


@transaction.atomic
def purge_expired(*, actor, limit: int, confirm_retroactive: bool) -> dict[str, int]:
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= MAX_PURGE_LIMIT:
        raise UnpublishRetentionValidationFailed("limit must be an integer from 1 through 100.")
    policy = UnpublishRetentionPolicy.objects.select_for_update().get(pk=1)
    now = timezone.now()
    deadline = now - timedelta(days=policy.unpublished_grace_days)
    candidates: list[tuple[str, Project | Project3D | ArtPiece]] = []
    candidates.extend(("project", row) for row in _expired_rows(Project, deadline))
    candidates.extend(("project3d", row) for row in _expired_rows(Project3D, deadline))
    candidates.extend(("art_piece", row) for row in _expired_rows(ArtPiece, deadline))
    candidates.sort(key=lambda item: item[1].unpublished_at or now)
    candidates = candidates[:limit]
    if candidates and not confirm_retroactive:
        raise UnpublishRetentionConfirmationRequired(
            "This purge may soft-delete existing unpublished pieces; "
            "confirm_retroactive=true is required."
        )
    purged_by_kind = {"project": 0, "project3d": 0, "art_piece": 0}
    for kind, obj in candidates:
        unpublished_at = obj.unpublished_at
        AdminContentAuditEvent.objects.create(
            resource_type=kind,
            resource_id=str(obj.public_id),
            actor=actor,
            action="unpublished_piece_purged",
            detail=(
                f"unpublished_at={unpublished_at.isoformat() if unpublished_at else '-'};"
                f"policy_revision={policy.revision}"
            ),
        )
        obj.is_deleted = True
        obj.deleted_at = now
        obj.save(update_fields=["is_deleted", "deleted_at"])
        purged_by_kind[kind] += 1
    return {
        "scanned": len(candidates),
        "purged_project": purged_by_kind["project"],
        "purged_project3d": purged_by_kind["project3d"],
        "purged_art_piece": purged_by_kind["art_piece"],
    }
