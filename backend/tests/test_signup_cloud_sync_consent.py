"""Tests for the signup-time cloud-sync consent choice (issue #524).

Reuses `test_google_oauth.py`'s own fake-provider technique -- only
`OAuth2Client.get_access_token` and `GoogleOAuth2Adapter.complete_login`
are replaced, so the rest of allauth's real account-creation/signup-form
flow runs unmodified. Each test drives a fresh new social identity
through `google_login` -> `google_callback` (redirects to the one-time
signup/consent form since #524 disables auto-signup) -> a `POST` to
`socialaccount_signup`.
"""

from urllib.parse import parse_qs, urlparse

import pytest
from allauth.socialaccount.models import SocialAccount
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse

from scenes.models import CloudSyncSignupConsent, SiteSettings


def _start_new_social_login(client: Client, monkeypatch, email: str, uid: str) -> str:
    """Drives the real Google login-initiation + callback for a brand-new
    identity and returns the callback response's redirect target (the
    signup form URL) -- the account does not exist yet at this point."""
    login_response = client.post(reverse("google_login"))
    state = parse_qs(urlparse(login_response["Location"]).query)["state"][0]

    monkeypatch.setattr(
        "allauth.socialaccount.providers.oauth2.client.OAuth2Client.get_access_token",
        lambda self, code, pkce_code_verifier=None: {"access_token": "fake-access-token"},
    )

    def fake_complete_login(self, request, app, token, **kwargs):
        data = {
            "sub": uid,
            "email": email,
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
    assert callback_response.status_code == 302
    assert callback_response["Location"] == reverse("socialaccount_signup")
    return callback_response["Location"]


@pytest.mark.django_db
def test_default_choice_is_local_only(client, monkeypatch):
    _start_new_social_login(client, monkeypatch, "local-default@example.com", "google-uid-1")

    response = client.get(reverse("socialaccount_signup"))
    assert response.status_code == 200
    assert response.context["form"].fields["cloud_sync_choice"].initial == "local_only"


@pytest.mark.django_db
def test_signup_page_offers_a_persistent_storage_nudge_with_one_line_privilege_summaries(
    client, monkeypatch
):
    _start_new_social_login(client, monkeypatch, "persist-nudge@example.com", "google-uid-persist")

    response = client.get(reverse("socialaccount_signup"))

    assert response.status_code == 200
    content = response.content.decode()
    assert 'id="persist-local-storage"' in content
    assert "checked" in content
    assert "navigator.storage" in content
    assert "Uploads an opt-in backup copy" in content
    assert "Asks this browser not to automatically delete" in content


@pytest.mark.django_db
def test_choosing_local_only_records_no_sync_and_no_backup_project(client, monkeypatch):
    _start_new_social_login(client, monkeypatch, "local-only@example.com", "google-uid-2")

    response = client.post(
        reverse("socialaccount_signup"),
        {
            "username": "localonlyuser",
            "email": "local-only@example.com",
            "cloud_sync_choice": "local_only",
        },
    )
    assert response.status_code == 302

    user = get_user_model().objects.get(email="local-only@example.com")
    consent = CloudSyncSignupConsent.objects.get(owner=user)
    assert consent.sync_enabled is False
    assert not hasattr(user, "projects") or not user.projects.exists()


@pytest.mark.django_db
def test_choosing_enabled_records_preference_without_uploading_anything(client, monkeypatch):
    SiteSettings.objects.update_or_create(pk=1, defaults={"cloud_sync_enabled": True})
    _start_new_social_login(client, monkeypatch, "sync-enabled@example.com", "google-uid-3")

    response = client.post(
        reverse("socialaccount_signup"),
        {
            "username": "syncuser",
            "email": "sync-enabled@example.com",
            "cloud_sync_choice": "enabled",
        },
    )
    assert response.status_code == 302

    user = get_user_model().objects.get(email="sync-enabled@example.com")
    consent = CloudSyncSignupConsent.objects.get(owner=user)
    assert consent.sync_enabled is True
    # Recording the preference must never itself create a project or a
    # cloud-backup record -- no content exists yet to upload.
    assert not user.projects.exists()


@pytest.mark.django_db
def test_omitting_the_choice_is_rejected_and_creates_no_account(client, monkeypatch):
    _start_new_social_login(client, monkeypatch, "omitted@example.com", "google-uid-4")

    response = client.post(
        reverse("socialaccount_signup"),
        {"username": "omitteduser", "email": "omitted@example.com"},
    )
    assert response.status_code == 200
    assert "cloud_sync_choice" in response.context["form"].errors
    assert not get_user_model().objects.filter(email="omitted@example.com").exists()


@pytest.mark.django_db
def test_forged_choice_value_is_rejected(client, monkeypatch):
    _start_new_social_login(client, monkeypatch, "forged@example.com", "google-uid-5")

    response = client.post(
        reverse("socialaccount_signup"),
        {
            "username": "forgeduser",
            "email": "forged@example.com",
            "cloud_sync_choice": "not-a-real-choice",
        },
    )
    assert response.status_code == 200
    assert "cloud_sync_choice" in response.context["form"].errors
    assert not get_user_model().objects.filter(email="forged@example.com").exists()


@pytest.mark.django_db
def test_site_wide_disabled_sync_rejects_an_enabled_choice(client, monkeypatch):
    SiteSettings.objects.update_or_create(pk=1, defaults={"cloud_sync_enabled": False})
    _start_new_social_login(client, monkeypatch, "kill-switch@example.com", "google-uid-6")

    # A forged/replayed "enabled" value must not slip through even though
    # the rendered form only offers local_only while the switch is off.
    response = client.post(
        reverse("socialaccount_signup"),
        {
            "username": "killswitchuser",
            "email": "kill-switch@example.com",
            "cloud_sync_choice": "enabled",
        },
    )
    assert response.status_code == 200
    assert "cloud_sync_choice" in response.context["form"].errors
    assert not get_user_model().objects.filter(email="kill-switch@example.com").exists()

    valid_response = client.post(
        reverse("socialaccount_signup"),
        {
            "username": "killswitchuser",
            "email": "kill-switch@example.com",
            "cloud_sync_choice": "local_only",
        },
    )
    assert valid_response.status_code == 302
    user = get_user_model().objects.get(email="kill-switch@example.com")
    assert CloudSyncSignupConsent.objects.get(owner=user).sync_enabled is False


@pytest.mark.django_db
def test_abandoned_flow_leaves_no_partial_state(client, monkeypatch):
    _start_new_social_login(client, monkeypatch, "abandoned@example.com", "google-uid-7")

    # The user never POSTs the signup form -- nothing is created.
    assert not get_user_model().objects.filter(email="abandoned@example.com").exists()
    assert not CloudSyncSignupConsent.objects.exists()


@pytest.mark.django_db
def test_replaying_the_signup_after_it_already_completed_does_not_duplicate(client, monkeypatch):
    _start_new_social_login(client, monkeypatch, "replay@example.com", "google-uid-8")

    first = client.post(
        reverse("socialaccount_signup"),
        {
            "username": "replayuser",
            "email": "replay@example.com",
            "cloud_sync_choice": "local_only",
        },
    )
    assert first.status_code == 302
    assert get_user_model().objects.filter(email="replay@example.com").count() == 1

    # The pending signup was cleared from the session after the first
    # POST -- a second attempt (e.g. a replayed/duplicate request) has no
    # pending sociallogin and is bounced to the login page, not a second
    # account.
    second = client.post(
        reverse("socialaccount_signup"),
        {
            "username": "replayuser2",
            "email": "replay2@example.com",
            "cloud_sync_choice": "enabled",
        },
    )
    assert second.status_code == 302
    assert second["Location"] == reverse("account_login")
    assert get_user_model().objects.filter(email="replay@example.com").count() == 1
    assert not get_user_model().objects.filter(email="replay2@example.com").exists()


@pytest.mark.django_db
def test_an_existing_user_signing_in_again_is_not_prompted_or_changed(client, monkeypatch):
    _start_new_social_login(client, monkeypatch, "returning@example.com", "google-uid-9")
    client.post(
        reverse("socialaccount_signup"),
        {
            "username": "returninguser",
            "email": "returning@example.com",
            "cloud_sync_choice": "local_only",
        },
    )
    user = get_user_model().objects.get(email="returning@example.com")
    original_decided_at = CloudSyncSignupConsent.objects.get(owner=user).decided_at
    client.get(reverse("account_logout"))
    client.post(reverse("account_logout"))

    # The same identity (same provider uid) signs in again -- this is an
    # *existing* SocialAccount, so allauth logs the user in directly and
    # never reaches the signup form or `save_user` again.
    login_response = client.post(reverse("google_login"))
    state = parse_qs(urlparse(login_response["Location"]).query)["state"][0]

    monkeypatch.setattr(
        "allauth.socialaccount.providers.oauth2.client.OAuth2Client.get_access_token",
        lambda self, code, pkce_code_verifier=None: {"access_token": "fake-access-token-2"},
    )

    def fake_complete_login(self, request, app, token, **kwargs):
        data = {
            "sub": "google-uid-9",
            "email": "returning@example.com",
            "email_verified": True,
            "given_name": "New",
            "family_name": "User",
            "name": "New User",
        }
        return self.get_provider().sociallogin_from_response(request, data)

    monkeypatch.setattr(GoogleOAuth2Adapter, "complete_login", fake_complete_login)

    callback_response = client.get(
        reverse("google_callback"), {"state": state, "code": "fake-authorization-code-2"}
    )
    assert callback_response.status_code != 302 or callback_response["Location"] != reverse(
        "socialaccount_signup"
    )
    assert CloudSyncSignupConsent.objects.filter(owner=user).count() == 1
    assert CloudSyncSignupConsent.objects.get(owner=user).decided_at == original_decided_at
    assert SocialAccount.objects.filter(provider="google", uid="google-uid-9").count() == 1
