"""GET/DELETE /api/account/identities/ (issue #426).

Authenticated caller only; every response is scoped to `request.user`'s
own identities -- there is no path here that can read or change another
user's linked providers. Linking itself is not an endpoint here at all:
it is allauth's own real `?process=connect` OAuth flow on the existing
`/accounts/<provider>/login/` routes (see
`backend.social_account_adapter.LinkedProvidersSocialAccountAdapter`'s
own docstring on how that interacts with the #420 conflict check).
"""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.account_identities import CannotUnlink, list_identities, unlink_identity


def _auth_required_response(request) -> Response | None:
    if not request.user.is_authenticated:
        return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
    return None


class AccountIdentitiesView(APIView):
    def get(self, request):
        denied = _auth_required_response(request)
        if denied:
            return denied
        return Response(list_identities(request.user))


class AccountIdentityUnlinkView(APIView):
    def delete(self, request, provider):
        denied = _auth_required_response(request)
        if denied:
            return denied
        try:
            identities = unlink_identity(user=request.user, provider=provider)
        except CannotUnlink as exc:
            return Response(
                {"error": "cannot_unlink", "detail": str(exc)}, status=status.HTTP_409_CONFLICT
            )
        return Response(identities)
