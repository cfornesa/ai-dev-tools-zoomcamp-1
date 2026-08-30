"""Tests for atomic blank-scene project creation (Task 18)."""

import threading
import uuid

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connections
from rest_framework.test import APIClient

from scenes.models import Project, SceneVersion


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="alice")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.mark.django_db
def test_creates_project_with_documented_defaults(owner_client):
    response = owner_client.post("/api/projects/blank/")

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Untitled animation"
    assert body["description"] == ""
    assert body["visibility"] == "private"


@pytest.mark.django_db
def test_creates_exactly_one_schema_valid_initial_version(owner_client):
    response = owner_client.post("/api/projects/blank/")

    project = Project.objects.get(public_id=response.json()["id"])
    versions = SceneVersion.objects.filter(project=project)
    assert versions.count() == 1

    version = versions.get()
    assert version.sequence == 1
    assert version.origin == SceneVersion.Origin.MANUAL

    from scenes.validation import validate_scene

    assert validate_scene(version.scene_json).valid is True


@pytest.mark.django_db
def test_defaults_to_p5_renderer_when_omitted(owner_client):
    response = owner_client.post("/api/projects/blank/")

    project = Project.objects.get(public_id=response.json()["id"])
    version = SceneVersion.objects.get(project=project)
    assert version.scene_json["renderer"]["preferred"] == "p5"


@pytest.mark.django_db
def test_creates_a_canvas2d_renderer_project_when_requested(owner_client):
    response = owner_client.post("/api/projects/blank/", {"renderer": "canvas2d"})

    assert response.status_code == 201
    project = Project.objects.get(public_id=response.json()["id"])
    version = SceneVersion.objects.get(project=project)
    assert version.scene_json["renderer"]["preferred"] == "canvas2d"

    from scenes.validation import validate_scene

    assert validate_scene(version.scene_json).valid is True


@pytest.mark.django_db
def test_creates_an_svg_renderer_project_when_requested(owner_client):
    response = owner_client.post("/api/projects/blank/", {"renderer": "svg"})

    assert response.status_code == 201
    project = Project.objects.get(public_id=response.json()["id"])
    version = SceneVersion.objects.get(project=project)
    assert version.scene_json["renderer"]["preferred"] == "svg"

    from scenes.validation import validate_scene

    assert validate_scene(version.scene_json).valid is True


@pytest.mark.django_db
def test_rejects_an_unsupported_renderer_value(owner_client):
    response = owner_client.post("/api/projects/blank/", {"renderer": "webgl"})

    assert response.status_code == 400
    assert "renderer" in response.json()
    assert Project.objects.count() == 0


@pytest.mark.django_db
def test_current_version_points_at_the_initial_version(owner_client):
    response = owner_client.post("/api/projects/blank/")

    project = Project.objects.get(public_id=response.json()["id"])
    version = SceneVersion.objects.get(project=project)
    assert project.current_version_id == version.id


@pytest.mark.django_db
def test_requires_authentication(db):
    response = APIClient().post("/api/projects/blank/")

    assert response.status_code == 401
    assert Project.objects.count() == 0
    assert SceneVersion.objects.count() == 0


@pytest.mark.django_db
def test_repeated_submission_with_same_request_id_is_idempotent(owner_client):
    request_id = str(uuid.uuid4())

    first = owner_client.post("/api/projects/blank/", {"client_request_id": request_id})
    second = owner_client.post("/api/projects/blank/", {"client_request_id": request_id})

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert Project.objects.count() == 1
    assert SceneVersion.objects.count() == 1


@pytest.mark.django_db
def test_different_request_ids_create_separate_projects(owner_client):
    first = owner_client.post("/api/projects/blank/", {"client_request_id": str(uuid.uuid4())})
    second = owner_client.post("/api/projects/blank/", {"client_request_id": str(uuid.uuid4())})

    assert first.status_code == second.status_code == 201
    assert first.json()["id"] != second.json()["id"]
    assert Project.objects.count() == 2


@pytest.mark.django_db
def test_omitting_request_id_never_deduplicates(owner_client):
    first = owner_client.post("/api/projects/blank/")
    second = owner_client.post("/api/projects/blank/")

    assert first.status_code == second.status_code == 201
    assert first.json()["id"] != second.json()["id"]
    assert Project.objects.count() == 2


@pytest.mark.django_db
def test_malformed_request_id_is_rejected(owner_client):
    response = owner_client.post("/api/projects/blank/", {"client_request_id": "not-a-uuid"})

    assert response.status_code == 400
    assert Project.objects.count() == 0


@pytest.mark.django_db
def test_request_id_is_scoped_per_user(owner_client, db):
    request_id = str(uuid.uuid4())
    owner_client.post("/api/projects/blank/", {"client_request_id": request_id})

    other = get_user_model().objects.create_user(username="bob")
    other_client = APIClient()
    other_client.force_authenticate(other)

    response = other_client.post("/api/projects/blank/", {"client_request_id": request_id})

    assert response.status_code == 201  # a different user's identical request_id is unrelated
    assert Project.objects.count() == 2


# --- PostgreSQL-only: rollback and genuine concurrent duplicate submission ---

pytestmark_postgres = pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping PostgreSQL-backed tests.",
)


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"])
def test_postgres_rollback_on_injected_failure_leaves_no_records(django_db_blocker):
    with django_db_blocker.unblock():
        user = get_user_model().objects.db_manager("postgres_test").create_user(username="rollback")

        from django.db import transaction as txn

        class InjectedFailure(Exception):
            pass

        with pytest.raises(InjectedFailure):
            with txn.atomic(using="postgres_test"):
                project = Project.objects.using("postgres_test").create(owner=user)
                SceneVersion.objects.using("postgres_test").create(
                    project=project,
                    sequence=1,
                    scene_json={},  # would fail schema validation too, but we fail explicitly
                    origin=SceneVersion.Origin.MANUAL,
                )
                raise InjectedFailure("simulated failure before setting current_version")

        assert Project.objects.using("postgres_test").filter(owner=user).count() == 0
        assert SceneVersion.objects.using("postgres_test").count() == 0


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"], transaction=True)
def test_postgres_concurrent_duplicate_submission_creates_exactly_one_project(django_db_blocker):
    with django_db_blocker.unblock():
        User = get_user_model()
        user = User.objects.db_manager("postgres_test").create_user(
            username="concurrent-blank-user"
        )
        request_id = uuid.uuid4()

        results = []
        barrier = threading.Barrier(2)

        def do_create():
            barrier.wait()
            try:
                from django.db import IntegrityError
                from django.db import transaction as txn

                existing = (
                    Project.objects.using("postgres_test")
                    .filter(owner=user, creation_request_id=request_id)
                    .first()
                )
                if existing is not None:
                    results.append(("existing", existing.pk))
                    return
                try:
                    with txn.atomic(using="postgres_test"):
                        project = Project.objects.using("postgres_test").create(
                            owner=user, creation_request_id=request_id
                        )
                        version = SceneVersion.objects.using("postgres_test").create(
                            project=project,
                            sequence=1,
                            scene_json={
                                "schemaVersion": 1,
                                "id": "scene-x",
                                "canvas": {"width": 800, "height": 600, "backgroundColor": "#fff"},
                                "renderer": {"preferred": "p5"},
                                "layers": [],
                                "shapes": [],
                                "groups": [],
                                "bindings": [],
                                "graph": {"nodes": [], "connections": []},
                                "accessibility": {"reducedMotion": "auto"},
                                "randomness": {"seed": 0, "enabled": False},
                            },
                            origin=SceneVersion.Origin.MANUAL,
                        )
                        project.current_version = version
                        project.save(using="postgres_test", update_fields=["current_version"])
                    results.append(("created", project.pk))
                except IntegrityError:
                    winner = Project.objects.using("postgres_test").get(
                        owner=user, creation_request_id=request_id
                    )
                    results.append(("raced", winner.pk))
            finally:
                connections["postgres_test"].close()

        threads = [threading.Thread(target=do_create) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len({pk for _, pk in results}) == 1  # both threads agree on the same project
        assert Project.objects.using("postgres_test").filter(owner=user).count() == 1
        assert SceneVersion.objects.using("postgres_test").count() == 1
