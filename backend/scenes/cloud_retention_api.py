"""Application-admin APIs for cloud-media retention and bounded purge (#522)."""

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.admin_authorization import is_application_admin
from scenes.cloud_retention import (
    CloudRetentionConfirmationRequired,
    CloudRetentionConflict,
    CloudRetentionValidationFailed,
    get_policy,
    purge_expired,
    update_policy,
)


def _admin_required(request):
    if not request.user.is_authenticated:
        return Response({"detail": "Authentication required."}, status=401)
    if not is_application_admin(request.user):
        return Response(
            {"detail": "Application-admin authorization required."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _payload(policy):
    return {
        "deleted_grace_days": policy.deleted_grace_days,
        "entitlement_grace_days": policy.entitlement_grace_days,
        "disabled_sync_grace_days": policy.disabled_sync_grace_days,
        "revision": policy.revision,
        "updated_at": policy.updated_at,
    }


class RetentionPolicySerializer(serializers.Serializer):
    deleted_grace_days = serializers.IntegerField(min_value=0, max_value=3650)
    entitlement_grace_days = serializers.IntegerField(min_value=0, max_value=3650)
    disabled_sync_grace_days = serializers.IntegerField(min_value=0, max_value=3650)
    revision = serializers.IntegerField(min_value=1)


class AdminCloudRetentionView(APIView):
    def get(self, request):
        denied = _admin_required(request)
        if denied:
            return denied
        return Response(_payload(get_policy()))

    def patch(self, request):
        denied = _admin_required(request)
        if denied:
            return denied
        serializer = RetentionPolicySerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"error": "validation_failed", "detail": serializer.errors}, status=400)
        try:
            values = serializer.validated_data
            policy = update_policy(
                actor=request.user,
                expected_revision=values["revision"],
                deleted_grace_days=values["deleted_grace_days"],
                entitlement_grace_days=values["entitlement_grace_days"],
                disabled_sync_grace_days=values["disabled_sync_grace_days"],
            )
        except CloudRetentionConflict as exc:
            return Response({"error": "revision_conflict", "detail": str(exc)}, status=409)
        except CloudRetentionValidationFailed as exc:
            return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        return Response(_payload(policy))


class AdminCloudRetentionPurgeView(APIView):
    class RequestSerializer(serializers.Serializer):
        confirm_retroactive = serializers.BooleanField(default=False)
        limit = serializers.IntegerField(min_value=1, max_value=100, default=100)

    def post(self, request):
        denied = _admin_required(request)
        if denied:
            return denied
        serializer = self.RequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"error": "validation_failed", "detail": serializer.errors}, status=400)
        try:
            result = purge_expired(actor=request.user, **serializer.validated_data)
        except CloudRetentionConfirmationRequired as exc:
            return Response({"error": "confirmation_required", "detail": str(exc)}, status=409)
        except CloudRetentionConflict as exc:
            return Response({"error": "retention_conflict", "detail": str(exc)}, status=409)
        except CloudRetentionValidationFailed as exc:
            return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        return Response({**result, "policy_revision": get_policy().revision})
