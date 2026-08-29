"""Tests for the minimal Project3D/SceneVersion3D creation+retrieval API (#213)."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.models import Project3D, SceneVersion3D
from scenes.validation3d import validate_scene3d


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="alice3d-api")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.mark.django_db
def test_creates_project3d_with_a_valid_initial_version(owner_client):
    response = owner_client.post("/api/projects3d/")

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Untitled 3D scene"
    assert body["current_version"]["sequence"] == 1
    assert body["current_version"]["origin"] == "manual"

    result = validate_scene3d(body["current_version"]["scene_json"])
    assert result.valid is True


@pytest.mark.django_db
def test_creates_exactly_one_project_and_version(owner_client):
    response = owner_client.post("/api/projects3d/")

    project = Project3D.objects.get(public_id=response.json()["id"])
    assert SceneVersion3D.objects.filter(project=project).count() == 1
    assert project.current_version_id is not None


@pytest.mark.django_db
def test_create_requires_authentication(db):
    response = APIClient().post("/api/projects3d/")

    assert response.status_code == 401
    assert Project3D.objects.count() == 0


@pytest.mark.django_db
def test_list_requires_authentication(db):
    response = APIClient().get("/api/projects3d/")

    assert response.status_code == 401


@pytest.mark.django_db
def test_list_returns_only_the_caller_s_own_projects(owner_client, owner):
    owner_client.post("/api/projects3d/")
    owner_client.post("/api/projects3d/")

    other = get_user_model().objects.create_user(username="bob3d-api")
    other_client = APIClient()
    other_client.force_authenticate(other)
    other_client.post("/api/projects3d/")

    response = owner_client.get("/api/projects3d/")

    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.django_db
def test_owner_can_retrieve_their_own_project(owner_client):
    create_response = owner_client.post("/api/projects3d/")
    public_id = create_response.json()["id"]

    response = owner_client.get(f"/api/projects3d/{public_id}/")

    assert response.status_code == 200
    assert response.json()["id"] == public_id


@pytest.mark.django_db
def test_anonymous_retrieval_is_404_not_401(owner_client):
    create_response = owner_client.post("/api/projects3d/")
    public_id = create_response.json()["id"]

    response = APIClient().get(f"/api/projects3d/{public_id}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_a_non_owner_cannot_retrieve_another_user_s_project(owner_client):
    create_response = owner_client.post("/api/projects3d/")
    public_id = create_response.json()["id"]

    other = get_user_model().objects.create_user(username="carol3d-api")
    other_client = APIClient()
    other_client.force_authenticate(other)

    response = other_client.get(f"/api/projects3d/{public_id}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_retrieving_a_nonexistent_project_is_404(owner_client):
    response = owner_client.get("/api/projects3d/00000000-0000-0000-0000-000000000000/")

    assert response.status_code == 404
