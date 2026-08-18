"""Tests for POST /api/projects/<id>/ai/edit-scene/ (Task 50).

Every test mocks Mistral entirely via `scenes.ai_api.get_ai_provider`
(monkeypatched to return a `MistralSceneProvider(client=<fake>)`) -- none
of them open a socket or require a real `MISTRAL_API_KEY`. This endpoint
calls `MistralSceneProvider.edit_scene_with_patch` directly (not the
`AISceneProvider` ABC's plain `edit_scene`, which can't carry the patch
document/change summary the response needs) -- see `scenes/ai_api.py`'s
`AIEditSceneView` docstring, so `FakeAISceneProvider` isn't usable here.

Covers: success returns patch + draft scene + change summary and creates
no `SceneVersion`/touches `current_version`; protected-field, invalid-
path, oversized, and malformed patches rejected with distinct responses;
the documented empty-patch policy; stale-base detection; provider error
mapping; `current_scene` schema validation; and ownership/auth, mirroring
`test_ai_create_scene_api.py`'s conventions for the sibling endpoint.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

import scenes.ai_api as ai_api
from ai_provider.mistral_provider import MistralSceneProvider
from scenes.models import Project, SceneVersion

_FIXTURE_PATH = (
    Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
)
BLANK_SCENE = json.loads(_FIXTURE_PATH.read_text())


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="alice")


@pytest.fixture
def other_user(db):
    return get_user_model().objects.create_user(username="bob")


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


def _url(project):
    return f"/api/projects/{project.public_id}/ai/edit-scene/"


def _use_provider(monkeypatch, provider):
    monkeypatch.setattr(ai_api, "get_ai_provider", lambda: provider)


class _FakeChat:
    def __init__(self, handler):
        self._handler = handler

    def complete(self, **kwargs):
        return self._handler(**kwargs)


class _FakeClient:
    def __init__(self, handler):
        self.chat = _FakeChat(handler)


def _mistral_provider_returning(content: str) -> MistralSceneProvider:
    def handler(**kwargs):
        return SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=10, completion_tokens=20),
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        )

    return MistralSceneProvider(client=_FakeClient(handler))


def _mistral_provider_raising(exc: BaseException) -> MistralSceneProvider:
    def handler(**kwargs):
        raise exc

    return MistralSceneProvider(client=_FakeClient(handler))


def _payload(prompt="make it black", scene=None, base_version_id=None):
    return {
        "prompt": prompt,
        "current_scene": scene if scene is not None else copy.deepcopy(BLANK_SCENE),
        "base_version_id": base_version_id,
    }


_BG_BLACK_PATCH = [{"op": "replace", "path": "/canvas/backgroundColor", "value": "#000000"}]


# --- Success: unsaved draft, no version created -----------------------------


@pytest.mark.django_db
def test_success_returns_patch_draft_scene_and_summary_and_creates_no_version(
    owner_client, project, monkeypatch
):
    _use_provider(monkeypatch, _mistral_provider_returning(json.dumps(_BG_BLACK_PATCH)))

    response = owner_client.post(_url(project), _payload(), format="json")

    assert response.status_code == 200
    body = response.json()
    assert body["draft"] is True
    assert body["patch"] == _BG_BLACK_PATCH
    assert body["scene"]["canvas"]["backgroundColor"] == "#000000"
    assert body["change_summary"] == "1 change: 1 canvas property updated."
    assert set(body["usage"]) == {
        "prompt_tokens",
        "completion_tokens",
        "total_tokens",
        "estimated_cost_usd",
    }

    project.refresh_from_db()
    assert project.current_version is None
    assert SceneVersion.objects.filter(project=project).count() == 0


@pytest.mark.django_db
def test_success_with_a_saved_current_version_requires_matching_base(
    owner_client, project, owner, monkeypatch
):
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = version
    project.save(update_fields=["current_version"])

    _use_provider(monkeypatch, _mistral_provider_returning(json.dumps(_BG_BLACK_PATCH)))

    response = owner_client.post(_url(project), _payload(base_version_id=version.id), format="json")

    assert response.status_code == 200
    project.refresh_from_db()
    assert project.current_version_id == version.id  # untouched
    assert SceneVersion.objects.filter(project=project).count() == 1


# --- current_scene validation -----------------------------------------------


@pytest.mark.django_db
def test_invalid_current_scene_is_rejected_with_400(owner_client, project, monkeypatch):
    def handler(**kwargs):  # pragma: no cover -- must never be called
        raise AssertionError("the provider must not be called for an invalid current_scene")

    _use_provider(monkeypatch, MistralSceneProvider(client=_FakeClient(handler)))

    malformed = {**BLANK_SCENE}
    del malformed["canvas"]

    response = owner_client.post(_url(project), _payload(scene=malformed), format="json")

    assert response.status_code == 400
    assert response.json()["error"] == "current_scene_invalid"


# --- Stale base --------------------------------------------------------------


@pytest.mark.django_db
def test_stale_base_is_rejected_with_409_before_calling_the_provider(
    owner_client, project, owner, monkeypatch
):
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = version
    project.save(update_fields=["current_version"])

    def handler(**kwargs):  # pragma: no cover -- must never be called
        raise AssertionError("the provider must not be called on a stale base")

    _use_provider(monkeypatch, MistralSceneProvider(client=_FakeClient(handler)))

    # Client believes there's no saved version yet (base_version_id=None),
    # but the project already has one -- stale.
    response = owner_client.post(_url(project), _payload(base_version_id=None), format="json")

    assert response.status_code == 409
    assert response.json()["error"] == "stale_base"
    assert SceneVersion.objects.filter(project=project).count() == 1


@pytest.mark.django_db
def test_stale_base_wrong_id_is_rejected(owner_client, project, owner, monkeypatch):
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = version
    project.save(update_fields=["current_version"])

    def handler(**kwargs):  # pragma: no cover -- must never be called
        raise AssertionError("must not be called")

    _use_provider(monkeypatch, MistralSceneProvider(client=_FakeClient(handler)))

    response = owner_client.post(
        _url(project), _payload(base_version_id=version.id + 999), format="json"
    )

    assert response.status_code == 409
    assert response.json()["error"] == "stale_base"


# --- Patch-specific rejections: no version, scene unchanged ----------------


@pytest.mark.django_db
def test_empty_patch_is_rejected_with_422(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning("[]"))

    response = owner_client.post(_url(project), _payload(), format="json")

    assert response.status_code == 422
    assert response.json()["error"] == "empty_patch"
    assert SceneVersion.objects.filter(project=project).count() == 0


@pytest.mark.django_db
def test_protected_field_patch_is_rejected_with_422(owner_client, project, monkeypatch):
    patch = [{"op": "replace", "path": "/id", "value": "hijacked"}]
    _use_provider(monkeypatch, _mistral_provider_returning(json.dumps(patch)))

    response = owner_client.post(_url(project), _payload(), format="json")

    assert response.status_code == 422
    assert response.json()["error"] == "protected_field"
    assert SceneVersion.objects.filter(project=project).count() == 0


@pytest.mark.django_db
def test_invalid_path_patch_is_rejected_with_422(owner_client, project, monkeypatch):
    patch = [{"op": "replace", "path": "/renderer/preferred", "value": "svg"}]
    _use_provider(monkeypatch, _mistral_provider_returning(json.dumps(patch)))

    response = owner_client.post(_url(project), _payload(), format="json")

    assert response.status_code == 422
    assert response.json()["error"] == "invalid_patch_path"


@pytest.mark.django_db
def test_oversized_patch_is_rejected_with_413(owner_client, project, monkeypatch):
    patch = [
        {"op": "replace", "path": "/canvas/backgroundColor", "value": f"#{i:06x}"}
        for i in range(100)
    ]
    _use_provider(monkeypatch, _mistral_provider_returning(json.dumps(patch)))

    response = owner_client.post(_url(project), _payload(), format="json")

    assert response.status_code == 413
    assert response.json()["error"] == "oversized_patch"


@pytest.mark.django_db
def test_malformed_patch_document_is_rejected(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning("not a json array"))

    response = owner_client.post(_url(project), _payload(), format="json")

    assert response.status_code == 502
    assert response.json()["error"] == "provider_failure"
    assert SceneVersion.objects.filter(project=project).count() == 0


@pytest.mark.django_db
def test_patch_apply_failure_is_rejected_with_422(owner_client, project, monkeypatch):
    # Allowlisted path, but no shapes exist to index into.
    patch = [{"op": "replace", "path": "/shapes/0/style/fill", "value": "#ff0000"}]
    _use_provider(monkeypatch, _mistral_provider_returning(json.dumps(patch)))

    response = owner_client.post(_url(project), _payload(), format="json")

    assert response.status_code == 422
    assert response.json()["error"] == "patch_apply_failed"


@pytest.mark.django_db
def test_resulting_scene_over_limit_is_rejected_with_422(owner_client, project, monkeypatch):
    def circle(shape_id):
        return {
            "id": shape_id,
            "type": "circle",
            "layerId": "layer-1",
            "groupId": None,
            "transform": {"x": 0, "y": 0, "scaleX": 1, "scaleY": 1, "rotation": 0, "opacity": 1},
            "style": {"fill": "#14b8a6", "stroke": None, "strokeWidth": 0},
            "radius": 10,
        }

    scene = copy.deepcopy(BLANK_SCENE)
    scene["shapes"] = [circle(f"shape-{i}") for i in range(200)]
    patch = [{"op": "add", "path": "/shapes/-", "value": circle("shape-200")}]
    _use_provider(monkeypatch, _mistral_provider_returning(json.dumps(patch)))

    response = owner_client.post(_url(project), _payload(scene=scene), format="json")

    assert response.status_code == 422
    assert response.json()["error"] == "invalid_structured_output"
    assert SceneVersion.objects.filter(project=project).count() == 0


# --- Provider error taxonomy -------------------------------------------------


@pytest.mark.django_db
def test_timeout_is_rejected_with_504(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_raising(httpx.TimeoutException("timed out")))

    response = owner_client.post(_url(project), _payload(), format="json")

    assert response.status_code == 504
    assert response.json()["error"] == "timeout"


@pytest.mark.django_db
def test_provider_network_failure_maps_to_502(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_raising(httpx.ConnectError("connection refused")))

    response = owner_client.post(_url(project), _payload(), format="json")

    assert response.status_code == 502
    assert response.json()["error"] == "provider_failure"


# --- Prompt bounds / rate / quota -------------------------------------------


@pytest.mark.django_db
def test_blank_prompt_is_rejected_with_400(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(json.dumps(_BG_BLACK_PATCH)))

    response = owner_client.post(_url(project), _payload(prompt=""), format="json")

    assert response.status_code == 400
    assert response.json()["error"] == "prompt_invalid"


@pytest.mark.django_db
def test_prompt_too_long_is_rejected_with_400(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(json.dumps(_BG_BLACK_PATCH)))
    too_long = "x" * (ai_api.MAX_PROMPT_CHARS + 1)

    response = owner_client.post(_url(project), _payload(prompt=too_long), format="json")

    assert response.status_code == 400
    assert response.json()["error"] == "prompt_invalid"


@pytest.mark.django_db
def test_own_request_rate_limit_returns_429(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(json.dumps(_BG_BLACK_PATCH)))

    for _ in range(ai_api.EDIT_RATE_LIMIT_MAX_ATTEMPTS):
        response = owner_client.post(_url(project), _payload(), format="json")
        assert response.status_code == 200

    response = owner_client.post(_url(project), _payload(), format="json")

    assert response.status_code == 429
    assert response.json()["error"] == "rate_limited"


@pytest.mark.django_db
def test_own_daily_quota_returns_429_and_only_counts_successes(owner_client, project, monkeypatch):
    from datetime import date

    cache.set(
        f"ai_provider:quota:edit:{project.owner_id}:{date.today().isoformat()}",
        ai_api.EDIT_DAILY_QUOTA_MAX_SUCCESSES,
    )

    def handler(**kwargs):  # pragma: no cover -- must never be called
        raise AssertionError("the provider must not be called once quota is exhausted")

    _use_provider(monkeypatch, MistralSceneProvider(client=_FakeClient(handler)))

    response = owner_client.post(_url(project), _payload(), format="json")

    assert response.status_code == 429
    assert response.json()["error"] == "quota_exceeded"


@pytest.mark.django_db
def test_failed_attempts_do_not_consume_the_daily_quota(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning("[]"))  # empty patch -> rejected

    for _ in range(3):
        response = owner_client.post(_url(project), _payload(), format="json")
        assert response.status_code == 422

    from datetime import date

    key = f"ai_provider:quota:edit:{project.owner_id}:{date.today().isoformat()}"
    assert cache.get(key, 0) == 0


@pytest.mark.django_db
def test_create_and_edit_quotas_are_independent(owner_client, project, monkeypatch):
    from datetime import date

    cache.set(
        f"ai_provider:quota:create:{project.owner_id}:{date.today().isoformat()}",
        ai_api.DAILY_QUOTA_MAX_SUCCESSES,
    )
    _use_provider(monkeypatch, _mistral_provider_returning(json.dumps(_BG_BLACK_PATCH)))

    # create-scene quota is exhausted, but edit-scene has its own bucket.
    response = owner_client.post(_url(project), _payload(), format="json")

    assert response.status_code == 200


# --- Authentication / ownership --------------------------------------------


@pytest.mark.django_db
def test_anonymous_request_is_rejected(project):
    client = APIClient()
    response = client.post(_url(project), _payload(), format="json")
    assert response.status_code in (401, 404)


@pytest.mark.django_db
def test_non_owner_gets_404_not_403(other_client, project, monkeypatch):
    _use_provider(monkeypatch, _mistral_provider_returning(json.dumps(_BG_BLACK_PATCH)))
    response = other_client.post(_url(project), _payload(), format="json")
    assert response.status_code == 404


@pytest.mark.django_db
def test_nonexistent_project_returns_404(owner_client):
    response = owner_client.post(
        "/api/projects/00000000-0000-0000-0000-000000000000/ai/edit-scene/",
        _payload(),
        format="json",
    )
    assert response.status_code == 404
