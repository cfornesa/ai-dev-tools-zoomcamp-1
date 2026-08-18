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
from django.http import Http404, HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.gallery import (
    DEFAULT_PAGE_SIZE,
    InvalidCursor,
    clamp_page_size,
    decode_cursor,
    eligible_projects,
    encode_cursor,
    filter_after_cursor,
)
from scenes.models import (
    EditSessionDraft,
    Project,
    ProjectActivity,
    SceneVersion,
    Template,
    Thumbnail,
    default_draft_expiry,
)
from scenes.permissions import Action, can, require
from scenes.publishing import validate_meaningful_metadata
from scenes.serializers import (
    DraftSerializer,
    DraftUpsertSerializer,
    ProjectMetadataSerializer,
    ProjectSerializer,
    PublicProjectListItemSerializer,
    PublicProjectSerializer,
    SceneVersionCreateSerializer,
    SceneVersionDetailSerializer,
    SceneVersionListSerializer,
    TemplateCreateSerializer,
    TemplateSerializer,
)
from scenes.thumbnail_generation import (
    ensure_thumbnail_for_version,
    maybe_schedule_thumbnail_generation,
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


class ProjectPublishValidationError(Exception):
    """Raised inside an atomic block to abort a publish that fails validation."""

    def __init__(self, errors: dict[str, list[str]]):
        self.errors = errors


class ProjectPublishView(APIView):
    """Task 49: switch a project from private to public.

    Owner-only (`Action.PROJECT_PUBLISH`, same 404-not-403 convention as
    every other project-scoped endpoint — a non-owner can't tell a private
    project apart from one that doesn't exist). Two things must both hold
    before `visibility` flips, checked *inside* the same
    `select_for_update()`-locked transaction that performs the flip so a
    concurrent metadata edit or version save can't slip past a
    check-then-act gap:

    1. Meaningful content: `scenes.publishing.validate_meaningful_metadata`
       against the project's *current* title/description, read fresh under
       the lock. A failure returns 400 with field-level `errors`, never a
       generic failure, and leaves `visibility` untouched.
    2. At least one saved version exists (`current_version` is not null).
       A bare `Project.objects.create()` — `ProjectListCreateView.post` —
       has no version yet; publishing that would make "the current saved
       version" a meaningless concept, so it's rejected the same way as a
       content-validation failure.

    What "the current saved version reachable at a stable public URL"
    means concretely: `PublicProjectDetailView` (below) always resolves
    `project.current_version` *fresh, at request time* — this endpoint
    never copies/snapshots a version into some separate "published
    version" pointer. So there is no race to protect against between "the
    version that was current when Publish was clicked" and "the version a
    visitor's request sees a moment later": by construction, a public
    visitor always sees whatever is current right now, and a save made
    after publishing simply becomes the newly current public version, per
    `_docs/plan.md`'s "Switching from private to public immediately makes
    the project's current saved version available." The lock here exists
    only to make the validate-then-flip sequence atomic against a
    concurrent metadata edit, not to pin a version.

    No "stale request" concept applies to publish itself: the client
    sends no version id, ETag, or other stale-base token for this action —
    every check reads the row fresh under the lock, so there is nothing
    for a stale request to be stale *about*. (Contrast with
    `SceneVersionDetailView.delete`/`SceneVersionRestoreView.post`, which
    reject acting on a version that turned out to be the current one by
    the time the lock was acquired — publish has no equivalent resource
    identity to go stale.)
    """

    def post(self, request, public_id):
        project = _get_project_or_404(public_id)
        _require_or_404(request.user, Action.PROJECT_PUBLISH, project)

        try:
            with transaction.atomic():
                locked_project = Project.objects.select_for_update().get(pk=project.pk)

                errors = validate_meaningful_metadata(
                    locked_project.title, locked_project.description
                )
                if locked_project.current_version_id is None:
                    errors.setdefault("current_version", []).append(
                        "Save at least one version before publishing."
                    )
                if errors:
                    raise ProjectPublishValidationError(errors)

                locked_project.visibility = Project.Visibility.PUBLIC
                # Task 50: (re)stamp published_at on every successful publish
                # -- see scenes/gallery.py's module docstring for why this,
                # not updated_at, is the public gallery's sort/cursor key.
                locked_project.published_at = timezone.now()
                locked_project.save(update_fields=["visibility", "published_at", "updated_at"])
                ProjectActivity.objects.create(
                    project=locked_project,
                    actor=request.user,
                    action_type=ProjectActivity.ActionType.PUBLISHED,
                    metadata={"version_sequence": locked_project.current_version.sequence},
                )
                # Task 54: schedule (as a post-commit follow-up, not inside
                # this lock -- see scenes/thumbnail_generation.py's module
                # docstring) generating a thumbnail for the version that
                # just became publicly visible.
                maybe_schedule_thumbnail_generation(locked_project)
        except ProjectPublishValidationError as exc:
            return Response({"errors": exc.errors}, status=status.HTTP_400_BAD_REQUEST)
        except Project.DoesNotExist as exc:
            raise Http404 from exc

        return Response(ProjectSerializer(locked_project).data)


class ProjectUnpublishView(APIView):
    """Task 49: switch a project back to private, immediately.

    Owner-only, same as `ProjectPublishView`. No content validation is
    needed to go *private* (only publishing requires meaningful content);
    there is also no confirmation step server-side — `_docs/plan.md` says
    switching back to private "immediately removes it from the gallery
    and disables public access," and the frontend confirmation dialog
    (Task 49's own UI) is scoped to the private-to-public direction only,
    matching the acceptance criteria's "first private-to-public action"
    wording.

    `SceneVersion` history is never touched by this view — there is no
    code path here that could reach it — so "retaining project and
    version history" on unpublish is true by construction, not by a
    separate check.
    """

    def post(self, request, public_id):
        project = _get_project_or_404(public_id)
        _require_or_404(request.user, Action.PROJECT_PUBLISH, project)

        try:
            with transaction.atomic():
                locked_project = Project.objects.select_for_update().get(pk=project.pk)
                locked_project.visibility = Project.Visibility.PRIVATE
                # Task 50: clear published_at so the very next public-gallery
                # request excludes this project -- no stale card lingers
                # because of a cached/prior publish timestamp.
                locked_project.published_at = None
                locked_project.save(update_fields=["visibility", "published_at", "updated_at"])
                ProjectActivity.objects.create(
                    project=locked_project,
                    actor=request.user,
                    action_type=ProjectActivity.ActionType.UNPUBLISHED,
                    metadata={},
                )
        except Project.DoesNotExist as exc:
            raise Http404 from exc

        return Response(ProjectSerializer(locked_project).data)


class PublicProjectDetailView(APIView):
    """Task 49: minimal, anonymous-reachable read of a *published* project.

    This is server-side data plumbing only — Tasks 50/51 (public gallery
    listing, public project viewer page) are explicitly out of scope here
    and are NOT built by this view. It exists so `public_id` resolves to
    something at a stable URL (`/api/public/projects/<public_id>/`) for
    those future tasks to consume.

    Gated strictly on `visibility == PUBLIC`, checked directly rather than
    through `Action.PROJECT_READ` — `PROJECT_READ` also happily returns a
    *private* project to its own owner, which is correct for the private
    editor APIs but wrong here: this route must 404 for literally everyone,
    owner included, the instant a project isn't public, matching the
    acceptance criteria's "unpublishing immediately removes anonymous
    access" (there is no reason the owner would use this URL instead of
    the normal owner-scoped `ProjectDetailView`, so refusing them too
    costs nothing and keeps the gating rule simple and absolute).
    `PublicProjectSerializer` is the only field set this view ever
    returns — see its own docstring for why owner-private fields
    (drafts, AI prompts, `export_attribution`) can never leak through it.
    """

    def get(self, request, public_id):
        project = _get_project_or_404(public_id)
        if project.visibility != Project.Visibility.PUBLIC:
            raise Http404
        return Response(PublicProjectSerializer(project).data)


class PublicProjectListView(APIView):
    """Task 50: paginated public gallery listing (`GET /api/public/projects/`).

    Anonymous-reachable, and identical for anonymous and signed-in
    callers -- this view never branches on `request.user` at all, so
    there is no owner-only field or filter that could sneak in (Task 50's
    "anonymous and signed-in users receive the same public fields"
    acceptance criterion holds structurally, not just by convention).

    Eligibility (`visibility == public`, non-deleted, has a current
    version) and ordering are entirely `scenes.gallery.eligible_projects`'s
    responsibility; this view only adds cursor-based pagination on top --
    see `scenes/gallery.py`'s module docstring for why keyset (cursor)
    pagination, not `OFFSET`, is what makes pagination duplicate/gap-safe
    across concurrent publishes.

    Query params:
    - `cursor` (optional): an opaque token from a previous response's
      `next_cursor`. Malformed input is a 400, not a silently-wrong page.
    - `page_size` (optional): defaults to `DEFAULT_PAGE_SIZE`, clamped to
      `[1, MAX_PAGE_SIZE]` so a caller can't request an unbounded page.

    Response body: `{"results": [...], "next_cursor": str | null,
    "has_more": bool}`. `next_cursor` is `null` exactly when `has_more` is
    `false` -- the end-of-results state the frontend renders is "no
    `next_cursor`," not a magic empty-string sentinel.
    """

    def get(self, request):
        page_size_raw = request.query_params.get("page_size")
        if page_size_raw is not None:
            try:
                page_size = clamp_page_size(int(page_size_raw))
            except ValueError:
                return Response(
                    {"errors": {"page_size": ["Must be a positive integer."]}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            page_size = DEFAULT_PAGE_SIZE

        queryset = eligible_projects()

        cursor = request.query_params.get("cursor")
        if cursor:
            try:
                cursor_published_at, cursor_id = decode_cursor(cursor)
            except InvalidCursor:
                return Response(
                    {"errors": {"cursor": ["Invalid or expired cursor."]}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            queryset = filter_after_cursor(queryset, cursor_published_at, cursor_id)

        # Fetch one extra row to learn whether another page exists without
        # a separate COUNT query.
        page = list(queryset[: page_size + 1])
        has_more = len(page) > page_size
        page = page[:page_size]

        next_cursor = None
        if has_more and page:
            last = page[-1]
            next_cursor = encode_cursor(last.published_at, last.id)

        return Response(
            {
                "results": PublicProjectListItemSerializer(page, many=True).data,
                "next_cursor": next_cursor,
                "has_more": has_more,
            }
        )


class PublicProjectThumbnailView(APIView):
    """Task 54: serve the gallery-card thumbnail (PNG) for a project's
    *current* saved version.

    Gated identically to `PublicProjectDetailView` above (`visibility ==
    PUBLIC`, checked directly, 404 for literally everyone including the
    owner the instant a project isn't public) -- this is what makes the
    content-source boundary hold: nothing reachable through this route
    can ever render or serve a private project's scene, regardless of
    whether a `Thumbnail` row happens to already exist for it.

    Lazily generates on first request if the current version has no
    stored `Thumbnail` yet (see `scenes/thumbnail_generation.py`'s module
    docstring, "Lazy fallback at serve time") -- a public project is never
    left with a broken/missing thumbnail image just because the
    post-commit generation from the save/publish request that created its
    current version hasn't run yet, or predates this feature.
    """

    def get(self, request, public_id):
        project = _get_project_or_404(public_id)
        if project.visibility != Project.Visibility.PUBLIC:
            raise Http404
        if project.current_version_id is None:
            raise Http404

        thumbnail = Thumbnail.objects.filter(scene_version_id=project.current_version_id).first()
        if thumbnail is None:
            thumbnail = ensure_thumbnail_for_version(project.current_version_id)
        if thumbnail is None:
            raise Http404

        return HttpResponse(bytes(thumbnail.image_data), content_type=thumbnail.content_type)


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
                # Task 54: a no-op unless the project is already public --
                # see maybe_schedule_thumbnail_generation's docstring for
                # the "thumbnail follows current version" policy.
                maybe_schedule_thumbnail_generation(locked_project)
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
    """Task 15: soft-delete a single eligible (non-current) historical version.

    Also (Task 21): fetch a single version's full scene_json, so the editor
    workspace can load the project's current version into a working copy.
    The list endpoint (SceneVersionListCreateView.get) deliberately omits
    scene_json for every row; this is the only read path that returns it
    outside of a save/restore response.
    """

    def get(self, request, public_id, version_id):
        project = _get_project_or_404(public_id)
        _require_or_404(request.user, Action.VERSION_READ, project)
        version = _get_version_or_404(project, version_id)
        return Response(SceneVersionDetailSerializer(version).data)

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
                maybe_schedule_thumbnail_generation(locked_project)
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


def _get_template_or_404(public_id) -> Template:
    try:
        return Template.objects.select_related("owner").get(public_id=public_id)
    except (Template.DoesNotExist, ValueError, TypeError) as exc:
        raise Http404 from exc


class TemplateListView(APIView):
    """Task 20: browse built-in templates plus (if signed in) the caller's own private ones.

    Built-in templates are visible to everyone, signed in or not — see
    `Action.TEMPLATE_READ` in `scenes.permissions`. A private template is
    never included for anyone but its owner.
    """

    def get(self, request):
        templates = Template.objects.built_in()
        if request.user.is_authenticated:
            templates = templates | Template.objects.private_for(request.user)
        return Response(TemplateSerializer(templates.select_related("owner"), many=True).data)


class TemplateCloneView(APIView):
    """Task 20: atomically clone a template's scene into a new private project.

    The new project's first version is an independent copy of the
    template's `scene_json` (deep-copied, given a fresh scene id) — no FK
    or other mutable link back to the source `Template` is created, so a
    later edit to a private template (or, in principle, a re-seed of the
    built-in catalog) can never retroactively change a project that was
    already cloned from it.
    """

    def post(self, request, public_id):
        template = _get_template_or_404(public_id)
        _require_or_404(request.user, Action.TEMPLATE_READ, template)

        if not can(request.user, Action.PROJECT_CREATE):
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        cloned_scene = copy.deepcopy(template.scene_json)
        cloned_scene["id"] = f"scene-{uuid.uuid4()}"

        result = validate_scene(cloned_scene)
        if not result.valid:  # pragma: no cover — would mean a stored template is broken
            return Response(
                {"detail": "Internal error cloning this template."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        with transaction.atomic():
            project = Project.objects.create(owner=request.user, title=template.name)
            version = SceneVersion.objects.create(
                project=project,
                sequence=1,
                scene_json=cloned_scene,
                created_by=request.user,
                origin=SceneVersion.Origin.MANUAL,
                change_label=f"Cloned from template: {template.name}",
            )
            project.current_version = version
            project.save(update_fields=["current_version", "updated_at"])

        return Response(ProjectSerializer(project).data, status=status.HTTP_201_CREATED)


class SaveVersionAsTemplateView(APIView):
    """Task 21: snapshot a validated, owned version into a new private template.

    Gated by `Action.VERSION_READ` (owner-only, 404 for anyone else — same as
    every other version-scoped endpoint) rather than a bespoke ownership
    check, so a non-owner can't tell whether the project/version exists at
    all. The resulting `Template.scene_json` is an independent deep copy of
    the version's snapshot: later edits to the source project (new versions,
    soft-deletes) never touch it, mirroring `TemplateCloneView`'s own
    no-mutable-link guarantee in the opposite direction.
    """

    def post(self, request, public_id, version_id):
        project = _get_project_or_404(public_id)
        _require_or_404(request.user, Action.VERSION_READ, project)
        version = _get_version_or_404(project, version_id)

        input_serializer = TemplateCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        template = Template.objects.create(
            source_type=Template.SourceType.PRIVATE,
            owner=request.user,
            source_version=version,
            scene_json=copy.deepcopy(version.scene_json),
            **input_serializer.validated_data,
        )

        return Response(TemplateSerializer(template).data, status=status.HTTP_201_CREATED)


def _scene_validation_errors_response(result) -> Response:
    return Response(
        {"errors": [{"path": e.path, "rule": e.rule, "message": e.message} for e in result.errors]},
        status=status.HTTP_400_BAD_REQUEST,
    )


def _upsert_draft(
    project: Project, user, session_id: str, draft_json: dict, client_seq: int
) -> tuple[EditSessionDraft, bool]:
    """Task 43: race-safe create-or-update of one (project, user, session)
    draft row.

    Every write — first-ever create included — happens with the target row
    (if any) locked via `select_for_update()`, inside one transaction, so
    two genuinely overlapping upserts serialize instead of racing (same
    `select_for_update()` pattern `SceneVersionListCreateView.post` already
    uses for version saves). Whichever request's transaction commits
    second sees the first one's already-written `client_seq` and compares
    against it before applying its own write:

    - `client_seq <= stored.client_seq`: the incoming write is not newer
      than what's already stored (an out-of-order/stale sync request, or a
      genuine tie) — it is silently ignored (`applied=False`); the stored
      draft is returned unchanged. This is the guarantee an older/stale
      write can never clobber the newest accepted draft.
    - Otherwise: the write is newer — apply it and refresh `expires_at` to
      `default_draft_expiry()` (now + 24h), documenting this task's clock
      policy: the 24-hour lifetime is a rolling window measured from the
      *most recently accepted* write, not from creation.

    The very first write for a (project, user, session) triple has no
    existing row to lock, so it's attempted as a plain `create()` inside a
    savepoint; if a concurrent request wins that race, the resulting
    `IntegrityError` (on `unique_draft_scope`) is caught and retried as a
    locked update against the row the winner just created — mirroring
    `BlankProjectCreateView.post`'s own create-then-fall-back-to-existing
    pattern for its idempotency key.
    """
    with transaction.atomic():
        try:
            draft = EditSessionDraft.objects.select_for_update().get(
                project=project, user=user, session_id=session_id
            )
        except EditSessionDraft.DoesNotExist:
            draft = None

        if draft is None:
            try:
                with transaction.atomic():
                    draft = EditSessionDraft.objects.create(
                        project=project,
                        user=user,
                        session_id=session_id,
                        draft_json=draft_json,
                        client_seq=client_seq,
                    )
                return draft, True
            except IntegrityError:
                draft = EditSessionDraft.objects.select_for_update().get(
                    project=project, user=user, session_id=session_id
                )
                # fall through to the compare-and-set below

        if client_seq <= draft.client_seq:
            return draft, False

        draft.draft_json = draft_json
        draft.client_seq = client_seq
        draft.expires_at = default_draft_expiry()
        draft.save(update_fields=["draft_json", "client_seq", "expires_at", "last_autosaved_at"])
        return draft, True


class DraftDetailView(APIView):
    """Task 43: read/upsert/delete the caller's own active recovery draft
    for one project + browser-tab session.

    A draft is a temporary, non-history record — see `EditSessionDraft`'s
    own docstring in `scenes/models.py` — so nothing in this view ever
    creates, mutates, or advances a `SceneVersion`.

    Authorization is two-layered, both routed through
    `scenes.permissions` (Task 11), never a hand-rolled check:
    1. `Action.PROJECT_WRITE` on the project — V1 has no shared editing, so
       only the project's owner may have a draft for it at all; a non-owner
       (or anonymous caller) gets 404, matching every other project-scoped
       endpoint's "don't confirm hidden data" policy.
    2. `Action.DRAFT_READ`/`Action.DRAFT_WRITE` on the specific draft
       resource — always trivially satisfied once (1) holds, because every
       draft this view ever reads or writes is constructed with
       `user=request.user`, but kept as an explicit second call so draft
       access is never decided by project ownership alone if that ever
       changes.

    A draft past its `expires_at` is treated as already gone (404 on GET,
    a fresh row on PUT) rather than resurfaced — see `default_draft_expiry`
    and this task's cleanup management command
    (`scenes/management/commands/cleanup_expired_drafts.py`) for the full
    ~24-hour clock policy.
    """

    def get(self, request, public_id, session_id):
        project = _get_project_or_404(public_id)
        _require_or_404(request.user, Action.PROJECT_WRITE, project)

        draft = (
            EditSessionDraft.objects.active()
            .filter(project=project, user=request.user, session_id=session_id)
            .first()
        )
        if draft is None:
            raise Http404
        if not can(request.user, Action.DRAFT_READ, draft):  # pragma: no cover — defense in depth
            raise Http404

        return Response(DraftSerializer(draft).data)

    def put(self, request, public_id, session_id):
        project = _get_project_or_404(public_id)
        _require_or_404(request.user, Action.PROJECT_WRITE, project)

        input_serializer = DraftUpsertSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        draft_json = input_serializer.validated_data["draft_json"]
        client_seq = input_serializer.validated_data["client_seq"]

        # Authoritative server-side validation, independent of whatever the
        # browser already checked — same policy as version saves (Task 6).
        result = validate_scene(draft_json)
        if not result.valid:
            return _scene_validation_errors_response(result)

        transient = EditSessionDraft(project=project, user=request.user, session_id=session_id)
        require(request.user, Action.DRAFT_WRITE, transient)  # pragma: no branch — always true here

        draft, applied = _upsert_draft(project, request.user, session_id, draft_json, client_seq)

        body = DraftSerializer(draft).data
        body["applied"] = applied
        return Response(body, status=status.HTTP_200_OK)

    def delete(self, request, public_id, session_id):
        project = _get_project_or_404(public_id)
        _require_or_404(request.user, Action.PROJECT_WRITE, project)

        transient = EditSessionDraft(project=project, user=request.user, session_id=session_id)
        require(request.user, Action.DRAFT_WRITE, transient)

        EditSessionDraft.objects.filter(
            project=project, user=request.user, session_id=session_id
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
