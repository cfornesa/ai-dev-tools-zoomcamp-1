"""Compatibility boundary for the export-only ambient-sample contract (#1067)."""

from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView


class Project3DAmbientSampleView(APIView):
    """Retain the old route as a non-writing compatibility shim.

    #886 Option 1 is export-only: samples stay in the authoring browser and
    are copied into downloaded ZIPs. Returning 410 instead of removing the
    route avoids turning an already-deployed client request into an opaque
    404 while making the retired server-delivery policy explicit.
    """

    def post(self, request, public_id):
        return Response(
            {
                "detail": (
                    "Ambient samples are export-only and remain in the authoring browser; "
                    "download a ZIP to include the sample."
                )
            },
            status=status.HTTP_410_GONE,
        )
