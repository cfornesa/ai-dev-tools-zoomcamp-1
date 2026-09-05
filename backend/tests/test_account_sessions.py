"""Tests for account session listing/revocation (issue #441).

Fixed fixture: user A with a current session and a second session
(simulated via a second `Client`), and user B with a separate session
entirely, proving cross-user isolation. `Client.force_login()` calls the
real `django.contrib.auth.login()`, which sends the same `user_logged_in`
signal a genuine browser login would -- `scenes.account_session_signals`
records `SessionMetadata` from that signal exactly as it would in
production, so no test-only bypass is needed here.
"""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.sessions.models import Session
from django.test import Client
from django.urls import reverse
from django.utils import timezone

from scenes.account_sessions import compute_public_id
from scenes.models import SessionMetadata


def _make_user(username):
    return get_user_model().objects.create_user(username=username, password="not-used")


@pytest.mark.django_db
def test_requires_authentication(client):
    response = client.get(reverse("account-sessions"))
    assert response.status_code == 401


@pytest.mark.django_db
def test_lists_own_session_with_current_marker_and_no_raw_key():
    user = _make_user("user_a")
    client = Client()
    client.force_login(user)

    response = client.get(reverse("account-sessions"))

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["is_current"] is True
    assert "session_key" not in body[0]
    assert len(body[0]["public_id"]) == 16


@pytest.mark.django_db
def test_second_session_is_listed_and_not_marked_current():
    user = _make_user("user_a")
    client_one = Client()
    client_two = Client()
    client_one.force_login(user)
    client_two.force_login(user)

    response = client_one.get(reverse("account-sessions"))
    body = response.json()

    assert len(body) == 2
    assert sorted(session["is_current"] for session in body) == [False, True]


@pytest.mark.django_db
def test_revoking_another_session_invalidates_its_next_authenticated_request():
    user = _make_user("user_a")
    client_one = Client()
    client_two = Client()
    client_one.force_login(user)
    client_two.force_login(user)

    second_key = client_two.session.session_key
    public_id = compute_public_id(second_key)

    response = client_one.delete(reverse("account-session-revoke", args=[public_id]))
    assert response.status_code == 200
    assert response.json() == {"revoked": True, "was_current": False}

    assert not Session.objects.filter(session_key=second_key).exists()
    # client_two's next authenticated request now fails.
    assert client_two.get(reverse("whoami")).status_code == 401
    # client_one's own session (the one that issued the revoke) is fine.
    assert client_one.get(reverse("whoami")).status_code == 200

    # Idempotent: repeating the revoke while still authenticated (the
    # genuine "already gone" case) is a safe no-op, not an error.
    repeat_response = client_one.delete(reverse("account-session-revoke", args=[public_id]))
    assert repeat_response.status_code == 200
    assert repeat_response.json() == {"revoked": False, "was_current": False}


@pytest.mark.django_db
def test_revoking_current_session_logs_out_and_is_idempotent():
    user = _make_user("user_a")
    client = Client()
    client.force_login(user)
    public_id = compute_public_id(client.session.session_key)

    response = client.delete(reverse("account-session-revoke", args=[public_id]))
    assert response.status_code == 200
    assert response.json() == {"revoked": True, "was_current": True}
    assert client.get(reverse("whoami")).status_code == 401

    # Repeating the request now that the client is logged out correctly
    # requires authentication again (401) -- there is no session left to
    # authenticate the repeat call with in the first place. Idempotency
    # for a *foreign/already-gone* session while still authenticated is
    # covered separately below and in
    # test_cannot_revoke_or_probe_another_users_session.
    repeat_response = client.delete(reverse("account-session-revoke", args=[public_id]))
    assert repeat_response.status_code == 401


@pytest.mark.django_db
def test_cannot_revoke_or_probe_another_users_session():
    user_a = _make_user("user_a")
    user_b = _make_user("user_b")
    client_a = Client()
    client_b = Client()
    client_a.force_login(user_a)
    client_b.force_login(user_b)
    b_public_id = compute_public_id(client_b.session.session_key)

    response = client_a.delete(reverse("account-session-revoke", args=[b_public_id]))

    assert response.status_code == 200
    assert response.json()["revoked"] is False
    # user_b's session is completely untouched.
    assert client_b.get(reverse("whoami")).status_code == 200


@pytest.mark.django_db
def test_revoking_a_made_up_public_id_is_a_safe_no_op(client):
    user = _make_user("user_a")
    client.force_login(user)

    response = client.delete(reverse("account-session-revoke", args=["0123456789abcdef"]))

    assert response.status_code == 200
    assert response.json()["revoked"] is False


@pytest.mark.django_db
def test_expired_session_is_never_listed():
    user = _make_user("user_a")
    store = SessionStore()
    store["_auth_user_id"] = str(user.pk)
    store.set_expiry(-1)
    store.save()
    SessionMetadata.objects.create(session_key=store.session_key, user=user)
    assert Session.objects.get(session_key=store.session_key).expire_date < timezone.now()

    client = Client()
    client.force_login(user)
    response = client.get(reverse("account-sessions"))

    public_ids = [s["public_id"] for s in response.json()]
    assert compute_public_id(store.session_key) not in public_ids
