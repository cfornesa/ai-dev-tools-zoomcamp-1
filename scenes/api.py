"""REST API views for the scenes domain (Tasks 13-15).

Every view here checks authorization exclusively through
`scenes.permissions` (Task 11) — no view hand-rolls its own `owner_id ==`
check. A denied request to a project-shaped URL always returns 404, never
403: this means "not found" and "found but not yours" are indistinguishable
responses, so a private project's existence is never confirmed to an
unauthorized caller (Task 13's "without confirming hidden data").
"""

import copy
import json
import uuid

from django.db import IntegrityError, transaction
from django.db.models import Max
from django.http import Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.models import Project, SceneVersion
from scenes.permissions import Action, can
from scenes.serializers import (
    ProjectMetadataSerializer,
    ProjectSerializer,
    SceneVersionCreateSerializer,
    SceneVersionDetailSerializer,
    SceneVersionListSerializer,
)
from scenes.validation import SCHEMA_DIR, validate_scene

with (SCHEMA_DIR / "fixtures" / "valid" / "blank.json").open() as _f:
    _BLANK_SCENE_FIXTURE: dict = json.load(_f)


def _get_project_or_404(public_id) -> Project:
    try:
        return Project.objects.select_related("owner").get(public_id=public_id)
    except (Project.DoesNotExist, ValueError, TypeError) as exc:
        raise Http404 from exc


def _require_or_404(user, action: Action, project: Project) -> None:
    if not can(user, action, project):
        raise Http404


class ProjectListCreateView(APIView):
    def get(self, request):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        projects = Project.objects.filter(owner=request.user).select_related("owner")
        return Response(ProjectSerializer(projects, many=True).data)

    def post(self, request):
        if not can(request.user, Action.PROJECT_CREATE):
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        project = Project.objects.create(owner=request.user)
        return Response(ProjectSerializer(project).data, status=status.HTTP_201_CREATED)


class ProjectDetailView(APIView):
    def get(self, request, public_id):
        project = _get_project_or_404(public_id)
        _require_or_404(request.user, Action.PROJECT_READ, project)
        return Response(ProjectSerializer(project).data)

    def patch(self, request, public_id):
        project = _get_project_or_404(public_id)
        _require_or_404(request.user, Action.PROJECT_WRITE, project)

        serializer = ProjectMetadataSerializer(project, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()  # single-row update: no multi-record transaction needed

        return Response(ProjectSerializer(project).data)

    def delete(self, request, public_id):
        project = _get_project_or_404(public_id)
        _require_or_404(request.user, Action.PROJECT_DELETE, project)

        project.is_deleted = True
        project.deleted_at = timezone.now()
        project.save(update_fields=["is_deleted", "deleted_at"])

        return Response(status=status.HTTP_204_NO_CONTENT)


class SceneVersionListCreateView(APIView):
    """Task 14: list a project's history, and save the next immutable version.

    A save is exactly one transaction: lock the project row, compute the
    next sequence number from inside that lock, create the version, and
    advance `current_version` — all four steps commit together or not at
    all. `select_for_update()` is what makes two genuinely concurrent
    saves serialize instead of racing to the same sequence number; on
    SQLite (offline tests) it's silently a no-op (no row locking support),
    which is fine for single-threaded correctness tests but proves
    nothing about real concurrency — see tests/test_scene_version_save_api.py
    for the PostgreSQL-gated concurrency tests that do.
    """

    def get(self, request, public_id):
        project = _get_project_or_404(public_id)
        _require_or_404(request.user, Action.VERSION_READ, project)

        versions = project.versions.filter(is_deleted=False).order_by("sequence")
        return Response(SceneVersionListSerializer(versions, many=True).data)

    def post(self, request, public_id):
        project = _get_project_or_404(public_id)
        _require_or_404(request.user, Action.VERSION_CREATE, project)

        input_serializer = SceneVersionCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        scene_json = input_serializer.validated_data["scene_json"]

        # Authoritative server-side validation, independent of whatever the
        # browser already checked (Task 6).
        result = validate_scene(scene_json)
        if not result.valid:
            return Response(
                {
                    "errors": [
                        {"path": e.path, "rule": e.rule, "message": e.message}
                        for e in result.errors
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                locked_project = Project.objects.select_for_update().get(pk=project.pk)
                next_sequence = (
                    locked_project.versions.aggregate(Max("sequence"))["sequence__max"] or 0
                ) + 1
                version = SceneVersion.objects.create(
                    project=locked_project,
                    sequence=next_sequence,
                    scene_json=scene_json,
                    created_by=request.user if request.user.is_authenticated else None,
                    parent=locked_project.current_version,
                    origin=input_serializer.validated_data["origin"],
                    change_label=input_serializer.validated_data.get("change_label", ""),
                )
                locked_project.current_version = version
                locked_project.save(update_fields=["current_version", "updated_at"])
        except Project.DoesNotExist as exc:
            # Soft-deleted concurrently, between the initial fetch above and
            # the locked re-fetch: no version is created, current_version is
            # untouched (the whole atomic block rolled back).
            raise Http404 from exc

        return Response(SceneVersionDetailSerializer(version).data, status=status.HTTP_201_CREATED)


def _get_version_or_404(project: Project, version_id) -> SceneVersion:
    """Scoped to `project`, so a version id from another project 404s exactly like a
    nonexistent one — no separate cross-project check needed, and no data leaked either way.
    """
    try:
        # `SceneVersion.objects` has no soft-delete filtering (unlike `Project.objects`):
        # a soft-deleted version stays reachable here on purpose — see Task 15's
        # restore-from-a-soft-deleted-source policy in SceneVersionRestoreView.
        return project.versions.get(pk=version_id)
    except (SceneVersion.DoesNotExist, ValueError, TypeError) as exc:
        raise Http404 from exc


class CannotModifyCurrentVersion(Exception):
    """Raised inside an atomic block to abort restoring/deleting the current version."""


class SceneVersionDetailView(APIView):
    """Task 15: soft-delete a single eligible (non-current) historical version."""

    def delete(self, request, public_id, version_id):
        project = _get_project_or_404(public_id)
        _require_or_404(request.user, Action.VERSION_DELETE, project)
        version = _get_version_or_404(project, version_id)

        try:
            with transaction.atomic():
                locked_project = Project.objects.select_for_update().get(pk=project.pk)
                if locked_project.current_version_id == version.pk:
                    raise CannotModifyCurrentVersion
                version.is_deleted = True
                version.deleted_at = timezone.now()
                version.save()
        except CannotModifyCurrentVersion:
            return Response(
                {"detail": "The current version cannot be soft-deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Project.DoesNotExist as exc:
            raise Http404 from exc

        return Response(status=status.HTTP_204_NO_CONTENT)


class SceneVersionRestoreView(APIView):
    """Task 15: restore a historical version by creating a new current version from it.

    Policy (explicitly documented, per the acceptance criteria): restoring
    from a source version that is itself soft-deleted IS allowed. Soft
    deleting only hides a version from the default history listing; it
    doesn't destroy the (already-immutable) snapshot, and "recoverable"
    delete is meaningless if a trashed version can never be restored from.
    Restoring never un-deletes the source — the source's `is_deleted`
    stays exactly as it was; only a brand-new, non-deleted version is
    created.
    """

    def post(self, request, public_id, version_id):
        project = _get_project_or_404(public_id)
        _require_or_404(request.user, Action.VERSION_RESTORE, project)
        source = _get_version_or_404(project, version_id)

        try:
            with transaction.atomic():
                locked_project = Project.objects.select_for_update().get(pk=project.pk)
                if locked_project.current_version_id == source.pk:
                    raise CannotModifyCurrentVersion
                next_sequence = (
                    locked_project.versions.aggregate(Max("sequence"))["sequence__max"] or 0
                ) + 1
                new_version = SceneVersion.objects.create(
                    project=locked_project,
                    sequence=next_sequence,
                    scene_json=copy.deepcopy(source.scene_json),
                    created_by=request.user if request.user.is_authenticated else None,
                    parent=source,
                    origin=SceneVersion.Origin.RESTORE,
                    change_label=f"Restored from version {source.sequence}",
                )
                locked_project.current_version = new_version
                locked_project.save(update_fields=["current_version", "updated_at"])
        except CannotModifyCurrentVersion:
            return Response(
                {"detail": "The current version cannot be restored."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Project.DoesNotExist as exc:
            raise Http404 from exc

        return Response(
            SceneVersionDetailSerializer(new_version).data, status=status.HTTP_201_CREATED
        )


class BlankProjectCreateView(APIView):
    """Task 18: atomically create a private project with one initial blank-canvas version.

    Idempotency policy (explicit, per the acceptance criteria): the client
    may send a `client_request_id` (a UUID it generates once, e.g. when the
    "Create" button is first clicked). A repeated submission with the same
    `client_request_id` for the same user never creates a second project —
    it returns the project created by the original request (200, not 201).
    This is enforced by a real database uniqueness constraint
    (`Project.creation_request_id`), not just an application-level check,
    so it holds even under genuinely concurrent duplicate submissions (e.g.
    a double-click firing two overlapping requests) — see
    tests/test_blank_project_creation_api.py's PostgreSQL-gated test.
    Omitting `client_request_id` skips deduplication entirely (each such
    request always creates a new project).
    """

    def post(self, request):
        if not can(request.user, Action.PROJECT_CREATE):
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        raw_request_id = request.data.get("client_request_id")
        request_id = None
        if raw_request_id is not None:
            try:
                request_id = uuid.UUID(str(raw_request_id))
            except (ValueError, TypeError):
                return Response(
                    {"client_request_id": ["Must be a valid UUID."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            existing = Project.objects.filter(
                owner=request.user, creation_request_id=request_id
            ).first()
            if existing is not None:
                return Response(ProjectSerializer(existing).data, status=status.HTTP_200_OK)

        blank_scene = copy.deepcopy(_BLANK_SCENE_FIXTURE)
        blank_scene["id"] = f"scene-{uuid.uuid4()}"

        result = validate_scene(blank_scene)
        if not result.valid:  # pragma: no cover — would mean the fixture itself is broken
            return Response(
                {"detail": "Internal error creating the blank scene."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            with transaction.atomic():
                project = Project.objects.create(owner=request.user, creation_request_id=request_id)
                version = SceneVersion.objects.create(
                    project=project,
                    sequence=1,
                    scene_json=blank_scene,
                    created_by=request.user,
                    origin=SceneVersion.Origin.MANUAL,
                    change_label="Blank canvas",
                )
                project.current_version = version
                project.save(update_fields=["current_version", "updated_at"])
        except IntegrityError:
            # A concurrent duplicate submission won the race on
            # creation_request_id's unique constraint between our pre-check
            # above and this insert. No partial project/version from this
            # request was left behind (the whole block rolled back) —
            # return the winner's project, same as the pre-check path.
            existing = Project.objects.get(owner=request.user, creation_request_id=request_id)
            return Response(ProjectSerializer(existing).data, status=status.HTTP_200_OK)

        return Response(ProjectSerializer(project).data, status=status.HTTP_201_CREATED)
