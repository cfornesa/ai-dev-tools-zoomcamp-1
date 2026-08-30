from unittest.mock import Mock, patch

import pytest
from allauth.account.forms import SignupForm
from django.test import RequestFactory, override_settings

from backend.forms import RecaptchaSignupForm
from backend.recaptcha import verify_signup_token


def test_recaptcha_verification_checks_action_score_and_hostname():
    response = Mock()
    response.json.return_value = {
        "success": True,
        "action": "signup",
        "score": 0.9,
        "hostname": "studio.example",
    }
    with (
        override_settings(
            RECAPTCHA_VERIFY_URL="https://captcha.test/verify",
            RECAPTCHA_SECRET_KEY="server-only",
            RECAPTCHA_ACTION="signup",
            RECAPTCHA_MIN_SCORE=0.5,
            RECAPTCHA_ALLOWED_HOSTNAMES={"studio.example"},
        ),
        patch("backend.recaptcha.requests.post", return_value=response) as post,
    ):
        assert verify_signup_token("token", "127.0.0.1") == (True, "")

    post.assert_called_once()
    assert post.call_args.kwargs["timeout"] == 5
    assert post.call_args.kwargs["data"]["secret"] == "server-only"


@pytest.mark.parametrize(
    "result",
    [
        {"success": False},
        {"success": True, "action": "login", "score": 0.9, "hostname": "studio.example"},
        {"success": True, "action": "signup", "score": 0.1, "hostname": "studio.example"},
        {"success": True, "action": "signup", "score": 0.9, "hostname": "other.example"},
    ],
)
def test_recaptcha_rejects_invalid_verification_result(result):
    response = Mock()
    response.json.return_value = result
    with (
        override_settings(
            RECAPTCHA_SECRET_KEY="server-only",
            RECAPTCHA_ACTION="signup",
            RECAPTCHA_MIN_SCORE=0.5,
            RECAPTCHA_ALLOWED_HOSTNAMES={"studio.example"},
        ),
        patch("backend.recaptcha.requests.post", return_value=response),
    ):
        valid, message = verify_signup_token("token")

    assert not valid
    assert message


@pytest.mark.django_db
def test_signup_form_skips_network_verification_when_protection_is_disabled():
    request = RequestFactory().get("/accounts/signup/")
    form = RecaptchaSignupForm(
        data={
            "email": "new@example.com",
            "password1": "a-strong-password-123",
            "password2": "a-strong-password-123",
        },
    )
    form.request = request
    with (
        override_settings(RECAPTCHA_ENABLED=False),
        patch("backend.forms.verify_signup_token") as verify,
    ):
        assert form.is_valid()
    verify.assert_not_called()
    assert isinstance(form, SignupForm)
