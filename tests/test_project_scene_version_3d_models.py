"""Model tests for scenes.Project3D / scenes.SceneVersion3D (Task 180/#212).

Mirrors tests/test_project_scene_version_models.py's pattern for the 2D
models. These are the minimal Django persistence models for the 3D scene
document family (schema/scene3d.schema.json, scenes/validation3d.py) --
deliberately separate from Project/SceneVersion per #208's decision. No
API endpoints exist yet (out of scope for #212), so these tests exercise
the models directly.
"""

import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from scenes.models import Project3D, SceneVersion3D

MINIMAL_SCENE_3D = json.loads(
    (
        Path(__file__).resolve().parent.parent / "schema" / "fixtures3d" / "valid" / "minimal.json"
    ).read_text()
)

FEATURE_RICH_SCENE_3D = json.loads(
    (
        Path(__file__).resolve().parent.parent
        / "schema"
        / "fixtures3d"
        / "valid"
        / "feature_rich.json"
    ).read_text()
)


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username="alice3d")


@pytest.mark.django_db
def test_create_project3d_with_defaults(user):
    project = Project3D.objects.create(owner=user)

    assert project.title == "Untitled 3D scene"
    assert project.current_version is None
    assert project.public_id is not None


@pytest.mark.django_db
def test_create_scene_version3d_and_set_as_current(user):
    project = Project3D.objects.create(owner=user)
    version = SceneVersion3D.objects.create(
        project=project,
        sequence=1,
        scene_json=MINIMAL_SCENE_3D,
        created_by=user,
        origin=SceneVersion3D.Origin.MANUAL,
    )

    project.current_version = version
    project.save()
    project.refresh_from_db()

    assert project.current_version_id == version.id


@pytest.mark.django_db
def test_a_feature_rich_scene_can_also_be_saved(user):
    project = Project3D.objects.create(owner=user)

    version = SceneVersion3D.objects.create(
        project=project, sequence=1, scene_json=FEATURE_RICH_SCENE_3D
    )

    assert version.pk is not None
    assert version.scene_json["objects"][0]["id"] == "table-top"


@pytest.mark.django_db
def test_invalid_scene_json_is_rejected_on_save(user):
    project = Project3D.objects.create(owner=user)
    bad_scene = dict(MINIMAL_SCENE_3D)
    bad_scene["camera"] = {"position": {"x": 0, "y": 0, "z": 0}}  # missing required fields

    with pytest.raises(ValidationError):
        SceneVersion3D.objects.create(project=project, sequence=1, scene_json=bad_scene)


@pytest.mark.django_db
def test_a_2d_scene_document_is_rejected_by_the_3d_model(user):
    project = Project3D.objects.create(owner=user)
    two_d_scene = json.loads(
        (
            Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
        ).read_text()
    )

    with pytest.raises(ValidationError):
        SceneVersion3D.objects.create(project=project, sequence=1, scene_json=two_d_scene)


@pytest.mark.django_db
def test_duplicate_sequence_within_project_rejected(user):
    project = Project3D.objects.create(owner=user)
    SceneVersion3D.objects.create(project=project, sequence=1, scene_json=MINIMAL_SCENE_3D)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            SceneVersion3D.objects.create(project=project, sequence=1, scene_json=MINIMAL_SCENE_3D)


@pytest.mark.django_db
def test_sequence_must_be_at_least_one(user):
    project = Project3D.objects.create(owner=user)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            SceneVersion3D.objects.create(project=project, sequence=0, scene_json=MINIMAL_SCENE_3D)


@pytest.mark.django_db
def test_same_sequence_is_allowed_across_different_projects(user):
    project_a = Project3D.objects.create(owner=user)
    project_b = Project3D.objects.create(owner=user)

    SceneVersion3D.objects.create(project=project_a, sequence=1, scene_json=MINIMAL_SCENE_3D)
    version_b = SceneVersion3D.objects.create(
        project=project_b, sequence=1, scene_json=MINIMAL_SCENE_3D
    )

    assert version_b.pk is not None


@pytest.mark.django_db
def test_versions_are_retrievable_via_the_related_name(user):
    project = Project3D.objects.create(owner=user)
    SceneVersion3D.objects.create(project=project, sequence=1, scene_json=MINIMAL_SCENE_3D)
    SceneVersion3D.objects.create(project=project, sequence=2, scene_json=MINIMAL_SCENE_3D)

    sequences = list(project.versions.values_list("sequence", flat=True))

    assert sequences == [1, 2]
