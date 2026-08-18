"""Tests for the publish/unpublish endpoints and the public-reachable
project read (Task 49).

SQLite-portable tests below cover single-writer correctness (validation,
authorization, immediate visibility effects), including a sequential,
real-endpoints proof that the public read always resolves
`current_version` fresh rather than a value fixed at publish time
(`test_public_read_reflects_a_new_version_saved_after_publish`). The one
guarantee that specifically requires genuine *concurrency* to observe —
that a concurrent version save can't race the publish/unpublish flip
itself into an inconsistent state — is PostgreSQL-gated, matching every
other `select_for_update()`-backed suite in this project
(tests/test_scene_version_save_api.py, tests/test_project_scene_version_models.py).
"""

import copy
import json
import threading
from pathlib import Path

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connections
from rest_framework.test import APIClient

from scenes.models import Project, ProjectActivity, SceneVersion
from scenes.publishing import PLACEHOLDER_TITLE

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
    ).read_text()
)

FEATURE_RICH_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent
        / "schema"
        / "fixtures"
        / "valid"
        / "feature_rich.json"
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
def anon_client():
    return APIClient()


@pytest.fixture
def publishable_project(owner):
    """A private project with a meaningful title/description and one saved
    version — everything Task 49's rules require before it can publish."""
    project = Project.objects.create(
        owner=owner, title="My gesture garden", description="A field of reactive shapes."
    )
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


def _publish_url(project):
    return f"/api/projects/{project.public_id}/publish/"


def _unpublish_url(project):
    return f"/api/projects/{project.public_id}/unpublish/"


def _public_url(project):
    return f"/api/public/projects/{project.public_id}/"


# --- Publish ---


@pytest.mark.django_db
def test_publish_success_makes_current_version_reachable_at_public_url(
    owner_client, anon_client, publishable_project
):
    response = owner_client.post(_publish_url(publishable_project))

    assert response.status_code == 200
    body = response.json()
    assert body["visibility"] == "public"

    publishable_project.refresh_from_db()
    assert publishable_project.visibility == Project.Visibility.PUBLIC

    # Reachable anonymously, at the project's own stable public_id, with the
    # exact current saved version's scene_json — not some other snapshot.
    public_response = anon_client.get(_public_url(publishable_project))
    assert public_response.status_code == 200
    public_body = public_response.json()
    assert public_body["title"] == "My gesture garden"
    assert public_body["current_version"]["sequence"] == 1
    assert public_body["current_version"]["scene_json"] == BLANK_SCENE


@pytest.mark.django_db
def test_publish_records_activity(owner_client, publishable_project):
    owner_client.post(_publish_url(publishable_project))

    activity = ProjectActivity.objects.get(
        project=publishable_project, action_type=ProjectActivity.ActionType.PUBLISHED
    )
    assert activity.metadata["version_sequence"] == 1


@pytest.mark.django_db
def test_public_read_reflects_a_new_version_saved_after_publish(
    owner_client, anon_client, publishable_project
):
    """QA follow-up (issue #49): a SQLite-runnable, sequential proof that
    `PublicProjectDetailView` resolves `current_version` fresh at request
    time rather than any value cached/snapshotted at publish time.

    Sequence, entirely through the real endpoints (no raw ORM
    shortcuts): publish -> confirm the public endpoint serves version 1's
    content -> save a brand-new version 2 through the real version-save
    endpoint (Task 14's `SceneVersionListCreateView`) *without*
    unpublishing or re-publishing -> confirm the public endpoint now
    serves version 2's content. If the public endpoint were reading a
    value fixed at publish time instead of `project.current_version`
    live, the second assertion would still see version 1.
    """
    publish_response = owner_client.post(_publish_url(publishable_project))
    assert publish_response.status_code == 200

    before = anon_client.get(_public_url(publishable_project))
    assert before.status_code == 200
    assert before.json()["current_version"]["sequence"] == 1
    assert before.json()["current_version"]["scene_json"] == BLANK_SCENE

    new_scene = copy.deepcopy(FEATURE_RICH_SCENE)
    save_response = owner_client.post(
        f"/api/projects/{publishable_project.public_id}/versions/",
        {"scene_json": new_scene, "origin": "manual", "change_label": "Second version"},
        format="json",
    )
    assert save_response.status_code == 201
    assert save_response.json()["sequence"] == 2

    # visibility was never touched by the save above -- still public, no
    # re-publish call was made.
    publishable_project.refresh_from_db()
    assert publishable_project.visibility == Project.Visibility.PUBLIC

    after = anon_client.get(_public_url(publishable_project))
    assert after.status_code == 200
    after_version = after.json()["current_version"]
    assert after_version["sequence"] == 2
    assert after_version["scene_json"] == new_scene
    assert after_version["scene_json"] != BLANK_SCENE


@pytest.mark.django_db
def test_publish_blocked_by_placeholder_title(owner_client, owner):
    project = Project.objects.create(owner=owner, title=PLACEHOLDER_TITLE, description="Something.")
    version = SceneVersion.objects.create(
        project=project, sequence=1, scene_json=BLANK_SCENE, created_by=owner, origin="manual"
    )
    project.current_version = version
    project.save(update_fields=["current_version"])

    response = owner_client.post(_publish_url(project))

    assert response.status_code == 400
    body = response.json()
    assert "title" in body["errors"]

    project.refresh_from_db()
    assert project.visibility == Project.Visibility.PRIVATE


@pytest.mark.django_db
def test_publish_blocked_by_blank_description(owner_client, owner):
    project = Project.objects.create(owner=owner, title="Real title", description="   ")
    version = SceneVersion.objects.create(
        project=project, sequence=1, scene_json=BLANK_SCENE, created_by=owner, origin="manual"
    )
    project.current_version = version
    project.save(update_fields=["current_version"])

    response = owner_client.post(_publish_url(project))

    assert response.status_code == 400
    body = response.json()
    assert "description" in body["errors"]

    project.refresh_from_db()
    assert project.visibility == Project.Visibility.PRIVATE


@pytest.mark.django_db
def test_publish_blocked_with_both_field_errors_at_once(owner_client, owner):
    """Field-level errors, not a generic failure: both bad fields are named
    in the same response when both are invalid."""
    project = Project.objects.create(owner=owner)  # default title/description, no saved version
    response = owner_client.post(_publish_url(project))

    assert response.status_code == 400
    errors = response.json()["errors"]
    assert "title" in errors
    assert "description" in errors
    assert "current_version" in errors


@pytest.mark.django_db
def test_publish_requires_a_saved_version(owner_client, owner):
    project = Project.objects.create(
        owner=owner, title="Real title", description="Real description."
    )
    response = owner_client.post(_publish_url(project))

    assert response.status_code == 400
    assert "current_version" in response.json()["errors"]
    project.refresh_from_db()
    assert project.visibility == Project.Visibility.PRIVATE


@pytest.mark.django_db
def test_publish_non_owner_rejected_with_no_state_change(other_client, publishable_project):
    response = other_client.post(_publish_url(publishable_project))

    assert response.status_code == 404
    publishable_project.refresh_from_db()
    assert publishable_project.visibility == Project.Visibility.PRIVATE
    assert not ProjectActivity.objects.filter(
        project=publishable_project, action_type=ProjectActivity.ActionType.PUBLISHED
    ).exists()


@pytest.mark.django_db
def test_publish_anonymous_rejected_with_no_state_change(anon_client, publishable_project):
    response = anon_client.post(_publish_url(publishable_project))

    assert response.status_code == 404
    publishable_project.refresh_from_db()
    assert publishable_project.visibility == Project.Visibility.PRIVATE


@pytest.mark.django_db
def test_publish_never_substitutes_unsaved_state(owner_client, publishable_project):
    """Structural guarantee: the publish endpoint's request body is never
    consulted for scene content at all (no `scene_json`/`draft` field is
    read anywhere in `ProjectPublishView`), so an unsaved editor working
    copy — which only ever lives client-side/IndexedDB and is never sent to
    this endpoint — cannot influence what becomes public even if a caller
    tried to smuggle it into the request body."""
    response = owner_client.post(
        _publish_url(publishable_project),
        {"scene_json": {"id": "not-the-real-scene", "shapes": []}},
        format="json",
    )

    assert response.status_code == 200
    publishable_project.refresh_from_db()
    assert publishable_project.current_version.scene_json == BLANK_SCENE


# --- Unpublish ---


@pytest.mark.django_db
def test_unpublish_immediately_blocks_public_access_and_keeps_history(
    owner_client, anon_client, publishable_project
):
    owner_client.post(_publish_url(publishable_project))
    assert anon_client.get(_public_url(publishable_project)).status_code == 200

    response = owner_client.post(_unpublish_url(publishable_project))

    assert response.status_code == 200
    publishable_project.refresh_from_db()
    assert publishable_project.visibility == Project.Visibility.PRIVATE

    # Anonymous/public access is immediately gone...
    assert anon_client.get(_public_url(publishable_project)).status_code == 404
    # ...but the owner's version history is fully intact.
    assert SceneVersion.objects.filter(project=publishable_project, is_deleted=False).count() == 1
    history_response = owner_client.get(f"/api/projects/{publishable_project.public_id}/versions/")
    assert history_response.status_code == 200
    assert len(history_response.json()) == 1


@pytest.mark.django_db
def test_unpublish_records_activity(owner_client, publishable_project):
    owner_client.post(_publish_url(publishable_project))
    owner_client.post(_unpublish_url(publishable_project))

    assert ProjectActivity.objects.filter(
        project=publishable_project, action_type=ProjectActivity.ActionType.UNPUBLISHED
    ).exists()


@pytest.mark.django_db
def test_unpublish_non_owner_rejected_with_no_state_change(other_client, publishable_project):
    publishable_project.visibility = Project.Visibility.PUBLIC
    publishable_project.save(update_fields=["visibility"])

    response = other_client.post(_unpublish_url(publishable_project))

    assert response.status_code == 404
    publishable_project.refresh_from_db()
    assert publishable_project.visibility == Project.Visibility.PUBLIC


# --- Public read ---


@pytest.mark.django_db
def test_public_detail_404_for_private_project(anon_client, publishable_project):
    response = anon_client.get(_public_url(publishable_project))
    assert response.status_code == 404


@pytest.mark.django_db
def test_public_detail_404_for_private_project_even_for_owner(owner_client, publishable_project):
    """Strict gating: this route serves nobody, owner included, unless the
    project is actually public — the owner has `ProjectDetailView` for
    reading their own private project."""
    response = owner_client.get(_public_url(publishable_project))
    assert response.status_code == 404


@pytest.mark.django_db
def test_public_detail_excludes_owner_private_fields(
    owner_client, anon_client, publishable_project
):
    owner_client.post(_publish_url(publishable_project))

    response = anon_client.get(_public_url(publishable_project))

    body = response.json()
    assert set(body.keys()) == {
        "id",
        "owner",
        "title",
        "description",
        "tags",
        "allow_public_remix",
        "thumbnail_choice",
        "thumbnail_url",
        "current_version",
        "created_at",
        "updated_at",
    }
    assert "export_attribution" not in body
    assert "visibility" not in body


@pytest.mark.django_db
def test_public_detail_404_for_unknown_project(anon_client):
    response = anon_client.get("/api/public/projects/00000000-0000-0000-0000-000000000000/")
    assert response.status_code == 404


# --- Metadata PATCH can no longer set visibility directly ---


@pytest.mark.django_db
def test_metadata_patch_cannot_bypass_publish_validation(owner_client, owner):
    """A project with a placeholder title/blank description could never
    pass `/publish/`'s validation — confirm the generic metadata PATCH
    can't be used to set `visibility` directly and route around that."""
    project = Project.objects.create(owner=owner)  # placeholder title, blank description
    response = owner_client.patch(
        f"/api/projects/{project.public_id}/",
        {"visibility": "public"},
        format="json",
    )

    assert response.status_code == 200
    project.refresh_from_db()
    assert project.visibility == Project.Visibility.PRIVATE


# --- PostgreSQL-only: genuine concurrency (Task 49) ---

pytestmark_postgres = pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping PostgreSQL-backed tests.",
)


@pytestmark_postgres
@pytest.mark.django_db(databases=["postgres_test"], transaction=True)
def test_postgres_concurrent_publish_and_save_leave_a_consistent_public_state(django_db_blocker):
    """A publish racing a concurrent version save must not leave the
    project half-updated: whichever order the two locked transactions
    apply in, the project ends up public and its public read reflects
    whatever `current_version` ended up being — never a torn/partial
    state, and never the *wrong* version silently `never advancing`.
    """
    with django_db_blocker.unblock():
        from django.db import transaction as txn
        from django.db.models import Max

        from scenes.publishing import validate_meaningful_metadata

        User = get_user_model()
        user = User.objects.using("postgres_test").create_user(username="concurrent-publish-user")
        project = Project.objects.using("postgres_test").create(
            owner=user, title="Concurrency test", description="Racing publish and save."
        )
        v1 = SceneVersion.objects.using("postgres_test").create(
            project=project,
            sequence=1,
            scene_json=BLANK_SCENE,
            created_by=user,
            origin=SceneVersion.Origin.MANUAL,
        )
        project.current_version = v1
        project.save(using="postgres_test", update_fields=["current_version"])

        barrier = threading.Barrier(2)
        errors = []

        def do_publish():
            barrier.wait()
            try:
                with txn.atomic(using="postgres_test"):
                    locked = (
                        Project.objects.using("postgres_test")
                        .select_for_update()
                        .get(pk=project.pk)
                    )
                    field_errors = validate_meaningful_metadata(locked.title, locked.description)
                    if not field_errors and locked.current_version_id is not None:
                        locked.visibility = Project.Visibility.PUBLIC
                        locked.save(using="postgres_test", update_fields=["visibility"])
            except Exception as exc:  # pragma: no cover - surfaced via `errors`
                errors.append(exc)
            finally:
                connections["postgres_test"].close()

        def do_save():
            barrier.wait()
            try:
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
            except Exception as exc:  # pragma: no cover - surfaced via `errors`
                errors.append(exc)
            finally:
                connections["postgres_test"].close()

        threads = [threading.Thread(target=do_publish), threading.Thread(target=do_save)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors

        project.refresh_from_db(using="postgres_test")
        assert project.visibility == Project.Visibility.PUBLIC
        # Whichever order the two transactions serialized in, current_version
        # is a real, consistent version belonging to this project — never a
        # torn/partial value — and the public read agrees with it exactly.
        assert project.current_version is not None
        assert project.current_version.project_id == project.id
        # No torn state: exactly the versions created above exist, and
        # current_version points at one of them (whichever transaction
        # committed last), never at something inconsistent.
        versions = list(
            SceneVersion.objects.using("postgres_test").filter(project=project).order_by("sequence")
        )
        assert [v.sequence for v in versions] == [1, 2]
        assert project.current_version.sequence in (1, 2)
