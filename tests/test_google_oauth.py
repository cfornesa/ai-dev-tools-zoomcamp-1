"""Tests for Google OAuth sign-in (Task 12).

No real Google server is contacted: the login-initiation and
callback-error paths exercise allauth's real views end-to-end, and the
successful-callback test replaces only the two points that talk to
Google over HTTP (`OAuth2Client.get_access_token` and
`GoogleOAuth2Adapter.complete_login`) with fakes, so the rest of
allauth's account-creation/linking logic runs for real.
"""

from urllib.parse import parse_qs, urlparse

import pytest
from allauth.socialaccount.models import SocialAccount
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from django.contrib.auth import get_user_model
from django.test import Client, override_settings
from django.urls import reverse


@pytest.mark.django_db
def test_protected_route_rejects_anonymous_user(client):
    response = client.get(reverse("whoami"))

    assert response.status_code == 401


@pytest.mark.django_db
def test_protected_route_allows_authenticated_user(client):
    user = get_user_model().objects.create_user(
        username="alice", email="alice@example.com", password="not-used-for-oauth"
    )
    client.force_login(user)

    response = client.get(reverse("whoami"))

    assert response.status_code == 200
    assert response.json() == {"username": "alice", "email": "alice@example.com"}


@pytest.mark.django_db
def test_google_login_redirects_with_minimal_scope(client):
    # SOCIALACCOUNT_LOGIN_ON_GET defaults to False: initiating the OAuth
    # flow requires POST (allauth's CSRF-safety default — a bare GET link
    # can't silently kick off a third-party redirect), so a real "Sign in
    # with Google" button posts a small confirmation form.
    response = client.post(reverse("google_login"))

    assert response.status_code == 302
    location = response["Location"]
    assert location.startswith("https://accounts.google.com/o/oauth2/v2/auth")

    params = parse_qs(urlparse(location).query)
    assert params["response_type"] == ["code"]
    # Minimal identity scopes only — no Drive/Calendar/etc access.
    assert set(params["scope"][0].split(" ")) == {"openid", "email", "profile"}
    assert "code_challenge" in params  # PKCE


@pytest.mark.django_db
def test_google_login_form_post_accepts_configured_origin():
    """The browser's real CSRF-checked POST may start the OAuth redirect."""
    trusted_origin = "https://animate.creatweb.com"
    csrf_client = Client(enforce_csrf_checks=True)

    with override_settings(CSRF_TRUSTED_ORIGINS=[trusted_origin]):
        login_page = csrf_client.get(reverse("account_login"))
        assert b'name="csrfmiddlewaretoken"' in login_page.content
        token = login_page.cookies["csrftoken"].value

        response = csrf_client.post(
            reverse("google_login"),
            {"csrfmiddlewaretoken": token},
            HTTP_ORIGIN=trusted_origin,
            HTTP_HOST="animate.creatweb.com",
        )

    assert response.status_code == 302
    assert response["Location"].startswith("https://accounts.google.com/o/oauth2/v2/auth")


@pytest.mark.django_db
def test_google_login_uses_forwarded_https_public_origin_for_callback():
    """The Vite-to-Django proxy must not leak localhost into Google's callback URL."""
    public_host = "animate.creatrweb.com"
    public_origin = f"https://{public_host}"
    csrf_client = Client(enforce_csrf_checks=True)

    with override_settings(CSRF_TRUSTED_ORIGINS=[public_origin]):
        login_page = csrf_client.get(
            reverse("account_login"),
            HTTP_HOST="localhost:8000",
            HTTP_X_FORWARDED_HOST=public_host,
            HTTP_X_FORWARDED_PROTO="https",
        )
        token = login_page.cookies["csrftoken"].value
        response = csrf_client.post(
            reverse("google_login"),
            {"csrfmiddlewaretoken": token},
            HTTP_ORIGIN=public_origin,
            HTTP_HOST="localhost:8000",
            HTTP_X_FORWARDED_HOST=public_host,
            HTTP_X_FORWARDED_PROTO="https",
        )

    assert response.status_code == 302
    params = parse_qs(urlparse(response["Location"]).query)
    assert params["redirect_uri"] == [f"{public_origin}/accounts/google/login/callback/"]


@pytest.mark.django_db
def test_google_login_form_post_rejects_unconfigured_origin():
    csrf_client = Client(enforce_csrf_checks=True)
    trusted_origin = "https://animate.creatweb.com"
    untrusted_origin = "https://evil.example"

    with override_settings(CSRF_TRUSTED_ORIGINS=[trusted_origin]):
        login_page = csrf_client.get(reverse("account_login"))
        token = login_page.cookies["csrftoken"].value
        response = csrf_client.post(
            reverse("google_login"),
            {"csrfmiddlewaretoken": token},
            HTTP_ORIGIN=untrusted_origin,
            HTTP_HOST="animate.creatweb.com",
        )

    assert response.status_code == 403


def _start_flow_and_get_state(client):
    """POST to google_login to stash real OAuth state in the session, as a genuine
    flow would, then return that state so a callback test can present it back —
    an callback with no recognized state is its own (also-tested) failure mode.
    """
    login_response = client.post(reverse("google_login"))
    return parse_qs(urlparse(login_response["Location"]).query)["state"][0]


@pytest.mark.django_db
def test_google_callback_cancelled_redirects_safely(client):
    """Google's own `access_denied` error (user clicked Cancel) redirects, not a crash."""
    state = _start_flow_and_get_state(client)

    response = client.get(reverse("google_callback"), {"error": "access_denied", "state": state})

    assert response.status_code == 302
    assert b"Traceback" not in response.content


@pytest.mark.django_db
def test_google_callback_with_provider_error_is_safe(client):
    state = _start_flow_and_get_state(client)

    response = client.get(reverse("google_callback"), {"error": "server_error", "state": state})

    assert response.status_code == 401  # rendered error page, not a crash
    assert b"Traceback" not in response.content


@pytest.mark.django_db
def test_google_callback_with_no_code_and_no_error_is_safe(client):
    """A malformed callback (missing both `code` and `error`) fails safely, not with a 500."""
    state = _start_flow_and_get_state(client)

    response = client.get(reverse("google_callback"), {"state": state})

    assert response.status_code == 401
    assert b"Traceback" not in response.content


@pytest.mark.django_db
def test_google_callback_with_unrecognized_state_is_safe():
    """No prior login POST means no session state — also a safe failure, not a crash."""
    response = Client().get(reverse("google_callback"), {"code": "some-code"})

    assert response.status_code == 401
    assert b"Traceback" not in response.content


@pytest.mark.django_db
def test_successful_callback_creates_and_links_local_account(client, monkeypatch):
    login_response = client.post(reverse("google_login"))
    state = parse_qs(urlparse(login_response["Location"]).query)["state"][0]

    monkeypatch.setattr(
        "allauth.socialaccount.providers.oauth2.client.OAuth2Client.get_access_token",
        lambda self, code, pkce_code_verifier=None: {"access_token": "fake-access-token"},
    )

    def fake_complete_login(self, request, app, token, **kwargs):
        data = {
            "sub": "google-uid-123",
            "email": "newuser@example.com",
            "email_verified": True,
            "given_name": "New",
            "family_name": "User",
            "name": "New User",
        }
        return self.get_provider().sociallogin_from_response(request, data)

    monkeypatch.setattr(GoogleOAuth2Adapter, "complete_login", fake_complete_login)

    callback_response = client.get(
        reverse("google_callback"), {"state": state, "code": "fake-authorization-code"}
    )

    assert callback_response.status_code in (302, 200)
    User = get_user_model()
    assert User.objects.filter(email="newuser@example.com").exists()
    assert SocialAccount.objects.filter(provider="google", uid="google-uid-123").exists()

    # The callback established an authenticated session for the new user.
    whoami_response = client.get(reverse("whoami"))
    assert whoami_response.status_code == 200
    assert whoami_response.json()["email"] == "newuser@example.com"


@pytest.mark.django_db
def test_sign_out_invalidates_session(client):
    user = get_user_model().objects.create_user(username="bob", email="bob@example.com")
    client.force_login(user)
    assert client.get(reverse("whoami")).status_code == 200

    client.post(reverse("account_logout"))

    response = client.get(reverse("whoami"))
    assert response.status_code == 401


@pytest.mark.django_db
def test_only_the_registered_callback_path_is_a_valid_oauth_target(client):
    """Google's own redirect-URI allowlist is the real enforcement; on our side, the
    urlconf only exposes the one legitimate callback route — nothing else under
    accounts/google/ resolves, so there's no second "unrecognized" redirect target
    to accidentally send an authorization code to.
    """
    response = client.get("/accounts/google/not-a-real-callback/")
    assert response.status_code == 404
