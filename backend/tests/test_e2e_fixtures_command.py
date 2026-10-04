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
from django.core.management import CommandError, call_command
from django.db import connection

from scenes.management.commands.e2e_fixtures import (
    E2E_USERS,
    PUBLIC_MEDIA_FIXTURE_SLUG,
    _authorize_fixture_mutation,
    _database_fingerprint,
)
from scenes.models import ForkProvenance, PieceIntakeAsset, Project, PublicProfile, SceneVersion

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures"
        / "valid"
        / "blank.json"
    ).read_text()
)


@pytest.fixture(autouse=True)
def select_disposable_test_database(monkeypatch):
    for key in (
        "E2E_ENV_FILE",
        "E2E_ALLOWED_DB_NAME",
        "STAGING_SMOKE",
        "E2E_DOCKER_COMPOSE",
    ):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("E2E_FIXTURE_ENVIRONMENT", "disposable-test")
    monkeypatch.setenv("E2E_EXPECTED_DATABASE_FINGERPRINT", _database_fingerprint())


def fixture_database_snapshot():
    """Capture every SQLite row so rejected actions cannot mutate uncounted fixtures."""
    with connection.cursor() as cursor:
        tables = connection.introspection.table_names(cursor)
        snapshot = {}
        for table in tables:
            cursor.execute(f"SELECT * FROM {connection.ops.quote_name(table)}")
            # Stable text snapshots make updates, deletes, and inserts visible without
            # coupling this safety check to the command's growing model inventory.
            snapshot[table] = tuple(sorted(map(repr, cursor.fetchall())))
    return snapshot


@pytest.mark.django_db
@pytest.mark.parametrize(
    "action",
    ["create", "cleanup", "reset-sessions", "public-media-create", "public-media-cleanup"],
)
@pytest.mark.parametrize(
    "invalid_selection",
    ["missing", "unknown", "staging", "env-file", "database-name", "fingerprint"],
)
def test_rejected_fixture_actions_leave_records_unchanged(
    action, invalid_selection, monkeypatch, tmp_path
):
    call_command("e2e_fixtures", "create", "--json")
    User = get_user_model()  # noqa: N806
    owner = User.objects.get(username=E2E_USERS["owner"][0])
    project = Project.objects.create(owner=owner, title="Protected fixture baseline")
    SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        origin=SceneVersion.Origin.MANUAL,
        created_by=owner,
    )
    if action == "public-media-cleanup":
        call_command("e2e_fixtures", "public-media-create", "--json")

    if invalid_selection == "missing":
        monkeypatch.delenv("E2E_FIXTURE_ENVIRONMENT")
    elif invalid_selection == "unknown":
        monkeypatch.setenv("E2E_FIXTURE_ENVIRONMENT", "production")
    elif invalid_selection == "staging":
        monkeypatch.setenv("E2E_FIXTURE_ENVIRONMENT", "disposable-staging")
        monkeypatch.delenv("STAGING_SMOKE", raising=False)
    elif invalid_selection == "env-file":
        monkeypatch.setenv("E2E_FIXTURE_ENVIRONMENT", "disposable-local")
        monkeypatch.delenv("E2E_ENV_FILE", raising=False)
    elif invalid_selection == "database-name":
        env_file = tmp_path / "disposable.env"
        env_file.write_text("DATABASE_URL=not-used-by-test\n")
        monkeypatch.setenv("E2E_FIXTURE_ENVIRONMENT", "disposable-local")
        monkeypatch.setenv("E2E_ENV_FILE", str(env_file))
        monkeypatch.setitem(connection.settings_dict, "NAME", "durable_database")
        monkeypatch.delenv("E2E_ALLOWED_DB_NAME", raising=False)
    else:
        monkeypatch.setenv("E2E_EXPECTED_DATABASE_FINGERPRINT", "not-the-selected-database")

    before = fixture_database_snapshot()
    names = [name for name, _email in E2E_USERS.values()]
    User = get_user_model()  # noqa: N806
    assert User.objects.filter(username__in=names).exists()
    assert Project.all_objects.filter(owner__username__in=names).exists()
    assert SceneVersion.objects.filter(project__owner__username__in=names).exists()
    with pytest.raises(CommandError, match="refused|requires|allowed|staging"):
        call_command("e2e_fixtures", action, "--json")
    assert fixture_database_snapshot() == before


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("environment", "database_name"),
    [
        ("disposable-local", "codex_local_test"),
        ("disposable-ci", "creatrweb_e2e"),
        ("disposable-compose", "gesture_studio"),
        ("disposable-staging", "creatrweb_staging"),
        ("disposable-test", ":memory:"),
    ],
)
def test_each_disposable_environment_is_an_explicitly_authorized_target(
    environment, database_name, monkeypatch, tmp_path
):
    monkeypatch.setenv("E2E_FIXTURE_ENVIRONMENT", environment)
    monkeypatch.setitem(connection.settings_dict, "NAME", database_name)
    if environment == "disposable-test":
        monkeypatch.setenv("PYTEST_CURRENT_TEST", "fixture-policy-test")
    else:
        env_file = tmp_path / "disposable.env"
        env_file.write_text("DATABASE_URL=fixture-only\n")
        monkeypatch.setenv("E2E_ENV_FILE", str(env_file))
    if environment == "disposable-compose":
        monkeypatch.setenv("E2E_DOCKER_COMPOSE", "true")
    if environment == "disposable-staging":
        monkeypatch.setenv("STAGING_SMOKE", "1")
    monkeypatch.setenv("E2E_EXPECTED_DATABASE_FINGERPRINT", _database_fingerprint())
    assert _authorize_fixture_mutation("create") == _database_fingerprint()


@pytest.mark.django_db
def test_empty_database_name_does_not_match_an_unset_allowed_name(monkeypatch, tmp_path):
    env_file = tmp_path / "disposable.env"
    env_file.write_text("DATABASE_URL=fixture-only\n")
    monkeypatch.setenv("E2E_FIXTURE_ENVIRONMENT", "disposable-local")
    monkeypatch.setenv("E2E_ENV_FILE", str(env_file))
    monkeypatch.delenv("E2E_ALLOWED_DB_NAME", raising=False)
    monkeypatch.setitem(connection.settings_dict, "NAME", "")
    monkeypatch.setenv("E2E_EXPECTED_DATABASE_FINGERPRINT", _database_fingerprint())
    with pytest.raises(CommandError, match="database name must identify a disposable target"):
        _authorize_fixture_mutation("create")


@pytest.mark.django_db
def test_cleanup_removes_fixture_users_with_version_history_and_current_version():
    call_command("e2e_fixtures", "create", "--json")
    User = get_user_model()  # noqa: N806
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
    User = get_user_model()  # noqa: N806
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


@pytest.mark.django_db
def test_create_provisions_public_profiles_for_canonical_fixture_routes():
    call_command("e2e_fixtures", "create", "--json")

    for key, (username, _email) in E2E_USERS.items():
        profile = PublicProfile.objects.get(user__username=username)
        assert profile.handle == f"e2e_{key}"
        assert profile.is_public is True

    # Re-running the command keeps the canonical handles and visibility
    # stable, which is required for repeated disposable browser runs.
    call_command("e2e_fixtures", "create", "--json")
    assert PublicProfile.objects.filter(handle="e2e_owner", is_public=True).count() == 1


@pytest.mark.django_db
def test_public_media_fixture_create_and_cleanup_is_repeatable():
    call_command("e2e_fixtures", "public-media-create", "--json")

    project = Project.objects.get(public_slug=PUBLIC_MEDIA_FIXTURE_SLUG)
    asset = PieceIntakeAsset.objects.get(piece_public_id=project.public_id)
    assert asset.mime_type == "image/png"
    assert asset.data

    call_command("e2e_fixtures", "public-media-create", "--json")
    assert Project.objects.filter(public_slug=PUBLIC_MEDIA_FIXTURE_SLUG).count() == 1
    current_project = Project.objects.get(public_slug=PUBLIC_MEDIA_FIXTURE_SLUG)
    assert PieceIntakeAsset.objects.filter(piece_public_id=current_project.public_id).count() == 1
    assert not PieceIntakeAsset.objects.filter(piece_public_id=project.public_id).exists()

    call_command("e2e_fixtures", "public-media-cleanup", "--json")
    assert not Project.all_objects.filter(public_slug=PUBLIC_MEDIA_FIXTURE_SLUG).exists()
    assert not PieceIntakeAsset.objects.filter(piece_public_id=project.public_id).exists()
