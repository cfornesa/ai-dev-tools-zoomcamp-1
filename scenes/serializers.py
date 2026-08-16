"""DRF serializers for the scenes API (Task 13+)."""

from rest_framework import serializers

from scenes.models import Project, SceneVersion

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
    """Mutable project metadata only — never touches SceneVersion (Task 13/17)."""

    tags = TagListField(required=False)
    thumbnail_choice = serializers.ChoiceField(choices=THUMBNAIL_CHOICES, required=False)

    class Meta:
        model = Project
        fields = [
            "title",
            "description",
            "tags",
            "visibility",
            "allow_public_remix",
            "thumbnail_choice",
            "export_attribution",
        ]
        extra_kwargs = {
            "title": {"required": False, "allow_blank": False},
            "description": {"required": False, "allow_blank": True},
            "visibility": {"required": False},
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


class SceneVersionCreateSerializer(serializers.Serializer):
    scene_json = serializers.JSONField()
    origin = serializers.ChoiceField(
        choices=[(o.value, o.label) for o in ALLOWED_MANUAL_SAVE_ORIGINS]
    )
    change_label = serializers.CharField(required=False, allow_blank=True, default="")
