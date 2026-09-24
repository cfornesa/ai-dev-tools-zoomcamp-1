"""Bounded owner-scoped find/replace refinement for generated art pieces."""

from __future__ import annotations

import re
from typing import Any

from django.db import transaction
from django.http import Http404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from scenes.art_piece_api import (
    RATE_LIMIT_WINDOW_SECONDS,
    _current_count,
    _generation_rate_limit,
    _increment_and_check,
    _increment_quota,
    _provider_for_user,
    _quota_cache_key,
    _rate_limit_cache_key,
)
from scenes.art_piece_persistence import _piece_or_404, regenerate_thumbnail
from scenes.art_piece_validation import validate_art_piece_source
from scenes.entitlements import get_effective_cap, is_unlimited
from scenes.ink_document import metadata_with_inherited_ink
from scenes.models import AIRetryPreference, ArtPiece, ArtPieceRefineRun, ArtPieceVersion
from scenes.permissions import Action, can

MAX_TARGET_REFERENCES = 32
MAX_RETRIES = 2


class ArtPieceRefineRequestSerializer(serializers.Serializer):
    instruction = serializers.CharField(max_length=4000, allow_blank=False, trim_whitespace=True)
    target_references = serializers.ListField(
        child=serializers.CharField(max_length=200), required=False, default=list
    )
    model = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")

    def validate_target_references(self, value):
        if len(value) > MAX_TARGET_REFERENCES:
            raise serializers.ValidationError("Too many target references.")
        return value


def _plan(piece: ArtPiece, references: list[str]) -> dict[str, Any]:
    return {
        "revision": 1,
        "steps": [{"id": "step-1", "action": "refine_art_piece", "target_ids": references}],
        "target_ids": references,
        "success_criteria": [{"type": "edits_apply_once", "parameters": {"engine": piece.engine}}],
    }


def _apply_edits(source: str, edits: Any) -> str:
    if not isinstance(edits, list) or not edits:
        raise ValueError("Provider must return at least one edit.")
    updated = source
    for edit in edits:
        if (
            not isinstance(edit, dict)
            or not isinstance(edit.get("search"), str)
            or not isinstance(edit.get("replace"), str)
        ):
            raise ValueError("Every edit requires string search and replace fields.")
        search = edit["search"]
        if not search.strip():
            raise ValueError("Edit search must not be blank.")
        if updated.count(search) == 1:
            updated = updated.replace(search, edit["replace"], 1)
            continue
        tokens = [token for token in re.split(r"\s+", search.strip()) if token]
        pattern = r"\s+".join(re.escape(token) for token in tokens)
        matches = list(re.finditer(pattern, updated))
        if len(matches) != 1:
            raise ValueError(f"Edit search must match exactly once: {search[:120]!r}.")
        match = matches[0]
        updated = updated[: match.start()] + edit["replace"] + updated[match.end() :]
    return updated


def _serialize(run: ArtPieceRefineRun) -> dict[str, Any]:
    return {
        "id": run.pk,
        "piece_id": str(run.piece.public_id),
        "status": run.status,
        "plan": run.plan,
        "instruction": run.instruction,
        "target_references": run.target_references,
        "auto_retry_enabled": run.auto_retry_enabled,
        "max_retries": run.max_retries,
        "attempts": run.attempts,
        "repairs": run.repairs,
        "edits": run.edits,
        "attempt_results": run.attempt_results,
        "candidate_source": run.candidate_source,
        "accepted_version_id": run.accepted_version_id,
        "validation_summary": run.validation_summary,
        "error_reason": run.error_reason,
        "usage": {
            "prompt_tokens": run.usage_prompt_tokens,
            "completion_tokens": run.usage_completion_tokens,
            "estimated_cost_usd": run.usage_cost_usd,
        },
        "created_at": run.created_at.isoformat(),
        "updated_at": run.updated_at.isoformat(),
    }


def _record_quota_or_fail(run: ArtPieceRefineRun, owner) -> bool:
    key = _quota_cache_key(owner.id)
    cap = get_effective_cap(owner, "ai_art_generate")
    if not is_unlimited(owner) and _current_count(key) >= cap:
        run.status = ArtPieceRefineRun.Status.FAILED
        run.error_reason = "quota_exceeded"
        run.validation_summary = "The art-piece refinement quota was exhausted."
        run.save(update_fields=["status", "error_reason", "validation_summary"])
        return False
    _increment_quota(key, timeout=60 * 60 * 26)
    run.charged = True
    run.save(update_fields=["charged"])
    return True


def refine_art_piece(
    *, owner, piece: ArtPiece, instruction: str, target_references: list[str], model: str = ""
):
    source_version = piece.current_version
    if source_version is None:
        raise serializers.ValidationError("The piece has no current version.")
    preference = AIRetryPreference.objects.filter(owner=owner).first()
    auto_retry = preference.auto_retry_enabled if preference else False
    max_retries = min(preference.max_retries if preference else 0, MAX_RETRIES)
    run = ArtPieceRefineRun.objects.create(
        piece=piece,
        owner=owner,
        instruction=instruction,
        target_references=target_references,
        plan=_plan(piece, target_references),
        auto_retry_enabled=auto_retry,
        max_retries=max_retries,
    )
    source = source_version.source
    feedback = ""
    for attempt in range(1, max_retries + 2):
        if not _increment_and_check(
            _rate_limit_cache_key(owner.id),
            limit=_generation_rate_limit(),
            window_seconds=RATE_LIMIT_WINDOW_SECONDS,
        ):
            run.status = ArtPieceRefineRun.Status.FAILED
            run.error_reason = "rate_limited"
            run.save(update_fields=["status", "error_reason"])
            break
        if not _record_quota_or_fail(run, owner):
            break
        run.attempts = attempt
        run.save(update_fields=["attempts"])
        prompt = instruction
        if feedback:
            prompt += f" Repair feedback from the previous attempt: {feedback}"
        try:
            provider = _provider_for_user(owner, model or None)
            result = provider.refine(prompt, source, piece.engine, target_references)
        except Exception as exc:
            result = None
            feedback = str(exc)
        if result is not None:
            run.usage_prompt_tokens += result.usage.prompt_tokens
            run.usage_completion_tokens += result.usage.completion_tokens
            run.usage_cost_usd += result.usage.estimated_cost_usd
            if result.error is None:
                run.edits = result.edits or []
                try:
                    candidate = _apply_edits(source, result.edits)
                    candidate = validate_art_piece_source(piece.engine, candidate)
                except (ValueError, serializers.ValidationError) as exc:
                    feedback = str(exc)
                else:
                    with transaction.atomic():
                        locked_piece = ArtPiece.objects.select_for_update().get(pk=piece.pk)
                        if locked_piece.current_version_id != source_version.pk:
                            feedback = (
                                "The stored current version changed; retry from the new source."
                            )
                        else:
                            next_sequence = (
                                locked_piece.versions.order_by("-sequence")
                                .values_list("sequence", flat=True)
                                .first()
                                or 0
                            ) + 1
                            version = ArtPieceVersion.objects.create(
                                piece=locked_piece,
                                sequence=next_sequence,
                                source=candidate,
                                capabilities=source_version.capabilities,
                                generation_metadata=metadata_with_inherited_ink(
                                    source_version.generation_metadata,
                                    {"refine_run_id": run.pk},
                                ),
                            )
                            locked_piece.current_version = version
                            locked_piece.save(update_fields=["current_version", "updated_at"])
                            regenerate_thumbnail(version)
                            run.candidate_source = candidate
                            run.accepted_version = version
                            run.status = ArtPieceRefineRun.Status.ACCEPTED
                            run.save()
                            return run
            else:
                feedback = result.error
        run.validation_summary = feedback
        run.attempt_results = [
            *run.attempt_results,
            {"attempt": attempt, "passed": False, "feedback": feedback},
        ]
        run.repairs += 1 if attempt <= max_retries else 0
        run.save()
    if run.status == ArtPieceRefineRun.Status.RUNNING:
        run.status = ArtPieceRefineRun.Status.FAILED
        run.error_reason = "refine_failed"
        run.save(update_fields=["status", "error_reason"])
    return run


class ArtPieceRefineView(APIView):
    def post(self, request, public_id):
        piece = _piece_or_404(public_id)
        if not can(request.user, Action.ART_PIECE_WRITE, piece):
            raise Http404
        serializer = ArtPieceRefineRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        run = refine_art_piece(
            owner=request.user,
            piece=piece,
            instruction=serializer.validated_data["instruction"],
            target_references=serializer.validated_data["target_references"],
            model=serializer.validated_data["model"],
        )
        return Response(_serialize(run), status=status.HTTP_200_OK)


class ArtPieceRefineDetailView(APIView):
    def get(self, request, pk):
        try:
            run = ArtPieceRefineRun.objects.select_related("piece", "accepted_version").get(
                pk=pk, owner=request.user
            )
        except ArtPieceRefineRun.DoesNotExist as exc:
            raise Http404 from exc
        return Response(_serialize(run))
