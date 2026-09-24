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
    AI_RUN_ADVANCE_LEASE_SECONDS,
    AI_RUN_MAX_PROVIDER_ATTEMPTS,
    AI_RUN_MAX_REPAIR_ATTEMPTS,
    AIProviderModel,
    AIRetryPreference,
    AIRun,
    Project,
    Project3D,
    SceneVersion,
    SceneVersion3D,
)
from scenes.piece_engine import ensure_explicit_scene3d_renderer
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

PLAN_CRITERION_TYPES = frozenset(
    {"object_exists", "property_equals", "count_between", "renders_nonblank"}
)
PLAN_SCOPES = frozenset({"targets", "layer", "scene", "overhaul"})


def _stable_scene_ids(scene_json: dict[str, Any] | None) -> set[str]:
    ids: set[str] = set()

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            if isinstance(value.get("id"), str):
                ids.add(value["id"])
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(scene_json or {})
    return ids


def validate_plan(plan: dict[str, Any], scene_json: dict[str, Any] | None = None) -> None:
    """Validate the bounded structured plan contract before implementation."""
    if not isinstance(plan, dict) or plan.get("revision") != 1:
        raise InvalidTarget("plan revision must be 1.")
    if plan.get("scope") not in PLAN_SCOPES:
        raise InvalidTarget("plan scope must be one of targets, layer, scene, or overhaul.")
    steps = plan.get("steps")
    target_ids = plan.get("target_ids")
    criteria = plan.get("success_criteria")
    if not isinstance(steps, list) or not steps:
        raise InvalidTarget("plan steps must be a non-empty list.")
    if not isinstance(target_ids, list) or any(
        not isinstance(target_id, str) or not target_id for target_id in target_ids
    ):
        raise InvalidTarget("plan target_ids must be a list of stable string IDs.")
    if len(set(target_ids)) != len(target_ids):
        raise InvalidTarget("plan target_ids must be unique.")
    if not isinstance(criteria, list) or not criteria:
        raise InvalidTarget("plan success_criteria must be a non-empty list.")
    for step in steps:
        if not isinstance(step, dict) or not isinstance(step.get("id"), str):
            raise InvalidTarget("every plan step requires a stable string id.")
        step_targets = step.get("target_ids", [])
        if not isinstance(step_targets, list) or not set(step_targets).issubset(target_ids):
            raise InvalidTarget("plan step target_ids must be declared by the plan.")
    for criterion in criteria:
        if not isinstance(criterion, dict) or criterion.get("type") not in PLAN_CRITERION_TYPES:
            raise InvalidTarget("plan contains an unsupported success criterion type.")
        if not isinstance(criterion.get("parameters", {}), dict):
            raise InvalidTarget("plan criterion parameters must be an object.")
    if scene_json is not None and not set(target_ids).issubset(_stable_scene_ids(scene_json)):
        raise InvalidTarget("plan references an ID that is not present in the target scene.")


def _criterion_value(scene_json: Any, path: str) -> Any:
    """Read a bounded JSON-pointer-like path from a candidate scene."""
    if path in ("", "/"):
        return scene_json
    current = scene_json
    for component in path.lstrip("/").split("/"):
        component = component.replace("~1", "/").replace("~0", "~")
        if isinstance(current, dict):
            if component not in current:
                return None
            current = current[component]
        elif isinstance(current, list) and component.isdigit():
            index = int(component)
            if index >= len(current):
                return None
            current = current[index]
        else:
            return None
    return current


def evaluate_criteria(
    plan: dict[str, Any] | None, scene_json: dict[str, Any] | None
) -> list[dict[str, Any]]:
    """Evaluate the server-owned success criteria without mutating the scene."""
    criteria = plan.get("success_criteria", []) if isinstance(plan, dict) else []
    results: list[dict[str, Any]] = []
    for criterion in criteria:
        criterion_type = criterion.get("type")
        parameters = criterion.get("parameters", {})
        passed = False
        detail = "Criterion did not pass."
        if criterion_type == "object_exists":
            target_id = parameters.get("id")
            passed = isinstance(target_id, str) and target_id in _stable_scene_ids(scene_json)
            detail = f"Object {target_id!r} {'exists' if passed else 'was not found'}."
        elif criterion_type == "property_equals":
            actual = _criterion_value(scene_json, str(parameters.get("path", "")))
            expected = parameters.get("value")
            passed = actual == expected
            detail = (
                f"Property {parameters.get('path', '')!r} was {actual!r}; expected {expected!r}."
            )
        elif criterion_type == "count_between":
            actual = _criterion_value(scene_json, str(parameters.get("path", "")))
            lower = parameters.get("min", 0)
            upper = parameters.get("max", lower)
            passed = (
                isinstance(actual, list)
                and isinstance(lower, int)
                and isinstance(upper, int)
                and lower <= len(actual) <= upper
            )
            detail = (
                f"Count at {parameters.get('path', '')!r} was "
                f"{len(actual) if isinstance(actual, list) else None}; "
                f"expected {lower}..{upper}."
            )
        elif criterion_type == "renders_nonblank":
            passed = isinstance(scene_json, dict) and bool(scene_json)
            detail = (
                "Candidate contains renderable scene data."
                if passed
                else "Candidate scene was blank."
            )
        results.append(
            {"type": criterion_type, "parameters": parameters, "passed": passed, "detail": detail}
        )
    return results


def _criteria_feedback(results: list[dict[str, Any]]) -> str:
    failures = [result["detail"] for result in results if not result.get("passed")]
    return "All success criteria must pass. " + " ".join(failures)


def _build_plan(
    *,
    operation: str,
    scope: str,
    selected_target_ids: list[Any],
    scene_json: dict[str, Any] | None,
) -> dict[str, Any]:
    target_ids = (
        [str(target_id) for target_id in selected_target_ids]
        if scope == AIRun.Scope.SELECTION
        else []
    )
    action = "generate_scene" if operation == AIRun.Operation.CREATE else "edit_scene"
    plan_scope = (
        "targets"
        if scope == AIRun.Scope.SELECTION
        else "overhaul"
        if operation == AIRun.Operation.CREATE
        else "scene"
    )
    criteria: list[dict[str, Any]] = [
        {"type": "renders_nonblank", "parameters": {"target": "scene"}}
    ]
    criteria.extend(
        {"type": "object_exists", "parameters": {"id": target_id}} for target_id in target_ids
    )
    plan = {
        "revision": 1,
        "scope": plan_scope,
        "steps": [{"id": "step-1", "action": action, "target_ids": target_ids}],
        "target_ids": target_ids,
        "success_criteria": criteria,
    }
    validate_plan(plan, scene_json if operation == AIRun.Operation.EDIT_PATCH else None)
    return plan


def _scene_elements_by_id(scene_json: dict[str, Any] | None) -> dict[str, Any]:
    elements: dict[str, Any] = {}

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            element_id = value.get("id")
            if isinstance(element_id, str):
                elements[element_id] = value
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(scene_json or {})
    return elements


def _descendant_ids(element: Any) -> set[str]:
    ids: set[str] = set()

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            element_id = value.get("id")
            if isinstance(element_id, str):
                ids.add(element_id)
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(element)
    return ids


def _scope_allowed_ids(plan: dict[str, Any], before: dict[str, Any] | None) -> set[str]:
    target_ids = {str(value) for value in plan.get("target_ids", [])}
    if plan.get("scope") == "targets":
        elements = _scene_elements_by_id(before)
        allowed = set(target_ids)
        for target_id in target_ids:
            if target_id in elements:
                allowed.update(_descendant_ids(elements[target_id]))
        return allowed
    if plan.get("scope") == "layer":
        elements = _scene_elements_by_id(before)
        allowed = set(target_ids)
        for element_id, element in elements.items():
            if isinstance(element, dict) and (
                element.get("layerId") in target_ids or element.get("layer_id") in target_ids
            ):
                allowed.add(element_id)
        return allowed
    return set(elements := _scene_elements_by_id(before))


def _validate_candidate_scope(
    plan: dict[str, Any] | None,
    before: dict[str, Any] | None,
    after: dict[str, Any] | None,
) -> str | None:
    """Return a safe rejection message when a candidate exceeds its plan scope."""
    if not isinstance(plan, dict) or not isinstance(after, dict):
        return None
    before_elements = _scene_elements_by_id(before)
    after_elements = _scene_elements_by_id(after)
    scope = plan.get("scope")
    if scope in {"scene", "overhaul"}:
        missing = set(before_elements) - set(after_elements)
        if missing:
            return f"plan scope {scope!r} cannot remove existing element IDs: {sorted(missing)!r}."
        return None
    allowed = _scope_allowed_ids(plan, before)
    changed = {
        element_id
        for element_id in set(before_elements) & set(after_elements)
        if before_elements[element_id] != after_elements[element_id]
    }
    added = set(after_elements) - set(before_elements)
    removed = set(before_elements) - set(after_elements)
    outside = (changed | added | removed) - allowed
    if outside:
        return (
            f"plan scope {scope!r} permits only declared target IDs and their children; "
            f"out-of-scope element IDs: {sorted(outside)!r}."
        )
    return None


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


class AgenticNotSupported(AIRunError):
    """Raised when the requested (vendor, model) is not marked
    `agentic_supported` in the admin AI model catalog (issue #523) for
    this run's task kind -- checked before any provider call."""

    code = "agentic_not_supported"


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


def _agent_task_kind(target_type: str) -> str:
    return (
        AIProviderModel.TaskKind.AGENT_3D
        if target_type == AIRun.TargetType.PROJECT3D
        else AIProviderModel.TaskKind.AGENT_2D
    )


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
    if run.operation == AIRun.Operation.EDIT_PATCH and _target_scene_json(run) is not None:
        parts.append(
            "The current scene is included as the source for this repair attempt; "
            "preserve valid existing content."
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
        scope_error = _validate_candidate_scope(run.plan, _target_scene_json(run), result.scene)
        if scope_error is not None:
            return _AttemptOutcome(
                success=False,
                scene_json=None,
                patch=None,
                change_summary="",
                error_category=AIErrorCategory.INVALID_STRUCTURED_OUTPUT,
                error_message=scope_error,
                prompt_tokens=result.usage.prompt_tokens,
                completion_tokens=result.usage.completion_tokens,
                cost_usd=result.usage.estimated_cost_usd,
            )
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

    try:
        provider_def = get_provider(vendor)
    except ValueError as exc:
        raise InvalidTarget(str(exc)) from exc
    effective_model_id = (model_id or "").strip() or provider_def.default_model
    if not is_agentic_supported(
        vendor=vendor, model_slug=effective_model_id, task_kind=_agent_task_kind(target_type)
    ):
        raise AgenticNotSupported(
            f"The {vendor}/{effective_model_id} model is not enabled for agent runs."
        )

    cap = get_effective_cap(owner, _feature_key(operation))
    quota_key = _quota_cache_key(owner.id, operation=_quota_operation_key(operation, target_type))
    if not is_unlimited(owner) and _current_count(quota_key) >= cap:
        raise QuotaExceeded(cap)

    scene_json: dict[str, Any] | None = (
        target.current_version.scene_json if target.current_version else None
    )
    if operation == AIRun.Operation.EDIT_PATCH and scene_json is None:
        raise InvalidTarget("Cannot start an edit run against a project with no saved version.")
    plan = _build_plan(
        operation=operation,
        scope=scope,
        selected_target_ids=list(selected_target_ids or []),
        scene_json=scene_json,
    )
    retry_preference = AIRetryPreference.objects.filter(owner=owner).first()
    auto_retry_enabled = retry_preference.auto_retry_enabled if retry_preference else False
    max_retries = retry_preference.max_retries if retry_preference else 0

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
        plan=plan,
        auto_retry_enabled=auto_retry_enabled,
        max_retries=max_retries,
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

        quota_key = _quota_cache_key(locked.owner_id, operation=_quota_operation(locked))
        cap = get_effective_cap(locked.owner, _feature_key(locked.operation))
        if not is_unlimited(locked.owner) and _current_count(quota_key) >= cap:
            locked.status = AIRun.Status.FAILED
            locked.error_reason = "quota_exceeded"
            locked.validation_summary = (
                "The AI run quota was exhausted before this provider attempt."
            )
            locked.save(update_fields=["status", "error_reason", "validation_summary"])
            return locked
        _increment_quota(quota_key, timeout=DAILY_QUOTA_RESET_TIMEOUT_SECONDS)
        locked.charged = True

        lease_token = uuid.uuid4()
        locked.advance_lease_token = lease_token
        locked.advance_lease_expires_at = now + timedelta(seconds=AI_RUN_ADVANCE_LEASE_SECONDS)
        locked.save(update_fields=["advance_lease_token", "advance_lease_expires_at", "charged"])
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
            results = evaluate_criteria(locked.plan, outcome.scene_json)
            history = list(locked.criterion_results or [])
            history.append({"attempt": locked.attempts, "results": results})
            locked.criterion_results = history
            if not results or all(result["passed"] for result in results):
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
                return locked
            locked.validation_summary = _criteria_feedback(results)
            if not locked.auto_retry_enabled or locked.attempts >= min(
                locked.max_retries + 1, AI_RUN_MAX_PROVIDER_ATTEMPTS
            ):
                locked.status = AIRun.Status.FAILED
                locked.error_reason = "criteria_failed"
            else:
                locked.repairs += 1
            locked.save()
            return locked

        # Unsuccessful: decide repairable vs terminal.
        terminal_reason: str | None = None
        if outcome.error_category == AIErrorCategory.QUOTA_EXCEEDED:
            terminal_reason = "provider_quota_exceeded"
        elif outcome.error_category == AIErrorCategory.TIMEOUT:
            if not locked.auto_retry_enabled or locked.attempts >= min(
                locked.max_retries + 1, AI_RUN_MAX_PROVIDER_ATTEMPTS
            ):
                terminal_reason = "timeout"
        elif outcome.error_category in _REPAIRABLE_CATEGORIES:
            if (
                not locked.auto_retry_enabled
                or locked.attempts >= min(locked.max_retries + 1, AI_RUN_MAX_PROVIDER_ATTEMPTS)
                or locked.repairs >= AI_RUN_MAX_REPAIR_ATTEMPTS
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
                previous_3d = locked_3d.current_version
                version = SceneVersion3D.objects.create(
                    project=locked_3d,
                    sequence=next_sequence,
                    # #771: agentic accepts are stored with an explicit rendering library.
                    scene_json=ensure_explicit_scene3d_renderer(
                        scene_json, previous_3d.scene_json if previous_3d else None
                    ),
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
