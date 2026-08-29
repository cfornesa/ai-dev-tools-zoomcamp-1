"""Tests for #228's save-a-new-version API: POST /api/projects3d/<public_id>/versions/."""

import copy
import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.models import Project3D, SceneVersion3D

SCHEMA_DIR = Path(__file__).resolve().parent.parent / "schema"

with (SCHEMA_DIR / "fixtures3d" / "valid" / "minimal.json").open() as _f:
    _MINIMAL_SCENE_3D_FIXTURE: dict = json.load(_f)


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="alice3d-version-api")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


def _create_project(client) -> str:
    return client.post("/api/projects3d/").json()["id"]


@pytest.mark.django_db
def test_owner_can_save_a_new_version(owner_client):
    public_id = _create_project(owner_client)
    scene = copy.deepcopy(_MINIMAL_SCENE_3D_FIXTURE)
    scene["id"] = "scene3d-updated"

    response = owner_client.post(
        f"/api/projects3d/{public_id}/versions/", {"scene_json": scene}, format="json"
    )

    assert response.status_code == 201
    body = response.json()
    assert body["sequence"] == 2
    assert body["origin"] == "manual"
    assert body["scene_json"]["id"] == "scene3d-updated"


@pytest.mark.django_db
def test_saving_a_version_advances_current_version(owner_client):
    public_id = _create_project(owner_client)
    scene = copy.deepcopy(_MINIMAL_SCENE_3D_FIXTURE)

    response = owner_client.post(
        f"/api/projects3d/{public_id}/versions/", {"scene_json": scene}, format="json"
    )

    project = Project3D.objects.get(public_id=public_id)
    assert project.current_version_id == response.json()["id"]
    assert SceneVersion3D.objects.filter(project=project).count() == 2


@pytest.mark.django_db
def test_sequence_numbers_increment_across_multiple_saves(owner_client):
    public_id = _create_project(owner_client)
    scene = copy.deepcopy(_MINIMAL_SCENE_3D_FIXTURE)

    for _ in range(3):
        response = owner_client.post(
            f"/api/projects3d/{public_id}/versions/", {"scene_json": scene}, format="json"
        )
        assert response.status_code == 201

    project = Project3D.objects.get(public_id=public_id)
    assert SceneVersion3D.objects.filter(project=project).count() == 4  # 1 initial + 3 saves
    assert project.current_version.sequence == 4


@pytest.mark.django_db
def test_invalid_scene_json_is_rejected_with_400(owner_client):
    public_id = _create_project(owner_client)

    response = owner_client.post(
        f"/api/projects3d/{public_id}/versions/", {"scene_json": {"not": "valid"}}, format="json"
    )

    assert response.status_code == 400
    assert "errors" in response.json()
    project = Project3D.objects.get(public_id=public_id)
    assert project.current_version.sequence == 1  # unchanged


@pytest.mark.django_db
def test_save_requires_authentication(owner_client):
    public_id = _create_project(owner_client)
    scene = copy.deepcopy(_MINIMAL_SCENE_3D_FIXTURE)

    response = APIClient().post(
        f"/api/projects3d/{public_id}/versions/", {"scene_json": scene}, format="json"
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_a_non_owner_cannot_save_a_version(owner_client):
    public_id = _create_project(owner_client)
    scene = copy.deepcopy(_MINIMAL_SCENE_3D_FIXTURE)

    other = get_user_model().objects.create_user(username="carol3d-version-api")
    other_client = APIClient()
    other_client.force_authenticate(other)

    response = other_client.post(
        f"/api/projects3d/{public_id}/versions/", {"scene_json": scene}, format="json"
    )

    assert response.status_code == 404
    project = Project3D.objects.get(public_id=public_id)
    assert project.current_version.sequence == 1  # unchanged


@pytest.mark.django_db
def test_saving_to_a_nonexistent_project_is_404(owner_client):
    scene = copy.deepcopy(_MINIMAL_SCENE_3D_FIXTURE)

    response = owner_client.post(
        "/api/projects3d/00000000-0000-0000-0000-000000000000/versions/",
        {"scene_json": scene},
        format="json",
    )

    assert response.status_code == 404
