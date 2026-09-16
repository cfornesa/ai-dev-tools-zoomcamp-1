"""Issue #528: a persistent, bounded, owner-scoped AI-assisted 2D-to-3D
scene conversion run -- start/advance/cancel/accept.

Mirrors `scenes.ai_runs`'s bounded plan-validate-revise mechanics almost
exactly (one provider call per `advance`, an exclusive advance lease,
repair-attempt retries on invalid structured output, a deadline) -- see
that module's docstring for the shared rationale, and
`scenes.models.SceneConversionRun`'s docstring for why this is a sibling
model rather than a third `AIRun.TargetType`/`AIRun.Operation` branch: a
conversion always reads an existing 2D `Project` and, on accept, *creates
a brand-new* `Project3D` + first `SceneVersion3D`, a meaningfully
different accept shape than `AIRun.accept_run`'s in-place update of an
already-existing target.

## Source type restriction

The only valid conversion source is a `Project` (the canonical 2D scene
document family) with a saved `current_version`. `ArtPiece` (issue #314's
separate generated-code document family -- raw `source` text, never a
`scene_json`) is never an accepted source: it has no scene document to
convert, and its generated code must never be executed to derive one.
`start_conversion`'s signature only accepts a `Project` instance, which
makes passing an `ArtPiece` a type error at every call site (the API view
looks the source up via `_get_project_or_404`, which only ever returns a
`Project`) -- there is no runtime type-name check to bypass.

## Unsupported 2D shape types

Only `circle` (-> `sphere`) and `rect` (-> `box`) shapes have a defined 3D
equivalent (see `SUPPORTED_2D_SHAPE_TYPES` below). Every other 2D shape
type (`line`, `path`, `particleEmitter`, `image`) is detected
deterministically from the source scene *before* any provider call and
recorded on `SceneConversionRun.unsupported_shape_types` regardless of
outcome -- so a caller can warn "N shapes could not be converted" even
if the run never reaches `awaiting_review`, and never silently drops
this information.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from django.db import IntegrityError, transaction
from django.utils import timezone

from ai_provider.interface import AIErrorCategory, AIOperationResult
from ai_provider.interface3d import AIConvertScene2DTo3DRequest
from ai_provider.registry import get_provider
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
from scenes.ai_catalog import is_agentic_supported
from scenes.entitlements import get_effective_cap, is_unlimited
from scenes.models import (
    SCENE_CONVERSION_RUN_ADVANCE_LEASE_SECONDS,
    SCENE_CONVERSION_RUN_MAX_PROVIDER_ATTEMPTS,
    SCENE_CONVERSION_RUN_MAX_REPAIR_ATTEMPTS,
    AIProviderModel,
    Project,
    Project3D,
    SceneConversionRun,
    SceneVersion3D,
)
from scenes.validation3d import Scene3DValidationResult, validate_scene3d

FEATURE_KEY = "ai_scene_convert_3d"
QUOTA_OPERATION = "convert_2d_to_3d"

RUN_RATE_LIMIT_MAX_ATTEMPTS = 10
RUN_RATE_LIMIT_WINDOW_SECONDS = 60

# The only 2D shape types (schema/scene.schema.json's `shape.type` enum)
# with a defined 3D equivalent -- see this module's docstring.
SUPPORTED_2D_SHAPE_TYPES = frozenset({"circle", "rect"})
ALL_2D_SHAPE_TYPES = frozenset({"circle", "rect", "line", "path", "particleEmitter", "image"})

_REPAIRABLE_CATEGORIES = (
    AIErrorCategory.INVALID_STRUCTURED_OUTPUT,
    AIErrorCategory.PROVIDER_REJECTION,
)


class SceneConversionError(Exception):
    code = "scene_conversion_error"

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or self.code)


class RunNotFound(SceneConversionError):
    code = "not_found"


class QuotaExceeded(SceneConversionError):
    code = "quota_exceeded"

    def __init__(self, cap: int) -> None:
        super().__init__(f"Daily conversion quota ({cap}) exhausted.")
        self.cap = cap


class RateLimited(SceneConversionError):
    code = "rate_limited"


class MissingCredential(SceneConversionError):
    code = "missing_credential"


class InvalidTarget(SceneConversionError):
    code = "invalid_target"


class NotRunning(SceneConversionError):
    code = "not_running"


class AdvanceInProgress(SceneConversionError):
    code = "advance_in_progress"


class NotAwaitingReview(SceneConversionError):
    code = "not_awaiting_review"


class StaleBase(SceneConversionError):
    code = "stale_base"


class AgenticNotSupported(SceneConversionError):
    code = "agentic_not_supported"


def _digest(scene_json: dict[str, Any]) -> str:
    canonical = json.dumps(scene_json, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def detect_unsupported_shape_types(scene_json: dict[str, Any]) -> list[str]:
    """The distinct 2D shape types present in `scene_json` that have no 3D
    equivalent, in a stable (sorted) order. Deliberately tolerant of a
    malformed/partial scene (missing or non-list `shapes`) -- this is a
    best-effort reporting helper, not a validator; `scenes.validation`
    already validated the source scene long before it reached here."""
    shapes = scene_json.get("shapes")
    if not isinstance(shapes, list):
        return []
    found = {
        shape.get("type")
        for shape in shapes
        if isinstance(shape, dict) and shape.get("type") not in SUPPORTED_2D_SHAPE_TYPES
    }
    return sorted(t for t in found if isinstance(t, str))


def _augmented_prompt(run: SceneConversionRun) -> str:
    parts = [run.prompt] if run.prompt else []
    if run.unsupported_shape_types:
        types = ", ".join(run.unsupported_shape_types)
        parts.append(
            f"The source scene also contains these shape types with no 3D equivalent, "
            f"which you must skip entirely: {types}."
        )
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
    error_category: AIErrorCategory | None
    error_message: str
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float


def _run_one_attempt(run: SceneConversionRun, source_scene: dict[str, Any]) -> _AttemptOutcome:
    provider = _provider_for_user(run.owner, run.model_id or None, None, run.vendor)
    result: AIOperationResult = provider.convert_scene_2d_to_3d(
        AIConvertScene2DTo3DRequest(source_scene=source_scene, prompt=_augmented_prompt(run))
    )
    if result.success:
        return _AttemptOutcome(
            success=True,
            scene_json=result.scene,
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
        error_category=result.error.category,
        error_message=result.error.message,
        prompt_tokens=result.usage.prompt_tokens,
        completion_tokens=result.usage.completion_tokens,
        cost_usd=result.usage.estimated_cost_usd,
    )


def start_conversion(
    *,
    owner,
    source_project: Project,
    prompt: str = "",
    vendor: str = "mistral",
    model_id: str = "",
    start_request_id: uuid.UUID | None = None,
) -> SceneConversionRun:
    if start_request_id is not None:
        existing = SceneConversionRun.objects.filter(
            owner=owner, start_request_id=start_request_id
        ).first()
        if existing is not None:
            return existing

    try:
        provider_def = get_provider(vendor)
    except ValueError as exc:
        raise InvalidTarget(str(exc)) from exc
    effective_model_id = (model_id or "").strip() or provider_def.default_model
    if not is_agentic_supported(
        vendor=vendor, model_slug=effective_model_id, task_kind=AIProviderModel.TaskKind.AGENT_3D
    ):
        raise AgenticNotSupported(
            f"The {vendor}/{effective_model_id} model is not enabled for agent runs."
        )

    cap = get_effective_cap(owner, FEATURE_KEY)
    quota_key = _quota_cache_key(owner.id, operation=QUOTA_OPERATION)
    if not is_unlimited(owner) and _current_count(quota_key) >= cap:
        raise QuotaExceeded(cap)

    if source_project.current_version is None:
        raise InvalidTarget("Cannot convert a project with no saved version.")
    scene_json = source_project.current_version.scene_json
    source_version_id = source_project.current_version_id
    assert source_version_id is not None

    run = SceneConversionRun.objects.create(
        owner=owner,
        source_project=source_project,
        source_version_id=source_version_id,
        prompt=prompt,
        vendor=vendor,
        model_id=model_id,
        status=SceneConversionRun.Status.RUNNING,
        input_digest=_digest(scene_json),
        unsupported_shape_types=detect_unsupported_shape_types(scene_json),
        start_request_id=start_request_id,
        deadline_at=timezone.now(),
    )
    run.deadline_at = run.default_deadline()
    run.save(update_fields=["deadline_at"])
    return run


def advance_conversion(run: SceneConversionRun) -> SceneConversionRun:
    now = timezone.now()

    with transaction.atomic():
        locked = SceneConversionRun.objects.select_for_update().get(pk=run.pk)
        if locked.status != SceneConversionRun.Status.RUNNING:
            raise NotRunning(f"Run is '{locked.status}', not running.")
        if now >= locked.deadline_at:
            locked.status = SceneConversionRun.Status.FAILED
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
            _rate_limit_cache_key(locked.owner_id, operation=QUOTA_OPERATION),
            limit=RUN_RATE_LIMIT_MAX_ATTEMPTS,
            window_seconds=RUN_RATE_LIMIT_WINDOW_SECONDS,
        ):
            raise RateLimited("Too many advance attempts; wait a moment and try again.")

        # The source project's scene must still exist and match what this
        # run started against -- checked here (not just on accept) so a
        # source project deleted or changed mid-run fails fast rather than
        # burning a provider call against stale/missing input.
        source_project = Project.objects.filter(pk=locked.source_project_id).first()
        if (
            source_project is None
            or source_project.current_version_id != locked.source_version_id
            or source_project.current_version is None
        ):
            locked.status = SceneConversionRun.Status.FAILED
            locked.error_reason = "stale_base"
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
        source_scene = source_project.current_version.scene_json

        lease_token = uuid.uuid4()
        locked.advance_lease_token = lease_token
        locked.advance_lease_expires_at = now + timedelta(
            seconds=SCENE_CONVERSION_RUN_ADVANCE_LEASE_SECONDS
        )
        locked.save(update_fields=["advance_lease_token", "advance_lease_expires_at"])
        run = locked

    try:
        outcome = _run_one_attempt(run, source_scene)
    except (MissingPersonalMistralCredential, UnsupportedProvider) as exc:
        with transaction.atomic():
            locked = SceneConversionRun.objects.select_for_update().get(pk=run.pk)
            if (
                locked.status == SceneConversionRun.Status.RUNNING
                and locked.advance_lease_token == lease_token
            ):
                locked.status = SceneConversionRun.Status.FAILED
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
        locked = SceneConversionRun.objects.select_for_update().get(pk=run.pk)
        if (
            locked.status != SceneConversionRun.Status.RUNNING
            or locked.advance_lease_token != lease_token
        ):
            return locked

        locked.attempts += 1
        locked.usage_prompt_tokens += outcome.prompt_tokens
        locked.usage_completion_tokens += outcome.completion_tokens
        locked.usage_cost_usd += outcome.cost_usd
        locked.advance_lease_token = None
        locked.advance_lease_expires_at = None

        if outcome.success:
            locked.candidate_scene_json = outcome.scene_json
            locked.plan_summary = (
                f"Generated a 3D conversion candidate in {locked.attempts} attempt(s)."
            )
            locked.validation_summary = ""
            locked.status = SceneConversionRun.Status.AWAITING_REVIEW
            locked.save()
            if not locked.charged:
                quota_key = _quota_cache_key(locked.owner_id, operation=QUOTA_OPERATION)
                _increment_quota(quota_key, timeout=DAILY_QUOTA_RESET_TIMEOUT_SECONDS)
                locked.charged = True
                locked.save(update_fields=["charged"])
            return locked

        terminal_reason: str | None = None
        if outcome.error_category == AIErrorCategory.QUOTA_EXCEEDED:
            terminal_reason = "provider_quota_exceeded"
        elif outcome.error_category == AIErrorCategory.TIMEOUT:
            if locked.attempts >= SCENE_CONVERSION_RUN_MAX_PROVIDER_ATTEMPTS:
                terminal_reason = "timeout"
        elif outcome.error_category in _REPAIRABLE_CATEGORIES:
            if (
                locked.attempts >= SCENE_CONVERSION_RUN_MAX_PROVIDER_ATTEMPTS
                or locked.repairs >= SCENE_CONVERSION_RUN_MAX_REPAIR_ATTEMPTS
            ):
                terminal_reason = "repeated_invalid_output"
            else:
                locked.repairs += 1
        else:
            terminal_reason = "provider_failure"

        locked.validation_summary = outcome.error_message
        if terminal_reason is not None:
            locked.status = SceneConversionRun.Status.FAILED
            locked.error_reason = terminal_reason
        locked.save()
        return locked


def cancel_conversion(run: SceneConversionRun) -> SceneConversionRun:
    with transaction.atomic():
        locked = SceneConversionRun.objects.select_for_update().get(pk=run.pk)
        if locked.is_terminal:
            return locked
        locked.status = SceneConversionRun.Status.CANCELLED
        locked.cancelled_at = timezone.now()
        locked.save(update_fields=["status", "cancelled_at"])
        return locked


def accept_conversion(run: SceneConversionRun) -> tuple[SceneConversionRun, Project3D | None]:
    """Accepts an `awaiting_review` run, creating a brand-new `Project3D`
    (title derived from the source project) and its first `SceneVersion3D`
    (`origin=CONVERTED_FROM_2D`, carrying provenance back to the source).
    Idempotent the same way `ai_runs.accept_run` is: a repeat Accept of an
    already-accepted run returns the same `Project3D` it created the first
    time, via the same deterministic `ai_request_id`-style dedup key
    (scoped to the run, since a conversion always creates -- there is no
    existing project whose `SceneVersion3D.ai_request_id` uniqueness
    constraint could otherwise be reused; instead this checks the run's
    own `accepted_project3d_id`/`accepted_version_id` first).
    """
    if (
        run.status == SceneConversionRun.Status.ACCEPTED
        and run.accepted_project3d_id is not None
        and run.accepted_version_id is not None
    ):
        project3d = Project3D.objects.get(pk=run.accepted_project3d_id)
        return run, project3d

    if run.status != SceneConversionRun.Status.AWAITING_REVIEW:
        raise NotAwaitingReview(f"Run is '{run.status}', not awaiting review.")

    scene_json = run.candidate_scene_json
    validation: Scene3DValidationResult = validate_scene3d(scene_json or {})
    if not validation.valid:
        with transaction.atomic():
            locked = SceneConversionRun.objects.select_for_update().get(pk=run.pk)
            if locked.status == SceneConversionRun.Status.AWAITING_REVIEW:
                locked.status = SceneConversionRun.Status.FAILED
                locked.error_reason = "invalid_structured_output"
                locked.save(update_fields=["status", "error_reason"])
            return locked, None

    try:
        with transaction.atomic():
            locked_source = Project.objects.select_for_update().get(pk=run.source_project_id)
            if run.source_version_id != locked_source.current_version_id:
                raise StaleBase
            title = f"{locked_source.title} (3D)"
            project3d = Project3D.objects.create(owner=run.owner, title=title[:200])
            version = SceneVersion3D.objects.create(
                project=project3d,
                sequence=1,
                scene_json=scene_json,
                created_by=run.owner,
                origin=SceneVersion3D.Origin.CONVERTED_FROM_2D,
                source_project=locked_source,
                source_version_id=run.source_version_id,
            )
            project3d.current_version = version
            project3d.save(update_fields=["current_version", "updated_at"])
            SceneConversionRun.objects.filter(pk=run.pk).update(
                status=SceneConversionRun.Status.ACCEPTED,
                accepted_project3d_id=project3d.id,
                accepted_version_id=version.id,
            )
    except StaleBase:
        with transaction.atomic():
            locked = SceneConversionRun.objects.select_for_update().get(pk=run.pk)
            if locked.status == SceneConversionRun.Status.AWAITING_REVIEW:
                locked.status = SceneConversionRun.Status.FAILED
                locked.error_reason = "stale_base"
                locked.save(update_fields=["status", "error_reason"])
            return locked, None
    except IntegrityError:
        run.refresh_from_db()
        if run.accepted_project3d_id is not None:
            return run, Project3D.objects.get(pk=run.accepted_project3d_id)
        raise

    run.refresh_from_db()
    return run, project3d
