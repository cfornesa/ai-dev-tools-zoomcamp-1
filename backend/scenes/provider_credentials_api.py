"""Vendor-neutral, redacted provider credential metadata and writes."""

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ai_provider.registry import PROVIDERS, get_provider
from scenes.models import MistralCredentialDecryptionError, ProviderCredential


class ProviderCredentialSerializer(serializers.Serializer):
    vendor = serializers.CharField(max_length=32)
    key = serializers.CharField(min_length=10, max_length=500, trim_whitespace=False)

    def validate_vendor(self, value):
        try:
            return get_provider(value).vendor
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate_key(self, value):
        if value != value.strip() or any(char.isspace() for char in value):
            raise serializers.ValidationError("The provider key must not contain whitespace.")
        return value


class ProviderCredentialView(APIView):
    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)
        saved = {c.vendor: c for c in ProviderCredential.objects.filter(owner=request.user)}
        return Response(
            {
                "providers": [
                    {
                        "vendor": definition.vendor,
                        "label": definition.label,
                        "implemented": definition.implemented,
                        "configured": vendor in saved and self._configured(saved[vendor]),
                    }
                    for vendor, definition in PROVIDERS.items()
                ]
            }
        )

    @staticmethod
    def _configured(credential):
        try:
            credential.get_key()
            return True
        except MistralCredentialDecryptionError:
            return False

    def put(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)
        serializer = ProviderCredentialSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vendor = serializer.validated_data["vendor"]
        credential, _ = ProviderCredential.objects.get_or_create(owner=request.user, vendor=vendor)
        credential.set_key(serializer.validated_data["key"])
        credential.save(update_fields=["encrypted_key", "updated_at"])
        return Response({"vendor": vendor, "configured": True}, status=status.HTTP_200_OK)

    def delete(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)
        vendor = request.query_params.get("vendor", "").strip().lower()
        try:
            vendor = get_provider(vendor).vendor
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        ProviderCredential.objects.filter(owner=request.user, vendor=vendor).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
