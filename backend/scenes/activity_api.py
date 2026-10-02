"""Owner-only, bounded project-family activity reads (#1133, #1156)."""

import re
from datetime import datetime

from django.core import signing
from django.db.models import Q
from django.http import Http404
from django.utils.dateparse import parse_datetime
from django.utils.timezone import is_aware
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.models import Project, Project3D, ProjectActivity
from scenes.permissions import Action, can

__all__ = ["ProjectActivityListView", "Project3DActivityListView"]

_CURSOR_SALT = "scenes.project-activity.cursor.v1"
_CURSOR_SALT_3D = "scenes.project3d-activity.cursor.v1"
_DETAIL_KEYS = frozenset(
    {
        "sequence",
        "origin",
        "restored_from_sequence",
        "run_id",
        "scope",
        "operation",
        "change_summary",
        "reason",
    }
)
_DEFAULT_LIMIT = 25
_MAX_LIMIT = 100


def _invalid_cursor() -> Response:
    return Response({"errors": {"cursor": ["Invalid cursor."]}}, status=400)


def _encode_cursor(
    project_id: str,
    created_at: datetime,
    activity_id: int,
    *,
    salt: str = _CURSOR_SALT,
) -> str:
    return signing.dumps(
        {"v": 1, "project": project_id, "created_at": created_at.isoformat(), "id": activity_id},
        salt=salt,
        compress=True,
    )


def _decode_cursor(
    value: str, project_id: str, *, salt: str = _CURSOR_SALT
) -> tuple[datetime, int] | None:
    try:
        payload = signing.loads(value, salt=salt)
        if (
            not isinstance(payload, dict)
            or payload.get("v") != 1
            or payload.get("project") != project_id
            or isinstance(payload.get("id"), bool)
            or not isinstance(payload.get("id"), int)
            or payload["id"] < 1
            or not isinstance(payload.get("created_at"), str)
        ):
            return None
        created_at = parse_datetime(payload["created_at"])
        if created_at is None or not is_aware(created_at):
            return None
        return created_at, payload["id"]
    except (signing.BadSignature, TypeError, ValueError, KeyError, OverflowError):
        return None


def _parse_limit(value: str | None) -> int | None:
    if value is None:
        return _DEFAULT_LIMIT
    if re.fullmatch(r"[0-9]+", value) is None:
        return None
    limit = int(value)
    return limit if 1 <= limit <= _MAX_LIMIT else None


class _ProjectFamilyActivityListView(APIView):
    """Shared bounded, privacy-projected activity reader for one owner family."""

    resource_model: type[Project] | type[Project3D] = Project
    permission = Action.PROJECT_ACTIVITY_READ
    activity_field = "project"
    cursor_salt = _CURSOR_SALT

    def get(self, request, public_id):
        try:
            # The default manager hides soft-deleted projects. This owner API
            # deliberately retains read access during the existing grace period.
            project = self.resource_model.all_objects.get(public_id=public_id)
        except (self.resource_model.DoesNotExist, ValueError, TypeError) as exc:
            raise Http404 from exc

        if not can(request.user, self.permission, project):
            raise Http404

        raw_limit = request.query_params.get("limit")
        limit = _parse_limit(raw_limit)
        if limit is None:
            return Response(
                {"errors": {"limit": ["Must be an integer from 1 to 100."]}}, status=400
            )

        cursor_created_at = None
        cursor_id = None
        if "cursor" in request.query_params:
            raw_cursor = request.query_params.get("cursor", "")
            if len(raw_cursor) > 512:
                return _invalid_cursor()
            decoded = _decode_cursor(raw_cursor, str(project.public_id), salt=self.cursor_salt)
            if decoded is None:
                return _invalid_cursor()
            cursor_created_at, cursor_id = decoded

        events = ProjectActivity.objects.filter(
            **{f"{self.activity_field}_id": project.pk}
        ).select_related("actor")
        if cursor_created_at is not None and cursor_id is not None:
            events = events.filter(
                Q(created_at__lt=cursor_created_at)
                | Q(created_at=cursor_created_at, id__lt=cursor_id)
            )

        # The bounded page plus one sentinel row determines whether to issue a
        # continuation cursor; the composite index supports this exact order.
        page = list(events.order_by("-created_at", "-id")[: limit + 1])
        has_more = len(page) > limit
        page = page[:limit]
        results = []
        for event in page:
            metadata = event.metadata if isinstance(event.metadata, dict) else {}
            results.append(
                {
                    "id": event.pk,
                    "action_type": event.action_type,
                    "label": event.get_action_type_display(),
                    "actor_display": event.actor.username if event.actor_id else None,
                    "created_at": event.created_at.isoformat(),
                    "details": {key: metadata[key] for key in _DETAIL_KEYS if key in metadata},
                }
            )

        next_cursor = None
        if has_more and page:
            last = page[-1]
            next_cursor = _encode_cursor(
                str(project.public_id), last.created_at, last.pk, salt=self.cursor_salt
            )
        return Response({"results": results, "next_cursor": next_cursor})


class ProjectActivityListView(_ProjectFamilyActivityListView):
    """Read 2D activity; retain the #1133 cursor signing format."""


class Project3DActivityListView(_ProjectFamilyActivityListView):
    """Read activity only for the authenticated owner of a structured 3D project."""

    resource_model = Project3D
    permission = Action.PROJECT3D_ACTIVITY_READ
    activity_field = "project3d"
    cursor_salt = _CURSOR_SALT_3D
