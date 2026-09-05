"""GET /api/account/entitlements/ (issue #439).

Authenticated caller only; the response is always the caller's own
summary -- there is no parameter here that could read another user's
tier, features, or usage.
"""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.account_entitlements import get_entitlement_summary


class AccountEntitlementsView(APIView):
    def get(self, request):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED
            )
        return Response(get_entitlement_summary(request.user))
