"""Tests for POST /api/projects/<id>/ai/accept-proposal/ (Task 48).

SQLite-portable tests below cover single-writer correctness: creating
exactly one version with the right origin, server-side re-validation,
stale-base rejection, ownership/auth, and idempotent replay via
`client_request_id`. `select_for_update()` row-locking has no real effect
on SQLite, so the genuinely-overlapping/replayed-Accept-race tests are
PostgreSQL-gated (opt in via `POSTGRES_TEST_DATABASE_URL`, skip
themselves otherwise) — same convention as
tests/test_scene_version_save_api.py and tests/test_blank_project_creation_api.py.
"""

from __future__ import annotations

import copy
import json
import threading
import uuid
from pathlib import Path

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.models import Project, SceneVersion
from tests._postgres_routing import close_thread_connections, route_default_to_postgres_test

_FIXTURE_PATH = (
    Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
)
BLANK_SCENE = json.loads(_FIXTURE_PATH.read_text())


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


def _url(project):
    return f"/api/projects/{project.public_id}/ai/accept-proposal/"


def _payload(*, operation="ai_create", scene=None, base_version_id=None, client_request_id=None):
    body = {
        "operation": operation,
        "scene_json": scene if scene is not None else copy.deepcopy(BLANK_SCENE),
        "base_version_id": base_version_id,
    }
    if client_request_id is not None:
        body["client_request_id"] = client_request_id
    return body


# --- Success: creates exactly one version, advances current_version --------


@pytest.mark.django_db
def test_ai_create_accept_creates_version_with_ai_create_origin_and_no_prior_base(
    owner_client, project
):
    response = owner_client.post(_url(project), _payload(operation="ai_create"), format="json")

    assert response.status_code == 201
    body = response.json()
    assert body["origin"] == "ai_create"
    assert body["sequence"] == 1
    assert body["parent"] is None

    project.refresh_from_db()
    version = SceneVersion.objects.get()
    assert project.current_version_id == version.id
    assert version.origin == SceneVersion.Origin.AI_CREATE


@pytest.mark.django_db
def test_ai_edit_accept_requires_matching_base_and_creates_ai_edit_origin(
    owner_client, project, owner
):
    base = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = base
    project.save(update_fields=["current_version"])

    edited_scene = copy.deepcopy(BLANK_SCENE)
    edited_scene["canvas"]["backgroundColor"] = "#000000"

    response = owner_client.post(
        _url(project),
        _payload(operation="ai_edit", scene=edited_scene, base_version_id=base.id),
        format="json",
    )

    assert response.status_code == 201
    body = response.json()
    assert body["origin"] == "ai_edit"
    assert body["sequence"] == 2
    assert body["parent"] == base.id

    project.refresh_from_db()
    assert project.current_version.sequence == 2


# --- Server-side re-validation: never trusts the client's scene ------------


@pytest.mark.django_db
def test_invalid_scene_is_rejected_and_creates_no_version(owner_client, project):
    invalid_scene = {**BLANK_SCENE, "schemaVersion": 999}

    response = owner_client.post(
        _url(project), _payload(operation="ai_create", scene=invalid_scene), format="json"
    )

    assert response.status_code == 422
    assert response.json()["error"] == "invalid_structured_output"
    assert SceneVersion.objects.count() == 0
    project.refresh_from_db()
    assert project.current_version is None


MALICIOUS_DIR = Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "malicious"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "fixture_name",
    ["forbidden_node_type.json", "invalid_graph_cycle.json", "duplicate_ids.json"],
)
def test_malicious_scene_json_fixtures_are_rejected_and_create_no_version(
    owner_client, project, fixture_name
):
    """Task 72: a malicious `scene_json` reaching the Accept endpoint --
    exactly what a compromised/malicious client could submit regardless of
    what AICreateSceneView/AIEditSceneView actually returned -- must never
    become a `SceneVersion`, confirming `AIAcceptProposalView`'s
    documented "never trusts the client's scene" re-validation actually
    holds for these adversarial shapes specifically, not only for the
    single hand-written invalid fixture the test above already covers.
    """
    malicious_scene = json.loads((MALICIOUS_DIR / fixture_name).read_text())

    response = owner_client.post(
        _url(project),
        _payload(operation="ai_create", scene=malicious_scene),
        format="json",
    )

    assert response.status_code == 422, response.content
    body = response.json()
    assert body["error"] == "invalid_structured_output"
    assert "Traceback" not in body.get("detail", "")
    assert SceneVersion.objects.count() == 0
    project.refresh_from_db()
    assert project.current_version is None


# --- Stale base -------------------------------------------------------------


@pytest.mark.django_db
def test_stale_base_is_rejected_with_409_and_creates_no_version(owner_client, project, owner):
    base = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = base
    project.save(update_fields=["current_version"])

    # Someone else's save landed since the proposal's base was fetched.
    other_version = SceneVersion.objects.create(
        project=project,
        sequence=2,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
        parent=base,
    )
    project.current_version = other_version
    project.save(update_fields=["current_version"])

    response = owner_client.post(
        _url(project),
        _payload(operation="ai_edit", base_version_id=base.id),
        format="json",
    )

    assert response.status_code == 409
    assert response.json()["error"] == "stale_base"
    assert SceneVersion.objects.filter(project=project).count() == 2
    project.refresh_from_db()
    assert project.current_version_id == other_version.id


@pytest.mark.django_db
def test_ai_create_with_nonexistent_base_version_id_is_stale(owner_client, project):
    response = owner_client.post(
        _url(project),
        _payload(operation="ai_create", base_version_id=999),
        format="json",
    )

    assert response.status_code == 409
    assert SceneVersion.objects.count() == 0


# --- Idempotency / duplicate-accept guard -----------------------------------


@pytest.mark.django_db
def test_repeated_accept_with_same_client_request_id_creates_exactly_one_version(
    owner_client, project
):
    request_id = str(uuid.uuid4())

    first = owner_client.post(
        _url(project),
        _payload(operation="ai_create", client_request_id=request_id),
        format="json",
    )
    second = owner_client.post(
        _url(project),
        _payload(operation="ai_create", client_request_id=request_id),
        format="json",
    )

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert SceneVersion.objects.filter(project=project).count() == 1


@pytest.mark.django_db
def test_replayed_accept_after_current_version_moved_on_is_still_a_no_op_success(
    owner_client, project, owner
):
    """A replay of an *already-accepted* proposal succeeds even though
    current_version has since moved past base_version_id -- that "move" is
    this very accept having already happened, not a real conflict."""
    request_id = str(uuid.uuid4())

    first = owner_client.post(
        _url(project),
        _payload(operation="ai_create", client_request_id=request_id, base_version_id=None),
        format="json",
    )
    assert first.status_code == 201

    # A second, unrelated manual save moves current_version further.
    owner_client.post(
        f"/api/projects/{project.public_id}/versions/",
        {"scene_json": BLANK_SCENE, "origin": "manual"},
        format="json",
    )

    replay = owner_client.post(
        _url(project),
        _payload(operation="ai_create", client_request_id=request_id, base_version_id=None),
        format="json",
    )

    assert replay.status_code == 200
    assert replay.json()["id"] == first.json()["id"]
    assert SceneVersion.objects.filter(project=project).count() == 2


@pytest.mark.django_db
def test_without_client_request_id_each_request_creates_its_own_version(owner_client, project):
    first = owner_client.post(_url(project), _payload(operation="ai_create"), format="json")
    # First accept has no base conflict (no prior version); second one will
    # be stale since current_version now points at the first.
    second = owner_client.post(_url(project), _payload(operation="ai_create"), format="json")

    assert first.status_code == 201
    assert second.status_code == 409  # stale, not a silent duplicate
    assert SceneVersion.objects.filter(project=project).count() == 1


# --- Ownership / auth --------------------------------------------------------


@pytest.mark.django_db
def test_non_owner_gets_404(other_client, project):
    response = other_client.post(_url(project), _payload(operation="ai_create"), format="json")

    assert response.status_code == 404
    assert SceneVersion.objects.count() == 0


@pytest.mark.django_db
def test_anonymous_gets_404(project):
    response = APIClient().post(_url(project), _payload(operation="ai_create"), format="json")

    assert response.status_code == 404
    assert SceneVersion.objects.count() == 0


@pytest.mark.django_db
def test_invalid_operation_is_rejected(owner_client, project):
    response = owner_client.post(_url(project), _payload(operation="restore"), format="json")

    assert response.status_code == 400
    assert SceneVersion.objects.count() == 0


# --- PostgreSQL-only: genuine overlapping/replayed Accept concurrency ------

pytestmark_postgres = pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping PostgreSQL-backed tests.",
)


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"], transaction=True)
def test_postgres_concurrent_duplicate_accepts_produce_exactly_one_version(django_db_blocker):
    """Two genuinely overlapping Accept requests carrying the *same*
    client_request_id (e.g. a double-click, or a client retrying a request
    whose response was lost) must never create two versions: whichever
    transaction commits first wins the unique (project, ai_request_id)
    index; the other resolves to the same version instead of erroring or
    creating a duplicate.
    """
    with django_db_blocker.unblock():
        User = get_user_model()
        user = User.objects.db_manager("postgres_test").create_user(
            username="concurrent-accept-user"
        )
        project = Project.objects.using("postgres_test").create(owner=user)
        request_id = uuid.uuid4()

        client = APIClient()
        client.force_authenticate(user)

        results = []
        barrier = threading.Barrier(2)

        def do_accept():
            barrier.wait()
            try:
                response = client.post(
                    f"/api/projects/{project.public_id}/ai/accept-proposal/",
                    {
                        "operation": "ai_create",
                        "scene_json": BLANK_SCENE,
                        "base_version_id": None,
                        "client_request_id": str(request_id),
                    },
                    format="json",
                )
                results.append((response.status_code, response.json().get("id")))
            finally:
                close_thread_connections()

        threads = [threading.Thread(target=do_accept) for _ in range(2)]
        with route_default_to_postgres_test():
            for t in threads:
                t.start()
            for t in threads:
                t.join()

        assert sorted(status for status, _ in results) == [200, 201]
        version_ids = {version_id for _, version_id in results}
        assert len(version_ids) == 1

        versions = SceneVersion.objects.using("postgres_test").filter(project=project)
        assert versions.count() == 1
        project.refresh_from_db(using="postgres_test")
        assert project.current_version_id == versions.get().id


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"], transaction=True)
def test_postgres_concurrent_accepts_without_request_id_serialize_to_distinct_sequences(
    django_db_blocker,
):
    """Two overlapping Accept requests with *different* (or absent)
    client_request_id are legitimately distinct proposals -- both may
    succeed, but select_for_update() must still serialize them so they
    never collide on the same sequence number, and current_version/parent
    stay consistent afterward (no partial save under any interleaving).
    """
    with django_db_blocker.unblock():
        User = get_user_model()
        user = User.objects.db_manager("postgres_test").create_user(
            username="concurrent-accept-user-2"
        )
        project = Project.objects.using("postgres_test").create(owner=user)

        client = APIClient()
        client.force_authenticate(user)

        results = []
        barrier = threading.Barrier(2)

        def do_accept():
            barrier.wait()
            try:
                response = client.post(
                    f"/api/projects/{project.public_id}/ai/accept-proposal/",
                    {
                        "operation": "ai_create",
                        "scene_json": BLANK_SCENE,
                        "base_version_id": None,
                        "client_request_id": str(uuid.uuid4()),
                    },
                    format="json",
                )
                results.append(response.status_code)
            finally:
                close_thread_connections()

        threads = [threading.Thread(target=do_accept) for _ in range(2)]
        with route_default_to_postgres_test():
            for t in threads:
                t.start()
            for t in threads:
                t.join()

        # Exactly one of the two "no prior base" accepts should win (201);
        # the other finds current_version has already moved and gets a
        # documented 409 stale_base -- either way, no partial/duplicate save.
        assert sorted(results) == [201, 409]
        versions = SceneVersion.objects.using("postgres_test").filter(project=project)
        assert versions.count() == 1
        project.refresh_from_db(using="postgres_test")
        assert project.current_version_id == versions.get().id
