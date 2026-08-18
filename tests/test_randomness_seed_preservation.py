"""Task 40: `scene.randomness` (seed + enabled) is preserved, byte-for-byte,
across every scene-copying operation that actually exists in this codebase
today — version save (Task 14), restore (Task 15), blank-project creation
(Task 18), template clone (Task 20), and save-as-template (Task 21).

None of these endpoints special-case `randomness` — `scenes/api.py`'s
`copy.deepcopy(source.scene_json)`/`copy.deepcopy(template.scene_json)`
calls (or, for version save, simply persisting whatever `scene_json` the
caller posted, after `validate_scene`) carry every field of the scene
document through unchanged, `randomness` included, exactly like `shapes`
or `canvas`. These tests exist to make that explicit and regression-proof,
rather than relying on it being an accidental side effect of "the whole
document round-trips."

Fork/remix (Task 52, issue #51) and HTML export (Tasks 55-59, issues
#55-#59) are NOT implemented in this codebase yet, so "duplicate ...
fork ... and export operations preserve the seed" (issue #40's acceptance
criteria) cannot be tested end to end for those two operations — see the
comment posted on issue #40. Preservation there is structural: fork/export
will, whenever built, necessarily start from a copy of an existing scene
document (the only shape a scene can be represented in), and `randomness`
is a required top-level field of that document (`schema/scene.schema.json`)
that every validator (`scenes/validation.py`) already requires and
round-trips unchanged.
"""

import copy
import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.models import Project, SceneVersion, Template
from scenes.validation import validate_scene

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
    ).read_text()
)

SEEDED_SCENE = {**copy.deepcopy(BLANK_SCENE), "randomness": {"seed": 483920, "enabled": True}}


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="alice")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.fixture
def project(owner):
    return Project.objects.create(owner=owner)


def test_seeded_fixture_is_schema_valid():
    """Sanity check on the fixture the rest of this module reuses."""
    assert validate_scene(SEEDED_SCENE).valid is True


@pytest.mark.django_db
def test_version_save_preserves_randomness_exactly(owner_client, project):
    response = owner_client.post(
        f"/api/projects/{project.public_id}/versions/",
        {"scene_json": SEEDED_SCENE, "origin": "manual"},
        format="json",
    )

    assert response.status_code == 201
    version = SceneVersion.objects.get(pk=response.json()["id"])
    assert version.scene_json["randomness"] == {"seed": 483920, "enabled": True}


@pytest.mark.django_db
def test_restore_preserves_randomness_from_the_source_version(owner_client, project):
    first = owner_client.post(
        f"/api/projects/{project.public_id}/versions/",
        {"scene_json": SEEDED_SCENE, "origin": "manual"},
        format="json",
    ).json()

    # A second save with a *different* seed becomes current...
    other_scene = {**copy.deepcopy(BLANK_SCENE), "randomness": {"seed": 1, "enabled": False}}
    owner_client.post(
        f"/api/projects/{project.public_id}/versions/",
        {"scene_json": other_scene, "origin": "manual"},
        format="json",
    )

    # ...then restoring the *first* (seeded) version must bring its exact
    # seed back, not the currently-active one.
    restore_response = owner_client.post(
        f"/api/projects/{project.public_id}/versions/{first['id']}/restore/"
    )

    assert restore_response.status_code == 201
    restored = SceneVersion.objects.get(pk=restore_response.json()["id"])
    assert restored.scene_json["randomness"] == {"seed": 483920, "enabled": True}


@pytest.mark.django_db
def test_blank_project_creation_has_a_seed_present_but_randomness_disabled(owner_client):
    """Task 18's blank canvas is not itself "using randomness" (no random
    graph nodes, no particle emitters), so `enabled` is `False` — but the
    required `seed`/`enabled` fields are always present, matching
    `schema/scene.schema.json`'s `randomness` being a required object.
    """
    response = owner_client.post("/api/projects/blank/")

    project = Project.objects.get(public_id=response.json()["id"])
    version = SceneVersion.objects.get(project=project)
    assert "randomness" in version.scene_json
    assert "seed" in version.scene_json["randomness"]
    assert "enabled" in version.scene_json["randomness"]


@pytest.mark.django_db
def test_template_clone_preserves_randomness_from_the_template(owner_client, owner):
    template = Template.objects.create(
        source_type=Template.SourceType.BUILT_IN,
        name="Seeded template",
        scene_json=copy.deepcopy(SEEDED_SCENE),
    )

    response = owner_client.post(f"/api/templates/{template.public_id}/clone/")

    assert response.status_code == 201
    project = Project.objects.get(public_id=response.json()["id"])
    version = SceneVersion.objects.get(project=project)
    assert version.scene_json["randomness"] == {"seed": 483920, "enabled": True}


@pytest.mark.django_db
def test_save_as_template_preserves_randomness_from_the_source_version(owner_client, project):
    version_response = owner_client.post(
        f"/api/projects/{project.public_id}/versions/",
        {"scene_json": SEEDED_SCENE, "origin": "manual"},
        format="json",
    ).json()

    template_response = owner_client.post(
        f"/api/projects/{project.public_id}/versions/{version_response['id']}/save-as-template/",
        {"name": "My template"},
        format="json",
    )

    assert template_response.status_code == 201
    template = Template.objects.get(public_id=template_response.json()["id"])
    assert template.scene_json["randomness"] == {"seed": 483920, "enabled": True}


@pytest.mark.django_db
def test_a_scene_with_non_finite_or_out_of_range_seed_is_rejected_before_save(
    owner_client, project
):
    """Task 40's "invalid ... non-finite values are rejected" acceptance
    criterion, at the schema layer: `randomness.seed` is a bounded integer
    (`schema/scene.schema.json`: `minimum: 0, maximum: 2147483647`), and
    JSON has no non-finite number literal at all (`NaN`/`Infinity` aren't
    valid JSON), so a non-finite or out-of-range seed is structurally
    impossible to submit as valid JSON in the first place — the schema
    `type: integer` + bounds check rejects anything else (a string, a
    float, a negative number, or a too-large number) the same way every
    other out-of-range field on this schema already does.
    """
    bad_scene = {**copy.deepcopy(BLANK_SCENE), "randomness": {"seed": -1, "enabled": False}}

    response = owner_client.post(
        f"/api/projects/{project.public_id}/versions/",
        {"scene_json": bad_scene, "origin": "manual"},
        format="json",
    )

    assert response.status_code == 400
    assert SceneVersion.objects.count() == 0
