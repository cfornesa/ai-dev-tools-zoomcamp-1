"""Tests for the account-facing entitlement summary (issue #439).

Fixed fixture: free user with cap 5, paid fixture with cap 20, one
feature override, and a non-owner session proving no cross-user leak.
"""

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse

from scenes import entitlements
from scenes.ai_api import _quota_cache_key as scene_quota_key
from scenes.art_piece_api import _quota_cache_key as art_quota_key
from scenes.models import Plan


@pytest.fixture(autouse=True)
def _clear_cache():
    # DB-backed test rows roll back between tests, so autoincrement user
    # ids get reused -- the shared quota cache does not roll back with
    # them, so a leftover key from an earlier test's (different) user
    # can otherwise collide with this test's own user id.
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def fixed_plans(db):
    Plan.objects.update_or_create(
        plan_key="free",
        defaults={
            "daily_ai_requests": 5,
            "feature_keys": list(entitlements.FEATURE_KEYS),
            "active": True,
        },
    )
    Plan.objects.update_or_create(
        plan_key="paid",
        defaults={
            "daily_ai_requests": 20,
            "feature_keys": list(entitlements.FEATURE_KEYS),
            "active": True,
        },
    )


def _make_user(username):
    return get_user_model().objects.create_user(username=username, password="not-used")


@pytest.mark.django_db
def test_requires_authentication(client):
    response = client.get(reverse("account-entitlements"))
    assert response.status_code == 401


@pytest.mark.django_db
def test_free_user_sees_effective_tier_and_zero_usage(client):
    user = _make_user("free_user")
    client.force_login(user)

    response = client.get(reverse("account-entitlements"))

    assert response.status_code == 200
    body = response.json()
    assert body["plan_key"] == "free"
    assert "reset_at" in body
    by_feature = {f["feature"]: f for f in body["features"]}
    assert by_feature["ai_scene_create"] == {
        "feature": "ai_scene_create",
        "cap": 5,
        "used": 0,
        "remaining": 5,
    }


@pytest.mark.django_db
def test_paid_user_sees_higher_cap(client):
    user = _make_user("paid_user")
    entitlements.set_user_plan(user, "paid")
    client.force_login(user)

    response = client.get(reverse("account-entitlements"))

    by_feature = {f["feature"]: f for f in response.json()["features"]}
    assert by_feature["ai_scene_create"]["cap"] == 20


@pytest.mark.django_db
def test_usage_reflects_live_quota_counter_without_altering_it(client):
    user = _make_user("busy_user")
    cache.set(scene_quota_key(user.id), 3, timeout=3600)
    cache.set(art_quota_key(user.id), 1, timeout=3600)
    client.force_login(user)

    response = client.get(reverse("account-entitlements"))
    by_feature = {f["feature"]: f for f in response.json()["features"]}

    assert by_feature["ai_scene_create"] == {
        "feature": "ai_scene_create",
        "cap": 5,
        "used": 3,
        "remaining": 2,
    }
    assert by_feature["ai_art_generate"]["used"] == 1
    # Reading the summary is side-effect free.
    assert cache.get(scene_quota_key(user.id)) == 3


@pytest.mark.django_db
def test_feature_override_is_reflected_in_effective_cap(client):
    user = _make_user("overridden_user")
    entitlements.set_feature_override(user, "ai_art_generate", allowed=False)
    client.force_login(user)

    response = client.get(reverse("account-entitlements"))
    by_feature = {f["feature"]: f for f in response.json()["features"]}

    assert by_feature["ai_art_generate"]["cap"] == 0
    assert by_feature["ai_art_generate"]["remaining"] == 0
    # Other features are unaffected by this one override.
    assert by_feature["ai_scene_create"]["cap"] == 5


@pytest.mark.django_db
def test_remaining_never_goes_negative_when_over_quota(client):
    user = _make_user("over_quota_user")
    cache.set(scene_quota_key(user.id), 9, timeout=3600)
    client.force_login(user)

    response = client.get(reverse("account-entitlements"))
    by_feature = {f["feature"]: f for f in response.json()["features"]}

    assert by_feature["ai_scene_create"]["remaining"] == 0


@pytest.mark.django_db
def test_never_exposes_another_users_overrides_or_usage(client):
    user_a = _make_user("user_a")
    user_b = _make_user("user_b")
    entitlements.set_feature_override(user_b, "ai_scene_create", allowed=False)
    cache.set(scene_quota_key(user_b.id), 5, timeout=3600)
    client.force_login(user_a)

    response = client.get(reverse("account-entitlements"))
    by_feature = {f["feature"]: f for f in response.json()["features"]}

    # user_a's own summary, entirely unaffected by user_b's override/usage.
    assert by_feature["ai_scene_create"]["cap"] == 5
    assert by_feature["ai_scene_create"]["used"] == 0
