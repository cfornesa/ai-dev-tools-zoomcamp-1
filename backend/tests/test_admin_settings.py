"""Tests for the admin settings/plans API and service (issue #422).

Uses the issue's own fixed fixture: application-admin A, ordinary user B,
`site_title='Creatrweb Animation Studio'`, free plan `daily_ai_requests=5`
and paid plan `daily_ai_requests=20` (test values, not an approved
commercial price).
"""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from scenes.admin_settings import (
    RevisionConflict,
    ValidationFailed,
    get_site_settings,
    list_plans,
    update_plan,
    update_site_settings,
)
from scenes.models import ApplicationAdmin, Plan, SiteSettings


@pytest.fixture
def admin_a():
    user = get_user_model().objects.create_user(username="admin_a", password="not-used")
    ApplicationAdmin.objects.create(user=user)
    return user


@pytest.fixture
def user_b():
    return get_user_model().objects.create_user(username="user_b", password="not-used")


@pytest.fixture(autouse=True)
def fixed_plans(db):
    Plan.objects.update_or_create(
        plan_key="free",
        defaults={
            "daily_ai_requests": 5,
            "feature_keys": ["ai_scene_create", "ai_scene_edit", "ai_art_generate"],
            "active": True,
        },
    )
    Plan.objects.update_or_create(
        plan_key="paid",
        defaults={
            "daily_ai_requests": 20,
            "feature_keys": ["ai_scene_create", "ai_scene_edit", "ai_art_generate"],
            "active": True,
        },
    )
    SiteSettings.objects.update_or_create(
        pk=1, defaults={"site_title": "Creatrweb Animation Studio"}
    )


# --- API authorization ---


@pytest.mark.django_db
def test_settings_get_denied_for_anonymous(client):
    response = client.get(reverse("admin-settings"))
    assert response.status_code == 401


@pytest.mark.django_db
def test_settings_get_denied_for_non_admin(client, user_b):
    client.force_login(user_b)
    response = client.get(reverse("admin-settings"))
    assert response.status_code == 403


@pytest.mark.django_db
def test_settings_get_allowed_for_admin(client, admin_a):
    client.force_login(admin_a)
    response = client.get(reverse("admin-settings"))
    assert response.status_code == 200
    assert response.json() == {"site_title": "Creatrweb Animation Studio", "revision": 1}


@pytest.mark.django_db
def test_plans_get_denied_for_anonymous_and_non_admin(client, user_b):
    assert client.get(reverse("admin-plans")).status_code == 401
    client.force_login(user_b)
    assert client.get(reverse("admin-plans")).status_code == 403


@pytest.mark.django_db
def test_plans_patch_denied_for_non_admin(client, user_b):
    client.force_login(user_b)
    response = client.patch(
        f"{reverse('admin-plans')}?plan_key=free",
        {
            "daily_ai_requests": 999,
            "feature_keys": [],
            "active": True,
            "paypal_plan_id": "",
            "revision": 1,
        },
        content_type="application/json",
    )
    assert response.status_code == 403
    assert Plan.objects.get(plan_key="free").daily_ai_requests == 5


# --- Site settings: read/update/validation/concurrency ---


@pytest.mark.django_db
def test_admin_can_update_site_title(client, admin_a):
    client.force_login(admin_a)
    response = client.patch(
        reverse("admin-settings"),
        {"site_title": "New Studio Name", "revision": 1},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json() == {"site_title": "New Studio Name", "revision": 2}
    assert SiteSettings.get_solo().site_title == "New Studio Name"


@pytest.mark.django_db
def test_site_title_update_rejects_unknown_fields_atomically(client, admin_a):
    client.force_login(admin_a)
    response = client.patch(
        reverse("admin-settings"),
        {"site_title": "New Name", "revision": 1, "not_a_real_field": "x"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert SiteSettings.get_solo().site_title == "Creatrweb Animation Studio"


@pytest.mark.django_db
def test_site_title_update_rejects_blank_title(client, admin_a):
    client.force_login(admin_a)
    response = client.patch(
        reverse("admin-settings"),
        {"site_title": "", "revision": 1},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert SiteSettings.get_solo().site_title == "Creatrweb Animation Studio"


@pytest.mark.django_db
def test_stale_site_title_revision_returns_conflict_without_partial_update(client, admin_a):
    client.force_login(admin_a)
    response = client.patch(
        reverse("admin-settings"),
        {"site_title": "Stale Attempt", "revision": 999},
        content_type="application/json",
    )
    assert response.status_code == 409
    assert SiteSettings.get_solo().site_title == "Creatrweb Animation Studio"
    assert SiteSettings.get_solo().revision == 1


@pytest.mark.django_db
def test_update_site_settings_records_actor():
    admin = get_user_model().objects.create_user(username="auditor", password="x")
    update_site_settings(actor=admin, expected_revision=1, site_title="Audited Title")

    row = SiteSettings.get_solo()
    assert row.updated_by_id == admin.id
    assert row.site_title == "Audited Title"


# --- Plans: read/update/validation/concurrency ---


@pytest.mark.django_db
def test_admin_can_list_plans(client, admin_a):
    client.force_login(admin_a)
    response = client.get(reverse("admin-plans"))
    assert response.status_code == 200
    plan_keys = {plan["plan_key"] for plan in response.json()}
    assert plan_keys == {"free", "paid"}


@pytest.mark.django_db
def test_admin_can_update_plan_daily_requests_and_features(client, admin_a):
    client.force_login(admin_a)
    response = client.patch(
        f"{reverse('admin-plans')}?plan_key=free",
        {
            "daily_ai_requests": 10,
            "feature_keys": ["ai_scene_create"],
            "active": True,
            "paypal_plan_id": "",
            "revision": 1,
        },
        content_type="application/json",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["daily_ai_requests"] == 10
    assert body["feature_keys"] == ["ai_scene_create"]
    assert body["revision"] == 2


@pytest.mark.django_db
def test_plan_update_rejects_negative_cap_leaving_previous_value_intact(client, admin_a):
    client.force_login(admin_a)
    response = client.patch(
        f"{reverse('admin-plans')}?plan_key=free",
        {
            "daily_ai_requests": -1,
            "feature_keys": [],
            "active": True,
            "paypal_plan_id": "",
            "revision": 1,
        },
        content_type="application/json",
    )
    assert response.status_code == 400
    assert Plan.objects.get(plan_key="free").daily_ai_requests == 5


@pytest.mark.django_db
def test_plan_update_rejects_unknown_feature_key_atomically():
    with pytest.raises(ValidationFailed):
        update_plan(
            actor=None,
            plan_key="free",
            expected_revision=1,
            daily_ai_requests=10,
            feature_keys=["not_a_real_feature"],
            active=True,
        )
    plan = Plan.objects.get(plan_key="free")
    assert plan.daily_ai_requests == 5
    assert plan.revision == 1


@pytest.mark.django_db
def test_plan_update_missing_plan_key_returns_bad_request(client, admin_a):
    client.force_login(admin_a)
    response = client.patch(
        reverse("admin-plans"),
        {
            "daily_ai_requests": 10,
            "feature_keys": [],
            "active": True,
            "paypal_plan_id": "",
            "revision": 1,
        },
        content_type="application/json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_stale_plan_revision_returns_conflict_without_partial_update():
    with pytest.raises(RevisionConflict):
        update_plan(
            actor=None,
            plan_key="free",
            expected_revision=999,
            daily_ai_requests=999,
            feature_keys=[],
            active=False,
        )
    plan = Plan.objects.get(plan_key="free")
    assert plan.daily_ai_requests == 5
    assert plan.active is True
    assert plan.revision == 1


# --- Next quota decision uses saved policy without resetting counters ---


@pytest.mark.django_db
def test_plan_cap_change_is_used_by_the_next_quota_decision_without_resetting_counter():
    from django.core.cache import cache

    from scenes import entitlements
    from scenes.ai_api import _quota_cache_key

    user = get_user_model().objects.create_user(username="quota_user", password="x")
    cache.set(_quota_cache_key(user.id), 3, timeout=3600)

    assert entitlements.get_effective_cap(user, "ai_scene_create") == 5

    update_plan(
        actor=None,
        plan_key="free",
        expected_revision=1,
        daily_ai_requests=10,
        feature_keys=["ai_scene_create", "ai_scene_edit", "ai_art_generate"],
        active=True,
    )

    # The in-flight counter (3 already used) is untouched by the policy
    # change; only the ceiling it's compared against changes.
    assert cache.get(_quota_cache_key(user.id)) == 3
    assert entitlements.get_effective_cap(user, "ai_scene_create") == 10


@pytest.mark.django_db
def test_get_site_settings_and_list_plans_expose_only_named_fields():
    site_settings = get_site_settings()
    assert set(vars(site_settings).keys()) == {"site_title", "revision"}

    plans = list_plans()
    assert all(
        set(vars(plan).keys())
        == {"plan_key", "daily_ai_requests", "feature_keys", "active", "paypal_plan_id", "revision"}
        for plan in plans
    )
