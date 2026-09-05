"""PayPal subscription billing service: verified, idempotent entitlement
transitions from webhook events (issue #424).

Adopted policy (recorded here since no live operator was available to
confirm otherwise -- see the #424 closure comment for the full
rationale, and record a new decision issue if this should ever change):

- Cancellation retains the paid plan only through
  `Subscription.paid_through` -- no immediate downgrade. Access lapses
  naturally once PayPal's own eventual `BILLING.SUBSCRIPTION.EXPIRED`
  event arrives.
- A failed payment (`BILLING.SUBSCRIPTION.SUSPENDED`) never advances or
  shortens `paid_through` and does not downgrade access on its own --
  PayPal's own eventual `CANCELLED`/`EXPIRED` event is what ends it.
- A refund (`PAYMENT.SALE.REFUNDED`) only ever reverses the specific
  period it names, downgrading immediately only if that rollback date
  has already passed; it can only move `paid_through` earlier, never
  later.

Server-to-server synchronization only -- checkout/status UI is #440,
admin plan mapping is #422, the entitlement service itself is #423.
Every state change here happens in one atomic transaction alongside the
`BillingEvent` audit/idempotency record, so a partial write (state
changed but not recorded, or vice versa) can never happen.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from django.db import transaction
from django.utils import timezone

from scenes import entitlements
from scenes.models import BillingEvent, Plan, Subscription
from scenes.paypal_adapter import verify_webhook_signature


class WebhookRejected(Exception):
    """Raised only for a signature that fails verification. Nothing is
    read or written before this check, so nothing needs to be undone."""


@dataclass(frozen=True)
class WebhookOutcome:
    outcome: str  # "applied" | "ignored" | "rejected"
    detail: str


def _reject(event_id: str, event_type: str, detail: str) -> WebhookOutcome:
    BillingEvent.objects.get_or_create(
        paypal_event_id=event_id,
        defaults={
            "event_type": event_type,
            "outcome": BillingEvent.Outcome.REJECTED,
            "detail": detail,
        },
    )
    return WebhookOutcome(outcome="rejected", detail=detail)


@transaction.atomic
def process_webhook_event(
    *,
    event_id: str,
    event_type: str,
    resource: dict,
    headers: dict,
    raw_body: dict,
    actor_user_lookup,
) -> WebhookOutcome:
    """Verify, then idempotently apply one PayPal webhook event.

    `actor_user_lookup(custom_id)` resolves the Django user for a *new*
    subscription's `custom_id` -- only ever consulted the first time a
    given `paypal_subscription_id` is seen. Every later event for that
    same subscription id is tied to whichever user was resolved then,
    regardless of anything a later event claims -- this is what makes a
    cross-user event impossible: nothing after activation can redirect
    an existing subscription's entitlements to a different account.
    """
    if not verify_webhook_signature(headers, raw_body):
        raise WebhookRejected("Webhook signature verification failed.")

    existing = BillingEvent.objects.filter(paypal_event_id=event_id).select_for_update().first()
    if existing is not None:
        # Idempotent: a duplicate/replayed delivery is a no-op, returning
        # the same outcome recorded the first time -- never reapplied.
        return WebhookOutcome(outcome=existing.outcome, detail=existing.detail)

    subscription_id = resource.get("id")
    if not subscription_id:
        return _reject(event_id, event_type, "Missing subscription id in event resource.")

    subscription = (
        Subscription.objects.select_for_update()
        .filter(paypal_subscription_id=subscription_id)
        .first()
    )

    if subscription is None:
        plan_id = resource.get("plan_id")
        plan = Plan.objects.filter(paypal_plan_id=plan_id, active=True).first() if plan_id else None
        if plan is None:
            return _reject(
                event_id, event_type, f"Unknown or inactive PayPal plan id: {plan_id!r}."
            )
        user = actor_user_lookup(resource.get("custom_id"))
        if user is None:
            return _reject(event_id, event_type, "Could not resolve a user for this subscription.")
        subscription = Subscription.objects.create(
            user=user,
            paypal_subscription_id=subscription_id,
            plan_key=plan.plan_key,
        )

    outcome = _apply_event(subscription, event_type, resource)
    BillingEvent.objects.create(
        paypal_event_id=event_id,
        event_type=event_type,
        subscription=subscription,
        outcome=outcome.outcome,
        detail=outcome.detail,
    )
    return outcome


def _apply_event(subscription: Subscription, event_type: str, resource: dict) -> WebhookOutcome:
    if event_type in ("BILLING.SUBSCRIPTION.ACTIVATED", "PAYMENT.SALE.COMPLETED"):
        subscription.status = Subscription.Status.ACTIVE
        paid_through = _parse_date(resource.get("paid_through"))
        if paid_through:
            subscription.paid_through = paid_through
        subscription.save()
        entitlements.set_user_plan(subscription.user, subscription.plan_key)
        detail = (
            "Subscription activated."
            if event_type == "BILLING.SUBSCRIPTION.ACTIVATED"
            else "Renewal payment recorded."
        )
        return WebhookOutcome("applied", detail)

    if event_type == "BILLING.SUBSCRIPTION.CANCELLED":
        subscription.status = Subscription.Status.CANCELLED
        subscription.save()
        # Deliberately no entitlement change: paid access continues
        # through the already-stored paid_through date.
        return WebhookOutcome(
            "applied", "Subscription cancelled; paid access continues through paid_through."
        )

    if event_type == "BILLING.SUBSCRIPTION.SUSPENDED":
        subscription.status = Subscription.Status.SUSPENDED
        subscription.save()
        # A failed payment never extends (or shortens) paid_through, and
        # does not itself downgrade access -- see module docstring.
        return WebhookOutcome("applied", "Subscription suspended; paid_through unchanged.")

    if event_type == "BILLING.SUBSCRIPTION.EXPIRED":
        subscription.status = Subscription.Status.EXPIRED
        subscription.save()
        entitlements.set_user_plan(subscription.user, entitlements.DEFAULT_PLAN)
        return WebhookOutcome("applied", "Subscription expired; downgraded to the default plan.")

    if event_type == "PAYMENT.SALE.REFUNDED":
        rollback_to = _parse_date(resource.get("paid_through"))
        if rollback_to is None:
            return WebhookOutcome("ignored", "Refund event carried no rollback date.")
        if subscription.paid_through is None or rollback_to < subscription.paid_through:
            subscription.paid_through = rollback_to
            subscription.save()
        if subscription.paid_through and subscription.paid_through <= timezone.localdate():
            entitlements.set_user_plan(subscription.user, entitlements.DEFAULT_PLAN)
        return WebhookOutcome("applied", "Refund reversed its paid period.")

    return WebhookOutcome("ignored", f"Unhandled event type: {event_type!r}.")


def _parse_date(value) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None
