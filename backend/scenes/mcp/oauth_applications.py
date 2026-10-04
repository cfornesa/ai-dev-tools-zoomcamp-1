"""Registration and self-revocation rules for MCP OAuth applications (#1216)."""

from __future__ import annotations

from datetime import timedelta
from urllib.parse import urlsplit

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from oauth2_provider.models import (
    get_access_token_model,
    get_application_model,
    get_refresh_token_model,
)


def _is_mcp_resource(resources) -> bool:
    """Identify an MCP audience independent of a local/deployed host name."""
    return isinstance(resources, list) and any(
        isinstance(resource, str) and urlsplit(resource).path == '/mcp' for resource in resources
    )


def list_connected_applications(user):
    """Return only applications with this user's currently usable MCP grant."""
    access_token_model = get_access_token_model()
    refresh_token_model = get_refresh_token_model()
    now = timezone.now()
    records = {}

    active_access_tokens = access_token_model.objects.filter(
        user=user,
        application__isnull=False,
        expires__gt=now,
    ).select_related('application')
    for token in active_access_tokens:
        if not _is_mcp_resource(token.resource):
            continue
        record = records.setdefault(
            token.application_id,
            {'application': token.application, 'scopes': set(), 'last_authorized': token.created},
        )
        record['scopes'].update(token.scope.split())
        record['last_authorized'] = max(record['last_authorized'], token.created)

    active_refresh_tokens = refresh_token_model.objects.filter(
        user=user,
        application__isnull=False,
        revoked__isnull=True,
        access_token__isnull=False,
        access_token__expires__gt=now
        - timedelta(seconds=settings.OAUTH2_PROVIDER['REFRESH_TOKEN_EXPIRE_SECONDS']),
    ).select_related('application', 'access_token')
    for token in active_refresh_tokens:
        if not _is_mcp_resource(token.resource):
            continue
        record = records.setdefault(
            token.application_id,
            {'application': token.application, 'scopes': set(), 'last_authorized': token.created},
        )
        if token.access_token_id:
            record['scopes'].update(token.access_token.scope.split())
        record['last_authorized'] = max(record['last_authorized'], token.created)

    return [
        {
            'id': application_id,
            'name': record['application'].name,
            'scopes': sorted(record['scopes']),
            'last_authorized': record['last_authorized'],
        }
        for application_id, record in sorted(records.items())
    ]


@transaction.atomic
def revoke_connected_application(user, application_id: int) -> bool:
    """Revoke this user's access and refresh tokens without probing other users."""
    access_token_model = get_access_token_model()
    refresh_token_model = get_refresh_token_model()
    refresh_tokens = list(
        refresh_token_model.objects.select_for_update().filter(
            user=user,
            application_id=application_id,
            revoked__isnull=True,
        )
    )
    access_tokens = list(
        access_token_model.objects.select_for_update().filter(
            user=user,
            application_id=application_id,
        )
    )
    changed = bool(refresh_tokens or access_tokens)
    for token in refresh_tokens:
        token.revoke()
    for token in access_tokens:
        token.revoke()
    return changed


def register_public_application(*, name: str, redirect_uris: list[str]):
    """Create a pre-registered, PKCE-only public OAuth application."""
    app_model = get_application_model()
    return app_model.objects.create(
        name=name,
        redirect_uris=' '.join(redirect_uris),
        client_type=app_model.CLIENT_PUBLIC,
        authorization_grant_type=app_model.GRANT_AUTHORIZATION_CODE,
        skip_authorization=False,
        user=None,
    )
