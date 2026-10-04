"""OAuth validation for the MCP resource (#1216).

The provider accepts authorization-code requests only when the client asks
for this exact MCP resource. That prevents issuance of unrestricted tokens
which the toolkit deliberately permits for backwards compatibility.
"""

from __future__ import annotations

from urllib.parse import parse_qs, urlsplit

from oauth2_provider.oauth2_validators import OAuth2Validator


class MCPOAuth2Validator(OAuth2Validator):
    """Require a single MCP audience and an exact, safe callback URI."""

    def validate_redirect_uri(self, client_id, redirect_uri, request, *args, **kwargs):
        client = getattr(request, 'client', None)
        if client is None or redirect_uri not in client.redirect_uris.split():
            # The toolkit follows RFC 8252 by allowing variable ports on loopback
            # IPs. This service's registered-client contract requires exact URIs.
            return False
        if not super().validate_redirect_uri(client_id, redirect_uri, request, *args, **kwargs):
            return False

        parsed_redirect = urlsplit(redirect_uri)
        if (
            parsed_redirect.scheme not in {'https', 'http'}
            or not parsed_redirect.hostname
            or parsed_redirect.username is not None
            or parsed_redirect.password is not None
            or parsed_redirect.fragment
            or '*' in redirect_uri
        ):
            return False

        if parsed_redirect.scheme == 'http' and parsed_redirect.hostname not in {
            'localhost',
            '127.0.0.1',
            '::1',
        }:
            return False

        return True

    def validate_response_type(self, client_id, response_type, client, request, *args, **kwargs):
        if response_type != 'code':
            return False
        resource = getattr(request, 'resource', None)
        if isinstance(resource, str):
            resources = [resource]
        elif isinstance(resource, list):
            resources = resource
        else:
            resources = []
        if not resources:
            request_uri = urlsplit(getattr(request, 'uri', ''))
            resources = parse_qs(request_uri.query).get('resource', [])
        request_uri = urlsplit(getattr(request, 'uri', ''))
        headers = getattr(request, 'headers', {})
        scheme = (
            request_uri.scheme
            if request_uri.scheme in {'https', 'http'}
            else 'https'
            if headers.get('X_DJANGO_OAUTH_TOOLKIT_SECURE') == '1'
            else 'http'
        )
        host = request_uri.netloc or headers.get('HTTP_HOST') or headers.get('Host')
        if not host:
            return False
        expected_resource = f'{scheme}://{host}/mcp'
        return resources == [expected_resource] and super().validate_response_type(
            client_id, response_type, client, request, *args, **kwargs
        )
