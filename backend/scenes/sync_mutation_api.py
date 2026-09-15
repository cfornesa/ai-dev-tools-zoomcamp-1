"""Authenticated deterministic mutation acknowledgement API (#543)."""

import hashlib
import json
import uuid

from django.db import IntegrityError, transaction
from django.db.models import Max
from django.http import Http404
from django.utils.dateparse import parse_datetime
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.models import Project, Scene, SceneVersion, SyncMutationReceipt
from scenes.validation import validate_scene

ALLOWED_KINDS = {choice.value for choice in SyncMutationReceipt.Kind}
CONFLICT_RESOLUTION_CHOICES = {"keep-local", "keep-remote", "compose"}


def _project_for_owner(request, public_id):
    if not request.user.is_authenticated:
        return None
    try:
        return Project.objects.get(public_id=public_id, owner=request.user)
    except (Project.DoesNotExist, ValueError, TypeError) as exc:
        raise Http404 from exc


def _canonical_checksum(payload) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _parse_uuid(value, field_name):
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError) as exc:
        raise ValueError(f"{field_name} must be a UUID.") from exc


def _validate_conflict_resolution_payload(kind, payload):
    """Validate the server-authoritative #544 resolution envelope."""
    if not isinstance(payload, dict) or payload.get("type") != "conflict-resolution":
        return
    if kind != SyncMutationReceipt.Kind.SCENE:
        raise ValueError("conflict-resolution payloads must use the scene kind.")
    base_version = payload.get("base_version")
    if (
        not isinstance(base_version, str)
        or not base_version.strip()
        or not base_version.isdecimal()
        or int(base_version) < 1
    ):
        raise ValueError("conflict-resolution base_version must be a positive SceneVersion id.")
    if payload.get("choice") not in CONFLICT_RESOLUTION_CHOICES:
        raise ValueError("conflict-resolution choice is invalid.")
    if not isinstance(payload.get("resolved_payload"), dict):
        raise ValueError("conflict-resolution resolved_payload must be a scene object.")
    audit = payload.get("audit")
    if not isinstance(audit, dict):
        raise ValueError("conflict-resolution audit is required.")
    for field in ("conflict_paths", "local_operation_ids", "remote_operation_ids"):
        values = audit.get(field)
        if not isinstance(values, list) or not all(
            isinstance(value, str) and value for value in values
        ):
            raise ValueError(f"conflict-resolution audit.{field} must be a list of strings.")
    if audit["conflict_paths"] != sorted(audit["conflict_paths"]):
        raise ValueError("conflict-resolution audit.conflict_paths must be sorted.")


def _receipt_body(receipt: SyncMutationReceipt, *, replayed: bool) -> dict:
    body = {
        "acknowledged": True,
        "replayed": replayed,
        "operation_id": str(receipt.operation_id),
        "server_operation_id": str(receipt.pk),
        "client_sequence": receipt.client_sequence,
        "payload_checksum": receipt.payload_checksum,
        "acknowledged_at": receipt.acknowledged_at.isoformat(),
    }
    if receipt.applied_scene_version_id is not None:
        body["applied_scene_version_id"] = receipt.applied_scene_version_id
    return body


def _scene_validation_errors(scene_json: dict) -> list[dict]:
    result = validate_scene(scene_json)
    return [
        {"path": error.path, "rule": error.rule, "message": error.message}
        for error in result.errors
    ]


def _stale_conflict_response(
    *, operation_id: uuid.UUID, base: SceneVersion | None, current: SceneVersion | None, local: dict
) -> Response:
    base_snapshot = base.scene_json if base is not None else None
    remote_snapshot = current.scene_json if current is not None else None
    base_id = str(base.pk) if base is not None else "unknown"
    remote_id = str(current.pk) if current is not None else "unknown"
    context = {
        "baseVersion": base_id,
        "localOperationIds": [str(operation_id)],
        "remoteOperationIds": [remote_id],
    }
    return Response(
        {
            "error": "conflict",
            "conflict": {
                "conflicts": [
                    {
                        "path": "$",
                        "base": base_snapshot,
                        "local": local,
                        "remote": remote_snapshot,
                        "affectedIdentities": [],
                        "context": context,
                    }
                ],
                "context": context,
                "localSnapshot": local,
                "remoteSnapshot": remote_snapshot,
                "mergedSnapshot": remote_snapshot,
            },
        },
        status=409,
    )


class SyncMutationReceiptView(APIView):
    """Record one owner-scoped outbox operation and acknowledge safe replays."""

    def post(self, request, public_id):
        project = _project_for_owner(request, public_id)
        if project is None:
            return Response(status=401)

        data = request.data
        if not isinstance(data, dict):
            return Response(
                {"error": "invalid_operation", "detail": "A JSON object is required."}, status=400
            )

        try:
            operation_id = _parse_uuid(data.get("operation_id"), "operation_id")
            raw_sequence = data.get("client_sequence")
            if (
                isinstance(raw_sequence, bool)
                or not isinstance(raw_sequence, int)
                or raw_sequence < 1
            ):
                raise ValueError("client_sequence must be a positive integer.")
            kind = data.get("kind")
            if kind not in ALLOWED_KINDS:
                raise ValueError("kind must be scene, metadata, or media-reference.")
            schema_version = data.get("schema_version")
            if (
                isinstance(schema_version, bool)
                or not isinstance(schema_version, int)
                or schema_version < 1
            ):
                raise ValueError("schema_version must be a positive integer.")
            if "payload" not in data:
                raise ValueError("payload is required.")
            payload = data["payload"]
            _validate_conflict_resolution_payload(kind, payload)
            payload_checksum = str(data.get("payload_checksum", ""))
            if len(payload_checksum) != 64 or any(
                char not in "0123456789abcdef" for char in payload_checksum
            ):
                raise ValueError("payload_checksum must be a lowercase SHA-256 checksum.")
            if payload_checksum != _canonical_checksum(payload):
                return Response({"error": "payload_checksum_mismatch"}, status=409)
            dependency_ids = data.get("dependency_operation_ids", [])
            if not isinstance(dependency_ids, list):
                raise ValueError("dependency_operation_ids must be a list.")
            parsed_dependencies = [
                str(_parse_uuid(value, "dependency_operation_ids")) for value in dependency_ids
            ]
            scene_id = None
            if data.get("scene_id") is not None:
                scene_id = _parse_uuid(data["scene_id"], "scene_id")
            client_created_at = data.get("client_created_at")
            if client_created_at is not None:
                client_created_at = parse_datetime(str(client_created_at))
                if client_created_at is None:
                    raise ValueError("client_created_at must be an ISO-8601 timestamp.")
            if data.get("project_id") not in (None, str(project.public_id)):
                raise ValueError("project_id does not match the URL project.")
        except ValueError as exc:
            return Response({"error": "invalid_operation", "detail": str(exc)}, status=400)

        try:
            with transaction.atomic():
                existing = (
                    SyncMutationReceipt.objects.select_for_update()
                    .filter(owner=request.user, operation_id=operation_id)
                    .first()
                )
                if existing is not None:
                    same = (
                        existing.project_id == project.id
                        and existing.client_sequence == raw_sequence
                        and existing.kind == kind
                        and existing.scene_id == scene_id
                        and existing.payload_checksum == payload_checksum
                        and existing.schema_version == schema_version
                        and existing.dependency_operation_ids == parsed_dependencies
                        and existing.payload == payload
                    )
                    if not same:
                        return Response({"error": "operation_id_conflict"}, status=409)
                    return Response(_receipt_body(existing, replayed=True), status=200)

                sequence_exists = SyncMutationReceipt.objects.filter(
                    owner=request.user, project=project, client_sequence=raw_sequence
                ).exists()
                if sequence_exists:
                    return Response({"error": "client_sequence_conflict"}, status=409)

                applied_scene_version = None
                if payload.get("type") == "conflict-resolution":
                    # Lock only the project row. Both related fields are
                    # nullable, and PostgreSQL rejects FOR UPDATE over the
                    # nullable side of the outer joins select_related would
                    # introduce. The locked project remains the authority;
                    # related rows are read after that row lock is acquired.
                    locked_project = Project.objects.select_for_update().get(pk=project.pk)
                    current_version = locked_project.current_version
                    base_version = (
                        SceneVersion.objects.filter(
                            project=locked_project, pk=int(payload["base_version"])
                        )
                        .select_related("scene")
                        .first()
                    )
                    if (
                        base_version is None
                        or current_version is None
                        or base_version.pk != current_version.pk
                    ):
                        return _stale_conflict_response(
                            operation_id=operation_id,
                            base=base_version,
                            current=current_version,
                            local=payload["resolved_payload"],
                        )
                    validation_errors = _scene_validation_errors(payload["resolved_payload"])
                    if validation_errors:
                        return Response({"errors": validation_errors}, status=400)
                    target_scene = locked_project.active_scene
                    if scene_id is not None:
                        target_scene = Scene.objects.filter(
                            project=locked_project, public_id=scene_id
                        ).first()
                    if target_scene is None or target_scene.pk != current_version.scene_id:
                        return Response(
                            {
                                "error": "scene_conflict",
                                "detail": "scene_id is not the current scene.",
                            },
                            status=409,
                        )
                    next_sequence = (
                        target_scene.scene_versions.aggregate(Max("sequence"))["sequence__max"] or 0
                    ) + 1
                    applied_scene_version = SceneVersion.objects.create(
                        project=locked_project,
                        scene=target_scene,
                        sequence=next_sequence,
                        scene_json=payload["resolved_payload"],
                        created_by=request.user,
                        parent=current_version,
                        origin=SceneVersion.Origin.MANUAL,
                        change_label=f"Offline conflict resolution {operation_id}",
                    )
                    target_scene.current_version = applied_scene_version
                    target_scene.save(update_fields=["current_version", "updated_at"])
                    locked_project.current_version = applied_scene_version
                    locked_project.save(update_fields=["current_version", "updated_at"])

                receipt = SyncMutationReceipt.objects.create(
                    owner=request.user,
                    project=project,
                    operation_id=operation_id,
                    scene_id=scene_id,
                    client_sequence=raw_sequence,
                    kind=kind,
                    payload=payload,
                    payload_checksum=payload_checksum,
                    schema_version=schema_version,
                    dependency_operation_ids=parsed_dependencies,
                    client_created_at=client_created_at,
                    applied_scene_version=applied_scene_version,
                )
        except IntegrityError:
            # A concurrent request may have won either unique key. The retry
            # can safely inspect the durable row and return the same
            # acknowledgement or an explicit conflict.
            receipt = SyncMutationReceipt.objects.filter(
                owner=request.user, operation_id=operation_id
            ).first()
            if receipt is not None and receipt.payload_checksum == payload_checksum:
                return Response(_receipt_body(receipt, replayed=True), status=200)
            return Response({"error": "client_sequence_conflict"}, status=409)

        return Response(_receipt_body(receipt, replayed=False), status=201)
