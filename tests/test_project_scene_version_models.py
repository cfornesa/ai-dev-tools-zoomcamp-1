"""Model tests for scenes.Project / scenes.SceneVersion (Task 8).

Split between what SQLite can prove (Django-level constraints/guards,
identical on both backends) and what only a real PostgreSQL server can
prove (the trigger-enforced cross-row invariants in
scenes/migrations/0002_postgres_invariants.py) — the PostgreSQL-only
tests opt in via POSTGRES_TEST_DATABASE_URL and skip themselves when it
isn't set, same as tests/test_health.py.
"""

import json
from pathlib import Path

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connections, transaction
from django.db.utils import OperationalError

from scenes.models import Project, SceneVersion, SceneVersionImmutableError

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
    ).read_text()
)


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username="alice")


@pytest.mark.django_db
def test_create_project_with_defaults(user):
    project = Project.objects.create(owner=user)

    assert project.title == "Untitled animation"
    assert project.description == ""
    assert project.visibility == Project.Visibility.PRIVATE
    # Task 51: `_docs/plan.md`'s "Remix setting" — "Public projects have
    # allow_public_remix = true by default" — this project is still
    # private, but the field's default value is what a later publish
    # inherits unless the owner has already changed it.
    assert project.allow_public_remix is True
    assert project.current_version is None
    assert project.public_id is not None


@pytest.mark.django_db
def test_create_scene_version_and_set_as_current(user):
    project = Project.objects.create(owner=user)
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=user,
        origin=SceneVersion.Origin.MANUAL,
    )

    project.current_version = version
    project.save()
    project.refresh_from_db()

    assert project.current_version_id == version.id


@pytest.mark.django_db
def test_duplicate_sequence_within_project_rejected(user):
    project = Project.objects.create(owner=user)
    SceneVersion.objects.create(
        project=project, sequence=1, scene_json=BLANK_SCENE, origin=SceneVersion.Origin.MANUAL
    )

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            SceneVersion.objects.create(
                project=project,
                sequence=1,
                scene_json=BLANK_SCENE,
                origin=SceneVersion.Origin.MANUAL,
            )


@pytest.mark.django_db
def test_same_sequence_allowed_across_different_projects(user):
    project_a = Project.objects.create(owner=user)
    project_b = Project.objects.create(owner=user)

    SceneVersion.objects.create(
        project=project_a, sequence=1, scene_json=BLANK_SCENE, origin=SceneVersion.Origin.MANUAL
    )
    SceneVersion.objects.create(
        project=project_b, sequence=1, scene_json=BLANK_SCENE, origin=SceneVersion.Origin.MANUAL
    )
    # No IntegrityError: the unique constraint is scoped per-project.


@pytest.mark.django_db
def test_sequence_must_be_at_least_one(user):
    project = Project.objects.create(owner=user)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            SceneVersion.objects.create(
                project=project,
                sequence=0,
                scene_json=BLANK_SCENE,
                origin=SceneVersion.Origin.MANUAL,
            )


@pytest.mark.django_db
def test_existing_snapshot_cannot_be_modified_via_model_save(user):
    project = Project.objects.create(owner=user)
    version = SceneVersion.objects.create(
        project=project, sequence=1, scene_json=BLANK_SCENE, origin=SceneVersion.Origin.MANUAL
    )

    version.scene_json = {**BLANK_SCENE, "id": "tampered"}
    with pytest.raises(SceneVersionImmutableError):
        version.save()


@pytest.mark.django_db
def test_existing_snapshot_change_label_cannot_be_modified(user):
    project = Project.objects.create(owner=user)
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        origin=SceneVersion.Origin.MANUAL,
        change_label="first",
    )

    version.change_label = "renamed after the fact"
    with pytest.raises(SceneVersionImmutableError):
        version.save()


@pytest.mark.django_db
def test_soft_delete_state_can_still_be_updated(user):
    project = Project.objects.create(owner=user)
    version = SceneVersion.objects.create(
        project=project, sequence=1, scene_json=BLANK_SCENE, origin=SceneVersion.Origin.MANUAL
    )

    version.is_deleted = True
    version.save()  # must not raise
    version.refresh_from_db()

    assert version.is_deleted is True


@pytest.mark.django_db
def test_parent_and_fork_source_are_optional(user):
    project = Project.objects.create(owner=user)
    v1 = SceneVersion.objects.create(
        project=project, sequence=1, scene_json=BLANK_SCENE, origin=SceneVersion.Origin.MANUAL
    )
    v2 = SceneVersion.objects.create(
        project=project,
        sequence=2,
        scene_json=BLANK_SCENE,
        origin=SceneVersion.Origin.RESTORE,
        parent=v1,
    )

    assert v2.parent_id == v1.id
    assert v2.fork_source_version is None


# --- PostgreSQL-only: the trigger-enforced invariants (Task 8) ---

pytestmark_postgres = pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping PostgreSQL-backed tests.",
)


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"])
def test_postgres_trigger_blocks_raw_sql_snapshot_mutation(django_db_blocker):
    """Even a raw UPDATE bypassing the Django ORM guard is blocked by the DB trigger."""
    with django_db_blocker.unblock():
        conn = connections["postgres_test"]
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO auth_user (username, password, is_superuser, is_staff, is_active, "
                "date_joined, first_name, last_name, email) "
                "VALUES ('trigger-test-user', '', false, false, true, now(), '', '', '') "
                "RETURNING id"
            )
            (user_id,) = cursor.fetchone()
            cursor.execute(
                "INSERT INTO scenes_project (public_id, owner_id, title, description, "
                "visibility, allow_public_remix, created_at, updated_at) "
                "VALUES (gen_random_uuid(), %s, 'Untitled animation', '', 'private', false, "
                "now(), now()) RETURNING id",
                [user_id],
            )
            (project_id,) = cursor.fetchone()
            cursor.execute(
                "INSERT INTO scenes_sceneversion (project_id, sequence, scene_json, origin, "
                "change_label, is_deleted, created_at) "
                "VALUES (%s, 1, %s, 'manual', '', false, now()) RETURNING id",
                [project_id, json.dumps(BLANK_SCENE)],
            )
            (version_id,) = cursor.fetchone()

            with pytest.raises(OperationalError):
                cursor.execute(
                    "UPDATE scenes_sceneversion SET change_label = 'tampered' WHERE id = %s",
                    [version_id],
                )


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"])
def test_postgres_trigger_blocks_current_version_from_other_project(django_db_blocker):
    with django_db_blocker.unblock():
        User = get_user_model()
        user = User.objects.using("postgres_test").create_user(username="postgres-trigger-user")
        project_a = Project.objects.using("postgres_test").create(owner=user)
        project_b = Project.objects.using("postgres_test").create(owner=user)
        version_b = SceneVersion.objects.using("postgres_test").create(
            project=project_b,
            sequence=1,
            scene_json=BLANK_SCENE,
            origin=SceneVersion.Origin.MANUAL,
        )

        project_a.current_version = version_b
        with pytest.raises(OperationalError):
            project_a.save(using="postgres_test")


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"])
def test_postgres_trigger_blocks_soft_deleted_current_version(django_db_blocker):
    with django_db_blocker.unblock():
        User = get_user_model()
        user = User.objects.using("postgres_test").create_user(username="postgres-trigger-user-2")
        project = Project.objects.using("postgres_test").create(owner=user)
        version = SceneVersion.objects.using("postgres_test").create(
            project=project,
            sequence=1,
            scene_json=BLANK_SCENE,
            origin=SceneVersion.Origin.MANUAL,
            is_deleted=True,
        )

        project.current_version = version
        with pytest.raises(OperationalError):
            project.save(using="postgres_test")


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"])
def test_postgres_trigger_protects_current_version_from_soft_delete(django_db_blocker):
    with django_db_blocker.unblock():
        User = get_user_model()
        user = User.objects.using("postgres_test").create_user(username="postgres-trigger-user-3")
        project = Project.objects.using("postgres_test").create(owner=user)
        version = SceneVersion.objects.using("postgres_test").create(
            project=project,
            sequence=1,
            scene_json=BLANK_SCENE,
            origin=SceneVersion.Origin.MANUAL,
        )
        project.current_version = version
        project.save(using="postgres_test")

        version.is_deleted = True
        with pytest.raises(OperationalError):
            version.save(using="postgres_test")
