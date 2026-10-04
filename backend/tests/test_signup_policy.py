import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse


@pytest.mark.django_db
def test_local_signup_is_closed_and_social_signup_remains_available(client):
    response = client.get(reverse("account_signup"))

    assert response.status_code == 200
    assert b"Password sign-up is unavailable" in response.content
    assert b"enabled social sign-in provider after you consent" in response.content
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
def test_login_page_explains_provider_neutral_social_account_creation(client):
    response = client.get(reverse("account_login"))

    assert response.status_code == 200
    assert (
        b"New accounts can be created with an enabled social sign-in provider after you consent."
        in response.content
    )
    assert b"Continue with Google" in response.content
    assert b'href="/accounts/signup/"' not in response.content
    assert b'data-site-font="' in response.content
    assert b'--bg:' in response.content
    assert b"#16171d" not in response.content


@pytest.mark.django_db
def test_signup_closed_page_uses_the_site_theme_shell(client):
    response = client.get(reverse("account_signup"))

    assert response.status_code == 200
    assert b"Sign-up is currently unavailable" in response.content
    assert b'data-site-backdrop="' in response.content
    assert b"#1f2028" not in response.content
