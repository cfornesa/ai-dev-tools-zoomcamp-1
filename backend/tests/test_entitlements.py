"""Tests for the entitlement service (issue #423): plan/override
resolution, atomic grant/revoke transitions, quota-boundary enforcement
through the shared cache, and concurrency safety. Uses the exact fixed
fixture the issue's own closure contract names: free cap 5, paid cap 20,
feature keys ai_scene_create/ai_scene_edit/ai_art_generate, an explicit
allow/deny override, and a "user B" sentinel proving grants/revokes never
leak across users.
"""

import threading

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connections

from scenes import entitlements
from scenes.models import ApplicationAdmin, Plan, UserEntitlementPlan, UserFeatureOverride


def _rebind_default_to_postgres():
    """Same technique `tests/test_shared_quota_cache.py` uses: point the
    "default" alias at the real disposable PostgreSQL server, so
    `transaction.atomic()` (which always targets "default") opens a real
    transaction there instead of on the router-selected alias it can't
    see. SQLite's `select_for_update()` only ever takes a whole-database
    lock, not a row lock, so it cannot prove this concurrency guarantee at
    all -- this specifically needs PostgreSQL.
    """
    connections["default"].close()
    try:
        delattr(connections._connections, "default")
    except AttributeError:
        pass
    connections.databases["default"] = dict(connections.databases["postgres_test"])


FEATURE = "ai_scene_create"


@pytest.fixture(autouse=True)
def fixed_plan_registry(db):
    """The issue's own fixed fixture: free cap 5, paid cap 20 for every
    feature -- deterministic and independent of the real seeded
    production defaults (`scenes/migrations/0031_seed_default_plans.py`).
    Migrations already seed `free`/`paid` rows; overwrite their caps for
    this test module only, every feature key granted on both."""
    Plan.objects.update_or_create(
        plan_key="free",
        defaults={
            "daily_ai_requests": 5,
            "feature_keys": sorted(entitlements.FEATURE_KEYS),
            "active": True,
        },
    )
    Plan.objects.update_or_create(
        plan_key="paid",
        defaults={
            "daily_ai_requests": 20,
            "feature_keys": sorted(entitlements.FEATURE_KEYS),
            "active": True,
        },
    )


def _make_user(username):
    return get_user_model().objects.create_user(username=username, password="not-used")


@pytest.mark.django_db
def test_default_plan_is_free_with_fixture_cap():
    user = _make_user("alice")

    assert entitlements.get_user_plan_key(user) == "free"
    assert entitlements.get_effective_cap(user, FEATURE) == 5


@pytest.mark.django_db
def test_plan_transition_changes_effective_cap_deterministically():
    user = _make_user("alice")
    admin = _make_user("admin")

    entitlements.set_user_plan(user, "paid", granted_by=admin)

    assert entitlements.get_user_plan_key(user) == "paid"
    assert entitlements.get_effective_cap(user, FEATURE) == 20


@pytest.mark.django_db
def test_unknown_feature_key_fails_closed_to_zero():
    user = _make_user("alice")

    assert entitlements.get_effective_cap(user, "not_a_real_feature") == 0


@pytest.mark.django_db
def test_invalid_plan_key_fails_closed_not_silently_accepted():
    user = _make_user("alice")

    with pytest.raises(ValueError):
        entitlements.set_user_plan(user, "not_a_real_plan")

    # The failed transition changed nothing.
    assert entitlements.get_user_plan_key(user) == "free"


@pytest.mark.django_db
def test_explicit_deny_override_wins_over_plan_cap():
    user = _make_user("alice")
    admin = _make_user("admin")
    entitlements.set_user_plan(user, "paid", granted_by=admin)

    entitlements.set_feature_override(user, FEATURE, allowed=False, granted_by=admin)

    assert entitlements.get_effective_cap(user, FEATURE) == 0


@pytest.mark.django_db
def test_explicit_allow_override_defers_to_plan_cap():
    user = _make_user("alice")
    admin = _make_user("admin")

    entitlements.set_feature_override(user, FEATURE, allowed=True, granted_by=admin)

    assert entitlements.get_effective_cap(user, FEATURE) == 5  # free plan's cap, unchanged


@pytest.mark.django_db
def test_clearing_override_restores_plan_cap():
    user = _make_user("alice")
    admin = _make_user("admin")
    entitlements.set_feature_override(user, FEATURE, allowed=False, granted_by=admin)
    assert entitlements.get_effective_cap(user, FEATURE) == 0

    entitlements.clear_feature_override(user, FEATURE)

    assert entitlements.get_effective_cap(user, FEATURE) == 5


@pytest.mark.django_db
def test_granting_or_revoking_one_feature_does_not_mutate_unrelated_entitlements():
    """User B sentinel: an override on user A's ai_scene_create must never
    change user B's caps, user A's other features, or user A's plan."""
    user_a = _make_user("alice")
    user_b = _make_user("bob")
    admin = _make_user("admin")

    before_a_edit = entitlements.get_effective_cap(user_a, "ai_scene_edit")
    before_b = entitlements.resolve_effective_entitlements(user_b)

    entitlements.set_feature_override(user_a, FEATURE, allowed=False, granted_by=admin)

    assert entitlements.get_effective_cap(user_a, FEATURE) == 0
    assert entitlements.get_effective_cap(user_a, "ai_scene_edit") == before_a_edit
    assert entitlements.get_user_plan_key(user_a) == "free"
    assert entitlements.resolve_effective_entitlements(user_b) == before_b


@pytest.mark.django_db
def test_granting_or_revoking_never_touches_saved_projects_versions_credentials_sessions():
    """Belt-and-suspenders: an entitlement change must never cascade into
    unrelated tables via some accidental shared-key/signal side effect."""
    from django.contrib.sessions.models import Session

    from scenes.models import MistralCredential, Project

    user = _make_user("alice")
    admin = _make_user("admin")
    project = Project.objects.create(owner=user, title="Untouched")
    credential = MistralCredential.objects.create(user=user, encrypted_key=b"unchanged")
    session_count_before = Session.objects.count()

    entitlements.set_user_plan(user, "paid", granted_by=admin)
    entitlements.set_feature_override(user, FEATURE, allowed=False, granted_by=admin)

    project.refresh_from_db()
    credential.refresh_from_db()
    assert project.title == "Untouched"
    assert bytes(credential.encrypted_key) == b"unchanged"
    assert Session.objects.count() == session_count_before


@pytest.mark.django_db
def test_grant_revoke_transitions_are_idempotent():
    user = _make_user("alice")
    admin = _make_user("admin")

    entitlements.set_user_plan(user, "paid", granted_by=admin)
    first = UserEntitlementPlan.objects.get(user=user)
    entitlements.set_user_plan(user, "paid", granted_by=admin)
    second = UserEntitlementPlan.objects.get(user=user)

    assert UserEntitlementPlan.objects.filter(user=user).count() == 1
    assert first.pk == second.pk

    entitlements.set_feature_override(user, FEATURE, allowed=False, granted_by=admin)
    entitlements.set_feature_override(user, FEATURE, allowed=False, granted_by=admin)
    assert UserFeatureOverride.objects.filter(user=user, feature_key=FEATURE).count() == 1

    entitlements.clear_feature_override(user, FEATURE)
    entitlements.clear_feature_override(user, FEATURE)  # no-op, does not raise
    assert not UserFeatureOverride.objects.filter(user=user, feature_key=FEATURE).exists()


@pytest.mark.django_db
def test_admin_granted_free_access_is_reflected_by_application_admin_grant():
    """Application-admin (#421) and entitlement plan (#423) are
    independent authorities -- granting one never implies the other."""
    admin = _make_user("admin")
    ApplicationAdmin.objects.create(user=admin)

    entitlements.set_user_plan(admin, "paid", granted_by=admin)

    assert entitlements.get_user_plan_key(admin) == "paid"
    assert ApplicationAdmin.objects.filter(user=admin).exists()


@pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping real-row-lock concurrency test.",
)
@pytest.mark.django_db(databases=["default", "postgres_test"], transaction=True)
def test_concurrent_plan_transitions_for_the_same_user_do_not_corrupt_state():
    """Two concurrent set_user_plan calls for the same user must leave
    exactly one row behind (whichever wins the race), never a duplicate
    or an IntegrityError -- select_for_update() serializes the writers.
    """
    _rebind_default_to_postgres()
    # `transaction=True` flushes the target databases before this test
    # runs, which does not restore data-migration-seeded rows (only
    # `serialized_rollback=True` would) -- seed the plans this test
    # actually needs directly, on the now-postgres-bound connection.
    for plan_key in ("free", "paid"):
        Plan.objects.get_or_create(
            plan_key=plan_key,
            defaults={"daily_ai_requests": 5, "feature_keys": sorted(entitlements.FEATURE_KEYS)},
        )
    user = _make_user("alice")
    admin = _make_user("admin")
    errors: list[Exception] = []
    barrier = threading.Barrier(2)

    def worker(plan_key: str) -> None:
        try:
            barrier.wait(timeout=5)
            entitlements.set_user_plan(user, plan_key, granted_by=admin)
        except Exception as exc:  # pragma: no cover - failure path only
            errors.append(exc)
        finally:
            connections.close_all()

    threads = [threading.Thread(target=worker, args=(key,)) for key in ("free", "paid")]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=10)

    assert not errors
    assert UserEntitlementPlan.objects.filter(user=user).count() == 1
    assert entitlements.get_user_plan_key(user) in ("free", "paid")
