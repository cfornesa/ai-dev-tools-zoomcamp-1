"""Tests for issue #296: Project3D publish/unpublish + the public detail
endpoint -- the 3D counterpart of test_project_publish_api.py."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.models import Project3D


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="alice3d-publish")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


def create_project3d(client):
    response = client.post("/api/projects3d/")
    assert response.status_code == 201
    return response.json()["id"]


@pytest.mark.django_db
def test_new_project3d_starts_private(owner_client):
    public_id = create_project3d(owner_client)
    project = Project3D.objects.get(public_id=public_id)
    assert project.visibility == Project3D.Visibility.PRIVATE
    assert project.published_at is None


@pytest.mark.django_db
def test_owner_can_publish_a_project_with_the_default_title_once_it_has_a_saved_version(
    owner_client,
):
    """Issue #296: unlike 2D, Project3D has no title-rename UI anywhere
    today (a documented, deliberate scope boundary -- see
    scenes/publishing.py's validate_meaningful_metadata_3d), so the
    untouched default title alone never blocks publishing -- only a
    missing saved version does (see the next test)."""
    public_id = create_project3d(owner_client)

    response = owner_client.post(f"/api/projects3d/{public_id}/publish/")

    assert response.status_code == 200
    assert response.json()["visibility"] == "public"
    project = Project3D.objects.get(public_id=public_id)
    assert project.visibility == Project3D.Visibility.PUBLIC
    assert project.published_at is not None


@pytest.mark.django_db
def test_publish_is_blocked_with_no_saved_version(owner_client, owner):
    project = Project3D.objects.create(owner=owner, title="A real scene")

    response = owner_client.post(f"/api/projects3d/{project.public_id}/publish/")

    assert response.status_code == 400
    assert "current_version" in response.json()["errors"]


@pytest.mark.django_db
def test_owner_can_unpublish_immediately_no_content_validation_needed(owner_client):
    public_id = create_project3d(owner_client)
    project = Project3D.objects.get(public_id=public_id)
    project.title = "A real scene"
    project.save(update_fields=["title"])
    owner_client.post(f"/api/projects3d/{public_id}/publish/")

    response = owner_client.post(f"/api/projects3d/{public_id}/unpublish/")

    assert response.status_code == 200
    assert response.json()["visibility"] == "private"
    project.refresh_from_db()
    assert project.visibility == Project3D.Visibility.PRIVATE
    assert project.published_at is None


@pytest.mark.django_db
def test_non_owner_cannot_publish_or_unpublish_and_gets_404(owner_client, owner):
    public_id = create_project3d(owner_client)
    other = get_user_model().objects.create_user(username="bob3d-publish")
    other_client = APIClient()
    other_client.force_authenticate(other)

    publish_response = other_client.post(f"/api/projects3d/{public_id}/publish/")
    unpublish_response = other_client.post(f"/api/projects3d/{public_id}/unpublish/")

    assert publish_response.status_code == 404
    assert unpublish_response.status_code == 404


@pytest.mark.django_db
def test_anonymous_cannot_publish_or_unpublish_and_gets_404(owner_client):
    public_id = create_project3d(owner_client)
    anon_client = APIClient()

    publish_response = anon_client.post(f"/api/projects3d/{public_id}/publish/")
    unpublish_response = anon_client.post(f"/api/projects3d/{public_id}/unpublish/")

    assert publish_response.status_code == 404
    assert unpublish_response.status_code == 404


@pytest.mark.django_db
def test_publish_and_unpublish_404_for_a_nonexistent_project(owner_client):
    import uuid

    missing_id = uuid.uuid4()
    assert owner_client.post(f"/api/projects3d/{missing_id}/publish/").status_code == 404
    assert owner_client.post(f"/api/projects3d/{missing_id}/unpublish/").status_code == 404


# --- Public detail endpoint ---


@pytest.mark.django_db
def test_public_detail_404s_for_a_private_project_including_the_owner(owner_client):
    public_id = create_project3d(owner_client)
    anon_client = APIClient()

    owner_response = owner_client.get(f"/api/public/projects3d/{public_id}/")
    anon_response = anon_client.get(f"/api/public/projects3d/{public_id}/")

    assert owner_response.status_code == 404
    assert anon_response.status_code == 404


@pytest.mark.django_db
def test_public_detail_returns_the_current_version_for_a_published_project_anonymously(
    owner_client,
):
    public_id = create_project3d(owner_client)
    project = Project3D.objects.get(public_id=public_id)
    project.title = "A real scene"
    project.save(update_fields=["title"])
    owner_client.post(f"/api/projects3d/{public_id}/publish/")

    response = APIClient().get(f"/api/public/projects3d/{public_id}/")

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "A real scene"
    assert body["current_version"]["sequence"] == 1
    assert body["owner"] == "alice3d-publish"
    # No internal/owner-private fields leak through.
    assert "is_deleted" not in body
    assert "visibility" not in body


@pytest.mark.django_db
def test_public_detail_404s_again_immediately_after_unpublishing(owner_client):
    public_id = create_project3d(owner_client)
    project = Project3D.objects.get(public_id=public_id)
    project.title = "A real scene"
    project.save(update_fields=["title"])
    owner_client.post(f"/api/projects3d/{public_id}/publish/")
    assert APIClient().get(f"/api/public/projects3d/{public_id}/").status_code == 200

    owner_client.post(f"/api/projects3d/{public_id}/unpublish/")

    assert APIClient().get(f"/api/public/projects3d/{public_id}/").status_code == 404


@pytest.mark.django_db
def test_public_detail_404s_for_a_nonexistent_project(db):
    import uuid

    response = APIClient().get(f"/api/public/projects3d/{uuid.uuid4()}/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_owner_scoped_detail_and_thumbnail_still_resolve_for_a_public_project_via_read_widening(
    owner_client,
):
    """Issue #296 widened Action.PROJECT3D_READ itself (public OR owner) --
    confirms the existing owner-scoped detail/thumbnail routes still work
    for the owner, and now also for an anonymous caller once public."""
    public_id = create_project3d(owner_client)
    project = Project3D.objects.get(public_id=public_id)
    project.title = "A real scene"
    project.save(update_fields=["title"])
    owner_client.post(f"/api/projects3d/{public_id}/publish/")

    anon_client = APIClient()
    response = anon_client.get(f"/api/projects3d/{public_id}/")

    assert response.status_code == 200
    assert response.json()["visibility"] == "public"


@pytest.mark.django_db
def test_owner_scoped_detail_still_404s_for_a_private_project_to_a_non_owner(owner_client):
    public_id = create_project3d(owner_client)
    anon_client = APIClient()

    response = anon_client.get(f"/api/projects3d/{public_id}/")

    assert response.status_code == 404
