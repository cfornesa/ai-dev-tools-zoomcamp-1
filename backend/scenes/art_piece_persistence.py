"""Issue #314 persistence, privacy, and thumbnail endpoints for art pieces."""

from __future__ import annotations

import hashlib
from io import BytesIO

from django.db import transaction
from django.http import Http404, HttpResponse
from django.utils import timezone
from PIL import Image, ImageDraw
from rest_framework import serializers, status
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
    return {key: bool(value.get(key, False)) for key in CAPABILITY_KEYS}


def _thumbnail_bytes(source: str) -> bytes:
    digest = hashlib.sha256(source.encode()).digest()
    image = Image.new("RGB", (THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT), (digest[0], digest[1], digest[2]))
    draw = ImageDraw.Draw(image)
    for index in range(0, 32, 4):
        color = (digest[index] ^ 255, digest[index + 1] ^ 255, digest[index + 2] ^ 255)
        x0 = digest[index] % 280
        y0 = digest[index + 1] % 200
        x1 = x0 + 40 + digest[index + 2] % 40
        y1 = y0 + 40 + digest[index + 3] % 40
        draw.ellipse(
            (x0, y0, min(x1, THUMBNAIL_WIDTH), min(y1, THUMBNAIL_HEIGHT)),
            fill=color,
        )
    output = BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue()


def regenerate_thumbnail(version: ArtPieceVersion) -> ArtPieceThumbnail:
    try:
        image_data = _thumbnail_bytes(version.source)
        is_fallback = False
    except Exception:
        image_data = FALLBACK_PNG_BYTES
        is_fallback = True
    with transaction.atomic():
        locked_version = ArtPieceVersion.objects.select_for_update().get(pk=version.pk)
        thumbnail, _ = ArtPieceThumbnail.objects.update_or_create(
            version=locked_version,
            defaults={
                "image_data": image_data,
                "width": THUMBNAIL_WIDTH,
                "height": THUMBNAIL_HEIGHT,
                "is_fallback": is_fallback,
            },
        )
    return thumbnail


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
            }
        )
