"""POST /api/ai/runs/, GET/POST /api/ai/runs/<id>/{,advance,cancel,accept}/
(issue #461).

Owner-only throughout: a run is looked up by `pk` scoped to
`owner=request.user`, so a foreign/nonexistent run id is indistinguishable
(404 either way) -- the same "don't confirm hidden data" policy every
other owner-scoped endpoint in this codebase already follows.
`AIRunDetailView.get` never triggers a model call -- it only serializes
whatever `scenes.ai_runs.advance_run` already checkpointed.
"""

from __future__ import annotations

from django.http import Http404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes import ai_runs
from scenes.ai_api import MAX_MODEL_ID_CHARS, MAX_PROMPT_CHARS, _validate_model_id
from scenes.api import _get_project_or_404
from scenes.api3d import _get_project3d_or_404
from scenes.models import AIRun

_ERROR_STATUS = {
    ai_runs.RunNotFound.code: status.HTTP_404_NOT_FOUND,
    ai_runs.QuotaExceeded.code: status.HTTP_429_TOO_MANY_REQUESTS,
    ai_runs.RateLimited.code: status.HTTP_429_TOO_MANY_REQUESTS,
    ai_runs.MissingCredential.code: status.HTTP_400_BAD_REQUEST,
    ai_runs.InvalidTarget.code: status.HTTP_400_BAD_REQUEST,
    ai_runs.NotRunning.code: status.HTTP_409_CONFLICT,
    ai_runs.AdvanceInProgress.code: status.HTTP_409_CONFLICT,
    ai_runs.NotAwaitingReview.code: status.HTTP_409_CONFLICT,
    ai_runs.StaleBase.code: status.HTTP_409_CONFLICT,
}


def _error_response(exc: ai_runs.AIRunError) -> Response:
    return Response(
        {"error": exc.code, "detail": str(exc)},
        status=_ERROR_STATUS.get(exc.code, status.HTTP_400_BAD_REQUEST),
    )


def _serialize_run(run: AIRun) -> dict:
    return {
        "id": run.pk,
        "status": run.status,
        "target_type": run.target_type,
        "project_id": str(run.project.public_id) if run.project is not None else None,
        "project3d_id": str(run.project3d.public_id) if run.project3d is not None else None,
        "operation": run.operation,
        "scope": run.scope,
        "selected_target_ids": run.selected_target_ids,
        "attempts": run.attempts,
        "repairs": run.repairs,
        "candidate_scene": run.candidate_scene_json,
        "candidate_patch": run.candidate_patch,
        "change_summary": run.change_summary,
        "plan_summary": run.plan_summary,
        "validation_summary": run.validation_summary,
        "error_reason": run.error_reason,
        "usage": {
            "prompt_tokens": run.usage_prompt_tokens,
            "completion_tokens": run.usage_completion_tokens,
            "estimated_cost_usd": run.usage_cost_usd,
        },
        "accepted_version_id": run.accepted_version_id,
        "created_at": run.created_at.isoformat(),
        "updated_at": run.updated_at.isoformat(),
        "deadline_at": run.deadline_at.isoformat(),
        "cancelled_at": run.cancelled_at.isoformat() if run.cancelled_at else None,
    }


class AIRunStartRequestSerializer(serializers.Serializer):
    target_type = serializers.ChoiceField(choices=[c.value for c in AIRun.TargetType])
    project_id = serializers.CharField(required=False, allow_blank=True, default="")
    project3d_id = serializers.CharField(required=False, allow_blank=True, default="")
    operation = serializers.ChoiceField(choices=[c.value for c in AIRun.Operation])
    scope = serializers.ChoiceField(
        choices=[c.value for c in AIRun.Scope], required=False, default=AIRun.Scope.WHOLE_SCENE
    )
    selected_target_ids = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    prompt = serializers.CharField(max_length=MAX_PROMPT_CHARS, allow_blank=False)
    vendor = serializers.CharField(required=False, default="mistral")
    model = serializers.CharField(
        max_length=MAX_MODEL_ID_CHARS, required=False, allow_blank=True, default=""
    )
    start_request_id = serializers.UUIDField(required=False, allow_null=True, default=None)

    def validate_model(self, value: str) -> str:
        return _validate_model_id(value)

    def validate(self, data):
        if data["scope"] == AIRun.Scope.SELECTION and not data.get("selected_target_ids"):
            raise serializers.ValidationError(
                "selected_target_ids is required when scope is 'selection'."
            )
        if data["target_type"] == AIRun.TargetType.PROJECT and not data.get("project_id"):
            raise serializers.ValidationError("project_id is required for target_type 'project'.")
        if data["target_type"] == AIRun.TargetType.PROJECT3D and not data.get("project3d_id"):
            raise serializers.ValidationError(
                "project3d_id is required for target_type 'project3d'."
            )
        return data


class AIRunListCreateView(APIView):
    def post(self, request):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        serializer = AIRunStartRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "request_invalid", "detail": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = serializer.validated_data

        if data["target_type"] == AIRun.TargetType.PROJECT:
            target = _get_project_or_404(data["project_id"])
        else:
            target = _get_project3d_or_404(data["project3d_id"])
        if target.owner_id != request.user.id:
            # Same "don't confirm hidden data" policy as every other
            # owner-scoped view: a real-but-foreign target 404s exactly
            # like a nonexistent one.
            raise Http404

        try:
            run = ai_runs.start_run(
                owner=request.user,
                target_type=data["target_type"],
                target=target,
                operation=data["operation"],
                scope=data["scope"],
                selected_target_ids=data["selected_target_ids"],
                prompt=data["prompt"],
                vendor=data["vendor"],
                model_id=data["model"],
                start_request_id=data["start_request_id"],
            )
        except ai_runs.AIRunError as exc:
            return _error_response(exc)

        return Response(_serialize_run(run), status=status.HTTP_201_CREATED)


def _get_owned_run_or_404(request, pk: int) -> AIRun:
    run = (
        AIRun.objects.select_related("project", "project3d")
        .filter(pk=pk, owner=request.user)
        .first()
    )
    if run is None:
        raise Http404
    return run


class AIRunDetailView(APIView):
    def get(self, request, pk: int):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        run = _get_owned_run_or_404(request, pk)
        return Response(_serialize_run(run))


class AIRunAdvanceView(APIView):
    def post(self, request, pk: int):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        run = _get_owned_run_or_404(request, pk)
        try:
            run = ai_runs.advance_run(run)
        except ai_runs.AIRunError as exc:
            return _error_response(exc)
        return Response(_serialize_run(run))


class AIRunCancelView(APIView):
    def post(self, request, pk: int):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        run = _get_owned_run_or_404(request, pk)
        run = ai_runs.cancel_run(run)
        return Response(_serialize_run(run))


class AIRunAcceptView(APIView):
    def post(self, request, pk: int):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        run = _get_owned_run_or_404(request, pk)
        try:
            run, version = ai_runs.accept_run(run)
        except ai_runs.AIRunError as exc:
            return _error_response(exc)
        if version is None:
            return _error_response(
                ai_runs.NotAwaitingReview(run.error_reason or "Run could not be accepted.")
            )
        return Response(_serialize_run(run), status=status.HTTP_200_OK)
