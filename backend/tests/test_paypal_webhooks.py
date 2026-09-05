"""Tests for the PayPal webhook service (issue #424).

No real PayPal server is contacted: every test monkeypatches
`scenes.paypal_adapter.verify_webhook_signature` directly, exactly the
technique `test_google_oauth.py`/`test_github_oauth.py` already use to
replace the one or two points that talk to a provider over HTTP. Uses
one explicit sandbox product/plan mapping (a `Plan` row with
`paypal_plan_id="P-FIXTURE-PAID"`) and deterministic signed-event
fixtures shaped like PayPal's real webhook payloads.
"""

from datetime import date, timedelta

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from scenes import billing, entitlements
from scenes.models import BillingEvent, Plan, Subscription

TODAY = date(2026, 1, 15)
FUTURE = TODAY + timedelta(days=30)
PAST = TODAY - timedelta(days=1)


@pytest.fixture(autouse=True)
def paypal_enabled(settings):
    settings.PAYPAL_ENABLED = True


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
            "paypal_plan_id": "P-FIXTURE-PAID",
        },
    )


@pytest.fixture
def user_a():
    return get_user_model().objects.create_user(username="user_a", password="not-used")


def _event(event_id, event_type, resource):
    return {"id": event_id, "event_type": event_type, "resource": resource}


# --- Route gating ---


@pytest.mark.django_db
def test_webhook_route_404s_while_disabled(client, settings):
    settings.PAYPAL_ENABLED = False
    response = client.post(
        reverse("paypal-webhook"),
        _event("evt-1", "BILLING.SUBSCRIPTION.ACTIVATED", {}),
        content_type="application/json",
    )
    assert response.status_code == 404


# --- Signature verification ---


@pytest.mark.django_db
def test_forged_signature_is_rejected_before_any_mutation(client, user_a, monkeypatch):
    monkeypatch.setattr("scenes.billing.verify_webhook_signature", lambda headers, body: False)

    response = client.post(
        reverse("paypal-webhook"),
        _event(
            "evt-forged",
            "BILLING.SUBSCRIPTION.ACTIVATED",
            {
                "id": "I-FORGED",
                "plan_id": "P-FIXTURE-PAID",
                "custom_id": str(user_a.id),
                "paid_through": str(FUTURE),
            },
        ),
        content_type="application/json",
    )

    assert response.status_code == 403
    assert not Subscription.objects.filter(paypal_subscription_id="I-FORGED").exists()
    assert not BillingEvent.objects.filter(paypal_event_id="evt-forged").exists()


@pytest.mark.django_db
def test_malformed_event_is_rejected(client, monkeypatch):
    monkeypatch.setattr("scenes.billing.verify_webhook_signature", lambda headers, body: True)

    response = client.post(
        reverse("paypal-webhook"),
        {"id": "evt-malformed"},
        content_type="application/json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_unknown_plan_id_is_rejected_before_mutation(client, user_a, monkeypatch):
    monkeypatch.setattr("scenes.billing.verify_webhook_signature", lambda headers, body: True)

    response = client.post(
        reverse("paypal-webhook"),
        _event(
            "evt-unknown-plan",
            "BILLING.SUBSCRIPTION.ACTIVATED",
            {
                "id": "I-UNKNOWN",
                "plan_id": "P-DOES-NOT-EXIST",
                "custom_id": str(user_a.id),
                "paid_through": str(FUTURE),
            },
        ),
        content_type="application/json",
    )

    assert response.status_code == 400
    assert not Subscription.objects.filter(paypal_subscription_id="I-UNKNOWN").exists()
    assert entitlements.get_user_plan_key(user_a) == "free"


# --- Activation, idempotency, and cross-user protection ---


@pytest.mark.django_db
def test_activation_creates_subscription_and_grants_plan(client, user_a, monkeypatch):
    monkeypatch.setattr("scenes.billing.verify_webhook_signature", lambda headers, body: True)

    response = client.post(
        reverse("paypal-webhook"),
        _event(
            "evt-activate-1",
            "BILLING.SUBSCRIPTION.ACTIVATED",
            {
                "id": "I-ACTIVATED",
                "plan_id": "P-FIXTURE-PAID",
                "custom_id": str(user_a.id),
                "paid_through": str(FUTURE),
            },
        ),
        content_type="application/json",
    )

    assert response.status_code == 200
    subscription = Subscription.objects.get(paypal_subscription_id="I-ACTIVATED")
    assert subscription.user_id == user_a.id
    assert subscription.status == Subscription.Status.ACTIVE
    assert subscription.paid_through == FUTURE
    assert entitlements.get_user_plan_key(user_a) == "paid"


@pytest.mark.django_db
def test_duplicate_activation_event_is_idempotent(client, user_a, monkeypatch):
    monkeypatch.setattr("scenes.billing.verify_webhook_signature", lambda headers, body: True)
    event = _event(
        "evt-dup-1",
        "BILLING.SUBSCRIPTION.ACTIVATED",
        {
            "id": "I-DUP",
            "plan_id": "P-FIXTURE-PAID",
            "custom_id": str(user_a.id),
            "paid_through": str(FUTURE),
        },
    )

    first = client.post(reverse("paypal-webhook"), event, content_type="application/json")
    second = client.post(reverse("paypal-webhook"), event, content_type="application/json")

    assert first.status_code == 200
    assert second.status_code == 200
    assert Subscription.objects.filter(paypal_subscription_id="I-DUP").count() == 1
    assert BillingEvent.objects.filter(paypal_event_id="evt-dup-1").count() == 1


@pytest.mark.django_db
def test_later_event_cannot_redirect_subscription_to_a_different_user(client, user_a, monkeypatch):
    """Cross-user protection: only the *first* event's custom_id is ever
    trusted to resolve a user for a given paypal_subscription_id."""
    user_b = get_user_model().objects.create_user(username="user_b", password="not-used")
    monkeypatch.setattr("scenes.billing.verify_webhook_signature", lambda headers, body: True)

    client.post(
        reverse("paypal-webhook"),
        _event(
            "evt-cross-1",
            "BILLING.SUBSCRIPTION.ACTIVATED",
            {
                "id": "I-CROSS",
                "plan_id": "P-FIXTURE-PAID",
                "custom_id": str(user_a.id),
                "paid_through": str(FUTURE),
            },
        ),
        content_type="application/json",
    )
    # A later event for the SAME subscription id claims a different
    # custom_id -- the already-established owner (user_a) must be the
    # one whose entitlements change, never user_b.
    client.post(
        reverse("paypal-webhook"),
        _event(
            "evt-cross-2",
            "PAYMENT.SALE.COMPLETED",
            {
                "id": "I-CROSS",
                "custom_id": str(user_b.id),
                "paid_through": str(FUTURE + timedelta(days=30)),
            },
        ),
        content_type="application/json",
    )

    subscription = Subscription.objects.get(paypal_subscription_id="I-CROSS")
    assert subscription.user_id == user_a.id
    assert entitlements.get_user_plan_key(user_a) == "paid"
    assert entitlements.get_user_plan_key(user_b) == "free"


# --- Cancellation/suspension/expiration/refund policy ---


@pytest.mark.django_db
def test_cancellation_retains_paid_plan_until_paid_through(client, user_a, monkeypatch):
    monkeypatch.setattr("scenes.billing.verify_webhook_signature", lambda headers, body: True)
    client.post(
        reverse("paypal-webhook"),
        _event(
            "evt-cancel-activate",
            "BILLING.SUBSCRIPTION.ACTIVATED",
            {
                "id": "I-CANCEL",
                "plan_id": "P-FIXTURE-PAID",
                "custom_id": str(user_a.id),
                "paid_through": str(FUTURE),
            },
        ),
        content_type="application/json",
    )

    response = client.post(
        reverse("paypal-webhook"),
        _event("evt-cancel", "BILLING.SUBSCRIPTION.CANCELLED", {"id": "I-CANCEL"}),
        content_type="application/json",
    )

    assert response.status_code == 200
    subscription = Subscription.objects.get(paypal_subscription_id="I-CANCEL")
    assert subscription.status == Subscription.Status.CANCELLED
    assert subscription.paid_through == FUTURE
    # No entitlement downgrade yet -- still entitled through paid_through.
    assert entitlements.get_user_plan_key(user_a) == "paid"


@pytest.mark.django_db
def test_failed_payment_suspends_without_extending_or_shortening_paid_through(
    client, user_a, monkeypatch
):
    monkeypatch.setattr("scenes.billing.verify_webhook_signature", lambda headers, body: True)
    client.post(
        reverse("paypal-webhook"),
        _event(
            "evt-suspend-activate",
            "BILLING.SUBSCRIPTION.ACTIVATED",
            {
                "id": "I-SUSPEND",
                "plan_id": "P-FIXTURE-PAID",
                "custom_id": str(user_a.id),
                "paid_through": str(FUTURE),
            },
        ),
        content_type="application/json",
    )

    response = client.post(
        reverse("paypal-webhook"),
        _event("evt-suspend", "BILLING.SUBSCRIPTION.SUSPENDED", {"id": "I-SUSPEND"}),
        content_type="application/json",
    )

    assert response.status_code == 200
    subscription = Subscription.objects.get(paypal_subscription_id="I-SUSPEND")
    assert subscription.status == Subscription.Status.SUSPENDED
    assert subscription.paid_through == FUTURE
    assert entitlements.get_user_plan_key(user_a) == "paid"


@pytest.mark.django_db
def test_expiration_downgrades_to_default_plan(client, user_a, monkeypatch):
    monkeypatch.setattr("scenes.billing.verify_webhook_signature", lambda headers, body: True)
    client.post(
        reverse("paypal-webhook"),
        _event(
            "evt-expire-activate",
            "BILLING.SUBSCRIPTION.ACTIVATED",
            {
                "id": "I-EXPIRE",
                "plan_id": "P-FIXTURE-PAID",
                "custom_id": str(user_a.id),
                "paid_through": str(PAST),
            },
        ),
        content_type="application/json",
    )
    assert entitlements.get_user_plan_key(user_a) == "paid"

    response = client.post(
        reverse("paypal-webhook"),
        _event("evt-expire", "BILLING.SUBSCRIPTION.EXPIRED", {"id": "I-EXPIRE"}),
        content_type="application/json",
    )

    assert response.status_code == 200
    assert entitlements.get_user_plan_key(user_a) == "free"


@pytest.mark.django_db
def test_refund_reverses_only_its_own_period_and_can_only_move_paid_through_earlier(
    client, user_a, monkeypatch
):
    monkeypatch.setattr("scenes.billing.verify_webhook_signature", lambda headers, body: True)
    client.post(
        reverse("paypal-webhook"),
        _event(
            "evt-refund-activate",
            "BILLING.SUBSCRIPTION.ACTIVATED",
            {
                "id": "I-REFUND",
                "plan_id": "P-FIXTURE-PAID",
                "custom_id": str(user_a.id),
                "paid_through": str(FUTURE),
            },
        ),
        content_type="application/json",
    )

    # A refund naming a rollback date in the past immediately ends paid
    # access; naming a date still in the future only shortens the
    # period, without an immediate downgrade.
    response = client.post(
        reverse("paypal-webhook"),
        _event(
            "evt-refund",
            "PAYMENT.SALE.REFUNDED",
            {"id": "I-REFUND", "paid_through": str(PAST)},
        ),
        content_type="application/json",
    )

    assert response.status_code == 200
    subscription = Subscription.objects.get(paypal_subscription_id="I-REFUND")
    assert subscription.paid_through == PAST
    assert entitlements.get_user_plan_key(user_a) == "free"


@pytest.mark.django_db
def test_refund_never_advances_paid_through(client, user_a, monkeypatch):
    monkeypatch.setattr("scenes.billing.verify_webhook_signature", lambda headers, body: True)
    client.post(
        reverse("paypal-webhook"),
        _event(
            "evt-refund2-activate",
            "BILLING.SUBSCRIPTION.ACTIVATED",
            {
                "id": "I-REFUND2",
                "plan_id": "P-FIXTURE-PAID",
                "custom_id": str(user_a.id),
                "paid_through": str(TODAY),
            },
        ),
        content_type="application/json",
    )

    client.post(
        reverse("paypal-webhook"),
        _event(
            "evt-refund2",
            "PAYMENT.SALE.REFUNDED",
            {"id": "I-REFUND2", "paid_through": str(FUTURE)},
        ),
        content_type="application/json",
    )

    subscription = Subscription.objects.get(paypal_subscription_id="I-REFUND2")
    assert subscription.paid_through == TODAY


# --- Direct service-level idempotency/atomicity ---


@pytest.mark.django_db
def test_process_webhook_event_records_audit_trail_without_raw_payload(user_a, monkeypatch):
    monkeypatch.setattr("scenes.billing.verify_webhook_signature", lambda headers, body: True)

    outcome = billing.process_webhook_event(
        event_id="evt-audit",
        event_type="BILLING.SUBSCRIPTION.ACTIVATED",
        resource={
            "id": "I-AUDIT",
            "plan_id": "P-FIXTURE-PAID",
            "custom_id": str(user_a.id),
            "paid_through": str(FUTURE),
        },
        headers={},
        raw_body={"id": "evt-audit"},
        actor_user_lookup=lambda custom_id: get_user_model().objects.filter(pk=custom_id).first(),
    )

    assert outcome.outcome == "applied"
    record = BillingEvent.objects.get(paypal_event_id="evt-audit")
    assert record.outcome == BillingEvent.Outcome.APPLIED
    assert "paid_through" not in record.detail
