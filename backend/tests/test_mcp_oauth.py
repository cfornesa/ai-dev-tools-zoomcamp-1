"""OAuth provider contract and account isolation tests for MCP (#1216)."""

from __future__ import annotations

import base64
import hashlib
from urllib.parse import parse_qs, urlsplit

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from oauth2_provider.models import (
    AccessToken,
    Application,
    RefreshToken,
)

from scenes.models import ApplicationAdmin

pytestmark = pytest.mark.django_db

HOST = 'localhost'
RESOURCE = 'https://localhost/mcp'
REDIRECT_URI = 'https://client.example/callback'
VERIFIER = 'a' * 43
CHALLENGE = (
    base64.urlsafe_b64encode(hashlib.sha256(VERIFIER.encode()).digest()).decode().rstrip('=')
)


def _make_application(name='Desktop MCP client', redirect_uri=REDIRECT_URI):
    return Application.objects.create(
        name=name,
        redirect_uris=redirect_uri,
        client_type=Application.CLIENT_PUBLIC,
        authorization_grant_type=Application.GRANT_AUTHORIZATION_CODE,
        skip_authorization=False,
    )


def _authorize(
    client, application, *, scope='gallery:read', method='S256', redirect_uri=REDIRECT_URI
):
    url = reverse('oauth2_provider:authorize')
    query = {
        'response_type': 'code',
        'client_id': application.client_id,
        'redirect_uri': redirect_uri,
        'scope': scope,
        'state': 'opaque-state',
        'code_challenge': CHALLENGE,
        'code_challenge_method': method,
        'resource': RESOURCE,
    }
    response = client.get(url, query, secure=True, HTTP_HOST=HOST)
    if response.status_code == 200:
        if 'destructive' in scope.split():
            assert 'Separately consent to destructive actions.' in response.content.decode()
        response = client.post(
            url,
            {**query, 'allow': 'Authorize'},
            secure=True,
            HTTP_HOST=HOST,
        )
    return response


def _exchange_code(client, application, authorization_response, redirect_uri=REDIRECT_URI):
    location = authorization_response['Location']
    query = parse_qs(urlsplit(location).query)
    assert 'code' in query, query
    assert query['state'] == ['opaque-state']
    return client.post(
        reverse('oauth2_provider:token'),
        {
            'grant_type': 'authorization_code',
            'client_id': application.client_id,
            'code': query['code'][0],
            'redirect_uri': redirect_uri,
            'code_verifier': VERIFIER,
            'resource': RESOURCE,
        },
        secure=True,
        HTTP_HOST=HOST,
    )


def test_metadata_advertises_only_supported_oauth_and_mcp_resource(client):
    authorization = client.get(
        '/.well-known/oauth-authorization-server', secure=True, HTTP_HOST=HOST
    )
    assert authorization.status_code == 200
    assert authorization.json()['response_types_supported'] == ['code']
    assert set(authorization.json()['grant_types_supported']) == {
        'authorization_code',
        'refresh_token',
    }
    assert authorization.json()['code_challenge_methods_supported'] == ['S256']
    assert authorization.json()['authorization_endpoint'].endswith('/oauth/authorize/')
    assert authorization.json()['token_endpoint'].endswith('/oauth/token/')
    assert 'registration_endpoint' not in authorization.json()
    assert 'password' not in authorization.json()['grant_types_supported']
    assert 'implicit' not in authorization.json()['grant_types_supported']

    resource = client.get('/.well-known/oauth-protected-resource/mcp/', secure=True, HTTP_HOST=HOST)
    assert resource.status_code == 200
    assert resource.json()['resource'] == RESOURCE
    assert resource.json()['authorization_servers'] == ['https://localhost']
    assert set(resource.json()['scopes_supported']) == {
        'gallery:read',
        'projects:write',
        'ai:use',
        'destructive',
    }

    assert client.post('/oauth/register/').status_code == 404
    assert client.post('/oauth/applications/register/').status_code == 404

    user = get_user_model().objects.create_user(username='grant-gates', password='test-password')
    client.force_login(user)
    implicit = _make_application('Implicit must stay disabled')
    implicit.authorization_grant_type = Application.GRANT_IMPLICIT
    implicit.save(update_fields=['authorization_grant_type'])
    implicit_response = client.get(
        reverse('oauth2_provider:authorize'),
        {
            'response_type': 'token',
            'client_id': implicit.client_id,
            'redirect_uri': REDIRECT_URI,
            'scope': 'gallery:read',
            'state': 'implicit-state',
            'resource': RESOURCE,
        },
        secure=True,
        HTTP_HOST=HOST,
    )
    assert parse_qs(urlsplit(implicit_response['Location']).query).get('error') == [
        'unauthorized_client'
    ]
    implicit.authorization_grant_type = Application.GRANT_PASSWORD
    implicit.save(update_fields=['authorization_grant_type'])
    password_response = client.post(
        reverse('oauth2_provider:token'),
        {
            'grant_type': 'password',
            'client_id': implicit.client_id,
            'username': user.username,
            'password': 'test-password',
        },
        secure=True,
        HTTP_HOST=HOST,
    )
    assert password_response.status_code == 400
    assert password_response.json()['error'] in {'unauthorized_client', 'unsupported_grant_type'}


def test_authorization_code_requires_s256_exact_redirect_and_mcp_resource(client, caplog):
    user_model = get_user_model()
    user = user_model.objects.create_user(username='oauth-user', password='test-password')
    client.force_login(user)
    application = _make_application()

    response = _authorize(client, application, method='plain')
    plain_error = parse_qs(urlsplit(response['Location']).query)
    assert plain_error.get('error') == ['invalid_request']
    assert 'code' not in plain_error

    missing_pkce = client.get(
        reverse('oauth2_provider:authorize'),
        {
            'response_type': 'code',
            'client_id': application.client_id,
            'redirect_uri': REDIRECT_URI,
            'scope': 'gallery:read',
            'state': 'missing-pkce',
            'resource': RESOURCE,
        },
        secure=True,
        HTTP_HOST=HOST,
    )
    assert missing_pkce.status_code == 302
    assert 'code' not in parse_qs(urlsplit(missing_pkce['Location']).query)

    response = _authorize(client, application, redirect_uri=REDIRECT_URI + '?extra=1')
    assert response.status_code == 400

    url = reverse('oauth2_provider:authorize')
    response = client.get(
        url,
        {
            'response_type': 'code',
            'client_id': application.client_id,
            'redirect_uri': REDIRECT_URI,
            'scope': 'gallery:read',
            'state': 'opaque-state',
            'code_challenge': CHALLENGE,
            'code_challenge_method': 'S256',
            'resource': 'https://localhost/other/',
        },
        secure=True,
        HTTP_HOST=HOST,
    )
    wrong_resource_error = parse_qs(urlsplit(response['Location']).query)
    assert wrong_resource_error.get('error') == ['unauthorized_client']

    response = _authorize(client, application, scope='gallery:read destructive')
    assert response.status_code == 302, response.content
    authorization_code = parse_qs(urlsplit(response['Location']).query)['code'][0]
    wrong_callback = client.post(
        reverse('oauth2_provider:token'),
        {
            'grant_type': 'authorization_code',
            'client_id': application.client_id,
            'code': authorization_code,
            'redirect_uri': REDIRECT_URI + '?changed=1',
            'code_verifier': VERIFIER,
            'resource': RESOURCE,
        },
        secure=True,
        HTTP_HOST=HOST,
    )
    assert wrong_callback.status_code == 400
    token_response = _exchange_code(client, application, response)
    assert token_response.status_code == 200, token_response.content
    body = token_response.json()
    assert body['scope'] == 'gallery:read destructive'
    assert body['expires_in'] == 900
    access = AccessToken.objects.get(user=user, application=application)
    refresh = RefreshToken.objects.get(user=user, application=application, revoked__isnull=True)
    assert access.resource == [RESOURCE]
    assert refresh.resource == [RESOURCE]
    access_checksum = hashlib.sha256(body['access_token'].encode()).hexdigest()
    refresh_checksum = hashlib.sha256(body['refresh_token'].encode()).hexdigest()
    assert access.token == ''
    assert access.token_checksum == access_checksum
    assert refresh.token == ''
    assert refresh.token_checksum == refresh_checksum

    refresh_response = client.post(
        reverse('oauth2_provider:token'),
        {
            'grant_type': 'refresh_token',
            'client_id': application.client_id,
            'refresh_token': body['refresh_token'],
        },
        secure=True,
        HTTP_HOST=HOST,
    )
    assert refresh_response.status_code == 200, refresh_response.content
    assert refresh_response.json()['refresh_token'] != body['refresh_token']
    assert refresh_response.json()['scope'] == body['scope']

    revoke_response = client.post(
        reverse('oauth2_provider:revoke-token'),
        {
            'client_id': application.client_id,
            'token': refresh_response.json()['access_token'],
            'token_type_hint': 'access_token',
        },
        secure=True,
        HTTP_HOST=HOST,
    )
    assert revoke_response.status_code == 200
    access_checksum = hashlib.sha256(refresh_response.json()['access_token'].encode()).hexdigest()
    assert not AccessToken.objects.filter(token_checksum=access_checksum).exists()
    refresh_checksum = hashlib.sha256(refresh_response.json()['refresh_token'].encode()).hexdigest()
    assert not RefreshToken.objects.filter(
        token_checksum=refresh_checksum, revoked__isnull=True
    ).exists()
    assert body['access_token'] not in caplog.text
    assert body['refresh_token'] not in caplog.text


def test_loopback_http_redirect_requires_exact_registered_uri(client):
    user = get_user_model().objects.create_user(
        username='loopback-client', password='test-password'
    )
    client.force_login(user)
    redirect_uri = 'http://127.0.0.1:43123/callback'
    application = _make_application('Loopback MCP client', redirect_uri)

    mismatched_port = client.get(
        reverse('oauth2_provider:authorize'),
        {
            'response_type': 'code',
            'client_id': application.client_id,
            'redirect_uri': 'http://127.0.0.1:43124/callback',
            'scope': 'gallery:read',
            'state': 'loopback-state',
            'code_challenge': CHALLENGE,
            'code_challenge_method': 'S256',
            'resource': RESOURCE,
        },
        secure=True,
        HTTP_HOST=HOST,
    )
    assert mismatched_port.status_code == 400

    response = _authorize(client, application, redirect_uri=redirect_uri)
    assert response.status_code == 302, response.content
    token_response = _exchange_code(client, application, response, redirect_uri)
    assert token_response.status_code == 200, token_response.content


def test_admin_registration_and_connected_app_revocation_are_scoped(client):
    user_model = get_user_model()
    owner = user_model.objects.create_user(username='oauth-owner', password='test-password')
    other = user_model.objects.create_user(username='oauth-other', password='test-password')
    stranger = user_model.objects.create_user(username='oauth-stranger', password='test-password')
    admin = user_model.objects.create_user(username='oauth-admin', password='test-password')
    ApplicationAdmin.objects.create(user=admin)

    admin_path = '/api/admin/oauth-applications/'
    assert client.post(admin_path, {}).status_code == 401
    client.force_login(owner)
    assert client.post(admin_path, {}).status_code == 403
    client.force_login(admin)
    invalid = client.post(
        admin_path,
        {'name': 'Bad app', 'redirect_uris': ['http://client.example/callback']},
        content_type='application/json',
    )
    assert invalid.status_code == 400
    registered = client.post(
        admin_path,
        {'name': 'Registered desktop client', 'redirect_uris': [REDIRECT_URI]},
        content_type='application/json',
    )
    assert registered.status_code == 201, registered.content
    assert 'client_secret' not in registered.json()
    application = Application.objects.get(client_id=registered.json()['client_id'])
    assert application.authorization_grant_type == Application.GRANT_AUTHORIZATION_CODE
    assert not application.skip_authorization
    loopback = client.post(
        admin_path,
        {'name': 'Loopback native client', 'redirect_uris': ['http://127.0.0.1:8787/callback']},
        content_type='application/json',
    )
    assert loopback.status_code == 201, loopback.content

    client.force_login(owner)
    assert client.get('/api/account/connected-apps/').json() == []
    application = _make_application('Shared client')
    owner_access = AccessToken.objects.create(
        user=owner,
        application=application,
        token='owner-token-value',
        expires=AccessToken.objects.model._meta.get_field('expires').to_python(
            '2099-01-01T00:00:00Z'
        ),
        scope='gallery:read',
        resource=[RESOURCE],
    )
    RefreshToken.objects.create(
        user=owner,
        application=application,
        access_token=owner_access,
        token='owner-refresh-value',
        token_family='00000000-0000-0000-0000-000000000001',
        resource=[RESOURCE],
    )
    other_access = AccessToken.objects.create(
        user=other,
        application=application,
        token='other-token-value',
        expires=owner_access.expires,
        scope='gallery:read',
        resource=[RESOURCE],
    )
    stranger_access = AccessToken.objects.create(
        user=stranger,
        application=application,
        token='stranger-token-value',
        expires=owner_access.expires,
        scope='gallery:read',
        resource=[RESOURCE],
    )
    assert other_access.resource == [RESOURCE]

    client.force_login(other)
    other_list = client.get('/api/account/connected-apps/').json()
    assert [entry['id'] for entry in other_list] == [application.pk]
    assert client.delete(f'/api/account/connected-apps/{application.pk}/').json() == {
        'revoked': True
    }
    assert AccessToken.objects.filter(pk=owner_access.pk).exists()

    client.force_login(owner)
    own_list = client.get('/api/account/connected-apps/').json()
    assert [entry['id'] for entry in own_list] == [application.pk]
    assert 'owner-token-value' not in str(own_list)
    assert client.delete(f'/api/account/connected-apps/{application.pk}/').json() == {
        'revoked': True
    }
    assert not AccessToken.objects.filter(pk=owner_access.pk).exists()
    assert not AccessToken.objects.filter(pk=other_access.pk).exists()
    assert AccessToken.objects.filter(pk=stranger_access.pk).exists()
    assert (
        RefreshToken.objects.filter(
            application=application, user=owner, revoked__isnull=True
        ).count()
        == 0
    )
