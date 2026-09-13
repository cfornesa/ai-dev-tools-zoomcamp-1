import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from scenes.models import PublicProfile


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
