"""Issue #461: a persistent, bounded, owner-scoped plan-validate-revise
AI run -- start/detail/advance/cancel/accept.

Reuses every existing foundation rather than reinventing it: provider
selection and credentials (`scenes.ai_api.get_ai_provider`/
`_provider_for_user`), the provider adapters themselves
(`ai_provider.interface`/`interface3d`), scene/patch validation
(`scenes.validation`/`validation3d`, and `edit_scene_with_patch`'s own
internal patch application+validation), entitlement caps
(`scenes.entitlements.get_effective_cap`), the same rate-limit/quota
cache-key/counter helpers `ai_api.py` already uses, and the exact
`AIAcceptProposalView` transaction shape for turning an accepted run into
a real `SceneVersion`/`SceneVersion3D`.

No new agent framework, queue, or background worker: each `advance_run`
call performs at most one provider call and returns -- the caller (a
route consumer, out of this issue's scope; see #462/#463) is responsible
for calling `advance` again until the run reaches a terminal-for-review
state. A provider call is never made while a database transaction is
open; the advance lease (`AIRun.advance_lease_token`) is what makes two
concurrent `advance` calls on the same run safe without holding a lock
for the call's whole duration.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from ai_provider.interface import (
    AICreateSceneRequest,
    AIEditSceneRequest,
    AIErrorCategory,
    AIOperationResult,
)
from ai_provider.interface3d import AICreateScene3DRequest, AIEditScene3DRequest
from scenes.ai_api import (
    DAILY_QUOTA_RESET_TIMEOUT_SECONDS,
    MissingPersonalMistralCredential,
    UnsupportedProvider,
    _current_count,
    _increment_and_check,
    _increment_quota,
    _provider_for_user,
    _quota_cache_key,
    _rate_limit_cache_key,
)
from scenes.entitlements import get_effective_cap
from scenes.models import (
    AI_RUN_ADVANCE_LEASE_SECONDS,
    AI_RUN_MAX_PROVIDER_ATTEMPTS,
    AI_RUN_MAX_REPAIR_ATTEMPTS,
    AIRun,
    Project,
    Project3D,
    SceneVersion,
    SceneVersion3D,
)
from scenes.validation import SceneValidationResult, validate_scene
from scenes.validation3d import Scene3DValidationResult, validate_scene3d

# Per-attempt rate limit, separate bucket from the one-shot 2D/3D
# create/edit endpoints -- a user's run-based usage is bounded
# independently of their one-shot AI usage, matching how every other
# operation pair in this codebase already gets its own bucket.
RUN_RATE_LIMIT_MAX_ATTEMPTS = 10
RUN_RATE_LIMIT_WINDOW_SECONDS = 60

_REPAIRABLE_CATEGORIES = (
    AIErrorCategory.INVALID_STRUCTURED_OUTPUT,
    AIErrorCategory.PROVIDER_REJECTION,
)


class AIRunError(Exception):
    """Base for every `scenes.ai_runs` domain error. `code` is a short,
    stable, non-sensitive string safe to surface to the caller."""

    code = "ai_run_error"

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or self.code)


class RunNotFound(AIRunError):
    code = "not_found"


class QuotaExceeded(AIRunError):
    code = "quota_exceeded"

    def __init__(self, cap: int) -> None:
        super().__init__(f"Daily AI run quota ({cap}) exhausted.")
        self.cap = cap


class RateLimited(AIRunError):
    code = "rate_limited"


class MissingCredential(AIRunError):
    code = "missing_credential"


class InvalidTarget(AIRunError):
    code = "invalid_target"


class NotRunning(AIRunError):
    """Raised by `advance_run` when the run is not in `running` (already
    awaiting review, or already terminal)."""

    code = "not_running"


class AdvanceInProgress(AIRunError):
    """Another `advance` call already holds this run's lease."""

    code = "advance_in_progress"


class NotAwaitingReview(AIRunError):
    code = "not_awaiting_review"


class StaleBase(AIRunError):
    code = "stale_base"


def _digest(scene_json: dict[str, Any]) -> str:
    canonical = json.dumps(scene_json, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def _feature_key(operation: str) -> str:
    return "ai_scene_create" if operation == AIRun.Operation.CREATE else "ai_scene_edit"


def _quota_operation_key(operation: str, target_type: str) -> str:
    """The `operation=` suffix `ai_api.py`'s cache-key builders expect --
    a run's own bucket, distinct from the one-shot endpoints' buckets and
    from 2D vs 3D (matching `ai_api3d.py`'s existing `"create3d"`/
    `"edit3d"` bucket-separation convention)."""
    prefix = "run_create" if operation == AIRun.Operation.CREATE else "run_edit"
    return f"{prefix}3d" if target_type == AIRun.TargetType.PROJECT3D else prefix


def _quota_operation(run: AIRun) -> str:
    return _quota_operation_key(run.operation, run.target_type)


def _target_scene_json(run: AIRun) -> dict[str, Any] | None:
    version: SceneVersion | SceneVersion3D | None
    if run.target_type == AIRun.TargetType.PROJECT:
        assert run.project is not None
        version = run.project.current_version
    else:
        assert run.project3d is not None
        version = run.project3d.current_version
    return version.scene_json if version is not None else None


def _current_version_id(run: AIRun) -> int | None:
    if run.target_type == AIRun.TargetType.PROJECT:
        assert run.project is not None
        return run.project.current_version_id
    assert run.project3d is not None
    return run.project3d.current_version_id


def _augmented_prompt(run: AIRun) -> str:
    """The original prompt, plus (for a selection-scoped edit) an explicit
    mention of the selected target ids so `scenes.patch`'s existing
    prompt-reference scope check recognizes them as intentional, plus
    (for a repair attempt) the previous attempt's validation feedback --
    the entire mechanism `docs/plan.md`'s "plan-validate-revise" loop
    needs, without any new provider-facing API surface.
    """
    parts = [run.prompt]
    if run.scope == AIRun.Scope.SELECTION and run.selected_target_ids:
        ids = ", ".join(str(i) for i in run.selected_target_ids)
        parts.append(f"Only modify the following existing element id(s): {ids}.")
    if run.validation_summary:
        parts.append(
            "Your previous attempt was rejected for this reason: "
            f"{run.validation_summary}. Correct this and resend a complete, valid result."
        )
    return " ".join(parts)


@dataclass(frozen=True)
class _AttemptOutcome:
    success: bool
    scene_json: dict[str, Any] | None
    patch: list[dict[str, Any]] | None
    change_summary: str
    error_category: AIErrorCategory | None
    error_message: str
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float


def _run_one_attempt(run: AIRun) -> _AttemptOutcome:
    provider = _provider_for_user(run.owner, run.model_id or None, None, run.vendor)
    prompt = _augmented_prompt(run)

    if run.target_type == AIRun.TargetType.PROJECT:
        if run.operation == AIRun.Operation.CREATE:
            result: AIOperationResult = provider.create_scene(AICreateSceneRequest(prompt=prompt))
            patch, change_summary = None, ""
        else:
            outcome = provider.edit_scene_with_patch(
                AIEditSceneRequest(prompt=prompt, current_scene=_target_scene_json(run) or {})
            )
            result = outcome.result
            patch, change_summary = outcome.patch, outcome.change_summary or ""
    else:
        if run.operation == AIRun.Operation.CREATE:
            result = provider.create_scene3d(AICreateScene3DRequest(prompt=prompt))
            patch, change_summary = None, ""
        else:
            outcome = provider.edit_scene3d_with_patch(
                AIEditScene3DRequest(prompt=prompt, current_scene=_target_scene_json(run) or {})
            )
            result = outcome.result
            patch, change_summary = outcome.patch, outcome.change_summary or ""

    if result.success:
        return _AttemptOutcome(
            success=True,
            scene_json=result.scene,
            patch=patch,
            change_summary=change_summary,
            error_category=None,
            error_message="",
            prompt_tokens=result.usage.prompt_tokens,
            completion_tokens=result.usage.completion_tokens,
            cost_usd=result.usage.estimated_cost_usd,
        )
    assert result.error is not None
    return _AttemptOutcome(
        success=False,
        scene_json=None,
        patch=None,
        change_summary="",
        error_category=result.error.category,
        error_message=result.error.message,
        prompt_tokens=result.usage.prompt_tokens,
        completion_tokens=result.usage.completion_tokens,
        cost_usd=result.usage.estimated_cost_usd,
    )


def start_run(
    *,
    owner,
    target_type: str,
    target: Project | Project3D,
    operation: str,
    scope: str = AIRun.Scope.WHOLE_SCENE,
    selected_target_ids: list[Any] | None = None,
    prompt: str,
    vendor: str = "mistral",
    model_id: str = "",
    start_request_id: uuid.UUID | None = None,
) -> AIRun:
    if start_request_id is not None:
        existing = AIRun.objects.filter(owner=owner, start_request_id=start_request_id).first()
        if existing is not None:
            return existing

    cap = get_effective_cap(owner, _feature_key(operation))
    quota_key = _quota_cache_key(owner.id, operation=_quota_operation_key(operation, target_type))
    if _current_count(quota_key) >= cap:
        raise QuotaExceeded(cap)

    scene_json: dict[str, Any] | None = (
        target.current_version.scene_json if target.current_version else None
    )
    if operation == AIRun.Operation.EDIT_PATCH and scene_json is None:
        raise InvalidTarget("Cannot start an edit run against a project with no saved version.")

    project: Project | None = None
    project3d: Project3D | None = None
    if target_type == AIRun.TargetType.PROJECT:
        assert isinstance(target, Project)
        project = target
    else:
        assert isinstance(target, Project3D)
        project3d = target

    run = AIRun.objects.create(
        owner=owner,
        target_type=target_type,
        project=project,
        project3d=project3d,
        operation=operation,
        scope=scope,
        selected_target_ids=list(selected_target_ids or []),
        prompt=prompt,
        vendor=vendor,
        model_id=model_id,
        status=AIRun.Status.RUNNING,
        base_version_id=(target.current_version_id if scene_json is not None else None),
        input_digest=_digest(scene_json or {}),
        start_request_id=start_request_id,
        # `created_at` is only assigned by `auto_now_add` once the row is
        # actually inserted above, so the real deadline is computed and
        # saved as a second, tiny write rather than guessed beforehand.
        deadline_at=timezone.now(),
    )
    run.deadline_at = run.default_deadline()
    run.save(update_fields=["deadline_at"])
    return run


def advance_run(run: AIRun) -> AIRun:
    """Performs at most one provider call and checkpoints the outcome.
    Never called while holding a transaction open across the provider
    call itself -- see the module docstring."""
    now = timezone.now()

    with transaction.atomic():
        locked = AIRun.objects.select_for_update().get(pk=run.pk)
        if locked.status != AIRun.Status.RUNNING:
            raise NotRunning(f"Run is '{locked.status}', not running.")
        if now >= locked.deadline_at:
            locked.status = AIRun.Status.FAILED
            locked.error_reason = "timeout_budget_exhausted"
            locked.advance_lease_token = None
            locked.advance_lease_expires_at = None
            locked.save(
                update_fields=[
                    "status",
                    "error_reason",
                    "advance_lease_token",
                    "advance_lease_expires_at",
                ]
            )
            return locked
        lease_active = (
            locked.advance_lease_token is not None
            and locked.advance_lease_expires_at is not None
            and locked.advance_lease_expires_at > now
        )
        if lease_active:
            raise AdvanceInProgress("Another advance call is already in progress for this run.")

        if not _increment_and_check(
            _rate_limit_cache_key(locked.owner_id, operation=_quota_operation(locked)),
            limit=RUN_RATE_LIMIT_MAX_ATTEMPTS,
            window_seconds=RUN_RATE_LIMIT_WINDOW_SECONDS,
        ):
            raise RateLimited("Too many advance attempts; wait a moment and try again.")

        lease_token = uuid.uuid4()
        locked.advance_lease_token = lease_token
        locked.advance_lease_expires_at = now + timedelta(seconds=AI_RUN_ADVANCE_LEASE_SECONDS)
        locked.save(update_fields=["advance_lease_token", "advance_lease_expires_at"])
        run = locked

    # The provider call itself happens with no transaction open.
    try:
        outcome = _run_one_attempt(run)
    except (MissingPersonalMistralCredential, UnsupportedProvider) as exc:
        with transaction.atomic():
            locked = AIRun.objects.select_for_update().get(pk=run.pk)
            if locked.status == AIRun.Status.RUNNING and locked.advance_lease_token == lease_token:
                locked.status = AIRun.Status.FAILED
                locked.error_reason = (
                    "missing_credential"
                    if isinstance(exc, MissingPersonalMistralCredential)
                    else "unsupported_provider"
                )
                locked.advance_lease_token = None
                locked.advance_lease_expires_at = None
                locked.save(
                    update_fields=[
                        "status",
                        "error_reason",
                        "advance_lease_token",
                        "advance_lease_expires_at",
                    ]
                )
            return locked
        raise

    with transaction.atomic():
        locked = AIRun.objects.select_for_update().get(pk=run.pk)
        # A cancellation (or a lease reclaimed as abandoned and taken over
        # by a *later* advance call) landed while the provider call was
        # in flight -- this outcome is discarded outright. A cancelled
        # run can never resume, and a stolen lease means a newer call
        # already owns whatever happens next.
        if locked.status != AIRun.Status.RUNNING or locked.advance_lease_token != lease_token:
            return locked

        locked.attempts += 1
        locked.usage_prompt_tokens += outcome.prompt_tokens
        locked.usage_completion_tokens += outcome.completion_tokens
        locked.usage_cost_usd += outcome.cost_usd
        locked.advance_lease_token = None
        locked.advance_lease_expires_at = None

        if outcome.success:
            locked.candidate_scene_json = outcome.scene_json
            locked.candidate_patch = outcome.patch
            locked.change_summary = outcome.change_summary
            locked.plan_summary = (
                f"Generated a {locked.get_operation_display().lower()} candidate "
                f"in {locked.attempts} attempt(s)."
            )
            locked.validation_summary = ""
            locked.status = AIRun.Status.AWAITING_REVIEW
            locked.save()
            if not locked.charged:
                quota_key = _quota_cache_key(locked.owner_id, operation=_quota_operation(locked))
                _increment_quota(quota_key, timeout=DAILY_QUOTA_RESET_TIMEOUT_SECONDS)
                locked.charged = True
                locked.save(update_fields=["charged"])
            return locked

        # Unsuccessful: decide repairable vs terminal.
        terminal_reason: str | None = None
        if outcome.error_category == AIErrorCategory.QUOTA_EXCEEDED:
            terminal_reason = "provider_quota_exceeded"
        elif outcome.error_category == AIErrorCategory.TIMEOUT:
            if locked.attempts >= AI_RUN_MAX_PROVIDER_ATTEMPTS:
                terminal_reason = "timeout"
        elif outcome.error_category in _REPAIRABLE_CATEGORIES:
            if locked.attempts >= AI_RUN_MAX_PROVIDER_ATTEMPTS or locked.repairs >= (
                AI_RUN_MAX_REPAIR_ATTEMPTS
            ):
                terminal_reason = "repeated_invalid_output"
            else:
                locked.repairs += 1
        else:
            terminal_reason = "provider_failure"

        locked.validation_summary = outcome.error_message
        if terminal_reason is not None:
            locked.status = AIRun.Status.FAILED
            locked.error_reason = terminal_reason
        locked.save()
        return locked


def cancel_run(run: AIRun) -> AIRun:
    with transaction.atomic():
        locked = AIRun.objects.select_for_update().get(pk=run.pk)
        if locked.is_terminal:
            return locked
        locked.status = AIRun.Status.CANCELLED
        locked.cancelled_at = timezone.now()
        # Deliberately does NOT clear advance_lease_token: an in-flight
        # advance call's own finalize step checks `status == RUNNING`
        # first and will discard its result once it sees `cancelled`,
        # regardless of whether it still believes it holds the lease.
        locked.save(update_fields=["status", "cancelled_at"])
        return locked


def accept_run(run: AIRun) -> tuple[AIRun, SceneVersion | SceneVersion3D]:
    if run.status == AIRun.Status.ACCEPTED and run.accepted_version_id is not None:
        version_model = (
            SceneVersion if run.target_type == AIRun.TargetType.PROJECT else SceneVersion3D
        )
        return run, version_model.objects.get(pk=run.accepted_version_id)
    if run.status != AIRun.Status.AWAITING_REVIEW:
        raise NotAwaitingReview(f"Run is '{run.status}', not awaiting review.")

    scene_json = run.candidate_scene_json
    validation: SceneValidationResult | Scene3DValidationResult
    if run.target_type == AIRun.TargetType.PROJECT:
        validation = validate_scene(scene_json or {})
    else:
        validation = validate_scene3d(scene_json or {})
    if not validation.valid:
        # The candidate this run itself produced no longer validates
        # (e.g. a schema tightened between generation and Accept) --
        # never silently persist it.
        with transaction.atomic():
            locked = AIRun.objects.select_for_update().get(pk=run.pk)
            if locked.status == AIRun.Status.AWAITING_REVIEW:
                locked.status = AIRun.Status.FAILED
                locked.error_reason = "invalid_structured_output"
                locked.save(update_fields=["status", "error_reason"])
            return locked, None  # type: ignore[return-value]

    origin = "ai_create" if run.operation == AIRun.Operation.CREATE else "ai_edit"
    # Deterministic per-run idempotency key -- reuses the exact same
    # unique-constraint-backed dedup mechanism `AIAcceptProposalView`
    # already relies on, scoped so a genuine concurrent duplicate Accept
    # of *this* run always resolves to the one version it created.
    ai_request_id = uuid.uuid5(uuid.NAMESPACE_OID, f"ai-run-{run.pk}")

    version: SceneVersion | SceneVersion3D
    try:
        with transaction.atomic():
            if run.target_type == AIRun.TargetType.PROJECT:
                assert run.project_id is not None
                locked_2d = Project.objects.select_for_update().get(pk=run.project_id)
                existing_2d = locked_2d.versions.filter(ai_request_id=ai_request_id).first()
                if existing_2d is not None:
                    _finalize_accept(run, existing_2d.id)
                    return run, existing_2d
                if run.base_version_id != locked_2d.current_version_id:
                    raise StaleBase
                next_sequence = (
                    locked_2d.versions.aggregate(Max("sequence"))["sequence__max"] or 0
                ) + 1
                version = SceneVersion.objects.create(
                    project=locked_2d,
                    sequence=next_sequence,
                    scene_json=scene_json,
                    created_by=run.owner,
                    parent=locked_2d.current_version,
                    origin=origin,
                    change_label=run.change_summary,
                    ai_request_id=ai_request_id,
                )
                locked_2d.current_version = version
                locked_2d.save(update_fields=["current_version", "updated_at"])
            else:
                assert run.project3d_id is not None
                locked_3d = Project3D.objects.select_for_update().get(pk=run.project3d_id)
                existing_3d = locked_3d.versions.filter(ai_request_id=ai_request_id).first()
                if existing_3d is not None:
                    _finalize_accept(run, existing_3d.id)
                    return run, existing_3d
                if run.base_version_id != locked_3d.current_version_id:
                    raise StaleBase
                next_sequence = (
                    locked_3d.versions.aggregate(Max("sequence"))["sequence__max"] or 0
                ) + 1
                version = SceneVersion3D.objects.create(
                    project=locked_3d,
                    sequence=next_sequence,
                    scene_json=scene_json,
                    created_by=run.owner,
                    origin=origin,
                    ai_request_id=ai_request_id,
                )
                locked_3d.current_version = version
                locked_3d.save(update_fields=["current_version", "updated_at"])
            _finalize_accept(run, version.id)
    except IntegrityError:
        existing: SceneVersion | SceneVersion3D | None
        if run.target_type == AIRun.TargetType.PROJECT:
            assert run.project_id is not None
            existing = SceneVersion.objects.filter(
                project_id=run.project_id, ai_request_id=ai_request_id
            ).first()
        else:
            assert run.project3d_id is not None
            existing = SceneVersion3D.objects.filter(
                project_id=run.project3d_id, ai_request_id=ai_request_id
            ).first()
        if existing is not None:
            _finalize_accept(run, existing.id)
            return run, existing
        raise
    except StaleBase:
        with transaction.atomic():
            locked = AIRun.objects.select_for_update().get(pk=run.pk)
            if locked.status == AIRun.Status.AWAITING_REVIEW:
                locked.status = AIRun.Status.FAILED
                locked.error_reason = "stale_base"
                locked.save(update_fields=["status", "error_reason"])
            return locked, None  # type: ignore[return-value]

    run.refresh_from_db()
    return run, version


def _finalize_accept(run: AIRun, version_id: int) -> None:
    AIRun.objects.filter(pk=run.pk).update(
        status=AIRun.Status.ACCEPTED, accepted_version_id=version_id
    )
