"""Admin API for the aggregate continuity panel (#1143)."""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.admin_settings_api import _admin_required_response
from scenes.continuity_metrics import ContinuityMetricsTimeoutError, get_continuity_metrics


class AdminContinuityMetricsView(APIView):
    def get(self, request):
        denied = _admin_required_response(request)
        if denied:
            return denied
        try:
            return Response(get_continuity_metrics())
        except ContinuityMetricsTimeoutError:
            return Response(
                {
                    "detail": "Continuity metrics are temporarily unavailable. Please retry.",
                    "retryable": True,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
