"""POST /api/account/delete/ (issue #443).

Authenticated caller only, and always acts on `request.user` -- there is
no path here that can delete another account. On success the caller's own
session is logged out immediately (mirroring
`AccountSessionRevokeView`'s identical self-revocation behavior), so a
retried request against the now-stale session cookie fails closed as
"not authenticated" rather than as a confusing second deletion attempt.
"""

from django.contrib.auth import logout
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes import account_deletion

_ERROR_STATUS = {
    account_deletion.ReauthenticationRequired.code: status.HTTP_400_BAD_REQUEST,
    account_deletion.ConfirmationMismatch.code: status.HTTP_400_BAD_REQUEST,
    account_deletion.AccountAlreadyDeleted.code: status.HTTP_409_CONFLICT,
}


class AccountDeletionView(APIView):
    def post(self, request):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        password = request.data.get("password") or None
        confirmation = request.data.get("confirmation", "")

        try:
            account_deletion.delete_account(
                request.user, password=password, confirmation=confirmation
            )
        except account_deletion.AccountDeletionError as exc:
            return Response(
                {"error": exc.code, "detail": str(exc)},
                status=_ERROR_STATUS.get(exc.code, status.HTTP_400_BAD_REQUEST),
            )

        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)
