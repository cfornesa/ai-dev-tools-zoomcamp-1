"""Deterministic account billing checkout/status tests for issue #440."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from scenes import entitlements
from scenes.models import BillingCheckout, Plan


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(
        username="billing-user", email="billing@example.com", password="password"
    )


@pytest.fixture(autouse=True)
def paid_plan(db, settings):
    settings.PAYPAL_ENABLED = True
    Plan.objects.update_or_create(
        plan_key="free",
        defaults={"daily_ai_requests": 5, "feature_keys": list(entitlements.FEATURE_KEYS)},
    )
    Plan.objects.update_or_create(
        plan_key="paid",
        defaults={
            "daily_ai_requests": 20,
            "feature_keys": list(entitlements.FEATURE_KEYS),
            "paypal_plan_id": "P-FIXTURE-PAID",
        },
    )


@pytest.mark.django_db
def test_billing_requires_authentication(client):
    assert client.get(reverse("account-billing")).status_code == 403
    assert client.post(reverse("account-billing"), {}).status_code == 403


@pytest.mark.django_db
def test_checkout_is_idempotent_and_sends_server_owned_correlation(client, user, monkeypatch):
    client.force_login(user)
    calls = []

    def fake_create(**kwargs):
        calls.append(kwargs)
        return {
            "id": "I-FIXTURE",
            "links": [{"rel": "approve", "href": "https://paypal.test/approve"}],
        }

    monkeypatch.setattr("scenes.billing_api.create_subscription", fake_create)
    payload = {"plan_key": "paid", "idempotency_key": "checkout-1"}
    first = client.post(reverse("account-billing"), payload)
    second = client.post(reverse("account-billing"), payload)
    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json() == second.json()
    assert len(calls) == 1
    assert calls[0]["custom_id"] == str(user.pk)
    assert BillingCheckout.objects.count() == 1


@pytest.mark.django_db
def test_checkout_never_accepts_unavailable_plan(client, user):
    client.force_login(user)
    response = client.post(
        reverse("account-billing"), {"plan_key": "missing", "idempotency_key": "checkout-2"}
    )
    assert response.status_code == 400
