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
from scenes.models import EntitlementRole, Plan, SiteSettings
from scenes.theme import sanitize_theme


class RevisionConflict(Exception):
    """Raised when the caller's `expected_revision` no longer matches the
    stored row -- someone else changed it first."""


class ValidationFailed(Exception):
    """Raised for any invalid field value or unknown key. The whole update
    is rejected; nothing is partially applied."""


@dataclass(frozen=True)
class SiteSettingsView:
    site_title: str
    cloud_sync_enabled: bool
    revision: int
    theme_config: dict[str, str]


@dataclass(frozen=True)
class PlanView:
    plan_key: str
    daily_ai_requests: int
    cloud_storage_bytes: int
    cloud_storage_files: int
    cloud_snapshot_cadence_days: int
    cloud_snapshot_archive_enabled: bool
    feature_keys: list[str]
    active: bool
    paypal_plan_id: str
    price: str
    currency: str
    interval: str
    revision: int
    role_key: str | None


def get_site_settings() -> SiteSettingsView:
    settings_row = SiteSettings.get_solo()
    return SiteSettingsView(
        site_title=settings_row.site_title,
        cloud_sync_enabled=settings_row.cloud_sync_enabled,
        revision=settings_row.revision,
        theme_config=settings_row.theme_config,
    )


@transaction.atomic
def update_site_settings(
    *,
    actor,
    expected_revision: int,
    site_title: str,
    cloud_sync_enabled: bool | None = None,
    theme_config: dict[str, str] | None = None,
) -> SiteSettingsView:
    if not isinstance(site_title, str) or not site_title.strip():
        raise ValidationFailed("site_title must be a non-empty string.")
    if len(site_title) > 200:
        raise ValidationFailed("site_title must be at most 200 characters.")
    if theme_config is not None:
        try:
            theme_config = sanitize_theme(theme_config)
        except ValueError as exc:
            raise ValidationFailed(str(exc)) from exc

    row = SiteSettings.objects.select_for_update().get(pk=SiteSettings.get_solo().pk)
    if row.revision != expected_revision:
        raise RevisionConflict(
            f"Expected revision {expected_revision}, but the current revision is {row.revision}."
        )
    row.site_title = site_title.strip()
    if cloud_sync_enabled is not None:
        if not isinstance(cloud_sync_enabled, bool):
            raise ValidationFailed("cloud_sync_enabled must be a boolean.")
        row.cloud_sync_enabled = cloud_sync_enabled
    if theme_config is not None:
        row.theme_config = theme_config
    row.revision += 1
    row.updated_by = actor
    row.save()
    return SiteSettingsView(
        site_title=row.site_title,
        cloud_sync_enabled=row.cloud_sync_enabled,
        revision=row.revision,
        theme_config=row.theme_config,
    )


def _plan_view(plan: Plan) -> PlanView:
    return PlanView(
        plan_key=plan.plan_key,
        daily_ai_requests=plan.daily_ai_requests,
        cloud_storage_bytes=plan.cloud_storage_bytes,
        cloud_storage_files=plan.cloud_storage_files,
        cloud_snapshot_cadence_days=plan.cloud_snapshot_cadence_days,
        cloud_snapshot_archive_enabled=plan.cloud_snapshot_archive_enabled,
        feature_keys=sorted(plan.feature_keys),
        active=plan.active,
        paypal_plan_id=plan.paypal_plan_id,
        price=f"{plan.price:.2f}",
        currency=plan.currency,
        interval=plan.billing_interval,
        revision=plan.revision,
        role_key=plan.role.role_key if plan.role_id and plan.role is not None else None,
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
    price: str | None = None,
    currency: str | None = None,
    interval: str | None = None,
    role_key: str | None = None,
    cloud_storage_bytes: int = 52_428_800,
    cloud_storage_files: int = 100,
    cloud_snapshot_cadence_days: int = 7,
    cloud_snapshot_archive_enabled: bool = False,
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
    if (
        not isinstance(cloud_storage_bytes, int)
        or isinstance(cloud_storage_bytes, bool)
        or cloud_storage_bytes < 0
    ):
        raise ValidationFailed("cloud_storage_bytes must be a non-negative integer.")
    if (
        not isinstance(cloud_storage_files, int)
        or isinstance(cloud_storage_files, bool)
        or cloud_storage_files < 0
    ):
        raise ValidationFailed("cloud_storage_files must be a non-negative integer.")
    if (
        not isinstance(cloud_snapshot_cadence_days, int)
        or isinstance(cloud_snapshot_cadence_days, bool)
        or cloud_snapshot_cadence_days < 1
    ):
        raise ValidationFailed("cloud_snapshot_cadence_days must be a positive integer.")
    if not isinstance(cloud_snapshot_archive_enabled, bool):
        raise ValidationFailed("cloud_snapshot_archive_enabled must be a boolean.")
    if not isinstance(feature_keys, list) or any(not isinstance(f, str) for f in feature_keys):
        raise ValidationFailed("feature_keys must be a list of strings.")
    unknown = set(feature_keys) - FEATURE_KEYS
    if unknown:
        raise ValidationFailed(f"Unknown feature key(s): {', '.join(sorted(unknown))}.")
    if not isinstance(active, bool):
        raise ValidationFailed("active must be a boolean.")
    if not isinstance(paypal_plan_id, str):
        raise ValidationFailed("paypal_plan_id must be a string.")
    if price is not None:
        from decimal import Decimal, InvalidOperation

        try:
            price_value = Decimal(str(price)).quantize(Decimal("0.01"))
        except (InvalidOperation, ValueError, TypeError) as exc:
            raise ValidationFailed(
                "price must be a non-negative amount with at most 2 decimals."
            ) from exc
        if price_value < 0:
            raise ValidationFailed("price must be a non-negative amount.")
    else:
        price_value = None
    if currency is not None and (not isinstance(currency, str) or len(currency) != 3):
        raise ValidationFailed("currency must be a three-letter code.")
    if interval is not None and interval not in {"day", "week", "month", "year"}:
        raise ValidationFailed("interval must be one of: day, week, month, year.")
    if role_key is not None:
        if not isinstance(role_key, str) or (
            role_key and not EntitlementRole.objects.filter(role_key=role_key, active=True).exists()
        ):
            raise ValidationFailed("role_key must name an active role.")

    try:
        plan = Plan.objects.select_for_update().get(plan_key=plan_key)
    except Plan.DoesNotExist as exc:
        raise ValidationFailed(f"Unknown plan key: {plan_key!r}.") from exc

    if plan.revision != expected_revision:
        raise RevisionConflict(
            f"Expected revision {expected_revision}, but the current revision is {plan.revision}."
        )

    plan.daily_ai_requests = daily_ai_requests
    plan.cloud_storage_bytes = cloud_storage_bytes
    plan.cloud_storage_files = cloud_storage_files
    plan.cloud_snapshot_cadence_days = cloud_snapshot_cadence_days
    plan.cloud_snapshot_archive_enabled = cloud_snapshot_archive_enabled
    plan.feature_keys = sorted(set(feature_keys))
    plan.active = active
    plan.paypal_plan_id = paypal_plan_id
    if price_value is not None:
        plan.price = price_value
    if currency is not None:
        plan.currency = currency.upper()
    if interval is not None:
        plan.billing_interval = interval
    if role_key is not None:
        plan.role = EntitlementRole.objects.filter(role_key=role_key).first() if role_key else None
    plan.revision += 1
    plan.updated_by = actor
    plan.save()
    return _plan_view(plan)
