"""Issue #134: the `backfill_thumbnails` management command — generates or
regenerates thumbnails for public projects whose current version has no
usable (non-fallback) thumbnail yet, without touching private projects.

`@pytest.mark.django_db(transaction=True)` is required here for the same
reason `tests/test_project_thumbnail_api.py` uses it: the command's only
DB-visible effect comes through `ensure_thumbnail_for_version`, called
directly (not scheduled via `transaction.on_commit`), so this isn't
strictly needed by the command itself, but keeping it consistent with the
rest of the thumbnail test suite avoids any surprise around Thumbnail's
OneToOne constraint under the plain rollback-wrapping `django_db` fixture.
"""

import json
from io import StringIO
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from scenes.models import Project, SceneVersion, Thumbnail

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
    ).read_text()
)


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="alice")


def _public_project_with_version(owner, title="Public project"):
    project = Project.objects.create(owner=owner, title=title, visibility=Project.Visibility.PUBLIC)
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = version
    project.save(update_fields=["current_version"])
    return project


@pytest.mark.django_db(transaction=True)
def test_generates_a_thumbnail_for_a_public_project_with_none_yet(owner):
    project = _public_project_with_version(owner)
    assert not Thumbnail.objects.filter(scene_version=project.current_version).exists()

    out = StringIO()
    call_command("backfill_thumbnails", stdout=out)

    thumbnail = Thumbnail.objects.get(scene_version=project.current_version)
    assert thumbnail.is_fallback is False
    assert "1 thumbnail(s) generated" in out.getvalue()


@pytest.mark.django_db(transaction=True)
def test_retries_a_project_stuck_with_a_fallback_thumbnail(owner):
    project = _public_project_with_version(owner)
    Thumbnail.objects.create(
        scene_version=project.current_version,
        image_data=b"fallback-bytes",
        content_type="image/png",
        width=320,
        height=240,
        is_fallback=True,
    )

    call_command("backfill_thumbnails", stdout=StringIO())

    thumbnail = Thumbnail.objects.get(scene_version=project.current_version)
    assert thumbnail.is_fallback is False
    assert bytes(thumbnail.image_data) != b"fallback-bytes"


@pytest.mark.django_db(transaction=True)
def test_leaves_a_project_with_a_real_thumbnail_alone(owner):
    project = _public_project_with_version(owner)
    Thumbnail.objects.create(
        scene_version=project.current_version,
        image_data=b"already-good",
        content_type="image/png",
        width=320,
        height=240,
        is_fallback=False,
    )

    out = StringIO()
    call_command("backfill_thumbnails", stdout=out)

    thumbnail = Thumbnail.objects.get(scene_version=project.current_version)
    assert bytes(thumbnail.image_data) == b"already-good"
    assert "No public projects need a thumbnail backfill" in out.getvalue()


@pytest.mark.django_db(transaction=True)
def test_never_touches_a_private_project(owner):
    project = Project.objects.create(owner=owner, title="Still private")
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = version
    project.save(update_fields=["current_version"])

    call_command("backfill_thumbnails", stdout=StringIO())

    assert not Thumbnail.objects.filter(scene_version=version).exists()


@pytest.mark.django_db(transaction=True)
def test_dry_run_reports_without_generating_anything(owner):
    project = _public_project_with_version(owner)

    out = StringIO()
    call_command("backfill_thumbnails", "--dry-run", stdout=out)

    assert not Thumbnail.objects.filter(scene_version=project.current_version).exists()
    assert "1 public project(s) would be backfilled" in out.getvalue()
