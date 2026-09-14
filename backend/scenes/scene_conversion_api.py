"""POST /api/scene-conversions/, GET/POST /api/scene-conversions/<id>/{,advance,cancel,accept}/
(issue #528).

Mirrors `scenes.ai_runs_api`'s owner-only, 404-on-foreign-target
conventions exactly -- see that module's docstring.
"""

from __future__ import annotations

from django.http import Http404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes import scene_conversion
from scenes.ai_api import MAX_MODEL_ID_CHARS, MAX_PROMPT_CHARS, _validate_model_id
from scenes.api import _get_project_or_404
from scenes.models import Project3D, SceneConversionRun

_ERROR_STATUS = {
    scene_conversion.RunNotFound.code: status.HTTP_404_NOT_FOUND,
    scene_conversion.QuotaExceeded.code: status.HTTP_429_TOO_MANY_REQUESTS,
    scene_conversion.RateLimited.code: status.HTTP_429_TOO_MANY_REQUESTS,
    scene_conversion.MissingCredential.code: status.HTTP_400_BAD_REQUEST,
    scene_conversion.InvalidTarget.code: status.HTTP_400_BAD_REQUEST,
    scene_conversion.AgenticNotSupported.code: status.HTTP_400_BAD_REQUEST,
    scene_conversion.NotRunning.code: status.HTTP_409_CONFLICT,
    scene_conversion.AdvanceInProgress.code: status.HTTP_409_CONFLICT,
    scene_conversion.NotAwaitingReview.code: status.HTTP_409_CONFLICT,
    scene_conversion.StaleBase.code: status.HTTP_409_CONFLICT,
}


def _error_response(exc: scene_conversion.SceneConversionError) -> Response:
    return Response(
        {"error": exc.code, "detail": str(exc)},
        status=_ERROR_STATUS.get(exc.code, status.HTTP_400_BAD_REQUEST),
    )


def _accepted_project3d_public_id(run: SceneConversionRun) -> str | None:
    if run.accepted_project3d_id is None:
        return None
    project3d = Project3D.objects.filter(pk=run.accepted_project3d_id).first()
    return str(project3d.public_id) if project3d is not None else None


def _serialize_run(run: SceneConversionRun) -> dict:
    return {
        "id": run.pk,
        "status": run.status,
        "source_project_id": str(run.source_project.public_id),
        "source_version_id": run.source_version_id,
        "attempts": run.attempts,
        "repairs": run.repairs,
        "candidate_scene": run.candidate_scene_json,
        "unsupported_shape_types": run.unsupported_shape_types,
        "plan_summary": run.plan_summary,
        "validation_summary": run.validation_summary,
        "error_reason": run.error_reason,
        "usage": {
            "prompt_tokens": run.usage_prompt_tokens,
            "completion_tokens": run.usage_completion_tokens,
            "estimated_cost_usd": run.usage_cost_usd,
        },
        "accepted_project3d_id": _accepted_project3d_public_id(run),
        "accepted_version_id": run.accepted_version_id,
        "created_at": run.created_at.isoformat(),
        "updated_at": run.updated_at.isoformat(),
        "deadline_at": run.deadline_at.isoformat(),
        "cancelled_at": run.cancelled_at.isoformat() if run.cancelled_at else None,
    }


class SceneConversionStartRequestSerializer(serializers.Serializer):
    project_id = serializers.CharField()
    prompt = serializers.CharField(
        max_length=MAX_PROMPT_CHARS, required=False, allow_blank=True, default=""
    )
    vendor = serializers.CharField(required=False, default="mistral")
    model = serializers.CharField(
        max_length=MAX_MODEL_ID_CHARS, required=False, allow_blank=True, default=""
    )
    start_request_id = serializers.UUIDField(required=False, allow_null=True, default=None)

    def validate_model(self, value: str) -> str:
        return _validate_model_id(value)


class SceneConversionListCreateView(APIView):
    def post(self, request):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        serializer = SceneConversionStartRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "request_invalid", "detail": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = serializer.validated_data

        # Only ever resolves a `Project` (the 2D document family) -- see
        # scene_conversion.py's module docstring for why an `ArtPiece` (or
        # any other source type) can never reach start_conversion at all.
        source_project = _get_project_or_404(data["project_id"])
        if source_project.owner_id != request.user.id:
            raise Http404

        try:
            run = scene_conversion.start_conversion(
                owner=request.user,
                source_project=source_project,
                prompt=data["prompt"],
                vendor=data["vendor"],
                model_id=data["model"],
                start_request_id=data["start_request_id"],
            )
        except scene_conversion.SceneConversionError as exc:
            return _error_response(exc)

        return Response(_serialize_run(run), status=status.HTTP_201_CREATED)


def _get_owned_run_or_404(request, pk: int) -> SceneConversionRun:
    run = (
        SceneConversionRun.objects.select_related("source_project")
        .filter(pk=pk, owner=request.user)
        .first()
    )
    if run is None:
        raise Http404
    return run


class SceneConversionDetailView(APIView):
    def get(self, request, pk: int):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        run = _get_owned_run_or_404(request, pk)
        return Response(_serialize_run(run))


class SceneConversionAdvanceView(APIView):
    def post(self, request, pk: int):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        run = _get_owned_run_or_404(request, pk)
        try:
            run = scene_conversion.advance_conversion(run)
        except scene_conversion.SceneConversionError as exc:
            return _error_response(exc)
        return Response(_serialize_run(run))


class SceneConversionCancelView(APIView):
    def post(self, request, pk: int):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        run = _get_owned_run_or_404(request, pk)
        run = scene_conversion.cancel_conversion(run)
        return Response(_serialize_run(run))


class SceneConversionAcceptView(APIView):
    def post(self, request, pk: int):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        run = _get_owned_run_or_404(request, pk)
        try:
            run, project3d = scene_conversion.accept_conversion(run)
        except scene_conversion.SceneConversionError as exc:
            return _error_response(exc)
        if project3d is None:
            return _error_response(
                scene_conversion.NotAwaitingReview(run.error_reason or "Run could not be accepted.")
            )
        return Response(_serialize_run(run), status=status.HTTP_200_OK)
