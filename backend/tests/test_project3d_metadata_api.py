"""Tests for issue #301: Project3D title-rename via a title-only metadata
PATCH -- the 3D counterpart of the title-related tests in
test_project_api.py, scoped to Project3D's title-only metadata shape."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.models import Project3D


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="alice3d-metadata")


@pytest.fixture
def other_user(db):
    return get_user_model().objects.create_user(username="bob3d-metadata")


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
def anon_client():
    return APIClient()


def create_project3d(client):
    response = client.post("/api/projects3d/")
    assert response.status_code == 201
    return response.json()["id"]


@pytest.mark.django_db
def test_owner_can_rename_the_title(owner_client):
    public_id = create_project3d(owner_client)

    response = owner_client.patch(
        f"/api/projects3d/{public_id}/", {"title": "Renamed 3D scene"}, format="json"
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Renamed 3D scene"
    project = Project3D.objects.get(public_id=public_id)
    assert project.title == "Renamed 3D scene"


@pytest.mark.django_db
def test_rejects_a_blank_title(owner_client):
    public_id = create_project3d(owner_client)

    response = owner_client.patch(f"/api/projects3d/{public_id}/", {"title": ""}, format="json")

    assert response.status_code == 400
    assert "title" in response.json()


@pytest.mark.django_db
def test_non_owner_cannot_rename_and_gets_404(other_client, owner_client):
    public_id = create_project3d(owner_client)

    response = other_client.patch(
        f"/api/projects3d/{public_id}/", {"title": "Hijacked"}, format="json"
    )

    assert response.status_code == 404
    project = Project3D.objects.get(public_id=public_id)
    assert project.title != "Hijacked"


@pytest.mark.django_db
def test_anonymous_user_cannot_rename_and_gets_404(anon_client, owner_client):
    public_id = create_project3d(owner_client)

    response = anon_client.patch(
        f"/api/projects3d/{public_id}/", {"title": "Hijacked"}, format="json"
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_patch_never_creates_a_scene_version(owner_client):
    from scenes.models import SceneVersion3D

    public_id = create_project3d(owner_client)
    before = SceneVersion3D.objects.filter(project__public_id=public_id).count()

    response = owner_client.patch(
        f"/api/projects3d/{public_id}/", {"title": "Renamed"}, format="json"
    )

    assert response.status_code == 200
    assert SceneVersion3D.objects.filter(project__public_id=public_id).count() == before
