"""Application-admin content console API (#518)."""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.admin_authorization import is_application_admin
from scenes.admin_content import (
    AdminContentConflict,
    AdminContentValidationFailed,
    apply_action,
    list_content,
    set_application_access,
)


def _admin_required(request):
    if not request.user.is_authenticated:
        return Response({"detail": "Authentication required."}, status=401)
    if not is_application_admin(request.user):
        return Response(
            {"detail": "Application-admin authorization required."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _payload(row):
    if isinstance(row, dict):
        return row
    return {
        "resource_type": row.resource_type,
        "resource_id": row.resource_id,
        "title": row.title,
        "owner": row.owner,
        "status": row.status,
        "updated_at": row.updated_at,
        "deleted": row.deleted,
        "version_count": row.version_count,
    }


class AdminContentListView(APIView):
    def get(self, request):
        denied = _admin_required(request)
        if denied:
            return denied
        return Response([_payload(row) for row in list_content()])


class AdminContentActionView(APIView):
    def post(self, request):
        denied = _admin_required(request)
        if denied:
            return denied
        try:
            row = apply_action(
                actor=request.user,
                resource_type=request.data.get("resource_type"),
                resource_id=request.data.get("resource_id"),
                action=request.data.get("action"),
            )
        except AdminContentValidationFailed as exc:
            return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        except AdminContentConflict as exc:
            return Response({"error": "content_conflict", "detail": str(exc)}, status=409)
        return Response(_payload(row))


class AdminContentAccessView(APIView):
    def post(self, request):
        denied = _admin_required(request)
        if denied:
            return denied
        try:
            result = set_application_access(
                actor=request.user,
                username=request.data.get("username"),
                granted=request.data.get("granted"),
            )
        except AdminContentValidationFailed as exc:
            return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        except AdminContentConflict as exc:
            return Response({"error": "access_conflict", "detail": str(exc)}, status=409)
        return Response(result)
