"""REST API views for the Project3D/SceneVersion3D resource family.

Split out of `scenes/api.py` (task 218/#250) to mirror this codebase's
established 2D/3D module convention (`ai_api.py`/`ai_api3d.py`,
`thumbnails.py`/`thumbnails3d.py`, `validation.py`/`validation3d.py`,
`patch.py`/`patch3d.py`) — `api.py` was the one remaining domain module
still mixing both resource families in one file. Pure move, no behavior
change: see `_get_project3d_or_404`'s original docstring note on why this
resource family gets its own helper pair rather than overloading the 2D
`_get_project_or_404`/`_require_or_404` helpers in `scenes/api.py`.
"""

import copy
import json
import uuid

from django.db import transaction
from django.db.models import Max
from django.http import Http404, HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.models import Project3D, SceneVersion3D, Thumbnail3D
from scenes.permissions import Action, can
from scenes.publishing import validate_meaningful_metadata_3d
from scenes.serializers import (
    Project3DMetadataSerializer,
    Project3DSerializer,
    PublicProject3DSerializer,
    SceneVersion3DCreateSerializer,
    SceneVersion3DSerializer,
)
from scenes.thumbnail_generation3d import (
    ensure_thumbnail_for_version3d,
    maybe_schedule_thumbnail_generation3d,
)
from scenes.validation import SCHEMA_DIR
from scenes.validation3d import validate_scene3d

with (SCHEMA_DIR / "fixtures3d" / "valid" / "minimal.json").open() as _f:
    _MINIMAL_SCENE_3D_FIXTURE: dict = json.load(_f)


def _get_project3d_or_404(public_id) -> Project3D:
    try:
        return Project3D.objects.select_related("owner").get(public_id=public_id)
    except (Project3D.DoesNotExist, ValueError, TypeError) as exc:
        raise Http404 from exc


class Project3DListCreateView(APIView):
    """#213: minimal creation/list surface for the 3D scene document family.

    No `client_request_id` idempotency key yet (unlike
    `BlankProjectCreateView`) -- deferred until a real client needs
    duplicate-submission protection, matching #212's own deferred-scope
    note. No `renderer` field either: #210's `scene3d.schema.json` has no
    `renderer.preferred` concept (three.js/A-Frame renderer selection is a
    later #209 phase, not part of the document itself).
    """

    def get(self, request):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        projects = Project3D.objects.filter(owner=request.user).select_related(
            "owner", "current_version"
        )
        return Response(Project3DSerializer(projects, many=True).data)

    def post(self, request):
        if not can(request.user, Action.PROJECT3D_CREATE):
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        scene = copy.deepcopy(_MINIMAL_SCENE_3D_FIXTURE)
        scene["id"] = f"scene3d-{uuid.uuid4()}"

        result = validate_scene3d(scene)
        if not result.valid:  # pragma: no cover — would mean the fixture itself is broken
            return Response(
                {"detail": "Internal error creating the blank 3D scene."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        with transaction.atomic():
            project = Project3D.objects.create(owner=request.user)
            version = SceneVersion3D.objects.create(
                project=project,
                sequence=1,
                scene_json=scene,
                created_by=request.user,
                origin=SceneVersion3D.Origin.MANUAL,
            )
            project.current_version = version
            project.save(update_fields=["current_version", "updated_at"])
            # Issue #243: the blank scene's own first version is still a
            # "SceneVersion3D save" for thumbnail-scheduling purposes.
            maybe_schedule_thumbnail_generation3d(project)

        return Response(Project3DSerializer(project).data, status=status.HTTP_201_CREATED)


class Project3DDetailView(APIView):
    def get(self, request, public_id):
        project = _get_project3d_or_404(public_id)
        if not can(request.user, Action.PROJECT3D_READ, project):
            raise Http404
        return Response(Project3DSerializer(project).data)

    def patch(self, request, public_id):
        # Issue #301: title-only metadata PATCH, mirroring
        # `ProjectDetailView.patch` -- see `Project3DMetadataSerializer`'s
        # own doc comment for why it's scoped to just `title`.
        project = _get_project3d_or_404(public_id)
        if not can(request.user, Action.PROJECT3D_WRITE, project):
            raise Http404

        serializer = Project3DMetadataSerializer(project, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(Project3DSerializer(project).data)

    def delete(self, request, public_id):
        project = _get_project3d_or_404(public_id)
        if not can(request.user, Action.PROJECT3D_DELETE, project):
            raise Http404

        project.is_deleted = True
        project.deleted_at = timezone.now()
        project.save(update_fields=["is_deleted", "deleted_at"])

        return Response(status=status.HTTP_204_NO_CONTENT)


class Project3DPublishValidationError(Exception):
    """Raised inside an atomic block to abort a publish that fails validation."""

    def __init__(self, errors: dict[str, list[str]]):
        self.errors = errors


class Project3DPublishView(APIView):
    """Issue #296: the Project3D counterpart of `ProjectPublishView`
    (`scenes/api.py`) -- same lock-then-validate-then-flip shape, same
    "current saved version resolved fresh at request time, never
    snapshotted" guarantee for `PublicProject3DDetailView` below. Only
    title is validated (`validate_meaningful_metadata_3d`): Project3D has
    no `description` field to check, a deliberate scope boundary (see
    that model's own comment)."""

    def post(self, request, public_id):
        project = _get_project3d_or_404(public_id)
        if not can(request.user, Action.PROJECT3D_PUBLISH, project):
            raise Http404

        try:
            with transaction.atomic():
                locked_project = Project3D.objects.select_for_update().get(pk=project.pk)

                errors = validate_meaningful_metadata_3d(locked_project.title)
                if locked_project.current_version_id is None:
                    errors.setdefault("current_version", []).append(
                        "Save at least one version before publishing."
                    )
                if errors:
                    raise Project3DPublishValidationError(errors)

                locked_project.visibility = Project3D.Visibility.PUBLIC
                locked_project.published_at = timezone.now()
                locked_project.save(update_fields=["visibility", "published_at", "updated_at"])
        except Project3DPublishValidationError as exc:
            return Response({"errors": exc.errors}, status=status.HTTP_400_BAD_REQUEST)
        except Project3D.DoesNotExist as exc:
            raise Http404 from exc

        return Response(Project3DSerializer(locked_project).data)


class Project3DUnpublishView(APIView):
    """Issue #296: the Project3D counterpart of `ProjectUnpublishView` --
    same "no content validation needed to go private, immediate effect"
    shape."""

    def post(self, request, public_id):
        project = _get_project3d_or_404(public_id)
        if not can(request.user, Action.PROJECT3D_PUBLISH, project):
            raise Http404

        try:
            with transaction.atomic():
                locked_project = Project3D.objects.select_for_update().get(pk=project.pk)
                locked_project.visibility = Project3D.Visibility.PRIVATE
                locked_project.published_at = None
                locked_project.save(update_fields=["visibility", "published_at", "updated_at"])
        except Project3D.DoesNotExist as exc:
            raise Http404 from exc

        return Response(Project3DSerializer(locked_project).data)


class PublicProject3DDetailView(APIView):
    """Issue #296: the Project3D counterpart of `PublicProjectDetailView` --
    same absolute "404 for literally everyone, owner included, the instant
    visibility isn't public" gate, checked directly rather than through
    `Action.PROJECT3D_READ` (which also happily returns a private project
    to its own owner -- correct for the owner-scoped API, wrong here)."""

    def get(self, request, public_id):
        project = _get_project3d_or_404(public_id)
        if project.visibility != Project3D.Visibility.PUBLIC:
            raise Http404
        return Response(PublicProject3DSerializer(project).data)


class SceneVersion3DListCreateView(APIView):
    """#228: save a new SceneVersion3D. Mirrors SceneVersionListCreateView's
    transaction pattern at this issue's smaller scope -- no listing/restore
    yet (explicitly out of scope; a later follow-on once #227/#232 reveal
    what's actually needed)."""

    def post(self, request, public_id):
        project = _get_project3d_or_404(public_id)
        if not can(request.user, Action.PROJECT3D_WRITE, project):
            raise Http404

        input_serializer = SceneVersion3DCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        scene_json = input_serializer.validated_data["scene_json"]

        result = validate_scene3d(scene_json)
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
                locked_project = Project3D.objects.select_for_update().get(pk=project.pk)
                next_sequence = (
                    locked_project.versions.aggregate(Max("sequence"))["sequence__max"] or 0
                ) + 1
                version = SceneVersion3D.objects.create(
                    project=locked_project,
                    sequence=next_sequence,
                    scene_json=scene_json,
                    created_by=request.user,
                    origin=SceneVersion3D.Origin.MANUAL,
                )
                locked_project.current_version = version
                locked_project.save(update_fields=["current_version", "updated_at"])
                # Issue #243: schedule (as a post-commit follow-up, mirroring
                # the 2D `maybe_schedule_thumbnail_generation` placement)
                # generating a thumbnail for the version that just became
                # current.
                maybe_schedule_thumbnail_generation3d(locked_project)
        except Project3D.DoesNotExist as exc:
            raise Http404 from exc

        return Response(SceneVersion3DSerializer(version).data, status=status.HTTP_201_CREATED)


class Project3DThumbnailView(APIView):
    """Issue #243: the 3D counterpart of `ProjectThumbnailView` -- serves
    the gallery-card thumbnail (PNG) for a `Project3D`'s current version,
    owner-gated the same way (`Action.PROJECT3D_READ`, 404 for anyone
    else, mirroring `_get_project3d_or_404`'s not-403 convention). There
    is no public-facing 3D route to mirror `PublicProjectThumbnailView`
    yet -- `Project3D` has no `visibility` field (see
    `scenes/thumbnail_generation3d.py`'s module docstring). Lazily
    generates on first request if the current version has no stored
    `Thumbnail3D` yet, identical to the 2D lazy-fallback behavior.
    """

    def get(self, request, public_id):
        project = _get_project3d_or_404(public_id)
        if not can(request.user, Action.PROJECT3D_READ, project):
            raise Http404
        if project.current_version_id is None:
            raise Http404

        thumbnail = Thumbnail3D.objects.filter(scene_version_id=project.current_version_id).first()
        if thumbnail is None:
            thumbnail = ensure_thumbnail_for_version3d(project.current_version_id)
        if thumbnail is None:
            raise Http404

        return HttpResponse(bytes(thumbnail.image_data), content_type=thumbnail.content_type)
