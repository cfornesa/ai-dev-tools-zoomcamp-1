"""Tests for the scene-management API (issue #510): create, rename,
reorder, duplicate, delete, ownership, and per-scene version sequencing.

SQLite-portable, like most of this suite -- these tests exercise
single-writer application logic, not the PostgreSQL-only concurrency
guarantees `select_for_update()` provides (see
tests/test_scene_version_save_api.py's own module docstring for that
split). PostgreSQL-only migration coverage lives separately in
tests/test_scene_migration.py.
"""

import copy
import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.models import Project, Scene, SceneVersion

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
    return get_user_model().objects.create_user(username="scene-owner")


@pytest.fixture
def other_user(db):
    return get_user_model().objects.create_user(username="scene-other")


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


def _create_blank_project(client) -> dict:
    response = client.post("/api/projects/blank/")
    assert response.status_code == 201
    return response.json()


@pytest.mark.django_db
def test_blank_project_has_exactly_one_scene_and_active_scene_set(owner_client):
    project = _create_blank_project(owner_client)
    assert len(project["scenes"]) == 1
    assert project["active_scene"] == project["scenes"][0]["id"]
    assert project["scenes"][0]["name"] == "Scene 1"
    assert project["scenes"][0]["position"] == 0
    assert project["scenes"][0]["current_version"] == project["current_version"]


@pytest.mark.django_db
def test_create_scene_appends_without_changing_active_scene(owner_client):
    project = _create_blank_project(owner_client)
    original_active = project["active_scene"]

    response = owner_client.post(f"/api/projects/{project['id']}/scenes/", {"name": "Intro"})
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Intro"
    assert body["position"] == 1
    assert body["current_version"] is not None

    refreshed = owner_client.get(f"/api/projects/{project['id']}/").json()
    assert refreshed["active_scene"] == original_active
    assert len(refreshed["scenes"]) == 2


@pytest.mark.django_db
def test_create_scene_requires_ownership(owner_client, other_client):
    project = _create_blank_project(owner_client)
    response = other_client.post(f"/api/projects/{project['id']}/scenes/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_create_scene_requires_authentication(anon_client, owner_client):
    project = _create_blank_project(owner_client)
    response = anon_client.post(f"/api/projects/{project['id']}/scenes/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_rename_scene(owner_client):
    project = _create_blank_project(owner_client)
    scene_id = project["active_scene"]

    response = owner_client.patch(
        f"/api/projects/{project['id']}/scenes/{scene_id}/",
        {"name": "Opening shot"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Opening shot"


@pytest.mark.django_db
def test_rename_scene_requires_ownership(owner_client, other_client):
    project = _create_blank_project(owner_client)
    scene_id = project["active_scene"]

    response = other_client.patch(
        f"/api/projects/{project['id']}/scenes/{scene_id}/",
        {"name": "Hijacked"},
        content_type="application/json",
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_rename_scene_rejects_blank_name(owner_client):
    project = _create_blank_project(owner_client)
    scene_id = project["active_scene"]

    response = owner_client.patch(
        f"/api/projects/{project['id']}/scenes/{scene_id}/",
        {"name": ""},
        content_type="application/json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_duplicate_scene_deep_copies_scene_json_into_new_scene(owner_client):
    project = _create_blank_project(owner_client)
    scene_id = project["active_scene"]

    response = owner_client.post(f"/api/projects/{project['id']}/scenes/{scene_id}/duplicate/")
    assert response.status_code == 201
    duplicate = response.json()
    assert duplicate["id"] != scene_id
    assert duplicate["position"] == 1
    assert duplicate["current_version"] is not None
    assert duplicate["current_version"] != project["current_version"]

    duplicate_version = SceneVersion.objects.get(pk=duplicate["current_version"])
    source_version = SceneVersion.objects.get(pk=project["current_version"])
    # Content is deep-copied verbatim, except the scene's own `id` key,
    # which the duplicate endpoint deliberately reassigns (mirroring
    # BlankProjectCreateView/TemplateCloneView's own fresh-id convention)
    # so no two scenes ever share one.
    duplicate_content = copy.deepcopy(duplicate_version.scene_json)
    source_content = copy.deepcopy(source_version.scene_json)
    assert duplicate_content.pop("id") != source_content.pop("id")
    assert duplicate_content == source_content
    # Independent copy: mutating one's stored dict must never alias the other.
    assert duplicate_version.scene_json is not source_version.scene_json


@pytest.mark.django_db
def test_duplicate_scene_requires_ownership(owner_client, other_client):
    project = _create_blank_project(owner_client)
    scene_id = project["active_scene"]

    response = other_client.post(f"/api/projects/{project['id']}/scenes/{scene_id}/duplicate/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_delete_only_remaining_scene_is_refused(owner_client):
    project = _create_blank_project(owner_client)
    scene_id = project["active_scene"]

    response = owner_client.delete(f"/api/projects/{project['id']}/scenes/{scene_id}/")
    assert response.status_code == 400
    assert Scene.objects.filter(project__public_id=project["id"]).count() == 1


@pytest.mark.django_db
def test_delete_non_active_scene_leaves_active_scene_and_project_current_version_unchanged(
    owner_client,
):
    project = _create_blank_project(owner_client)
    original_active = project["active_scene"]
    original_current_version = project["current_version"]

    created = owner_client.post(f"/api/projects/{project['id']}/scenes/", {"name": "Extra"}).json()

    response = owner_client.delete(f"/api/projects/{project['id']}/scenes/{created['id']}/")
    assert response.status_code == 204

    refreshed = owner_client.get(f"/api/projects/{project['id']}/").json()
    assert refreshed["active_scene"] == original_active
    assert refreshed["current_version"] == original_current_version
    assert len(refreshed["scenes"]) == 1


@pytest.mark.django_db
def test_delete_active_scene_reassigns_active_scene_and_mirrors_current_version(owner_client):
    project = _create_blank_project(owner_client)
    original_active = project["active_scene"]

    created = owner_client.post(f"/api/projects/{project['id']}/scenes/", {"name": "Extra"}).json()

    response = owner_client.delete(f"/api/projects/{project['id']}/scenes/{original_active}/")
    assert response.status_code == 204

    refreshed = owner_client.get(f"/api/projects/{project['id']}/").json()
    assert refreshed["active_scene"] == created["id"]
    assert refreshed["current_version"] == created["current_version"]
    assert len(refreshed["scenes"]) == 1
    assert not Scene.objects.filter(pk__in=[]).exists()  # sanity: no stray query error


@pytest.mark.django_db
def test_delete_scene_only_cascades_its_own_versions(owner_client):
    project = _create_blank_project(owner_client)
    original_active_id = Scene.objects.get(public_id=project["active_scene"]).pk

    created = owner_client.post(f"/api/projects/{project['id']}/scenes/", {"name": "Extra"}).json()
    created_scene_pk = Scene.objects.get(public_id=created["id"]).pk
    created_version_id = created["current_version"]

    owner_client.delete(f"/api/projects/{project['id']}/scenes/{created['id']}/")

    # The deleted scene's own version is gone (cascaded)...
    assert not SceneVersion.objects.filter(pk=created_version_id).exists()
    assert not Scene.objects.filter(pk=created_scene_pk).exists()
    # ...but the surviving scene and its own version are untouched.
    assert Scene.objects.filter(pk=original_active_id).exists()
    remaining_project = Project.all_objects.get(public_id=project["id"])
    assert remaining_project.versions.count() == 1


@pytest.mark.django_db
def test_delete_scene_requires_ownership(owner_client, other_client):
    project = _create_blank_project(owner_client)
    owner_client.post(f"/api/projects/{project['id']}/scenes/", {"name": "Extra"})
    scene_id = project["active_scene"]

    response = other_client.delete(f"/api/projects/{project['id']}/scenes/{scene_id}/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_reorder_scenes(owner_client):
    project = _create_blank_project(owner_client)
    first_id = project["active_scene"]
    second = owner_client.post(f"/api/projects/{project['id']}/scenes/", {"name": "Second"}).json()
    third = owner_client.post(f"/api/projects/{project['id']}/scenes/", {"name": "Third"}).json()

    response = owner_client.post(
        f"/api/projects/{project['id']}/scenes/reorder/",
        {"scene_ids": [third["id"], first_id, second["id"]]},
        content_type="application/json",
    )
    assert response.status_code == 200
    body = response.json()
    by_id = {s["id"]: s["position"] for s in body}
    assert by_id[third["id"]] == 0
    assert by_id[first_id] == 1
    assert by_id[second["id"]] == 2


@pytest.mark.django_db
def test_reorder_rejects_incomplete_or_mismatched_scene_ids(owner_client):
    project = _create_blank_project(owner_client)
    first_id = project["active_scene"]
    owner_client.post(f"/api/projects/{project['id']}/scenes/", {"name": "Second"})

    response = owner_client.post(
        f"/api/projects/{project['id']}/scenes/reorder/",
        {"scene_ids": [first_id]},
        content_type="application/json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_reorder_requires_ownership(owner_client, other_client):
    project = _create_blank_project(owner_client)
    first_id = project["active_scene"]

    response = other_client.post(
        f"/api/projects/{project['id']}/scenes/reorder/",
        {"scene_ids": [first_id]},
        content_type="application/json",
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_scene_list_endpoint_matches_project_serializer_scenes(owner_client):
    project = _create_blank_project(owner_client)
    listed = owner_client.get(f"/api/projects/{project['id']}/scenes/").json()
    assert listed == project["scenes"]


@pytest.mark.django_db
def test_version_sequences_are_scoped_per_scene_not_per_project(owner_client):
    project = _create_blank_project(owner_client)

    # Save a second manual version on the active scene (sequence 2 there).
    save_response = owner_client.post(
        f"/api/projects/{project['id']}/versions/",
        {"scene_json": BLANK_SCENE, "origin": "manual"},
        content_type="application/json",
    )
    assert save_response.status_code == 201
    assert save_response.json()["sequence"] == 2

    # A brand-new second scene starts its own sequence at 1, not 3.
    second_scene = owner_client.post(
        f"/api/projects/{project['id']}/scenes/", {"name": "Second"}
    ).json()
    second_scene_obj = Scene.objects.get(public_id=second_scene["id"])
    second_version = SceneVersion.objects.get(pk=second_scene["current_version"])
    assert second_version.sequence == 1
    assert second_version.scene_id == second_scene_obj.pk


@pytest.mark.django_db
def test_manual_save_on_a_project_created_without_going_through_blank_endpoint_still_works(
    owner_client, owner
):
    """Issue #510's own compatibility requirement: `Project.objects.create()`
    (no scene at all, used pervasively by pre-#510 tests and by
    `ProjectListCreateView.post`) must still support a manual version save,
    lazily creating its first scene rather than 500ing on `SceneVersion
    .scene`'s NOT NULL constraint."""
    project = Project.objects.create(owner=owner)
    assert project.scenes.count() == 0

    response = owner_client.post(
        f"/api/projects/{project.public_id}/versions/",
        {"scene_json": BLANK_SCENE, "origin": "manual"},
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.json()["sequence"] == 1

    project.refresh_from_db()
    assert project.active_scene_id is not None
    assert project.active_scene.current_version_id == project.current_version_id


@pytest.mark.django_db
def test_restoring_a_version_updates_the_scenes_own_current_version(owner_client):
    project = _create_blank_project(owner_client)
    second_save = owner_client.post(
        f"/api/projects/{project['id']}/versions/",
        {"scene_json": BLANK_SCENE, "origin": "manual"},
        content_type="application/json",
    ).json()
    first_version_id = project["current_version"]

    response = owner_client.post(
        f"/api/projects/{project['id']}/versions/{first_version_id}/restore/"
    )
    assert response.status_code == 201
    restored = response.json()

    scene = Scene.objects.get(public_id=project["active_scene"])
    assert scene.current_version_id == restored["id"]
    refreshed_project = Project.all_objects.get(public_id=project["id"])
    assert refreshed_project.current_version_id == restored["id"]
    assert restored["id"] != second_save["id"]
