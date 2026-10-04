"""Application-admin APIs for unpublish retention and bounded purge (#944)."""

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.admin_authorization import is_application_admin
from scenes.models import ArtPiece, Project, Project3D, UnpublishRetentionPolicy
from scenes.unpublish_retention import (
    UnpublishRetentionConfirmationRequired,
    UnpublishRetentionConflict,
    UnpublishRetentionValidationFailed,
    get_policy,
    purge_eligible_at,
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
        "unpublished_grace_days": policy.unpublished_grace_days,
        "revision": policy.revision,
        "updated_at": policy.updated_at,
    }


class UnpublishRetentionPolicySerializer(serializers.Serializer):
    unpublished_grace_days = serializers.IntegerField(min_value=0, max_value=3650)
    revision = serializers.IntegerField(min_value=1)


class AdminUnpublishRetentionView(APIView):
    def get(self, request):
        denied = _admin_required(request)
        if denied:
            return denied
        return Response(_payload(get_policy()))

    def patch(self, request):
        denied = _admin_required(request)
        if denied:
            return denied
        serializer = UnpublishRetentionPolicySerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"error": "validation_failed", "detail": serializer.errors}, status=400)
        try:
            values = serializer.validated_data
            policy = update_policy(
                actor=request.user,
                expected_revision=values["revision"],
                unpublished_grace_days=values["unpublished_grace_days"],
            )
        except UnpublishRetentionConflict as exc:
            return Response({"error": "revision_conflict", "detail": str(exc)}, status=409)
        except UnpublishRetentionValidationFailed as exc:
            return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        return Response(_payload(policy))


class AdminUnpublishRetentionPurgeView(APIView):
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
        except UnpublishRetentionConfirmationRequired as exc:
            return Response({"error": "confirmation_required", "detail": str(exc)}, status=409)
        except UnpublishRetentionConflict as exc:
            return Response({"error": "retention_conflict", "detail": str(exc)}, status=409)
        except UnpublishRetentionValidationFailed as exc:
            return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        return Response({**result, "policy_revision": get_policy().revision})


def _editor_url(piece) -> str | None:
    handle = getattr(getattr(piece.owner, "public_profile", None), "handle", None)
    if not handle or not piece.public_slug:
        return None
    return f"/users/@{handle}/edit/{piece.public_slug}"


class MyUnpublishedPiecesView(APIView):
    """Issue #944: the owner-facing "Retained unpublished pieces" list —
    everything the current user unpublished that's still inside the
    retention window (or, if already past it, not yet purged), across all
    three piece kinds. Restoring is simply republishing through each kind's
    existing publish control; this view only surfaces what's retained and
    when it becomes purge-eligible."""

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)
        policy = UnpublishRetentionPolicy.get_solo()
        rows = []
        for kind, model in (
            ("project", Project),
            ("project3d", Project3D),
            ("art_piece", ArtPiece),
        ):
            pieces = model.objects.filter(owner=request.user, unpublished_at__isnull=False)
            for piece in pieces:
                rows.append(
                    {
                        "kind": kind,
                        "public_id": str(piece.public_id),
                        "title": piece.title,
                        "unpublished_at": piece.unpublished_at,
                        "purge_eligible_at": purge_eligible_at(piece.unpublished_at, policy),
                        "editor_url": _editor_url(piece),
                    }
                )
        rows.sort(key=lambda row: row["unpublished_at"])
        return Response({"pieces": rows, "unpublished_grace_days": policy.unpublished_grace_days})
