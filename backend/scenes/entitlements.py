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

from dataclasses import dataclass

from django.db import transaction

from scenes.admin_authorization import is_application_admin
from scenes.models import (
    EntitlementRole,
    GlobalCapabilitySetting,
    Plan,
    SiteSettings,
    UserEntitlementPlan,
    UserFeatureOverride,
)

DEFAULT_PLAN = "free"
FEATURE_KEYS = frozenset(
    {"ai_scene_create", "ai_scene_edit", "ai_art_generate", "cloud_project_sync"}
)


@dataclass(frozen=True)
class CapabilitySpec:
    """One atomic capability and its plan/quota semantics (#519)."""

    local: bool
    remote: bool
    quota: bool
    plan_key: str | None


CAPABILITY_REGISTRY: dict[str, CapabilitySpec] = {
    "editor_2d_local": CapabilitySpec(local=True, remote=False, quota=False, plan_key=None),
    "editor_3d_local": CapabilitySpec(local=True, remote=False, quota=False, plan_key=None),
    "generated_pieces": CapabilitySpec(local=True, remote=False, quota=False, plan_key=None),
    "ai_scene_create": CapabilitySpec(
        local=False, remote=True, quota=True, plan_key="ai_scene_create"
    ),
    "ai_scene_edit": CapabilitySpec(local=False, remote=True, quota=True, plan_key="ai_scene_edit"),
    "ai_art_generate": CapabilitySpec(
        local=False, remote=True, quota=True, plan_key="ai_art_generate"
    ),
    "publishing": CapabilitySpec(local=False, remote=True, quota=False, plan_key="publishing"),
    "cloud_project_sync": CapabilitySpec(
        local=False, remote=True, quota=False, plan_key="cloud_project_sync"
    ),
}
CAPABILITY_KEYS = frozenset(CAPABILITY_REGISTRY)


def _validate_capabilities(capabilities: dict[str, object]) -> None:
    if not isinstance(capabilities, dict) or set(capabilities) - CAPABILITY_KEYS:
        raise ValueError("Unknown capability in role.")
    for value in capabilities.values():
        if (
            isinstance(value, dict)
            and "daily_cap" in value
            and (not isinstance(value["daily_cap"], int) or value["daily_cap"] < 0)
        ):
            raise ValueError("daily_cap must be a non-negative integer.")
        if not isinstance(value, (bool, dict)):
            raise ValueError("Role capability values must be boolean or an object.")


def list_roles() -> list[EntitlementRole]:
    return list(EntitlementRole.objects.order_by("role_key"))


@transaction.atomic
def create_role(
    *, actor, role_key: str, label: str, description: str, capabilities: dict[str, object]
):
    if not role_key or not role_key.replace("_", "").isalnum():
        raise ValueError("role_key must contain only letters, numbers, and underscores.")
    _validate_capabilities(capabilities)
    return EntitlementRole.objects.create(
        role_key=role_key,
        label=label.strip(),
        description=description.strip(),
        capabilities=capabilities,
        updated_by=actor,
    )


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


def resolve_effective_capabilities(user) -> dict[str, dict[str, object]]:
    """Resolve every editor/task capability in one deterministic snapshot.

    Local capabilities are available by default even when a plan omits them;
    an explicit per-user deny is the only way to suppress one. Remote
    capabilities require the plan unless an explicit allow grants them. This
    distinction keeps plan/schema drift from removing local creative work.
    """
    plan_key = get_user_plan_key(user)
    plan = _active_plan(plan_key)
    plan_features = set(plan.feature_keys) if plan is not None else set()
    role = plan.role if plan is not None and plan.role_id else None
    role_capabilities = role.capabilities if role is not None and role.active else {}
    global_settings = {
        row.capability_key: row.enabled
        for row in GlobalCapabilitySetting.objects.filter(capability_key__in=CAPABILITY_KEYS)
    }
    if "cloud_project_sync" not in global_settings:
        global_settings["cloud_project_sync"] = SiteSettings.get_solo().cloud_sync_enabled
    overrides = {
        row.feature_key: row.allowed
        for row in UserFeatureOverride.objects.filter(user=user, feature_key__in=CAPABILITY_KEYS)
    }
    result: dict[str, dict[str, object]] = {}
    admin = is_application_admin(user)
    for key in sorted(CAPABILITY_KEYS):
        spec = CAPABILITY_REGISTRY[key]
        override = overrides.get(key)
        if not global_settings.get(key, True):
            available = False
            source = "global"
        elif admin:
            available = True
            source = "admin"
        elif override is not None:
            available = override
            source = "override"
        elif key in role_capabilities:
            role_value = role_capabilities[key]
            available = (
                role_value.get("enabled", False)
                if isinstance(role_value, dict)
                else bool(role_value)
            )
            source = "role"
        elif spec.local:
            available = True
            source = "local"
        else:
            available = key in plan_features
            source = "plan"
        role_value = role_capabilities.get(key)
        cap = None
        if spec.quota and plan is not None and (key in plan_features or key in role_capabilities):
            cap = (
                role_value.get("daily_cap", plan.daily_ai_requests)
                if isinstance(role_value, dict)
                else plan.daily_ai_requests
            )
        result[key] = {
            "available": available,
            "source": source,
            "local": spec.local,
            "remote": spec.remote,
            "quota": spec.quota,
            "daily_cap": cap,
        }
    return result


@transaction.atomic
def update_role(
    *,
    actor,
    role_key: str,
    label: str,
    description: str,
    capabilities: dict[str, object],
    expected_revision: int,
    active: bool,
) -> EntitlementRole:
    """Atomically update one admin-defined role capability bundle."""
    if not role_key or not role_key.replace("_", "").isalnum():
        raise ValueError("role_key must contain only letters, numbers, and underscores.")
    _validate_capabilities(capabilities)
    if not isinstance(active, bool):
        raise ValueError("active must be boolean.")
    role = EntitlementRole.objects.select_for_update().get(role_key=role_key)
    if role.revision != expected_revision:
        raise ValueError("role revision conflict")
    role.label = label.strip()
    role.description = description.strip()
    role.capabilities = capabilities
    role.active = active
    role.revision += 1
    role.updated_by = actor
    role.save()
    return role


@transaction.atomic
def set_global_capability(*, actor, capability_key: str, enabled: bool, expected_revision: int):
    """Atomically toggle one global capability, preserving cloud-sync parity."""
    if capability_key not in CAPABILITY_KEYS or not isinstance(enabled, bool):
        raise ValueError("Invalid global capability setting.")
    setting, _ = GlobalCapabilitySetting.objects.select_for_update().get_or_create(
        capability_key=capability_key,
        defaults={"enabled": enabled},
    )
    if setting.revision != expected_revision:
        raise ValueError("global capability revision conflict")
    setting.enabled = enabled
    setting.revision += 1
    setting.updated_by = actor
    setting.save()
    if capability_key == "cloud_project_sync":
        site_settings = SiteSettings.objects.select_for_update().get_or_create(pk=1)[0]
        site_settings.cloud_sync_enabled = enabled
        site_settings.revision += 1
        site_settings.updated_by = actor
        site_settings.save(
            update_fields=["cloud_sync_enabled", "revision", "updated_by", "updated_at"]
        )
    return setting


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
    if feature_key not in CAPABILITY_KEYS:
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
    if feature_key not in CAPABILITY_KEYS:
        raise ValueError(f"Unknown feature key: {feature_key!r}")
    UserFeatureOverride.objects.filter(user=user, feature_key=feature_key).delete()


@transaction.atomic
def set_feature_overrides(user, permissions: dict[str, bool], *, granted_by=None) -> None:
    """Atomically replace explicit permissions for the supplied named tasks."""
    if not isinstance(permissions, dict) or set(permissions) - CAPABILITY_KEYS:
        raise ValueError("Unknown capability in permission set.")
    if any(not isinstance(value, bool) for value in permissions.values()):
        raise ValueError("Capability permissions must be boolean.")
    for feature_key, allowed in permissions.items():
        set_feature_override(user, feature_key, allowed, granted_by=granted_by)
