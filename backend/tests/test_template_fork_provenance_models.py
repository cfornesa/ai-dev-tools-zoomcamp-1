"""Model tests for scenes.Template / scenes.ForkProvenance (Task 10)."""

import json
from pathlib import Path

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connections, transaction
from django.db.models import ProtectedError
from django.db.utils import ProgrammingError

from scenes.models import (
    ForkProvenance,
    ForkProvenanceInvalidSourceError,
    Project,
    SceneVersion,
    Template,
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


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username="alice")


@pytest.fixture
def project(user):
    return Project.objects.create(owner=user)


@pytest.fixture
def version(project):
    return SceneVersion.objects.create(
        project=project, sequence=1, scene_json=BLANK_SCENE, origin=SceneVersion.Origin.MANUAL
    )


@pytest.mark.django_db
def test_built_in_template_without_owner_is_valid():
    template = Template.objects.create(
        source_type=Template.SourceType.BUILT_IN,
        owner=None,
        name="Blank canvas",
        scene_json=BLANK_SCENE,
    )

    assert template.owner is None
    assert Template.objects.built_in().get(pk=template.pk) == template


@pytest.mark.django_db
def test_private_template_requires_owner(user):
    template = Template.objects.create(
        source_type=Template.SourceType.PRIVATE,
        owner=user,
        name="My template",
        scene_json=BLANK_SCENE,
    )

    assert Template.objects.private_for(user).get() == template


@pytest.mark.django_db
def test_owned_built_in_template_rejected(user):
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Template.objects.create(
                source_type=Template.SourceType.BUILT_IN,
                owner=user,
                name="Should not be allowed",
                scene_json=BLANK_SCENE,
            )


@pytest.mark.django_db
def test_ownerless_private_template_rejected():
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Template.objects.create(
                source_type=Template.SourceType.PRIVATE,
                owner=None,
                name="Should not be allowed",
                scene_json=BLANK_SCENE,
            )


@pytest.mark.django_db
def test_private_templates_are_queryable_only_for_their_owner(user):
    other = get_user_model().objects.create_user(username="bob")
    mine = Template.objects.create(
        source_type=Template.SourceType.PRIVATE, owner=user, name="Mine", scene_json=BLANK_SCENE
    )
    Template.objects.create(
        source_type=Template.SourceType.PRIVATE,
        owner=other,
        name="Theirs",
        scene_json=BLANK_SCENE,
    )

    assert list(Template.objects.private_for(user)) == [mine]


@pytest.mark.django_db
def test_template_invalid_scene_json_rejected():
    with pytest.raises(ValidationError):
        Template.objects.create(
            source_type=Template.SourceType.BUILT_IN,
            owner=None,
            name="Broken",
            scene_json={**BLANK_SCENE, "schemaVersion": 999},
        )


@pytest.mark.django_db
def test_fork_provenance_valid_source(user, project, version):
    forked_project = Project.objects.create(owner=user)

    provenance = ForkProvenance.objects.create(
        project=forked_project, source_project=project, source_version=version
    )

    assert provenance.source_project_id == project.id
    assert provenance.source_version_id == version.id


@pytest.mark.django_db
def test_fork_provenance_rejects_mismatched_source(user, project, version):
    other_project = Project.objects.create(owner=user)
    forked_project = Project.objects.create(owner=user)

    with pytest.raises(ForkProvenanceInvalidSourceError):
        ForkProvenance.objects.create(
            project=forked_project, source_project=other_project, source_version=version
        )


@pytest.mark.django_db
def test_fork_provenance_project_cannot_equal_source_project(user, project, version):
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ForkProvenance.objects.create(
                project=project, source_project=project, source_version=version
            )


@pytest.mark.django_db
def test_changing_source_later_does_not_rewrite_existing_provenance(user, project, version):
    forked_project = Project.objects.create(owner=user)
    provenance = ForkProvenance.objects.create(
        project=forked_project, source_project=project, source_version=version
    )

    project.title = "Renamed after the fork"
    project.save()
    SceneVersion.objects.create(
        project=project, sequence=2, scene_json=BLANK_SCENE, origin=SceneVersion.Origin.MANUAL
    )

    provenance.refresh_from_db()
    assert provenance.source_project_id == project.id
    assert provenance.source_version_id == version.id  # still v1, not the new v2


@pytest.mark.django_db
def test_source_project_cannot_be_deleted_while_forked_from(user, project, version):
    forked_project = Project.objects.create(owner=user)
    ForkProvenance.objects.create(
        project=forked_project, source_project=project, source_version=version
    )

    with pytest.raises(ProtectedError):
        project.delete()


# --- PostgreSQL-only: the trigger-enforced cross-table source check ---

pytestmark_postgres = pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping PostgreSQL-backed tests.",
)


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"])
def test_postgres_trigger_blocks_raw_sql_mismatched_fork_source(django_db_blocker):
    with django_db_blocker.unblock():
        conn = connections["postgres_test"]
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO auth_user (username, password, is_superuser, is_staff, is_active, "
                "date_joined, first_name, last_name, email) "
                "VALUES ('fork-trigger-user', '', false, false, true, now(), '', '', '') "
                "RETURNING id"
            )
            (user_id,) = cursor.fetchone()

            def make_project():
                cursor.execute(
                    "INSERT INTO scenes_project (public_id, owner_id, title, description, "
                    "visibility, allow_public_remix, created_at, updated_at, is_deleted, "
                    "export_attribution, tags) "
                    "VALUES (gen_random_uuid(), %s, 'Untitled animation', '', 'private', false, "
                    "now(), now(), false, false, '[]') RETURNING id",
                    [user_id],
                )
                return cursor.fetchone()[0]

            project_a = make_project()
            project_b = make_project()
            forked = make_project()

            cursor.execute(
                "INSERT INTO scenes_sceneversion (project_id, sequence, scene_json, origin, "
                "change_label, is_deleted, created_at) "
                "VALUES (%s, 1, %s, 'manual', '', false, now()) RETURNING id",
                [project_a, json.dumps(BLANK_SCENE)],
            )
            (version_a,) = cursor.fetchone()

            with pytest.raises(ProgrammingError):
                cursor.execute(
                    "INSERT INTO scenes_forkprovenance (project_id, source_project_id, "
                    "source_version_id, created_at) VALUES (%s, %s, %s, now())",
                    [forked, project_b, version_a],
                )
