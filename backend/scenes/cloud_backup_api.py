"""Authenticated project cloud-backup endpoints (#509)."""

import re
import uuid

from django.http import Http404, HttpResponse
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.cloud_backup import (
    CloudBackupError,
    enable_backup,
    get_backup,
    get_blob,
    latest_manifest,
    pause_backup,
    put_blob,
    put_blob_chunk,
    put_manifest,
    snapshot_schedule,
)
from scenes.models import Project
from scenes.permissions import PermissionDenied


def _project(public_id):
    try:
        return Project.objects.get(public_id=public_id)
    except (Project.DoesNotExist, ValueError, TypeError) as exc:
        raise Http404 from exc


def _error(exc: CloudBackupError) -> Response:
    return Response({"error": exc.code, "detail": str(exc)}, status=exc.status_code)


class CloudBackupView(APIView):
    def post(self, request, public_id):
        if not request.user.is_authenticated:
            return Response(status=401)
        try:
            project = _project(public_id)
            action = request.data.get("action", "enable")
            if action not in {"enable", "pause"}:
                return Response({"error": "invalid_action"}, status=400)
            backup = (
                pause_backup(request.user, project)
                if action == "pause"
                else enable_backup(request.user, project)
            )
        except PermissionDenied as exc:
            raise Http404 from exc
        except CloudBackupError as exc:
            return _error(exc)
        return Response(
            {
                "enabled": backup.enabled,
                "paused": backup.paused,
                "read_only": backup.read_only,
                "retention_state": backup.retention_state,
                "retain_until": backup.retain_until.isoformat() if backup.retain_until else None,
                "revision": backup.revision,
                **snapshot_schedule(request.user, project),
            },
            status=201,
        )

    def get(self, request, public_id):
        if not request.user.is_authenticated:
            return Response(status=401)
        try:
            project = _project(public_id)
            backup = get_backup(request.user, project)
        except PermissionDenied as exc:
            raise Http404 from exc
        except CloudBackupError as exc:
            if exc.code == "cloud_backup_conflict":
                raise Http404 from None
            return _error(exc)
        return Response(
            {
                "enabled": backup.enabled,
                "paused": backup.paused,
                "read_only": backup.read_only,
                "retention_state": backup.retention_state,
                "retain_until": backup.retain_until.isoformat() if backup.retain_until else None,
                "revision": backup.revision,
                **snapshot_schedule(request.user, project),
            }
        )


class CloudBackupManifestView(APIView):
    def get(self, request, public_id):
        if not request.user.is_authenticated:
            return Response(status=401)
        try:
            row = latest_manifest(request.user, _project(public_id))
        except PermissionDenied as exc:
            raise Http404 from exc
        except CloudBackupError as exc:
            return _error(exc)
        if row is None:
            raise Http404
        return Response(
            {"revision": row.revision, "checksum": row.checksum, "manifest": row.manifest}
        )

    def put(self, request, public_id):
        if not request.user.is_authenticated:
            return Response(status=401)
        try:
            row = put_manifest(
                request.user,
                _project(public_id),
                expected_revision=request.data.get("revision"),
                idempotency_key=request.data.get("idempotency_key", ""),
                manifest=request.data.get("manifest"),
            )
        except PermissionDenied as exc:
            raise Http404 from exc
        except (CloudBackupError, TypeError, ValueError) as exc:
            if not isinstance(exc, CloudBackupError):
                return Response({"error": "invalid_manifest", "detail": str(exc)}, status=400)
            return _error(exc)
        return Response(
            {"revision": row.revision, "checksum": row.checksum, "manifest": row.manifest}
        )


class CloudBackupBlobView(APIView):
    def get(self, request, public_id, asset_id):
        if not request.user.is_authenticated:
            return Response(status=401)
        try:
            row = get_blob(request.user, _project(public_id), uuid.UUID(str(asset_id)))
        except ValueError as exc:
            raise Http404 from exc
        except PermissionDenied as exc:
            raise Http404 from exc
        except CloudBackupError as exc:
            return _error(exc)
        response = HttpResponse(row.data, content_type=row.mime_type)
        response["X-Asset-Checksum"] = row.checksum
        return response

    def put(self, request, public_id, asset_id):
        if not request.user.is_authenticated:
            return Response(status=401)
        try:
            row = put_blob(
                request.user,
                _project(public_id),
                uuid.UUID(str(asset_id)),
                request.body,
                checksum=request.headers.get("X-Asset-Checksum", ""),
                mime_type=request.headers.get("X-Asset-Mime-Type", "application/octet-stream"),
                idempotency_key=request.headers.get("X-Idempotency-Key", ""),
            )
        except ValueError as exc:
            raise Http404 from exc
        except PermissionDenied as exc:
            raise Http404 from exc
        except CloudBackupError as exc:
            return _error(exc)
        return Response(
            {"asset_id": str(row.asset_id), "checksum": row.checksum, "byte_size": row.byte_size}
        )


class CloudBackupBlobChunkView(APIView):
    def put(self, request, public_id, asset_id):
        if not request.user.is_authenticated:
            return Response(status=401)
        match = re.fullmatch(r"bytes (\d+)-(\d+)/(\d+)", request.headers.get("Content-Range", ""))
        if match is None:
            return Response({"error": "invalid_content_range"}, status=400)
        start, inclusive_end, byte_length = (int(value) for value in match.groups())
        try:
            result = put_blob_chunk(
                request.user,
                _project(public_id),
                uuid.UUID(str(asset_id)),
                request.body,
                start=start,
                end=inclusive_end + 1,
                byte_length=byte_length,
                checksum=request.headers.get("X-Asset-Checksum", ""),
                mime_type=request.headers.get("X-Asset-Mime-Type", "application/octet-stream"),
                idempotency_key=request.headers.get("X-Idempotency-Key", ""),
            )
        except ValueError as exc:
            return Response({"error": "invalid_chunk", "detail": str(exc)}, status=400)
        except PermissionDenied as exc:
            raise Http404 from exc
        except CloudBackupError as exc:
            return _error(exc)
        return Response(result, status=200 if result["complete"] else 308)
