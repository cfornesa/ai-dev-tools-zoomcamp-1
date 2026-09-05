"""Tests for account identity link/unlink (issue #426).

Fixed fixture: user A with Google and GitHub identities, a one-method
sibling (one identity only), and user B with a conflicting identity.
Linking itself goes through allauth's real OAuth "connect" flow (already
covered end-to-end by `test_google_oauth.py`/`test_github_oauth.py`'s
callback mechanics) -- these tests focus on listing, unlinking, the
strand-prevention guard, the cross-user conflict fix, and the audit
trail, all against a disposable database with no real provider network
calls.
"""

from urllib.parse import parse_qs, urlparse

import pytest
from allauth.socialaccount.models import SocialAccount
from allauth.socialaccount.providers.github.views import GitHubOAuth2Adapter
from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse

from scenes.account_identities import is_provider_enabled, list_identities
from scenes.models import IdentityLinkEvent

_GITHUB_APP_SETTINGS = {
    "github": {
        "APP": {"client_id": "test-id", "secret": "test-secret", "key": ""},
        "SCOPE": ["user:email"],
    },
}


def _make_user(username, email):
    return get_user_model().objects.create_user(username=username, email=email, password="x")


def _link(user, provider, uid):
    return SocialAccount.objects.create(user=user, provider=provider, uid=uid)


@pytest.mark.django_db
def test_list_identities_shows_only_the_caller_own_providers():
    user_a = _make_user("user_a", "a@example.com")
    user_b = _make_user("user_b", "b@example.com")
    _link(user_a, "google", "google-uid-a")
    _link(user_a, "github", "github-uid-a")
    _link(user_b, "google", "google-uid-b")

    identities = list_identities(user_a)

    assert {identity["provider"] for identity in identities} == {"google", "github"}
    assert all("uid" not in identity and "token" not in identity for identity in identities)


@pytest.mark.django_db
def test_list_identities_api_requires_authentication(client):
    response = client.get(reverse("account-identities"))
    assert response.status_code == 401


@pytest.mark.django_db
def test_list_identities_api_scoped_to_caller(client):
    user_a = _make_user("user_a", "a@example.com")
    user_b = _make_user("user_b", "b@example.com")
    _link(user_a, "google", "google-uid-a")
    _link(user_b, "google", "google-uid-b")

    client.force_login(user_a)
    response = client.get(reverse("account-identities"))

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["provider"] == "google"


@pytest.mark.django_db
def test_disabled_provider_never_counts_as_usable():
    assert is_provider_enabled("google") is True
    assert is_provider_enabled("github") is False  # unset in this test's settings


@pytest.mark.django_db
def test_unlinking_one_of_two_usable_identities_succeeds_and_audits(client):
    with override_settings(GITHUB_OAUTH_ENABLED=True, SOCIALACCOUNT_PROVIDERS=_GITHUB_APP_SETTINGS):
        user_a = _make_user("user_a", "a@example.com")
        _link(user_a, "google", "google-uid-a")
        _link(user_a, "github", "github-uid-a")
        client.force_login(user_a)

        response = client.delete(reverse("account-identity-unlink", args=["github"]))

        assert response.status_code == 200
        remaining = response.json()
        assert [identity["provider"] for identity in remaining] == ["google"]
        assert not SocialAccount.objects.filter(user=user_a, provider="github").exists()
        event = IdentityLinkEvent.objects.get(user=user_a, provider="github")
        assert event.action == IdentityLinkEvent.Action.UNLINK


@pytest.mark.django_db
def test_cannot_unlink_the_only_usable_sign_in_method(client):
    """One-method sibling: a single-identity account must never be
    strandable via unlink."""
    sibling = _make_user("sibling", "sibling@example.com")
    _link(sibling, "google", "google-uid-sibling")
    client.force_login(sibling)

    response = client.delete(reverse("account-identity-unlink", args=["google"]))

    assert response.status_code == 409
    assert SocialAccount.objects.filter(user=sibling, provider="google").exists()
    assert not IdentityLinkEvent.objects.filter(user=sibling, provider="google").exists()


@pytest.mark.django_db
def test_unlinking_a_disabled_provider_is_always_allowed_even_if_the_only_one(client):
    """A disabled provider never counted as "usable", so removing it can
    never itself strand the account -- there was nothing usable to lose."""
    user_a = _make_user("user_a", "a@example.com")
    _link(user_a, "github", "github-uid-a")  # GITHUB_OAUTH_ENABLED is False here
    client.force_login(user_a)

    response = client.delete(reverse("account-identity-unlink", args=["github"]))

    assert response.status_code == 200
    assert not SocialAccount.objects.filter(user=user_a, provider="github").exists()


@pytest.mark.django_db
def test_unlinking_an_enabled_identity_is_fine_when_a_second_usable_one_remains(client):
    with override_settings(GITHUB_OAUTH_ENABLED=True, SOCIALACCOUNT_PROVIDERS=_GITHUB_APP_SETTINGS):
        user_a = _make_user("user_a", "a@example.com")
        _link(user_a, "google", "google-uid-a")
        _link(user_a, "github", "github-uid-a")
        client.force_login(user_a)

        response = client.delete(reverse("account-identity-unlink", args=["google"]))

        assert response.status_code == 200
        assert not SocialAccount.objects.filter(user=user_a, provider="google").exists()
        assert SocialAccount.objects.filter(user=user_a, provider="github").exists()


@pytest.mark.django_db
def test_unlinking_a_non_linked_provider_is_rejected(client):
    user_a = _make_user("user_a", "a@example.com")
    _link(user_a, "google", "google-uid-a")
    client.force_login(user_a)

    response = client.delete(reverse("account-identity-unlink", args=["github"]))

    assert response.status_code == 409


@pytest.mark.django_db
def test_unlink_is_scoped_to_the_caller_never_another_users_identity(client):
    user_a = _make_user("user_a", "a@example.com")
    user_b = _make_user("user_b", "b@example.com")
    _link(user_a, "google", "google-uid-a")
    _link(user_a, "github", "github-uid-a")
    _link(user_b, "google", "google-uid-b")
    client.force_login(user_a)

    with override_settings(GITHUB_OAUTH_ENABLED=True, SOCIALACCOUNT_PROVIDERS=_GITHUB_APP_SETTINGS):
        response = client.delete(reverse("account-identity-unlink", args=["google"]))
        # user_a still has github left as a second usable identity, so
        # this succeeds -- but it must never touch user_b's own google row.
        assert response.status_code == 200

    assert SocialAccount.objects.filter(user=user_b, provider="google").exists()


# --- Linking: reject an identity owned by another account, allow self-linking ---


def _start_github_connect_and_get_state(client):
    login_response = client.post(reverse("github_login"), {"process": "connect"})
    return parse_qs(urlparse(login_response["Location"]).query)["state"][0]


@pytest.mark.django_db
@override_settings(GITHUB_OAUTH_ENABLED=True, SOCIALACCOUNT_PROVIDERS=_GITHUB_APP_SETTINGS)
def test_connecting_an_identity_whose_email_belongs_to_another_account_is_rejected(
    client, monkeypatch
):
    signed_in_user = _make_user("signed_in", "signed-in@example.com")
    other_user = _make_user("other_user", "other@example.com")
    client.force_login(signed_in_user)

    state = _start_github_connect_and_get_state(client)
    monkeypatch.setattr(
        "allauth.socialaccount.providers.oauth2.client.OAuth2Client.get_access_token",
        lambda self, code, pkce_code_verifier=None: {"access_token": "fake-token"},
    )

    def fake_complete_login(self, request, app, token, **kwargs):
        data = {"id": 999, "login": "other-on-github", "name": "Other", "email": other_user.email}
        return self.get_provider().sociallogin_from_response(request, data)

    monkeypatch.setattr(GitHubOAuth2Adapter, "complete_login", fake_complete_login)

    response = client.get(
        reverse("github_callback"), {"state": state, "code": "fake-authorization-code"}
    )

    assert response.status_code == 409
    assert not SocialAccount.objects.filter(provider="github", uid="999").exists()


@pytest.mark.django_db
@override_settings(GITHUB_OAUTH_ENABLED=True, SOCIALACCOUNT_PROVIDERS=_GITHUB_APP_SETTINGS)
def test_connecting_a_second_provider_with_your_own_email_succeeds_and_audits(client, monkeypatch):
    signed_in_user = _make_user("signed_in", "signed-in@example.com")
    client.force_login(signed_in_user)

    state = _start_github_connect_and_get_state(client)
    monkeypatch.setattr(
        "allauth.socialaccount.providers.oauth2.client.OAuth2Client.get_access_token",
        lambda self, code, pkce_code_verifier=None: {"access_token": "fake-token"},
    )

    def fake_complete_login(self, request, app, token, **kwargs):
        data = {
            "id": 1000,
            "login": "signed-in-on-github",
            "name": "Signed In",
            "email": signed_in_user.email,
        }
        return self.get_provider().sociallogin_from_response(request, data)

    monkeypatch.setattr(GitHubOAuth2Adapter, "complete_login", fake_complete_login)

    response = client.get(
        reverse("github_callback"), {"state": state, "code": "fake-authorization-code"}
    )

    assert response.status_code in (200, 302)
    assert SocialAccount.objects.filter(user=signed_in_user, provider="github", uid="1000").exists()
    event = IdentityLinkEvent.objects.get(user=signed_in_user, provider="github")
    assert event.action == IdentityLinkEvent.Action.LINK
