"""POST/GET/PATCH /api/admin/settings/ and /api/admin/plans/ (issue #422).

Authenticated application-admins only (`scenes.admin_authorization
.is_application_admin`, #421). Anonymous callers get 401; authenticated
non-admins get 403 -- this route's *existence* isn't sensitive (unlike an
owner-scoped resource), so there is no reason to hide it behind a 404 the
way `scenes/api.py`'s per-project endpoints do.
"""

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.admin_authorization import is_application_admin
from scenes.admin_settings import (
    RevisionConflict,
    ValidationFailed,
    get_site_settings,
    list_plans,
    update_plan,
    update_site_settings,
)


def _admin_required_response(request) -> Response | None:
    if not request.user.is_authenticated:
        return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
    if not is_application_admin(request.user):
        return Response(
            {"detail": "Application-admin authorization required."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


class SiteSettingsUpdateSerializer(serializers.Serializer):
    site_title = serializers.CharField(max_length=200, allow_blank=False, trim_whitespace=True)
    revision = serializers.IntegerField(min_value=0)


class AdminSiteSettingsView(APIView):
    def get(self, request):
        denied = _admin_required_response(request)
        if denied:
            return denied
        site_settings = get_site_settings()
        return Response(
            {"site_title": site_settings.site_title, "revision": site_settings.revision}
        )

    def patch(self, request):
        denied = _admin_required_response(request)
        if denied:
            return denied

        unknown_fields = set(request.data.keys()) - {"site_title", "revision"}
        if unknown_fields:
            return Response(
                {"error": "unknown_fields", "detail": sorted(unknown_fields)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = SiteSettingsUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "validation_failed", "detail": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            updated = update_site_settings(
                actor=request.user,
                expected_revision=serializer.validated_data["revision"],
                site_title=serializer.validated_data["site_title"],
            )
        except RevisionConflict as exc:
            return Response(
                {"error": "revision_conflict", "detail": str(exc)}, status=status.HTTP_409_CONFLICT
            )
        except ValidationFailed as exc:
            return Response(
                {"error": "validation_failed", "detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"site_title": updated.site_title, "revision": updated.revision})


class PlanUpdateSerializer(serializers.Serializer):
    daily_ai_requests = serializers.IntegerField(min_value=0)
    feature_keys = serializers.ListField(child=serializers.CharField(), allow_empty=True)
    active = serializers.BooleanField()
    paypal_plan_id = serializers.CharField(
        max_length=64, allow_blank=True, required=False, default=""
    )
    revision = serializers.IntegerField(min_value=0)


class AdminPlansView(APIView):
    """GET lists every plan; PATCH updates one, named by `?plan_key=`."""

    def get(self, request):
        denied = _admin_required_response(request)
        if denied:
            return denied
        return Response(
            [
                {
                    "plan_key": plan.plan_key,
                    "daily_ai_requests": plan.daily_ai_requests,
                    "feature_keys": plan.feature_keys,
                    "active": plan.active,
                    "paypal_plan_id": plan.paypal_plan_id,
                    "revision": plan.revision,
                }
                for plan in list_plans()
            ]
        )

    def patch(self, request):
        denied = _admin_required_response(request)
        if denied:
            return denied

        plan_key = request.query_params.get("plan_key", "")
        if not plan_key:
            return Response(
                {"error": "plan_key_required", "detail": "Provide ?plan_key=<key>."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_fields = {
            "daily_ai_requests",
            "feature_keys",
            "active",
            "paypal_plan_id",
            "revision",
        }
        unknown_fields = set(request.data.keys()) - allowed_fields
        if unknown_fields:
            return Response(
                {"error": "unknown_fields", "detail": sorted(unknown_fields)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = PlanUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "validation_failed", "detail": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            updated = update_plan(
                actor=request.user,
                plan_key=plan_key,
                expected_revision=serializer.validated_data["revision"],
                daily_ai_requests=serializer.validated_data["daily_ai_requests"],
                feature_keys=serializer.validated_data["feature_keys"],
                active=serializer.validated_data["active"],
                paypal_plan_id=serializer.validated_data.get("paypal_plan_id", ""),
            )
        except RevisionConflict as exc:
            return Response(
                {"error": "revision_conflict", "detail": str(exc)}, status=status.HTTP_409_CONFLICT
            )
        except ValidationFailed as exc:
            return Response(
                {"error": "validation_failed", "detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {
                "plan_key": updated.plan_key,
                "daily_ai_requests": updated.daily_ai_requests,
                "feature_keys": updated.feature_keys,
                "active": updated.active,
                "paypal_plan_id": updated.paypal_plan_id,
                "revision": updated.revision,
            }
        )
