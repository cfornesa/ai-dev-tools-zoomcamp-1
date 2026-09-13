"""POST /api/billing/paypal/webhook/ (issue #424).

Gated closed (404) whenever `PAYPAL_ENABLED` is False, mirroring
`backend.oauth_gates`' pattern for #420's optional GitHub provider.
Server-to-server only: no session/user authentication (PayPal is not a
signed-in browser), no CSRF token (DRF's `APIView.as_view()` already
exempts CSRF for exactly this reason) -- authenticity comes entirely
from `scenes.billing.process_webhook_event`'s signature verification.
"""

from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.http import Http404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.billing import WebhookRejected, process_webhook_event
from scenes.models import BillingCheckout, Plan, Subscription
from scenes.paypal_adapter import create_subscription


def _format_price(value) -> str:
    return f"{Decimal(str(value)):.2f}"


def _lookup_user_by_custom_id(custom_id):
    """`custom_id` is the Django user id a real checkout flow (#440) sets
    when creating the PayPal subscription. Never trusted again after the
    subscription's first webhook event -- see `process_webhook_event`'s
    own docstring on why that makes a cross-user event impossible."""
    if not custom_id:
        return None
    try:
        return get_user_model().objects.filter(pk=int(custom_id)).first()
    except (TypeError, ValueError):
        return None


def _billing_frontend_url(request):
    """Return to the styled SPA route after PayPal approval or cancellation."""
    return request.build_absolute_uri("/account/billing")


class PayPalWebhookView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def post(self, request):
        if not settings.PAYPAL_ENABLED:
            raise Http404("PayPal billing is not configured.")

        body = request.data
        if not isinstance(body, dict):
            return Response({"error": "malformed_event"}, status=status.HTTP_400_BAD_REQUEST)
        event_id = body.get("id")
        event_type = body.get("event_type")
        resource = body.get("resource")
        if not event_id or not event_type or not isinstance(resource, dict):
            return Response({"error": "malformed_event"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            outcome = process_webhook_event(
                event_id=event_id,
                event_type=event_type,
                resource=resource,
                headers=request.headers,
                raw_body=body,
                actor_user_lookup=_lookup_user_by_custom_id,
            )
        except WebhookRejected:
            return Response(
                {"error": "signature_verification_failed"}, status=status.HTTP_403_FORBIDDEN
            )

        if outcome.outcome == "rejected":
            return Response(
                {"error": "event_rejected", "detail": outcome.detail},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"outcome": outcome.outcome}, status=status.HTTP_200_OK)


class AccountBillingView(APIView):
    """Authenticated checkout/status surface for issue #440."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        subscription = (
            Subscription.objects.filter(user=request.user).order_by("-updated_at").first()
        )
        plan_key = subscription.plan_key if subscription else "free"
        plan = Plan.objects.filter(plan_key=plan_key, active=True).first()
        available_plan = (
            Plan.objects.filter(plan_key="paid", active=True).first()
            if plan_key != "paid"
            else None
        )
        return Response(
            {
                "plan_key": plan_key,
                "plan": {
                    "price": _format_price(plan.price) if plan else None,
                    "currency": plan.currency if plan else "USD",
                    "interval": plan.billing_interval if plan else "month",
                },
                "subscription": {
                    "status": subscription.status if subscription else None,
                    "paid_through": subscription.paid_through if subscription else None,
                },
                "available_plan": {
                    "plan_key": available_plan.plan_key,
                    "paypal_configured": bool(available_plan.paypal_plan_id),
                    "price": _format_price(available_plan.price),
                    "currency": available_plan.currency,
                    "interval": available_plan.billing_interval,
                }
                if available_plan
                else None,
            }
        )

    def post(self, request):
        if not settings.PAYPAL_ENABLED:
            raise Http404("PayPal billing is not configured.")
        plan_key = request.data.get("plan_key")
        idempotency_key = str(request.data.get("idempotency_key", "")).strip()
        if not isinstance(plan_key, str) or not idempotency_key or len(idempotency_key) > 128:
            return Response(
                {"error": "invalid_checkout_request"}, status=status.HTTP_400_BAD_REQUEST
            )
        plan = Plan.objects.filter(plan_key=plan_key, active=True).first()
        if plan is None or not plan.paypal_plan_id:
            return Response({"error": "plan_unavailable"}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            try:
                with transaction.atomic():
                    checkout = BillingCheckout.objects.create(
                        user=request.user, idempotency_key=idempotency_key, plan_key=plan.plan_key
                    )
            except IntegrityError:
                checkout = BillingCheckout.objects.get(
                    user=request.user, idempotency_key=idempotency_key
                )
                if checkout.plan_key != plan.plan_key:
                    return Response(
                        {"error": "idempotency_key_conflict"}, status=status.HTTP_409_CONFLICT
                    )
                return Response(
                    {"checkout_id": checkout.pk, "approval_url": checkout.approval_url},
                    status=status.HTTP_200_OK,
                )
            try:
                payload = create_subscription(
                    plan_id=plan.paypal_plan_id,
                    custom_id=str(request.user.pk),
                    request_id=idempotency_key,
                    return_url=_billing_frontend_url(request),
                    cancel_url=_billing_frontend_url(request),
                )
            except Exception:
                checkout.delete()
                return Response({"error": "paypal_unavailable"}, status=status.HTTP_502_BAD_GATEWAY)
            approval_url = next(
                (
                    link.get("href")
                    for link in payload.get("links", [])
                    if link.get("rel") == "approve"
                ),
                "",
            )
            provider_id = payload.get("id", "")
            if not approval_url or not provider_id:
                checkout.delete()
                return Response(
                    {"error": "paypal_invalid_response"}, status=status.HTTP_502_BAD_GATEWAY
                )
            checkout.paypal_subscription_id = provider_id
            checkout.approval_url = approval_url
            checkout.save(update_fields=["paypal_subscription_id", "approval_url"])
        return Response(
            {"checkout_id": checkout.pk, "approval_url": approval_url},
            status=status.HTTP_201_CREATED,
        )
