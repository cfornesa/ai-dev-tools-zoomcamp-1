"""Tests for atomic public-project forking (Task 51)."""

import copy
import json
import threading
import uuid
from pathlib import Path

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connections
from rest_framework.test import APIClient

from scenes.models import ForkProvenance, Project, SceneVersion

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
    ).read_text()
)


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="alice")


@pytest.fixture
def visitor(db):
    return get_user_model().objects.create_user(username="bob")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.fixture
def visitor_client(visitor):
    client = APIClient()
    client.force_authenticate(visitor)
    return client


@pytest.fixture
def anon_client():
    return APIClient()


def _make_public_project(owner, *, allow_public_remix=True, title="Hand Follower"):
    project = Project.objects.create(
        owner=owner,
        title=title,
        visibility=Project.Visibility.PUBLIC,
        allow_public_remix=allow_public_remix,
        published_at=None,
    )
    scene = copy.deepcopy(BLANK_SCENE)
    version = SceneVersion.objects.create(
        project=project, sequence=1, scene_json=scene, origin=SceneVersion.Origin.MANUAL
    )
    project.current_version = version
    project.save(update_fields=["current_version"])
    return project


def _fork_url(project):
    return f"/api/public/projects/{project.public_id}/fork/"


@pytest.mark.django_db
def test_requires_authentication(anon_client, owner):
    source = _make_public_project(owner)

    response = anon_client.post(_fork_url(source))

    assert response.status_code == 401
    assert Project.objects.filter(owner=owner).count() == 1  # only the source
    assert ForkProvenance.objects.count() == 0


@pytest.mark.django_db
def test_forking_a_private_project_404s(visitor_client, owner):
    source = Project.objects.create(owner=owner, visibility=Project.Visibility.PRIVATE)
    SceneVersion.objects.create(
        project=source, sequence=1, scene_json=BLANK_SCENE, origin=SceneVersion.Origin.MANUAL
    )

    response = visitor_client.post(_fork_url(source))

    assert response.status_code == 404
    assert ForkProvenance.objects.count() == 0


@pytest.mark.django_db
def test_forking_a_remix_disabled_project_404s(visitor_client, owner):
    source = _make_public_project(owner, allow_public_remix=False)

    response = visitor_client.post(_fork_url(source))

    assert response.status_code == 404
    assert ForkProvenance.objects.count() == 0


@pytest.mark.django_db
def test_missing_project_404s(visitor_client):
    response = visitor_client.post(
        "/api/public/projects/00000000-0000-0000-0000-000000000000/fork/"
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_successful_fork_creates_private_project_version_and_provenance(visitor_client, owner):
    source = _make_public_project(owner)

    response = visitor_client.post(_fork_url(source))

    assert response.status_code == 201
    body = response.json()
    assert body["visibility"] == "private"
    assert body["owner"] == "bob"

    forked = Project.objects.get(public_id=body["id"])
    assert forked.owner_id != source.owner_id
    versions = SceneVersion.objects.filter(project=forked)
    assert versions.count() == 1
    version = versions.get()
    assert version.origin == SceneVersion.Origin.FORK
    assert version.fork_source_version_id == source.current_version_id
    assert forked.current_version_id == version.id

    provenance = ForkProvenance.objects.get(project=forked)
    assert provenance.source_project_id == source.id
    assert provenance.source_version_id == source.current_version_id


@pytest.mark.django_db
def test_fork_scene_is_an_independent_copy(visitor_client, owner):
    source = _make_public_project(owner)
    original_scene_id = source.current_version.scene_json["id"]

    response = visitor_client.post(_fork_url(source))
    forked = Project.objects.get(public_id=response.json()["id"])
    fork_version = SceneVersion.objects.get(project=forked)

    # A fresh scene id was assigned — never the source's own id.
    assert fork_version.scene_json["id"] != original_scene_id

    # Mutating the fork's in-memory scene (simulating an edit) must never
    # reach the source's stored snapshot -- no shared list/dict reference.
    fork_version.scene_json["shapes"].append({"marker": "edited-fork"})
    source.current_version.refresh_from_db()
    assert source.current_version.scene_json["shapes"] == []

    # Saving a brand-new version on the fork (a real edit) never touches
    # the source project's current_version or its own version history.
    new_scene = copy.deepcopy(fork_version.scene_json)
    SceneVersion.objects.create(
        project=forked,
        sequence=2,
        scene_json=new_scene,
        origin=SceneVersion.Origin.MANUAL,
    )
    source.refresh_from_db()
    assert source.current_version.sequence == 1
    assert SceneVersion.objects.filter(project=source).count() == 1


@pytest.mark.django_db
def test_provenance_survives_source_edits_unpublish_and_delete(visitor_client, owner, owner_client):
    source = _make_public_project(owner)
    fork_response = visitor_client.post(_fork_url(source))
    forked = Project.objects.get(public_id=fork_response.json()["id"])
    original_source_version_id = source.current_version_id

    # The source saves a new version.
    new_scene = copy.deepcopy(BLANK_SCENE)
    owner_client.post(
        f"/api/projects/{source.public_id}/versions/",
        {"scene_json": new_scene, "origin": "manual"},
        format="json",
    )

    provenance = ForkProvenance.objects.get(project=forked)
    assert provenance.source_version_id == original_source_version_id

    # The source is unpublished.
    owner_client.post(f"/api/projects/{source.public_id}/unpublish/")
    provenance.refresh_from_db()
    assert provenance.source_project_id == source.id
    assert provenance.source_version_id == original_source_version_id

    # The source is (soft-)deleted.
    owner_client.delete(f"/api/projects/{source.public_id}/")
    provenance.refresh_from_db()
    assert provenance.source_project_id == source.id
    assert provenance.source_version_id == original_source_version_id


@pytest.mark.django_db
def test_repeated_submission_with_same_request_id_is_idempotent(visitor_client, owner):
    source = _make_public_project(owner)
    request_id = str(uuid.uuid4())

    first = visitor_client.post(_fork_url(source), {"client_request_id": request_id})
    second = visitor_client.post(_fork_url(source), {"client_request_id": request_id})

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert Project.objects.filter(owner__username="bob").count() == 1
    assert ForkProvenance.objects.count() == 1


@pytest.mark.django_db
def test_different_request_ids_create_separate_forks(visitor_client, owner):
    source = _make_public_project(owner)

    first = visitor_client.post(_fork_url(source), {"client_request_id": str(uuid.uuid4())})
    second = visitor_client.post(_fork_url(source), {"client_request_id": str(uuid.uuid4())})

    assert first.status_code == second.status_code == 201
    assert first.json()["id"] != second.json()["id"]
    assert Project.objects.filter(owner__username="bob").count() == 2


@pytest.mark.django_db
def test_omitting_request_id_never_deduplicates(visitor_client, owner):
    source = _make_public_project(owner)

    first = visitor_client.post(_fork_url(source))
    second = visitor_client.post(_fork_url(source))

    assert first.status_code == second.status_code == 201
    assert first.json()["id"] != second.json()["id"]


@pytest.mark.django_db
def test_malformed_request_id_is_rejected(visitor_client, owner):
    source = _make_public_project(owner)

    response = visitor_client.post(_fork_url(source), {"client_request_id": "not-a-uuid"})

    assert response.status_code == 400
    assert Project.objects.filter(owner__username="bob").count() == 0


# --- PostgreSQL-only: rollback and genuine concurrent duplicate submission ---

pytestmark_postgres = pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping PostgreSQL-backed tests.",
)


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"])
def test_postgres_rollback_on_injected_failure_leaves_no_records(django_db_blocker):
    """A failure partway through the fork transaction (after the new project
    row has already been created in-transaction) must roll back the project,
    version, and provenance together -- no partial fork survives.
    """
    with django_db_blocker.unblock():
        from django.db import transaction as txn

        owner = get_user_model().objects.using("postgres_test").create_user(username="fork-owner")
        visitor = (
            get_user_model().objects.using("postgres_test").create_user(username="fork-visitor")
        )
        source = Project.objects.using("postgres_test").create(
            owner=owner,
            visibility=Project.Visibility.PUBLIC,
            allow_public_remix=True,
        )
        source_version = SceneVersion.objects.using("postgres_test").create(
            project=source, sequence=1, scene_json=BLANK_SCENE, origin=SceneVersion.Origin.MANUAL
        )
        source.current_version = source_version
        source.save(using="postgres_test", update_fields=["current_version"])

        class InjectedFailure(Exception):
            pass

        with pytest.raises(InjectedFailure):
            with txn.atomic(using="postgres_test"):
                forked = Project.objects.using("postgres_test").create(
                    owner=visitor, visibility=Project.Visibility.PRIVATE
                )
                SceneVersion.objects.using("postgres_test").create(
                    project=forked,
                    sequence=1,
                    scene_json=copy.deepcopy(BLANK_SCENE),
                    origin=SceneVersion.Origin.FORK,
                    fork_source_version=source_version,
                )
                raise InjectedFailure("simulated failure before ForkProvenance is created")

        assert Project.objects.using("postgres_test").filter(owner=visitor).count() == 0
        assert (
            SceneVersion.objects.using("postgres_test").filter(project__owner=visitor).count() == 0
        )
        assert ForkProvenance.objects.using("postgres_test").count() == 0
        # The source project/version are completely untouched.
        source.refresh_from_db(using="postgres_test")
        assert source.current_version_id == source_version.id


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"], transaction=True)
def test_postgres_concurrent_duplicate_fork_submission_creates_exactly_one_fork(
    django_db_blocker,
):
    """Two genuinely overlapping fork requests carrying the same
    client_request_id (a double-click on the Fork button) must never create
    two forks: whichever transaction commits first wins the unique
    (owner, creation_request_id) index; the other resolves to the same
    forked project instead of creating a duplicate.
    """
    with django_db_blocker.unblock():
        User = get_user_model()
        owner = User.objects.using("postgres_test").create_user(username="pg-fork-owner")
        visitor = User.objects.using("postgres_test").create_user(username="pg-fork-visitor")
        source = Project.objects.using("postgres_test").create(
            owner=owner,
            visibility=Project.Visibility.PUBLIC,
            allow_public_remix=True,
        )
        source_version = SceneVersion.objects.using("postgres_test").create(
            project=source, sequence=1, scene_json=BLANK_SCENE, origin=SceneVersion.Origin.MANUAL
        )
        source.current_version = source_version
        source.save(using="postgres_test", update_fields=["current_version"])

        request_id = uuid.uuid4()
        client = APIClient()
        client.force_authenticate(visitor)

        results = []
        barrier = threading.Barrier(2)

        def do_fork():
            barrier.wait()
            try:
                response = client.post(
                    f"/api/public/projects/{source.public_id}/fork/",
                    {"client_request_id": str(request_id)},
                )
                results.append((response.status_code, response.json().get("id")))
            finally:
                connections["postgres_test"].close()

        threads = [threading.Thread(target=do_fork) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert sorted(status for status, _ in results) == [200, 201]
        fork_ids = {fork_id for _, fork_id in results}
        assert len(fork_ids) == 1

        forked_projects = Project.objects.using("postgres_test").filter(owner=visitor)
        assert forked_projects.count() == 1
        forked = forked_projects.get()
        assert SceneVersion.objects.using("postgres_test").filter(project=forked).count() == 1
        assert ForkProvenance.objects.using("postgres_test").filter(project=forked).count() == 1


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"], transaction=True)
def test_postgres_concurrent_forks_without_request_id_both_succeed_independently(
    django_db_blocker,
):
    """Two overlapping fork requests with no client_request_id are
    legitimately independent forks -- both may succeed, and each gets its
    own project/version/provenance triple with no cross-contamination.
    """
    with django_db_blocker.unblock():
        User = get_user_model()
        owner = User.objects.using("postgres_test").create_user(username="pg-fork-owner-2")
        visitor = User.objects.using("postgres_test").create_user(username="pg-fork-visitor-2")
        source = Project.objects.using("postgres_test").create(
            owner=owner,
            visibility=Project.Visibility.PUBLIC,
            allow_public_remix=True,
        )
        source_version = SceneVersion.objects.using("postgres_test").create(
            project=source, sequence=1, scene_json=BLANK_SCENE, origin=SceneVersion.Origin.MANUAL
        )
        source.current_version = source_version
        source.save(using="postgres_test", update_fields=["current_version"])

        client = APIClient()
        client.force_authenticate(visitor)

        results = []
        barrier = threading.Barrier(2)

        def do_fork():
            barrier.wait()
            try:
                response = client.post(f"/api/public/projects/{source.public_id}/fork/")
                results.append(response.status_code)
            finally:
                connections["postgres_test"].close()

        threads = [threading.Thread(target=do_fork) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert results == [201, 201]
        assert Project.objects.using("postgres_test").filter(owner=visitor).count() == 2
        assert (
            ForkProvenance.objects.using("postgres_test").filter(source_project=source).count() == 2
        )
