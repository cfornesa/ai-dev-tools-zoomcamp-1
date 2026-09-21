"""Privacy-gated metadata and share-image projections for public piece pages."""

from __future__ import annotations

from io import BytesIO
from urllib.parse import quote

from django.http import Http404, HttpResponse
from PIL import Image, ImageOps
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.art_piece_persistence import eligible_art_pieces, regenerate_thumbnail
from scenes.gallery import eligible_projects, eligible_projects3d
from scenes.models import ArtPieceThumbnail, Thumbnail, Thumbnail3D
from scenes.thumbnail_generation import ensure_thumbnail_for_version
from scenes.thumbnail_generation3d import ensure_thumbnail_for_version3d

SHARE_IMAGE_WIDTH = 1200
SHARE_IMAGE_HEIGHT = 630
KINDS = frozenset({"2d", "3d", "generated"})


def _record_or_404(kind: str, public_id: str):
    if kind == "2d":
        return eligible_projects().filter(public_id=public_id).select_related("owner").first()
    if kind == "3d":
        return eligible_projects3d().filter(public_id=public_id).select_related("owner").first()
    if kind == "generated":
        return eligible_art_pieces().filter(public_id=public_id).select_related("owner").first()
    raise Http404


def _thumbnail_for(record, kind: str):
    if record.current_version_id is None:
        raise Http404
    if kind == "2d":
        thumbnail: Thumbnail | Thumbnail3D | ArtPieceThumbnail | None = Thumbnail.objects.filter(
            scene_version_id=record.current_version_id
        ).first()
        return thumbnail or ensure_thumbnail_for_version(record.current_version_id)
    if kind == "3d":
        thumbnail = Thumbnail3D.objects.filter(scene_version_id=record.current_version_id).first()
        return (
            ensure_thumbnail_for_version3d(record.current_version_id)
            if thumbnail is None or thumbnail.is_fallback
            else thumbnail
        )
    thumbnail = ArtPieceThumbnail.objects.filter(version_id=record.current_version_id).first()
    return thumbnail or regenerate_thumbnail(record.current_version)


def _canonical_path(record, kind: str) -> str:
    handle = (
        record.owner.public_profile.handle
        if hasattr(record.owner, "public_profile") and record.owner.public_profile.is_public
        else None
    )
    if handle and record.public_slug:
        return f"/users/@{quote(handle, safe='@')}/pieces/{quote(record.public_slug, safe='-')}"
    prefix = {"2d": "/p", "3d": "/p3d", "generated": "/art-pieces/p"}[kind]
    return f"{prefix}/{record.public_id}"


def _metadata(record, kind: str) -> dict[str, str | None]:
    thumbnail = _thumbnail_for(record, kind)
    seo_config = record.seo_config if isinstance(record.seo_config, dict) else {}
    return {
        "kind": kind,
        "title": str(seo_config.get("og_title") or record.title),
        "description": str(seo_config.get("og_description") or getattr(record, "description", "")),
        "canonical_path": _canonical_path(record, kind),
        "image_url": (
            f"/api/public/share-image/{kind}/{record.public_id}.png"
            if thumbnail is not None and not thumbnail.is_fallback
            else None
        ),
    }


class PublicShareMetadataView(APIView):
    """Returns only metadata for a currently public record; all other states 404."""

    permission_classes: list = []

    def get(self, request, kind, public_id):
        if kind not in KINDS:
            raise Http404
        record = _record_or_404(kind, public_id)
        if record is None:
            raise Http404
        return Response(_metadata(record, kind))


class PublicShareImageView(APIView):
    """Fits a stored public thumbnail to the 1200x630 crawler image contract."""

    permission_classes: list = []

    def get(self, request, kind, public_id):
        if kind not in KINDS:
            raise Http404
        record = _record_or_404(kind, public_id)
        if record is None:
            raise Http404
        thumbnail = _thumbnail_for(record, kind)
        if thumbnail is None:
            raise Http404
        try:
            with Image.open(BytesIO(bytes(thumbnail.image_data))) as source:
                image = ImageOps.fit(
                    source.convert("RGB"),
                    (SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT),
                    method=Image.Resampling.LANCZOS,
                )
                output = BytesIO()
                image.save(output, format="PNG")
        except Exception as exc:  # noqa: BLE001 - malformed stored images are not public content
            raise Http404 from exc
        response = HttpResponse(output.getvalue(), content_type="image/png")
        response["Cache-Control"] = "public, max-age=60"
        return response
