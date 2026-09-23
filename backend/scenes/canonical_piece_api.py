"""Resolve stable public piece URLs to existing renderer payloads (#578)."""

from django.db.models import Prefetch
from django.http import Http404
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.art_piece_persistence import _piece_data
from scenes.gallery import eligible_projects, eligible_projects3d
from scenes.models import ArtPiece, Project, Project3D, PublicProfile, SceneVersion3D
from scenes.serializers import (
    Project3DSerializer,
    ProjectSerializer,
    PublicProject3DSerializer,
    PublicProjectSerializer,
)


def _profile_or_404(handle):
    return PublicProfile.objects.select_related("user").get(handle=handle, is_public=True)


def _public_art_piece_versions(piece):
    """Return the deliberately narrow version context for the public page."""
    summaries = []
    for version in piece.versions.order_by("-sequence", "-id"):
        metadata = (
            version.generation_metadata if isinstance(version.generation_metadata, dict) else {}
        )
        model_label = metadata.get("model_label") or metadata.get("model")
        summaries.append(
            {
                "sequence": version.sequence,
                "engine": piece.engine,
                "status": piece.status,
                "prompt": piece.prompt,
                "created_at": version.created_at,
                "model_label": model_label if isinstance(model_label, str) else None,
            }
        )
    return summaries


class PublicPieceBySlugView(APIView):
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
                    "viewer_url": f"/users/@{handle}/pieces/{project.public_slug}",
                    "type": "2d",
                    "piece": PublicProjectSerializer(project).data,
                }
            )
        project3d = (
            eligible_projects3d()
            .filter(owner=owner, public_slug=piece_slug)
            .prefetch_related(
                Prefetch(
                    "versions",
                    queryset=SceneVersion3D.objects.order_by("-sequence", "-id"),
                    to_attr="_public_version_summaries",
                )
            )
            .first()
        )
        if project3d:
            return Response(
                {
                    "canonical_url": f"/users/@{handle}/pieces/{project3d.public_slug}",
                    "viewer_url": f"/users/@{handle}/pieces/{project3d.public_slug}",
                    "type": "3d",
                    "piece": PublicProject3DSerializer(project3d).data,
                }
            )
        art_piece = (
            ArtPiece.objects.filter(
                owner=owner,
                public_slug=piece_slug,
                status=ArtPiece.Status.PUBLISHED,
                is_deleted=False,
                current_version__isnull=False,
            )
            .prefetch_related("versions")
            .first()
        )
        if art_piece:
            response = {
                "canonical_url": f"/users/@{handle}/pieces/{art_piece.public_slug}",
                "viewer_url": f"/users/@{handle}/pieces/{art_piece.public_slug}",
                "type": "generated",
                "piece": _piece_data(art_piece, public=True),
            }
            response["piece"]["versions"] = _public_art_piece_versions(art_piece)
            if request.user.is_authenticated and request.user == owner:
                response["edit_url"] = f"/users/@{handle}/edit/{art_piece.public_slug}"
            return Response(response)
        raise Http404


class OwnerArtPieceBySlugView(APIView):
    """Resolve an owner's slug to the private editor payload without leakage.

    Despite the historical class name, this is the owner editor resolver for
    every authored piece family. The response keeps the generated-piece
    payload unchanged and adds a ``type`` discriminator for structured
    projects so the canonical editor route can mount the unified 2D or 3D
    workspace without exposing private records to anyone else.
    """

    permission_classes: list = []

    def get(self, request, handle, piece_slug):
        if not request.user.is_authenticated:
            raise Http404
        project = (
            Project.objects.select_related("owner", "current_version")
            .filter(
                owner=request.user,
                owner__public_profile__handle=handle,
                public_slug=piece_slug,
                is_deleted=False,
            )
            .first()
        )
        if project is not None:
            return Response(
                {
                    "canonical_url": f"/users/@{handle}/edit/{project.public_slug}",
                    "type": "2d",
                    "piece": ProjectSerializer(project).data,
                }
            )
        project3d = (
            Project3D.objects.select_related("owner", "current_version")
            .filter(
                owner=request.user,
                owner__public_profile__handle=handle,
                public_slug=piece_slug,
                is_deleted=False,
            )
            .first()
        )
        if project3d is not None:
            return Response(
                {
                    "canonical_url": f"/users/@{handle}/edit/{project3d.public_slug}",
                    "type": "3d",
                    "piece": Project3DSerializer(project3d).data,
                }
            )
        piece = (
            ArtPiece.objects.select_related("owner", "current_version")
            .filter(
                owner=request.user,
                owner__public_profile__handle=handle,
                public_slug=piece_slug,
                is_deleted=False,
            )
            .first()
        )
        if piece is None:
            raise Http404
        return Response(
            {
                "canonical_url": f"/users/@{handle}/edit/{piece.public_slug}",
                "piece": _piece_data(piece, public=False),
            }
        )
