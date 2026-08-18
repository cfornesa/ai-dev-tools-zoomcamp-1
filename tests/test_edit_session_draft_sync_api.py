"""Tests for the server-side draft sync API (Task 43).

SQLite-portable tests below cover authorization (only the caller's own
permitted project/session draft is reachable), payload validation, the
newer-`client_seq`-wins upsert semantics under a single writer, and the
guarantee that no draft operation ever creates/mutates a `SceneVersion`.

Genuinely concurrent overlapping upserts — where `select_for_update()`
row-locking is what actually matters — are PostgreSQL-gated (opt in via
`POSTGRES_TEST_DATABASE_URL`, skip themselves otherwise), matching every
other PostgreSQL-only suite in this project (tests/test_scene_version_save_api.py,
tests/test_project_scene_version_models.py, tests/test_health.py).
"""

import json
import threading
from pathlib import Path

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connections
from rest_framework.test import APIClient

from scenes.models import EditSessionDraft, Project, SceneVersion

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
def project(owner):
    return Project.objects.create(owner=owner)


def _draft_url(project, session_id="session-1"):
    return f"/api/projects/{project.public_id}/draft/{session_id}/"


# --- Authorization -----------------------------------------------------


@pytest.mark.django_db
def test_owner_can_upsert_then_read_own_draft(owner_client, project):
    put_response = owner_client.put(
        _draft_url(project), {"draft_json": BLANK_SCENE, "client_seq": 1}, format="json"
    )
    assert put_response.status_code == 200
    body = put_response.json()
    assert body["applied"] is True
    assert body["draft_json"]["id"] == BLANK_SCENE["id"]
    assert body["client_seq"] == 1

    get_response = owner_client.get(_draft_url(project))
    assert get_response.status_code == 200
    assert get_response.json()["draft_json"]["id"] == BLANK_SCENE["id"]


@pytest.mark.django_db
def test_non_owner_cannot_read_write_or_delete_draft(other_client, project):
    get_response = other_client.get(_draft_url(project))
    assert get_response.status_code == 404

    put_response = other_client.put(
        _draft_url(project), {"draft_json": BLANK_SCENE, "client_seq": 1}, format="json"
    )
    assert put_response.status_code == 404
    assert EditSessionDraft.objects.count() == 0

    delete_response = other_client.delete(_draft_url(project))
    assert delete_response.status_code == 404


@pytest.mark.django_db
def test_anonymous_cannot_read_write_or_delete_draft(project):
    client = APIClient()

    assert client.get(_draft_url(project)).status_code == 404
    assert (
        client.put(
            _draft_url(project), {"draft_json": BLANK_SCENE, "client_seq": 1}, format="json"
        ).status_code
        == 404
    )
    assert client.delete(_draft_url(project)).status_code == 404
    assert EditSessionDraft.objects.count() == 0


@pytest.mark.django_db
def test_owner_of_a_different_project_cannot_reach_this_projects_draft(owner_client, other_user):
    other_project = Project.objects.create(owner=other_user)

    response = owner_client.get(_draft_url(other_project))

    assert response.status_code == 404


@pytest.mark.django_db
def test_reading_nonexistent_draft_is_404(owner_client, project):
    response = owner_client.get(_draft_url(project))
    assert response.status_code == 404


@pytest.mark.django_db
def test_two_sessions_for_the_same_owner_and_project_do_not_collide(owner_client, project, owner):
    owner_client.put(
        _draft_url(project, "session-a"),
        {"draft_json": BLANK_SCENE, "client_seq": 1},
        format="json",
    )
    owner_client.put(
        _draft_url(project, "session-b"),
        {"draft_json": BLANK_SCENE, "client_seq": 1},
        format="json",
    )

    assert EditSessionDraft.objects.filter(project=project, user=owner).count() == 2


# --- Payload validation --------------------------------------------------


@pytest.mark.django_db
def test_invalid_scene_json_is_rejected_and_creates_no_draft(owner_client, project):
    invalid_scene = {**BLANK_SCENE, "schemaVersion": 999}

    response = owner_client.put(
        _draft_url(project), {"draft_json": invalid_scene, "client_seq": 1}, format="json"
    )

    assert response.status_code == 400
    assert response.json()["errors"][0]["rule"] == "unsupportedSchemaVersion"
    assert EditSessionDraft.objects.count() == 0


@pytest.mark.django_db
def test_missing_client_seq_is_rejected(owner_client, project):
    response = owner_client.put(_draft_url(project), {"draft_json": BLANK_SCENE}, format="json")

    assert response.status_code == 400
    assert EditSessionDraft.objects.count() == 0


@pytest.mark.django_db
def test_negative_client_seq_is_rejected(owner_client, project):
    response = owner_client.put(
        _draft_url(project), {"draft_json": BLANK_SCENE, "client_seq": -1}, format="json"
    )

    assert response.status_code == 400
    assert EditSessionDraft.objects.count() == 0


# --- Upsert / newer-client_seq-wins semantics (single-writer, SQLite-safe) --


@pytest.mark.django_db
def test_second_upsert_with_higher_client_seq_replaces_draft(owner_client, project):
    owner_client.put(
        _draft_url(project), {"draft_json": BLANK_SCENE, "client_seq": 1}, format="json"
    )
    newer_scene = {**BLANK_SCENE, "id": "scene-newer"}

    response = owner_client.put(
        _draft_url(project), {"draft_json": newer_scene, "client_seq": 2}, format="json"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["applied"] is True
    assert body["draft_json"]["id"] == "scene-newer"
    assert body["client_seq"] == 2
    assert EditSessionDraft.objects.count() == 1


@pytest.mark.django_db
def test_stale_client_seq_does_not_replace_newer_stored_draft(owner_client, project):
    newer_scene = {**BLANK_SCENE, "id": "scene-newer"}
    owner_client.put(
        _draft_url(project), {"draft_json": newer_scene, "client_seq": 5}, format="json"
    )
    stale_scene = {**BLANK_SCENE, "id": "scene-stale"}

    response = owner_client.put(
        _draft_url(project), {"draft_json": stale_scene, "client_seq": 3}, format="json"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["applied"] is False
    # The response reflects the still-newest stored draft, not the rejected one.
    assert body["draft_json"]["id"] == "scene-newer"
    assert body["client_seq"] == 5

    stored = EditSessionDraft.objects.get(project=project)
    assert stored.draft_json["id"] == "scene-newer"
    assert stored.client_seq == 5


@pytest.mark.django_db
def test_equal_client_seq_is_treated_as_stale_and_ignored(owner_client, project):
    owner_client.put(
        _draft_url(project), {"draft_json": BLANK_SCENE, "client_seq": 4}, format="json"
    )
    other_scene = {**BLANK_SCENE, "id": "scene-other"}

    response = owner_client.put(
        _draft_url(project), {"draft_json": other_scene, "client_seq": 4}, format="json"
    )

    assert response.json()["applied"] is False
    stored = EditSessionDraft.objects.get(project=project)
    assert stored.draft_json["id"] == BLANK_SCENE["id"]


# --- Delete --------------------------------------------------------------


@pytest.mark.django_db
def test_owner_can_delete_own_draft(owner_client, project):
    owner_client.put(
        _draft_url(project), {"draft_json": BLANK_SCENE, "client_seq": 1}, format="json"
    )

    response = owner_client.delete(_draft_url(project))

    assert response.status_code == 204
    assert EditSessionDraft.objects.count() == 0


@pytest.mark.django_db
def test_deleting_a_nonexistent_draft_is_still_a_no_op_204(owner_client, project):
    response = owner_client.delete(_draft_url(project))
    assert response.status_code == 204


# --- Expiry --------------------------------------------------------------


@pytest.mark.django_db
def test_expired_draft_reads_as_absent(owner_client, project):
    from datetime import timedelta

    from django.utils import timezone

    owner_client.put(
        _draft_url(project), {"draft_json": BLANK_SCENE, "client_seq": 1}, format="json"
    )
    EditSessionDraft.objects.filter(project=project).update(
        expires_at=timezone.now() - timedelta(hours=1)
    )

    response = owner_client.get(_draft_url(project))

    assert response.status_code == 404


@pytest.mark.django_db
def test_cleanup_command_deletes_only_expired_drafts(owner_client, project, owner):
    from datetime import timedelta
    from io import StringIO

    from django.core.management import call_command
    from django.utils import timezone

    fresh = EditSessionDraft.objects.create(
        project=project, user=owner, session_id="fresh", draft_json=BLANK_SCENE
    )
    stale = EditSessionDraft.objects.create(
        project=project, user=owner, session_id="stale", draft_json=BLANK_SCENE
    )
    EditSessionDraft.objects.filter(pk=stale.pk).update(
        expires_at=timezone.now() - timedelta(hours=1)
    )

    out = StringIO()
    call_command("cleanup_expired_drafts", stdout=out)

    assert "Deleted 1 expired draft" in out.getvalue()
    remaining = list(EditSessionDraft.objects.all())
    assert remaining == [fresh]


# --- Never touches SceneVersion -------------------------------------------


@pytest.mark.django_db
def test_draft_upsert_and_delete_never_create_or_mutate_scene_versions(owner_client, project):
    assert SceneVersion.objects.count() == 0

    owner_client.put(
        _draft_url(project), {"draft_json": BLANK_SCENE, "client_seq": 1}, format="json"
    )
    assert SceneVersion.objects.count() == 0
    assert project.__class__.objects.get(pk=project.pk).current_version is None

    changed_scene = {**BLANK_SCENE, "id": "scene-changed"}
    owner_client.put(
        _draft_url(project), {"draft_json": changed_scene, "client_seq": 2}, format="json"
    )
    assert SceneVersion.objects.count() == 0

    owner_client.delete(_draft_url(project))
    assert SceneVersion.objects.count() == 0
    assert project.__class__.objects.get(pk=project.pk).current_version is None


# --- PostgreSQL-only: genuine overlapping-upsert ordering (Task 43) ------

pytestmark_postgres = pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping PostgreSQL-backed tests.",
)


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"], transaction=True)
def test_postgres_concurrent_upserts_never_let_an_older_client_seq_win(django_db_blocker):
    """Two genuinely overlapping upserts for the same (project, user, session),
    one with a higher `client_seq` than the other, must serialize via
    `select_for_update()` so that whichever commits second still leaves the
    higher-`client_seq` write as the stored draft — regardless of which
    thread happened to start (or even finish) first.
    """
    with django_db_blocker.unblock():
        from scenes.api import _upsert_draft

        User = get_user_model()
        user = User.objects.using("postgres_test").create_user(username="concurrent-draft-user")
        project = Project.objects.using("postgres_test").create(owner=user)

        newer_scene = {**BLANK_SCENE, "id": "scene-newer"}
        older_scene = {**BLANK_SCENE, "id": "scene-older"}

        barrier = threading.Barrier(2)
        results = {}

        def do_upsert(label, draft_json, client_seq):
            barrier.wait()
            try:
                draft, applied = _upsert_draft(
                    Project.objects.using("postgres_test").get(pk=project.pk),
                    user,
                    "session-1",
                    draft_json,
                    client_seq,
                )
                results[label] = applied
            finally:
                connections["postgres_test"].close()

        threads = [
            threading.Thread(target=do_upsert, args=("newer", newer_scene, 10)),
            threading.Thread(target=do_upsert, args=("older", older_scene, 3)),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # The higher client_seq (10) must always be applied; the lower one
        # (3) must never be applied, no matter which thread's transaction
        # committed first.
        assert results["newer"] is True
        assert results["older"] is False

        stored = EditSessionDraft.objects.using("postgres_test").get(
            project=project, user=user, session_id="session-1"
        )
        assert stored.draft_json["id"] == "scene-newer"
        assert stored.client_seq == 10
        assert SceneVersion.objects.using("postgres_test").filter(project=project).count() == 0


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"], transaction=True)
def test_postgres_concurrent_first_writes_serialize_without_duplicate_rows(django_db_blocker):
    """Two genuinely overlapping *first-ever* upserts for the same scope
    (no existing row to lock yet) must not both succeed at creating a row —
    the `unique_draft_scope` constraint plus `_upsert_draft`'s
    IntegrityError fallback must leave exactly one row, with the
    higher-`client_seq` write winning.
    """
    with django_db_blocker.unblock():
        from scenes.api import _upsert_draft

        User = get_user_model()
        user = User.objects.using("postgres_test").create_user(username="concurrent-first-write")
        project = Project.objects.using("postgres_test").create(owner=user)

        barrier = threading.Barrier(2)
        results = {}

        def do_upsert(label, client_seq):
            barrier.wait()
            try:
                draft, applied = _upsert_draft(
                    Project.objects.using("postgres_test").get(pk=project.pk),
                    user,
                    "session-first",
                    {**BLANK_SCENE, "id": f"scene-{label}"},
                    client_seq,
                )
                results[label] = applied
            finally:
                connections["postgres_test"].close()

        threads = [
            threading.Thread(target=do_upsert, args=("a", 1)),
            threading.Thread(target=do_upsert, args=("b", 2)),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        rows = list(
            EditSessionDraft.objects.using("postgres_test").filter(
                project=project, user=user, session_id="session-first"
            )
        )
        assert len(rows) == 1
        assert rows[0].client_seq == 2
        assert rows[0].draft_json["id"] == "scene-b"
