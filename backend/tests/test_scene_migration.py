"""PostgreSQL-gated migration coverage for issue #510's Scene rollout
(migrations 0037_add_scene / 0038_backfill_scenes / 0039_tighten_scene_fields).

Follows this repo's established `postgres_test` migration-test convention
(`tests/test_mistral_credentials.py`, `tests/_postgres_routing.py`): these
tests apply/unapply the real migrations against a real PostgreSQL database
whose lifecycle they control, and skip themselves when
`POSTGRES_TEST_DATABASE_URL` is unset. SQLite can apply the same migrations
(exercised implicitly by every other test in this suite, which runs against
an already-fully-migrated SQLite `default` database), but only PostgreSQL
proves the actual forward/backward DDL and data-migration behavior in
isolation, one step at a time, the way this module does.
"""

import json
import uuid
from pathlib import Path

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connections

PG = "postgres_test"

pytestmark_postgres = pytest.mark.skipif(
    PG not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping PostgreSQL-backed migration tests.",
)

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures"
        / "valid"
        / "blank.json"
    ).read_text()
)


def _migrate_to_before() -> None:
    call_command(
        "migrate", "scenes", "0036_mistral_to_provider_credential", verbosity=0, database=PG
    )


def _migrate_forward() -> None:
    call_command("migrate", "scenes", verbosity=0, database=PG)


def _pg_user(username: str, django_db_blocker):
    with django_db_blocker.unblock():
        return get_user_model().objects.db_manager(PG).create_user(username=username)


@pytest.fixture
def pg_owner(django_db_blocker):
    return _pg_user("scene-migration-owner", django_db_blocker)


def _insert_pre_scene_project_with_versions(
    owner_id: int, sequences: list[int]
) -> tuple[int, list[int]]:
    """Insert a `Project` and its `SceneVersion`s directly via SQL, matching
    the pre-#510 (0036) schema exactly -- no `scene`/`active_scene` columns
    exist yet at that point, so the live ORM model classes (which already
    carry #510's fields) can't be used to create these rows; raw SQL is the
    only way to simulate "a project that predates this migration" from
    inside a test that runs after the models have already changed.
    """
    with connections[PG].cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO scenes_project
            (public_id, title, description, visibility, allow_public_remix, created_at, updated_at,
             owner_id, current_version_id, deleted_at, is_deleted, creation_request_id,
             export_attribution, tags, published_at)
            VALUES (%s, %s, %s, 'private', true, now(), now(), %s, NULL, NULL, false, NULL,
                    false, %s, NULL)
            RETURNING id
            """,
            [str(uuid.uuid4()), "Pre-existing project", "", owner_id, json.dumps([])],
        )
        project_id = cursor.fetchone()[0]

        version_ids = []
        for seq in sequences:
            cursor.execute(
                """
                INSERT INTO scenes_sceneversion
                (sequence, scene_json, origin, change_label, is_deleted, deleted_at, created_at,
                 created_by_id, fork_source_version_id, parent_id, project_id, ai_request_id)
                VALUES (%s, %s, 'manual', %s, false, NULL, now(), %s, NULL, NULL, %s, NULL)
                RETURNING id
                """,
                [seq, json.dumps(BLANK_SCENE), f"v{seq}", owner_id, project_id],
            )
            version_ids.append(cursor.fetchone()[0])

        cursor.execute(
            "UPDATE scenes_project SET current_version_id = %s WHERE id = %s",
            [version_ids[-1], project_id],
        )
    return project_id, version_ids


@pytestmark_postgres
@pytest.mark.django_db(databases=["default", PG], transaction=True)
def test_backfill_preserves_versions_and_current_version(pg_owner):
    _migrate_to_before()
    project_id, version_ids = _insert_pre_scene_project_with_versions(pg_owner.id, [1, 2, 3])

    try:
        _migrate_forward()

        from scenes.models import Project, Scene, SceneVersion

        project = Project.all_objects.using(PG).get(id=project_id)
        assert project.active_scene_id is not None
        scene = Scene.objects.using(PG).get(pk=project.active_scene_id)
        assert scene.name == "Scene 1"
        assert scene.position == 0

        versions = list(
            SceneVersion.objects.using(PG).filter(project_id=project_id).order_by("sequence")
        )
        assert [v.sequence for v in versions] == [1, 2, 3]
        assert all(v.scene_id == scene.id for v in versions)

        # No data loss: current_version is preserved, and mirrored via the
        # new active_scene relationship, exactly as issue #510 requires.
        assert project.current_version_id == version_ids[-1]
        assert scene.current_version_id == version_ids[-1]
    finally:
        _migrate_to_before()


@pytestmark_postgres
@pytest.mark.django_db(databases=["default", PG], transaction=True)
def test_backfill_gives_each_project_its_own_scene(pg_owner, django_db_blocker):
    _migrate_to_before()
    with django_db_blocker.unblock():
        from django.contrib.auth import get_user_model

        other_owner = (
            get_user_model().objects.db_manager(PG).create_user(username="scene-migration-other")
        )
    project_a, _ = _insert_pre_scene_project_with_versions(pg_owner.id, [1])
    project_b, _ = _insert_pre_scene_project_with_versions(other_owner.id, [1, 2])

    try:
        _migrate_forward()

        from scenes.models import Project

        pa = Project.all_objects.using(PG).get(id=project_a)
        pb = Project.all_objects.using(PG).get(id=project_b)
        assert pa.active_scene_id != pb.active_scene_id
        assert pa.scenes.using(PG).count() == 1
        assert pb.scenes.using(PG).count() == 1
    finally:
        _migrate_to_before()


@pytestmark_postgres
@pytest.mark.django_db(databases=["default", PG], transaction=True)
def test_sequence_uniqueness_is_scoped_per_scene_after_migration(pg_owner):
    """A second scene added to an already-migrated project can reuse
    sequence 1 -- proving `unique_sequence_per_scene` (not
    `unique_sequence_per_project`) is the constraint actually in effect."""
    _migrate_to_before()
    project_id, _ = _insert_pre_scene_project_with_versions(pg_owner.id, [1])
    _migrate_forward()

    # Deliberately no `finally: _migrate_to_before()` here, unlike the other
    # tests in this module: this test's own point is to put the database in
    # exactly the state `0039_tighten_scene_fields.py`'s docstring documents
    # as no-longer-safely-reversible (a project with two scenes each having
    # their own sequence 1) -- reversing from here is *expected* to fail the
    # restored `unique_sequence_per_project` constraint, so attempting it
    # would just be exercising the documented irreversibility window this
    # test is set up to prove exists, not real cleanup. Nothing here needs
    # cleanup either way: this is the last test in the module, and the
    # PostgreSQL-gated `postgres_test` database itself is disposable/torn
    # down by pytest-django at session end regardless.
    from scenes.models import Project, Scene, SceneVersion

    project = Project.all_objects.using(PG).get(id=project_id)
    second_scene = Scene.objects.using(PG).create(project_id=project_id, name="Scene 2", position=1)
    # Sequence 1 already exists for the project's original scene -- this
    # only succeeds if uniqueness is scoped to (scene, sequence).
    SceneVersion.objects.using(PG).create(
        project=project,
        scene=second_scene,
        sequence=1,
        scene_json=BLANK_SCENE,
        origin="manual",
    )
    assert SceneVersion.objects.using(PG).filter(scene=second_scene, sequence=1).count() == 1
