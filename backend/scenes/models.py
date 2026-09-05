"""Project, scene-version, draft, activity, template, and provenance models.

Project/SceneVersion (Task 8) split mutable project metadata from
append-only creative history, per `docs/plan.md`'s "Project metadata and
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
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from scenes.validation import validate_scene
from scenes.validation3d import validate_scene3d


class MistralCredentialDecryptionError(Exception):
    """Raised when a stored Mistral credential cannot be safely decrypted."""


class ProjectManager(models.Manager):
    """Default manager excludes soft-deleted projects (Task 13's recoverable delete)."""

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class ApplicationAdmin(models.Model):
    """A user granted application-admin authorization (issue #421).

    Deliberately independent of Django's own `is_staff`/`is_superuser`:
    `scenes.management.commands.reconcile_admin_identities` is the only
    thing that ever creates or deletes rows here, driven purely by the
    `ADMIN_IDENTITIES` environment variable. A row's existence *is* the
    grant -- there is no separate boolean to fall out of sync with it.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="application_admin_grant"
    )
    granted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Application admin grant for user {self.user_id}"


class UserEntitlementPlan(models.Model):
    """Which plan tier a user is on (issue #423).

    An absent row means the default `"free"` plan -- see
    `scenes.entitlements.get_user_plan_key`. `granted_by` is audit
    metadata only (who last changed this, if anyone); it plays no role in
    resolving the effective cap.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="entitlement_plan"
    )
    plan_key = models.CharField(max_length=32, default="free")
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.plan_key} plan for user {self.user_id}"


class UserFeatureOverride(models.Model):
    """An explicit allow/deny override for one named feature (issue #423),
    layered on top of the user's plan. A deny override always wins over
    the plan's cap; an allow override (or no override at all) defers to
    it. `scenes.entitlements` is the only code that should create, change,
    or delete these rows.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="feature_overrides"
    )
    feature_key = models.CharField(max_length=64)
    allowed = models.BooleanField()
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "feature_key"], name="unique_user_feature_override"
            )
        ]

    def __str__(self) -> str:
        return f"{self.feature_key}={'allow' if self.allowed else 'deny'} for user {self.user_id}"


class SiteSettings(models.Model):
    """Singleton site-wide settings (issue #422): always exactly one row.

    `revision` backs optimistic concurrency in `scenes.admin_settings`: a
    caller must present the revision it last read, or the update is
    rejected as a conflict rather than silently overwriting a concurrent
    change.
    """

    site_title = models.CharField(max_length=200, default="Creatrweb Animation Studio")
    revision = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )

    def __str__(self) -> str:
        return f"Site settings (revision {self.revision})"

    @classmethod
    def get_solo(cls) -> "SiteSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Plan(models.Model):
    """A named entitlement plan tier (issue #422), the persisted source
    `scenes.entitlements` resolves caps from -- replacing the static
    dict #423 originally shipped with, without changing that module's
    own function signatures or fail-closed semantics.

    `paypal_plan_id` is read (never written) by billing synchronization
    (#424) and checkout (#440) to map a PayPal subscription plan back to
    one of these rows; it is not validated as a real PayPal id here.
    """

    plan_key = models.CharField(max_length=32, unique=True)
    daily_ai_requests = models.PositiveIntegerField()
    # Which of scenes.entitlements.FEATURE_KEYS this plan grants at all --
    # a feature key absent here has an effective cap of 0 on this plan,
    # independent of `daily_ai_requests`. Validated against the live
    # feature-key registry (never a bare model-level choices list) by
    # `scenes.admin_settings.update_plan`, which is the only code that
    # should write this field.
    feature_keys = models.JSONField(default=list)
    active = models.BooleanField(default=True)
    paypal_plan_id = models.CharField(max_length=64, blank=True, default="")
    revision = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )

    def __str__(self) -> str:
        return f"{self.plan_key} plan (daily_ai_requests={self.daily_ai_requests})"


class MistralCredential(models.Model):
    """One encrypted, owner-scoped Mistral key; plaintext never reaches a model field."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="mistral_credential"
    )
    encrypted_key = models.BinaryField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Mistral credential for user {self.user_id}"

    def set_key(self, plaintext: str) -> None:
        from ai_provider.credentials import encrypt_mistral_key

        self.encrypted_key = encrypt_mistral_key(plaintext)

    def get_key(self) -> str:
        from ai_provider.credentials import decrypt_mistral_key

        try:
            return decrypt_mistral_key(bytes(self.encrypted_key))
        except Exception as exc:
            raise MistralCredentialDecryptionError(
                "The saved Mistral credential is unavailable. Please replace it."
            ) from exc


class ProviderCredential(models.Model):
    """Encrypted owner-scoped credential keyed by a validated vendor."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="provider_credentials"
    )
    vendor = models.CharField(max_length=32)
    encrypted_key = models.BinaryField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["owner", "vendor"], name="unique_provider_credential")
        ]

    def __str__(self) -> str:
        return f"{self.vendor} credential for user {self.owner_id}"

    def set_key(self, plaintext: str) -> None:
        from ai_provider.credentials import encrypt_provider_key

        self.encrypted_key = encrypt_provider_key(plaintext)

    def get_key(self) -> str:
        from ai_provider.credentials import decrypt_provider_key

        try:
            return decrypt_provider_key(bytes(self.encrypted_key))
        except Exception as exc:
            raise MistralCredentialDecryptionError(
                "The saved provider credential is unavailable. Please replace it."
            ) from exc


class MistralModelPreference(models.Model):
    """A user's own self-declared Mistral model slug (issue #259), looked up
    from Mistral's own model documentation -- never a live models-list API
    call. Strictly per-user, like `MistralCredential`."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="mistral_model_preferences"
    )
    slug = models.CharField(max_length=200)
    label = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.slug} (owner {self.owner_id})"


class AIPersona(models.Model):
    """A user's named, additive system-prompt add-on (issue #259/#257).
    Personas only ever layer extra style/tone/content guidance on top of
    the app's mandatory technical system prompts -- they are appended
    after, and never replace, `_SYSTEM_PROMPT`/`_SYSTEM_PROMPT_3D` (see
    `ai_provider/mistral_provider.py`, wired by issue #260)."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_personas"
    )
    name = models.CharField(max_length=200)
    prompt_text = models.TextField(max_length=4000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.name} (owner {self.owner_id})"


class AIRetryPreference(models.Model):
    """A user's own configurable automated-retry setting for failed AI
    generations (issue #266). One record per user, like `MistralCredential`
    -- off by default, so a failed generation only ever retries when the
    user has explicitly opted in. `max_retries` is bounded (1-10) since it
    is applied client-side and counts against the existing per-user AI
    rate limit/quota (`scenes/ai_api.py`), never bypassing it."""

    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_retry_preference"
    )
    auto_retry_enabled = models.BooleanField(default=False)
    max_retries = models.PositiveSmallIntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(10)],
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"AI retry preference for user {self.owner_id}"


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
    # Task 51: `docs/plan.md`'s "Remix setting" section is explicit —
    # "Public projects have `allow_public_remix = true` by default." Every
    # project starts `private` regardless (see `visibility` above), so this
    # default is only ever observable once a project becomes public: an
    # owner who never touches the checkbox in `ProjectMetadataForm.tsx`
    # gets remixable-by-default the moment they publish, and can turn it
    # off (via the plain metadata PATCH, `ProjectMetadataSerializer` —
    # never a version-creating action) before or after publishing.
    allow_public_remix = models.BooleanField(default=True)
    tags = models.JSONField(default=list, blank=True)
    # Off by default per docs/plan.md's "Optional attribution" section.
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
# see `docs/plan.md`'s "Active-session autosave and recovery" section.
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
# private), per `docs/plan.md`'s "Templates" section. Fork provenance is
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


# --- Task 180/#212: minimal persistence models for the 3D scene document family ---
#
# Per #208's decision (a genuinely separate document family, not an
# extension of the 2D one), these are deliberately separate models from
# Project/SceneVersion above, not the existing models with a document-type
# discriminator bolted on -- that would re-couple exactly what #208 decided
# to keep apart. Mirrors Project/SceneVersion's shape at the minimum scope
# #212 asks for (creation, versioning, retrieval); intentionally omits
# fields that only make sense once their owning feature exists here (no
# `visibility`/`published_at` before publish/gallery integration exists for
# 3D scenes, no soft-delete before a 3D delete flow exists, no
# `creation_request_id`/idempotency key before a real creation endpoint
# exists) -- adding them now would be speculative scope, not what #212's
# acceptance criteria asks for. `scene_json` is validated by
# `validate_scene3d` (scenes/validation3d.py), never `validate_scene`.


class Project3DManager(models.Manager):
    """Default manager excludes soft-deleted projects (#242, mirrors ProjectManager)."""

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class Project3D(models.Model):
    class Visibility(models.TextChoices):
        PRIVATE = "private", "Private"
        PUBLIC = "public", "Public"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="projects_3d"
    )
    title = models.CharField(max_length=200, default="Untitled 3D scene")
    # Issue #296: publish/visibility parity with the 2D `Project` model
    # above -- same field shapes, same PRIVATE-by-default, same separate
    # `published_at` (not `updated_at`) sort/cursor key for a future public
    # 3D gallery. No `allow_public_remix`/`tags`/`description`/
    # `export_attribution` counterparts: Project3D has no remix/fork
    # capability and no description/tags fields at all today, and none of
    # that is required by #296's own scope (publish + a public viewer +
    # an embed target) -- a deliberate, documented scope boundary, not an
    # oversight.
    visibility = models.CharField(
        max_length=10, choices=Visibility.choices, default=Visibility.PRIVATE
    )
    published_at = models.DateTimeField(null=True, blank=True, db_index=True)
    current_version = models.ForeignKey(
        "scenes.SceneVersion3D",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="current_for_projects_3d",
    )
    # #242: delete parity with the 2D Project (is_deleted/deleted_at,
    # Task 13) -- SceneVersion3D history is preserved (CASCADE would
    # hard-delete it, but nothing ever hard-deletes a Project3D itself).
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    all_objects = models.Manager()
    objects = Project3DManager()

    class Meta:
        # Same reasoning as Project.Meta above: cascades/internal FK lookups
        # stay on the unfiltered manager; only explicit `Project3D.objects`
        # queries hide soft-deleted rows.
        base_manager_name = "all_objects"
        default_manager_name = "objects"
        ordering = ["-created_at"]
        indexes = [
            # Issue #296: mirrors Project.Meta's identical
            # `project_public_gallery_idx` -- ready for a future public 3D
            # gallery listing, same compound (visibility, -published_at,
            # -id) access pattern.
            models.Index(
                fields=["visibility", "-published_at", "-id"], name="project3d_public_gallery_idx"
            ),
        ]

    def __str__(self) -> str:
        return self.title


class SceneVersion3D(models.Model):
    class Origin(models.TextChoices):
        MANUAL = "manual", "Manual"
        # Issue #232: the 3D counterpart of SceneVersion's AI_CREATE/AI_EDIT.
        AI_CREATE = "ai_create", "AI create"
        AI_EDIT = "ai_edit", "AI edit"

    project = models.ForeignKey(Project3D, on_delete=models.CASCADE, related_name="versions")
    sequence = models.PositiveIntegerField()
    scene_json = models.JSONField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="created_scene_versions_3d",
    )
    origin = models.CharField(max_length=20, choices=Origin.choices, default=Origin.MANUAL)
    # Issue #232: the 3D counterpart of SceneVersion.ai_request_id -- same
    # idempotency-key purpose for AIAcceptProposal3DView, same per-project
    # uniqueness scoping.
    ai_request_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "sequence"], name="unique_sequence_per_project_3d"
            ),
            models.CheckConstraint(condition=models.Q(sequence__gte=1), name="sequence_3d_gte_1"),
            models.UniqueConstraint(
                fields=["project", "ai_request_id"],
                condition=models.Q(ai_request_id__isnull=False),
                name="unique_ai_request_id_per_project_3d",
            ),
        ]
        ordering = ["project", "sequence"]

    def __str__(self) -> str:
        return f"3d:{self.project_id} v{self.sequence}"

    def save(self, *args, **kwargs):
        result = validate_scene3d(self.scene_json)
        if not result.valid:
            raise ValidationError(
                {
                    "scene_json": [
                        f"{error.path}: {error.rule} — {error.message}" for error in result.errors
                    ]
                }
            )
        super().save(*args, **kwargs)


class Thumbnail3D(models.Model):
    """Issue #243: the 3D counterpart of `Thumbnail`, mirroring its shape
    exactly (OneToOne on the immutable version, same fallback semantics).
    A separate model rather than a shared one, matching #208's decision
    to keep the 2D and 3D document families' persistence genuinely
    separate rather than bolting a discriminator onto shared tables."""

    scene_version = models.OneToOneField(
        SceneVersion3D, on_delete=models.CASCADE, related_name="thumbnail"
    )
    image_data = models.BinaryField()
    content_type = models.CharField(max_length=50, default="image/png")
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    is_fallback = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    generated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        kind = "fallback" if self.is_fallback else "generated"
        return f"thumbnail3d({self.scene_version_id}, {kind})"


# Issue #314: durable generated-art-piece document family. Generated source
# stays opaque to Django and is only ever rendered by the frontend sandbox.
class ArtPieceManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class ArtPiece(models.Model):
    class Engine(models.TextChoices):
        CANVAS2D = "canvas2d", "Canvas2D"
        SVG = "svg", "SVG"
        THREEJS = "threejs", "Three.js"
        AFRAME = "aframe", "A-Frame"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="art_pieces"
    )
    title = models.CharField(max_length=200, default="Untitled art piece")
    description = models.TextField(default="", blank=True)
    prompt = models.TextField(max_length=4000)
    engine = models.CharField(max_length=20, choices=Engine.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    current_version = models.ForeignKey(
        "scenes.ArtPieceVersion",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="current_for_pieces",
    )
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    all_objects = models.Manager()
    objects = ArtPieceManager()

    class Meta:
        base_manager_name = "all_objects"
        default_manager_name = "objects"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-published_at", "-id"], name="art_piece_public_idx"),
        ]

    def __str__(self) -> str:
        return self.title


class ArtPieceVersion(models.Model):
    piece = models.ForeignKey(ArtPiece, on_delete=models.CASCADE, related_name="versions")
    sequence = models.PositiveIntegerField()
    source = models.TextField(max_length=1_000_000)
    capabilities = models.JSONField(default=dict)
    generation_metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["piece", "sequence"]
        constraints = [
            models.UniqueConstraint(fields=["piece", "sequence"], name="unique_art_piece_sequence"),
            models.CheckConstraint(
                condition=models.Q(sequence__gte=1), name="art_piece_sequence_gte_1"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.piece_id} v{self.sequence}"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            previous = type(self).objects.get(pk=self.pk)
            for field in ("piece_id", "sequence", "source", "capabilities", "generation_metadata"):
                if getattr(previous, field) != getattr(self, field):
                    raise ValidationError("Art-piece versions are immutable.")
        super().save(*args, **kwargs)


class ArtPieceThumbnail(models.Model):
    version = models.OneToOneField(
        ArtPieceVersion, on_delete=models.CASCADE, related_name="thumbnail"
    )
    image_data = models.BinaryField()
    content_type = models.CharField(max_length=50, default="image/png")
    width = models.PositiveIntegerField(default=320)
    height = models.PositiveIntegerField(default=240)
    is_fallback = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    generated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"art-piece-thumbnail({self.version_id})"
