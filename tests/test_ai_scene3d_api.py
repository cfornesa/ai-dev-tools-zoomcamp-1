"""Tests for the 3D AI-assisted editor's create/edit/accept endpoints
(issue #232): POST /api/projects3d/<id>/ai/create-scene/,
.../ai/edit-scene/, .../ai/accept-proposal/.

Mirrors tests/test_ai_create_scene_api.py's conventions: every test mocks
Mistral via scenes.ai_api.get_ai_provider (patched at its definition site
-- scenes.ai_api3d's _provider_for_user calls that same module-global
name, so patching it there affects both 2D and 3D endpoints identically),
none open a socket or require a real MISTRAL_API_KEY.
"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

import scenes.ai_api as ai_api
from ai_provider.mistral_provider import MistralSceneProvider
from scenes.models import Project3D, SceneVersion3D

_FIXTURE_PATH = (
    Path(__file__).resolve().parent.parent / "schema" / "fixtures3d" / "valid" / "minimal.json"
)
MINIMAL_SCENE_3D = json.loads(_FIXTURE_PATH.read_text())


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="alice3d-ai")


@pytest.fixture
def other_user(db):
    return get_user_model().objects.create_user(username="bob3d-ai")


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
    return Project3D.objects.create(owner=owner)


class _FakeChat:
    def __init__(self, handler):
        self._handler = handler

    def complete(self, **kwargs):
        return self._handler(**kwargs)


class _FakeClient:
    def __init__(self, handler):
        self.chat = _FakeChat(handler)


def _provider_returning(content: str) -> MistralSceneProvider:
    def handler(**kwargs):
        return SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=10, completion_tokens=20),
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        )

    return MistralSceneProvider(client=_FakeClient(handler))


def _use_provider(monkeypatch, provider):
    monkeypatch.setattr(ai_api, "get_ai_provider", lambda: provider)


def _create_url(project):
    return f"/api/projects3d/{project.public_id}/ai/create-scene/"


def _edit_url(project):
    return f"/api/projects3d/{project.public_id}/ai/edit-scene/"


def _accept_url(project):
    return f"/api/projects3d/{project.public_id}/ai/accept-proposal/"


# --- create-scene3d ---------------------------------------------------------


@pytest.mark.django_db
def test_create_scene3d_success_returns_draft_and_creates_no_version(
    owner_client, project, monkeypatch
):
    _use_provider(monkeypatch, _provider_returning(json.dumps(MINIMAL_SCENE_3D)))

    response = owner_client.post(_create_url(project), {"prompt": "a bare stage"}, format="json")

    assert response.status_code == 200
    body = response.json()
    assert body["draft"] is True
    assert body["scene"] == MINIMAL_SCENE_3D

    project.refresh_from_db()
    assert project.current_version is None
    assert SceneVersion3D.objects.filter(project=project).count() == 0


@pytest.mark.django_db
def test_create_scene3d_invalid_output_is_rejected(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, _provider_returning(json.dumps({"not": "a scene3d"})))

    response = owner_client.post(_create_url(project), {"prompt": "anything"}, format="json")

    assert response.status_code == 422
    assert response.json()["error"] == "invalid_structured_output"


@pytest.mark.django_db
def test_create_scene3d_requires_authentication(project):
    response = APIClient().post(_create_url(project), {"prompt": "anything"}, format="json")

    assert response.status_code == 404


@pytest.mark.django_db
def test_create_scene3d_a_non_owner_gets_404(other_client, project, monkeypatch):
    _use_provider(monkeypatch, _provider_returning(json.dumps(MINIMAL_SCENE_3D)))

    response = other_client.post(_create_url(project), {"prompt": "anything"}, format="json")

    assert response.status_code == 404


@pytest.mark.django_db
def test_create_scene3d_blank_prompt_is_rejected(owner_client, project):
    response = owner_client.post(_create_url(project), {"prompt": ""}, format="json")

    assert response.status_code == 400
    assert response.json()["error"] == "prompt_invalid"


@pytest.mark.django_db
def test_create_scene3d_rate_limit_is_enforced(owner_client, project, monkeypatch):
    _use_provider(monkeypatch, _provider_returning(json.dumps(MINIMAL_SCENE_3D)))

    for _ in range(5):
        response = owner_client.post(_create_url(project), {"prompt": "a stage"}, format="json")
        assert response.status_code == 200

    response = owner_client.post(_create_url(project), {"prompt": "a stage"}, format="json")
    assert response.status_code == 429
    assert response.json()["error"] == "rate_limited"


@pytest.mark.django_db
def test_create_scene3d_missing_personal_credential_returns_424(owner_client, project, monkeypatch):
    from scenes.ai_api import MissingPersonalMistralCredential

    def _raise():
        raise MissingPersonalMistralCredential

    monkeypatch.setattr(ai_api, "get_ai_provider", _raise)

    response = owner_client.post(_create_url(project), {"prompt": "anything"}, format="json")

    assert response.status_code == 424
    assert response.json()["error"] == "personal_key_required"


# --- edit-scene3d ------------------------------------------------------------


@pytest.mark.django_db
def test_edit_scene3d_success_returns_patch_and_draft_scene(owner_client, project, monkeypatch):
    patch = [{"op": "replace", "path": "/camera/fov", "value": 70}]
    _use_provider(monkeypatch, _provider_returning(json.dumps(patch)))

    response = owner_client.post(
        _edit_url(project),
        {
            "prompt": "zoom out",
            "current_scene": MINIMAL_SCENE_3D,
            "base_version_id": None,
        },
        format="json",
    )

    assert response.status_code == 200
    body = response.json()
    assert body["draft"] is True
    assert body["scene"]["camera"]["fov"] == 70
    assert body["patch"] == patch


@pytest.mark.django_db
def test_edit_scene3d_stale_base_is_rejected(owner_client, project, monkeypatch):
    _use_provider(
        monkeypatch,
        _provider_returning(json.dumps([{"op": "replace", "path": "/camera/fov", "value": 70}])),
    )

    response = owner_client.post(
        _edit_url(project),
        {"prompt": "zoom out", "current_scene": MINIMAL_SCENE_3D, "base_version_id": 999},
        format="json",
    )

    assert response.status_code == 409
    assert response.json()["error"] == "stale_base"


@pytest.mark.django_db
def test_edit_scene3d_invalid_current_scene_is_rejected(owner_client, project):
    response = owner_client.post(
        _edit_url(project),
        {"prompt": "zoom out", "current_scene": {"not": "valid"}, "base_version_id": None},
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["error"] == "current_scene_invalid"


# --- accept-proposal3d --------------------------------------------------------


@pytest.mark.django_db
def test_accept_creates_a_version_and_advances_current_version(owner_client, project):
    response = owner_client.post(
        _accept_url(project),
        {
            "operation": "ai_create",
            "scene_json": MINIMAL_SCENE_3D,
            "base_version_id": None,
        },
        format="json",
    )

    assert response.status_code == 201
    body = response.json()
    assert body["origin"] == "ai_create"
    assert body["sequence"] == 1

    project.refresh_from_db()
    assert project.current_version_id == body["id"]


@pytest.mark.django_db
def test_accept_is_idempotent_via_client_request_id(owner_client, project):
    client_request_id = "11111111-1111-1111-1111-111111111111"
    payload = {
        "operation": "ai_create",
        "scene_json": MINIMAL_SCENE_3D,
        "base_version_id": None,
        "client_request_id": client_request_id,
    }

    first = owner_client.post(_accept_url(project), payload, format="json")
    second = owner_client.post(_accept_url(project), payload, format="json")

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert SceneVersion3D.objects.filter(project=project).count() == 1


@pytest.mark.django_db
def test_accept_rejects_a_stale_base(owner_client, project):
    response = owner_client.post(
        _accept_url(project),
        {"operation": "ai_create", "scene_json": MINIMAL_SCENE_3D, "base_version_id": 999},
        format="json",
    )

    assert response.status_code == 409
    assert response.json()["error"] == "stale_base"


@pytest.mark.django_db
def test_accept_rejects_invalid_scene_json(owner_client, project):
    response = owner_client.post(
        _accept_url(project),
        {"operation": "ai_create", "scene_json": {"not": "valid"}, "base_version_id": None},
        format="json",
    )

    assert response.status_code == 422
    assert response.json()["error"] == "invalid_structured_output"


@pytest.mark.django_db
def test_accept_requires_authentication(project):
    response = APIClient().post(
        _accept_url(project),
        {"operation": "ai_create", "scene_json": MINIMAL_SCENE_3D, "base_version_id": None},
        format="json",
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_accept_a_non_owner_gets_404(other_client, project):
    response = other_client.post(
        _accept_url(project),
        {"operation": "ai_create", "scene_json": MINIMAL_SCENE_3D, "base_version_id": None},
        format="json",
    )

    assert response.status_code == 404
    assert SceneVersion3D.objects.filter(project=project).count() == 0
