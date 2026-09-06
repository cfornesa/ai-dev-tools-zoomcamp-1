"""GET /api/account/export/ (issue #442).

Authenticated caller only; the response is always exactly the caller's
own portable data export -- there is no parameter here that could read
another user's projects, pieces, identities, or plan. A read-only GET
is naturally safe to repeat; nothing here is mutated.
"""

import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.account_export import build_account_export

logger = logging.getLogger(__name__)


class AccountDataExportView(APIView):
    def get(self, request):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED
            )
        try:
            export = build_account_export(request.user)
        except Exception:
            # Bounded, actionable failure: never leak internals about why
            # assembling the export failed.
            logger.exception("Account data export failed for user %s", request.user.pk)
            return Response(
                {"detail": "Could not generate your data export. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        response = Response(export)
        response["Content-Disposition"] = 'attachment; filename="account-export.json"'
        return response
