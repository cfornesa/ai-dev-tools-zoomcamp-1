"""Transactional, owner-scoped intake for portable piece packages (#932)."""

from __future__ import annotations

import hashlib
import io
import mimetypes
import uuid
from dataclasses import dataclass
from typing import Any

from django.core.cache import cache
from django.db import IntegrityError, transaction
from PIL import Image, UnidentifiedImageError

from scenes.art_piece_contract import SUPPORTED_ART_PIECE_ENGINES
from scenes.cloud_backup import _plan_quota
from scenes.entitlements import get_effective_cap
from scenes.models import (
    AdminContentAuditEvent,
    ArtPiece,
    ArtPieceVersion,
    PieceIntakeAsset,
    PieceIntakeReceipt,
    Project,
    Project3D,
    Scene,
    SceneVersion,
    SceneVersion3D,
    SiteSettings,
)
from scenes.permissions import Action, can
from scenes.piece_package import (
    PIECE_PACKAGE_MAX_BYTES,
    PiecePackageError,
    parse_piece_package_archive,
)
from scenes.validation import validate_scene
from scenes.validation3d import validate_scene3d

INTAKE_RATE_LIMIT = 20
INTAKE_RATE_WINDOW = 60
_EXECUTABLE_SUFFIXES = {".bat", ".cmd", ".com", ".dll", ".exe", ".html", ".js", ".py", ".sh"}
_IMAGE_SIGNATURES = {
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/jpeg": b"\xff\xd8\xff",
    "image/gif": (b"GIF87a", b"GIF89a"),
    "image/webp": b"RIFF",
}


class PieceIntakeError(ValueError):
    """A safe, client-actionable intake failure."""


@dataclass(frozen=True)
class IntakeResult:
    response: dict[str, object]
    created: bool


def _rate_limit(user_id: int) -> None:
    key = f"piece-intake:{user_id}"
    try:
        cache.add(key, 0, timeout=INTAKE_RATE_WINDOW)
        count = cache.incr(key)
    except ValueError:
        cache.add(key, 1, timeout=INTAKE_RATE_WINDOW)
        count = 1
    if count > INTAKE_RATE_LIMIT:
        raise PieceIntakeError("Package intake rate limit exceeded.")


def _image_bytes(mime_type: str, payload: bytes) -> bytes:
    signature = _IMAGE_SIGNATURES.get(mime_type)
    if signature is None:
        return payload
    signatures = signature if isinstance(signature, tuple) else (signature,)
    if not any(payload.startswith(item) for item in signatures):
        raise PieceIntakeError("Image payload does not match its declared MIME type.")
    try:
        with Image.open(io.BytesIO(payload)) as image:
            image.load()
            output = io.BytesIO()
            image.convert("RGBA").save(output, format="PNG")
            return output.getvalue()
    except (OSError, UnidentifiedImageError) as exc:
        raise PieceIntakeError("Image asset is not a readable image.") from exc


def _asset_payload(
    asset: dict[str, Any], files: dict[str, bytes], by_index: dict[int, dict[str, Any]]
) -> tuple[str, bytes]:
    try:
        file = by_index[int(asset["fileIndex"])]
        filename = str(asset["filename"])
        mime_type = str(asset["mimeType"]).lower()
        payload = files[str(file["path"])]
    except (KeyError, TypeError, ValueError) as exc:
        raise PieceIntakeError("Media asset descriptor is invalid.") from exc
    if any(filename.lower().endswith(suffix) for suffix in _EXECUTABLE_SUFFIXES):
        raise PieceIntakeError("Executable-looking media assets are not accepted.")
    if not mime_type or mime_type == "application/octet-stream":
        guessed, _ = mimetypes.guess_type(filename)
        mime_type = guessed or mime_type
    return mime_type, _image_bytes(mime_type, payload)


def _records(package: dict[str, Any]) -> list[dict[str, Any]]:
    manifest = package["manifest"]
    files = package["files"]
    by_index = {int(entry["index"]): entry for entry in manifest["files"]}
    result = []
    for record in manifest["records"]:
        file = by_index[int(record["fileIndex"])]
        import json

        result.append(json.loads(files[str(file["path"])].decode("utf-8")))
    return result


def _current_revision(piece: Project | Project3D | ArtPiece) -> int:
    return piece.versions.order_by("-sequence").values_list("sequence", flat=True).first() or 0


def _find_piece(owner, public_id: uuid.UUID):
    for model in (Project, Project3D, ArtPiece):
        piece = model.objects.filter(owner=owner, public_id=public_id).first()
        if piece is not None:
            return piece
    return None


def _check_quota(owner, package_bytes: int, asset_count: int) -> None:
    max_bytes, max_files = _plan_quota(owner)
    used_bytes = sum(row.byte_size for row in PieceIntakeAsset.objects.filter(owner=owner))
    used_files = PieceIntakeAsset.objects.filter(owner=owner).count()
    if used_bytes + package_bytes > max_bytes or used_files + asset_count > max_files:
        raise PieceIntakeError("Package exceeds the owner's storage quota.")


def intake_package(  # noqa: C901
    *,
    owner,
    archive: bytes,
    idempotency_key: str | None = None,
    piece_id: uuid.UUID | None = None,
    expected_revision: int | None = None,
) -> IntakeResult:
    if not can(owner, Action.PROJECT_CREATE):
        raise PermissionError
    if not SiteSettings.get_solo().cloud_sync_enabled:
        raise PieceIntakeError("Cloud sync is currently unavailable.")
    if get_effective_cap(owner, "cloud_project_sync") <= 0:
        raise PieceIntakeError("Cloud sync is not enabled for this account.")
    if len(archive) > PIECE_PACKAGE_MAX_BYTES:
        raise PieceIntakeError("Package exceeds the byte limit.")
    _rate_limit(owner.id)
    if idempotency_key:
        existing = PieceIntakeReceipt.objects.filter(
            owner=owner, idempotency_key=idempotency_key
        ).first()
        if existing is not None:
            return IntakeResult(existing.response, False)
    try:
        package = parse_piece_package_archive(archive)
    except PiecePackageError as exc:
        raise PieceIntakeError(str(exc)) from exc
    manifest = package["manifest"]
    kind = str(manifest["kind"])
    metadata = manifest["metadata"]
    records = _records(package)
    if not records and kind != "generated":
        raise PieceIntakeError("Package must contain at least one record.")
    if piece_id is not None:
        piece = _find_piece(owner, piece_id)
        if piece is None:
            raise LookupError
        action = {
            "2d": Action.PROJECT_WRITE,
            "3d": Action.PROJECT3D_WRITE,
            "generated": Action.ART_PIECE_WRITE,
        }[kind]
        if not can(owner, action, piece):
            raise LookupError
        if expected_revision is not None and _current_revision(piece) != expected_revision:
            raise PieceIntakeError("Package revision is stale.")
        if (
            (kind == "2d" and not isinstance(piece, Project))
            or (kind == "3d" and not isinstance(piece, Project3D))
            or (kind == "generated" and not isinstance(piece, ArtPiece))
        ):
            raise PieceIntakeError("Package kind does not match the target piece.")
    else:
        piece = None
    _check_quota(owner, len(archive), len(manifest["mediaAssets"]))
    with transaction.atomic():
        owner = type(owner).objects.select_for_update().get(pk=owner.pk)
        if idempotency_key:
            existing = PieceIntakeReceipt.objects.filter(
                owner=owner, idempotency_key=idempotency_key
            ).first()
            if existing is not None:
                return IntakeResult(existing.response, False)
        if kind == "2d":
            if piece is None:
                if not can(owner, Action.PROJECT_CREATE):
                    raise PermissionError
                piece = Project.objects.create(
                    owner=owner,
                    title=metadata["title"],
                    description=metadata["description"],
                    tags=metadata["tags"],
                    visibility=Project.Visibility.PRIVATE,
                )
                scene = Scene.objects.create(project=piece, name="Scene 1", position=0)
            else:
                scene = piece.active_scene or piece.scenes.order_by("position").first()
                if scene is None:
                    scene = Scene.objects.create(project=piece, name="Scene 1", position=0)
            for data in records:
                validation_2d = validate_scene(data)
                if not validation_2d.valid:
                    raise PieceIntakeError("A 2D record does not satisfy the scene schema.")
                sequence = _current_revision(piece) + 1
                version_2d = SceneVersion.objects.create(
                    project=piece,
                    scene=scene,
                    sequence=sequence,
                    scene_json=data,
                    created_by=owner,
                    origin=SceneVersion.Origin.MANUAL,
                    change_label="Portable package intake",
                )
                scene.current_version = version_2d
                scene.save(update_fields=["current_version", "updated_at"])
                piece.current_version = version_2d
                piece.active_scene = scene
                piece.save(update_fields=["current_version", "active_scene", "updated_at"])
        elif kind == "3d":
            if piece is None:
                piece = Project3D.objects.create(
                    owner=owner, title=metadata["title"], visibility=Project3D.Visibility.PRIVATE
                )
            for data in records:
                validation_3d = validate_scene3d(data)
                if not validation_3d.valid:
                    raise PieceIntakeError("A 3D record does not satisfy the scene schema.")
                sequence = _current_revision(piece) + 1
                version_3d = SceneVersion3D.objects.create(
                    project=piece,
                    sequence=sequence,
                    scene_json=data,
                    created_by=owner,
                    origin=SceneVersion3D.Origin.MANUAL,
                )
                piece.current_version = version_3d
                piece.save(update_fields=["current_version", "updated_at"])
        else:
            engine = str(manifest["source"]["engine"])
            if engine not in SUPPORTED_ART_PIECE_ENGINES:
                raise PieceIntakeError("Generated package engine is unsupported.")
            source = str(manifest["source"]["code"])
            if piece is None:
                piece = ArtPiece.objects.create(
                    owner=owner,
                    title=metadata["title"],
                    description=metadata["description"],
                    prompt=metadata["description"],
                    engine=engine,
                    status=ArtPiece.Status.DRAFT,
                )
            sequence = _current_revision(piece) + 1
            version_art = ArtPieceVersion.objects.create(
                piece=piece,
                sequence=sequence,
                source=source,
                capabilities=manifest.get("capabilities") or {},
                generation_metadata={"package_origin": metadata["origin"]},
            )
            piece.current_version = version_art
            piece.save(update_fields=["current_version", "updated_at"])
        public_id = piece.public_id
        current_version = _current_revision(piece)
        for asset in manifest["mediaAssets"]:
            mime_type, payload = _asset_payload(
                asset, package["files"], {int(entry["index"]): entry for entry in manifest["files"]}
            )
            PieceIntakeAsset.objects.create(
                owner=owner,
                piece_kind=kind,
                piece_public_id=public_id,
                source_asset_id=asset.get("sourceAssetId"),
                filename=str(asset["filename"]),
                alt_text=str(asset["altText"]),
                mime_type=mime_type,
                byte_size=len(payload),
                checksum=hashlib.sha256(payload).hexdigest(),
                data=payload,
            )
        response = {
            "kind": kind,
            "public_id": str(public_id),
            "version": current_version,
            "visibility": "private",
            "media_count": len(manifest["mediaAssets"]),
        }
        if idempotency_key:
            try:
                PieceIntakeReceipt.objects.create(
                    owner=owner,
                    idempotency_key=idempotency_key,
                    kind=kind,
                    public_id=public_id,
                    version=current_version,
                    response=response,
                )
            except IntegrityError:
                receipt = PieceIntakeReceipt.objects.get(
                    owner=owner, idempotency_key=idempotency_key
                )
                return IntakeResult(receipt.response, False)
        AdminContentAuditEvent.objects.create(
            resource_type="piece_intake",
            resource_id=str(public_id),
            actor=owner,
            action="create" if current_version == 1 else "update",
            detail=f"{kind} package intake v{current_version}",
        )
    return IntakeResult(response, True)
