"""POST /api/billing/paypal/webhook/ (issue #424).

Gated closed (404) whenever `PAYPAL_ENABLED` is False, mirroring
`backend.oauth_gates`' pattern for #420's optional GitHub provider.
Server-to-server only: no session/user authentication (PayPal is not a
signed-in browser), no CSRF token (DRF's `APIView.as_view()` already
exempts CSRF for exactly this reason) -- authenticity comes entirely
from `scenes.billing.process_webhook_event`'s signature verification.
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import Http404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.billing import WebhookRejected, process_webhook_event


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
