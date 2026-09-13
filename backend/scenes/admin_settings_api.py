"""POST/GET/PATCH /api/admin/settings/ and /api/admin/plans/ (issue #422).

Authenticated application-admins only (`scenes.admin_authorization
.is_application_admin`, #421). Anonymous callers get 401; authenticated
non-admins get 403 -- this route's *existence* isn't sensitive (unlike an
owner-scoped resource), so there is no reason to hide it behind a 404 the
way `scenes/api.py`'s per-project endpoints do.
"""

from django.db import IntegrityError
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes import ai_catalog, entitlements
from scenes.admin_authorization import is_application_admin
from scenes.admin_settings import (
    RevisionConflict,
    ValidationFailed,
    get_site_settings,
    list_plans,
    update_plan,
    update_site_settings,
)
from scenes.theme import effective_theme


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
    cloud_sync_enabled = serializers.BooleanField(required=False)
    theme_config = serializers.DictField(required=False)


class AdminSiteSettingsView(APIView):
    def get(self, request):
        denied = _admin_required_response(request)
        if denied:
            return denied
        site_settings = get_site_settings()
        return Response(
            {
                "site_title": site_settings.site_title,
                "cloud_sync_enabled": site_settings.cloud_sync_enabled,
                "revision": site_settings.revision,
                "theme_config": site_settings.theme_config,
            }
        )

    def patch(self, request):
        denied = _admin_required_response(request)
        if denied:
            return denied

        unknown_fields = set(request.data.keys()) - {
            "site_title",
            "revision",
            "cloud_sync_enabled",
            "theme_config",
        }
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
                cloud_sync_enabled=serializer.validated_data.get("cloud_sync_enabled"),
                theme_config=serializer.validated_data.get("theme_config"),
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
                "site_title": updated.site_title,
                "cloud_sync_enabled": updated.cloud_sync_enabled,
                "revision": updated.revision,
                "theme_config": updated.theme_config,
            }
        )


class SiteThemeView(APIView):
    """Anonymous-safe effective site theme; invalid data falls back."""

    def get(self, request):
        settings = get_site_settings()
        return Response(effective_theme(settings.theme_config))


class PlanUpdateSerializer(serializers.Serializer):
    daily_ai_requests = serializers.IntegerField(min_value=0)
    cloud_storage_bytes = serializers.IntegerField(min_value=0, required=False, default=52_428_800)
    cloud_storage_files = serializers.IntegerField(min_value=0, required=False, default=100)
    feature_keys = serializers.ListField(child=serializers.CharField(), allow_empty=True)
    active = serializers.BooleanField()
    paypal_plan_id = serializers.CharField(
        max_length=64, allow_blank=True, required=False, default=""
    )
    price = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=0, required=False, allow_null=True
    )
    currency = serializers.CharField(min_length=3, max_length=3, required=False, allow_blank=False)
    interval = serializers.ChoiceField(choices=("day", "week", "month", "year"), required=False)
    revision = serializers.IntegerField(min_value=0)
    role_key = serializers.CharField(max_length=32, allow_blank=True, required=False)


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
                    "cloud_storage_bytes": plan.cloud_storage_bytes,
                    "cloud_storage_files": plan.cloud_storage_files,
                    "feature_keys": plan.feature_keys,
                    "active": plan.active,
                    "paypal_plan_id": plan.paypal_plan_id,
                    "price": plan.price,
                    "currency": plan.currency,
                    "interval": plan.interval,
                    "revision": plan.revision,
                    "role_key": plan.role_key,
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
            "cloud_storage_bytes",
            "cloud_storage_files",
            "feature_keys",
            "active",
            "paypal_plan_id",
            "price",
            "currency",
            "interval",
            "revision",
            "role_key",
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
                cloud_storage_bytes=serializer.validated_data["cloud_storage_bytes"],
                cloud_storage_files=serializer.validated_data["cloud_storage_files"],
                feature_keys=serializer.validated_data["feature_keys"],
                active=serializer.validated_data["active"],
                paypal_plan_id=serializer.validated_data.get("paypal_plan_id", ""),
                price=serializer.validated_data.get("price"),
                currency=serializer.validated_data.get("currency"),
                interval=serializer.validated_data.get("interval"),
                role_key=serializer.validated_data.get("role_key")
                if "role_key" in serializer.validated_data
                else None,
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
                "cloud_storage_bytes": updated.cloud_storage_bytes,
                "cloud_storage_files": updated.cloud_storage_files,
                "feature_keys": updated.feature_keys,
                "active": updated.active,
                "paypal_plan_id": updated.paypal_plan_id,
                "price": updated.price,
                "currency": updated.currency,
                "interval": updated.interval,
                "revision": updated.revision,
                "role_key": updated.role_key,
            }
        )


class RoleSerializer(serializers.Serializer):
    role_key = serializers.CharField(max_length=32)
    label = serializers.CharField(max_length=100)
    description = serializers.CharField(max_length=500, allow_blank=True)
    capabilities = serializers.DictField()
    active = serializers.BooleanField(required=False, default=True)
    revision = serializers.IntegerField(min_value=0, required=False)


def _role_payload(role):
    return {
        "role_key": role.role_key,
        "label": role.label,
        "description": role.description,
        "capabilities": role.capabilities,
        "active": role.active,
        "revision": role.revision,
        "plan_keys": list(role.plans.order_by("plan_key").values_list("plan_key", flat=True)),
    }


class AdminRolesView(APIView):
    def get(self, request):
        denied = _admin_required_response(request)
        if denied:
            return denied
        return Response([_role_payload(role) for role in entitlements.list_roles()])

    def post(self, request):
        denied = _admin_required_response(request)
        if denied:
            return denied
        serializer = RoleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"error": "validation_failed", "detail": serializer.errors}, status=400)
        values = dict(serializer.validated_data)
        values.pop("active", None)
        values.pop("revision", None)
        try:
            role = entitlements.create_role(actor=request.user, **values)
        except IntegrityError:
            return Response({"error": "role_exists"}, status=409)
        except ValueError as exc:
            return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        return Response(_role_payload(role), status=status.HTTP_201_CREATED)


class AdminRoleDetailView(APIView):
    def patch(self, request, role_key):
        denied = _admin_required_response(request)
        if denied:
            return denied
        serializer = RoleSerializer(data={**request.data, "role_key": role_key})
        if not serializer.is_valid() or "revision" not in serializer.validated_data:
            return Response(
                {"error": "validation_failed", "detail": serializer.errors or "revision required"},
                status=400,
            )
        try:
            values = dict(serializer.validated_data)
            expected_revision = values.pop("revision")
            role = entitlements.update_role(
                actor=request.user, expected_revision=expected_revision, **values
            )
        except ValueError as exc:
            return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        return Response(_role_payload(role))


def _ai_model_payload(view: ai_catalog.AIProviderModelView) -> dict:
    return {
        "id": view.id,
        "vendor": view.vendor,
        "model_slug": view.model_slug,
        "display_label": view.display_label,
        "task_kinds": view.task_kinds,
        "agentic_supported": view.agentic_supported,
        "active": view.active,
        "revision": view.revision,
    }


class AIProviderModelCreateSerializer(serializers.Serializer):
    vendor = serializers.CharField(max_length=32)
    model_slug = serializers.CharField(max_length=200)
    display_label = serializers.CharField(max_length=200)
    task_kinds = serializers.ListField(child=serializers.CharField(), allow_empty=False)
    agentic_supported = serializers.BooleanField(required=False, default=False)


class AIProviderModelUpdateSerializer(serializers.Serializer):
    revision = serializers.IntegerField(min_value=0)
    display_label = serializers.CharField(max_length=200, required=False)
    task_kinds = serializers.ListField(
        child=serializers.CharField(), allow_empty=False, required=False
    )
    agentic_supported = serializers.BooleanField(required=False)
    active = serializers.BooleanField(required=False)


class AdminAIModelsView(APIView):
    """GET lists every catalog entry (including inactive, for admin
    management); POST creates one."""

    def get(self, request):
        denied = _admin_required_response(request)
        if denied:
            return denied
        return Response([_ai_model_payload(row) for row in ai_catalog.list_models()])

    def post(self, request):
        denied = _admin_required_response(request)
        if denied:
            return denied
        allowed_fields = {
            "vendor",
            "model_slug",
            "display_label",
            "task_kinds",
            "agentic_supported",
        }
        unknown_fields = set(request.data.keys()) - allowed_fields
        if unknown_fields:
            return Response(
                {"error": "unknown_fields", "detail": sorted(unknown_fields)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = AIProviderModelCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "validation_failed", "detail": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            created = ai_catalog.create_model(actor=request.user, **serializer.validated_data)
        except ai_catalog.ValidationFailed as exc:
            return Response(
                {"error": "validation_failed", "detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(_ai_model_payload(created), status=status.HTTP_201_CREATED)


class AdminAIModelDetailView(APIView):
    """PATCH edits/deactivates/reactivates one catalog entry named by
    `<model_id>`; DELETE permanently removes it. Both are revision-checked."""

    def patch(self, request, model_id):
        denied = _admin_required_response(request)
        if denied:
            return denied
        allowed_fields = {
            "revision",
            "display_label",
            "task_kinds",
            "agentic_supported",
            "active",
        }
        unknown_fields = set(request.data.keys()) - allowed_fields
        if unknown_fields:
            return Response(
                {"error": "unknown_fields", "detail": sorted(unknown_fields)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = AIProviderModelUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "validation_failed", "detail": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        values = dict(serializer.validated_data)
        expected_revision = values.pop("revision")
        try:
            updated = ai_catalog.update_model(
                actor=request.user,
                model_id=model_id,
                expected_revision=expected_revision,
                **values,
            )
        except ai_catalog.NotFound:
            return Response({"error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        except ai_catalog.RevisionConflict as exc:
            return Response(
                {"error": "revision_conflict", "detail": str(exc)}, status=status.HTTP_409_CONFLICT
            )
        except ai_catalog.ValidationFailed as exc:
            return Response(
                {"error": "validation_failed", "detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(_ai_model_payload(updated))

    def delete(self, request, model_id):
        denied = _admin_required_response(request)
        if denied:
            return denied
        try:
            expected_revision = int(request.data.get("revision"))
        except (TypeError, ValueError):
            return Response(
                {"error": "validation_failed", "detail": "revision is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            ai_catalog.delete_model(model_id=model_id, expected_revision=expected_revision)
        except ai_catalog.NotFound:
            return Response({"error": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        except ai_catalog.RevisionConflict as exc:
            return Response(
                {"error": "revision_conflict", "detail": str(exc)}, status=status.HTTP_409_CONFLICT
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminGlobalCapabilitiesView(APIView):
    def get(self, request):
        denied = _admin_required_response(request)
        if denied:
            return denied
        rows = {
            row.capability_key: {"enabled": row.enabled, "revision": row.revision}
            for row in entitlements.GlobalCapabilitySetting.objects.order_by("capability_key")
        }
        return Response(
            {
                key: rows.get(key, {"enabled": True, "revision": 1})
                for key in sorted(entitlements.CAPABILITY_KEYS)
            }
        )

    def patch(self, request):
        denied = _admin_required_response(request)
        if denied:
            return denied
        key = request.data.get("capability_key")
        try:
            setting = entitlements.set_global_capability(
                actor=request.user,
                capability_key=key,
                enabled=request.data["enabled"],
                expected_revision=request.data["revision"],
            )
        except (KeyError, ValueError) as exc:
            return Response({"error": "validation_failed", "detail": str(exc)}, status=400)
        return Response(
            {
                "capability_key": setting.capability_key,
                "enabled": setting.enabled,
                "revision": setting.revision,
            }
        )
