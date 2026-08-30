"""Owner-scoped management of the signed-in user's Mistral credential."""

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.models import MistralCredential, MistralCredentialDecryptionError


class MistralKeySerializer(serializers.Serializer):
    key = serializers.CharField(min_length=10, max_length=500, trim_whitespace=False)

    def validate_key(self, value):
        if value != value.strip() or any(char.isspace() for char in value):
            raise serializers.ValidationError("The Mistral key must not contain whitespace.")
        return value


def _auth_required(request):
    return request.user.is_authenticated


class MistralCredentialView(APIView):
    def get(self, request):
        if not _auth_required(request):
            return Response(
                {"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED
            )
        credential = MistralCredential.objects.filter(user=request.user).first()
        configured = False
        if credential:
            try:
                credential.get_key()
                configured = True
            except MistralCredentialDecryptionError:
                configured = False
        return Response({"configured": configured})

    def put(self, request):
        if not _auth_required(request):
            return Response(
                {"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED
            )
        serializer = MistralKeySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        key = serializer.validated_data["key"]
        credential, _ = MistralCredential.objects.get_or_create(user=request.user)
        credential.set_key(key)
        credential.save(update_fields=["encrypted_key", "updated_at"])
        return Response({"configured": True}, status=status.HTTP_200_OK)

    def delete(self, request):
        if not _auth_required(request):
            return Response(
                {"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED
            )
        MistralCredential.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
