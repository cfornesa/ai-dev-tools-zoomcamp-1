"""Resolve stable public piece URLs to existing renderer payloads (#578)."""

from django.http import Http404
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.art_piece_persistence import _piece_data
from scenes.gallery import eligible_projects, eligible_projects3d
from scenes.models import ArtPiece, PublicProfile
from scenes.serializers import Project3DSerializer, ProjectSerializer


def _profile_or_404(handle):
    return PublicProfile.objects.select_related("user").get(handle=handle, is_public=True)


class PublicPieceBySlugView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request, handle, piece_slug):
        try:
            profile = _profile_or_404(handle)
        except PublicProfile.DoesNotExist as exc:
            raise Http404 from exc
        owner = profile.user
        project = eligible_projects().filter(owner=owner, public_slug=piece_slug).first()
        if project:
            return Response(
                {
                    "canonical_url": f"/users/@{handle}/pieces/{project.public_slug}",
                    "viewer_url": f"/p/{project.public_id}",
                    "type": "2d",
                    "piece": ProjectSerializer(project).data,
                }
            )
        project3d = eligible_projects3d().filter(owner=owner, public_slug=piece_slug).first()
        if project3d:
            return Response(
                {
                    "canonical_url": f"/users/@{handle}/pieces/{project3d.public_slug}",
                    "viewer_url": f"/p3d/{project3d.public_id}",
                    "type": "3d",
                    "piece": Project3DSerializer(project3d).data,
                }
            )
        art_piece = ArtPiece.objects.filter(
            owner=owner,
            public_slug=piece_slug,
            status=ArtPiece.Status.PUBLISHED,
            is_deleted=False,
            current_version__isnull=False,
        ).first()
        if art_piece:
            return Response(
                {
                    "canonical_url": f"/users/@{handle}/pieces/{art_piece.public_slug}",
                    "viewer_url": f"/art-pieces/p/{art_piece.public_id}",
                    "type": "generated",
                    "piece": _piece_data(art_piece, public=True),
                }
            )
        raise Http404
