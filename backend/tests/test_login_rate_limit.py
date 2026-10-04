from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings


def _login(client, email, password):
    return client.post(
        "/accounts/login/",
        {"login": email, "password": password},
    )


@override_settings(ACCOUNT_LOGIN_ATTEMPTS_LIMIT=2, ACCOUNT_LOGIN_ATTEMPTS_TIMEOUT=60)
def test_failed_passwords_are_limited_per_email_and_expire(client, monkeypatch, db):
    cache.clear()
    user = get_user_model().objects.create_user(
        username="login-limit-user",
        email="login-limit@example.com",
        password="correct-password-123",
    )
    now = [1000.0]
    monkeypatch.setattr("allauth.core.internal.ratelimit.time.time", lambda: now[0])

    first = _login(client, user.email, "wrong-password")
    second = _login(client, user.email, "wrong-password")
    limited = _login(client, user.email, "wrong-password")

    assert first.status_code == second.status_code == 200
    assert b"email address and/or password" in first.content
    assert b"email address and/or password" in second.content
    assert b"Too many failed login attempts" in limited.content

    now[0] += 61
    recovered = _login(client, user.email, "correct-password-123")
    assert recovered.status_code == 302
    assert recovered["Location"] == "/"


@override_settings(ACCOUNT_LOGIN_ATTEMPTS_LIMIT=0, ACCOUNT_LOGIN_ATTEMPTS_TIMEOUT=60)
def test_zero_failed_attempt_limit_disables_custom_lockout(client, db):
    cache.clear()
    user = get_user_model().objects.create_user(
        username="login-unlimited-user",
        email="login-unlimited@example.com",
        password="correct-password-123",
    )

    responses = [_login(client, user.email, "wrong-password") for _ in range(3)]

    assert all(response.status_code == 200 for response in responses)
    assert all(b"Too many failed login attempts" not in response.content for response in responses)
