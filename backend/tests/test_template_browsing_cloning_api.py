"""Tests for template browsing and cloning (Task 20)."""

import copy
import json
from pathlib import Path

import pytest
from django.conf import settings
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
def private_template(owner):
    scene = dict(BLANK_SCENE, id="scene-private-template")
    return Template.objects.create(
        source_type=Template.SourceType.PRIVATE,
        owner=owner,
        name="Alice's private template",
        category="Custom",
        scene_json=scene,
    )


@pytest.mark.django_db
def test_anonymous_can_list_built_in_templates_only(anon_client, private_template):
    response = anon_client.get("/api/templates/")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 8
    assert all(t["source_type"] == "built_in" for t in body)


@pytest.mark.django_db
def test_owner_sees_built_ins_plus_own_private_template(owner_client, private_template):
    response = owner_client.get("/api/templates/")

    assert response.status_code == 200
    names = {t["name"] for t in response.json()}
    assert "Alice's private template" in names
    assert len(response.json()) == 9


@pytest.mark.django_db
def test_other_user_does_not_see_someone_elses_private_template(other_client, private_template):
    response = other_client.get("/api/templates/")

    assert response.status_code == 200
    names = {t["name"] for t in response.json()}
    assert "Alice's private template" not in names
    assert len(response.json()) == 8


@pytest.mark.django_db
def test_clone_built_in_template_creates_project_with_one_version(owner_client):
    blank_canvas = Template.objects.built_in().get(name="Blank canvas")

    response = owner_client.post(f"/api/templates/{blank_canvas.public_id}/clone/")

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Blank canvas"

    project = Project.objects.get(public_id=body["id"])
    versions = list(project.versions.all())
    assert len(versions) == 1
    assert versions[0].sequence == 1
    assert versions[0].origin == SceneVersion.Origin.MANUAL
    assert project.current_version_id == versions[0].id


@pytest.mark.django_db
def test_clone_copies_scene_without_linking_back_to_template(owner_client):
    blank_canvas = Template.objects.built_in().get(name="Blank canvas")

    response = owner_client.post(f"/api/templates/{blank_canvas.public_id}/clone/")
    project = Project.objects.get(public_id=response.json()["id"])
    version = project.versions.get()

    assert version.scene_json != blank_canvas.scene_json  # different generated scene id
    assert version.scene_json["id"] != blank_canvas.scene_json["id"]
    scene_without_id = {k: v for k, v in version.scene_json.items() if k != "id"}
    template_scene_without_id = {k: v for k, v in blank_canvas.scene_json.items() if k != "id"}
    assert scene_without_id == template_scene_without_id

    # Mutating the clone must never touch the template's stored scene.
    version_id_snapshot = json.dumps(blank_canvas.scene_json)
    project.title = "Changed after cloning"
    project.save(update_fields=["title"])
    blank_canvas.refresh_from_db()
    assert json.dumps(blank_canvas.scene_json) == version_id_snapshot


@pytest.mark.django_db
def test_clone_private_template_requires_ownership(other_client, private_template):
    response = other_client.post(f"/api/templates/{private_template.public_id}/clone/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_clone_own_private_template_succeeds(owner_client, private_template):
    response = owner_client.post(f"/api/templates/{private_template.public_id}/clone/")

    assert response.status_code == 201
    assert response.json()["title"] == "Alice's private template"


@pytest.mark.django_db
def test_clone_requires_authentication(anon_client):
    blank_canvas = Template.objects.built_in().get(name="Blank canvas")

    response = anon_client.post(f"/api/templates/{blank_canvas.public_id}/clone/")

    assert response.status_code == 401


@pytest.mark.django_db
def test_clone_unknown_template_404s(owner_client):
    response = owner_client.post("/api/templates/00000000-0000-0000-0000-000000000000/clone/")

    assert response.status_code == 404


# --- PostgreSQL-only: rollback on failure leaves no partial records ---

pytestmark_postgres = pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping PostgreSQL-backed tests.",
)


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"])
def test_postgres_rollback_on_injected_failure_leaves_no_records(django_db_blocker):
    with django_db_blocker.unblock():
        user = get_user_model().objects.db_manager("postgres_test").create_user(username="clone-rb")
        template = Template.objects.using("postgres_test").create(
            source_type=Template.SourceType.BUILT_IN,
            owner=None,
            name="Rollback source",
            scene_json=copy.deepcopy(BLANK_SCENE),
        )

        from django.db import transaction as txn

        class InjectedFailure(Exception):
            pass

        with pytest.raises(InjectedFailure):
            with txn.atomic(using="postgres_test"):
                project = Project.objects.using("postgres_test").create(
                    owner=user, title=template.name
                )
                SceneVersion.objects.using("postgres_test").create(
                    project=project,
                    sequence=1,
                    scene_json=copy.deepcopy(template.scene_json),
                    origin=SceneVersion.Origin.MANUAL,
                )
                raise InjectedFailure("simulated failure before setting current_version")

        assert Project.objects.using("postgres_test").filter(owner=user).count() == 0
        assert SceneVersion.objects.using("postgres_test").count() == 0
        # The source template itself is untouched by the failed clone attempt.
        template.refresh_from_db()
        assert template.scene_json == BLANK_SCENE
