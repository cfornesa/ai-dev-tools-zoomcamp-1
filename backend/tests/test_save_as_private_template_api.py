"""Tests for save-as-private-template (Task 21)."""

import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.models import Project, SceneVersion, Template

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures"
        / "valid"
        / "blank.json"
    ).read_text()
)


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
def anon_client():
    return APIClient()


@pytest.fixture
def owned_project_with_version(owner):
    project = Project.objects.create(owner=owner)
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = version
    project.save(update_fields=["current_version", "updated_at"])
    return project, version


def _save_as_template_url(project, version):
    return f"/api/projects/{project.public_id}/versions/{version.id}/save-as-template/"


@pytest.mark.django_db
def test_owner_can_save_a_version_as_a_private_template(
    owner, owner_client, owned_project_with_version
):
    project, version = owned_project_with_version

    response = owner_client.post(
        _save_as_template_url(project, version),
        {
            "name": "My reusable scene",
            "category": "Custom",
            "description": "A saved starting point",
        },
        format="json",
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "My reusable scene"
    assert body["source_type"] == "private"
    assert body["owner"] == "alice"

    template = Template.objects.get(public_id=body["id"])
    assert template.source_type == Template.SourceType.PRIVATE
    assert template.owner_id == owner.id
    assert template.source_version_id == version.id
    assert template.scene_json == version.scene_json
    # An independent copy, not the same object/reference.
    assert template.scene_json is not version.scene_json


@pytest.mark.django_db
def test_non_owner_cannot_save_someone_elses_version_as_template(
    other_client, owned_project_with_version
):
    project, version = owned_project_with_version

    response = other_client.post(
        _save_as_template_url(project, version), {"name": "Stolen template"}, format="json"
    )

    assert response.status_code == 404
    assert not Template.objects.filter(name="Stolen template").exists()


@pytest.mark.django_db
def test_anonymous_cannot_save_a_version_as_template(anon_client, owned_project_with_version):
    project, version = owned_project_with_version

    response = anon_client.post(
        _save_as_template_url(project, version), {"name": "Anon template"}, format="json"
    )

    assert response.status_code == 404
    assert not Template.objects.filter(name="Anon template").exists()


@pytest.mark.django_db
def test_name_is_required(owner_client, owned_project_with_version):
    project, version = owned_project_with_version

    response = owner_client.post(_save_as_template_url(project, version), {}, format="json")

    assert response.status_code == 400
    assert "name" in response.json()


@pytest.mark.django_db
def test_unknown_project_or_version_404s(owner_client, owned_project_with_version):
    project, version = owned_project_with_version

    response = owner_client.post(
        f"/api/projects/00000000-0000-0000-0000-000000000000/versions/{version.id}/save-as-template/",
        {"name": "Whatever"},
        format="json",
    )
    assert response.status_code == 404

    response = owner_client.post(
        f"/api/projects/{project.public_id}/versions/999999/save-as-template/",
        {"name": "Whatever"},
        format="json",
    )
    assert response.status_code == 404


# --- Visibility isolation ---


@pytest.mark.django_db
def test_saved_private_template_is_not_visible_to_other_users(
    owner_client, other_client, owned_project_with_version
):
    project, version = owned_project_with_version
    owner_client.post(
        _save_as_template_url(project, version), {"name": "Alice only"}, format="json"
    )

    other_response = other_client.get("/api/templates/")
    assert "Alice only" not in {t["name"] for t in other_response.json()}

    owner_response = owner_client.get("/api/templates/")
    assert "Alice only" in {t["name"] for t in owner_response.json()}


# --- Source preservation ---


@pytest.mark.django_db
def test_saving_as_template_does_not_modify_the_source_version_or_project(
    owner_client, owned_project_with_version
):
    project, version = owned_project_with_version
    original_scene_json = json.dumps(version.scene_json)
    original_current_version_id = project.current_version_id

    owner_client.post(
        _save_as_template_url(project, version),
        {"name": "Snapshot", "description": "d"},
        format="json",
    )

    version.refresh_from_db()
    project.refresh_from_db()
    assert json.dumps(version.scene_json) == original_scene_json
    assert project.current_version_id == original_current_version_id
    # The source version still has exactly one version in its history.
    assert project.versions.count() == 1


@pytest.mark.django_db
def test_mutating_the_stored_template_never_touches_the_source_version(
    owner_client, owned_project_with_version
):
    project, version = owned_project_with_version
    response = owner_client.post(
        _save_as_template_url(project, version), {"name": "Independent copy"}, format="json"
    )
    template = Template.objects.get(public_id=response.json()["id"])

    template.scene_json = {**template.scene_json, "id": "scene-mutated"}
    template.save()

    version.refresh_from_db()
    assert version.scene_json["id"] != "scene-mutated"


# --- Creation of projects from the resulting private template ---


@pytest.mark.django_db
def test_owner_can_create_a_new_project_from_the_saved_private_template(
    owner_client, owned_project_with_version
):
    project, version = owned_project_with_version
    save_response = owner_client.post(
        _save_as_template_url(project, version), {"name": "Reusable"}, format="json"
    )
    template_id = save_response.json()["id"]

    clone_response = owner_client.post(f"/api/templates/{template_id}/clone/")

    assert clone_response.status_code == 201
    new_project = Project.objects.get(public_id=clone_response.json()["id"])
    assert new_project.id != project.id
    assert new_project.title == "Reusable"
    new_version = new_project.versions.get()
    scene_without_id = {k: v for k, v in new_version.scene_json.items() if k != "id"}
    template_scene_without_id = {k: v for k, v in version.scene_json.items() if k != "id"}
    assert scene_without_id == template_scene_without_id


@pytest.mark.django_db
def test_other_user_cannot_clone_the_private_template(
    owner_client, other_client, owned_project_with_version
):
    project, version = owned_project_with_version
    save_response = owner_client.post(
        _save_as_template_url(project, version), {"name": "Reusable"}, format="json"
    )
    template_id = save_response.json()["id"]

    clone_response = other_client.post(f"/api/templates/{template_id}/clone/")

    assert clone_response.status_code == 404
