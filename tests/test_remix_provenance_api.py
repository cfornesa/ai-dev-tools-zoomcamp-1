"""Task 53 (issue #52): "Remixed from [creator]" provenance display in the
public gallery list (`PublicProjectListItemSerializer`) and public project
detail (`PublicProjectSerializer`) API responses.

Covers the acceptance criteria directly:

- A genuine fork shows real provenance (creator + link) in both the
  gallery list and the detail endpoint.
- Provenance persists with safe, non-leaking display once the source
  becomes private, is unpublished, or is soft-deleted -- durable creator
  text, but never a link and never other private source data.
- A nested remix chain (C forked from B forked from A) reports the
  *immediate* source (B), never the root (A) -- the documented policy in
  `scenes/serializers.py`'s `remix_provenance_data`.
- A project with no `ForkProvenance` row has `remix_provenance: null`,
  never an empty object or partial data.

Most fixtures build `ForkProvenance` rows directly at the model layer
(same pattern as `tests/test_template_fork_provenance_models.py`) so each
test can control source availability precisely; one test exercises the
real `ProjectForkView` end-to-end to confirm the live API wiring.
"""

import copy
import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.models import ForkProvenance, Project, SceneVersion

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid" / "blank.json"
    ).read_text()
)

GALLERY_URL = "/api/public/projects/"


@pytest.fixture
def alice(db):
    return get_user_model().objects.create_user(username="alice")


@pytest.fixture
def bob(db):
    return get_user_model().objects.create_user(username="bob")


@pytest.fixture
def carol(db):
    return get_user_model().objects.create_user(username="carol")


@pytest.fixture
def anon_client():
    return APIClient()


def _make_project(owner_user, *, title="Untitled animation", public=False, published=True):
    project = Project.objects.create(owner=owner_user, title=title)
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=copy.deepcopy(BLANK_SCENE),
        created_by=owner_user,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = version
    if public:
        project.visibility = Project.Visibility.PUBLIC
        if published:
            from django.utils import timezone

            project.published_at = timezone.now()
    project.save()
    return project


def _fork(source, forker_user, *, title="Forked project", public=True):
    """Build a fork of `source` at the model layer -- same shape
    `ProjectForkView` produces, without going through the endpoint, so
    each test can control the fork's own public/private state precisely."""
    forked = _make_project(forker_user, title=title, public=public)
    ForkProvenance.objects.create(
        project=forked,
        source_project=source,
        source_version=source.current_version,
    )
    return forked


def _detail_url(project):
    return f"/api/public/projects/{project.public_id}/"


def _gallery_item(client, project):
    body = client.get(GALLERY_URL).json()
    matches = [item for item in body["results"] if item["id"] == str(project.public_id)]
    assert len(matches) == 1, f"expected exactly one gallery item for {project.public_id}"
    return matches[0]


# --- Non-remix: no provenance at all ---


@pytest.mark.django_db
def test_original_project_has_null_provenance_in_gallery_and_detail(anon_client, alice):
    original = _make_project(alice, title="An original piece", public=True)

    gallery_item = _gallery_item(anon_client, original)
    assert gallery_item["remix_provenance"] is None

    detail_body = anon_client.get(_detail_url(original)).json()
    assert "remix_provenance" in detail_body
    assert detail_body["remix_provenance"] is None


# --- Genuine fork: real provenance with a working link ---


@pytest.mark.django_db
def test_fork_shows_creator_and_link_when_source_is_public(anon_client, alice, bob):
    source = _make_project(alice, title="Hand Follower", public=True)
    fork = _fork(source, bob, title="My remix", public=True)

    gallery_item = _gallery_item(anon_client, fork)
    assert gallery_item["remix_provenance"] == {
        "source_creator": "alice",
        "source_public_id": str(source.public_id),
    }

    detail_body = anon_client.get(_detail_url(fork)).json()
    assert detail_body["remix_provenance"] == {
        "source_creator": "alice",
        "source_public_id": str(source.public_id),
    }


@pytest.mark.django_db
def test_end_to_end_fork_endpoint_populates_provenance(alice, bob):
    owner_client = APIClient()
    owner_client.force_authenticate(alice)
    visitor_client = APIClient()
    visitor_client.force_authenticate(bob)
    anon_client = APIClient()

    source = _make_project(alice, title="Pinch Particle Burst", public=True)

    fork_response = visitor_client.post(f"/api/public/projects/{source.public_id}/fork/")
    assert fork_response.status_code == 201
    forked_id = fork_response.json()["id"]

    # Give the fork a meaningful title/description so it can publish.
    visitor_client.patch(
        f"/api/projects/{forked_id}/",
        {"description": "Bob's remix of Pinch Particle Burst."},
        format="json",
    )
    publish_response = visitor_client.post(f"/api/projects/{forked_id}/publish/")
    assert publish_response.status_code == 200

    detail_body = anon_client.get(f"/api/public/projects/{forked_id}/").json()
    assert detail_body["remix_provenance"] == {
        "source_creator": "alice",
        "source_public_id": str(source.public_id),
    }


# --- Source becomes unavailable: durable text, no link, no private leak ---


@pytest.mark.django_db
def test_provenance_survives_source_going_private_without_a_link(anon_client, alice, bob):
    source = _make_project(alice, title="Open Palm Bloom", public=True)
    fork = _fork(source, bob, public=True)

    source.visibility = Project.Visibility.PRIVATE
    source.save(update_fields=["visibility"])

    detail_body = anon_client.get(_detail_url(fork)).json()
    provenance = detail_body["remix_provenance"]
    assert provenance["source_creator"] == "alice"
    assert provenance["source_public_id"] is None

    raw = json.dumps(detail_body)
    assert str(source.public_id) not in raw


@pytest.mark.django_db
def test_provenance_survives_source_unpublish_without_a_link(anon_client, alice, bob):
    source = _make_project(alice, title="Motion Trails", public=True)
    fork = _fork(source, bob, public=True)

    source.published_at = None
    source.save(update_fields=["published_at"])

    gallery_item = _gallery_item(anon_client, fork)
    provenance = gallery_item["remix_provenance"]
    assert provenance["source_creator"] == "alice"
    assert provenance["source_public_id"] is None


@pytest.mark.django_db
def test_provenance_survives_source_soft_delete_without_a_link(anon_client, alice, bob):
    source = _make_project(alice, title="Gesture Color Field", public=True)
    fork = _fork(source, bob, public=True)

    source.is_deleted = True
    source.save(update_fields=["is_deleted"])

    detail_body = anon_client.get(_detail_url(fork)).json()
    provenance = detail_body["remix_provenance"]
    assert provenance["source_creator"] == "alice"
    assert provenance["source_public_id"] is None


# --- Snapshot-or-live policy: LIVE (documented in remix_provenance_data) ---


@pytest.mark.django_db
def test_creator_display_name_change_is_reflected_live_not_snapshotted(anon_client, alice, bob):
    source = _make_project(alice, title="Physics Orbit", public=True)
    fork = _fork(source, bob, public=True)

    detail_before = anon_client.get(_detail_url(fork)).json()
    assert detail_before["remix_provenance"]["source_creator"] == "alice"

    alice.username = "alice_renamed"
    alice.save(update_fields=["username"])

    detail_after = anon_client.get(_detail_url(fork)).json()
    assert detail_after["remix_provenance"]["source_creator"] == "alice_renamed"


# --- Nested remixes: immediate source, not root ---


@pytest.mark.django_db
def test_nested_remix_reports_immediate_source_not_root(anon_client, alice, bob, carol):
    root = _make_project(alice, title="SVG Kinetic Poster", public=True)
    middle = _fork(root, bob, title="Bob's remix", public=True)
    leaf = _fork(middle, carol, title="Carol's remix of Bob's remix", public=True)

    detail_body = anon_client.get(_detail_url(leaf)).json()
    provenance = detail_body["remix_provenance"]

    # Immediate source is Bob (middle), never Alice (root).
    assert provenance["source_creator"] == "bob"
    assert provenance["source_public_id"] == str(middle.public_id)
    assert provenance["source_public_id"] != str(root.public_id)

    # The middle fork, in turn, correctly reports its own immediate
    # source (Alice/root) -- each link in the chain is self-consistent.
    middle_detail = anon_client.get(_detail_url(middle)).json()
    assert middle_detail["remix_provenance"]["source_creator"] == "alice"
    assert middle_detail["remix_provenance"]["source_public_id"] == str(root.public_id)
