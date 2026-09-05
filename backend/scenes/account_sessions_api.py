"""GET /api/account/sessions/, DELETE /api/account/sessions/<public_id>/
(issue #441).

Authenticated caller only; every response and revocation is scoped to
`request.user`'s own sessions -- `scenes.account_sessions.revoke_session`
only ever searches within them, so a foreign public_id (another user's
session, or a made-up one) is indistinguishable from an already-revoked
one: both are a safe no-op, never a lookup a caller could use to probe
whether some other session exists.
"""

from django.contrib.auth import logout
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.account_sessions import compute_public_id, list_sessions, revoke_session


def _auth_required_response(request) -> Response | None:
    if not request.user.is_authenticated:
        return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
    return None


class AccountSessionsView(APIView):
    def get(self, request):
        denied = _auth_required_response(request)
        if denied:
            return denied
        return Response(list_sessions(request.user, request.session.session_key))


class AccountSessionRevokeView(APIView):
    def delete(self, request, public_id):
        denied = _auth_required_response(request)
        if denied:
            return denied

        is_current = public_id == compute_public_id(request.session.session_key)
        revoked = revoke_session(request.user, public_id)

        if is_current and revoked:
            # The Session row is already gone; logout() also flushes this
            # request's own in-memory session state and clears the cookie
            # on the response, exactly like a normal explicit logout.
            logout(request)

        return Response({"revoked": revoked, "was_current": is_current}, status=status.HTTP_200_OK)
