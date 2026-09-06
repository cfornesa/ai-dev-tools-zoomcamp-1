"""Owner-scoped portable data export (issue #442).

Assembles one JSON document of everything a caller owns: profile,
linked sign-in identities, effective plan/entitlement usage, billing
status, AI provider credential *configuration* (never key material),
and every owned Project/Project3D/ArtPiece plus their full version
history (including soft-deleted rows -- it's still the owner's own
data). Deliberately excludes anything another user could not already
see the caller holding: no session tokens, no encrypted/decrypted
credential bytes, no raw PayPal webhook payloads, and never another
user's rows.
"""

from __future__ import annotations

from typing import Any

from scenes.account_entitlements import get_entitlement_summary
from scenes.account_identities import list_identities
from scenes.models import (
    ArtPiece,
    MistralCredential,
    Project,
    Project3D,
    ProviderCredential,
    Subscription,
)

EXPORT_SCHEMA_VERSION = 1


def _isoformat(value) -> str | None:
    return value.isoformat() if value is not None else None


def _serialize_scene_version(version) -> dict[str, Any]:
    return {
        "sequence": version.sequence,
        "scene_json": version.scene_json,
        "origin": version.origin,
        "change_label": version.change_label,
        "is_deleted": version.is_deleted,
        "created_at": _isoformat(version.created_at),
    }


def _serialize_project(project: Project) -> dict[str, Any]:
    return {
        "public_id": str(project.public_id),
        "title": project.title,
        "description": project.description,
        "visibility": project.visibility,
        "is_deleted": project.is_deleted,
        "created_at": _isoformat(project.created_at),
        "updated_at": _isoformat(project.updated_at),
        "published_at": _isoformat(project.published_at),
        "versions": [
            _serialize_scene_version(version) for version in project.versions.order_by("sequence")
        ],
    }


def _serialize_scene_version_3d(version) -> dict[str, Any]:
    return {
        "sequence": version.sequence,
        "scene_json": version.scene_json,
        "origin": version.origin,
        "created_at": _isoformat(version.created_at),
    }


def _serialize_project_3d(project: Project3D) -> dict[str, Any]:
    return {
        "public_id": str(project.public_id),
        "title": project.title,
        "visibility": project.visibility,
        "is_deleted": project.is_deleted,
        "created_at": _isoformat(project.created_at),
        "updated_at": _isoformat(project.updated_at),
        "published_at": _isoformat(project.published_at),
        "versions": [
            _serialize_scene_version_3d(version)
            for version in project.versions.order_by("sequence")
        ],
    }


def _serialize_art_piece_version(version) -> dict[str, Any]:
    return {
        "sequence": version.sequence,
        "source": version.source,
        "capabilities": version.capabilities,
        "generation_metadata": version.generation_metadata,
        "created_at": _isoformat(version.created_at),
    }


def _serialize_art_piece(piece: ArtPiece) -> dict[str, Any]:
    return {
        "public_id": str(piece.public_id),
        "title": piece.title,
        "description": piece.description,
        "prompt": piece.prompt,
        "engine": piece.engine,
        "status": piece.status,
        "is_deleted": piece.is_deleted,
        "created_at": _isoformat(piece.created_at),
        "updated_at": _isoformat(piece.updated_at),
        "published_at": _isoformat(piece.published_at),
        "versions": [
            _serialize_art_piece_version(version) for version in piece.versions.order_by("sequence")
        ],
    }


def _serialize_subscription(user) -> dict[str, Any] | None:
    subscription = Subscription.objects.filter(user=user).order_by("-id").first()
    if subscription is None:
        return None
    return {
        "status": subscription.status,
        "plan_key": subscription.plan_key,
        "paid_through": _isoformat(subscription.paid_through),
    }


def _serialize_ai_credentials(user) -> dict[str, Any]:
    """Configuration status only -- never key material, encrypted or not."""
    return {
        "mistral_configured": MistralCredential.objects.filter(user=user).exists(),
        "provider_credentials": sorted(
            ProviderCredential.objects.filter(owner=user).values_list("vendor", flat=True)
        ),
    }


def build_account_export(user) -> dict[str, Any]:
    """The complete export document for exactly this caller's own data."""
    return {
        "schema_version": EXPORT_SCHEMA_VERSION,
        "profile": {
            "username": user.username,
            "email": user.email,
        },
        "identities": list_identities(user),
        "entitlement": get_entitlement_summary(user),
        "subscription": _serialize_subscription(user),
        "ai_credentials": _serialize_ai_credentials(user),
        "projects": [
            _serialize_project(project)
            for project in Project.all_objects.filter(owner=user).order_by("id")
        ],
        "projects_3d": [
            _serialize_project_3d(project)
            for project in Project3D.all_objects.filter(owner=user).order_by("id")
        ],
        "art_pieces": [
            _serialize_art_piece(piece)
            for piece in ArtPiece.all_objects.filter(owner=user).order_by("id")
        ],
    }
