"""Owner-scoped management of the signed-in user's configurable AI
auto-retry setting (issue #266). One record per user, like
`scenes/credentials_api.py`'s `MistralCredentialView`."""

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.models import AIRetryPreference


class AIRetryPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIRetryPreference
        fields = ["auto_retry_enabled", "max_retries"]


def _auth_required(request):
    return request.user.is_authenticated


class AIRetryPreferenceView(APIView):
    def get(self, request):
        if not _auth_required(request):
            return Response(
                {"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED
            )
        preference, _ = AIRetryPreference.objects.get_or_create(owner=request.user)
        return Response(AIRetryPreferenceSerializer(preference).data)

    def put(self, request):
        if not _auth_required(request):
            return Response(
                {"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED
            )
        preference, _ = AIRetryPreference.objects.get_or_create(owner=request.user)
        serializer = AIRetryPreferenceSerializer(preference, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
