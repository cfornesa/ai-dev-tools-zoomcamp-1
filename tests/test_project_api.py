"""Tests for the private project CRUD API (Task 13)."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.models import Project


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
def private_project(owner):
    return Project.objects.create(owner=owner)


@pytest.mark.django_db
def test_create_project_defaults(owner_client):
    response = owner_client.post("/api/projects/")

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Untitled animation"
    assert body["description"] == ""
    assert body["visibility"] == "private"
    assert body["allow_public_remix"] is False
    assert Project.objects.count() == 1
    assert Project.objects.get().owner_id


@pytest.mark.django_db
def test_create_project_requires_authentication(anon_client):
    response = anon_client.post("/api/projects/")

    assert response.status_code == 401
    assert Project.objects.count() == 0


@pytest.mark.django_db
def test_list_returns_only_callers_own_projects(owner_client, owner, other_user):
    Project.objects.create(owner=owner, title="Mine")
    Project.objects.create(owner=other_user, title="Theirs")

    response = owner_client.get("/api/projects/")

    assert response.status_code == 200
    titles = [p["title"] for p in response.json()]
    assert titles == ["Mine"]


@pytest.mark.django_db
def test_list_requires_authentication(anon_client):
    response = anon_client.get("/api/projects/")

    assert response.status_code == 401


@pytest.mark.django_db
def test_owner_can_read_own_private_project(owner_client, private_project):
    response = owner_client.get(f"/api/projects/{private_project.public_id}/")

    assert response.status_code == 200
    assert response.json()["title"] == private_project.title


@pytest.mark.django_db
def test_non_owner_cannot_read_private_project_and_gets_404(other_client, private_project):
    response = other_client.get(f"/api/projects/{private_project.public_id}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_anonymous_cannot_read_private_project_and_gets_404(anon_client, private_project):
    response = anon_client.get(f"/api/projects/{private_project.public_id}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_missing_project_returns_404(owner_client):
    response = owner_client.get("/api/projects/00000000-0000-0000-0000-000000000000/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_denial_and_missing_record_are_indistinguishable(other_client, private_project):
    """A non-owner probing a real private project and a bogus id get the identical response."""
    real = other_client.get(f"/api/projects/{private_project.public_id}/")
    fake = other_client.get("/api/projects/00000000-0000-0000-0000-000000000000/")

    assert real.status_code == fake.status_code == 404
    assert real.content == fake.content


@pytest.mark.django_db
def test_owner_can_update_metadata_without_creating_a_version(owner_client, private_project):
    from scenes.models import SceneVersion

    response = owner_client.patch(
        f"/api/projects/{private_project.public_id}/",
        {"title": "Renamed", "description": "New description"},
        format="json",
    )

    assert response.status_code == 200
    private_project.refresh_from_db()
    assert private_project.title == "Renamed"
    assert private_project.description == "New description"
    assert SceneVersion.objects.count() == 0


@pytest.mark.django_db
def test_owner_can_toggle_visibility_and_remix_via_metadata(owner_client, private_project):
    response = owner_client.patch(
        f"/api/projects/{private_project.public_id}/",
        {"visibility": "public", "allow_public_remix": True},
        format="json",
    )

    assert response.status_code == 200
    private_project.refresh_from_db()
    assert private_project.visibility == "public"
    assert private_project.allow_public_remix is True


@pytest.mark.django_db
def test_update_rejects_invalid_visibility_value(owner_client, private_project):
    response = owner_client.patch(
        f"/api/projects/{private_project.public_id}/",
        {"visibility": "not-a-real-choice"},
        format="json",
    )

    assert response.status_code == 400
    assert "visibility" in response.json()


@pytest.mark.django_db
def test_update_rejects_blank_title(owner_client, private_project):
    response = owner_client.patch(
        f"/api/projects/{private_project.public_id}/", {"title": ""}, format="json"
    )

    assert response.status_code == 400
    assert "title" in response.json()


@pytest.mark.django_db
def test_non_owner_cannot_update_and_gets_404(other_client, private_project):
    response = other_client.patch(
        f"/api/projects/{private_project.public_id}/", {"title": "Hijacked"}, format="json"
    )

    assert response.status_code == 404
    private_project.refresh_from_db()
    assert private_project.title != "Hijacked"


@pytest.mark.django_db
def test_anonymous_cannot_update_and_gets_404(anon_client, private_project):
    response = anon_client.patch(
        f"/api/projects/{private_project.public_id}/", {"title": "Hijacked"}, format="json"
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_owner_can_soft_delete_project(owner_client, private_project, owner):
    response = owner_client.delete(f"/api/projects/{private_project.public_id}/")

    assert response.status_code == 204
    assert not Project.objects.filter(pk=private_project.pk).exists()  # hidden by default manager
    assert Project.all_objects.filter(pk=private_project.pk).exists()  # still there
    reloaded = Project.all_objects.get(pk=private_project.pk)
    assert reloaded.is_deleted is True
    assert reloaded.deleted_at is not None


@pytest.mark.django_db
def test_soft_deleted_project_excluded_from_owner_listing(owner_client, private_project):
    owner_client.delete(f"/api/projects/{private_project.public_id}/")

    response = owner_client.get("/api/projects/")

    assert response.json() == []


@pytest.mark.django_db
def test_soft_deleted_project_still_404s_not_500s_afterward(owner_client, private_project):
    owner_client.delete(f"/api/projects/{private_project.public_id}/")

    response = owner_client.get(f"/api/projects/{private_project.public_id}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_non_owner_cannot_delete_and_gets_404(other_client, private_project):
    response = other_client.delete(f"/api/projects/{private_project.public_id}/")

    assert response.status_code == 404
    assert Project.objects.filter(pk=private_project.pk, is_deleted=False).exists()


@pytest.mark.django_db
def test_anonymous_cannot_delete_and_gets_404(anon_client, private_project):
    response = anon_client.delete(f"/api/projects/{private_project.public_id}/")

    assert response.status_code == 404
    assert Project.objects.filter(pk=private_project.pk, is_deleted=False).exists()


@pytest.mark.django_db
def test_version_history_is_not_hard_deleted_with_project(owner_client, private_project, owner):
    import json
    from pathlib import Path

    from scenes.models import SceneVersion

    blank = json.loads(
        (
            Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
        ).read_text()
    )
    version = SceneVersion.objects.create(
        project=private_project,
        sequence=1,
        scene_json=blank,
        origin=SceneVersion.Origin.MANUAL,
        created_by=owner,
    )

    owner_client.delete(f"/api/projects/{private_project.public_id}/")

    assert SceneVersion.objects.filter(pk=version.pk).exists()
