"""Anonymous delivery of media retained with published piece intake (#941)."""

from __future__ import annotations

import uuid

from django.http import Http404, HttpResponse
from rest_framework.views import APIView

from scenes.models import ArtPiece, PieceIntakeAsset, Project, Project3D
from scenes.sonic_contract import normalize_sonic


def _published_piece(kind: str, public_id: uuid.UUID):
    if kind == "2d":
        return Project.objects.filter(
            public_id=public_id, visibility=Project.Visibility.PUBLIC, is_deleted=False
        ).first()
    if kind == "3d":
        return Project3D.objects.filter(
            public_id=public_id, visibility=Project3D.Visibility.PUBLIC, is_deleted=False
        ).first()
    if kind == "generated":
        return ArtPiece.objects.filter(
            public_id=public_id, status=ArtPiece.Status.PUBLISHED, is_deleted=False
        ).first()
    return None


class PublicPieceAssetView(APIView):
    """Return one asset only when its owning piece is currently published."""

    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request, kind: str, public_id: uuid.UUID, asset_id: uuid.UUID):
        if _published_piece(kind, public_id) is None:
            raise Http404
        asset = (
            PieceIntakeAsset.objects.filter(
                piece_kind=kind, piece_public_id=public_id, source_asset_id=asset_id
            )
            .order_by("-created_at", "-id")
            .first()
        )
        if asset is None:
            raise Http404
        if kind == "3d":
            current = (
                Project3D.objects.filter(public_id=public_id, current_version__isnull=False)
                .values_list("current_version__scene_json", flat=True)
                .first()
            )
            ambient_sample = normalize_sonic((current or {}).get("sonic"))
            if not ambient_sample or ambient_sample["extras"].get("ambient_sample") != str(
                asset.source_asset_id
            ):
                raise Http404
        response = HttpResponse(bytes(asset.data), content_type=asset.mime_type)
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = "public, immutable"
        response["Access-Control-Allow-Origin"] = "*"
        response["X-Asset-Checksum"] = asset.checksum
        return response
