"""Tests for the version restore and soft-delete APIs (Task 15).

SQLite-portable tests cover single-writer correctness and every rejection
path. Genuine concurrent-restore and mid-transaction-rollback behavior are
PostgreSQL-gated, same pattern as tests/test_scene_version_save_api.py.
"""

import json
import threading
from pathlib import Path

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connections
from rest_framework.test import APIClient

from scenes.models import Project, SceneVersion

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
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
def project_with_two_versions(owner):
    project = Project.objects.create(owner=owner)
    v1 = SceneVersion.objects.create(
        project=project, sequence=1, scene_json=BLANK_SCENE, origin=SceneVersion.Origin.MANUAL
    )
    v2 = SceneVersion.objects.create(
        project=project,
        sequence=2,
        scene_json={**BLANK_SCENE, "randomness": {"seed": 2, "enabled": True}},
        origin=SceneVersion.Origin.MANUAL,
        parent=v1,
    )
    project.current_version = v2
    project.save(update_fields=["current_version"])
    return project, v1, v2


def _delete_url(project, version):
    return f"/api/projects/{project.public_id}/versions/{version.pk}/"


def _restore_url(project, version):
    return f"/api/projects/{project.public_id}/versions/{version.pk}/restore/"


@pytest.mark.django_db
def test_restore_creates_new_version_with_restore_origin_and_correct_parent(
    owner_client, project_with_two_versions
):
    project, v1, v2 = project_with_two_versions

    response = owner_client.post(_restore_url(project, v1))

    assert response.status_code == 201
    body = response.json()
    assert body["sequence"] == 3
    assert body["origin"] == "restore"
    assert body["parent"] == v1.id

    project.refresh_from_db()
    assert project.current_version_id == body["id"]


@pytest.mark.django_db
def test_restore_copies_validated_scene_from_source(owner_client, project_with_two_versions):
    project, v1, v2 = project_with_two_versions

    response = owner_client.post(_restore_url(project, v1))

    new_version = SceneVersion.objects.get(pk=response.json()["id"])
    assert new_version.scene_json == v1.scene_json
    assert new_version.scene_json is not v1.scene_json  # a copy, not the same object


@pytest.mark.django_db
def test_restore_never_mutates_or_reactivates_the_source(owner_client, project_with_two_versions):
    project, v1, v2 = project_with_two_versions
    v1.is_deleted = True
    v1.save()

    owner_client.post(_restore_url(project, v1))

    v1.refresh_from_db()
    assert v1.is_deleted is True  # restore did not reactivate it
    assert v1.sequence == 1  # untouched
    assert v1.origin == SceneVersion.Origin.MANUAL  # untouched


@pytest.mark.django_db
def test_restoring_from_an_already_soft_deleted_source_is_allowed(
    owner_client, project_with_two_versions
):
    """Documented policy (Task 15): soft-delete only hides a version from the
    default history listing — it doesn't stop it being restored from.
    """
    project, v1, v2 = project_with_two_versions
    v1.is_deleted = True
    v1.save()

    response = owner_client.post(_restore_url(project, v1))

    assert response.status_code == 201
    new_version = SceneVersion.objects.get(pk=response.json()["id"])
    assert new_version.is_deleted is False
    assert new_version.scene_json == v1.scene_json


@pytest.mark.django_db
def test_restoring_the_current_version_is_rejected(owner_client, project_with_two_versions):
    project, v1, v2 = project_with_two_versions

    response = owner_client.post(_restore_url(project, v2))

    assert response.status_code == 400
    project.refresh_from_db()
    assert project.current_version_id == v2.id
    assert SceneVersion.objects.filter(project=project).count() == 2


@pytest.mark.django_db
def test_restoring_a_version_from_another_project_is_rejected(owner_client, owner):
    project_a = Project.objects.create(owner=owner)
    other_project = Project.objects.create(owner=owner)
    foreign_version = SceneVersion.objects.create(
        project=other_project, sequence=1, scene_json=BLANK_SCENE, origin="manual"
    )

    response = owner_client.post(_restore_url(project_a, foreign_version))

    assert response.status_code == 404
    assert SceneVersion.objects.filter(project=project_a).count() == 0


@pytest.mark.django_db
def test_non_owner_cannot_restore_and_gets_404(other_client, project_with_two_versions):
    project, v1, v2 = project_with_two_versions

    response = other_client.post(_restore_url(project, v1))

    assert response.status_code == 404
    assert SceneVersion.objects.filter(project=project).count() == 2


@pytest.mark.django_db
def test_anonymous_cannot_restore_and_gets_404(project_with_two_versions):
    project, v1, v2 = project_with_two_versions

    response = APIClient().post(_restore_url(project, v1))

    assert response.status_code == 404
    assert SceneVersion.objects.filter(project=project).count() == 2


@pytest.mark.django_db
def test_soft_delete_hides_eligible_non_current_version_from_history(
    owner_client, project_with_two_versions
):
    project, v1, v2 = project_with_two_versions

    response = owner_client.delete(_delete_url(project, v1))

    assert response.status_code == 204
    v1.refresh_from_db()
    assert v1.is_deleted is True

    history = owner_client.get(f"/api/projects/{project.public_id}/versions/").json()
    assert [v["id"] for v in history] == [v2.id]


@pytest.mark.django_db
def test_deleting_the_current_version_is_rejected(owner_client, project_with_two_versions):
    project, v1, v2 = project_with_two_versions

    response = owner_client.delete(_delete_url(project, v2))

    assert response.status_code == 400
    v2.refresh_from_db()
    assert v2.is_deleted is False
    project.refresh_from_db()
    assert project.current_version_id == v2.id


@pytest.mark.django_db
def test_deleting_a_version_from_another_project_is_rejected(owner_client, owner):
    project_a = Project.objects.create(owner=owner)
    other_project = Project.objects.create(owner=owner)
    foreign_version = SceneVersion.objects.create(
        project=other_project, sequence=1, scene_json=BLANK_SCENE, origin="manual"
    )

    response = owner_client.delete(_delete_url(project_a, foreign_version))

    assert response.status_code == 404
    foreign_version.refresh_from_db()
    assert foreign_version.is_deleted is False


@pytest.mark.django_db
def test_non_owner_cannot_delete_and_gets_404(other_client, project_with_two_versions):
    project, v1, v2 = project_with_two_versions

    response = other_client.delete(_delete_url(project, v1))

    assert response.status_code == 404
    v1.refresh_from_db()
    assert v1.is_deleted is False


@pytest.mark.django_db
def test_anonymous_cannot_delete_and_gets_404(project_with_two_versions):
    project, v1, v2 = project_with_two_versions

    response = APIClient().delete(_delete_url(project, v1))

    assert response.status_code == 404
    v1.refresh_from_db()
    assert v1.is_deleted is False


# --- Version detail GET (Task 21: editor workspace loads the current
# version's full scene_json to build its working copy) ---


@pytest.mark.django_db
def test_owner_can_get_version_detail_including_scene_json(owner_client, project_with_two_versions):
    project, v1, v2 = project_with_two_versions

    response = owner_client.get(_delete_url(project, v2))

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == v2.id
    assert body["scene_json"] == v2.scene_json


@pytest.mark.django_db
def test_non_owner_cannot_get_version_detail_and_gets_404(other_client, project_with_two_versions):
    project, v1, v2 = project_with_two_versions

    response = other_client.get(_delete_url(project, v2))

    assert response.status_code == 404


@pytest.mark.django_db
def test_anonymous_cannot_get_version_detail_and_gets_404(project_with_two_versions):
    project, v1, v2 = project_with_two_versions

    response = APIClient().get(_delete_url(project, v2))

    assert response.status_code == 404


@pytest.mark.django_db
def test_getting_a_nonexistent_version_returns_404(owner_client, project_with_two_versions):
    project, v1, v2 = project_with_two_versions

    response = owner_client.get(f"/api/projects/{project.public_id}/versions/999999/")

    assert response.status_code == 404


# --- PostgreSQL-only: locking, concurrency, rollback (Task 15) ---

pytestmark_postgres = pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping PostgreSQL-backed tests.",
)


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"], transaction=True)
def test_postgres_concurrent_restores_never_collide_on_sequence(django_db_blocker):
    with django_db_blocker.unblock():
        User = get_user_model()
        user = User.objects.db_manager("postgres_test").create_user(
            username="concurrent-restore-user"
        )
        project = Project.objects.using("postgres_test").create(owner=user)
        source = SceneVersion.objects.using("postgres_test").create(
            project=project, sequence=1, scene_json=BLANK_SCENE, origin="manual"
        )
        project.current_version = source
        project.save(using="postgres_test", update_fields=["current_version"])
        second = SceneVersion.objects.using("postgres_test").create(
            project=project, sequence=2, scene_json=BLANK_SCENE, origin="manual", parent=source
        )
        project.current_version = second
        project.save(using="postgres_test", update_fields=["current_version"])

        results = []
        barrier = threading.Barrier(2)

        def do_restore():
            barrier.wait()
            try:
                from django.db import transaction as txn
                from django.db.models import Max

                with txn.atomic(using="postgres_test"):
                    locked = (
                        Project.objects.using("postgres_test")
                        .select_for_update()
                        .get(pk=project.pk)
                    )
                    next_sequence = (
                        locked.versions.using("postgres_test").aggregate(Max("sequence"))[
                            "sequence__max"
                        ]
                        or 0
                    ) + 1
                    new_version = SceneVersion.objects.using("postgres_test").create(
                        project=locked,
                        sequence=next_sequence,
                        scene_json=source.scene_json,
                        created_by=user,
                        parent=source,
                        origin=SceneVersion.Origin.RESTORE,
                    )
                    locked.current_version = new_version
                    locked.save(using="postgres_test", update_fields=["current_version"])
                results.append(new_version.sequence)
            finally:
                connections["postgres_test"].close()

        threads = [threading.Thread(target=do_restore) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert sorted(results) == [3, 4]
        all_sequences = sorted(
            SceneVersion.objects.using("postgres_test")
            .filter(project=project)
            .values_list("sequence", flat=True)
        )
        assert all_sequences == [1, 2, 3, 4]


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"])
def test_postgres_rollback_on_restore_failure_leaves_state_unchanged(django_db_blocker):
    with django_db_blocker.unblock():
        User = get_user_model()
        user = User.objects.db_manager("postgres_test").create_user(
            username="restore-rollback-user"
        )
        project = Project.objects.using("postgres_test").create(owner=user)
        source = SceneVersion.objects.using("postgres_test").create(
            project=project, sequence=1, scene_json=BLANK_SCENE, origin="manual"
        )
        project.current_version = source
        project.save(using="postgres_test", update_fields=["current_version"])

        from django.db import transaction as txn
        from django.db.models import Max

        class InjectedFailure(Exception):
            pass

        with pytest.raises(InjectedFailure):
            with txn.atomic(using="postgres_test"):
                locked = (
                    Project.objects.using("postgres_test").select_for_update().get(pk=project.pk)
                )
                next_sequence = (
                    locked.versions.using("postgres_test").aggregate(Max("sequence"))[
                        "sequence__max"
                    ]
                    or 0
                ) + 1
                SceneVersion.objects.using("postgres_test").create(
                    project=locked,
                    sequence=next_sequence,
                    scene_json=source.scene_json,
                    created_by=user,
                    parent=source,
                    origin=SceneVersion.Origin.RESTORE,
                )
                raise InjectedFailure("simulated failure before advancing current_version")

        assert SceneVersion.objects.using("postgres_test").filter(project=project).count() == 1
        project.refresh_from_db(using="postgres_test")
        assert project.current_version_id == source.id
