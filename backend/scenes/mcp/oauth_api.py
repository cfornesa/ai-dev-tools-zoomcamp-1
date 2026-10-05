"""Session endpoints for MCP OAuth client registration and account revocation (#1216)."""

from __future__ import annotations

from urllib.parse import urlsplit

from oauth2_provider.models import get_application_model
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.admin_authorization import is_application_admin
from scenes.mcp.oauth_applications import (
    list_connected_applications,
    register_public_application,
    revoke_connected_application,
)


def _login_required(request) -> Response | None:
    if not request.user.is_authenticated:
        return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
    return None


class OAuthApplicationRegistrationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, trim_whitespace=True)
    redirect_uris = serializers.ListField(
        child=serializers.CharField(max_length=2048, trim_whitespace=True),
        min_length=1,
        max_length=20,
    )

    def validate_redirect_uris(self, values):
        if len(values) != len(set(values)):
            raise serializers.ValidationError('Redirect URIs must be unique.')
        for value in values:
            try:
                parsed = urlsplit(value)
                hostname = parsed.hostname
                port = parsed.port
            except ValueError as exc:
                raise serializers.ValidationError(
                    'Each redirect URI must be a valid absolute URI.'
                ) from exc
            if (
                parsed.scheme not in {'https', 'http'}
                or not hostname
                or parsed.username is not None
                or parsed.password is not None
                or parsed.fragment
                or '*' in value
                or port == 0
            ):
                raise serializers.ValidationError(
                    'Each redirect URI must be an exact HTTPS or loopback URI.'
                )
            if parsed.scheme == 'http' and parsed.hostname not in {'localhost', '127.0.0.1', '::1'}:
                raise serializers.ValidationError(
                    'HTTP redirect URIs are allowed only for loopback clients.'
                )
        return values


class AdminOAuthApplicationsView(APIView):
    """Application-admin-only listing and pre-registration for native clients."""

    def get(self, request):
        denied = _login_required(request)
        if denied:
            return denied
        if not is_application_admin(request.user):
            return Response(
                {'detail': 'Application-admin authorization required.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        app_model = get_application_model()
        rows = app_model.objects.order_by('name', 'pk').values(
            'pk', 'name', 'client_id', 'redirect_uris', 'client_type', 'authorization_grant_type'
        )
        return Response(list(rows))

    def post(self, request):
        denied = _login_required(request)
        if denied:
            return denied
        if not is_application_admin(request.user):
            return Response(
                {'detail': 'Application-admin authorization required.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = OAuthApplicationRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        application = register_public_application(**serializer.validated_data)
        return Response(
            {
                'id': application.pk,
                'name': application.name,
                'client_id': application.client_id,
                'redirect_uris': application.redirect_uris.splitlines(),
                'client_type': application.client_type,
                'authorization_grant_type': application.authorization_grant_type,
            },
            status=status.HTTP_201_CREATED,
        )


class AccountConnectedApplicationsView(APIView):
    """List and revoke the signed-in user's own authorized MCP applications."""

    def get(self, request):
        denied = _login_required(request)
        if denied:
            return denied
        return Response(list_connected_applications(request.user))


class AccountConnectedApplicationRevokeView(APIView):
    def delete(self, request, application_id: int):
        denied = _login_required(request)
        if denied:
            return denied
        revoked = revoke_connected_application(request.user, application_id)
        return Response({'revoked': revoked}, status=status.HTTP_200_OK)
