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
from datetime import timedelta
from pathlib import Path

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

import scenes.ai_api as ai_api
from ai_provider.e2e_provider import build_e2e_provider
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
from scenes.models import (
    AIRetryPreference,
    AIRun,
    Project,
    Project3D,
    ProjectActivity,
    SceneVersion,
    SceneVersion3D,
    validate_activity_metadata,
)
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

    plan["scope"] = "unknown"
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


def test_target_scope_ignores_document_identity_but_guards_document_fields_and_order():
    before = {
        "id": "scene-before",
        "canvas": {"width": 800, "height": 600},
        "layers": [{"id": "layer-1"}],
        "shapes": [
            {"id": "shape-a", "type": "circle", "x": 1},
            {"id": "shape-b", "type": "rect", "x": 1},
        ],
    }
    edited = copy.deepcopy(before)
    edited["id"] = "scene-after"
    edited["shapes"][0]["x"] = 2
    target_plan = {"scope": "targets", "target_ids": ["shape-a"]}

    assert ai_runs._validate_candidate_scope(target_plan, before, edited) is None

    edited["canvas"]["width"] = 900
    assert ai_runs._validate_candidate_scope(target_plan, before, edited) == (
        "target-scoped plans cannot modify document-level fields."
    )

    reordered = copy.deepcopy(before)
    reordered["shapes"].reverse()
    assert ai_runs._validate_candidate_scope(target_plan, before, reordered) == (
        "target-scoped plans cannot reorder scene elements."
    )


def test_overhaul_treats_root_document_id_as_identity_not_removable_element():
    before = {"id": "scene-before", "layers": [{"id": "layer-1"}], "shapes": []}
    after = {
        "id": "scene-after",
        "layers": [{"id": "layer-1"}],
        "shapes": [{"id": "shape-new", "type": "circle"}],
    }

    assert ai_runs._validate_candidate_scope({"scope": "overhaul"}, before, after) is None


class _QueuedFakeProvider:
    """Returns one canned outcome per call, in order. Each outcome is
    either a scene dict (success) or an `AIErrorCategory` (failure). A
    run only ever calls one of the four methods repeatedly (its
    `target_type`/`operation` never change mid-run), so one shared queue
    is enough."""

    def __init__(self, outcomes: list[dict | AIErrorCategory]) -> None:
        self._outcomes = list(outcomes)
        self.calls = 0
        self.prompts: list[str] = []

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
        self.prompts.append(request.prompt)
        return self._next_result(AIOperation.CREATE_SCENE)

    def edit_scene(self, request: AIEditSceneRequest) -> AIOperationResult:
        return self.edit_scene_with_patch(request).result

    def edit_scene_with_patch(self, request: AIEditSceneRequest) -> AIEditScenePatchResult:
        self.prompts.append(request.prompt)
        result = self._next_result(AIOperation.EDIT_SCENE)
        if not result.success:
            return AIEditScenePatchResult(result=result)
        return AIEditScenePatchResult(
            result=result, patch=[{"op": "replace", "path": "/x"}], change_summary="Edited."
        )

    def create_scene3d(self, request: AICreateScene3DRequest) -> AIOperationResult3D:
        self.prompts.append(request.prompt)
        return self._next_result3d(AIOperation.CREATE_SCENE)

    def edit_scene3d_with_patch(self, request: AIEditScene3DRequest) -> AIEditScene3DPatchResult:
        self.prompts.append(request.prompt)
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


def _awaiting_review_2d_run(monkeypatch, owner, project) -> AIRun:
    _install_fake_provider(monkeypatch, [BLANK_SCENE])
    run = _start_create_run(owner, project)
    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.AWAITING_REVIEW
    return run


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


@pytest.mark.django_db
def test_intent_note_snapshot_is_included_in_digest_and_provider_prompt(
    monkeypatch, owner, project
):
    project.brief = "Keep it warm and playful."
    project.save(update_fields=["brief"])
    provider = _install_fake_provider(monkeypatch, [BLANK_SCENE])

    run = _start_create_run(owner, project)

    assert run.intent_note == "Keep it warm and playful."
    assert run.input_digest == ai_runs._digest({}, intent_note=run.intent_note)
    assert run.input_digest != ai_runs._digest({})
    assert "UNTRUSTED PROJECT INTENT NOTE" in ai_runs._augmented_prompt(run)
    assert '"Keep it warm and playful."' in ai_runs._augmented_prompt(run)

    project.brief = "Use a cold palette instead."
    project.save(update_fields=["brief"])
    run = ai_runs.advance_run(run)

    assert run.status == AIRun.Status.AWAITING_REVIEW
    assert "Keep it warm and playful." in provider.prompts[0]
    assert "Use a cold palette instead." not in provider.prompts[0]


@pytest.mark.django_db
def test_intent_note_opt_out_keeps_legacy_prompt_and_digest(monkeypatch, owner, project):
    project.brief = "Keep it warm and playful."
    project.save(update_fields=["brief"])

    run = ai_runs.start_run(
        owner=owner,
        target_type=AIRun.TargetType.PROJECT,
        target=project,
        operation=AIRun.Operation.CREATE,
        prompt="a red square",
        use_intent_notes=False,
    )

    assert run.intent_note == ""
    assert run.input_digest == ai_runs._digest({})
    assert ai_runs._augmented_prompt(run) == "a red square"


@pytest.mark.django_db
def test_repair_attempt_uses_the_same_intent_snapshot_after_project_note_changes(
    monkeypatch, owner, project
):
    project.brief = "Keep the layout spare."
    project.save(update_fields=["brief"])
    provider = _install_fake_provider(
        monkeypatch, [AIErrorCategory.INVALID_STRUCTURED_OUTPUT, BLANK_SCENE]
    )
    _enable_retries(owner)
    run = _start_create_run(owner, project)

    run = ai_runs.advance_run(run)
    assert run.status == AIRun.Status.RUNNING
    project.brief = "Fill every corner."
    project.save(update_fields=["brief"])
    run = ai_runs.advance_run(run)

    assert run.status == AIRun.Status.AWAITING_REVIEW
    assert len(provider.prompts) == 2
    assert all('"Keep the layout spare."' in prompt for prompt in provider.prompts)
    assert all("Fill every corner." not in prompt for prompt in provider.prompts)


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


@pytest.mark.django_db
def test_add_asset_layer_run_uses_descriptor_and_preserves_existing_scene(
    monkeypatch, owner, project
):
    base = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = base
    project.save(update_fields=["current_version"])
    monkeypatch.setattr(
        ai_runs,
        "_provider_for_user",
        lambda *args, **kwargs: build_e2e_provider("add-asset-layer"),
    )
    asset = {
        "id": "asset-local-1",
        "name": "Reference",
        "mime": "image/png",
        "width": 320,
        "height": 240,
    }

    run = ai_runs.start_run(
        owner=owner,
        target_type=AIRun.TargetType.PROJECT,
        target=project,
        operation=AIRun.Operation.EDIT_PATCH,
        scope=AIRun.Scope.ADD_LAYER,
        selected_target_ids=[asset["id"]],
        assets=[asset],
        prompt="add this media asset as a new layer",
    )
    advanced = ai_runs.advance_run(run)

    assert advanced.status == AIRun.Status.AWAITING_REVIEW, (
        advanced.error_reason,
        advanced.validation_summary,
    )
    assert advanced.plan["scope"] == "add-layer"
    assert "only assets you may reference" in ai_runs._augmented_prompt(advanced)
    augmented = ai_runs._augmented_prompt(advanced)
    assert "two new records as JSON Patch operations" in augmented
    assert "one complete layer object at /layers/-" in augmented
    assert "one complete image shape object at /shapes/-" in augmented
    assert "layer id must be fresh" in augmented
    assert "do not reuse the existing base layer" in augmented
    assert "selected asset id as an existing scene element id" in augmented
    assert "Only modify the following existing element id(s)" not in augmented
    candidate = advanced.candidate_scene_json
    assert candidate is not None
    assert candidate["layers"][:-1] == BLANK_SCENE["layers"]
    added = [
        shape
        for shape in candidate["shapes"]
        if shape["id"] not in {s["id"] for s in BLANK_SCENE["shapes"]}
    ]
    assert len(added) == 1
    assert added[0]["type"] == "image"
    assert added[0]["mediaAssetId"] == asset["id"]


def _asset_layer_candidate(media_asset_id: str = "asset-local-1") -> dict:
    candidate = copy.deepcopy(BLANK_SCENE)
    candidate["layers"].append(
        {
            "id": "ai-asset-layer-1",
            "name": "Reference",
            "order": 1,
            "visible": True,
            "locked": False,
        }
    )
    candidate["shapes"].append(
        {
            "id": "ai-asset-image-1",
            "type": "image",
            "layerId": "ai-asset-layer-1",
            "groupId": None,
            "transform": {
                "x": 400,
                "y": 300,
                "scaleX": 1,
                "scaleY": 1,
                "rotation": 0,
                "opacity": 1,
            },
            "style": {"fill": None, "stroke": None, "strokeWidth": 0},
            "name": "Reference",
            "mediaAssetId": media_asset_id,
            "altText": "Reference",
        }
    )
    return candidate


def test_add_layer_scope_preserves_existing_layers_and_shapes_only():
    candidate = _asset_layer_candidate()
    candidate["layers"][0]["locked"] = True

    error = ai_runs._validate_candidate_scope({"scope": "add-layer"}, BLANK_SCENE, candidate)

    assert error == "add-layer scope cannot modify existing element IDs: ['layer-1']."


def test_add_layer_scope_requires_exactly_one_new_layer():
    candidate = _asset_layer_candidate()
    candidate["layers"].append(
        {
            "id": "ai-asset-layer-2",
            "name": "Unexpected second layer",
            "order": 2,
            "visible": True,
            "locked": False,
        }
    )

    error = ai_runs._validate_candidate_scope({"scope": "add-layer"}, BLANK_SCENE, candidate)

    assert error == "add-layer scope must add exactly one new layer."


def test_add_layer_scope_rejects_foreign_media_asset_id():
    candidate = _asset_layer_candidate(media_asset_id="asset-foreign")
    asset = {
        "id": "asset-local-1",
        "name": "Reference",
        "mime": "image/png",
        "width": 320,
        "height": 240,
    }

    error = ai_runs._validate_add_layer_assets(BLANK_SCENE, candidate, [asset], [asset["id"]])

    assert error == "image mediaAssetId 'asset-foreign' is not in the submitted assets."


def test_add_layer_normalization_builds_canonical_pair_when_provider_omits_layer():
    asset = {
        "id": "asset-local-1",
        "name": "Reference",
        "mime": "image/png",
        "width": 320,
        "height": 240,
    }
    provider_candidate = copy.deepcopy(BLANK_SCENE)
    provider_candidate["shapes"].append(
        {
            "id": "provider-image-1",
            "type": "image",
            "layerId": "layer-1",
            "groupId": None,
            "transform": {
                "x": 400,
                "y": 300,
                "scaleX": 1,
                "scaleY": 1,
                "rotation": 0,
                "opacity": 1,
            },
            "style": {"fill": None, "stroke": None, "strokeWidth": 0},
            "mediaAssetId": asset["id"],
            "altText": asset["name"],
        }
    )

    candidate, repaired_patch = ai_runs._normalize_add_layer_candidate(
        BLANK_SCENE,
        provider_candidate,
        [],
        [asset],
    )

    assert repaired_patch is not None
    assert len(candidate["layers"]) == len(BLANK_SCENE["layers"]) + 1
    assert len(candidate["shapes"]) == 1
    added_layer = candidate["layers"][-1]
    added_shape = candidate["shapes"][-1]
    assert added_layer["id"] != BLANK_SCENE["layers"][0]["id"]
    assert added_shape["layerId"] == added_layer["id"]
    assert added_shape["mediaAssetId"] == asset["id"]
    assert ai_runs._validate_candidate_scope({"scope": "add-layer"}, BLANK_SCENE, candidate) is None


def test_add_layer_normalization_rejects_provider_mutation_of_existing_layer():
    asset = {"id": "asset-local-1", "name": "Reference"}
    provider_candidate = copy.deepcopy(BLANK_SCENE)
    provider_candidate["layers"][0]["locked"] = True

    candidate, patch = ai_runs._normalize_add_layer_candidate(
        BLANK_SCENE,
        provider_candidate,
        [],
        [asset],
    )

    assert candidate == provider_candidate
    assert patch == []


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
def test_fake_provider_agent_create_runs_reach_review_for_both_scene_families(
    monkeypatch, owner, project, project3d
):
    from ai_provider.e2e_provider import build_e2e_provider

    monkeypatch.setattr(
        ai_runs, "_provider_for_user", lambda *args, **kwargs: build_e2e_provider("success")
    )
    base2d = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = base2d
    project.save(update_fields=["current_version"])
    base3d = SceneVersion3D.objects.create(
        project=project3d,
        sequence=1,
        scene_json=MINIMAL_SCENE_3D,
        created_by=owner,
        origin=SceneVersion3D.Origin.MANUAL,
    )
    project3d.current_version = base3d
    project3d.save(update_fields=["current_version"])

    for target_type, target in (
        (AIRun.TargetType.PROJECT, project),
        (AIRun.TargetType.PROJECT3D, project3d),
    ):
        run = ai_runs.start_run(
            owner=owner,
            target_type=target_type,
            target=target,
            operation=AIRun.Operation.CREATE,
            prompt="create a small scene",
        )
        advanced = ai_runs.advance_run(run)
        assert advanced.status == AIRun.Status.AWAITING_REVIEW, (
            target_type,
            advanced.error_reason,
            advanced.validation_summary,
        )
        assert advanced.error_reason == ""


@pytest.mark.django_db
def test_fake_provider_agent_selection_edits_only_the_declared_target(
    monkeypatch, owner, project, project3d
):
    from ai_provider.e2e_provider import build_e2e_provider

    monkeypatch.setattr(
        ai_runs, "_provider_for_user", lambda *args, **kwargs: build_e2e_provider("success")
    )
    scene2d = copy.deepcopy(BLANK_SCENE)
    scene2d["layers"] = [
        {"id": "layer-target", "name": "Target", "order": 0, "visible": True, "locked": False},
        {"id": "layer-other", "name": "Other", "order": 1, "visible": True, "locked": False},
    ]
    scene2d["shapes"] = [
        {
            "id": "shape-target",
            "type": "circle",
            "layerId": "layer-target",
            "groupId": None,
            "transform": {"x": 20, "y": 20, "scaleX": 1, "scaleY": 1, "rotation": 0, "opacity": 1},
            "style": {"fill": "#ff0000", "stroke": None, "strokeWidth": 0},
            "radius": 10,
        },
        {
            "id": "shape-other",
            "type": "circle",
            "layerId": "layer-other",
            "groupId": None,
            "transform": {"x": 40, "y": 40, "scaleX": 1, "scaleY": 1, "rotation": 0, "opacity": 1},
            "style": {"fill": "#00ff00", "stroke": None, "strokeWidth": 0},
            "radius": 10,
        },
    ]
    scene3d = copy.deepcopy(MINIMAL_SCENE_3D)
    scene3d["objects"] = [
        {
            "id": "object-target",
            "type": "box",
            "groupId": None,
            "transform": {
                "position": {"x": 0, "y": 0, "z": 0},
                "rotation": {"x": 0, "y": 0, "z": 0},
                "scale": {"x": 1, "y": 1, "z": 1},
                "opacity": 1,
            },
            "material": {"color": "#ff0000"},
            "visible": True,
            "width": 1,
            "height": 1,
            "depth": 1,
        },
        {
            "id": "object-other",
            "type": "box",
            "groupId": None,
            "transform": {
                "position": {"x": 2, "y": 0, "z": 0},
                "rotation": {"x": 0, "y": 0, "z": 0},
                "scale": {"x": 1, "y": 1, "z": 1},
                "opacity": 1,
            },
            "material": {"color": "#00ff00"},
            "visible": True,
            "width": 1,
            "height": 1,
            "depth": 1,
        },
    ]

    version2d = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=scene2d,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = version2d
    project.save(update_fields=["current_version"])
    version3d = SceneVersion3D.objects.create(
        project=project3d,
        sequence=1,
        scene_json=scene3d,
        created_by=owner,
        origin=SceneVersion3D.Origin.MANUAL,
    )
    project3d.current_version = version3d
    project3d.save(update_fields=["current_version"])

    for target_type, target, target_id in (
        (AIRun.TargetType.PROJECT, project, "shape-target"),
        (AIRun.TargetType.PROJECT3D, project3d, "object-target"),
    ):
        run = ai_runs.start_run(
            owner=owner,
            target_type=target_type,
            target=target,
            operation=AIRun.Operation.EDIT_PATCH,
            scope=AIRun.Scope.SELECTION,
            selected_target_ids=[target_id],
            prompt="make the selected item blue",
        )
        assert (
            f"Only modify the following existing element id(s): {target_id}."
            in ai_runs._augmented_prompt(run)
        )
        advanced = ai_runs.advance_run(run)
        assert advanced.status == AIRun.Status.AWAITING_REVIEW, (
            target_type,
            advanced.error_reason,
            advanced.validation_summary,
        )
        assert advanced.error_reason == ""
        candidate = advanced.candidate_scene_json
        assert candidate is not None
        records = (
            candidate["shapes"] if target_type == AIRun.TargetType.PROJECT else candidate["objects"]
        )
        color_path = "style" if target_type == AIRun.TargetType.PROJECT else "material"
        target_record = next(record for record in records if record["id"] == target_id)
        other_record = next(record for record in records if record["id"] != target_id)
        assert (
            target_record[color_path][
                "fill" if target_type == AIRun.TargetType.PROJECT else "color"
            ]
            == "#3366ff"
        )
        assert (
            other_record[color_path]["fill" if target_type == AIRun.TargetType.PROJECT else "color"]
            != "#3366ff"
        )


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
def test_start_run_api_snapshots_opted_in_project_note_without_serializing_it(
    monkeypatch, owner_client, project
):
    project.brief = "A quiet, geometric composition."
    project.save(update_fields=["brief"])
    _install_fake_provider(monkeypatch, [BLANK_SCENE])

    response = owner_client.post(
        "/api/ai/runs/",
        {
            "target_type": "project",
            "project_id": str(project.public_id),
            "operation": "create",
            "prompt": "a red square",
        },
        format="json",
    )

    assert response.status_code == 201
    run = AIRun.objects.get(pk=response.json()["id"])
    assert run.intent_note == "A quiet, geometric composition."
    assert "intent_note" not in response.json()


@pytest.mark.django_db
def test_start_run_api_opt_out_does_not_snapshot_project_note(monkeypatch, owner_client, project):
    project.brief = "A quiet, geometric composition."
    project.save(update_fields=["brief"])
    _install_fake_provider(monkeypatch, [BLANK_SCENE])

    response = owner_client.post(
        "/api/ai/runs/",
        {
            "target_type": "project",
            "project_id": str(project.public_id),
            "operation": "create",
            "prompt": "a red square",
            "use_intent_notes": False,
        },
        format="json",
    )

    assert response.status_code == 201
    run = AIRun.objects.get(pk=response.json()["id"])
    assert run.intent_note == ""
    assert run.input_digest == ai_runs._digest({})
    assert "intent_note" not in response.json()


@pytest.mark.django_db
def test_accept_api_records_exact_2d_activity_and_is_idempotent(
    monkeypatch, owner, owner_client, project
):
    run = _awaiting_review_2d_run(monkeypatch, owner, project)
    run.change_summary = "s" * 250
    run.save(update_fields=["change_summary"])

    first = owner_client.post(
        f"/api/ai/runs/{run.pk}/accept/", {"reason": "  Keep the blue shape.  "}, format="json"
    )
    second = owner_client.post(
        f"/api/ai/runs/{run.pk}/accept/", {"reason": "retry reason is ignored"}, format="json"
    )

    assert first.status_code == second.status_code == 200
    assert first.json()["accepted_version_id"] == second.json()["accepted_version_id"]
    assert first.json()["status"] == second.json()["status"] == AIRun.Status.ACCEPTED
    run.refresh_from_db()
    activity = ProjectActivity.objects.get(project=project)
    assert run.status == AIRun.Status.ACCEPTED
    assert activity.actor_id == owner.id
    assert activity.action_type == ProjectActivity.ActionType.AI_PROPOSAL_ACCEPTED
    assert activity.metadata == {
        "run_id": run.pk,
        "scope": run.scope,
        "operation": run.operation,
        "change_summary": "s" * 200,
        "reason": "Keep the blue shape.",
    }
    validate_activity_metadata(activity.metadata)
    assert SceneVersion.objects.filter(project=project).count() == 1
    assert ProjectActivity.objects.filter(project=project).count() == 1


@pytest.mark.django_db
def test_cancel_api_records_only_first_awaiting_review_2d_discard(
    monkeypatch, owner, owner_client, project
):
    run = _awaiting_review_2d_run(monkeypatch, owner, project)
    first = owner_client.post(
        f"/api/ai/runs/{run.pk}/cancel/", {"reason": "  Not what I asked for.  "}, format="json"
    )
    second = owner_client.post(f"/api/ai/runs/{run.pk}/cancel/", format="json")

    assert first.status_code == second.status_code == 200
    assert first.json()["status"] == second.json()["status"] == AIRun.Status.CANCELLED
    run.refresh_from_db()
    activity = ProjectActivity.objects.get(project=project)
    assert run.status == AIRun.Status.CANCELLED
    assert activity.actor_id == owner.id
    assert activity.action_type == ProjectActivity.ActionType.AI_PROPOSAL_REJECTED
    assert activity.metadata == {
        "run_id": run.pk,
        "scope": run.scope,
        "operation": run.operation,
        "change_summary": run.change_summary[:200],
        "reason": "Not what I asked for.",
    }
    validate_activity_metadata(activity.metadata)
    assert ProjectActivity.objects.filter(project=project).count() == 1


@pytest.mark.parametrize(
    ("payload", "expected"),
    [
        ({}, None),
        ({"reason": None}, None),
        ({"reason": ""}, None),
        ({"reason": " \t\n "}, None),
        ({"reason": "r" * 280}, "r" * 280),
        ({"reason": "\u2003🙂\u2003"}, "🙂"),
        ({"reason": "a\x00b\x7fc\u0085é"}, "abcé"),
    ],
)
@pytest.mark.parametrize(
    ("endpoint", "action"),
    [
        ("accept", ProjectActivity.ActionType.AI_PROPOSAL_ACCEPTED),
        ("cancel", ProjectActivity.ActionType.AI_PROPOSAL_REJECTED),
    ],
)
@pytest.mark.django_db
def test_ai_run_decision_reason_normalization_and_omitted_response_shape(
    monkeypatch, owner, owner_client, project, payload, expected, endpoint, action
):
    run = _awaiting_review_2d_run(monkeypatch, owner, project)
    body = owner_client.post(f"/api/ai/runs/{run.pk}/{endpoint}/", payload, format="json")

    assert body.status_code == 200
    assert set(body.json()) == {
        "id",
        "status",
        "target_type",
        "project_id",
        "project3d_id",
        "operation",
        "scope",
        "selected_target_ids",
        "assets",
        "attempts",
        "repairs",
        "candidate_scene",
        "candidate_patch",
        "change_summary",
        "plan_summary",
        "plan",
        "auto_retry_enabled",
        "max_retries",
        "retries_remaining",
        "criterion_results",
        "validation_summary",
        "error_reason",
        "usage",
        "accepted_version_id",
        "created_at",
        "updated_at",
        "deadline_at",
        "cancelled_at",
    }
    activity = ProjectActivity.objects.get(project=project)
    assert activity.action_type == action
    assert activity.metadata.get("reason") == expected
    assert ("reason" in activity.metadata) is (expected is not None)


@pytest.mark.parametrize(
    "reason",
    [123, True, [], {}, "🙂" * 281],
)
@pytest.mark.parametrize("endpoint", ["accept", "cancel"])
@pytest.mark.django_db
def test_ai_run_decision_rejects_non_string_and_overlong_reason(
    monkeypatch, owner, owner_client, project, reason, endpoint
):
    run = _awaiting_review_2d_run(monkeypatch, owner, project)
    response = owner_client.post(
        f"/api/ai/runs/{run.pk}/{endpoint}/", {"reason": reason}, format="json"
    )

    assert response.status_code == 400
    assert response.json()["error"] == "request_invalid"
    assert "reason" in response.json()["detail"]
    assert ProjectActivity.objects.filter(project=project).count() == 0
    run.refresh_from_db()
    assert run.status == AIRun.Status.AWAITING_REVIEW


@pytest.mark.django_db
def test_running_and_terminal_cancel_do_not_record_discard_activity(
    monkeypatch, owner_client, owner, project
):
    running = _start_create_run(owner, project)
    response = owner_client.post(f"/api/ai/runs/{running.pk}/cancel/", format="json")
    assert response.status_code == 200
    assert response.json()["status"] == AIRun.Status.CANCELLED
    assert ProjectActivity.objects.filter(project=project).count() == 0

    failed = _start_create_run(owner, project)
    failed.status = AIRun.Status.FAILED
    failed.save(update_fields=["status"])
    response = owner_client.post(f"/api/ai/runs/{failed.pk}/cancel/", format="json")
    assert response.status_code == 200
    assert response.json()["status"] == AIRun.Status.FAILED
    assert ProjectActivity.objects.filter(project=project).count() == 0


@pytest.mark.django_db
def test_invalid_and_stale_2d_acceptance_do_not_record_activity(
    monkeypatch, owner_client, owner, project
):
    invalid = _start_create_run(owner, project)
    invalid.status = AIRun.Status.AWAITING_REVIEW
    invalid.candidate_scene_json = {"not": "a valid scene"}
    invalid.save(update_fields=["status", "candidate_scene_json"])
    invalid_response = owner_client.post(f"/api/ai/runs/{invalid.pk}/accept/", format="json")
    assert invalid_response.status_code == 409
    invalid.refresh_from_db()
    assert invalid.status == AIRun.Status.FAILED
    assert ProjectActivity.objects.filter(project=project).count() == 0

    base = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = base
    project.save(update_fields=["current_version"])
    stale = _start_create_run(owner, project)
    stale.status = AIRun.Status.AWAITING_REVIEW
    stale.candidate_scene_json = BLANK_SCENE
    stale.save(update_fields=["status", "candidate_scene_json"])
    newer = SceneVersion.objects.create(
        project=project,
        sequence=2,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
        parent=base,
    )
    project.current_version = newer
    project.save(update_fields=["current_version"])

    stale_response = owner_client.post(f"/api/ai/runs/{stale.pk}/accept/", format="json")
    assert stale_response.status_code == 409
    stale.refresh_from_db()
    assert stale.status == AIRun.Status.FAILED
    assert ProjectActivity.objects.filter(project=project).count() == 0


@pytest.mark.django_db
def test_3d_accept_and_discard_write_activity_to_the_3d_family_only(
    monkeypatch, owner_client, owner, project3d
):
    _install_fake_provider(monkeypatch, [MINIMAL_SCENE_3D, MINIMAL_SCENE_3D])
    accepted = ai_runs.start_run(
        owner=owner,
        target_type=AIRun.TargetType.PROJECT3D,
        target=project3d,
        operation=AIRun.Operation.CREATE,
        prompt="create a cube",
    )
    accepted = ai_runs.advance_run(accepted)
    assert accepted.status == AIRun.Status.AWAITING_REVIEW
    accepted_response = owner_client.post(
        f"/api/ai/runs/{accepted.pk}/accept/", {"reason": "Keep it."}, format="json"
    )
    assert accepted_response.status_code == 200

    discarded = ai_runs.start_run(
        owner=owner,
        target_type=AIRun.TargetType.PROJECT3D,
        target=project3d,
        operation=AIRun.Operation.CREATE,
        prompt="create another cube",
    )
    discarded = ai_runs.advance_run(discarded)
    assert discarded.status == AIRun.Status.AWAITING_REVIEW
    discard_response = owner_client.post(
        f"/api/ai/runs/{discarded.pk}/cancel/", {"reason": "Discard it."}, format="json"
    )
    assert discard_response.status_code == 200
    assert not ProjectActivity.objects.filter(project__isnull=False).exists()
    events = list(ProjectActivity.objects.filter(project3d=project3d).order_by("id"))
    assert [event.action_type for event in events] == [
        ProjectActivity.ActionType.AI_PROPOSAL_ACCEPTED,
        ProjectActivity.ActionType.AI_PROPOSAL_REJECTED,
    ]
    assert events[0].metadata == {
        "run_id": accepted.pk,
        "scope": accepted.scope,
        "operation": accepted.operation,
        "change_summary": accepted.change_summary[:200],
        "reason": "Keep it.",
    }
    assert events[1].metadata == {
        "run_id": discarded.pk,
        "scope": discarded.scope,
        "operation": discarded.operation,
        "change_summary": discarded.change_summary[:200],
        "reason": "Discard it.",
    }


@pytest.mark.parametrize("endpoint", ["accept", "cancel"])
@pytest.mark.django_db
def test_activity_insert_rollback_keeps_decision_transition_atomic(
    monkeypatch, owner, owner_client, project, endpoint
):
    run = _awaiting_review_2d_run(monkeypatch, owner, project)
    original_save = ProjectActivity.save

    def save_then_fail(self, *args, **kwargs):
        original_save(self, *args, **kwargs)
        raise RuntimeError("simulated activity insert failure")

    monkeypatch.setattr(ProjectActivity, "save", save_then_fail)
    with pytest.raises(RuntimeError, match="simulated activity insert failure"):
        owner_client.post(f"/api/ai/runs/{run.pk}/{endpoint}/", format="json")

    run.refresh_from_db()
    assert run.status == AIRun.Status.AWAITING_REVIEW
    assert ProjectActivity.objects.filter(project=project).count() == 0
    assert SceneVersion.objects.filter(project=project).count() == 0


@pytest.mark.django_db
def test_add_asset_layer_api_persists_descriptors_and_returns_candidate(
    monkeypatch, owner_client, owner, project
):
    base = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = base
    project.save(update_fields=["current_version"])
    monkeypatch.setattr(
        ai_runs,
        "_provider_for_user",
        lambda *args, **kwargs: build_e2e_provider("add-asset-layer"),
    )
    asset = {
        "id": "asset-api-1",
        "name": "API reference",
        "mime": "image/png",
        "width": 640,
        "height": 480,
    }

    start = owner_client.post(
        "/api/ai/runs/",
        {
            "target_type": "project",
            "project_id": str(project.public_id),
            "operation": "edit_patch",
            "scope": "add_layer",
            "selected_target_ids": [asset["id"]],
            "assets": [asset],
            "prompt": "add this media asset as a new layer",
        },
        format="json",
    )

    assert start.status_code == 201
    assert start.json()["assets"] == [asset]
    assert start.json()["plan"]["scope"] == "add-layer"

    advance = owner_client.post(f"/api/ai/runs/{start.json()['id']}/advance/")

    assert advance.status_code == 200
    assert advance.json()["status"] == AIRun.Status.AWAITING_REVIEW
    assert advance.json()["candidate_scene"]["shapes"][-1]["mediaAssetId"] == asset["id"]


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
        User = get_user_model()  # noqa: N806
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


@pytest.mark.parametrize("endpoint", ["accept", "cancel"])
@pytestmark_postgres
@pytest.mark.django_db(databases=["default", "postgres_test"], transaction=True)
def test_postgres_concurrent_ai_run_decisions_write_at_most_one_activity(
    endpoint, django_db_blocker
):
    with django_db_blocker.unblock():
        user = (
            get_user_model()
            .objects.db_manager("postgres_test")
            .create_user(username=f"ai-run-decision-{endpoint}")
        )
        project = Project.objects.using("postgres_test").create(owner=user)
        run = AIRun.objects.using("postgres_test").create(
            owner=user,
            target_type=AIRun.TargetType.PROJECT,
            project=project,
            operation=AIRun.Operation.CREATE,
            scope=AIRun.Scope.WHOLE_SCENE,
            prompt="deterministic test proposal",
            status=AIRun.Status.AWAITING_REVIEW,
            input_digest="0" * 64,
            candidate_scene_json=BLANK_SCENE,
            change_summary="Concurrent proposal",
            deadline_at=timezone.now() + timedelta(minutes=5),
        )
        barrier = threading.Barrier(2)
        responses: list[tuple[int, dict]] = []
        errors: list[BaseException] = []
        result_lock = threading.Lock()

        def decide():
            try:
                barrier.wait()
                client = APIClient()
                client.force_authenticate(user)
                response = client.post(f"/api/ai/runs/{run.pk}/{endpoint}/", format="json")
                with result_lock:
                    responses.append((response.status_code, response.json()))
            except BaseException as exc:  # preserve worker failures for the main test thread
                with result_lock:
                    errors.append(exc)
            finally:
                close_thread_connections()

        with route_default_to_postgres_test():
            workers = [threading.Thread(target=decide) for _ in range(2)]
            for worker in workers:
                worker.start()
            for worker in workers:
                worker.join(timeout=15)

        assert all(not worker.is_alive() for worker in workers)
        assert errors == []
        assert sorted(status for status, _ in responses) == [200, 200]
        expected_status = AIRun.Status.ACCEPTED if endpoint == "accept" else AIRun.Status.CANCELLED
        assert all(body["status"] == expected_status for _, body in responses)
        if endpoint == "accept":
            assert len({body["accepted_version_id"] for _, body in responses}) == 1
        activities = ProjectActivity.objects.using("postgres_test").filter(project_id=project.pk)
        assert activities.count() == 1
        activity = activities.get()
        expected_action = (
            ProjectActivity.ActionType.AI_PROPOSAL_ACCEPTED
            if endpoint == "accept"
            else ProjectActivity.ActionType.AI_PROPOSAL_REJECTED
        )
        assert activity.action_type == expected_action
        assert activity.actor_id == user.pk
        if endpoint == "accept":
            accepted_versions = SceneVersion.objects.using("postgres_test").filter(
                project_id=project.pk
            )
            assert accepted_versions.count() == 1
