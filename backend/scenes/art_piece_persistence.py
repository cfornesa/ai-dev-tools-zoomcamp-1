"""Issue #314 persistence, privacy, and thumbnail endpoints for art pieces.

## Issue #438: why thumbnails are captured by the browser, not Django

Unlike the canonical scene-JSON projects (`scenes/thumbnails.py`), an art
piece's `source` is opaque, arbitrary AI-generated Canvas2D/SVG/Three.js/
A-Frame code -- there is no structured schema for Django to rasterize
directly the way `scenes/thumbnails.py` draws `schema/scene.schema.json`
shape geometry with Pillow. The only way to know what a piece actually
looks like is to execute it, which this module must never do (`_capabilities`'s
"never sanitize/execute a device call" boundary applies just as much to
"never execute this in the request/response cycle"). So the *browser*
renders the piece in the same sandboxed iframe it already uses for the
live preview, captures a screenshot, crops it to
`THUMBNAIL_WIDTH`x`THUMBNAIL_HEIGHT`, and uploads the resulting PNG bytes
through `ArtPieceThumbnailUploadView` below. Until that upload happens (or
if it never succeeds -- a crashed generation, a network failure, a closed
tab), `regenerate_thumbnail` stores the same neutral, artwork-derived-content-free
`FALLBACK_PNG_BYTES` placeholder `scenes/thumbnails.py` already defines for
its own failure path, marked `is_fallback=True` so callers can tell a real
capture from a placeholder.
"""

from __future__ import annotations

from django.db import transaction
from django.http import Http404, HttpResponse
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.models import ArtPiece, ArtPieceThumbnail, ArtPieceVersion
from scenes.permissions import Action, can
from scenes.thumbnails import FALLBACK_PNG_BYTES

THUMBNAIL_WIDTH = 320
THUMBNAIL_HEIGHT = 240
CAPABILITY_KEYS = frozenset(
    {
        "sound",
        "keyboard",
        "microphone",
        "camera_view",
        "hand_steering",
        "fullscreen",
        "screenshot",
        "download",
        "immersive",
    }
)


def _piece_or_404(public_id):
    try:
        return ArtPiece.objects.select_related("owner", "current_version").get(public_id=public_id)
    except (ArtPiece.DoesNotExist, ValueError, TypeError) as exc:
        raise Http404 from exc


def _public_piece_or_404(public_id):
    try:
        return ArtPiece.objects.select_related("owner", "current_version").get(
            public_id=public_id, status=ArtPiece.Status.PUBLISHED
        )
    except (ArtPiece.DoesNotExist, ValueError, TypeError) as exc:
        raise Http404 from exc


def _capabilities(value):
    if not isinstance(value, dict):
        raise serializers.ValidationError("capabilities must be an object")
    unknown = set(value) - CAPABILITY_KEYS
    if unknown:
        raise serializers.ValidationError(f"Unsupported capabilities: {', '.join(sorted(unknown))}")
    non_boolean = [key for key, entry in value.items() if not isinstance(entry, bool)]
    if non_boolean:
        raise serializers.ValidationError(
            f"Capabilities must be true/false: {', '.join(sorted(non_boolean))}"
        )
    return {key: value.get(key, False) for key in CAPABILITY_KEYS}


def regenerate_thumbnail(version: ArtPieceVersion) -> ArtPieceThumbnail:
    """Resets `version`'s thumbnail to the neutral fallback placeholder.

    Called synchronously on piece/version creation (no browser capture
    exists yet) and by `ArtPieceRegenerateThumbnailView` when the frontend
    reports its own capture attempt failed or timed out. A real capture
    only ever arrives through `ArtPieceThumbnailUploadView.post` below.
    """
    with transaction.atomic():
        locked_version = ArtPieceVersion.objects.select_for_update().get(pk=version.pk)
        thumbnail, _ = ArtPieceThumbnail.objects.update_or_create(
            version=locked_version,
            defaults={
                "image_data": FALLBACK_PNG_BYTES,
                "width": THUMBNAIL_WIDTH,
                "height": THUMBNAIL_HEIGHT,
                "is_fallback": True,
            },
        )
    return thumbnail


class ArtPieceThumbnailUploadSerializer(serializers.Serializer):
    image = serializers.ImageField()

    def validate_image(self, value):
        pil_image = getattr(value, "image", None)
        if pil_image is None:
            raise serializers.ValidationError("Uploaded file is not a valid image.")
        if pil_image.format != "PNG":
            raise serializers.ValidationError("Thumbnail must be a PNG image.")
        if pil_image.size != (THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT):
            raise serializers.ValidationError(
                f"Thumbnail must be exactly {THUMBNAIL_WIDTH}x{THUMBNAIL_HEIGHT} pixels "
                f"(got {pil_image.size[0]}x{pil_image.size[1]})."
            )
        value.seek(0)
        return value


def _version_data(version: ArtPieceVersion, *, public: bool):
    data = {
        "id": version.id,
        "sequence": version.sequence,
        "created_at": version.created_at,
        "capabilities": version.capabilities,
        "thumbnail_url": (
            f"/api/public/art-pieces/{version.piece.public_id}/thumbnail.png"
            if public
            else f"/api/art-pieces/{version.piece.public_id}/thumbnail.png"
        ),
    }
    if public:
        data["source"] = version.source
    else:
        data.update({"source": version.source, "generation_metadata": version.generation_metadata})
    return data


def _piece_data(piece: ArtPiece, *, public: bool):
    data = {
        "public_id": str(piece.public_id),
        "title": piece.title,
        "description": piece.description,
        "engine": piece.engine,
        "status": piece.status,
        "current_version": _version_data(piece.current_version, public=public)
        if piece.current_version
        else None,
        "created_at": piece.created_at,
        "updated_at": piece.updated_at,
    }
    if not public:
        data.update(
            {"prompt": piece.prompt, "owner_id": piece.owner_id, "published_at": piece.published_at}
        )
    return data


class ArtPieceCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200, required=False, default="Untitled art piece")
    description = serializers.CharField(
        max_length=4000, required=False, allow_blank=True, default=""
    )
    prompt = serializers.CharField(max_length=4000)
    engine = serializers.ChoiceField(choices=ArtPiece.Engine.choices)
    source = serializers.CharField(max_length=1_000_000)
    capabilities = serializers.DictField(required=False, default=dict)
    generation_metadata = serializers.DictField(required=False, default=dict)

    def validate_capabilities(self, value):
        return _capabilities(value)


class ArtPieceMetadataSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200, required=False)
    description = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=ArtPiece.Status.choices, required=False)


class ArtPieceVersionSerializer(serializers.Serializer):
    source = serializers.CharField(max_length=1_000_000)
    capabilities = serializers.DictField(required=False, default=dict)
    generation_metadata = serializers.DictField(required=False, default=dict)

    def validate_capabilities(self, value):
        return _capabilities(value)


def _meaningful(piece):
    return bool(piece.title.strip() and piece.description.strip())


class ArtPieceListCreateView(APIView):
    def get(self, request):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        pieces = ArtPiece.objects.filter(owner=request.user).select_related("current_version")
        return Response([_piece_data(piece, public=False) for piece in pieces])

    def post(self, request):
        if not can(request.user, Action.ART_PIECE_CREATE):
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        serializer = ArtPieceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        with transaction.atomic():
            piece = ArtPiece.objects.create(
                owner=request.user,
                title=values["title"],
                description=values["description"],
                prompt=values["prompt"],
                engine=values["engine"],
            )
            version = ArtPieceVersion.objects.create(
                piece=piece,
                sequence=1,
                source=values["source"],
                capabilities=values["capabilities"],
                generation_metadata=values["generation_metadata"],
            )
            piece.current_version = version
            piece.save(update_fields=["current_version", "updated_at"])
            regenerate_thumbnail(version)
        return Response(_piece_data(piece, public=False), status=status.HTTP_201_CREATED)


class ArtPieceDetailView(APIView):
    def get(self, request, public_id):
        piece = _piece_or_404(public_id)
        if not can(request.user, Action.ART_PIECE_READ, piece):
            raise Http404
        return Response(
            _piece_data(piece, public=piece.owner_id != getattr(request.user, "id", None))
        )

    def patch(self, request, public_id):
        piece = _piece_or_404(public_id)
        if not can(request.user, Action.ART_PIECE_WRITE, piece):
            raise Http404
        serializer = ArtPieceMetadataSerializer(piece, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        next_status = serializer.validated_data.get("status", piece.status)
        if next_status == ArtPiece.Status.PUBLISHED and (
            piece.current_version_id is None or not _meaningful(piece)
        ):
            return Response(
                {"detail": "Publishing requires a version and meaningful title and description."},
                status=400,
            )
        with transaction.atomic():
            locked = ArtPiece.objects.select_for_update().get(pk=piece.pk)
            for key, value in serializer.validated_data.items():
                setattr(locked, key, value)
            locked.published_at = (
                timezone.now() if next_status == ArtPiece.Status.PUBLISHED else None
            )
            locked.save()
        return Response(_piece_data(locked, public=False))

    def delete(self, request, public_id):
        piece = _piece_or_404(public_id)
        if not can(request.user, Action.ART_PIECE_DELETE, piece):
            raise Http404
        piece.is_deleted = True
        piece.deleted_at = timezone.now()
        piece.save(update_fields=["is_deleted", "deleted_at", "updated_at"])
        return Response(status=204)


class ArtPieceVersionListCreateView(APIView):
    def get(self, request, public_id):
        piece = _piece_or_404(public_id)
        if not can(request.user, Action.ART_PIECE_READ, piece):
            raise Http404
        return Response(
            [
                _version_data(version, public=piece.owner_id != getattr(request.user, "id", None))
                for version in piece.versions.all()
            ]
        )

    def post(self, request, public_id):
        piece = _piece_or_404(public_id)
        if not can(request.user, Action.ART_PIECE_WRITE, piece):
            raise Http404
        serializer = ArtPieceVersionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            locked = ArtPiece.objects.select_for_update().get(pk=piece.pk)
            sequence = (
                locked.versions.order_by("-sequence").values_list("sequence", flat=True).first()
                or 0
            ) + 1
            version = ArtPieceVersion.objects.create(
                piece=locked, sequence=sequence, **serializer.validated_data
            )
            locked.current_version = version
            locked.save(update_fields=["current_version", "updated_at"])
            regenerate_thumbnail(version)
        return Response(_version_data(version, public=False), status=201)


class PublicArtPieceListView(APIView):
    def get(self, request):
        pieces = ArtPiece.objects.filter(status=ArtPiece.Status.PUBLISHED).select_related(
            "owner", "current_version"
        )
        return Response([_piece_data(piece, public=True) for piece in pieces])


class PublicArtPieceDetailView(APIView):
    def get(self, request, public_id):
        return Response(_piece_data(_public_piece_or_404(public_id), public=True))


class ArtPieceThumbnailView(APIView):
    def get(self, request, public_id):
        piece = _piece_or_404(public_id)
        if not can(request.user, Action.ART_PIECE_READ, piece):
            raise Http404
        if not piece.current_version:
            raise Http404
        thumbnail = getattr(piece.current_version, "thumbnail", None) or regenerate_thumbnail(
            piece.current_version
        )
        return HttpResponse(bytes(thumbnail.image_data), content_type=thumbnail.content_type)


class PublicArtPieceThumbnailView(APIView):
    def get(self, request, public_id):
        piece = _public_piece_or_404(public_id)
        if not piece.current_version:
            raise Http404
        thumbnail = getattr(piece.current_version, "thumbnail", None) or regenerate_thumbnail(
            piece.current_version
        )
        return HttpResponse(bytes(thumbnail.image_data), content_type=thumbnail.content_type)


class ArtPieceRegenerateThumbnailView(APIView):
    """Resets the piece's current-version thumbnail to the neutral
    fallback placeholder -- used when the frontend's own browser capture
    attempt failed or timed out (issue #438's "invalid/timeout capture
    stores an explicitly marked fallback" criterion). A real capture only
    ever arrives through `ArtPieceThumbnailUploadView` below."""

    def post(self, request, public_id):
        piece = _piece_or_404(public_id)
        if not can(request.user, Action.ART_PIECE_WRITE, piece):
            raise Http404
        if not piece.current_version:
            return Response({"detail": "The piece has no current version."}, status=400)
        thumbnail = regenerate_thumbnail(piece.current_version)
        return Response(
            {
                "thumbnail_url": f"/api/art-pieces/{piece.public_id}/thumbnail.png",
                "width": thumbnail.width,
                "height": thumbnail.height,
                "is_fallback": thumbnail.is_fallback,
            }
        )


class ArtPieceThumbnailUploadView(APIView):
    """Accepts a real, browser-captured thumbnail for one specific
    immutable version (issue #438). Always keyed to `version_id` from the
    URL, never to "the piece's current version" -- each `ArtPieceVersion`
    owns exactly one `ArtPieceThumbnail` row (`OneToOneField`), so a
    stale or late-arriving upload for an older version can never land on
    a newer version's row: there is no shared "current" pointer this
    write could race against, only that one version's own row."""

    parser_classes = [MultiPartParser]

    def post(self, request, public_id, version_id):
        piece = _piece_or_404(public_id)
        if not can(request.user, Action.ART_PIECE_WRITE, piece):
            raise Http404
        try:
            version = piece.versions.get(pk=version_id)
        except (ArtPieceVersion.DoesNotExist, ValueError, TypeError) as exc:
            raise Http404 from exc

        serializer = ArtPieceThumbnailUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded = serializer.validated_data["image"]

        with transaction.atomic():
            locked_version = ArtPieceVersion.objects.select_for_update().get(pk=version.pk)
            thumbnail, _ = ArtPieceThumbnail.objects.update_or_create(
                version=locked_version,
                defaults={
                    "image_data": uploaded.read(),
                    "content_type": "image/png",
                    "width": THUMBNAIL_WIDTH,
                    "height": THUMBNAIL_HEIGHT,
                    "is_fallback": False,
                },
            )
        return Response(
            {
                "thumbnail_url": f"/api/art-pieces/{piece.public_id}/thumbnail.png",
                "width": thumbnail.width,
                "height": thumbnail.height,
                "is_fallback": thumbnail.is_fallback,
            }
        )
