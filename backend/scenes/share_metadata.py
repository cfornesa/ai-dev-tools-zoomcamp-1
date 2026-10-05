"""Privacy-gated metadata and share-image projections for public piece pages."""

from __future__ import annotations

from datetime import datetime
from io import BytesIO
from urllib.parse import quote

from django.http import Http404, HttpResponse
from PIL import Image, ImageOps
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.art_piece_persistence import eligible_art_pieces, regenerate_thumbnail
from scenes.collections import _item_record
from scenes.gallery import (
    GALLERY_KIND_RANK,
    eligible_collections,
    eligible_projects,
    eligible_projects3d,
)
from scenes.llms import public_profiles
from scenes.models import (
    ArtPieceThumbnail,
    CollectionItem,
    PublicProfile,
    SiteSettings,
    Thumbnail,
    Thumbnail3D,
)
from scenes.public_identity import public_author_attribution
from scenes.public_urls import piece_viewer_path
from scenes.thumbnail_generation import ensure_thumbnail_for_version
from scenes.thumbnail_generation3d import ensure_thumbnail_for_version3d

SHARE_IMAGE_WIDTH = 1200
SHARE_IMAGE_HEIGHT = 630
KINDS = frozenset({"2d", "3d", "generated"})
DEFAULT_SHARE_IMAGE_PATH = "/favicon.svg"
PUBLIC_GALLERY_FALLBACK_LIMIT = 24
PUBLIC_GALLERY_DESCRIPTION_LIMIT = 320


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
    return piece_viewer_path(record, kind)


def _metadata(record, kind: str) -> dict[str, str | None]:
    thumbnail = _thumbnail_for(record, kind)
    seo_config = record.seo_config if isinstance(record.seo_config, dict) else {}
    return {
        "kind": kind,
        "title": str(seo_config.get("og_title") or record.title),
        "description": str(seo_config.get("og_description") or getattr(record, "description", "")),
        "author": public_author_attribution(record.owner),
        "canonical_path": _canonical_path(record, kind),
        "image_url": (
            f"/api/public/share-image/{kind}/{record.public_id}.png"
            if thumbnail is not None and not thumbnail.is_fallback
            else None
        ),
    }


def _thumbnail_image(record, kind: str) -> tuple[str, bool]:
    thumbnail = _thumbnail_for(record, kind)
    return (
        f"/api/public/share-image/{kind}/{record.public_id}.png",
        bool(thumbnail is None or thumbnail.is_fallback),
    )


def _profile_image(profile) -> str:
    if profile.profile_image_url:
        return profile.profile_image_url
    candidates: list[tuple[datetime | None, str, bool]] = []
    for project in eligible_projects().filter(owner=profile.user):
        image, fallback = _thumbnail_image(project, "2d")
        candidates.append((project.published_at, image, fallback))
    for project3d in eligible_projects3d().filter(owner=profile.user):
        image, fallback = _thumbnail_image(project3d, "3d")
        candidates.append((project3d.published_at, image, fallback))
    for piece in eligible_art_pieces().filter(owner=profile.user):
        image, fallback = _thumbnail_image(piece, "generated")
        candidates.append((piece.published_at, image, fallback))
    candidates.sort(key=lambda candidate: candidate[0] or datetime.min, reverse=True)
    for _, image, fallback in candidates:
        if not fallback:
            return image
    return candidates[0][1] if candidates else DEFAULT_SHARE_IMAGE_PATH


def _collection_image(collection) -> str:
    candidates: list[tuple[int, str, bool]] = []
    for item in collection.items.order_by("position", "id"):
        record = _item_record(collection.owner, item.kind, item.item_id, public=True)
        if record is None:
            continue
        kind = {
            CollectionItem.Kind.PROJECT: "2d",
            CollectionItem.Kind.PROJECT3D: "3d",
            CollectionItem.Kind.ART_PIECE: "generated",
        }[item.kind]
        image, fallback = _thumbnail_image(record, kind)
        candidates.append((item.position, image, fallback))
    for _, image, fallback in candidates:
        if not fallback:
            return image
    return candidates[0][1] if candidates else DEFAULT_SHARE_IMAGE_PATH


def _gallery_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.replace("\x00", "").split())[:PUBLIC_GALLERY_DESCRIPTION_LIMIT]


def _gallery_description(record, kind: str) -> str:
    if kind in {"generated", "collection"}:
        seo_config = record.seo_config if isinstance(record.seo_config, dict) else {}
        seo_description = seo_config.get("description") or seo_config.get("answer_summary")
        if seo_description:
            cleaned = _gallery_text(seo_description)
            if cleaned:
                return cleaned
    if kind == "3d":
        return ""
    return _gallery_text(getattr(record, "description", ""))


def _gallery_item(title: str, path: str, description: str) -> dict[str, str]:
    item = {"title": title, "path": path}
    if description:
        item["description"] = description
    return item


def _gallery_fallback_items() -> list[dict[str, str]]:
    """Return the bounded, crawlable first page using crawler privacy gates."""
    handles = {profile.user_id: profile.handle for profile in public_profiles()}
    candidates: list[tuple[datetime, int, int, str, str, str]] = []

    for kind, queryset in (
        (
            "2d",
            eligible_projects().filter(
                owner__is_active=True,
                owner__public_profile__is_public=True,
                owner__public_profile__handle__isnull=False,
            )[:PUBLIC_GALLERY_FALLBACK_LIMIT],
        ),
        (
            "3d",
            eligible_projects3d().filter(
                owner__is_active=True,
                owner__public_profile__is_public=True,
                owner__public_profile__handle__isnull=False,
            )[:PUBLIC_GALLERY_FALLBACK_LIMIT],
        ),
        (
            "generated",
            eligible_art_pieces().filter(
                owner__is_active=True,
                owner__public_profile__is_public=True,
                owner__public_profile__handle__isnull=False,
            )[:PUBLIC_GALLERY_FALLBACK_LIMIT],
        ),
    ):
        for record in queryset:
            published_at = record.published_at
            if not handles.get(record.owner_id) or published_at is None:
                continue
            path = piece_viewer_path(record, kind)
            candidates.append(
                (
                    published_at,
                    -GALLERY_KIND_RANK[kind],
                    record.pk,
                    record.title,
                    path,
                    _gallery_description(record, kind),
                )
            )

    for collection in eligible_collections().filter(owner__is_active=True)[
        :PUBLIC_GALLERY_FALLBACK_LIMIT
    ]:
        published_at = collection.published_at
        if not handles.get(collection.owner_id) or published_at is None:
            continue
        handle = handles[collection.owner_id]
        path = f"/users/@{quote(handle, safe='@')}/collections/{quote(collection.slug, safe='-')}"
        candidates.append(
            (
                published_at,
                -GALLERY_KIND_RANK["collection"],
                collection.pk,
                collection.title,
                path,
                _gallery_description(collection, "collection"),
            )
        )

    candidates.sort(key=lambda item: item[:3], reverse=True)
    return [
        _gallery_item(title, path, description)
        for _, _, _, title, path, description in candidates[:PUBLIC_GALLERY_FALLBACK_LIMIT]
    ]


def _collection_fallback_items() -> list[dict[str, str]]:
    handles = {profile.user_id: profile.handle for profile in public_profiles()}
    items = []
    for collection in eligible_collections().filter(owner__is_active=True)[
        :PUBLIC_GALLERY_FALLBACK_LIMIT
    ]:
        handle = handles.get(collection.owner_id)
        if not handle:
            continue
        path = f"/users/@{quote(handle, safe='@')}/collections/{quote(collection.slug, safe='-')}"
        items.append(
            _gallery_item(
                collection.title,
                path,
                _gallery_description(collection, "collection"),
            )
        )
    return items


def _generated_gallery_fallback_items() -> list[dict[str, str]]:
    handles = {profile.user_id for profile in public_profiles()}
    queryset = eligible_art_pieces().filter(
        owner__is_active=True,
        owner__public_profile__is_public=True,
        owner__public_profile__handle__isnull=False,
    )[:PUBLIC_GALLERY_FALLBACK_LIMIT]
    return [
        _gallery_item(
            piece.title,
            piece_viewer_path(piece, "generated"),
            _gallery_description(piece, "generated"),
        )
        for piece in queryset
        if piece.owner_id in handles
    ]


def _site_metadata(
    path: str,
    *,
    gallery_items: list[dict[str, str]] | None = None,
    gallery_heading: str | None = None,
) -> dict:
    settings = SiteSettings.get_solo()
    metadata: dict[str, object] = {
        "kind": "site",
        "title": settings.site_title or "AugmentrART",
        "description": settings.site_description
        or "A public gallery for creative work and living ideas.",
        "canonical_path": path,
        "image_url": DEFAULT_SHARE_IMAGE_PATH,
    }
    if gallery_items is not None:
        metadata["gallery_items"] = gallery_items
    if gallery_heading is not None:
        metadata["gallery_heading"] = gallery_heading
    return metadata


def _profile_metadata(handle: str) -> dict[str, str | None]:
    profile = (
        PublicProfile.objects.filter(handle=handle.lower(), is_public=True, user__is_active=True)
        .select_related("user")
        .first()
    )
    if profile is None:
        return _site_metadata(f"/users/@{quote(handle, safe='@')}")
    display_name = profile.display_name or profile.handle or "Public profile"
    description = " ".join(profile.bio.split())[:200]
    return {
        "kind": "profile",
        "title": f"{display_name} on AugmentrART",
        "description": description or "Public profile on AugmentrART.",
        "author": public_author_attribution(profile.user),
        "canonical_path": f"/users/@{quote(profile.handle or handle, safe='@')}",
        "image_url": _profile_image(profile),
    }


def _collection_metadata(handle: str, slug: str) -> dict[str, str | None]:
    collection = (
        eligible_collections()
        .filter(owner__public_profile__handle=handle.lower(), slug=slug)
        .first()
    )
    if collection is None:
        return _site_metadata(
            f"/users/@{quote(handle, safe='@')}/collections/{quote(slug, safe='-')}"
        )
    seo_config = collection.seo_config if isinstance(collection.seo_config, dict) else {}
    return {
        "kind": "collection",
        "title": str(seo_config.get("og_title") or collection.title),
        "description": str(seo_config.get("og_description") or collection.description),
        "author": public_author_attribution(collection.owner),
        "canonical_path": (
            f"/users/@{quote(handle, safe='@')}/collections/{quote(collection.slug, safe='-')}"
        ),
        "image_url": _collection_image(collection),
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


class PublicSiteShareMetadataView(APIView):
    permission_classes: list = []

    def get(self, request, scope, handle=None, slug=None):
        if scope == "home":
            return Response(_site_metadata("/", gallery_items=_gallery_fallback_items()))
        if scope == "gallery":
            return Response(_site_metadata("/gallery", gallery_items=_gallery_fallback_items()))
        if scope == "collections":
            return Response(
                _site_metadata(
                    "/collections",
                    gallery_items=_collection_fallback_items(),
                    gallery_heading="Public collections",
                )
            )
        if scope == "generated":
            return Response(
                _site_metadata(
                    "/gallery?type=generated",
                    gallery_items=_generated_gallery_fallback_items(),
                    gallery_heading="Generated art gallery",
                )
            )
        if scope == "profile" and handle is not None:
            return Response(_profile_metadata(handle))
        if scope == "collection" and handle is not None and slug is not None:
            return Response(_collection_metadata(handle, slug))
        raise Http404
