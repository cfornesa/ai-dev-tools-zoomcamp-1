"""Authenticated project cloud-backup endpoints (#509)."""

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
    put_blob,
    put_manifest,
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
            backup = enable_backup(request.user, _project(public_id))
        except PermissionDenied as exc:
            raise Http404 from exc
        except CloudBackupError as exc:
            return _error(exc)
        return Response(
            {"enabled": backup.enabled, "read_only": backup.read_only, "revision": backup.revision},
            status=201,
        )

    def get(self, request, public_id):
        if not request.user.is_authenticated:
            return Response(status=401)
        try:
            backup = get_backup(request.user, _project(public_id))
        except PermissionDenied as exc:
            raise Http404 from exc
        except CloudBackupError as exc:
            return _error(exc)
        return Response(
            {"enabled": backup.enabled, "read_only": backup.read_only, "revision": backup.revision}
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
