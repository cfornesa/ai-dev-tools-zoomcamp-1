"""Focused safety tests for optional LinkedIn OIDC sign-in (#460)."""

from urllib.parse import parse_qs, urlparse

import pytest
from allauth.socialaccount.models import SocialAccount
from allauth.socialaccount.providers.openid_connect.views import OpenIDConnectOAuth2Adapter
from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse

_APP_SETTINGS = {
    "openid_connect": {
        "APPS": [
            {
                "provider_id": "linkedin",
                "name": "LinkedIn",
                "client_id": "test-linkedin-client-id",
                "secret": "test-linkedin-client-secret",
                "settings": {
                    "server_url": "https://www.linkedin.com/oauth/.well-known/openid-configuration"
                },
            }
        ],
        "SCOPE": ["openid", "profile", "email"],
    }
}


@pytest.mark.django_db
def test_linkedin_routes_are_closed_when_unconfigured(client):
    assert client.post(reverse("linkedin_login")).status_code == 404
    assert client.get(reverse("linkedin_callback"), {"code": "irrelevant"}).status_code == 404


@pytest.mark.django_db
@override_settings(LINKEDIN_OAUTH_ENABLED=True, SOCIALACCOUNT_PROVIDERS=_APP_SETTINGS)
def test_linkedin_login_uses_oidc_product_and_scopes(client):
    response = client.post(reverse("linkedin_login"))
    assert response.status_code == 302
    location = response["Location"]
    assert location.startswith("https://www.linkedin.com/oauth/v2/authorization")
    assert set(parse_qs(urlparse(location).query)["scope"][0].split()) == {
        "openid",
        "profile",
        "email",
    }


@pytest.mark.django_db
@override_settings(LINKEDIN_OAUTH_ENABLED=True, SOCIALACCOUNT_PROVIDERS=_APP_SETTINGS)
def test_linkedin_missing_email_fails_closed(client, monkeypatch):
    response = client.post(reverse("linkedin_login"))
    state = parse_qs(urlparse(response["Location"]).query)["state"][0]
    monkeypatch.setattr(
        "allauth.socialaccount.providers.oauth2.client.OAuth2Client.get_access_token",
        lambda self, code, pkce_code_verifier=None: {"access_token": "fake"},
    )

    def complete_login(self, request, app, token, **kwargs):
        return self.get_provider().sociallogin_from_response(
            request, {"sub": "li-1", "name": "No Email"}
        )

    monkeypatch.setattr(OpenIDConnectOAuth2Adapter, "complete_login", complete_login)
    result = client.get(reverse("linkedin_callback"), {"state": state, "code": "code"})
    assert result.status_code == 400
    assert b"Email required" in result.content
    assert not SocialAccount.objects.filter(provider="linkedin").exists()


@pytest.mark.django_db
@override_settings(LINKEDIN_OAUTH_ENABLED=True, SOCIALACCOUNT_PROVIDERS=_APP_SETTINGS)
def test_linkedin_matching_email_fails_closed(client, monkeypatch):
    get_user_model().objects.create_user(username="alice", email="alice@example.com")
    response = client.post(reverse("linkedin_login"))
    state = parse_qs(urlparse(response["Location"]).query)["state"][0]
    monkeypatch.setattr(
        "allauth.socialaccount.providers.oauth2.client.OAuth2Client.get_access_token",
        lambda self, code, pkce_code_verifier=None: {"access_token": "fake"},
    )

    def complete_login(self, request, app, token, **kwargs):
        return self.get_provider().sociallogin_from_response(
            request,
            {"sub": "li-2", "email": "alice@example.com", "email_verified": True},
        )

    monkeypatch.setattr(OpenIDConnectOAuth2Adapter, "complete_login", complete_login)
    result = client.get(reverse("linkedin_callback"), {"state": state, "code": "code"})
    assert result.status_code == 409
    assert not SocialAccount.objects.filter(provider="linkedin").exists()
