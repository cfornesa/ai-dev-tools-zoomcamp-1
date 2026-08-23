"""Tests for the immutable version save API (Task 14).

SQLite-portable tests below cover single-writer correctness (sequence
assignment, parent linkage, rejection paths). `select_for_update()`
row-locking — what actually makes *concurrent* saves serialize instead of
racing — has no real effect on SQLite (no row-level locking support), so
the genuinely-overlapping-saves and injected-mid-transaction-failure
tests are PostgreSQL-gated (opt in via `POSTGRES_TEST_DATABASE_URL`,
skip themselves otherwise), matching every other PostgreSQL-only suite
in this project (tests/test_health.py, tests/test_project_scene_version_models.py).
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
def project(owner):
    return Project.objects.create(owner=owner)


def _versions_url(project):
    return f"/api/projects/{project.public_id}/versions/"


@pytest.mark.django_db
def test_first_save_assigns_sequence_one_with_no_parent(owner_client, project, owner):
    response = owner_client.post(
        _versions_url(project),
        {"scene_json": BLANK_SCENE, "origin": "manual", "change_label": "Initial"},
        format="json",
    )

    assert response.status_code == 201
    body = response.json()
    assert body["sequence"] == 1
    assert body["parent"] is None
    assert body["origin"] == "manual"
    assert body["change_label"] == "Initial"

    project.refresh_from_db()
    assert project.current_version_id == SceneVersion.objects.get().id


@pytest.mark.django_db
def test_second_save_gets_next_sequence_and_correct_parent(owner_client, project):
    first = owner_client.post(
        _versions_url(project), {"scene_json": BLANK_SCENE, "origin": "manual"}, format="json"
    ).json()

    second = owner_client.post(
        _versions_url(project), {"scene_json": BLANK_SCENE, "origin": "manual"}, format="json"
    ).json()

    assert second["sequence"] == 2
    assert second["parent"] == first["id"]

    project = Project.objects.get()
    assert project.current_version_id == second["id"]


@pytest.mark.django_db
def test_saved_snapshot_cannot_be_altered_afterward(owner_client, project):
    from scenes.models import SceneVersionImmutableError

    response = owner_client.post(
        _versions_url(project), {"scene_json": BLANK_SCENE, "origin": "manual"}, format="json"
    )
    version = SceneVersion.objects.get(pk=response.json()["id"])

    version.scene_json = {**BLANK_SCENE, "id": "tampered"}
    with pytest.raises(SceneVersionImmutableError):
        version.save()


@pytest.mark.django_db
def test_invalid_scene_creates_no_version_and_leaves_current_version_unchanged(
    owner_client, project
):
    invalid_scene = {**BLANK_SCENE, "schemaVersion": 999}

    response = owner_client.post(
        _versions_url(project), {"scene_json": invalid_scene, "origin": "manual"}, format="json"
    )

    assert response.status_code == 400
    assert response.json()["errors"][0]["rule"] == "unsupportedSchemaVersion"
    assert SceneVersion.objects.count() == 0
    project.refresh_from_db()
    assert project.current_version is None


MALICIOUS_DIR = Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "malicious"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "fixture_name",
    [
        "forbidden_node_type.json",
        "invalid_graph_cycle.json",
        "duplicate_ids.json",
        "nan_opacity.json.txt",
        "combined_resource_limit_abuse.json",
    ],
)
def test_malicious_fixtures_create_no_version_and_never_reach_persistence(
    owner_client, project, fixture_name
):
    """Task 72: a sample of the most dangerous shared fixtures (forbidden
    node type, graph cycle, duplicate ids, a NaN-injection attempt, and
    combined resource-limit abuse) end to end -- through the real save
    endpoint, not just `validate_scene` in isolation -- confirming the
    same rejection `tests/test_scene_validation.py` proves at the
    validator layer also holds at the persistence boundary: no
    `SceneVersion` row, and `project.current_version` untouched.
    """
    # DRF's JSONRenderer refuses to re-serialize a NaN/Infinity float at
    # all (allow_nan=False), so a request body containing one can't be
    # built through `format="json"` -- send the fixture's own raw bytes
    # (which already carry the literal NaN/Infinity token verbatim, the
    # same as an attacker's raw request body would) instead, for every
    # fixture, rather than special-casing just the non-finite ones.
    raw_body = (MALICIOUS_DIR / fixture_name).read_text()
    wrapped_body = json.dumps({"scene_json": json.loads(raw_body), "origin": "manual"})
    # json.dumps here re-emits NaN/Infinity tokens verbatim (its default
    # allow_nan=True), unlike DRF's renderer above -- this is exactly what
    # this test needs: a wire-format request body an attacker could
    # actually send, literal non-standard tokens included.

    response = owner_client.post(
        _versions_url(project),
        data=wrapped_body,
        content_type="application/json",
    )

    assert response.status_code == 400, response.content
    body = response.json()
    if fixture_name == "nan_opacity.json.txt":
        # DRF's own request-body JSON parser rejects NaN/Infinity before
        # this view -- and therefore validate_scene -- ever runs at all
        # (`REST_FRAMEWORK["STRICT_JSON"]` defaults to True and this
        # project doesn't override it): `{"detail": "JSON parse error ..."}`,
        # not this endpoint's usual `{"errors": [...]}` shape. Both are
        # safe, field/rule-free-of-internals responses; scenes/validation.py's
        # own nonFiniteNumber check (tests/test_scene_validation.py) is
        # what protects a caller that reaches validate_scene some other
        # way (e.g. not through a DRF view at all).
        assert "detail" in body
        assert "Traceback" not in body["detail"]
    else:
        assert body["errors"], "must report at least one field/rule error"
        for error in body["errors"]:
            assert "Traceback" not in error.get("message", "")
            assert "jsonschema" not in error.get("message", "").lower()
    assert SceneVersion.objects.count() == 0
    project.refresh_from_db()
    assert project.current_version is None


@pytest.mark.django_db
def test_invalid_origin_is_rejected(owner_client, project):
    response = owner_client.post(
        _versions_url(project),
        {"scene_json": BLANK_SCENE, "origin": "restore"},  # only the restore endpoint may use this
        format="json",
    )

    assert response.status_code == 400
    assert SceneVersion.objects.count() == 0


@pytest.mark.django_db
def test_non_owner_cannot_save_and_gets_404(other_client, project):
    response = other_client.post(
        _versions_url(project), {"scene_json": BLANK_SCENE, "origin": "manual"}, format="json"
    )

    assert response.status_code == 404
    assert SceneVersion.objects.count() == 0


@pytest.mark.django_db
def test_anonymous_cannot_save_and_gets_404(project):
    response = APIClient().post(
        _versions_url(project), {"scene_json": BLANK_SCENE, "origin": "manual"}, format="json"
    )

    assert response.status_code == 404
    assert SceneVersion.objects.count() == 0


@pytest.mark.django_db
def test_soft_deleted_project_rejects_save(owner_client, project, owner):
    project.is_deleted = True
    project.save(update_fields=["is_deleted"])

    response = owner_client.post(
        _versions_url(project), {"scene_json": BLANK_SCENE, "origin": "manual"}, format="json"
    )

    assert response.status_code == 404
    assert SceneVersion.objects.count() == 0


@pytest.mark.django_db
def test_version_list_is_ordered_and_excludes_soft_deleted(owner_client, project):
    ids = []
    for _ in range(3):
        resp = owner_client.post(
            _versions_url(project), {"scene_json": BLANK_SCENE, "origin": "manual"}, format="json"
        )
        ids.append(resp.json()["id"])

    middle = SceneVersion.objects.get(pk=ids[1])
    middle.is_deleted = True
    middle.save()

    response = owner_client.get(_versions_url(project))

    assert response.status_code == 200
    body = response.json()
    assert [v["id"] for v in body] == [ids[0], ids[2]]
    assert [v["sequence"] for v in body] == [1, 3]


@pytest.mark.django_db
def test_version_list_exposes_documented_history_metadata_not_full_snapshot(owner_client, project):
    owner_client.post(
        _versions_url(project),
        {"scene_json": BLANK_SCENE, "origin": "manual", "change_label": "First"},
        format="json",
    )

    response = owner_client.get(_versions_url(project))

    entry = response.json()[0]
    assert set(entry.keys()) == {
        "id",
        "sequence",
        "origin",
        "change_label",
        "created_by",
        "parent",
        "fork_source_version",
        "created_at",
    }
    assert "scene_json" not in entry


@pytest.mark.django_db
def test_version_list_requires_ownership(other_client, owner_client, project):
    owner_client.post(
        _versions_url(project), {"scene_json": BLANK_SCENE, "origin": "manual"}, format="json"
    )

    response = other_client.get(_versions_url(project))

    assert response.status_code == 404


# --- PostgreSQL-only: genuine concurrency and rollback (Task 14) ---

pytestmark_postgres = pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping PostgreSQL-backed tests.",
)


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"], transaction=True)
def test_postgres_concurrent_saves_never_collide_on_sequence(django_db_blocker):
    """Two genuinely overlapping saves against the same project must serialize:
    select_for_update() blocks the second thread's transaction until the first
    commits, so no two versions ever land on the same sequence number, and
    current_version/parent stay consistent afterward.
    """
    with django_db_blocker.unblock():
        User = get_user_model()
        user = User.objects.db_manager("postgres_test").create_user(username="concurrent-save-user")
        project = Project.objects.using("postgres_test").create(owner=user)

        results = []
        barrier = threading.Barrier(2)

        def do_save():
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
                    version = SceneVersion.objects.using("postgres_test").create(
                        project=locked,
                        sequence=next_sequence,
                        scene_json=BLANK_SCENE,
                        created_by=user,
                        parent=locked.current_version,
                        origin=SceneVersion.Origin.MANUAL,
                    )
                    locked.current_version = version
                    locked.save(using="postgres_test", update_fields=["current_version"])
                results.append(version.sequence)
            finally:
                connections["postgres_test"].close()

        threads = [threading.Thread(target=do_save) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert sorted(results) == [1, 2]
        versions = list(
            SceneVersion.objects.using("postgres_test").filter(project=project).order_by("sequence")
        )
        assert [v.sequence for v in versions] == [1, 2]
        project.refresh_from_db(using="postgres_test")
        assert project.current_version.project_id == project.id
        assert project.current_version.sequence == 2
        assert versions[1].parent_id == versions[0].id


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"])
def test_postgres_rollback_on_injected_failure_leaves_state_unchanged(django_db_blocker):
    with django_db_blocker.unblock():
        User = get_user_model()
        user = User.objects.db_manager("postgres_test").create_user(username="rollback-user")
        project = Project.objects.using("postgres_test").create(owner=user)

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
                    scene_json=BLANK_SCENE,
                    created_by=user,
                    parent=locked.current_version,
                    origin=SceneVersion.Origin.MANUAL,
                )
                raise InjectedFailure("simulated failure before advancing current_version")

        assert SceneVersion.objects.using("postgres_test").filter(project=project).count() == 0
        project.refresh_from_db(using="postgres_test")
        assert project.current_version is None
