"""Authenticated read-only storage usage and transfer estimates (#931)."""

from __future__ import annotations

from uuid import UUID

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.models import ArtPiece, Project, Project3D
from scenes.storage_usage import estimate_transfer


def _integer_query(request, name: str) -> int:
    raw = request.query_params.get(name, "0")
    try:
        value = int(raw)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be a non-negative integer.") from exc
    if value < 0:
        raise ValueError(f"{name} must be a non-negative integer.")
    return value


def _owned_piece(user, raw_id: str) -> bool:
    try:
        public_id = UUID(raw_id)
    except (TypeError, ValueError):
        return False
    return (
        Project.all_objects.filter(owner=user, public_id=public_id).exists()
        or Project3D.all_objects.filter(owner=user, public_id=public_id).exists()
        or ArtPiece.all_objects.filter(owner=user, public_id=public_id).exists()
    )


class AccountStorageEstimateView(APIView):
    """Estimate a package transfer without reserving or writing storage."""

    def get(self, request):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED
            )
        piece_id = request.query_params.get("piece_id")
        if piece_id is not None and not _owned_piece(request.user, piece_id):
            return Response({"detail": "Piece not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            result = estimate_transfer(
                request.user,
                piece_bytes=_integer_query(request, "piece_bytes"),
                media_bytes=_integer_query(request, "media_bytes"),
                piece_files=_integer_query(request, "piece_files"),
                media_files=_integer_query(request, "media_files"),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)
