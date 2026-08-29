"""The 3D counterpart of `scenes/ai_api.py` (issue #232): create-scene3d,
edit-scene3d, and accept-proposal3d endpoints for the `scene3d` document
family.

Per #208's decision, `scene3d` is a genuinely separate document family --
this module is a parallel set of views, not an extension of `ai_api.py`'s.
The mechanically generic pieces (rate-limit/quota bookkeeping, the
provider-selection/credential machinery, the AIErrorCategory -> HTTP
status mapping, the patch-rejection-reason -> HTTP status mapping) are
schema-agnostic and imported directly from `ai_api.py` rather than
duplicated; only the request/response shapes and the Project3D-specific
persistence (via `SceneVersion3D`, `Action.PROJECT3D_WRITE`) are new.

Same non-negotiable invariants as `ai_api.py`: `AICreateScene3DView`/
`AIEditScene3DView` never create a `SceneVersion3D` or touch
`Project3D.current_version` in any branch -- every response is an unsaved
draft. Only `AIAcceptProposal3DView` writes, reusing
`SceneVersion3DListCreateView.post`'s exact transaction shape (#228).

Separate rate-limit/quota cache buckets from the 2D endpoints
(`operation="create3d"`/`"edit3d"`) -- a user's 3D AI usage is bounded
independently of their 2D AI usage, matching how 2D create and edit
already use separate buckets from each other.
"""

from __future__ import annotations

from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import Max
from django.http import Http404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ai_provider.interface3d import AICreateScene3DRequest, AIEditScene3DRequest
from ai_provider.logging import log_operation_result
from ai_provider.mistral_provider import (
    EMPTY_PATCH_PREFIX,
    INVALID_PATCH_PREFIX,
    PATCH_APPLY_FAILED_PREFIX,
    RESPONSE_TOO_LARGE_PREFIX,
)
from scenes.ai_api import (
    MAX_MODEL_ID_CHARS,
    MAX_PROMPT_CHARS,
    MissingPersonalMistralCredential,
    _current_count,
    _increment_and_check,
    _missing_key_response,
    _provider_for_user,
    _quota_cache_key,
    _rate_limit_cache_key,
    _request_invalid_response,
    _stale_base_response,
    _validate_model_id,
)
from scenes.api import _get_project3d_or_404
from scenes.models import Project3D, SceneVersion3D
from scenes.patch import PatchErrorReason
from scenes.permissions import Action, can
from scenes.serializers import SceneVersion3DSerializer
from scenes.validation3d import validate_scene3d

# Separate buckets from the 2D endpoints -- see module docstring.
RATE_LIMIT_MAX_ATTEMPTS_3D = 5
RATE_LIMIT_WINDOW_SECONDS_3D = 60
EDIT_RATE_LIMIT_MAX_ATTEMPTS_3D = 10
EDIT_RATE_LIMIT_WINDOW_SECONDS_3D = 60
DAILY_QUOTA_MAX_SUCCESSES_3D = 50
EDIT_DAILY_QUOTA_MAX_SUCCESSES_3D = 50
DAILY_QUOTA_RESET_TIMEOUT_SECONDS = 25 * 60 * 60

_ACCEPTABLE_AI_ORIGINS_3D = (SceneVersion3D.Origin.AI_CREATE, SceneVersion3D.Origin.AI_EDIT)

_CATEGORY_TO_RESPONSE = {
    "timeout": (status.HTTP_504_GATEWAY_TIMEOUT, "timeout"),
    "cancelled": (status.HTTP_400_BAD_REQUEST, "cancelled"),
    "quota_exceeded": (status.HTTP_429_TOO_MANY_REQUESTS, "provider_quota_exceeded"),
    "invalid_structured_output": (
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "invalid_structured_output",
    ),
}

_PATCH_REASON_TO_RESPONSE: dict[str, tuple[int, str]] = {
    PatchErrorReason.PROTECTED_FIELD: (status.HTTP_422_UNPROCESSABLE_ENTITY, "protected_field"),
    PatchErrorReason.INVALID_PATH: (status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_patch_path"),
    PatchErrorReason.OVERSIZED: (status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "oversized_patch"),
    PatchErrorReason.MALFORMED: (status.HTTP_422_UNPROCESSABLE_ENTITY, "malformed_patch"),
    PatchErrorReason.UNREFERENCED_ELEMENT: (
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "unreferenced_element",
    ),
}


def _error_response(result) -> Response:
    assert result.error is not None
    if result.error.category.value == "provider_rejection":
        if result.error.message.startswith(RESPONSE_TOO_LARGE_PREFIX):
            http_status, code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "response_too_large"
        else:
            http_status, code = status.HTTP_502_BAD_GATEWAY, "provider_failure"
    else:
        http_status, code = _CATEGORY_TO_RESPONSE[result.error.category.value]
    return Response({"error": code, "detail": result.error.message}, status=http_status)


def _edit_error_response(result) -> Response:
    assert result.error is not None
    message = result.error.message
    if result.error.category.value == "provider_rejection":
        if message.startswith(RESPONSE_TOO_LARGE_PREFIX):
            http_status, code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "response_too_large"
        elif message.startswith(EMPTY_PATCH_PREFIX):
            http_status, code = status.HTTP_422_UNPROCESSABLE_ENTITY, "empty_patch"
        elif message.startswith(INVALID_PATCH_PREFIX):
            reason = message[len(INVALID_PATCH_PREFIX) :].split(" ", 1)[0]
            http_status, code = _PATCH_REASON_TO_RESPONSE.get(
                reason, (status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_patch")
            )
        elif message.startswith(PATCH_APPLY_FAILED_PREFIX):
            http_status, code = status.HTTP_422_UNPROCESSABLE_ENTITY, "patch_apply_failed"
        else:
            http_status, code = status.HTTP_502_BAD_GATEWAY, "provider_failure"
    else:
        http_status, code = _CATEGORY_TO_RESPONSE[result.error.category.value]
    return Response({"error": code, "detail": message}, status=http_status)


def _rate_limited_response_3d() -> Response:
    return Response(
        {
            "error": "rate_limited",
            "detail": (
                f"At most {RATE_LIMIT_MAX_ATTEMPTS_3D} AI create-scene3d requests are allowed "
                f"per {RATE_LIMIT_WINDOW_SECONDS_3D} seconds. Wait and try again."
            ),
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def _quota_exceeded_response_3d() -> Response:
    return Response(
        {
            "error": "quota_exceeded",
            "detail": (
                f"The daily limit of {DAILY_QUOTA_MAX_SUCCESSES_3D} AI-generated 3D scenes "
                "has been reached for this account. Try again tomorrow (UTC)."
            ),
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def _edit_rate_limited_response_3d() -> Response:
    return Response(
        {
            "error": "rate_limited",
            "detail": (
                f"At most {EDIT_RATE_LIMIT_MAX_ATTEMPTS_3D} AI edit-scene3d requests are "
                f"allowed per {EDIT_RATE_LIMIT_WINDOW_SECONDS_3D} seconds. Wait and try again."
            ),
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def _edit_quota_exceeded_response_3d() -> Response:
    return Response(
        {
            "error": "quota_exceeded",
            "detail": (
                f"The daily limit of {EDIT_DAILY_QUOTA_MAX_SUCCESSES_3D} AI-edited 3D scenes "
                "has been reached for this account. Try again tomorrow (UTC)."
            ),
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def _invalid_current_scene3d_response(validation) -> Response:
    detail = "; ".join(f"{e.path}: {e.message}" for e in validation.errors[:5])
    return Response(
        {"error": "current_scene_invalid", "detail": detail or "current_scene failed validation."},
        status=status.HTTP_400_BAD_REQUEST,
    )


class AICreateScene3DRequestSerializer(serializers.Serializer):
    prompt = serializers.CharField(
        max_length=MAX_PROMPT_CHARS, allow_blank=False, trim_whitespace=True
    )
    model = serializers.CharField(
        max_length=MAX_MODEL_ID_CHARS,
        allow_blank=True,
        trim_whitespace=True,
        required=False,
        default="",
    )

    def validate_model(self, value: str) -> str:
        return _validate_model_id(value)


class AIEditScene3DRequestSerializer(serializers.Serializer):
    prompt = serializers.CharField(
        max_length=MAX_PROMPT_CHARS, allow_blank=False, trim_whitespace=True
    )
    current_scene = serializers.JSONField()
    base_version_id = serializers.IntegerField(allow_null=True)
    model = serializers.CharField(
        max_length=MAX_MODEL_ID_CHARS,
        allow_blank=True,
        trim_whitespace=True,
        required=False,
        default="",
    )

    def validate_model(self, value: str) -> str:
        return _validate_model_id(value)


class AICreateScene3DView(APIView):
    """POST /api/projects3d/<public_id>/ai/create-scene/

    The 3D counterpart of `AICreateSceneView`. Owner-only
    (`Action.PROJECT3D_WRITE` -- Project3D has no separate AI-scoped
    action the way Project does; write access is already owner-only).
    Never creates a `SceneVersion3D`; the response is always an unsaved
    draft.
    """

    def post(self, request, public_id):
        project = _get_project3d_or_404(public_id)
        if not can(request.user, Action.PROJECT3D_WRITE, project):
            raise Http404

        input_serializer = AICreateScene3DRequestSerializer(data=request.data)
        if not input_serializer.is_valid():
            return _request_invalid_response(input_serializer.errors)
        prompt = input_serializer.validated_data["prompt"]
        model = input_serializer.validated_data.get("model") or None

        user_id = request.user.id
        if not _increment_and_check(
            _rate_limit_cache_key(user_id, operation="create3d"),
            limit=RATE_LIMIT_MAX_ATTEMPTS_3D,
            window_seconds=RATE_LIMIT_WINDOW_SECONDS_3D,
        ):
            return _rate_limited_response_3d()

        quota_key = _quota_cache_key(user_id, operation="create3d")
        if _current_count(quota_key) >= DAILY_QUOTA_MAX_SUCCESSES_3D:
            return _quota_exceeded_response_3d()

        try:
            provider = _provider_for_user(request.user, model)
        except MissingPersonalMistralCredential:
            return _missing_key_response()
        result = provider.create_scene3d(AICreateScene3DRequest(prompt=prompt))

        log_operation_result(result)

        if not result.success:
            return _error_response(result)

        cache.set(
            quota_key, _current_count(quota_key) + 1, timeout=DAILY_QUOTA_RESET_TIMEOUT_SECONDS
        )

        return Response(
            {
                "draft": True,
                "operation": result.operation.value,
                "scene": result.scene,
                "usage": {
                    "prompt_tokens": result.usage.prompt_tokens,
                    "completion_tokens": result.usage.completion_tokens,
                    "total_tokens": result.usage.total_tokens,
                    "estimated_cost_usd": result.usage.estimated_cost_usd,
                },
            },
            status=status.HTTP_200_OK,
        )


class AIEditScene3DView(APIView):
    """POST /api/projects3d/<public_id>/ai/edit-scene/ -- the 3D
    counterpart of `AIEditSceneView`. Same stale-base detection and
    failure taxonomy, scoped to `Project3D`/`scene3d`."""

    def post(self, request, public_id):
        project = _get_project3d_or_404(public_id)
        if not can(request.user, Action.PROJECT3D_WRITE, project):
            raise Http404

        input_serializer = AIEditScene3DRequestSerializer(data=request.data)
        if not input_serializer.is_valid():
            return _request_invalid_response(input_serializer.errors)
        prompt = input_serializer.validated_data["prompt"]
        current_scene = input_serializer.validated_data["current_scene"]
        base_version_id = input_serializer.validated_data["base_version_id"]
        model = input_serializer.validated_data.get("model") or None

        if not isinstance(current_scene, dict):
            return Response(
                {
                    "error": "current_scene_invalid",
                    "detail": "current_scene must be a JSON object.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        current_scene_validation = validate_scene3d(current_scene)
        if not current_scene_validation.valid:
            return _invalid_current_scene3d_response(current_scene_validation)

        if base_version_id != project.current_version_id:
            return _stale_base_response(project.current_version_id)

        user_id = request.user.id
        if not _increment_and_check(
            _rate_limit_cache_key(user_id, operation="edit3d"),
            limit=EDIT_RATE_LIMIT_MAX_ATTEMPTS_3D,
            window_seconds=EDIT_RATE_LIMIT_WINDOW_SECONDS_3D,
        ):
            return _edit_rate_limited_response_3d()

        edit_quota_key = _quota_cache_key(user_id, operation="edit3d")
        if _current_count(edit_quota_key) >= EDIT_DAILY_QUOTA_MAX_SUCCESSES_3D:
            return _edit_quota_exceeded_response_3d()

        try:
            provider = _provider_for_user(request.user, model)
        except MissingPersonalMistralCredential:
            return _missing_key_response()
        outcome = provider.edit_scene3d_with_patch(
            AIEditScene3DRequest(prompt=prompt, current_scene=current_scene)
        )
        result = outcome.result

        log_operation_result(result)

        if not result.success:
            return _edit_error_response(result)

        cache.set(
            edit_quota_key,
            _current_count(edit_quota_key) + 1,
            timeout=DAILY_QUOTA_RESET_TIMEOUT_SECONDS,
        )

        return Response(
            {
                "draft": True,
                "operation": result.operation.value,
                "patch": outcome.patch,
                "scene": result.scene,
                "change_summary": outcome.change_summary,
                "usage": {
                    "prompt_tokens": result.usage.prompt_tokens,
                    "completion_tokens": result.usage.completion_tokens,
                    "total_tokens": result.usage.total_tokens,
                    "estimated_cost_usd": result.usage.estimated_cost_usd,
                },
            },
            status=status.HTTP_200_OK,
        )


class AIAcceptProposal3DRequestSerializer(serializers.Serializer):
    operation = serializers.ChoiceField(
        choices=[(o.value, o.label) for o in _ACCEPTABLE_AI_ORIGINS_3D]
    )
    scene_json = serializers.JSONField()
    base_version_id = serializers.IntegerField(allow_null=True)
    client_request_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class _StaleBase3D(Exception):
    pass


def _accept_invalid_scene3d_response(result) -> Response:
    return Response(
        {
            "error": "invalid_structured_output",
            "detail": "; ".join(f"{e.path}: {e.message}" for e in result.errors[:5])
            or "scene_json failed validation.",
        },
        status=status.HTTP_422_UNPROCESSABLE_ENTITY,
    )


class AIAcceptProposal3DView(APIView):
    """POST /api/projects3d/<public_id>/ai/accept-proposal/ -- the 3D
    counterpart of `AIAcceptProposalView`. Reuses
    `SceneVersion3DListCreateView.post`'s exact transaction shape (#228):
    lock the project row, compute the next sequence inside that lock,
    create the version, advance `current_version`. Re-validates
    `scene_json` from scratch (never trusts the client), and supports the
    same `client_request_id` idempotency-key deduplication as the 2D
    endpoint.
    """

    def post(self, request, public_id):
        project = _get_project3d_or_404(public_id)
        if not can(request.user, Action.PROJECT3D_WRITE, project):
            raise Http404

        input_serializer = AIAcceptProposal3DRequestSerializer(data=request.data)
        if not input_serializer.is_valid():
            return Response(
                {"error": "request_invalid", "detail": input_serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        operation = input_serializer.validated_data["operation"]
        scene_json = input_serializer.validated_data["scene_json"]
        base_version_id = input_serializer.validated_data["base_version_id"]
        client_request_id = input_serializer.validated_data.get("client_request_id")

        if not isinstance(scene_json, dict):
            return Response(
                {
                    "error": "invalid_structured_output",
                    "detail": "scene_json must be a JSON object.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        validation = validate_scene3d(scene_json)
        if not validation.valid:
            return _accept_invalid_scene3d_response(validation)

        try:
            with transaction.atomic():
                locked_project = Project3D.objects.select_for_update().get(pk=project.pk)

                if client_request_id is not None:
                    existing = locked_project.versions.filter(
                        ai_request_id=client_request_id
                    ).first()
                    if existing is not None:
                        return Response(
                            SceneVersion3DSerializer(existing).data, status=status.HTTP_200_OK
                        )

                if base_version_id != locked_project.current_version_id:
                    raise _StaleBase3D

                next_sequence = (
                    locked_project.versions.aggregate(Max("sequence"))["sequence__max"] or 0
                ) + 1
                version = SceneVersion3D.objects.create(
                    project=locked_project,
                    sequence=next_sequence,
                    scene_json=scene_json,
                    created_by=request.user,
                    origin=operation,
                    ai_request_id=client_request_id,
                )
                locked_project.current_version = version
                locked_project.save(update_fields=["current_version", "updated_at"])
        except _StaleBase3D:
            return _stale_base_response(project.current_version_id)
        except IntegrityError:
            if client_request_id is not None:
                existing = SceneVersion3D.objects.filter(
                    project=project, ai_request_id=client_request_id
                ).first()
                if existing is not None:
                    return Response(
                        SceneVersion3DSerializer(existing).data, status=status.HTTP_200_OK
                    )
            raise
        except Project3D.DoesNotExist as exc:
            raise Http404 from exc

        return Response(SceneVersion3DSerializer(version).data, status=status.HTTP_201_CREATED)


__all__ = [
    "AIAcceptProposal3DView",
    "AICreateScene3DView",
    "AIEditScene3DView",
]
