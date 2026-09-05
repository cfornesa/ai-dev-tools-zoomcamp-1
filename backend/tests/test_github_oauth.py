"""Tests for optional GitHub OAuth sign-in (issue #420).

GitHub sign-in is off by default (see `tests/test_env_config.py` for the
settings-load behavior) and gated closed at request time by
`backend.oauth_gates` whenever `GITHUB_OAUTH_ENABLED` is False, regardless
of whether real credentials happen to be configured -- these tests use
`override_settings` to flip that flag deterministically, the same way
`test_google_oauth.py` overrides `CSRF_TRUSTED_ORIGINS`/`ALLOWED_HOSTS`
without a real Google server. No real GitHub server is contacted here
either: the successful-callback test replaces only the two points that
talk to GitHub over HTTP, exactly like the Google suite does.
"""

from urllib.parse import parse_qs, urlparse

import pytest
from allauth.socialaccount.models import SocialAccount
from allauth.socialaccount.providers.github.views import GitHubOAuth2Adapter
from django.contrib.auth import get_user_model
from django.test import Client, override_settings
from django.urls import reverse

_GITHUB_APP_SETTINGS = {
    "github": {
        "APP": {
            "client_id": "test-github-client-id",
            "secret": "test-github-client-secret",
            "key": "",
        },
        "SCOPE": ["user:email"],
    },
}


@pytest.mark.django_db
def test_github_login_route_404s_while_disabled(client):
    """The default (unconfigured) state gates the route closed, not a 500."""
    response = client.post(reverse("github_login"))

    assert response.status_code == 404


@pytest.mark.django_db
def test_github_callback_route_404s_while_disabled(client):
    response = client.get(reverse("github_callback"), {"code": "irrelevant"})

    assert response.status_code == 404


@pytest.mark.django_db
@override_settings(GITHUB_OAUTH_ENABLED=True, SOCIALACCOUNT_PROVIDERS=_GITHUB_APP_SETTINGS)
def test_github_login_redirects_with_minimal_scope_when_enabled(client):
    response = client.post(reverse("github_login"))

    assert response.status_code == 302
    location = response["Location"]
    assert location.startswith("https://github.com/login/oauth/authorize")

    params = parse_qs(urlparse(location).query)
    assert params["scope"] == ["user:email"]


@pytest.mark.django_db
@override_settings(GITHUB_OAUTH_ENABLED=True, SOCIALACCOUNT_PROVIDERS=_GITHUB_APP_SETTINGS)
def test_login_page_shows_github_only_when_enabled(client):
    response = client.get(reverse("account_login"))

    assert b"Continue with GitHub" in response.content
    assert b"Continue with Google" in response.content


@pytest.mark.django_db
def test_login_page_hides_github_when_disabled(client):
    response = client.get(reverse("account_login"))

    assert b"Continue with GitHub" not in response.content
    assert b"Continue with Google" in response.content


def _start_flow_and_get_state(client):
    login_response = client.post(reverse("github_login"))
    return parse_qs(urlparse(login_response["Location"]).query)["state"][0]


@pytest.mark.django_db
@override_settings(GITHUB_OAUTH_ENABLED=True, SOCIALACCOUNT_PROVIDERS=_GITHUB_APP_SETTINGS)
def test_github_callback_cancelled_redirects_safely(client):
    state = _start_flow_and_get_state(client)

    response = client.get(reverse("github_callback"), {"error": "access_denied", "state": state})

    assert response.status_code == 302
    assert b"Traceback" not in response.content


@pytest.mark.django_db
@override_settings(GITHUB_OAUTH_ENABLED=True, SOCIALACCOUNT_PROVIDERS=_GITHUB_APP_SETTINGS)
def test_github_callback_with_unrecognized_state_is_safe():
    response = Client().get(reverse("github_callback"), {"code": "some-code"})

    assert response.status_code == 401
    assert b"Traceback" not in response.content


@pytest.mark.django_db
@override_settings(GITHUB_OAUTH_ENABLED=True, SOCIALACCOUNT_PROVIDERS=_GITHUB_APP_SETTINGS)
def test_successful_github_callback_creates_and_links_local_account(client, monkeypatch):
    login_response = client.post(reverse("github_login"))
    state = parse_qs(urlparse(login_response["Location"]).query)["state"][0]

    monkeypatch.setattr(
        "allauth.socialaccount.providers.oauth2.client.OAuth2Client.get_access_token",
        lambda self, code, pkce_code_verifier=None: {"access_token": "fake-github-access-token"},
    )

    def fake_complete_login(self, request, app, token, **kwargs):
        data = {
            "id": 987654,
            "login": "newgithubuser",
            "name": "New GitHub User",
            "email": "newgithubuser@example.com",
        }
        return self.get_provider().sociallogin_from_response(request, data)

    monkeypatch.setattr(GitHubOAuth2Adapter, "complete_login", fake_complete_login)

    callback_response = client.get(
        reverse("github_callback"), {"state": state, "code": "fake-authorization-code"}
    )

    assert callback_response.status_code in (302, 200)
    User = get_user_model()
    assert User.objects.filter(email="newgithubuser@example.com").exists()
    assert SocialAccount.objects.filter(provider="github", uid="987654").exists()

    whoami_response = client.get(reverse("whoami"))
    assert whoami_response.status_code == 200
    assert whoami_response.json()["email"] == "newgithubuser@example.com"


@pytest.mark.django_db
@override_settings(GITHUB_OAUTH_ENABLED=True, SOCIALACCOUNT_PROVIDERS=_GITHUB_APP_SETTINGS)
def test_github_login_with_email_matching_existing_user_fails_closed(client, monkeypatch):
    """A GitHub identity is never silently linked to an existing account by
    email match alone -- explicit account linking is issue #426's job."""
    get_user_model().objects.create_user(
        username="alice", email="alice@example.com", password="not-used-for-oauth"
    )

    login_response = client.post(reverse("github_login"))
    state = parse_qs(urlparse(login_response["Location"]).query)["state"][0]

    monkeypatch.setattr(
        "allauth.socialaccount.providers.oauth2.client.OAuth2Client.get_access_token",
        lambda self, code, pkce_code_verifier=None: {"access_token": "fake-github-access-token"},
    )

    def fake_complete_login(self, request, app, token, **kwargs):
        data = {
            "id": 555,
            "login": "alice-on-github",
            "name": "Alice",
            "email": "alice@example.com",
        }
        return self.get_provider().sociallogin_from_response(request, data)

    monkeypatch.setattr(GitHubOAuth2Adapter, "complete_login", fake_complete_login)

    callback_response = client.get(
        reverse("github_callback"), {"state": state, "code": "fake-authorization-code"}
    )

    assert callback_response.status_code == 409
    assert b"already registered" in callback_response.content
    assert not SocialAccount.objects.filter(provider="github", uid="555").exists()

    whoami_response = client.get(reverse("whoami"))
    assert whoami_response.status_code == 401
