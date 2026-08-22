"""DRF serializers for the scenes API (Task 13+)."""

from django.urls import reverse
from rest_framework import serializers

from scenes.models import EditSessionDraft, Project, SceneVersion, Template

MAX_TAGS = 10
MAX_TAG_LENGTH = 30


def remix_provenance_data(project: Project) -> dict | None:
    """Task 53 (issue #52): the shared "Remixed from [creator]" payload for
    both public serializers below (`PublicProjectListItemSerializer`'s
    gallery card and `PublicProjectSerializer`'s single-project detail
    view) — one policy, computed once, not duplicated per call site.

    Returns `None` when `project` has no `ForkProvenance` row at all (not
    a remix) -- callers must render nothing for that case, never an empty
    object (this task's own "no empty or misleading remix attribution"
    acceptance criterion).

    ## Snapshot-or-live policy: LIVE, not snapshot

    `ForkProvenance` (`scenes/models.py`, Task 10) deliberately stores only
    a stable FK to `source_project` — see that section's own comment,
    "referencing the source project ... by stable FK rather than by a
    copied/editable snapshot of attribution fields." This task follows
    that existing design choice rather than overriding it with a new
    snapshot column: the original creator's public display name (their
    `username` -- the same value every other public serializer in this
    file already exposes as `owner`) is read fresh, live, from
    `source_project.owner.username` on every request. If a creator's
    username changes after a fork exists, every remix pointing at them
    picks up the new name on its very next request; there is no frozen
    copy anywhere to fall out of sync.

    This still satisfies "attribution remains [durable]": `source_project`
    is `on_delete=models.PROTECT` on `ForkProvenance`, so the source
    project row (and therefore its owner) can never be hard-deleted while
    a fork's provenance still references it -- reading
    `source_project.owner.username` never 404s or raises.

    ## Privacy: durable text, no live/private link

    `source_public_id` is the only field that can ever point back at the
    source (the frontend builds a `/p/<source_public_id>` link from it) --
    and it is only ever populated when the source is *currently* public,
    non-soft-deleted, and published, checked fresh on every call. The
    moment a source project goes private, is unpublished, or is
    soft-deleted, this flips to `None` on the very next request: the
    "Remixed from [creator]" text keeps rendering (from the still-durable
    `source_creator` username) but with no link and no other private
    source data (title, description, scene content) ever included here.

    ## Nested remixes: immediate source, not root

    If project C was forked from project B which was itself forked from
    project A, `C.fork_provenance.source_project` is B -- not A. This
    function reports B's creator/url, never walking further up the chain
    to find A. This is the immediate-source policy (documented choice,
    not the root-source alternative): it matches what `ForkProvenance`
    actually records (one row per fork, pointing at what was *directly*
    forked), needs no recursive chain walk or cycle handling, and is
    always consistent -- forking a remix credits the remix's own creator
    exactly like `_docs/plan.md`'s "Public forks/remixes display 'Remixed
    from [creator]'" describes for any single fork edge, applied
    uniformly at every link in a chain.
    """

    try:
        fork_provenance = project.fork_provenance
    except Project.fork_provenance.RelatedObjectDoesNotExist:
        return None

    source = fork_provenance.source_project
    source_available = (
        not source.is_deleted
        and source.visibility == Project.Visibility.PUBLIC
        and source.published_at is not None
    )
    return {
        "source_creator": source.owner.username,
        "source_public_id": str(source.public_id) if source_available else None,
    }


class TagListField(serializers.ListField):
    child = serializers.CharField(max_length=MAX_TAG_LENGTH, allow_blank=False)

    def __init__(self, **kwargs):
        super().__init__(max_length=MAX_TAGS, **kwargs)


class ProjectMetadataSerializer(serializers.ModelSerializer):
    """Mutable project metadata only — never touches SceneVersion (Task 13/17).

    `visibility` is deliberately excluded (Task 49): switching a project
    public or private is no longer a plain metadata edit — it must go
    through `ProjectPublishView`/`ProjectUnpublishView` in `scenes/api.py`,
    which enforce the meaningful-content rules (`scenes/publishing.py`)
    and the owner-only `Action.PROJECT_PUBLISH` check before flipping it.
    Letting this generic PATCH set `visibility` directly would silently
    bypass that validation, so a `visibility` key in a PATCH body here is
    simply ignored (not an error — every other field in the request still
    applies) rather than accepted.
    """

    tags = TagListField(required=False)

    class Meta:
        model = Project
        fields = [
            "title",
            "description",
            "tags",
            "allow_public_remix",
            "export_attribution",
        ]
        extra_kwargs = {
            "title": {"required": False, "allow_blank": False},
            "description": {"required": False, "allow_blank": True},
            "allow_public_remix": {"required": False},
            "export_attribution": {"required": False},
        }


class ProjectSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id", read_only=True)
    owner = serializers.CharField(source="owner.username", read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "owner",
            "title",
            "description",
            "tags",
            "visibility",
            "allow_public_remix",
            "export_attribution",
            "current_version",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class PublicSceneVersionSerializer(serializers.ModelSerializer):
    """Task 49: the *current* saved version of a public project, for the
    future public-viewer/gallery (Tasks 50/51) to consume.

    Intentionally excludes `created_by`/`parent`/`fork_source_version`/
    `ai_request_id` — none of that is "creator attribution" (that's the
    project's `owner`, exposed separately by `PublicProjectSerializer`);
    it's internal history bookkeeping that would leak another user's
    username or ai-proposal wiring to an anonymous visitor for no reason.
    """

    class Meta:
        model = SceneVersion
        fields = ["sequence", "scene_json", "created_at"]
        read_only_fields = fields


class PublicProjectSerializer(serializers.ModelSerializer):
    """Task 49: the public-reachable shape of a published project.

    Deliberately a much smaller field set than `ProjectSerializer`: no
    `export_attribution` (an owner-only export preference), and
    `current_version` is the nested scene snapshot itself (not just an
    id) so a future public viewer/export has everything it needs from one
    response. `PublicProjectDetailView` (`scenes/api.py`) is the only
    place this serializer is used, and that view refuses to serve
    anything whose `visibility` isn't `public`, regardless of who's
    asking — see that view's own docstring.
    """

    id = serializers.UUIDField(source="public_id", read_only=True)
    owner = serializers.CharField(source="owner.username", read_only=True)
    current_version = PublicSceneVersionSerializer(read_only=True)
    thumbnail_url = serializers.SerializerMethodField()
    remix_provenance = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id",
            "owner",
            "title",
            "description",
            "tags",
            "allow_public_remix",
            "thumbnail_url",
            "remix_provenance",
            "current_version",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_thumbnail_url(self, project: Project) -> str | None:
        # A stable URL, not a presence check: `PublicProjectThumbnailView`
        # (Task 54) lazily generates on first request if nothing is
        # cached yet, so this is always resolvable for any project that
        # has a current version -- see that view's docstring.
        if project.current_version_id is None:
            return None
        return reverse("public-project-thumbnail", kwargs={"public_id": project.public_id})

    def get_remix_provenance(self, project: Project) -> dict | None:
        # Task 53 (issue #52): see `remix_provenance_data`'s own docstring
        # for the snapshot-or-live, availability, and nested-remix policy
        # shared with `PublicProjectListItemSerializer` below.
        return remix_provenance_data(project)


class PublicProjectListItemSerializer(serializers.ModelSerializer):
    """Task 50: one public-gallery card, returned by `PublicProjectListView`
    (`scenes/api.py`)/`scenes.gallery`.

    Deliberately narrower than `PublicProjectSerializer` above (Task 49's
    single-project public detail): no `description`, `tags`,
    `allow_public_remix`, or `current_version` (the
    nested scene snapshot) -- a gallery card only ever needs enough
    to render a tile and link out, never full scene content or an editing
    preference. Same identifier convention as `PublicProjectSerializer`:
    `id` is `public_id` (a project's internal database pk never appears in
    any response body this serializer produces), and `owner` is the
    owner's `username` (never raw email — see `config/views.py`'s
    `whoami` for the one place `email` is ever exposed, and only to the
    signed-in user themselves).

    `remix_provenance` (Task 53, issue #52) is `None` for a card whose
    project has no `ForkProvenance` row (not a remix), and otherwise the
    shared `remix_provenance_data` payload — see that function's own
    docstring in this module for the snapshot-or-live, source-availability,
    and nested-remix (immediate, not root) policy this field follows.
    """

    id = serializers.UUIDField(source="public_id", read_only=True)
    owner = serializers.CharField(source="owner.username", read_only=True)
    thumbnail_url = serializers.SerializerMethodField()
    remix_provenance = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ["id", "title", "owner", "thumbnail_url", "remix_provenance", "published_at"]
        read_only_fields = fields

    def get_thumbnail_url(self, project: Project) -> str | None:
        if project.current_version_id is None:
            return None
        return reverse("public-project-thumbnail", kwargs={"public_id": project.public_id})

    def get_remix_provenance(self, project: Project) -> dict | None:
        return remix_provenance_data(project)


class SceneVersionListSerializer(serializers.ModelSerializer):
    """History metadata only — not the full scene_json (Task 14's list response)."""

    created_by = serializers.CharField(source="created_by.username", default=None, read_only=True)

    class Meta:
        model = SceneVersion
        fields = [
            "id",
            "sequence",
            "origin",
            "change_label",
            "created_by",
            "parent",
            "fork_source_version",
            "created_at",
        ]
        read_only_fields = fields


class SceneVersionDetailSerializer(SceneVersionListSerializer):
    class Meta(SceneVersionListSerializer.Meta):
        fields = [*SceneVersionListSerializer.Meta.fields, "scene_json"]
        read_only_fields = fields


# "restore" and "fork" origins are only ever produced by their own dedicated
# endpoints (Task 15's restore, and the future fork endpoint) — never by a
# direct client-supplied save, so they're excluded from what this endpoint
# will accept even though they're valid SceneVersion.Origin values.
ALLOWED_MANUAL_SAVE_ORIGINS = (
    SceneVersion.Origin.MANUAL,
    SceneVersion.Origin.AI_CREATE,
    SceneVersion.Origin.AI_EDIT,
)


class TemplateSerializer(serializers.ModelSerializer):
    """List/detail representation (Task 20) — no scene_json, matching the project list
    endpoint's own metadata-only shape; the full scene is only needed at clone time,
    server-side, and is never sent to the browser just to render a gallery card."""

    id = serializers.UUIDField(source="public_id", read_only=True)
    owner = serializers.CharField(source="owner.username", default=None, read_only=True)

    class Meta:
        model = Template
        fields = [
            "id",
            "source_type",
            "owner",
            "name",
            "category",
            "description",
            "created_at",
        ]
        read_only_fields = fields


class TemplateCreateSerializer(serializers.Serializer):
    """Task 21: name/category/description for a save-as-private-template request."""

    name = serializers.CharField(max_length=200, allow_blank=False)
    category = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    description = serializers.CharField(required=False, allow_blank=True, default="")


class SceneVersionCreateSerializer(serializers.Serializer):
    scene_json = serializers.JSONField()
    origin = serializers.ChoiceField(
        choices=[(o.value, o.label) for o in ALLOWED_MANUAL_SAVE_ORIGINS]
    )
    change_label = serializers.CharField(required=False, allow_blank=True, default="")


class DraftSerializer(serializers.ModelSerializer):
    """Task 43: the server-side recovery draft's read shape — never includes
    `project`/`user`/`session_id` (already fixed by the URL the caller
    authenticated against), and never touches `SceneVersion` in any way."""

    class Meta:
        model = EditSessionDraft
        fields = ["draft_json", "client_seq", "last_autosaved_at", "expires_at"]
        read_only_fields = fields


class DraftUpsertSerializer(serializers.Serializer):
    """Task 43: request body for `DraftDetailView.put`.

    `client_seq` is the frontend's monotonic per-(project, user, session)
    write counter (mirrors Task 42's local `writeSeq`) — it's what lets the
    server tell an out-of-order/stale sync request apart from a genuinely
    newer one when two requests race (see `scenes/api.py`'s
    `_upsert_draft`).
    """

    draft_json = serializers.JSONField()
    client_seq = serializers.IntegerField(min_value=0)
