"""DRF serializers for the scenes API (Task 13+)."""

from rest_framework import serializers

from scenes.models import EditSessionDraft, Project, SceneVersion, Template

MAX_TAGS = 10
MAX_TAG_LENGTH = 30

# No thumbnail-generation system exists yet (Task 54); this is the small,
# explicit set of strategies the future thumbnail generator will support,
# so the field is validated against something concrete rather than
# accepting arbitrary strings.
THUMBNAIL_CHOICES = ["auto", "first-shape", "solid-color"]


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
    thumbnail_choice = serializers.ChoiceField(choices=THUMBNAIL_CHOICES, required=False)

    class Meta:
        model = Project
        fields = [
            "title",
            "description",
            "tags",
            "allow_public_remix",
            "thumbnail_choice",
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
            "thumbnail_choice",
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

    class Meta:
        model = Project
        fields = [
            "id",
            "owner",
            "title",
            "description",
            "tags",
            "allow_public_remix",
            "thumbnail_choice",
            "current_version",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


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
