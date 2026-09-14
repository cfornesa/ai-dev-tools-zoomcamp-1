"""Tests for the AI-assisted 2D-to-3D scene conversion run (issue #528):
`scenes.scene_conversion`'s start/advance/cancel/accept logic and the
`/api/scene-conversions/...` views layer.

Mirrors `tests/test_ai_runs.py`'s conventions exactly -- see that file's
module docstring for why `scenes.ai_api.get_ai_provider` (not
`scenes.scene_conversion`'s own imports) is the correct monkeypatch
target: `scenes.scene_conversion._run_one_attempt` calls
`scenes.ai_api._provider_for_user`, which itself calls the same
module-global `get_ai_provider` lookup.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import models
from rest_framework.test import APIClient

import scenes.ai_api as ai_api
from ai_provider.interface import AIError, AIErrorCategory, AIOperation
from ai_provider.interface3d import AIConvertScene2DTo3DRequest, AIOperationResult3D
from scenes import scene_conversion
from scenes.models import (
    Project,
    Project3D,
    SceneConversionRun,
    SceneVersion,
    SceneVersion3D,
)

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


def _usage():
    from ai_provider.interface import AIUsageMetadata

    return AIUsageMetadata(prompt_tokens=10, completion_tokens=20, estimated_cost_usd=0.001)


class _QueuedFakeConvertProvider:
    """The convert-only counterpart of test_ai_runs.py's
    `_QueuedFakeProvider` -- one canned outcome per `advance` call, in
    order. Also implements the plain 2D methods (unused here) only where
    the `AISceneProvider`/`AIScene3DProvider` ABCs require them, since
    `get_ai_provider()`'s return value is used as-is."""

    def __init__(self, outcomes: list[dict | AIErrorCategory]) -> None:
        self._outcomes = list(outcomes)
        self.calls = 0
        self.last_request: AIConvertScene2DTo3DRequest | None = None

    def convert_scene_2d_to_3d(self, request: AIConvertScene2DTo3DRequest) -> AIOperationResult3D:
        self.calls += 1
        self.last_request = request
        outcome = self._outcomes.pop(0)
        if isinstance(outcome, AIErrorCategory):
            return AIOperationResult3D(
                operation=AIOperation.CONVERT_2D_TO_3D,
                usage=_usage(),
                error=AIError(category=outcome, message=f"simulated {outcome.value}"),
            )
        return AIOperationResult3D(
            operation=AIOperation.CONVERT_2D_TO_3D, usage=_usage(), scene=outcome
        )


def _install_fake_provider(
    monkeypatch, outcomes: list[dict | AIErrorCategory]
) -> _QueuedFakeConvertProvider:
    provider = _QueuedFakeConvertProvider(outcomes)
    monkeypatch.setattr(ai_api, "get_ai_provider", lambda: provider)
    return provider


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="scene-conv-owner")


@pytest.fixture
def other_user(db):
    return get_user_model().objects.create_user(username="scene-conv-other")


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
def source_project(owner):
    project = Project.objects.create(owner=owner)
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = version
    project.save(update_fields=["current_version"])
    return project


def _start(owner, source_project, **kwargs) -> SceneConversionRun:
    return scene_conversion.start_conversion(owner=owner, source_project=source_project, **kwargs)


# --- detect_unsupported_shape_types -----------------------------------------


def test_detect_unsupported_shape_types_reports_every_type_with_no_3d_equivalent():
    scene = {
        "shapes": [
            {"type": "circle", "id": "c1"},
            {"type": "rect", "id": "r1"},
            {"type": "line", "id": "l1"},
            {"type": "path", "id": "p1"},
            {"type": "particleEmitter", "id": "pe1"},
            {"type": "image", "id": "i1"},
        ]
    }
    assert scene_conversion.detect_unsupported_shape_types(scene) == [
        "image",
        "line",
        "particleEmitter",
        "path",
    ]


def test_detect_unsupported_shape_types_empty_for_only_supported_shapes():
    scene = {"shapes": [{"type": "circle", "id": "c1"}, {"type": "rect", "id": "r1"}]}
    assert scene_conversion.detect_unsupported_shape_types(scene) == []


def test_detect_unsupported_shape_types_tolerates_malformed_scene():
    assert scene_conversion.detect_unsupported_shape_types({}) == []
    assert scene_conversion.detect_unsupported_shape_types({"shapes": "not-a-list"}) == []


# --- Happy path --------------------------------------------------------------


@pytest.mark.django_db
def test_conversion_reaches_awaiting_review_and_charges_once(monkeypatch, owner, source_project):
    _install_fake_provider(monkeypatch, [MINIMAL_SCENE_3D])

    run = _start(owner, source_project, prompt="make it 3D")
    assert run.status == SceneConversionRun.Status.RUNNING

    run = scene_conversion.advance_conversion(run)

    assert run.status == SceneConversionRun.Status.AWAITING_REVIEW
    assert run.attempts == 1
    assert run.candidate_scene_json == MINIMAL_SCENE_3D
    assert run.charged is True

    with pytest.raises(scene_conversion.NotRunning):
        scene_conversion.advance_conversion(run)

    key = ai_api._quota_cache_key(owner.id, operation=scene_conversion.QUOTA_OPERATION)
    assert ai_api._current_count(key) == 1


@pytest.mark.django_db
def test_unsupported_shape_types_recorded_at_start_and_fed_into_the_prompt(
    monkeypatch, owner, source_project
):
    scene = {
        "shapes": [
            {"type": "circle", "id": "c1"},
            {"type": "line", "id": "l1"},
        ]
    }
    version = SceneVersion.objects.create(
        project=source_project,
        sequence=2,
        scene_json=scene,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    source_project.current_version = version
    source_project.save(update_fields=["current_version"])

    provider = _install_fake_provider(monkeypatch, [MINIMAL_SCENE_3D])
    run = _start(owner, source_project)
    assert run.unsupported_shape_types == ["line"]

    scene_conversion.advance_conversion(run)
    assert provider.last_request is not None
    assert "line" in provider.last_request.prompt


@pytest.mark.django_db
def test_accept_creates_a_brand_new_project3d_with_provenance(monkeypatch, owner, source_project):
    _install_fake_provider(monkeypatch, [MINIMAL_SCENE_3D])
    run = _start(owner, source_project)
    run = scene_conversion.advance_conversion(run)

    run, project3d = scene_conversion.accept_conversion(run)

    assert run.status == SceneConversionRun.Status.ACCEPTED
    assert isinstance(project3d, Project3D)
    assert project3d.owner_id == owner.id
    version = project3d.current_version
    assert isinstance(version, SceneVersion3D)
    assert version.origin == SceneVersion3D.Origin.CONVERTED_FROM_2D
    assert version.source_project_id == source_project.id
    assert version.source_version_id == run.source_version_id
    assert Project3D.objects.filter(owner=owner).count() == 1


@pytest.mark.django_db
def test_accept_is_idempotent_on_repeat_call(monkeypatch, owner, source_project):
    _install_fake_provider(monkeypatch, [MINIMAL_SCENE_3D])
    run = _start(owner, source_project)
    run = scene_conversion.advance_conversion(run)
    run, project3d = scene_conversion.accept_conversion(run)

    run_again, project3d_again = scene_conversion.accept_conversion(run)
    assert project3d_again.id == project3d.id
    assert Project3D.objects.filter(owner=owner).count() == 1


def test_source_project_provenance_field_is_set_null_on_delete():
    """The app itself never hard-deletes a `Project` (only ever
    soft-deletes via `is_deleted` -- and `Scene`/`SceneVersion`'s own
    PROTECT relations make a real hard delete impossible in practice
    while any scene history exists at all), so this asserts the model
    contract directly rather than exercising a cascade Django's ORM would
    otherwise refuse outright: `SceneVersion3D.source_project` must never
    be `on_delete=CASCADE` (a converted 3D project's SceneVersion3D rows
    must survive were the impossible-in-practice case to ever occur),
    unlike `SceneConversionRun.source_project` above it, which is
    deliberately CASCADE -- see both fields' comments in scenes/models.py.
    """
    field = SceneVersion3D._meta.get_field("source_project")
    assert field.remote_field.on_delete is models.SET_NULL

    run_field = SceneConversionRun._meta.get_field("source_project")
    assert run_field.remote_field.on_delete is models.CASCADE


@pytest.mark.django_db
def test_soft_deleting_the_source_project_leaves_conversion_provenance_intact(
    monkeypatch, owner, source_project
):
    _install_fake_provider(monkeypatch, [MINIMAL_SCENE_3D])
    run = _start(owner, source_project)
    run = scene_conversion.advance_conversion(run)
    run, project3d = scene_conversion.accept_conversion(run)

    # The only deletion path this app actually exercises for a Project.
    source_project.is_deleted = True
    source_project.save(update_fields=["is_deleted"])

    version = project3d.current_version
    version.refresh_from_db()
    assert version.source_project_id == source_project.id


# --- Stale base --------------------------------------------------------------


@pytest.mark.django_db
def test_stale_base_at_accept_fails_the_run_and_creates_no_project3d(
    monkeypatch, owner, source_project
):
    _install_fake_provider(monkeypatch, [MINIMAL_SCENE_3D])
    run = _start(owner, source_project)
    run = scene_conversion.advance_conversion(run)
    assert run.status == SceneConversionRun.Status.AWAITING_REVIEW

    # A concurrent owner edit moved current_version since this run started.
    other_version = SceneVersion.objects.create(
        project=source_project,
        sequence=2,
        scene_json=copy.deepcopy(BLANK_SCENE),
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    source_project.current_version = other_version
    source_project.save(update_fields=["current_version"])

    run, project3d = scene_conversion.accept_conversion(run)
    assert run.status == SceneConversionRun.Status.FAILED
    assert run.error_reason == "stale_base"
    assert project3d is None
    assert Project3D.objects.filter(owner=owner).count() == 0


@pytest.mark.django_db
def test_stale_base_detected_at_advance_when_source_changed_mid_run(
    monkeypatch, owner, source_project
):
    provider = _install_fake_provider(monkeypatch, [MINIMAL_SCENE_3D])
    run = _start(owner, source_project)

    other_version = SceneVersion.objects.create(
        project=source_project,
        sequence=2,
        scene_json=copy.deepcopy(BLANK_SCENE),
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    source_project.current_version = other_version
    source_project.save(update_fields=["current_version"])

    run = scene_conversion.advance_conversion(run)
    assert run.status == SceneConversionRun.Status.FAILED
    assert run.error_reason == "stale_base"
    assert provider.calls == 0


# --- Invalid-then-repair, repeated-invalid, timeout, cancel -----------------


@pytest.mark.django_db
def test_invalid_output_then_successful_repair(monkeypatch, owner, source_project):
    _install_fake_provider(
        monkeypatch, [AIErrorCategory.INVALID_STRUCTURED_OUTPUT, MINIMAL_SCENE_3D]
    )

    run = _start(owner, source_project)
    run = scene_conversion.advance_conversion(run)
    assert run.status == SceneConversionRun.Status.RUNNING
    assert run.repairs == 1
    assert "simulated invalid_structured_output" in run.validation_summary

    run = scene_conversion.advance_conversion(run)
    assert run.status == SceneConversionRun.Status.AWAITING_REVIEW
    assert run.attempts == 2


@pytest.mark.django_db
def test_repeated_invalid_output_exhausts_attempts_and_fails(monkeypatch, owner, source_project):
    _install_fake_provider(monkeypatch, [AIErrorCategory.INVALID_STRUCTURED_OUTPUT] * 3)

    run = _start(owner, source_project)
    for _ in range(2):
        run = scene_conversion.advance_conversion(run)
        assert run.status == SceneConversionRun.Status.RUNNING

    run = scene_conversion.advance_conversion(run)
    assert run.status == SceneConversionRun.Status.FAILED
    assert run.error_reason == "repeated_invalid_output"
    assert run.charged is False


@pytest.mark.django_db
def test_repeated_timeout_exhausts_attempts_and_fails(monkeypatch, owner, source_project):
    _install_fake_provider(monkeypatch, [AIErrorCategory.TIMEOUT] * 3)

    run = _start(owner, source_project)
    for _ in range(2):
        run = scene_conversion.advance_conversion(run)
        assert run.status == SceneConversionRun.Status.RUNNING

    run = scene_conversion.advance_conversion(run)
    assert run.status == SceneConversionRun.Status.FAILED
    assert run.error_reason == "timeout"


@pytest.mark.django_db
def test_wall_clock_deadline_expires_run_without_a_provider_call(
    monkeypatch, owner, source_project
):
    provider = _install_fake_provider(monkeypatch, [MINIMAL_SCENE_3D])

    run = _start(owner, source_project)
    from django.utils import timezone as dj_timezone

    run.deadline_at = dj_timezone.now() - dj_timezone.timedelta(seconds=1)
    run.save(update_fields=["deadline_at"])

    run = scene_conversion.advance_conversion(run)
    assert run.status == SceneConversionRun.Status.FAILED
    assert run.error_reason == "timeout_budget_exhausted"
    assert provider.calls == 0


@pytest.mark.django_db
def test_cancel_is_idempotent_and_never_creates_a_project3d(monkeypatch, owner, source_project):
    _install_fake_provider(monkeypatch, [MINIMAL_SCENE_3D])
    run = _start(owner, source_project)

    run = scene_conversion.cancel_conversion(run)
    assert run.status == SceneConversionRun.Status.CANCELLED

    run_again = scene_conversion.cancel_conversion(run)
    assert run_again.status == SceneConversionRun.Status.CANCELLED
    assert Project3D.objects.filter(owner=owner).count() == 0


# --- Source-type / quota / rate-limit guards --------------------------------


@pytest.mark.django_db
def test_cannot_start_against_a_project_with_no_saved_version(owner):
    empty_project = Project.objects.create(owner=owner)
    with pytest.raises(scene_conversion.InvalidTarget):
        scene_conversion.start_conversion(owner=owner, source_project=empty_project)


@pytest.mark.django_db
def test_quota_exceeded_denies_a_new_start(monkeypatch, owner, source_project):
    monkeypatch.setattr(scene_conversion, "get_effective_cap", lambda user, feature: 0)
    with pytest.raises(scene_conversion.QuotaExceeded):
        _start(owner, source_project)


@pytest.mark.django_db
def test_start_is_idempotent_via_start_request_id(monkeypatch, owner, source_project):
    import uuid

    _install_fake_provider(monkeypatch, [MINIMAL_SCENE_3D])
    key = uuid.uuid4()
    run1 = _start(owner, source_project, start_request_id=key)
    run2 = _start(owner, source_project, start_request_id=key)
    assert run1.id == run2.id
    assert SceneConversionRun.objects.filter(owner=owner).count() == 1


# --- API layer ---------------------------------------------------------------


@pytest.mark.django_db
def test_api_full_lifecycle(monkeypatch, owner_client, owner, source_project):
    _install_fake_provider(monkeypatch, [MINIMAL_SCENE_3D])

    start_response = owner_client.post(
        "/api/scene-conversions/",
        {"project_id": str(source_project.public_id), "prompt": "make it 3D"},
        format="json",
    )
    assert start_response.status_code == 201
    run_id = start_response.json()["id"]
    assert start_response.json()["status"] == "running"

    advance_response = owner_client.post(f"/api/scene-conversions/{run_id}/advance/")
    assert advance_response.status_code == 200
    assert advance_response.json()["status"] == "awaiting_review"
    assert advance_response.json()["candidate_scene"] == MINIMAL_SCENE_3D

    accept_response = owner_client.post(f"/api/scene-conversions/{run_id}/accept/")
    assert accept_response.status_code == 200
    body = accept_response.json()
    assert body["status"] == "accepted"
    assert body["accepted_project3d_id"] is not None

    detail_response = owner_client.get(f"/api/scene-conversions/{run_id}/")
    assert detail_response.status_code == 200
    assert detail_response.json()["status"] == "accepted"


@pytest.mark.django_db
def test_api_start_404s_for_an_art_piece_id_never_a_scene_source(owner_client, owner):
    """Issue #528: an ArtPiece (issue #314's separate generated-code
    document family) is never a valid conversion source -- it has no
    scene_json to convert, and this proves the API-level rejection is a
    plain 404 (its public_id simply never matches a Project row), the
    same "don't confirm hidden data" 404 every other owner-scoped lookup
    in this codebase uses, not a special-cased error path that could leak
    whether an id belongs to some other document type."""
    from scenes.models import ArtPiece

    piece = ArtPiece.objects.create(owner=owner, prompt="a spinning cube", engine="threejs")

    response = owner_client.post(
        "/api/scene-conversions/",
        {"project_id": str(piece.public_id)},
        format="json",
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_api_start_404s_for_a_foreign_project(other_client, source_project):
    response = other_client.post(
        "/api/scene-conversions/",
        {"project_id": str(source_project.public_id)},
        format="json",
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_api_detail_404s_for_a_foreign_run(monkeypatch, owner, source_project, other_client):
    _install_fake_provider(monkeypatch, [MINIMAL_SCENE_3D])
    run = _start(owner, source_project)

    response = other_client.get(f"/api/scene-conversions/{run.id}/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_api_start_requires_authentication(source_project):
    client = APIClient()
    response = client.post(
        "/api/scene-conversions/",
        {"project_id": str(source_project.public_id)},
        format="json",
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_api_cancel(monkeypatch, owner_client, owner, source_project):
    _install_fake_provider(monkeypatch, [MINIMAL_SCENE_3D])
    run = _start(owner, source_project)

    response = owner_client.post(f"/api/scene-conversions/{run.id}/cancel/")
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
