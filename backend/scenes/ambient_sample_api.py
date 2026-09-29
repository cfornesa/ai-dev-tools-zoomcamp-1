"""Authenticated ambient-sample persistence for published 3D scenes (#1056)."""

from __future__ import annotations

import hashlib
import uuid

from django.http import Http404
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.api3d import _get_project3d_or_404
from scenes.models import PieceIntakeAsset
from scenes.permissions import Action, can

AMBIENT_SAMPLE_MIME_TYPES = frozenset(
    {"audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4"}
)
MAX_AMBIENT_SAMPLE_BYTES = 10 * 1024 * 1024


class Project3DAmbientSampleView(APIView):
    """Sync one browser-local sample into the server's public asset store.

    The editor already has the stable local asset UUID in the scene's sonic
    contract. Keeping that UUID as ``source_asset_id`` lets public viewers
    resolve the same reference without rewriting scene JSON.
    """

    parser_classes = [MultiPartParser]

    def post(self, request, public_id):
        project = _get_project3d_or_404(public_id)
        if not can(request.user, Action.PROJECT3D_WRITE, project):
            raise Http404
        upload = request.FILES.get("sample")
        asset_id = request.data.get("asset_id")
        if upload is None or not asset_id:
            return Response(
                {"detail": "sample and asset_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            source_asset_id = uuid.UUID(str(asset_id))
        except (TypeError, ValueError, AttributeError):
            return Response({"detail": "asset_id must be a UUID."}, status=400)
        mime_type = str(upload.content_type or "").lower()
        if mime_type not in AMBIENT_SAMPLE_MIME_TYPES:
            return Response({"detail": "Unsupported ambient sample type."}, status=400)
        if upload.size is not None and upload.size > MAX_AMBIENT_SAMPLE_BYTES:
            return Response({"detail": "Ambient sample exceeds the 10MB limit."}, status=413)
        data = upload.read()
        if len(data) > MAX_AMBIENT_SAMPLE_BYTES:
            return Response({"detail": "Ambient sample exceeds the 10MB limit."}, status=413)

        asset, _ = PieceIntakeAsset.objects.update_or_create(
            owner=project.owner,
            piece_kind="3d",
            piece_public_id=project.public_id,
            source_asset_id=source_asset_id,
            defaults={
                "filename": str(upload.name or "ambient-sample"),
                "alt_text": "",
                "mime_type": mime_type,
                "byte_size": len(data),
                "checksum": hashlib.sha256(data).hexdigest(),
                "data": data,
            },
        )
        return Response(
            {
                "asset_id": str(asset.source_asset_id),
                "mime_type": asset.mime_type,
                "byte_size": asset.byte_size,
            }
        )
