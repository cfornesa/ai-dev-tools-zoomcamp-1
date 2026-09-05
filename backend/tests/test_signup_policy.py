import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse


@pytest.mark.django_db
def test_local_signup_is_closed_with_explicit_google_only_message(client):
    response = client.get(reverse("account_signup"))

    assert response.status_code == 200
    assert b"uses Google sign-in for new accounts" in response.content
    assert b"id=\"signup-form\"" not in response.content


@pytest.mark.django_db
def test_local_signup_post_cannot_create_password_account(client):
    response = client.post(
        reverse("account_signup"),
        {
            "email": "blocked@example.com",
            "password1": "a-strong-password-123",
            "password2": "a-strong-password-123",
        },
    )

    assert response.status_code == 200
    assert not get_user_model().objects.filter(email="blocked@example.com").exists()


@pytest.mark.django_db
def test_login_page_has_google_creation_copy_without_local_signup_link(client):
    response = client.get(reverse("account_login"))

    assert response.status_code == 200
    assert b"Continue with Google to create your account" in response.content
    assert b'href="/accounts/signup/"' not in response.content
