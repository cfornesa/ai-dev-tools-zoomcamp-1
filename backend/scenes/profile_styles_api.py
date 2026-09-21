"""Admin CRUD for the finite public-profile style catalog (#552)."""

from django.db import IntegrityError, transaction
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.admin_authorization import is_application_admin
from scenes.models import ProfileStyle
from scenes.theme import sanitize_presentation, sanitize_theme_config


def _denied(request):
    if not request.user.is_authenticated:
        return Response({"detail": "Authentication required."}, status=401)
    if not is_application_admin(request.user):
        return Response(
            {"detail": "Application-admin authorization required."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _payload(style: ProfileStyle) -> dict:
    return {
        "id": style.pk,
        "key": style.key,
        "label": style.label,
        "description": style.description,
        "tokens": style.tokens,
        "presentation": style.presentation,
        "enabled": style.enabled,
        "revision": style.revision,
    }


class ProfileStyleSerializer(serializers.Serializer):
    key = serializers.SlugField(max_length=48)
    label = serializers.CharField(max_length=80, trim_whitespace=True)
    description = serializers.CharField(max_length=240, allow_blank=True, required=False)
    tokens = serializers.DictField()
    presentation = serializers.DictField(required=False)
    enabled = serializers.BooleanField(required=False, default=True)
    revision = serializers.IntegerField(min_value=1, required=False)

    def validate_tokens(self, value):
        try:
            tokens = sanitize_theme_config(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        if not tokens:
            raise serializers.ValidationError("At least one valid theme token is required.")
        return tokens

    def validate_presentation(self, value):
        try:
            return sanitize_presentation(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc


class AdminProfileStyleListCreateView(APIView):
    def get(self, request):
        denied = _denied(request)
        if denied:
            return denied
        return Response([_payload(style) for style in ProfileStyle.objects.all()])

    def post(self, request):
        denied = _denied(request)
        if denied:
            return denied
        serializer = ProfileStyleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "validation_failed", "detail": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            style = ProfileStyle.objects.create(**serializer.validated_data)
        except IntegrityError:
            return Response(
                {"error": "key_taken", "detail": {"key": ["That style key is already used."]}},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(_payload(style), status=status.HTTP_201_CREATED)


class AdminProfileStyleDetailView(APIView):
    def patch(self, request, style_id):
        denied = _denied(request)
        if denied:
            return denied
        try:
            style = ProfileStyle.objects.get(pk=style_id)
        except ProfileStyle.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        serializer = ProfileStyleSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {"error": "validation_failed", "detail": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            style = ProfileStyle.objects.select_for_update().get(pk=style.pk)
            if style.revision != serializer.validated_data.get("revision", style.revision):
                return Response({"error": "revision_conflict"}, status=status.HTTP_409_CONFLICT)
            for field in ("key", "label", "description", "tokens", "presentation", "enabled"):
                if field in serializer.validated_data:
                    setattr(style, field, serializer.validated_data[field])
            style.revision += 1
            style.save()
        return Response(_payload(style))
