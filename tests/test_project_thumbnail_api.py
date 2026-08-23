"""Task 54: thumbnail generation triggers, content-source boundaries, and
the public thumbnail-serving endpoint.

These tests use `@pytest.mark.django_db(transaction=True)` (on the
default SQLite test database, not `postgres_test`) rather than the plain
`django_db` marker used elsewhere in this project: thumbnail generation is
scheduled with `transaction.on_commit(...)`
(`scenes/thumbnail_generation.py`), which Django only ever actually runs
once the enclosing transaction *really* commits. The plain `django_db`
fixture wraps each test in an outer transaction that's rolled back at
teardown, so a nested `atomic()` block's `on_commit` hooks registered
during the test would never fire and every assertion below would see no
`Thumbnail` row at all -- `transaction=True` makes the view's
`transaction.atomic()` block commit for real, exactly like it would
against a live server.
"""

import copy
import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.models import Project, SceneVersion, Thumbnail

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
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def publishable_project(owner):
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


def _versions_url(project):
    return f"/api/projects/{project.public_id}/versions/"


def _public_url(project):
    return f"/api/public/projects/{project.public_id}/"


def _thumbnail_url(project):
    return f"/api/public/projects/{project.public_id}/thumbnail.png"


def _owner_thumbnail_url(project):
    return f"/api/projects/{project.public_id}/thumbnail.png"


def _project_detail_url(project):
    return f"/api/projects/{project.public_id}/"


# --- Regeneration/invalidation policy ---


@pytest.mark.django_db(transaction=True)
def test_publishing_schedules_thumbnail_generation_for_the_current_version(
    owner_client, publishable_project
):
    assert not Thumbnail.objects.filter(scene_version=publishable_project.current_version).exists()

    response = owner_client.post(_publish_url(publishable_project))
    assert response.status_code == 200

    thumbnail = Thumbnail.objects.get(scene_version=publishable_project.current_version)
    assert thumbnail.is_fallback is False
    assert thumbnail.width == 320
    assert thumbnail.height == 240


@pytest.mark.django_db(transaction=True)
def test_saving_a_new_version_on_a_public_project_updates_the_thumbnail_to_follow_it(
    owner_client, publishable_project
):
    """Documented policy: the thumbnail follows `current_version`, matching
    Task 49's own "resolve current_version fresh" philosophy -- a public
    project's thumbnail is *not* pinned to whatever version was current at
    publish time."""
    owner_client.post(_publish_url(publishable_project))
    first_version = publishable_project.current_version
    Thumbnail.objects.get(scene_version=first_version)  # generated at publish

    new_scene = copy.deepcopy(FEATURE_RICH_SCENE)
    save_response = owner_client.post(
        _versions_url(publishable_project),
        {"scene_json": new_scene, "origin": "manual", "change_label": "v2"},
        format="json",
    )
    assert save_response.status_code == 201
    second_version_id = save_response.json()["id"]

    # A thumbnail now exists for the *new* current version too, distinct
    # from the version-1 thumbnail (which is retained, not deleted).
    second_thumbnail = Thumbnail.objects.get(scene_version_id=second_version_id)
    assert second_thumbnail.is_fallback is False
    assert Thumbnail.objects.filter(scene_version=first_version).exists()

    # The public thumbnail endpoint now serves the new version's render,
    # not the stale version-1 one.
    published_thumb_response = APIClient().get(_thumbnail_url(publishable_project))
    assert published_thumb_response.status_code == 200
    assert published_thumb_response.content == bytes(second_thumbnail.image_data)


@pytest.mark.django_db(transaction=True)
def test_saving_a_new_version_on_a_private_project_never_generates_a_thumbnail(owner_client, owner):
    project = Project.objects.create(owner=owner, title="Still private", description="x")
    version = SceneVersion.objects.create(
        project=project, sequence=1, scene_json=BLANK_SCENE, created_by=owner, origin="manual"
    )
    project.current_version = version
    project.save(update_fields=["current_version"])

    response = owner_client.post(
        _versions_url(project),
        {"scene_json": FEATURE_RICH_SCENE, "origin": "manual", "change_label": "v2"},
        format="json",
    )
    assert response.status_code == 201

    assert Thumbnail.objects.filter(scene_version__project=project).count() == 0


@pytest.mark.django_db(transaction=True)
def test_unpublishing_retains_the_existing_thumbnail_row(owner_client, publishable_project):
    owner_client.post(_publish_url(publishable_project))
    thumbnail = Thumbnail.objects.get(scene_version=publishable_project.current_version)

    unpublish_response = owner_client.post(
        f"/api/projects/{publishable_project.public_id}/unpublish/"
    )
    assert unpublish_response.status_code == 200

    # Row is retained (cheap to keep, instant to republish) even though it
    # is no longer publicly servable -- see the next test.
    assert Thumbnail.objects.filter(pk=thumbnail.pk).exists()


# --- Content-source boundary (acceptance criterion: "never generated via
# a public-facing trigger, or if generated, never served publicly") ---


@pytest.mark.django_db(transaction=True)
def test_private_project_thumbnail_endpoint_404s(owner_client, anon_client, owner):
    project = Project.objects.create(owner=owner, title="Private work", description="x")
    version = SceneVersion.objects.create(
        project=project, sequence=1, scene_json=BLANK_SCENE, created_by=owner, origin="manual"
    )
    project.current_version = version
    project.save(update_fields=["current_version"])

    # No public-facing trigger has ever touched this project (it was never
    # published), so no Thumbnail row exists for it at all.
    assert not Thumbnail.objects.filter(scene_version=version).exists()

    response = anon_client.get(_thumbnail_url(project))
    assert response.status_code == 404

    # And even the owner can't reach it through the public route (same
    # absolute gating convention as PublicProjectDetailView).
    owner_response = owner_client.get(_thumbnail_url(project))
    assert owner_response.status_code == 404

    # Still never generated, even after two failed attempts to read it.
    assert not Thumbnail.objects.filter(scene_version=version).exists()


@pytest.mark.django_db(transaction=True)
def test_unpublished_project_thumbnail_endpoint_404s_even_though_a_row_exists(
    owner_client, anon_client, publishable_project
):
    owner_client.post(_publish_url(publishable_project))
    assert Thumbnail.objects.filter(scene_version=publishable_project.current_version).exists()

    owner_client.post(f"/api/projects/{publishable_project.public_id}/unpublish/")

    response = anon_client.get(_thumbnail_url(publishable_project))
    assert response.status_code == 404


@pytest.mark.django_db(transaction=True)
def test_public_thumbnail_endpoint_lazily_generates_when_missing(
    anon_client, owner, publishable_project
):
    """Publish directly at the model layer (bypassing the API's own
    post-commit scheduling) to simulate "a public project whose current
    version has no cached Thumbnail yet" -- the serving endpoint must
    still return a real image rather than 404ing."""
    publishable_project.visibility = Project.Visibility.PUBLIC
    publishable_project.save(update_fields=["visibility"])
    assert not Thumbnail.objects.filter(scene_version=publishable_project.current_version).exists()

    response = anon_client.get(_thumbnail_url(publishable_project))

    assert response.status_code == 200
    assert response["Content-Type"] == "image/png"
    assert Thumbnail.objects.filter(scene_version=publishable_project.current_version).exists()


@pytest.mark.django_db(transaction=True)
def test_public_project_serializer_exposes_a_resolvable_thumbnail_url(
    owner_client, anon_client, publishable_project
):
    owner_client.post(_publish_url(publishable_project))

    response = anon_client.get(_public_url(publishable_project))
    assert response.status_code == 200
    thumbnail_url = response.json()["thumbnail_url"]
    assert thumbnail_url is not None

    image_response = anon_client.get(thumbnail_url)
    assert image_response.status_code == 200
    assert image_response["Content-Type"] == "image/png"


# --- Owner-facing thumbnail endpoint (issue #135, "Your projects" cards) ---


@pytest.mark.django_db(transaction=True)
def test_owner_project_serializer_exposes_a_resolvable_thumbnail_url_even_when_private(
    owner_client, publishable_project
):
    # Never published: still private, but the owner's own project list must
    # still resolve a thumbnail_url for it.
    response = owner_client.get(_project_detail_url(publishable_project))
    assert response.status_code == 200
    thumbnail_url = response.json()["thumbnail_url"]
    assert thumbnail_url is not None

    image_response = owner_client.get(thumbnail_url)
    assert image_response.status_code == 200
    assert image_response["Content-Type"] == "image/png"


@pytest.mark.django_db(transaction=True)
def test_owner_thumbnail_endpoint_404s_for_a_project_with_no_current_version(owner_client, owner):
    project = Project.objects.create(owner=owner, title="No version yet", description="")
    response = owner_client.get(_owner_thumbnail_url(project))
    assert response.status_code == 404


@pytest.mark.django_db(transaction=True)
def test_owner_thumbnail_endpoint_404s_for_a_non_owner_and_anonymous_caller(
    anon_client, publishable_project
):
    other = get_user_model().objects.create_user(username="mallory")
    other_client = APIClient()
    other_client.force_authenticate(other)

    other_response = other_client.get(_owner_thumbnail_url(publishable_project))
    assert other_response.status_code == 404

    anon_response = anon_client.get(_owner_thumbnail_url(publishable_project))
    assert anon_response.status_code == 404
