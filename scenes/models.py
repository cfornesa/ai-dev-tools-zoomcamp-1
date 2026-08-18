"""Project, scene-version, draft, activity, template, and provenance models.

Project/SceneVersion (Task 8) split mutable project metadata from
append-only creative history, per `_docs/plan.md`'s "Project metadata and
versioning" section. Two invariants are enforced at the PostgreSQL level
via triggers (see `scenes/migrations/0002_postgres_invariants.py`), not
just in application code, because SQLite-only tests are not accepted as
proof of PostgreSQL constraint behavior (Task 8's own constraint):

1. A saved `SceneVersion`'s snapshot fields are immutable after creation
   (only the soft-delete fields may change).
2. A `Project.current_version` must belong to that same project and must
   not be soft-deleted.

Everything else (uniqueness of `(project, sequence)`, `sequence >= 1`) is
a plain Django `UniqueConstraint`/`CheckConstraint`, which SQLite already
enforces the same way, so no trigger is needed for those.
"""

import json
import uuid
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from scenes.validation import validate_scene


class ProjectManager(models.Manager):
    """Default manager excludes soft-deleted projects (Task 13's recoverable delete)."""

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class Project(models.Model):
    class Visibility(models.TextChoices):
        PRIVATE = "private", "Private"
        PUBLIC = "public", "Public"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="projects"
    )
    title = models.CharField(max_length=200, default="Untitled animation")
    description = models.TextField(default="", blank=True)
    visibility = models.CharField(
        max_length=10, choices=Visibility.choices, default=Visibility.PRIVATE
    )
    # Task 51: `_docs/plan.md`'s "Remix setting" section is explicit —
    # "Public projects have `allow_public_remix = true` by default." Every
    # project starts `private` regardless (see `visibility` above), so this
    # default is only ever observable once a project becomes public: an
    # owner who never touches the checkbox in `ProjectMetadataForm.tsx`
    # gets remixable-by-default the moment they publish, and can turn it
    # off (via the plain metadata PATCH, `ProjectMetadataSerializer` —
    # never a version-creating action) before or after publishing.
    allow_public_remix = models.BooleanField(default=True)
    tags = models.JSONField(default=list, blank=True)
    thumbnail_choice = models.CharField(max_length=50, default="auto", blank=True)
    # Off by default per _docs/plan.md's "Optional attribution" section.
    export_attribution = models.BooleanField(default=False)
    current_version = models.ForeignKey(
        "scenes.SceneVersion",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="current_for_projects",
    )
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    # Task 18's idempotency key: a client-supplied UUID for the blank-creation
    # request. The unique constraint is what makes a genuinely concurrent
    # duplicate submission safe — see scenes/api.py's BlankProjectCreateView.
    creation_request_id = models.UUIDField(null=True, blank=True)
    # Task 50: when this project most recently became public, set by
    # `ProjectPublishView` and cleared back to `None` by `ProjectUnpublishView`
    # (see both views' docstrings in scenes/api.py). Deliberately a separate
    # field from `updated_at` — `updated_at` also changes on unrelated
    # metadata edits (title, tags, ...), which would silently reshuffle the
    # public gallery's ordering every time a public project's owner tweaked
    # its description. `published_at` only ever moves on an actual
    # publish/unpublish transition, which is what "deterministic ordering"
    # (Task 50's acceptance criterion) and stable keyset pagination
    # (`scenes/gallery.py`) both need: a sort key that doesn't move under a
    # project already sitting on some page of gallery results.
    published_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    all_objects = models.Manager()
    objects = ProjectManager()

    class Meta:
        # Keeps cascades/internal FK lookups on the unfiltered manager;
        # only explicit `Project.objects` queries hide soft-deleted rows.
        # Both set explicitly (rather than relying on declaration order)
        # so manager selection doesn't silently change if the fields above
        # are reordered later.
        base_manager_name = "all_objects"
        default_manager_name = "objects"
        ordering = ["-created_at"]
        constraints = [
            # Task 18's idempotency key is scoped per-owner: two different
            # users independently generating the same random UUID (astronomically
            # unlikely, but not something an API should structurally depend on)
            # must never collide with each other's requests.
            models.UniqueConstraint(
                fields=["owner", "creation_request_id"], name="unique_creation_request_per_owner"
            ),
        ]
        indexes = [
            # Task 50: the public gallery's keyset-pagination query filters
            # on visibility and orders by (published_at, id) — a compound
            # index matching that access pattern exactly.
            models.Index(
                fields=["visibility", "-published_at", "-id"], name="project_public_gallery_idx"
            ),
        ]

    def __str__(self) -> str:
        return self.title


class SceneVersionImmutableError(Exception):
    """Raised when application code tries to mutate an existing SceneVersion snapshot."""


SNAPSHOT_FIELDS = frozenset(
    {
        "project_id",
        "sequence",
        "scene_json",
        "created_by_id",
        "parent_id",
        "fork_source_version_id",
        "origin",
        "change_label",
        "ai_request_id",
    }
)


class SceneVersion(models.Model):
    class Origin(models.TextChoices):
        MANUAL = "manual", "Manual"
        AI_CREATE = "ai_create", "AI create"
        AI_EDIT = "ai_edit", "AI edit"
        RESTORE = "restore", "Restore"
        FORK = "fork", "Fork"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="versions")
    sequence = models.PositiveIntegerField()
    scene_json = models.JSONField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="created_scene_versions",
    )
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children"
    )
    fork_source_version = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="forks"
    )
    origin = models.CharField(max_length=20, choices=Origin.choices)
    change_label = models.CharField(max_length=200, default="", blank=True)
    # Task 48's idempotency key for the AI-accept endpoint
    # (`scenes.ai_api.AIAcceptProposalView`): a client-generated UUID, one
    # per proposal, sent with the Accept request. The unique constraint
    # below (scoped per-project, like `Project.creation_request_id`'s own
    # per-owner scoping in Task 18) is what makes a genuinely concurrent or
    # retried duplicate Accept safe -- see that view's docstring. `null`
    # for every non-AI-accept version (manual save, restore, fork, and any
    # AI version created before this field existed).
    ai_request_id = models.UUIDField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "sequence"], name="unique_sequence_per_project"
            ),
            models.CheckConstraint(condition=models.Q(sequence__gte=1), name="sequence_gte_1"),
            models.UniqueConstraint(
                fields=["project", "ai_request_id"],
                condition=models.Q(ai_request_id__isnull=False),
                name="unique_ai_request_id_per_project",
            ),
        ]
        ordering = ["project", "sequence"]

    def __str__(self) -> str:
        return f"{self.project_id} v{self.sequence}"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            using = kwargs.get("using")
            queryset = SceneVersion.objects.using(using) if using else SceneVersion.objects
            existing = queryset.filter(pk=self.pk).values(*SNAPSHOT_FIELDS).first()
            if existing is not None:
                current = {field: getattr(self, field) for field in SNAPSHOT_FIELDS}
                if current != existing:
                    raise SceneVersionImmutableError(
                        "SceneVersion snapshot fields cannot be modified after creation; "
                        "only is_deleted/deleted_at may change."
                    )
        super().save(*args, **kwargs)


# --- Task 9: edit-session drafts and project activity ---
#
# Drafts are active-session crash recovery, not a second version history:
# see `_docs/plan.md`'s "Active-session autosave and recovery" section.
# Creating/updating a draft never touches SceneVersion — there is no code
# path here that could.

DEFAULT_DRAFT_LIFETIME = timedelta(hours=24)


def default_draft_expiry():
    return timezone.now() + DEFAULT_DRAFT_LIFETIME


class EditSessionDraftManager(models.Manager):
    def active(self):
        return self.get_queryset().filter(expires_at__gt=timezone.now())

    def expired(self):
        return self.get_queryset().filter(expires_at__lte=timezone.now())


class EditSessionDraft(models.Model):
    """A private, per-session recovery copy of unsaved editor state.

    Task 43 adds `client_seq`: a client-supplied, per-(project, user,
    session) monotonic counter the frontend bumps on every local write it
    schedules for sync (mirrors `writeSeq` in
    `frontend/src/storage/draftAutosave.ts`, Task 42's local mechanism).
    The server upsert path (`scenes/api.py`'s `DraftDetailView.put`)
    compares an incoming `client_seq` against the stored value *inside* a
    `select_for_update()`-locked transaction and silently ignores (does
    not apply) any write whose `client_seq` is not strictly greater than
    what's already stored — this is what makes "an older or stale write
    cannot replace the newest accepted draft" a real, race-proof guarantee
    rather than a last-write-wins coin flip. See
    tests/test_edit_session_draft_sync_api.py's PostgreSQL-gated
    concurrency tests.
    """

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="drafts")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="edit_session_drafts"
    )
    session_id = models.CharField(max_length=64)
    draft_json = models.JSONField()
    client_seq = models.BigIntegerField(default=0)
    last_autosaved_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(default=default_draft_expiry)

    objects = EditSessionDraftManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "user", "session_id"], name="unique_draft_scope"
            ),
        ]
        ordering = ["-last_autosaved_at"]

    def __str__(self) -> str:
        return f"draft({self.project_id}, {self.user_id}, {self.session_id})"

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    def clean(self):
        result = validate_scene(self.draft_json)
        if not result.valid:
            raise ValidationError(
                {
                    "draft_json": [
                        f"{error.path}: {error.rule} — {error.message}" for error in result.errors
                    ]
                }
            )


MAX_ACTIVITY_METADATA_BYTES = 8192

FORBIDDEN_METADATA_KEY_SUBSTRINGS = (
    "camera",
    "frame",
    "video",
    "secret",
    "api_key",
    "apikey",
    "password",
    "token",
    "credential",
)


class ProjectActivityUnsafeMetadataError(Exception):
    """Raised when ProjectActivity metadata looks like it holds camera frames or secrets."""


def _check_metadata_keys(value) -> None:
    if isinstance(value, dict):
        for key, nested in value.items():
            lowered = str(key).lower()
            if any(bad in lowered for bad in FORBIDDEN_METADATA_KEY_SUBSTRINGS):
                raise ProjectActivityUnsafeMetadataError(
                    f"metadata key '{key}' is not allowed (looks like camera data or a secret)."
                )
            _check_metadata_keys(nested)
    elif isinstance(value, list):
        for item in value:
            _check_metadata_keys(item)


def validate_activity_metadata(metadata) -> None:
    if not isinstance(metadata, dict):
        raise ProjectActivityUnsafeMetadataError("Activity metadata must be a JSON object.")
    serialized = json.dumps(metadata)
    if len(serialized.encode("utf-8")) > MAX_ACTIVITY_METADATA_BYTES:
        raise ProjectActivityUnsafeMetadataError(
            f"Activity metadata exceeds {MAX_ACTIVITY_METADATA_BYTES} bytes."
        )
    _check_metadata_keys(metadata)


class ProjectActivity(models.Model):
    class ActionType(models.TextChoices):
        PROJECT_CREATED = "project_created", "Project created"
        METADATA_UPDATED = "metadata_updated", "Metadata updated"
        VERSION_SAVED = "version_saved", "Version saved"
        VERSION_RESTORED = "version_restored", "Version restored"
        VERSION_DELETED = "version_deleted", "Version deleted"
        PUBLISHED = "published", "Published"
        UNPUBLISHED = "unpublished", "Unpublished"
        FORKED = "forked", "Forked"
        AI_PROPOSAL_ACCEPTED = "ai_proposal_accepted", "AI proposal accepted"
        AI_PROPOSAL_REJECTED = "ai_proposal_rejected", "AI proposal rejected"
        EXPORTED = "exported", "Exported"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="activity")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="project_activity",
    )
    action_type = models.CharField(max_length=32, choices=ActionType.choices)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "project activity"

    def __str__(self) -> str:
        return f"{self.project_id}: {self.action_type}"

    def save(self, *args, **kwargs):
        validate_activity_metadata(self.metadata)
        super().save(*args, **kwargs)


# --- Task 10: templates and fork provenance ---
#
# One conceptual template model with two source classes (built-in vs.
# private), per `_docs/plan.md`'s "Templates" section. Fork provenance is
# recorded once per (forked) Project, referencing the source project and
# source version by stable FK rather than by a copied/editable snapshot
# of attribution fields — see ForkProvenance below.


class TemplateManager(models.Manager):
    def built_in(self):
        return self.get_queryset().filter(source_type="built_in")

    def private_for(self, user):
        return self.get_queryset().filter(source_type="private", owner=user)


class Template(models.Model):
    class SourceType(models.TextChoices):
        BUILT_IN = "built_in", "Built-in"
        PRIVATE = "private", "Private"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    source_type = models.CharField(max_length=10, choices=SourceType.choices)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="templates",
    )
    source_version = models.ForeignKey(
        SceneVersion,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="templates_sourced",
    )
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, default="", blank=True)
    description = models.TextField(default="", blank=True)
    scene_json = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TemplateManager()

    class Meta:
        # Nested classes don't share their enclosing class's scope in
        # Python, so SourceType.BUILT_IN isn't reachable here — the raw
        # string values (identical to SourceType's) are used instead.
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(source_type="built_in", owner__isnull=True)
                    | models.Q(source_type="private", owner__isnull=False)
                ),
                name="builtin_ownerless_private_owned",
            ),
        ]
        ordering = ["category", "name"]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        result = validate_scene(self.scene_json)
        if not result.valid:
            raise ValidationError(
                {
                    "scene_json": [
                        f"{error.path}: {error.rule} — {error.message}" for error in result.errors
                    ]
                }
            )
        super().save(*args, **kwargs)


class ForkProvenanceInvalidSourceError(Exception):
    """Raised when a ForkProvenance's source_version doesn't belong to source_project."""


class ForkProvenance(models.Model):
    """Immutable record of what a forked project was forked from.

    One row per forked Project — `project` is the new project created by
    the fork; `source_project`/`source_version` identify what it was
    forked from at fork time. Neither source field is ever rewritten:
    later changes to the source project (title, visibility, new versions)
    do not touch this row, and PROTECT on both FKs stops the source from
    being deleted out from under an existing fork's provenance.
    """

    project = models.OneToOneField(
        Project, on_delete=models.CASCADE, related_name="fork_provenance"
    )
    source_project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name="forks_made")
    source_version = models.ForeignKey(
        SceneVersion, on_delete=models.PROTECT, related_name="forks_made"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(project=models.F("source_project")),
                name="fork_provenance_project_differs_from_source",
            ),
        ]

    def __str__(self) -> str:
        return f"fork({self.project_id} <- {self.source_project_id})"

    def save(self, *args, **kwargs):
        if self.source_version.project_id != self.source_project_id:
            raise ForkProvenanceInvalidSourceError(
                "source_version does not belong to source_project."
            )
        super().save(*args, **kwargs)


# --- Task 54: gallery-card thumbnails ---
#
# One row per `SceneVersion` (immutable, so a generated thumbnail never
# needs to change once it exists), not per `Project`. See
# `scenes/thumbnails.py`'s module docstring for the rendering approach and
# `scenes/thumbnail_generation.py` for the generation/storage/policy code
# that creates and updates rows of this model. Storing PNG bytes directly
# in the database column (rather than a `FileField`/local filesystem path)
# matches this project's existing durability rule for deployed
# environments (`AGENTS.md`: "a published Replit application's filesystem
# is not the durable data boundary") — no MEDIA_ROOT/file storage is
# configured anywhere else in this project either.


class Thumbnail(models.Model):
    scene_version = models.OneToOneField(
        SceneVersion, on_delete=models.CASCADE, related_name="thumbnail"
    )
    image_data = models.BinaryField()
    content_type = models.CharField(max_length=50, default="image/png")
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    # True when `image_data` is `scenes.thumbnails.FALLBACK_PNG_BYTES` (or an
    # equivalent placeholder) because rendering the real scene failed --
    # never derived from scene content. A later successful retry replaces
    # this same row in place (see `ensure_thumbnail_for_version`) rather
    # than creating a second row, so `is_fallback` also marks "generation
    # should be retried later" for whatever admin/maintenance tooling wants
    # to sweep failed artifacts.
    is_fallback = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    generated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        kind = "fallback" if self.is_fallback else "generated"
        return f"thumbnail({self.scene_version_id}, {kind})"
