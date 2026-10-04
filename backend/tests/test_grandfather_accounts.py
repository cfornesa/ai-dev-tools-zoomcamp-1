"""Guarded grandfathering command coverage (#946). Never run --apply against
production; these tests exercise only the disposable test database."""

import json
from io import StringIO
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command

from scenes.entitlements import set_user_plan
from scenes.models import (
    ApplicationAdmin,
    ArtPiece,
    ArtPieceVersion,
    CloudSyncPreference,
    Plan,
    Project,
    Project3D,
    SceneVersion,
    SceneVersion3D,
    SiteSettings,
)

pytestmark = pytest.mark.django_db

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures"
        / "valid"
        / "blank.json"
    ).read_text()
)
MINIMAL_SCENE_3D = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures3d"
        / "valid"
        / "minimal.json"
    ).read_text()
)


def _user(username):
    return get_user_model().objects.create_user(username=username, password="test-password")


def _enable_site_sync():
    SiteSettings.objects.update_or_create(pk=1, defaults={"cloud_sync_enabled": True})


def _valid_free_project(owner):
    project = Project.objects.create(
        owner=owner, title="Grandfather-eligible", description="A meaningful description."
    )
    version = SceneVersion.objects.create(
        project=project, sequence=1, scene_json=BLANK_SCENE, created_by=owner
    )
    project.current_version = version
    project.save(update_fields=["current_version"])
    return project


def _invalid_free_project(owner):
    # No description, no version -- both required, per validate_meaningful_metadata.
    return Project.objects.create(owner=owner, title="")


def _run(*args):
    out = StringIO()
    call_command("grandfather_accounts", *args, stdout=out)
    return json.loads(out.getvalue())


def test_dry_run_reports_without_writing_anything():
    owner = _user("free-owner-dry-run")
    project = _valid_free_project(owner)
    before_updated_at = project.updated_at

    report = _run()

    assert report["dry_run"] is True
    assert report["no_write"] is True
    account = next(a for a in report["free_accounts"] if a["owner"] == "free-owner-dry-run")
    assert {"kind": "project", "id": str(project.public_id)} in account["would_publish"]

    project.refresh_from_db()
    assert project.visibility == Project.Visibility.PRIVATE
    assert project.updated_at == before_updated_at


def test_dry_run_lists_invalid_pieces_as_skipped_with_reason():
    owner = _user("free-owner-invalid")
    project = _invalid_free_project(owner)

    report = _run()

    account = next(a for a in report["free_accounts"] if a["owner"] == "free-owner-invalid")
    assert len(account["would_publish"]) == 0
    skipped = account["skipped"][0]
    assert skipped["id"] == str(project.public_id)
    assert "title" in skipped["reason"] or "description" in skipped["reason"]


def test_apply_refuses_without_site_sync_enabled():
    with pytest.raises(CommandError, match="cloud_sync_enabled"):
        call_command("grandfather_accounts", "--apply", "--yes")


def test_apply_refuses_without_yes_confirmation():
    _enable_site_sync()
    with pytest.raises(CommandError, match="--yes"):
        call_command("grandfather_accounts", "--apply")


def test_apply_publishes_valid_free_pieces_and_is_idempotent(tmp_path):
    _enable_site_sync()
    owner = _user("free-owner-apply")
    project = _valid_free_project(owner)
    project3d = Project3D.objects.create(owner=owner, title="Grandfather 3D")
    version3d = SceneVersion3D.objects.create(
        project=project3d, sequence=1, scene_json=MINIMAL_SCENE_3D, created_by=owner
    )
    project3d.current_version = version3d
    project3d.save(update_fields=["current_version"])
    piece = ArtPiece.objects.create(
        owner=owner,
        title="Grandfather piece",
        description="A generated composition.",
        prompt="anything",
        engine=ArtPiece.Engine.SVG,
    )
    version = ArtPieceVersion.objects.create(
        piece=piece, sequence=1, source="<svg></svg>", capabilities={}
    )
    piece.current_version = version
    piece.save(update_fields=["current_version"])

    rollback_file = tmp_path / "rollback.json"
    result = _run("--apply", "--yes", "--rollback-file", str(rollback_file))
    assert result["applied"] is True
    assert result["changes"] == 3

    project.refresh_from_db()
    project3d.refresh_from_db()
    piece.refresh_from_db()
    assert project.visibility == Project.Visibility.PUBLIC
    assert project.published_at is not None
    assert project3d.visibility == Project3D.Visibility.PUBLIC
    assert piece.status == ArtPiece.Status.PUBLISHED

    # Idempotent: a second run changes nothing further.
    second_rollback = tmp_path / "rollback2.json"
    second = _run("--apply", "--yes", "--rollback-file", str(second_rollback))
    assert second["changes"] == 0


def test_apply_enables_sync_for_paid_and_admin_accounts_only(tmp_path):
    _enable_site_sync()
    Plan.objects.get_or_create(plan_key="paid", defaults={"daily_ai_requests": 100})
    paid_owner = _user("paid-owner")
    set_user_plan(paid_owner, "paid")
    admin_owner = _user("admin-owner")
    ApplicationAdmin.objects.create(user=admin_owner)
    free_owner = _user("free-owner-no-sync")

    _run("--apply", "--yes", "--rollback-file", str(tmp_path / "rollback.json"))

    assert CloudSyncPreference.objects.get(owner=paid_owner).enabled is True
    assert CloudSyncPreference.objects.get(owner=paid_owner).consent_source == (
        "grandfathering-2026-09-25"
    )
    assert CloudSyncPreference.objects.get(owner=admin_owner).enabled is True
    assert not CloudSyncPreference.objects.filter(owner=free_owner, enabled=True).exists()


def test_rollback_restores_exactly_the_recorded_fields(tmp_path):
    _enable_site_sync()
    owner = _user("free-owner-rollback")
    project = _valid_free_project(owner)
    rollback_file = tmp_path / "rollback.json"

    _run("--apply", "--yes", "--rollback-file", str(rollback_file))
    project.refresh_from_db()
    assert project.visibility == Project.Visibility.PUBLIC

    call_command("grandfather_accounts", "--rollback", str(rollback_file))
    project.refresh_from_db()
    assert project.visibility == Project.Visibility.PRIVATE
    assert project.published_at is None


def test_rollback_deletes_a_sync_preference_that_did_not_exist_before(tmp_path):
    _enable_site_sync()
    Plan.objects.get_or_create(plan_key="paid2", defaults={"daily_ai_requests": 100})
    paid_owner = _user("paid-owner-rollback")
    set_user_plan(paid_owner, "paid2")
    rollback_file = tmp_path / "rollback.json"

    _run("--apply", "--yes", "--rollback-file", str(rollback_file))
    assert CloudSyncPreference.objects.filter(owner=paid_owner).exists()

    call_command("grandfather_accounts", "--rollback", str(rollback_file))
    assert not CloudSyncPreference.objects.filter(owner=paid_owner).exists()
