"""Issue #243: thumbnail generation triggers and the owner-facing
thumbnail-serving endpoint for the 3D scene document family -- the 3D
counterpart of `tests/test_project_thumbnail_api.py`.

Uses `@pytest.mark.django_db(transaction=True)` for the same reason as
the 2D test file: generation is scheduled with `transaction.on_commit`,
which only fires against a really-committed transaction.
"""

import copy
import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.models import Project3D, SceneVersion3D, Thumbnail3D

FIXTURES3D = Path(__file__).resolve().parent.parent.parent / "schema" / "fixtures3d" / "valid"
MINIMAL_SCENE3D = json.loads((FIXTURES3D / "minimal.json").read_text())
FEATURE_RICH_SCENE3D = json.loads((FIXTURES3D / "feature_rich.json").read_text())


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="alice")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def project3d(owner):
    project = Project3D.objects.create(owner=owner, title="My 3D scene")
    scene = copy.deepcopy(MINIMAL_SCENE3D)
    version = SceneVersion3D.objects.create(
        project=project,
        sequence=1,
        scene_json=scene,
        created_by=owner,
        origin=SceneVersion3D.Origin.MANUAL,
    )
    project.current_version = version
    project.save(update_fields=["current_version"])
    return project


def _versions_url(project):
    return f"/api/projects3d/{project.public_id}/versions/"


def _thumbnail_url(project):
    return f"/api/projects3d/{project.public_id}/thumbnail/"


def _detail_url(project):
    return f"/api/projects3d/{project.public_id}/"


# --- Generation trigger (unconditional -- no visibility field yet) ---


@pytest.mark.django_db(transaction=True)
def test_creating_a_blank_3d_project_schedules_thumbnail_generation(owner_client):
    response = owner_client.post("/api/projects3d/")
    assert response.status_code == 201
    body = response.json()
    project = Project3D.objects.get(public_id=body["id"])

    thumbnail = Thumbnail3D.objects.get(scene_version=project.current_version)
    assert thumbnail.is_fallback is False
    assert thumbnail.width == 320
    assert thumbnail.height == 240


@pytest.mark.django_db(transaction=True)
def test_saving_a_new_version_updates_the_thumbnail_to_follow_it(owner_client, project3d):
    from scenes.thumbnail_generation3d import ensure_thumbnail_for_version3d

    first_version = project3d.current_version
    # The `project3d` fixture creates its version directly at the model
    # layer (not through the API), so nothing has scheduled a thumbnail
    # for it yet -- generate it explicitly to set up "an existing
    # thumbnail for the previous current version" before saving a new one.
    ensure_thumbnail_for_version3d(first_version.id)

    new_scene = copy.deepcopy(FEATURE_RICH_SCENE3D)
    save_response = owner_client.post(
        _versions_url(project3d), {"scene_json": new_scene}, format="json"
    )
    assert save_response.status_code == 201
    second_version_id = save_response.json()["id"]

    second_thumbnail = Thumbnail3D.objects.get(scene_version_id=second_version_id)
    assert second_thumbnail.is_fallback is False
    # Version 1's thumbnail is retained, not deleted.
    assert Thumbnail3D.objects.filter(scene_version=first_version).exists()

    thumb_response = owner_client.get(_thumbnail_url(project3d))
    assert thumb_response.status_code == 200
    assert thumb_response.content == bytes(second_thumbnail.image_data)


# --- Owner-facing thumbnail endpoint ---


@pytest.mark.django_db(transaction=True)
def test_project_serializer_exposes_a_resolvable_thumbnail_url(owner_client, project3d):
    response = owner_client.get(_detail_url(project3d))
    assert response.status_code == 200
    thumbnail_url = response.json()["thumbnail_url"]
    assert thumbnail_url is not None

    image_response = owner_client.get(thumbnail_url)
    assert image_response.status_code == 200
    assert image_response["Content-Type"] == "image/png"


@pytest.mark.django_db(transaction=True)
def test_thumbnail_url_is_null_for_a_project_with_no_current_version(owner_client, owner):
    # Bypasses the creation endpoint (which always creates a version) to
    # exercise a project genuinely with none.
    project = Project3D.objects.create(owner=owner, title="No version yet")
    response = owner_client.get(_detail_url(project))
    assert response.status_code == 200
    assert response.json()["thumbnail_url"] is None


@pytest.mark.django_db(transaction=True)
def test_thumbnail_endpoint_404s_for_a_project_with_no_current_version(owner_client, owner):
    project = Project3D.objects.create(owner=owner, title="No version yet")
    response = owner_client.get(_thumbnail_url(project))
    assert response.status_code == 404


@pytest.mark.django_db(transaction=True)
def test_thumbnail_endpoint_404s_for_a_non_owner_and_anonymous_caller(anon_client, project3d):
    other = get_user_model().objects.create_user(username="mallory")
    other_client = APIClient()
    other_client.force_authenticate(other)

    other_response = other_client.get(_thumbnail_url(project3d))
    assert other_response.status_code == 404

    anon_response = anon_client.get(_thumbnail_url(project3d))
    assert anon_response.status_code == 404


@pytest.mark.django_db(transaction=True)
def test_thumbnail_endpoint_lazily_generates_when_missing(owner_client, owner):
    """Create the version/current_version pointer directly at the model
    layer, bypassing the API's own post-commit scheduling, to simulate "a
    project whose current version has no cached Thumbnail3D yet"."""
    project = Project3D.objects.create(owner=owner, title="Direct model creation")
    version = SceneVersion3D.objects.create(
        project=project,
        sequence=1,
        scene_json=copy.deepcopy(MINIMAL_SCENE3D),
        created_by=owner,
        origin=SceneVersion3D.Origin.MANUAL,
    )
    project.current_version = version
    project.save(update_fields=["current_version"])
    assert not Thumbnail3D.objects.filter(scene_version=version).exists()

    response = owner_client.get(_thumbnail_url(project))

    assert response.status_code == 200
    assert response["Content-Type"] == "image/png"
    assert Thumbnail3D.objects.filter(scene_version=version).exists()


@pytest.mark.django_db(transaction=True)
def test_thumbnail_row_is_never_duplicated_across_repeated_generation(owner_client, project3d):
    from scenes.thumbnail_generation3d import ensure_thumbnail_for_version3d

    version_id = project3d.current_version_id
    ensure_thumbnail_for_version3d(version_id)
    ensure_thumbnail_for_version3d(version_id)

    assert Thumbnail3D.objects.filter(scene_version_id=version_id).count() == 1
