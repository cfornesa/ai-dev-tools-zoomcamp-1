"""Site settings and plan-policy administration service (issue #422).

The one place `AdminSettingsView`/`AdminPlansView` (`scenes/admin_settings_api.py`)
call to read or change `SiteSettings`/`Plan` rows. Every write here is
`@transaction.atomic` and uses optimistic concurrency: the caller must
present the `revision` it last read, or the update is rejected as a
conflict (`RevisionConflict`) without changing anything -- a stale
concurrent edit never silently overwrites a newer one. Authorization
(`is_application_admin`, #421) is the caller's responsibility, exactly
like `scenes.entitlements` -- this module trusts it and doesn't re-check.
"""

from __future__ import annotations

from dataclasses import dataclass

from django.db import transaction

from scenes.entitlements import FEATURE_KEYS
from scenes.models import Plan, SiteSettings


class RevisionConflict(Exception):
    """Raised when the caller's `expected_revision` no longer matches the
    stored row -- someone else changed it first."""


class ValidationFailed(Exception):
    """Raised for any invalid field value or unknown key. The whole update
    is rejected; nothing is partially applied."""


@dataclass(frozen=True)
class SiteSettingsView:
    site_title: str
    revision: int


@dataclass(frozen=True)
class PlanView:
    plan_key: str
    daily_ai_requests: int
    feature_keys: list[str]
    active: bool
    paypal_plan_id: str
    revision: int


def get_site_settings() -> SiteSettingsView:
    settings_row = SiteSettings.get_solo()
    return SiteSettingsView(site_title=settings_row.site_title, revision=settings_row.revision)


@transaction.atomic
def update_site_settings(*, actor, expected_revision: int, site_title: str) -> SiteSettingsView:
    if not isinstance(site_title, str) or not site_title.strip():
        raise ValidationFailed("site_title must be a non-empty string.")
    if len(site_title) > 200:
        raise ValidationFailed("site_title must be at most 200 characters.")

    row = SiteSettings.objects.select_for_update().get(pk=SiteSettings.get_solo().pk)
    if row.revision != expected_revision:
        raise RevisionConflict(
            f"Expected revision {expected_revision}, but the current revision is {row.revision}."
        )
    row.site_title = site_title.strip()
    row.revision += 1
    row.updated_by = actor
    row.save()
    return SiteSettingsView(site_title=row.site_title, revision=row.revision)


def _plan_view(plan: Plan) -> PlanView:
    return PlanView(
        plan_key=plan.plan_key,
        daily_ai_requests=plan.daily_ai_requests,
        feature_keys=sorted(plan.feature_keys),
        active=plan.active,
        paypal_plan_id=plan.paypal_plan_id,
        revision=plan.revision,
    )


def list_plans() -> list[PlanView]:
    return [_plan_view(plan) for plan in Plan.objects.order_by("plan_key")]


@transaction.atomic
def update_plan(
    *,
    actor,
    plan_key: str,
    expected_revision: int,
    daily_ai_requests: int,
    feature_keys: list[str],
    active: bool,
    paypal_plan_id: str = "",
) -> PlanView:
    """Atomically validate and apply every field, or change nothing.

    A negative/non-integer `daily_ai_requests`, an unknown feature key,
    or a stale `expected_revision` all reject the entire update -- never
    a partial write.
    """
    if not isinstance(daily_ai_requests, int) or isinstance(daily_ai_requests, bool):
        raise ValidationFailed("daily_ai_requests must be an integer.")
    if daily_ai_requests < 0:
        raise ValidationFailed("daily_ai_requests must not be negative.")
    if not isinstance(feature_keys, list) or any(not isinstance(f, str) for f in feature_keys):
        raise ValidationFailed("feature_keys must be a list of strings.")
    unknown = set(feature_keys) - FEATURE_KEYS
    if unknown:
        raise ValidationFailed(f"Unknown feature key(s): {', '.join(sorted(unknown))}.")
    if not isinstance(active, bool):
        raise ValidationFailed("active must be a boolean.")
    if not isinstance(paypal_plan_id, str):
        raise ValidationFailed("paypal_plan_id must be a string.")

    try:
        plan = Plan.objects.select_for_update().get(plan_key=plan_key)
    except Plan.DoesNotExist as exc:
        raise ValidationFailed(f"Unknown plan key: {plan_key!r}.") from exc

    if plan.revision != expected_revision:
        raise RevisionConflict(
            f"Expected revision {expected_revision}, but the current revision is {plan.revision}."
        )

    plan.daily_ai_requests = daily_ai_requests
    plan.feature_keys = sorted(set(feature_keys))
    plan.active = active
    plan.paypal_plan_id = paypal_plan_id
    plan.revision += 1
    plan.updated_by = actor
    plan.save()
    return _plan_view(plan)
