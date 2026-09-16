"""Integration checks for the allauth account-security flows (#562/#563)."""

import pytest
from django.contrib.auth import get_user_model


@pytest.fixture
def user(db):
    user = get_user_model().objects.create_user(
        username="security-user", email="security@example.com"
    )
    user.set_unusable_password()
    user.save(update_fields=["password"])
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
