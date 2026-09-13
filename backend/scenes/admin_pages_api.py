"""Application-admin CMS page API (issue #517)."""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.admin_authorization import is_application_admin
from scenes.admin_pages import (
    PageProtected,
    PageRevisionConflict,
    PageValidationFailed,
    create_page,
    list_admin_pages,
    soft_delete_page,
    update_page,
)
from scenes.models import Page


def _admin_required_response(request):
    if not request.user.is_authenticated:
        return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
    if not is_application_admin(request.user):
        return Response(
            {"detail": "Application-admin authorization required."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _payload(view):
    return {
        "id": view.id,
        "title": view.title,
        "slug": view.slug,
        "description": view.description,
        "status": view.status,
        "nav_label": view.nav_label,
        "show_in_nav": view.show_in_nav,
        "sort_order": view.sort_order,
        "system_key": view.system_key,
        "author": view.author,
        "revision": view.revision,
        "updated_at": view.updated_at,
        "updated_by": view.updated_by,
    }


class AdminPageListCreateView(APIView):
    def get(self, request):
        denied = _admin_required_response(request)
        if denied:
            return denied
        return Response([_payload(view) for view in list_admin_pages()])

    def post(self, request):
        denied = _admin_required_response(request)
        if denied:
            return denied
        try:
            view = create_page(actor=request.user, data=dict(request.data))
        except PageValidationFailed as exc:
            return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        return Response(_payload(view), status=status.HTTP_201_CREATED)


class AdminPageDetailView(APIView):
    def patch(self, request, pk):
        denied = _admin_required_response(request)
        if denied:
            return denied
        revision = request.data.get("revision")
        if not isinstance(revision, int) or isinstance(revision, bool):
            return Response(
                {"error": "revision_required", "detail": "revision is required."}, status=400
            )
        try:
            view = update_page(
                actor=request.user,
                page_id=pk,
                expected_revision=revision,
                data={key: value for key, value in request.data.items() if key != "revision"},
            )
        except PageRevisionConflict as exc:
            return Response({"error": "revision_conflict", "detail": str(exc)}, status=409)
        except PageValidationFailed as exc:
            return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        except Page.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        return Response(_payload(view))

    def delete(self, request, pk):
        denied = _admin_required_response(request)
        if denied:
            return denied
        revision = request.data.get("revision")
        if not isinstance(revision, int) or isinstance(revision, bool):
            return Response(
                {"error": "revision_required", "detail": "revision is required."}, status=400
            )
        try:
            soft_delete_page(actor=request.user, page_id=pk, expected_revision=revision)
        except PageRevisionConflict as exc:
            return Response({"error": "revision_conflict", "detail": str(exc)}, status=409)
        except PageProtected as exc:
            return Response({"error": "page_protected", "detail": str(exc)}, status=409)
        except Page.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        return Response(status=status.HTTP_204_NO_CONTENT)
