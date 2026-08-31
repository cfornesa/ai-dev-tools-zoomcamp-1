"""Owner-scoped CRUD for saved Mistral model slugs and additive AI
Personas (issue #259). Strictly per-user, like `scenes/credentials_api.py`'s
`MistralCredentialView` -- no record is ever visible or deletable by
anyone other than its owner."""

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.models import AIPersona, MistralModelPreference


def _auth_required(request):
    return request.user.is_authenticated


class MistralModelPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = MistralModelPreference
        fields = ["id", "slug", "label", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_slug(self, value):
        if value != value.strip() or not value:
            raise serializers.ValidationError("The model slug must be a non-empty, trimmed value.")
        return value


class AIPersonaSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIPersona
        fields = ["id", "name", "prompt_text", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_name(self, value):
        if value != value.strip() or not value:
            raise serializers.ValidationError(
                "The persona name must be a non-empty, trimmed value."
            )
        return value

    def validate_prompt_text(self, value):
        if not value.strip():
            raise serializers.ValidationError("The persona prompt text must not be empty.")
        return value


class MistralModelPreferenceListCreateView(APIView):
    def get(self, request):
        if not _auth_required(request):
            return Response(
                {"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED
            )
        preferences = MistralModelPreference.objects.filter(owner=request.user)
        return Response(MistralModelPreferenceSerializer(preferences, many=True).data)

    def post(self, request):
        if not _auth_required(request):
            return Response(
                {"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED
            )
        serializer = MistralModelPreferenceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        preference = serializer.save(owner=request.user)
        return Response(
            MistralModelPreferenceSerializer(preference).data, status=status.HTTP_201_CREATED
        )


class MistralModelPreferenceDetailView(APIView):
    def delete(self, request, pk):
        if not _auth_required(request):
            return Response(
                {"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED
            )
        deleted, _ = MistralModelPreference.objects.filter(owner=request.user, pk=pk).delete()
        if not deleted:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AIPersonaListCreateView(APIView):
    def get(self, request):
        if not _auth_required(request):
            return Response(
                {"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED
            )
        personas = AIPersona.objects.filter(owner=request.user)
        return Response(AIPersonaSerializer(personas, many=True).data)

    def post(self, request):
        if not _auth_required(request):
            return Response(
                {"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED
            )
        serializer = AIPersonaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        persona = serializer.save(owner=request.user)
        return Response(AIPersonaSerializer(persona).data, status=status.HTTP_201_CREATED)


class AIPersonaDetailView(APIView):
    def delete(self, request, pk):
        if not _auth_required(request):
            return Response(
                {"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED
            )
        deleted, _ = AIPersona.objects.filter(owner=request.user, pk=pk).delete()
        if not deleted:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)
