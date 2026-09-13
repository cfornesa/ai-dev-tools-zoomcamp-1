"""Owner profile settings and privacy-safe public profile reads (#520)."""

from django.db import transaction
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.gallery import eligible_projects, eligible_projects3d
from scenes.models import ArtPiece, PublicProfile
from scenes.theme import effective_theme, sanitize_theme

RESERVED_HANDLES = {"admin", "api", "account", "accounts", "users", "gallery"}


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
        return Response(_profile_payload(PublicProfile.objects.get_or_create(user=request.user)[0]))

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
            if handle in RESERVED_HANDLES:
                return Response(
                    {"error": "validation_failed", "detail": "That handle is reserved."}, status=400
                )
            if (
                handle
                and PublicProfile.objects.filter(handle=handle).exclude(pk=profile.pk).exists()
            ):
                return Response({"error": "handle_taken"}, status=409)
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
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_piece_payload(profile))
