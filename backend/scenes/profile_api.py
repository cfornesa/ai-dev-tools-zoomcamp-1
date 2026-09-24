"""Owner profile settings and privacy-safe public profile reads (#520)."""

import re

from django.db import transaction
from django.db.utils import OperationalError, ProgrammingError
from django.http import HttpResponsePermanentRedirect
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.admin_settings import effective_site_style
from scenes.collections import collection_payload
from scenes.gallery import eligible_projects, eligible_projects3d
from scenes.models import (
    ArtPiece,
    Collection,
    ProfileStyle,
    PublicProfile,
    PublicProfileHandleRedirect,
    SiteSettings,
)
from scenes.piece_engine import resolve_scene2d_engine, resolve_scene3d_engine
from scenes.public_identity import public_author_name
from scenes.theme import (
    PALETTE_DEFINITIONS,
    available_palettes,
    effective_design_palettes,
    effective_legacy_theme_palettes,
    effective_presentation,
    effective_profile_theme,
    sanitize_palette_overrides,
    sanitize_presentation,
    sanitize_theme_config,
)

RESERVED_HANDLES = {"admin", "api", "account", "accounts", "users", "gallery"}
HANDLE_MAX_LENGTH = 32


def _handle_candidate(user) -> str:
    """Build a readable, stable candidate from the account's username."""
    base = re.sub(r"[^a-z0-9_-]+", "-", user.get_username().lower()).strip("-_")
    base = re.sub(r"[-_]{2,}", "-", base)[:HANDLE_MAX_LENGTH].rstrip("-_")
    if not base or base in RESERVED_HANDLES:
        base = f"user-{user.pk}"
    return base[:HANDLE_MAX_LENGTH].rstrip("-_")


def _available_handle(user) -> str:
    base = _handle_candidate(user)
    candidate = base
    suffix = 2
    while (
        candidate in RESERVED_HANDLES
        or PublicProfile.objects.filter(handle=candidate).exists()
        or PublicProfileHandleRedirect.objects.filter(old_handle=candidate).exists()
    ):
        suffix_text = f"-{suffix}"
        candidate = f"{base[: HANDLE_MAX_LENGTH - len(suffix_text)].rstrip('-_')}{suffix_text}"
        suffix += 1
    return candidate


class ProfileSerializer(serializers.Serializer):
    handle = serializers.RegexField(
        r"[a-z0-9](?:[a-z0-9_-]{0,30}[a-z0-9])?", allow_blank=True, required=False
    )
    display_name = serializers.CharField(max_length=120, allow_blank=True, required=False)
    bio = serializers.CharField(max_length=1000, allow_blank=True, required=False)
    website_url = serializers.URLField(max_length=300, allow_blank=True, required=False)
    social_links = serializers.DictField(required=False)
    profile_image_url = serializers.URLField(max_length=500, allow_blank=True, required=False)
    is_public = serializers.BooleanField(required=False)
    revision = serializers.IntegerField(min_value=1)
    style_key = serializers.SlugField(max_length=48, required=False)
    theme_config = serializers.DictField(required=False)
    palette_key = serializers.SlugField(max_length=32, required=False)
    palette_overrides = serializers.DictField(required=False)
    presentation_overrides = serializers.DictField(required=False)


def _profile_payload(profile: PublicProfile) -> dict:
    # The catalog's `default` entry represents the absence of a profile-level
    # override.  Resolve that case against the active site style so public
    # profiles and their derivative collection surfaces inherit the same
    # global cascade as the shared shell.  Non-default selections remain
    # explicit profile-scoped overrides, including disabled styles that were
    # previously selected and therefore remain readable.
    style = profile.style
    resolved_style = (
        style
        if style is not None and style.key != "default"
        else effective_site_style(SiteSettings.get_solo())
    )
    return {
        "handle": profile.handle,
        "style_key": style.key if style else None,
        "palette_key": profile.palette_key,
        "palette_overrides": profile.palette_overrides,
        "presentation_overrides": profile.presentation_overrides,
        "display_name": profile.display_name,
        "bio": profile.bio,
        "website_url": profile.website_url,
        "social_links": profile.social_links,
        "profile_image_url": profile.profile_image_url,
        "is_public": profile.is_public,
        "revision": profile.revision,
        "theme_config": effective_profile_theme(
            resolved_style.tokens if resolved_style else {}, profile.theme_config
        ),
        "theme_palettes": effective_legacy_theme_palettes(
            resolved_style.tokens if resolved_style else {},
            profile.palette_key,
            profile.palette_overrides,
            profile.theme_config,
        ),
        "design_palettes": effective_design_palettes(
            resolved_style.tokens if resolved_style else {},
            profile.palette_key,
            profile.palette_overrides,
        ),
        "presentation": effective_presentation(
            {
                **(resolved_style.presentation if resolved_style else {}),
                **profile.presentation_overrides,
            }
        ),
    }


def _available_styles() -> list[dict]:
    return [
        {
            "key": style.key,
            "label": style.label,
            "description": style.description,
            "tokens": style.tokens,
            "presentation": effective_presentation(style.presentation),
        }
        for style in ProfileStyle.objects.filter(enabled=True)
    ]


def _piece_payload(profile: PublicProfile) -> dict:
    owner = profile.user
    items: list[dict[str, object]] = []
    for project in eligible_projects().filter(owner=owner):
        items.append(
            {
                "id": str(project.public_id),
                "slug": project.public_slug,
                "title": project.title,
                "description": project.description,
                "owner": public_author_name(owner),
                "type": "2d",
                "engine": resolve_scene2d_engine(
                    project.current_version.scene_json if project.current_version else None
                ),
                "published_at": project.published_at.isoformat() if project.published_at else None,
                "regular_url": f"/users/@{profile.handle}/pieces/{project.public_slug}",
                "thumbnail_url": f"/api/public/projects/{project.public_id}/thumbnail.png",
            }
        )
    for project3d in eligible_projects3d().filter(owner=owner):
        items.append(
            {
                "id": str(project3d.public_id),
                "slug": project3d.public_slug,
                "title": project3d.title,
                "description": (
                    project3d.seo_config.get("description", "")
                    if isinstance(project3d.seo_config, dict)
                    else ""
                ),
                "owner": public_author_name(owner),
                "type": "3d",
                "engine": resolve_scene3d_engine(
                    project3d.current_version.scene_json if project3d.current_version else None
                ),
                "published_at": project3d.published_at.isoformat()
                if project3d.published_at
                else None,
                "regular_url": f"/users/@{profile.handle}/pieces/{project3d.public_slug}",
                "thumbnail_url": f"/api/public/projects3d/{project3d.public_id}/thumbnail.png",
            }
        )
    for piece in ArtPiece.objects.filter(
        owner=owner, status=ArtPiece.Status.PUBLISHED, current_version__isnull=False
    ):
        items.append(
            {
                "id": str(piece.public_id),
                "slug": piece.public_slug,
                "title": piece.title,
                "description": piece.description,
                "owner": public_author_name(owner),
                "type": "generated",
                "engine": piece.engine,
                "published_at": piece.published_at.isoformat() if piece.published_at else None,
                "regular_url": f"/users/@{profile.handle}/pieces/{piece.public_slug}",
                "thumbnail_url": f"/api/public/art-pieces/{piece.public_id}/thumbnail.png",
                "thumbnail_is_fallback": bool(
                    getattr(getattr(piece.current_version, "thumbnail", None), "is_fallback", True)
                ),
            }
        )
    collections = []
    for collection in Collection.objects.filter(
        owner=owner,
        visibility=Collection.Visibility.PUBLIC,
        is_deleted=False,
        published_at__isnull=False,
    ):
        payload = collection_payload(collection, public=True)
        public_items = payload["items"]
        collections.append(
            {
                "id": payload["id"],
                "title": payload["title"],
                "slug": payload["slug"],
                "viewer_url": payload["canonical_url"],
                "thumbnail_url": public_items[0]["thumbnail_url"] if public_items else None,
                "item_count": len(public_items),
            }
        )
    return {"profile": _profile_payload(profile), "collections": collections, "pieces": items}


class AccountProfileView(APIView):
    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)
        try:
            profile, _ = PublicProfile.objects.get_or_create(
                user=request.user,
                defaults={"style": ProfileStyle.objects.filter(key="default").first()},
            )
            if profile.handle is None:
                with transaction.atomic():
                    profile = PublicProfile.objects.select_for_update().get(pk=profile.pk)
                    if profile.handle is None:
                        profile.handle = _available_handle(request.user)
                        profile.save(update_fields=["handle", "updated_at"])
            payload = _profile_payload(profile)
            payload["available_styles"] = _available_styles()
            payload["available_palettes"] = available_palettes()
        except (OperationalError, ProgrammingError):
            # A schema-drift deployment (a pending migration not yet applied
            # to this database) must fail safely, not surface an unhandled
            # 500 traceback (#571).
            return Response({"detail": "Profile settings are temporarily unavailable."}, status=503)
        return Response(payload)

    def patch(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)
        serializer = ProfileSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"error": "validation_failed", "detail": serializer.errors}, status=400)
        values = serializer.validated_data
        if "theme_config" in values:
            try:
                values["theme_config"] = sanitize_theme_config(values["theme_config"])
            except ValueError as exc:
                return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        if "palette_overrides" in values:
            try:
                values["palette_overrides"] = sanitize_palette_overrides(
                    values["palette_overrides"]
                )
            except ValueError as exc:
                return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        if "palette_key" in values and values["palette_key"] not in PALETTE_DEFINITIONS:
            return Response(
                {"error": "validation_failed", "detail": {"palette_key": ["Unknown palette."]}},
                status=400,
            )
        if "presentation_overrides" in values:
            try:
                values["presentation_overrides"] = sanitize_presentation(
                    values["presentation_overrides"]
                )
            except ValueError as exc:
                return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        profile = PublicProfile.objects.get_or_create(user=request.user)[0]
        with transaction.atomic():
            profile = PublicProfile.objects.select_for_update().get(pk=profile.pk)
            if profile.revision != values["revision"]:
                return Response({"error": "revision_conflict"}, status=409)
            handle = values.get("handle", profile.handle)
            style_key = values.get(
                "style_key", profile.style.key if profile.style_id else "default"
            )
            try:
                style = ProfileStyle.objects.get(key=style_key)
            except ProfileStyle.DoesNotExist:
                return Response(
                    {
                        "error": "validation_failed",
                        "detail": {"style_key": ["Unknown profile style."]},
                    },
                    status=400,
                )
            if not style.enabled and style.pk != profile.style_id:
                return Response(
                    {
                        "error": "validation_failed",
                        "detail": {"style_key": ["That profile style is disabled."]},
                    },
                    status=400,
                )
            if not handle:
                return Response(
                    {
                        "error": "validation_failed",
                        "detail": {"handle": ["A public handle is required."]},
                    },
                    status=400,
                )
            if handle in RESERVED_HANDLES:
                return Response(
                    {
                        "error": "validation_failed",
                        "detail": {"handle": ["That handle is reserved."]},
                    },
                    status=400,
                )
            redirect = (
                PublicProfileHandleRedirect.objects.filter(old_handle=handle)
                .select_related("profile")
                .first()
            )
            # An owner may reclaim a handle from their own redirect history.
            # This keeps test/dev fixture identities resettable and is also a
            # reasonable product rule: once the owner reclaims the old name,
            # the old alias is no longer needed. Redirects owned by another
            # profile remain hard conflicts.
            if (
                handle
                and handle != profile.handle
                and (
                    PublicProfile.objects.filter(handle=handle).exclude(pk=profile.pk).exists()
                    or (redirect is not None and redirect.profile_id != profile.pk)
                )
            ):
                return Response(
                    {
                        "error": "handle_taken",
                        "detail": {"handle": ["That handle is already in use."]},
                    },
                    status=409,
                )
            old_handle = profile.handle
            if redirect is not None and redirect.profile_id == profile.pk:
                redirect.delete()
            style_changed = "style_key" in values and style.pk != profile.style_id
            for field in (
                "handle",
                "style",
                "display_name",
                "bio",
                "website_url",
                "social_links",
                "profile_image_url",
                "is_public",
                "theme_config",
                "palette_key",
                "palette_overrides",
                "presentation_overrides",
            ):
                if field in values:
                    setattr(profile, field, style if field == "style" else values[field])
            if "style_key" in values:
                profile.style = style
                if style_changed:
                    profile.theme_config = {}
            profile.revision += 1
            profile.save()
            if old_handle and old_handle != profile.handle:
                PublicProfileHandleRedirect.objects.update_or_create(
                    old_handle=old_handle, defaults={"profile": profile}
                )
        payload = _profile_payload(profile)
        payload["available_styles"] = _available_styles()
        payload["available_palettes"] = available_palettes()
        return Response(payload)


class PublicProfileView(APIView):
    def get(self, request, handle):
        profile = (
            PublicProfile.objects.filter(
                handle=handle.lower(), is_public=True, user__is_active=True
            )
            .select_related("user", "style")
            .first()
        )
        if profile is None:
            redirect = (
                PublicProfileHandleRedirect.objects.filter(old_handle=handle.lower())
                .select_related("profile")
                .first()
            )
            if redirect and redirect.profile.is_public and redirect.profile.user.is_active:
                return HttpResponsePermanentRedirect(f"/api/users/@{redirect.profile.handle}/")
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_piece_payload(profile))
