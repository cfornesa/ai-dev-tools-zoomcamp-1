"""Tests for `manage.py e2e_fixtures` (scenes/management/commands/e2e_fixtures.py).

`cleanup` previously raised `ProtectedError`/a PostgreSQL immutability-trigger
error whenever the fixture users owned anything beyond a single bare
project -- a `current_version`, a version history with `parent` links, an
AI-accepted version's `created_by`, or a fork someone else made from a
fixture project. These tests build exactly that shape (on SQLite, so the
offline suite still runs everywhere) and assert `cleanup` removes it all
without error. The PostgreSQL-specific half of the fix (disabling
`scenes_sceneversion_prevent_snapshot_mutation_trigger` around the
self-referential SET_NULL nulling -- `connection.vendor == "postgresql"`
gated, so SQLite never exercises it) was verified manually against a real
PostgreSQL dev database; see `.agents/memory/playwright-runtime-prerequisites.md`.
"""

import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from scenes.management.commands.e2e_fixtures import E2E_USERS
from scenes.models import ForkProvenance, Project, SceneVersion

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
    ).read_text()
)


@pytest.mark.django_db
def test_cleanup_removes_fixture_users_with_version_history_and_current_version():
    call_command("e2e_fixtures", "create", "--json")
    User = get_user_model()
    owner = User.objects.get(username=E2E_USERS["owner"][0])
    project = Project.objects.create(owner=owner)
    v1 = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        origin=SceneVersion.Origin.MANUAL,
        created_by=owner,
    )
    v2 = SceneVersion.objects.create(
        project=project,
        sequence=2,
        scene_json=BLANK_SCENE,
        origin=SceneVersion.Origin.MANUAL,
        created_by=owner,
        parent=v1,
    )
    project.current_version = v2
    project.save(update_fields=["current_version"])

    call_command("e2e_fixtures", "cleanup", "--json")

    assert not User.objects.filter(username__in=[u for u, _e in E2E_USERS.values()]).exists()
    assert not Project.objects.filter(pk=project.pk).exists()
    assert not SceneVersion.objects.filter(pk__in=[v1.pk, v2.pk]).exists()


@pytest.mark.django_db
def test_cleanup_removes_fork_provenance_sourced_from_a_fixture_project():
    call_command("e2e_fixtures", "create", "--json")
    User = get_user_model()
    owner = User.objects.get(username=E2E_USERS["owner"][0])
    source_project = Project.objects.create(owner=owner)
    source_version = SceneVersion.objects.create(
        project=source_project,
        sequence=1,
        scene_json=BLANK_SCENE,
        origin=SceneVersion.Origin.MANUAL,
    )

    outsider = User.objects.create_user(username="not_a_fixture_user")
    forked_project = Project.objects.create(owner=outsider)
    SceneVersion.objects.create(
        project=forked_project,
        sequence=1,
        scene_json=BLANK_SCENE,
        origin=SceneVersion.Origin.FORK,
    )
    ForkProvenance.objects.create(
        project=forked_project,
        source_project=source_project,
        source_version=source_version,
    )

    call_command("e2e_fixtures", "cleanup", "--json")

    assert not Project.objects.filter(pk=source_project.pk).exists()
    assert not ForkProvenance.objects.filter(project=forked_project).exists()
    # The fork itself belongs to a non-fixture user and must survive.
    assert Project.objects.filter(pk=forked_project.pk).exists()


@pytest.mark.django_db
def test_cleanup_is_idempotent_when_nothing_to_clean():
    result = call_command("e2e_fixtures", "cleanup", "--json")
    assert result is None  # call_command prints to stdout; no exception is the assertion
