"""HTTP boundary for portable package intake (#932)."""

from __future__ import annotations

import uuid

from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.piece_intake import PieceIntakeError, intake_package


class PiecePackageIntakeView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        upload = request.FILES.get("package")
        if upload is None:
            return Response({"detail": "package is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            piece_id = request.data.get("piece_id")
            expected_revision = request.data.get("expected_revision")
            result = intake_package(
                owner=request.user,
                archive=upload.read(),
                idempotency_key=request.data.get("idempotency_key"),
                piece_id=uuid.UUID(str(piece_id)) if piece_id else None,
                expected_revision=int(expected_revision) if expected_revision else None,
            )
        except PermissionError:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        except LookupError:
            return Response(status=status.HTTP_404_NOT_FOUND)
        except (ValueError, PieceIntakeError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            result.response,
            status=status.HTTP_200_OK if not result.created else status.HTTP_201_CREATED,
        )
