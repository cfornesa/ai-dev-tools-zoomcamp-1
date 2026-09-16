"""Anonymous public gallery search, separated by account/content scope (#581)."""

from django.db.models import Q
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.art_piece_persistence import eligible_art_pieces
from scenes.gallery import eligible_projects, eligible_projects3d
from scenes.models import PublicProfile
from scenes.serializers import PublicGalleryItemSerializer


class PublicGallerySearchView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        scope = request.query_params.get("scope", "content")
        if len(query) > 100 or scope not in {"accounts", "content"}:
            return Response({"errors": {"query": ["Invalid search query."]}}, status=400)
        if not query:
            return Response({"scope": scope, "results": []})
        if scope == "accounts":
            profiles = (
                PublicProfile.objects.filter(is_public=True)
                .filter(
                    Q(handle__icontains=query)
                    | Q(display_name__icontains=query)
                    | Q(user__username__icontains=query)
                )
                .select_related("user")
                .order_by("handle")[:50]
            )
            return Response(
                {
                    "scope": scope,
                    "results": [
                        {
                            "id": str(profile.user_id),
                            "kind": "account",
                            "title": profile.display_name or profile.handle,
                            "owner": profile.user.get_username(),
                            "handle": profile.handle,
                            "viewer_url": f"/users/@{profile.handle}",
                        }
                        for profile in profiles
                    ],
                }
            )
        candidates = []
        for kind, queryset in (
            ("2d", eligible_projects()),
            ("3d", eligible_projects3d()),
            ("generated", eligible_art_pieces()),
        ):
            filtered = (
                queryset.filter(Q(title__icontains=query) | Q(description__icontains=query))
                if kind != "3d"
                else queryset.filter(title__icontains=query)
            )
            candidates.extend((record.published_at, kind, record) for record in filtered[:50])
        candidates.sort(key=lambda item: (item[0], item[2].id), reverse=True)
        return Response(
            {
                "scope": scope,
                "results": PublicGalleryItemSerializer(
                    [(kind, record) for _, kind, record in candidates[:50]], many=True
                ).data,
            }
        )
