"""Transactional application-admin content operations (#518)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from scenes.models import (
    AdminContentAuditEvent,
    ApplicationAdmin,
    ArtPiece,
    CloudBackupBlob,
    Project,
    Project3D,
)
from scenes.publishing import validate_meaningful_metadata, validate_meaningful_metadata_3d

RESOURCE_TYPES = frozenset({"project", "project3d", "art_piece"})
ACTION_TYPES = frozenset({"publish", "unpublish", "restore", "delete"})


class AdminContentValidationFailed(Exception):
    pass


class AdminContentConflict(Exception):
    pass


@dataclass(frozen=True)
class ContentRow:
    resource_type: str
    resource_id: str
    title: str
    owner: str
    status: str
    updated_at: str
    deleted: bool
    version_count: int | None = None


def _user_name(user) -> str:
    return user.get_username() or user.get_full_name() or str(user.pk)


def _row(resource_type: str, resource) -> ContentRow:
    if resource_type == "project":
        status = resource.visibility
        versions = resource.versions.filter(is_deleted=False).count()
    elif resource_type == "project3d":
        status = resource.visibility
        versions = resource.versions.count()
    else:
        status = resource.status
        versions = resource.versions.count()
    return ContentRow(
        resource_type=resource_type,
        resource_id=str(resource.public_id),
        title=resource.title,
        owner=_user_name(resource.owner),
        status=status,
        updated_at=resource.updated_at.isoformat(),
        deleted=bool(resource.is_deleted),
        version_count=versions,
    )


def list_content() -> list[ContentRow | dict]:
    rows: list[ContentRow | dict] = []
    for project in Project.all_objects.select_related("owner").order_by("-updated_at", "-id"):
        rows.append(_row("project", project))
        rows.extend(
            {
                "resource_type": "project_version",
                "resource_id": str(version.id),
                "title": f"{project.title} · version {version.sequence}",
                "owner": _user_name(project.owner),
                "status": "deleted" if version.is_deleted else "saved",
                "updated_at": version.created_at.isoformat(),
                "deleted": bool(version.is_deleted),
                "version_count": None,
            }
            for version in project.versions.order_by("-sequence")
        )
    for project3d in Project3D.all_objects.select_related("owner").order_by("-updated_at", "-id"):
        rows.append(_row("project3d", project3d))
        rows.extend(
            {
                "resource_type": "project3d_version",
                "resource_id": str(version.id),
                "title": f"{project3d.title} · version {version.sequence}",
                "owner": _user_name(project3d.owner),
                "status": "saved",
                "updated_at": version.created_at.isoformat(),
                "deleted": False,
                "version_count": None,
            }
            for version in project3d.versions.order_by("-sequence")
        )
    for piece in ArtPiece.all_objects.select_related("owner").order_by("-updated_at", "-id"):
        rows.append(_row("art_piece", piece))
        rows.extend(
            {
                "resource_type": "art_piece_version",
                "resource_id": str(version.id),
                "title": f"{piece.title} · version {version.sequence}",
                "owner": _user_name(piece.owner),
                "status": "saved",
                "updated_at": version.created_at.isoformat(),
                "deleted": False,
                "version_count": None,
            }
            for version in piece.versions.order_by("-sequence")
        )
    for blob in CloudBackupBlob.objects.select_related("backup__project__owner").order_by(
        "-updated_at", "-id"
    ):
        project = blob.backup.project
        rows.append(
            {
                "resource_type": "media",
                "resource_id": str(blob.asset_id),
                "title": f"{blob.mime_type} asset",
                "owner": _user_name(project.owner),
                "status": "backed_up",
                "updated_at": blob.updated_at.isoformat(),
                "deleted": False,
                "version_count": None,
                "project_id": str(project.public_id),
                "byte_size": blob.byte_size,
            }
        )
    return rows


def _resource(resource_type: str, resource_id: str) -> Any:
    try:
        UUID(resource_id)
    except (ValueError, TypeError) as exc:
        raise AdminContentValidationFailed("resource_id must be a UUID.") from exc
    model: Any
    if resource_type == "project":
        model = Project
    elif resource_type == "project3d":
        model = Project3D
    elif resource_type == "art_piece":
        model = ArtPiece
    else:
        raise AdminContentValidationFailed("unsupported resource_type.")
    try:
        return model.all_objects.select_for_update().get(public_id=resource_id)
    except model.DoesNotExist as exc:
        raise AdminContentConflict("content resource was not found.") from exc


@transaction.atomic
def apply_action(*, actor, resource_type: str, resource_id: str, action: str):
    if resource_type not in RESOURCE_TYPES or action not in ACTION_TYPES:
        raise AdminContentValidationFailed("unsupported content resource or action.")
    resource = _resource(resource_type, resource_id)
    if resource.is_deleted and action != "restore":
        raise AdminContentConflict("restore deleted content before changing its publication state.")
    if action == "restore":
        if not resource.is_deleted:
            raise AdminContentConflict("content resource is not deleted.")
        resource.is_deleted = False
        resource.deleted_at = None
        resource.updated_at = timezone.now()
        resource.save(update_fields=["is_deleted", "deleted_at", "updated_at"])
    elif action == "delete":
        if resource.is_deleted:
            raise AdminContentConflict("content resource is already deleted.")
        resource.is_deleted = True
        resource.deleted_at = timezone.now()
        resource.save(update_fields=["is_deleted", "deleted_at", "updated_at"])
    elif resource_type == "project":
        errors = validate_meaningful_metadata(resource.title, resource.description)
        if action == "publish" and resource.current_version_id is None:
            errors.setdefault("current_version", []).append(
                "Save at least one version before publishing."
            )
        if action == "publish" and errors:
            raise AdminContentValidationFailed(
                "; ".join(" ".join(messages) for messages in errors.values())
            )
        resource.visibility = (
            Project.Visibility.PUBLIC if action == "publish" else Project.Visibility.PRIVATE
        )
        resource.published_at = timezone.now() if action == "publish" else None
        resource.save(update_fields=["visibility", "published_at", "updated_at"])
    elif resource_type == "project3d":
        errors = validate_meaningful_metadata_3d(resource.title)
        if action == "publish" and resource.current_version_id is None:
            errors.setdefault("current_version", []).append(
                "Save at least one version before publishing."
            )
        if action == "publish" and errors:
            raise AdminContentValidationFailed(
                "; ".join(" ".join(messages) for messages in errors.values())
            )
        resource.visibility = (
            Project3D.Visibility.PUBLIC if action == "publish" else Project3D.Visibility.PRIVATE
        )
        resource.published_at = timezone.now() if action == "publish" else None
        resource.save(update_fields=["visibility", "published_at", "updated_at"])
    else:
        if action == "publish" and (
            resource.current_version_id is None
            or not resource.title.strip()
            or not resource.description.strip()
        ):
            raise AdminContentValidationFailed(
                "Publishing requires a version and meaningful title and description."
            )
        resource.status = (
            ArtPiece.Status.PUBLISHED if action == "publish" else ArtPiece.Status.DRAFT
        )
        resource.published_at = timezone.now() if action == "publish" else None
        resource.save(update_fields=["status", "published_at", "updated_at"])
    AdminContentAuditEvent.objects.create(
        resource_type=resource_type,
        resource_id=resource_id,
        actor=actor,
        action=action,
        detail=f"title={resource.title[:180]}",
    )
    return _row(resource_type, resource)


@transaction.atomic
def set_application_access(*, actor, username: str, granted: bool):
    if not isinstance(username, str) or not username.strip():
        raise AdminContentValidationFailed("username is required.")
    User = get_user_model()
    try:
        user = User.objects.get(username=username.strip())
    except User.DoesNotExist as exc:
        raise AdminContentConflict("user was not found.") from exc
    if granted:
        ApplicationAdmin.objects.get_or_create(user=user)
        action = "access_granted"
    else:
        ApplicationAdmin.objects.filter(user=user).delete()
        action = "access_revoked"
    AdminContentAuditEvent.objects.create(
        resource_type="application_admin",
        resource_id=str(user.pk),
        actor=actor,
        action=action,
        detail=f"username={user.get_username()}",
    )
    return {"username": user.get_username(), "granted": granted}
