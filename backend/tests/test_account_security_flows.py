"""Integration checks for the allauth account-security flows (#562/#563)."""

import re

import pytest
from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount
from django.contrib.auth import get_user_model
from django.core import mail


@pytest.fixture
def user(db):
    user = get_user_model().objects.create_user(
        username="security-user", email="security@example.com"
    )
    user.set_unusable_password()
    user.save(update_fields=["password"])
    EmailAddress.objects.create(user=user, email=user.email, primary=True, verified=True)
    SocialAccount.objects.create(user=user, provider="google", uid="security-google")
    return user


@pytest.mark.django_db
def test_authenticated_user_can_reach_email_and_password_security_flows(client, user):
    client.force_login(user)

    assert client.get("/accounts/email/").status_code == 200
    assert client.get("/accounts/password/set/").status_code == 200
    change = client.get("/accounts/password/change/")
    assert change.status_code == 302
    assert change["Location"].endswith("/accounts/password/set/")


@pytest.mark.django_db
def test_password_reset_form_is_public_but_does_not_reveal_account_state(client):
    response = client.get("/accounts/password/reset/")

    assert response.status_code == 200
    assert "security@example.com" not in response.content.decode()


@pytest.mark.django_db
def test_social_first_user_can_set_and_change_password_with_session_invalidation(client, user):
    client.force_login(user)

    response = client.post(
        "/accounts/password/set/",
        {"password1": "A-long-new-password-123!", "password2": "A-long-new-password-123!"},
    )
    assert response.status_code == 302
    user.refresh_from_db()
    assert user.check_password("A-long-new-password-123!")
    assert client.get("/accounts/email/").status_code == 302

    assert client.login(email=user.email, password="A-long-new-password-123!")
    response = client.post(
        "/accounts/password/change/",
        {
            "oldpassword": "A-long-new-password-123!",
            "password1": "An-even-longer-password-456!",
            "password2": "An-even-longer-password-456!",
        },
    )
    assert response.status_code == 302
    user.refresh_from_db()
    assert user.check_password("An-even-longer-password-456!")
    assert client.get("/accounts/email/").status_code == 302
    assert SocialAccount.objects.filter(user=user, provider="google").exists()


@pytest.mark.django_db
def test_password_reset_is_generic_single_use_and_session_safe(client, user, settings):
    settings.PASSWORD_RESET_TIMEOUT = 3600
    mail.outbox.clear()
    known = client.post("/accounts/password/reset/", {"email": user.email})
    unknown = client.post("/accounts/password/reset/", {"email": "nobody@example.com"})
    assert known.status_code == unknown.status_code == 302
    assert known["Location"] == unknown["Location"]
    assert len(mail.outbox) == 2

    reset_mail = next(
        message for message in mail.outbox if "/accounts/password/reset/key/" in message.body
    )
    match = re.search(r"/accounts/password/reset/key/([^\s\"<>]+)", reset_mail.body)
    assert match is not None
    reset_url = match.group(0)
    form_page = client.get(reset_url, follow=True)
    assert form_page.status_code == 200
    assert "password1" in form_page.content.decode()
    response = client.post(
        form_page.request["PATH_INFO"],
        {"password1": "Reset-password-789!", "password2": "Reset-password-789!"},
    )
    assert response.status_code == 302
    assert client.get("/accounts/email/").status_code == 302

    user.refresh_from_db()
    assert user.check_password("Reset-password-789!")
    replay = client.post(
        form_page.request["PATH_INFO"],
        {"password1": "Replay-password-000!", "password2": "Replay-password-000!"},
    )
    assert replay.status_code == 200
    user.refresh_from_db()
    assert user.check_password("Reset-password-789!")
