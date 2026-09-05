"""Entitlement service: plans, per-user overrides, effective caps (issues #423/#422).

Resolves how many successful uses of a named feature a user may make per
day, from exactly two inputs: their plan tier (`UserEntitlementPlan`,
defaulting to `"free"` when no row exists) and any explicit per-feature
override (`UserFeatureOverride`) layered on top. Deliberately separate
from `scenes.admin_authorization` (#421): that answers "is this user
allowed to administer anything"; this answers "how much of a named
feature can this user use". A caller that wants to change entitlements
(grant/revoke/plan transition) must already have established
`is_application_admin(actor)` itself -- these functions trust their
caller and don't re-check that, keeping this module's own responsibility
single: transactional, idempotent state, not authorization.

Billing synchronization (#424) must call `set_user_plan` to reflect a
subscription change, never write `UserEntitlementPlan` rows directly, so
every plan transition goes through the same idempotent, audited path
regardless of who initiated it. Plan *definitions* themselves (which
features a plan grants, its daily cap, active state, PayPal plan id) are
`scenes.models.Plan` rows, admin-editable through `scenes.admin_settings`
(#422) -- this module only ever reads them, never writes them.
"""

from django.db import transaction

from scenes.models import Plan, UserEntitlementPlan, UserFeatureOverride

DEFAULT_PLAN = "free"
FEATURE_KEYS = frozenset({"ai_scene_create", "ai_scene_edit", "ai_art_generate"})


def get_user_plan_key(user) -> str:
    plan = UserEntitlementPlan.objects.filter(user=user).first()
    return plan.plan_key if plan else DEFAULT_PLAN


def _active_plan(plan_key: str) -> Plan | None:
    plan = Plan.objects.filter(plan_key=plan_key, active=True).first()
    if plan is not None:
        return plan
    if plan_key != DEFAULT_PLAN:
        return Plan.objects.filter(plan_key=DEFAULT_PLAN, active=True).first()
    return None


def get_effective_cap(user, feature_key: str) -> int:
    """The number of successful `feature_key` uses this user may make per
    day. Unknown feature keys, an explicit deny override, a plan that
    doesn't grant this feature, and a missing/inactive plan definition
    (e.g. a not-yet-seeded database) all fail closed to 0 -- never an
    exception a caller might mishandle as "allowed".
    """
    if feature_key not in FEATURE_KEYS:
        return 0
    override = UserFeatureOverride.objects.filter(user=user, feature_key=feature_key).first()
    if override is not None and not override.allowed:
        return 0
    plan = _active_plan(get_user_plan_key(user))
    if plan is None or feature_key not in plan.feature_keys:
        return 0
    return plan.daily_ai_requests


def resolve_effective_entitlements(user) -> dict[str, int]:
    """Every feature's effective cap for `user` in one deterministic call
    -- the shape #439's account display reads."""
    return {feature: get_effective_cap(user, feature) for feature in sorted(FEATURE_KEYS)}


@transaction.atomic
def set_user_plan(user, plan_key: str, *, granted_by=None) -> UserEntitlementPlan:
    """Idempotent plan transition: rerunning with the same `plan_key`
    changes nothing observable. Never touches `UserFeatureOverride` rows,
    saved projects/versions/credentials, or sessions."""
    if not Plan.objects.filter(plan_key=plan_key).exists():
        raise ValueError(f"Unknown plan key: {plan_key!r}")
    plan, _ = UserEntitlementPlan.objects.select_for_update().get_or_create(user=user)
    plan.plan_key = plan_key
    plan.granted_by = granted_by
    plan.save()
    return plan


@transaction.atomic
def set_feature_override(
    user, feature_key: str, allowed: bool, *, granted_by=None
) -> UserFeatureOverride:
    """Idempotent grant/revoke of one feature override. Never touches the
    user's plan, other features' overrides, or anyone else's entitlements."""
    if feature_key not in FEATURE_KEYS:
        raise ValueError(f"Unknown feature key: {feature_key!r}")
    override, _ = UserFeatureOverride.objects.select_for_update().get_or_create(
        user=user, feature_key=feature_key, defaults={"allowed": allowed}
    )
    override.allowed = allowed
    override.granted_by = granted_by
    override.save()
    return override


@transaction.atomic
def clear_feature_override(user, feature_key: str) -> None:
    """Idempotent: clearing an override that doesn't exist is a no-op."""
    UserFeatureOverride.objects.filter(user=user, feature_key=feature_key).delete()
