import pytest
from django.contrib.auth import get_user_model
from django.db.utils import ProgrammingError
from django.urls import reverse

from scenes.models import PublicProfile, PublicProfileHandleRedirect


@pytest.mark.django_db
def test_owner_can_create_and_update_profile_with_revision(client):
    user = get_user_model().objects.create_user(username="alice", password="x")
    client.force_login(user)
    first = client.get(reverse("account-profile"))
    assert first.status_code == 200
    updated = client.patch(
        reverse("account-profile"),
        {
            "handle": "alice",
            "display_name": "Alice",
            "bio": "Artist",
            "theme_config": {"accent": "#00ff00"},
            "revision": 1,
        },
        content_type="application/json",
    )
    assert updated.status_code == 200
    assert updated.json()["handle"] == "alice"
    assert updated.json()["theme_config"]["accent"] == "#00ff00"
    assert client.get("/api/users/@alice/").status_code == 200


@pytest.mark.django_db
def test_profile_handle_privacy_and_conflict_are_safe(client):
    alice = get_user_model().objects.create_user(username="alice", password="x")
    bob = get_user_model().objects.create_user(username="bob", password="x")
    PublicProfile.objects.create(user=alice, handle="alice", bio="private metadata")
    client.force_login(bob)
    conflict = client.patch(
        reverse("account-profile"),
        {"handle": "alice", "revision": 1},
        content_type="application/json",
    )
    assert conflict.status_code == 409
    assert client.get("/api/users/@alice/").json()["profile"]["bio"] == "private metadata"
    assert "email" not in client.get("/api/users/@alice/").json()["profile"]


@pytest.mark.django_db
def test_profile_get_generates_stable_collision_safe_handle(client):
    user = get_user_model().objects.create_user(username="Ada Lovelace", password="x")
    client.force_login(user)

    first = client.get(reverse("account-profile"))
    assert first.status_code == 200
    assert first.json()["handle"] == "ada-lovelace"

    second = client.get(reverse("account-profile"))
    assert second.json()["handle"] == "ada-lovelace"

    collision = get_user_model().objects.create_user(username="ada-lovelace", password="x")
    collision_client = client.__class__()
    collision_client.force_login(collision)
    assert collision_client.get(reverse("account-profile")).json()["handle"] == "ada-lovelace-2"


@pytest.mark.django_db
def test_handle_change_creates_permanent_redirect_and_field_errors(client):
    user = get_user_model().objects.create_user(username="alice", password="x")
    client.force_login(user)
    profile = client.get(reverse("account-profile")).json()

    changed = client.patch(
        reverse("account-profile"),
        {"handle": "new-alice", "revision": profile["revision"]},
        content_type="application/json",
    )
    assert changed.status_code == 200
    assert PublicProfileHandleRedirect.objects.filter(
        old_handle="alice", profile__user=user
    ).exists()
    redirect = client.get("/api/users/@alice/")
    assert redirect.status_code == 301
    assert redirect["Location"] == "/api/users/@new-alice/"

    reserved = client.patch(
        reverse("account-profile"),
        {"handle": "admin", "revision": changed.json()["revision"]},
        content_type="application/json",
    )
    assert reserved.status_code == 400
    assert reserved.json()["detail"]["handle"]
    assert client.get(reverse("account-profile")).json()["handle"] == "new-alice"


@pytest.mark.django_db
@pytest.mark.parametrize("is_staff", [False, True])
def test_profile_get_fails_safely_on_schema_drift(client, monkeypatch, is_staff):
    """A production database missing a pending migration (#571) must return
    a handled 503, never an unexplained 500 traceback, for ordinary and
    application-admin accounts alike."""
    user = get_user_model().objects.create_user(
        username="drift-user", password="x", is_staff=is_staff
    )
    client.force_login(user)

    def _raise(*args, **kwargs):
        raise ProgrammingError(
            'column "style_id" of relation "scenes_publicprofile" does not exist'
        )

    monkeypatch.setattr(PublicProfile.objects, "get_or_create", _raise)

    response = client.get(reverse("account-profile"))
    assert response.status_code == 503
    assert response.json() == {"detail": "Profile settings are temporarily unavailable."}
