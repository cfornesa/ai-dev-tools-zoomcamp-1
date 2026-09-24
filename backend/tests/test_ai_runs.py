"""Tests for the persistent, bounded, owner-scoped plan-validate-revise
AI run (issue #461): `scenes.ai_runs`' start/advance/cancel/accept logic
and the `/api/ai/runs/...` views layer.

Every test replaces `scenes.ai_api.get_ai_provider` (patched at its
definition site, matching every other AI test in this suite -- see
tests/test_ai_scene3d_api.py's module docstring for why that's the
correct patch target even for 3D and for this run-based path: both
`scenes.ai_api._provider_for_user` and `scenes.ai_runs._run_one_attempt`
call it as a module-global lookup) with a small deterministic test
double that returns a queue of canned per-attempt outcomes, so no real
network/credential is ever involved.
"""

from __future__ import annotations

import copy
import json
import threading
from pathlib import Path

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

import scenes.ai_api as ai_api
from ai_provider.interface import (
    AICreateSceneRequest,
    AIEditSceneRequest,
    AIError,
    AIErrorCategory,
    AIOperation,
    AIOperationResult,
    AIUsageMetadata,
)
from ai_provider.interface3d import (
    AICreateScene3DRequest,
    AIEditScene3DRequest,
    AIOperationResult3D,
)
from ai_provider.mistral_provider import AIEditScene3DPatchResult, AIEditScenePatchResult
from scenes import ai_runs
from scenes.models import AIRetryPreference, AIRun, Project, Project3D, SceneVersion, SceneVersion3D
from tests._postgres_routing import close_thread_connections, route_default_to_postgres_test

_BLANK_SCENE_PATH = (
    Path(__file__).resolve().parent.parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
)
BLANK_SCENE = json.loads(_BLANK_SCENE_PATH.read_text())

_MINIMAL_SCENE_3D_PATH = (
    Path(__file__).resolve().parent.parent.parent
    / "schema"
    / "fixtures3d"
    / "valid"
    / "minimal.json"
)
MINIMAL_SCENE_3D = json.loads(_MINIMAL_SCENE_3D_PATH.read_text())

_USAGE = AIUsageMetadata(prompt_tokens=10, completion_tokens=20, estimated_cost_usd=0.001)


def test_validate_plan_requires_explicit_scope():
    plan = {
        "revision": 1,
        "steps": [{"id": "step-1", "target_ids": []}],
        "target_ids": [],
        "success_criteria": [{"type": "renders_nonblank", "parameters": {}}],
    }
    with pytest.raises(ai_runs.InvalidTarget, match="plan scope"):
        ai_runs.validate_plan(plan)


def test_run_scope_rejects_out_of_scope_changes_and_preserves_scene_scope_rules():
    before = {
        "shapes": [
            {"id": "shape-a", "type": "circle", "layerId": "layer-1", "x": 1},
            {"id": "shape-b", "type": "rect", "layerId": "layer-2", "x": 1},
        ],
        "layers": [{"id": "layer-1"}, {"id": "layer-2"}],
    }
    changed_b = copy.deepcopy(before)
    changed_b["shapes"][1]["x"] = 2
    target_plan = {"scope": "targets", "target_ids": ["shape-a"]}
    assert "shape-b" in (ai_runs._validate_candidate_scope(target_plan, before, changed_b) or "")

    layer_plan = {"scope": "layer", "target_ids": ["layer-1"]}
    assert "shape-b" in (ai_runs._validate_candidate_scope(layer_plan, before, changed_b) or "")

    removed = copy.deepcopy(before)
    removed["shapes"].pop()
    assert ai_runs._validate_candidate_scope({"scope": "scene"}, before, removed)

    overhaul = copy.deepcopy(before)
    overhaul["shapes"].append({"id": "shape-c", "type": "line"})
    assert ai_runs._validate_candidate_scope({"scope": "overhaul"}, before, overhaul) is None


class _QueuedFakeProvider:
    """Returns one canned outcome per call, in order. Each outcome is
    either a scene dict (success) or an `AIErrorCategory` (failure). A
    run only ever calls one of the four methods repeatedly (its
    `target_type`/`operation` never change mid-run), so one shared queue
    is enough."""

    def __init__(self, outcomes: list[dict | AIErrorCategory]) -> None:
        self._outcomes = list(outcomes)
        self.calls = 0

    def _next_result(self, operation: AIOperation) -> AIOperationResult:
        self.calls += 1
        outcome = self._outcomes.pop(0)
        if isinstance(outcome, AIErrorCategory):
            return AIOperationResult(
                operation=operation,
                usage=_USAGE,
                error=AIError(category=outcome, message=f"simulated {outcome.value}"),
            )
        return AIOperationResult(operation=operation, usage=_USAGE, scene=outcome)

    def _next_result3d(self, operation: AIOperation) -> AIOperationResult3D:
        self.calls += 1
        outcome = self._outcomes.pop(0)
        if isinstance(outcome, AIErrorCategory):
            return AIOperationResult3D(
                operation=operation,
                usage=_USAGE,
                error=AIError(category=outcome, message=f"simulated {outcome.value}"),
            )
        return AIOperationResult3D(operation=operation, usage=_USAGE, scene=outcome)

    def create_scene(self, request: AICreateSceneRequest) -> AIOperationResult:
        return self._next_result(AIOperation.CREATE_SCENE)

    def edit_scene(self, request: AIEditSceneRequest) -> AIOperationResult:
        return self.edit_scene_with_patch(request).result

    def edit_scene_with_patch(self, request: AIEditSceneRequest) -> AIEditScenePatchResult:
        result = self._next_result(AIOperation.EDIT_SCENE)
        if not result.success:
            return AIEditScenePatchResult(result=result)
        return AIEditScenePatchResult(
            result=result, patch=[{"op": "replace", "path": "/x"}], change_summary="Edited."
        )

    def create_scene3d(self, request: AICreateScene3DRequest) -> AIOperationResult3D:
        return self._next_result3d(AIOperation.CREATE_SCENE)

    def edit_scene3d_with_patch(self, request: AIEditScene3DRequest) -> AIEditScene3DPatchResult:
        result = self._next_result3d(AIOperation.EDIT_SCENE)
        if not result.success:
            return AIEditScene3DPatchResult(result=result)
        return AIEditScene3DPatchResult(
            result=result, patch=[{"op": "replace", "path": "/x"}], change_summary="Edited."
        )


def _install_fake_provider(
    monkeypatch, outcomes: list[dict | AIErrorCategory]
) -> _QueuedFakeProvider:
    provider = _QueuedFakeProvider(outcomes)
    monkeypatch.setattr(ai_api, "get_ai_provider", lambda: provider)
    return provider


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="ai-runs-owner")


@pytest.fixture
def other_user(db):
    return get_user_model().objects.create_user(username="ai-runs-other")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.fixture
def other_client(other_user):
    client = APIClient()
    client.force_authenticate(other_user)
    return client


@pytest.fixture
def project(owner):
    return Project.objects.create(owner=owner)


@pytest.fixture
def project3d(owner):
    return Project3D.objects.create(owner=owner)


def _start_create_run(owner, project) -> AIRun:
    return ai_runs.start_run(
        owner=owner,
        target_type=AIRun.TargetType.PROJECT,
        target=project,
        operation=AIRun.Operation.CREATE,
        prompt="a red square",
    )


def _enable_retries(owner, max_retries: int = 2) -> None:
    AIRetryPreference.objects.create(owner=owner, auto_retry_enabled=True, max_retries=max_retries)


@pytest.mark.django_db
def test_start_persists_structured_plan_before_provider_attempt(owner, project):
    run = _start_create_run(owner, project)

    assert run.plan == {
        "revision": 1,
        "scope": "overhaul",
        "steps": [{"id": "step-1", "action": "generate_scene", "target_ids": []}],
        "target_ids": [],
        "success_criteria": [{"type": "renders_nonblank", "parameters": {"target": "scene"}}],
    }


def test_evaluate_criteria_supports_all_plan_criterion_types():
    scene = copy.deepcopy(BLANK_SCENE)
    scene["canvas"]["backgroundColor"] = "#123456"
    plan = {
        "success_criteria": [
            {"type": "object_exists", "parameters": {"id": "layer-1"}},
            {
                "type": "property_equals",
                "parameters": {"path": "/canvas/backgroundColor", "value": "#123456"},
            },
            {"type": "count_between", "parameters": {"path": "/layers", "min": 1, "max": 1}},
            {"type": "renders_nonblank", "parameters": {"target": "scene"}},
        ]
    }

    results = ai_runs.evaluate_criteria(plan, scene)

    assert [result["passed"] for result in results] == [True, True, True, True]


@pytest.mark.django_db
def test_selection_plan_rejects_unknown_scene_ids(owner, project):
    base = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = base
    project.save(update_fields=["current_version"])

    with pytest.raises(ai_runs.InvalidTarget, match="not present"):
        ai_runs.start_run(
            owner=owner,
            target_type=AIRun.TargetType.PROJECT,
            target=project,
            operation=AIRun.Operation.EDIT_PATCH,
            scope=AIRun.Scope.SELECTION,
            selected_target_ids=["missing-id"],
            prompt="make it blue",
        )


# --- Happy path: 2D and 3D create runs --------------------------------------


@pytest.mark.django_db
def test_2d_create_run_reaches_awaiting_review_and_charges_once(monkeypatch, owner, project):
    _install_fake_provider(monkeypatch, [BLANK_SCENE])

    run = _start_create_run(owner, project)
    assert run.status == AIRun.Status.RUNNING

    run = ai_runs.advance_run(run)

    assert run.status == AIRun.Status.AWAITING_REVIEW
    assert run.attempts == 1
    assert run.candidate_scene_json == BLANK_SCENE
    assert run.charged is True
    assert run.usage_prompt_tokens == 10

    # A second advance call on an already-awaiting-review run must never
    # perform another provider call or charge quota twice.
    with pytest.raises(ai_runs.NotRunning):
        ai_runs.advance_run(run)

    key = ai_api._quota_cache_key(owner.id, operation="run_create")
    assert ai_api._current_count(key) == 1


@pytest.mark.django_db
def test_3d_create_run_reaches_awaiting_review(monkeypatch, owner, project3d):
    _install_fake_provider(monkeypatch, [MINIMAL_SCENE_3D])

    run = ai_runs.start_run(
        owner=owner,
        target_type=AIRun.TargetType.PROJECT3D,
        target=project3d,
        operation=AIRun.Operation.CREATE,
        prompt="a small cube",
    )
    run = ai_runs.advance_run(run)

    assert run.status == AIRun.Status.AWAITING_REVIEW
    assert run.candidate_scene_json == MINIMAL_SCENE_3D


@pytest.mark.django_db
def test_3d_edit_selection_invalid_material_then_repaired(monkeypatch, owner, project3d):
    """Issue #463's own fixture: a fake invalid material/geometry response
    (simulating the provider's structured 3D output failing schema
    validation), then a repaired, valid result -- proves the exact same
    repairable-failure path 2D edit runs already go through
    (`test_invalid_output_then_successful_repair`) also works for a
    selection-scoped 3D edit, without any 3D-specific branch in
    `ai_runs.py` itself."""
    base = SceneVersion3D.objects.create(
        project=project3d,
        sequence=1,
        scene_json=MINIMAL_SCENE_3D,
        created_by=owner,
        origin=SceneVersion3D.Origin.MANUAL,
    )
    project3d.current_version = base
    project3d.save(update_fields=["current_version"])

    repaired_scene = copy.deepcopy(MINIMAL_SCENE_3D)
    _install_fake_provider(monkeypatch, [AIErrorCategory.INVALID_STRUCTURED_OUTPUT, repaired_scene])
    _enable_retries(owner)

    run = ai_runs.start_run(
        owner=owner,
        target_type=AIRun.TargetType.PROJECT3D,
        target=project3d,
        operation=AIRun.Operation.EDIT_PATCH,
        scope=AIRun.Scope.SELECTION,
        selected_target_ids=["scene3d-minimal"],
        prompt="make the cube blue",
    )
    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.RUNNING
    assert run.repairs == 1
    assert "scene3d-minimal" in ai_runs._augmented_prompt(run)

    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.AWAITING_REVIEW
    assert run.candidate_scene_json == repaired_scene


@pytest.mark.django_db
def test_3d_accept_creates_exactly_one_scene_version_3d(monkeypatch, owner, project3d):
    _install_fake_provider(monkeypatch, [MINIMAL_SCENE_3D])
    run = ai_runs.start_run(
        owner=owner,
        target_type=AIRun.TargetType.PROJECT3D,
        target=project3d,
        operation=AIRun.Operation.CREATE,
        prompt="a small cube",
    )
    run = ai_runs.advance_run(run)

    run, version = ai_runs.accept_run(run)

    assert run.status == AIRun.Status.ACCEPTED
    assert isinstance(version, SceneVersion3D)
    assert version.origin == SceneVersion3D.Origin.AI_CREATE
    project3d.refresh_from_db()
    assert project3d.current_version_id == version.id
    assert SceneVersion3D.objects.filter(project=project3d).count() == 1


@pytest.mark.django_db
def test_3d_stale_base_at_accept_fails_the_run_and_creates_no_version(
    monkeypatch, owner, project3d
):
    """Issue #463's own fixture: a concurrent owner update changes the
    base version between a 3D run's start and its Accept -- must fail
    exactly like the 2D counterpart
    (`test_stale_base_at_accept_fails_the_run_and_creates_no_version`),
    with an explicit `stale_base` reason and no new version created."""
    base = SceneVersion3D.objects.create(
        project=project3d,
        sequence=1,
        scene_json=MINIMAL_SCENE_3D,
        created_by=owner,
        origin=SceneVersion3D.Origin.MANUAL,
    )
    project3d.current_version = base
    project3d.save(update_fields=["current_version"])

    edited_scene = copy.deepcopy(MINIMAL_SCENE_3D)
    _install_fake_provider(monkeypatch, [edited_scene])
    run = ai_runs.start_run(
        owner=owner,
        target_type=AIRun.TargetType.PROJECT3D,
        target=project3d,
        operation=AIRun.Operation.EDIT_PATCH,
        prompt="edit it",
    )
    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.AWAITING_REVIEW

    # A concurrent owner update (e.g. a manual save from another tab)
    # moved current_version since this run started.
    other_version = SceneVersion3D.objects.create(
        project=project3d,
        sequence=2,
        scene_json=MINIMAL_SCENE_3D,
        created_by=owner,
        origin=SceneVersion3D.Origin.MANUAL,
    )
    project3d.current_version = other_version
    project3d.save(update_fields=["current_version"])

    run, version = ai_runs.accept_run(run)
    assert run.status == AIRun.Status.FAILED
    assert run.error_reason == "stale_base"
    assert version is None
    assert SceneVersion3D.objects.filter(project=project3d).count() == 2


# --- Invalid-then-repair, repeated-invalid, timeout -------------------------


@pytest.mark.django_db
def test_invalid_output_then_successful_repair(monkeypatch, owner, project):
    _install_fake_provider(monkeypatch, [AIErrorCategory.INVALID_STRUCTURED_OUTPUT, BLANK_SCENE])
    _enable_retries(owner)

    run = _start_create_run(owner, project)
    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.RUNNING
    assert run.attempts == 1
    assert run.repairs == 1
    assert "simulated invalid_structured_output" in run.validation_summary

    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.AWAITING_REVIEW
    assert run.attempts == 2
    assert run.candidate_scene_json == BLANK_SCENE


@pytest.mark.django_db
def test_criteria_failure_retries_from_preference_and_charges_each_attempt(
    monkeypatch, owner, project
):
    passing_scene = copy.deepcopy(BLANK_SCENE)
    passing_scene["canvas"]["backgroundColor"] = "#123456"
    _install_fake_provider(monkeypatch, [BLANK_SCENE, passing_scene])
    _enable_retries(owner, max_retries=1)

    run = _start_create_run(owner, project)
    run.plan = {
        **run.plan,
        "success_criteria": [
            {
                "type": "property_equals",
                "parameters": {"path": "/canvas/backgroundColor", "value": "#123456"},
            }
        ],
    }
    run.save(update_fields=["plan"])

    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.RUNNING
    assert run.candidate_scene_json is None
    assert run.criterion_results[0]["results"][0]["passed"] is False
    assert "backgroundColor" in run.validation_summary

    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.AWAITING_REVIEW
    assert run.candidate_scene_json == passing_scene
    assert len(run.criterion_results) == 2
    assert all(result["passed"] for result in run.criterion_results[1]["results"])
    assert ai_api._current_count(ai_api._quota_cache_key(owner.id, operation="run_create")) == 2


@pytest.mark.django_db
def test_disabled_retry_preference_fails_after_one_criterion_attempt(monkeypatch, owner, project):
    _install_fake_provider(monkeypatch, [BLANK_SCENE])
    run = _start_create_run(owner, project)
    run.plan = {
        **run.plan,
        "success_criteria": [
            {
                "type": "property_equals",
                "parameters": {"path": "/canvas/backgroundColor", "value": "#123456"},
            }
        ],
    }
    run.save(update_fields=["plan"])

    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.FAILED
    assert run.error_reason == "criteria_failed"
    assert run.attempts == 1
    assert run.candidate_scene_json is None
    with pytest.raises(ai_runs.NotRunning):
        ai_runs.advance_run(run)


@pytest.mark.django_db
def test_repeated_invalid_output_exhausts_attempts_and_fails(monkeypatch, owner, project):
    _install_fake_provider(
        monkeypatch,
        [AIErrorCategory.INVALID_STRUCTURED_OUTPUT] * 3,
    )
    _enable_retries(owner)

    run = _start_create_run(owner, project)
    for _ in range(2):
        run = ai_runs.advance_run(run)
        assert run.status == AIRun.Status.RUNNING

    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.FAILED
    assert run.error_reason == "repeated_invalid_output"
    assert run.attempts == 3
    assert run.charged is True


@pytest.mark.django_db
def test_repeated_timeout_exhausts_attempts_and_fails(monkeypatch, owner, project):
    _install_fake_provider(monkeypatch, [AIErrorCategory.TIMEOUT] * 3)
    _enable_retries(owner)

    run = _start_create_run(owner, project)
    for _ in range(2):
        run = ai_runs.advance_run(run)
        assert run.status == AIRun.Status.RUNNING

    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.FAILED
    assert run.error_reason == "timeout"


@pytest.mark.django_db
def test_wall_clock_deadline_expires_run_without_a_provider_call(monkeypatch, owner, project):
    provider = _install_fake_provider(monkeypatch, [BLANK_SCENE])

    run = _start_create_run(owner, project)
    from django.utils import timezone as dj_timezone

    run.deadline_at = dj_timezone.now() - dj_timezone.timedelta(seconds=1)
    run.save(update_fields=["deadline_at"])

    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.FAILED
    assert run.error_reason == "timeout_budget_exhausted"
    assert provider.calls == 0


# --- Out-of-scope / selection-scoped edit -----------------------------------


@pytest.mark.django_db
def test_selection_scope_augments_prompt_with_target_ids(monkeypatch, owner, project):
    base = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = base
    project.save(update_fields=["current_version"])

    run = ai_runs.start_run(
        owner=owner,
        target_type=AIRun.TargetType.PROJECT,
        target=project,
        operation=AIRun.Operation.EDIT_PATCH,
        scope=AIRun.Scope.SELECTION,
        selected_target_ids=["scene-blank", "layer-1"],
        prompt="make it blue",
    )
    prompt = ai_runs._augmented_prompt(run)
    assert "scene-blank" in prompt
    assert "layer-1" in prompt


@pytest.mark.django_db
def test_out_of_scope_patch_rejection_is_repairable_then_succeeds(monkeypatch, owner, project):
    """Simulates `scenes.patch`'s own prompt-reference scope check
    rejecting a patch that touched an element outside the selection --
    that rejection surfaces as a normal `PROVIDER_REJECTION` from
    `edit_scene_with_patch`, which this run must treat exactly like any
    other repairable failure (feed it back, try again), not a special
    case ai_runs.py needs to reimplement."""
    base = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = base
    project.save(update_fields=["current_version"])

    edited_scene = copy.deepcopy(BLANK_SCENE)
    _install_fake_provider(monkeypatch, [AIErrorCategory.PROVIDER_REJECTION, edited_scene])
    _enable_retries(owner)

    run = ai_runs.start_run(
        owner=owner,
        target_type=AIRun.TargetType.PROJECT,
        target=project,
        operation=AIRun.Operation.EDIT_PATCH,
        scope=AIRun.Scope.SELECTION,
        selected_target_ids=["layer-1"],
        prompt="make layer-1 blue",
    )
    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.RUNNING
    assert run.repairs == 1

    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.AWAITING_REVIEW
    assert run.candidate_scene_json == edited_scene


# --- Accept: creates exactly one version, stale base, duplicate accept -----


@pytest.mark.django_db
def test_accept_creates_exactly_one_version_and_charges_quota_once(monkeypatch, owner, project):
    _install_fake_provider(monkeypatch, [BLANK_SCENE])
    run = _start_create_run(owner, project)
    run = ai_runs.advance_run(run)

    run, version = ai_runs.accept_run(run)

    assert run.status == AIRun.Status.ACCEPTED
    assert isinstance(version, SceneVersion)
    assert version.origin == SceneVersion.Origin.AI_CREATE
    project.refresh_from_db()
    assert project.current_version_id == version.id
    assert SceneVersion.objects.filter(project=project).count() == 1


@pytest.mark.django_db
def test_duplicate_accept_is_idempotent(monkeypatch, owner, project):
    _install_fake_provider(monkeypatch, [BLANK_SCENE])
    run = _start_create_run(owner, project)
    run = ai_runs.advance_run(run)

    run, first_version = ai_runs.accept_run(run)
    run, second_version = ai_runs.accept_run(run)

    assert first_version.id == second_version.id
    assert SceneVersion.objects.filter(project=project).count() == 1


@pytest.mark.django_db
def test_stale_base_at_accept_fails_the_run_and_creates_no_version(monkeypatch, owner, project):
    base = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = base
    project.save(update_fields=["current_version"])

    edited_scene = copy.deepcopy(BLANK_SCENE)
    _install_fake_provider(monkeypatch, [edited_scene])
    run = ai_runs.start_run(
        owner=owner,
        target_type=AIRun.TargetType.PROJECT,
        target=project,
        operation=AIRun.Operation.EDIT_PATCH,
        prompt="edit it",
    )
    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.AWAITING_REVIEW

    # Someone else's save moved current_version since the run started.
    other_version = SceneVersion.objects.create(
        project=project,
        sequence=2,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
        parent=base,
    )
    project.current_version = other_version
    project.save(update_fields=["current_version"])

    run, version = ai_runs.accept_run(run)
    assert run.status == AIRun.Status.FAILED
    assert run.error_reason == "stale_base"
    assert version is None
    assert SceneVersion.objects.filter(project=project).count() == 2


# --- Cancel: prevents further advance/accept --------------------------------


@pytest.mark.django_db
def test_cancel_running_run_prevents_further_advance(monkeypatch, owner, project):
    provider = _install_fake_provider(monkeypatch, [BLANK_SCENE])
    run = _start_create_run(owner, project)

    run = ai_runs.cancel_run(run)
    assert run.status == AIRun.Status.CANCELLED

    with pytest.raises(ai_runs.NotRunning):
        ai_runs.advance_run(run)
    assert provider.calls == 0


@pytest.mark.django_db
def test_cancel_awaiting_review_run_prevents_accept(monkeypatch, owner, project):
    _install_fake_provider(monkeypatch, [BLANK_SCENE])
    run = _start_create_run(owner, project)
    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.AWAITING_REVIEW

    run = ai_runs.cancel_run(run)
    assert run.status == AIRun.Status.CANCELLED

    with pytest.raises(ai_runs.NotAwaitingReview):
        ai_runs.accept_run(run)
    assert SceneVersion.objects.filter(project=project).count() == 0


@pytest.mark.django_db
def test_cancel_is_a_no_op_on_an_already_terminal_run(monkeypatch, owner, project):
    _install_fake_provider(monkeypatch, [AIErrorCategory.QUOTA_EXCEEDED])
    run = _start_create_run(owner, project)
    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.FAILED

    run = ai_runs.cancel_run(run)
    assert run.status == AIRun.Status.FAILED
    assert run.cancelled_at is None


# --- API layer: auth, ownership, serialization ------------------------------


@pytest.mark.django_db
def test_start_run_api_requires_authentication(project):
    response = APIClient().post(
        "/api/ai/runs/",
        {
            "target_type": "project",
            "project_id": str(project.public_id),
            "operation": "create",
            "prompt": "a red square",
        },
        format="json",
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_start_run_api_404s_for_a_foreign_project(other_client, project):
    response = other_client.post(
        "/api/ai/runs/",
        {
            "target_type": "project",
            "project_id": str(project.public_id),
            "operation": "create",
            "prompt": "a red square",
        },
        format="json",
    )
    assert response.status_code == 404
    assert AIRun.objects.count() == 0


@pytest.mark.django_db
def test_run_detail_advance_cancel_404_for_non_owner(
    monkeypatch, owner_client, other_client, owner, project
):
    _install_fake_provider(monkeypatch, [BLANK_SCENE])
    run = _start_create_run(owner, project)

    for path in (f"/api/ai/runs/{run.pk}/",):
        assert other_client.get(path).status_code == 404
    for path in (
        f"/api/ai/runs/{run.pk}/advance/",
        f"/api/ai/runs/{run.pk}/cancel/",
        f"/api/ai/runs/{run.pk}/accept/",
    ):
        assert other_client.post(path).status_code == 404


@pytest.mark.django_db
def test_full_api_lifecycle_start_advance_accept(monkeypatch, owner_client, project):
    _install_fake_provider(monkeypatch, [BLANK_SCENE])

    start = owner_client.post(
        "/api/ai/runs/",
        {
            "target_type": "project",
            "project_id": str(project.public_id),
            "operation": "create",
            "prompt": "a red square",
        },
        format="json",
    )
    assert start.status_code == 201
    run_id = start.json()["id"]
    assert start.json()["status"] == AIRun.Status.RUNNING
    assert start.json()["plan"]["revision"] == 1
    assert start.json()["plan"]["scope"] == "overhaul"
    assert start.json()["plan"]["success_criteria"][0]["type"] == "renders_nonblank"

    advance = owner_client.post(f"/api/ai/runs/{run_id}/advance/")
    assert advance.status_code == 200
    assert advance.json()["status"] == AIRun.Status.AWAITING_REVIEW
    assert advance.json()["candidate_scene"] == BLANK_SCENE

    accept = owner_client.post(f"/api/ai/runs/{run_id}/accept/")
    assert accept.status_code == 200
    assert accept.json()["status"] == AIRun.Status.ACCEPTED

    project.refresh_from_db()
    assert project.current_version is not None


@pytest.mark.django_db
def test_detail_get_never_triggers_a_provider_call(monkeypatch, owner_client, owner, project):
    _install_fake_provider(monkeypatch, [BLANK_SCENE])
    run = _start_create_run(owner, project)

    def _explode():
        raise AssertionError("GET /api/ai/runs/<id>/ must never call the provider.")

    monkeypatch.setattr(ai_api, "get_ai_provider", _explode)

    response = owner_client.get(f"/api/ai/runs/{run.pk}/")
    assert response.status_code == 200
    assert response.json()["status"] == AIRun.Status.RUNNING
    assert response.json()["plan"] == run.plan


# --- PostgreSQL-only: genuine concurrent advance lease enforcement ----------

pytestmark_postgres = pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping PostgreSQL-backed tests.",
)


@pytestmark_postgres
@pytest.mark.django_db(databases=["default", "postgres_test"], transaction=True)
def test_postgres_concurrent_advance_calls_never_double_attempt(django_db_blocker, monkeypatch):
    """Two genuinely overlapping `advance` calls on the same run must
    never both perform a provider call: the lease means exactly one
    proceeds and the other gets a documented 409 `advance_in_progress`.
    """
    with django_db_blocker.unblock():
        User = get_user_model()
        user = User.objects.db_manager("postgres_test").create_user(
            username="ai-runs-concurrent-user"
        )
        project = Project.objects.using("postgres_test").create(owner=user)

        started = threading.Event()
        release = threading.Event()
        call_count = {"n": 0}
        lock = threading.Lock()

        class _SlowProvider:
            def create_scene(self, request):
                with lock:
                    call_count["n"] += 1
                started.set()
                release.wait(timeout=5)
                return AIOperationResult(
                    operation=AIOperation.CREATE_SCENE, usage=_USAGE, scene=BLANK_SCENE
                )

        monkeypatch.setattr(ai_api, "get_ai_provider", lambda: _SlowProvider())
        # Entitlement caps are orthogonal to the lease/concurrency
        # behavior under test here (already covered by the SQLite-backed
        # quota tests above), and depending on `postgres_test`'s own copy
        # of the seeded default-plan data migration would make this test
        # fragile to how that disposable database was created.
        monkeypatch.setattr(ai_runs, "get_effective_cap", lambda user, feature_key: 1000)

        client = APIClient()
        client.force_authenticate(user)
        results = []
        barrier = threading.Barrier(2)
        started_run: dict[str, AIRun] = {}

        def do_start():
            # Issue #461 test note: Django's per-test `databases=[...]`
            # guard is applied to the *main thread's* `connections`
            # registry only (at `setUpClass` time) -- a freshly spawned
            # thread gets its own unguarded connection, which is exactly
            # how `test_ai_accept_proposal_api.py`'s own postgres
            # concurrency tests get away with unrouted "default" queries
            # under `route_default_to_postgres_test()`. `start_run`
            # itself makes such unrouted queries (`get_effective_cap`
            # etc), so it must run on a worker thread too, not the main
            # thread, even though it isn't part of the actual race being
            # tested here.
            try:
                started_run["run"] = ai_runs.start_run(
                    owner=user,
                    target_type=AIRun.TargetType.PROJECT,
                    target=project,
                    operation=AIRun.Operation.CREATE,
                    prompt="a red square",
                )
            finally:
                close_thread_connections()

        def do_advance():
            barrier.wait()
            try:
                response = client.post(f"/api/ai/runs/{started_run['run'].pk}/advance/")
                results.append(response.status_code)
            finally:
                close_thread_connections()

        with route_default_to_postgres_test():
            start_thread = threading.Thread(target=do_start)
            start_thread.start()
            start_thread.join()
            run = started_run["run"]

            threads = [threading.Thread(target=do_advance) for _ in range(2)]
            for t in threads:
                t.start()
            started.wait(timeout=5)
            release.set()
            for t in threads:
                t.join()

        assert sorted(results) == [200, 409]
        assert call_count["n"] == 1
        run.refresh_from_db(using="postgres_test")
        assert run.status == AIRun.Status.AWAITING_REVIEW
