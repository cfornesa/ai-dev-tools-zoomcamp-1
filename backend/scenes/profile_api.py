"""Owner profile settings and privacy-safe public profile reads (#520)."""

import re

from django.db import transaction
from django.http import HttpResponsePermanentRedirect
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.gallery import eligible_projects, eligible_projects3d
from scenes.models import ArtPiece, PublicProfile, PublicProfileHandleRedirect
from scenes.theme import effective_theme, sanitize_theme

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
    theme_config = serializers.DictField(required=False)


def _profile_payload(profile: PublicProfile) -> dict:
    return {
        "handle": profile.handle,
        "display_name": profile.display_name,
        "bio": profile.bio,
        "website_url": profile.website_url,
        "social_links": profile.social_links,
        "profile_image_url": profile.profile_image_url,
        "is_public": profile.is_public,
        "revision": profile.revision,
        "theme_config": effective_theme(profile.theme_config),
    }


def _piece_payload(profile: PublicProfile) -> dict:
    owner = profile.user
    items = []
    for project in eligible_projects().filter(owner=owner):
        items.append(
            {
                "id": str(project.public_id),
                "title": project.title,
                "type": "2d",
                "thumbnail_url": f"/api/public/projects/{project.public_id}/thumbnail.png",
            }
        )
    for project3d in eligible_projects3d().filter(owner=owner):
        items.append(
            {
                "id": str(project3d.public_id),
                "title": project3d.title,
                "type": "3d",
                "thumbnail_url": f"/api/public/projects3d/{project3d.public_id}/thumbnail.png",
            }
        )
    for piece in ArtPiece.objects.filter(
        owner=owner, status=ArtPiece.Status.PUBLISHED, current_version__isnull=False
    ):
        items.append(
            {
                "id": str(piece.public_id),
                "title": piece.title,
                "type": "generated",
                "engine": piece.engine,
                "thumbnail_url": f"/api/public/art-pieces/{piece.public_id}/thumbnail.png",
            }
        )
    return {"profile": _profile_payload(profile), "pieces": items}


class AccountProfileView(APIView):
    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)
        profile, _ = PublicProfile.objects.get_or_create(user=request.user)
        if profile.handle is None:
            with transaction.atomic():
                profile = PublicProfile.objects.select_for_update().get(pk=profile.pk)
                if profile.handle is None:
                    profile.handle = _available_handle(request.user)
                    profile.save(update_fields=["handle", "updated_at"])
        return Response(_profile_payload(profile))

    def patch(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)
        serializer = ProfileSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"error": "validation_failed", "detail": serializer.errors}, status=400)
        values = serializer.validated_data
        if "theme_config" in values:
            try:
                values["theme_config"] = sanitize_theme(values["theme_config"])
            except ValueError as exc:
                return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        profile = PublicProfile.objects.get_or_create(user=request.user)[0]
        with transaction.atomic():
            profile = PublicProfile.objects.select_for_update().get(pk=profile.pk)
            if profile.revision != values["revision"]:
                return Response({"error": "revision_conflict"}, status=409)
            handle = values.get("handle", profile.handle)
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
            if handle and (
                PublicProfile.objects.filter(handle=handle).exclude(pk=profile.pk).exists()
                or PublicProfileHandleRedirect.objects.filter(old_handle=handle).exists()
            ):
                return Response(
                    {
                        "error": "handle_taken",
                        "detail": {"handle": ["That handle is already in use."]},
                    },
                    status=409,
                )
            old_handle = profile.handle
            for field in (
                "handle",
                "display_name",
                "bio",
                "website_url",
                "social_links",
                "profile_image_url",
                "is_public",
                "theme_config",
            ):
                if field in values:
                    setattr(profile, field, values[field])
            profile.revision += 1
            profile.save()
            if old_handle and old_handle != profile.handle:
                PublicProfileHandleRedirect.objects.update_or_create(
                    old_handle=old_handle, defaults={"profile": profile}
                )
        return Response(_profile_payload(profile))


class PublicProfileView(APIView):
    def get(self, request, handle):
        profile = (
            PublicProfile.objects.filter(
                handle=handle.lower(), is_public=True, user__is_active=True
            )
            .select_related("user")
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
