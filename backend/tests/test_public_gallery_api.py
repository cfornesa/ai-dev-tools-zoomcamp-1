"""Task 50: the public gallery listing endpoint (`GET /api/public/projects/`).

Covers the acceptance criteria directly: eligibility filtering, immediate
reflection of visibility changes on the next request, duplicate/gap-safe
keyset pagination (including a new publish landing between two page
requests), identical anonymous/signed-in fields, and a comprehensive
field-exclusion check for private data.
"""

import copy
import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from scenes.gallery import decode_cursor, encode_cursor
from scenes.models import EditSessionDraft, Project, SceneVersion

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures"
        / "valid"
        / "blank.json"
    ).read_text()
)

LIST_URL = "/api/public/projects/"


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="alice", email="alice@example.com")


@pytest.fixture
def other_owner(db):
    return get_user_model().objects.create_user(username="bob")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.fixture
def anon_client():
    return APIClient()


def _make_project(owner_user, *, title="Untitled animation", description="", scene=None):
    scene = scene if scene is not None else copy.deepcopy(BLANK_SCENE)
    project = Project.objects.create(owner=owner_user, title=title, description=description)
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=scene,
        created_by=owner_user,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = version
    project.save(update_fields=["current_version"])
    return project


def _publish_directly(project, when=None):
    """Publish at the model layer with a caller-controlled `published_at`,
    so pagination tests can build a precise, ordered fixture set without
    depending on real wall-clock timing between ORM calls."""
    project.visibility = Project.Visibility.PUBLIC
    project.published_at = when or timezone.now()
    project.save(update_fields=["visibility", "published_at"])
    return project


def _publish_via_api(client, project):
    response = client.post(f"/api/projects/{project.public_id}/publish/")
    assert response.status_code == 200
    return response


def _unpublish_via_api(client, project):
    response = client.post(f"/api/projects/{project.public_id}/unpublish/")
    assert response.status_code == 200
    return response


# --- Eligibility ---


@pytest.mark.django_db
def test_only_public_projects_appear(anon_client, owner):
    public_project = _make_project(owner, title="Public one")
    _publish_directly(public_project)
    _make_project(owner, title="Private one")  # never published

    response = anon_client.get(LIST_URL)

    assert response.status_code == 200
    titles = [item["title"] for item in response.json()["results"]]
    assert titles == ["Public one"]


@pytest.mark.django_db
def test_soft_deleted_project_excluded_even_if_still_flagged_public(anon_client, owner):
    project = _make_project(owner, title="Soon deleted")
    _publish_directly(project)
    project.is_deleted = True
    project.deleted_at = timezone.now()
    project.save(update_fields=["is_deleted", "deleted_at"])

    response = anon_client.get(LIST_URL)

    assert response.status_code == 200
    assert response.json()["results"] == []


@pytest.mark.django_db
def test_project_without_a_saved_version_is_never_eligible(anon_client, owner):
    # A bare Project.objects.create() has no current_version and Task 49's
    # own publish view would reject it -- but assert the gallery query
    # itself never trusts a visibility flag alone.
    project = Project.objects.create(owner=owner, title="No version")
    project.visibility = Project.Visibility.PUBLIC
    project.published_at = timezone.now()
    project.save(update_fields=["visibility", "published_at"])

    response = anon_client.get(LIST_URL)

    assert response.status_code == 200
    assert response.json()["results"] == []


@pytest.mark.django_db
def test_empty_gallery_returns_empty_results_not_an_error(anon_client):
    response = anon_client.get(LIST_URL)

    assert response.status_code == 200
    body = response.json()
    assert body["results"] == []
    assert body["has_more"] is False
    assert body["next_cursor"] is None


# --- Visibility changes reflected on the next request ---


@pytest.mark.django_db
def test_publish_then_unpublish_sequence_appears_then_disappears(owner_client, anon_client, owner):
    project = _make_project(owner, title="Toggle me", description="A real description.")

    # Not public yet.
    assert project.title not in [
        item["title"] for item in anon_client.get(LIST_URL).json()["results"]
    ]

    _publish_via_api(owner_client, project)
    after_publish = anon_client.get(LIST_URL).json()["results"]
    assert "Toggle me" in [item["title"] for item in after_publish]

    _unpublish_via_api(owner_client, project)
    after_unpublish = anon_client.get(LIST_URL).json()["results"]
    assert "Toggle me" not in [item["title"] for item in after_unpublish]


@pytest.mark.django_db
def test_republishing_reappears_at_the_front(owner_client, anon_client, owner):
    older = _make_project(owner, title="Older", description="d")
    _publish_directly(older, timezone.now() - timezone.timedelta(hours=1))

    toggled = _make_project(owner, title="Toggled", description="d")
    _publish_via_api(owner_client, toggled)
    _unpublish_via_api(owner_client, toggled)
    _publish_via_api(owner_client, toggled)

    results = anon_client.get(LIST_URL).json()["results"]
    titles = [item["title"] for item in results]
    assert titles[0] == "Toggled"
    assert "Toggled" in titles
    assert titles.count("Toggled") == 1


# --- Pagination: deterministic ordering, no duplicates/gaps ---


@pytest.mark.django_db
def test_pagination_walks_every_project_exactly_once(anon_client, owner):
    base = timezone.now() - timezone.timedelta(hours=1)
    projects = []
    for i in range(7):
        project = _make_project(owner, title=f"Project {i}", description="d")
        _publish_directly(project, base + timezone.timedelta(minutes=i))
        projects.append(project)
    expected_titles = {p.title for p in projects}

    seen_titles: list[str] = []
    cursor = None
    pages = 0
    while True:
        params = {"page_size": 3}
        if cursor:
            params["cursor"] = cursor
        response = anon_client.get(LIST_URL, params)
        assert response.status_code == 200
        body = response.json()
        seen_titles.extend(item["title"] for item in body["results"])
        pages += 1
        if not body["has_more"]:
            assert body["next_cursor"] is None
            break
        cursor = body["next_cursor"]
        assert cursor is not None
        assert pages < 20  # guard against an infinite loop on a bug

    assert len(seen_titles) == len(expected_titles)  # no duplicates
    assert set(seen_titles) == expected_titles  # no gaps
    assert pages == 3  # 7 items at page_size=3 -> 3, 3, 1


@pytest.mark.django_db
def test_pagination_ordering_is_newest_published_first(anon_client, owner):
    base = timezone.now() - timezone.timedelta(hours=1)
    first = _make_project(owner, title="First published", description="d")
    _publish_directly(first, base)
    second = _make_project(owner, title="Second published", description="d")
    _publish_directly(second, base + timezone.timedelta(minutes=1))
    third = _make_project(owner, title="Third published", description="d")
    _publish_directly(third, base + timezone.timedelta(minutes=2))

    response = anon_client.get(LIST_URL)

    titles = [item["title"] for item in response.json()["results"]]
    assert titles == ["Third published", "Second published", "First published"]


@pytest.mark.django_db
def test_new_publish_between_page_requests_does_not_duplicate_or_skip_existing_rows(
    owner_client, anon_client, owner
):
    """The scenario the cursor strategy exists for: a new project publishes
    in the gap between page 1 and page 2 of an in-progress gallery walk.
    Every project that existed at the start of the walk must still appear
    exactly once across the full walk; the new project's appearance is a
    bonus, never a duplicate or a lost row for the others."""
    base = timezone.now() - timezone.timedelta(hours=1)
    initial_projects = []
    for i in range(4):
        project = _make_project(owner, title=f"Initial {i}", description="d")
        _publish_directly(project, base + timezone.timedelta(minutes=i))
        initial_projects.append(project)

    page1 = anon_client.get(LIST_URL, {"page_size": 2}).json()
    assert page1["has_more"] is True
    page1_titles = [item["title"] for item in page1["results"]]

    # A brand-new project publishes right now -- newer than everything on
    # page 1, so it sorts ahead of the whole walk.
    concurrent = _make_project(owner, title="Published mid-walk", description="d")
    _publish_via_api(owner_client, concurrent)

    page2 = anon_client.get(LIST_URL, {"page_size": 2, "cursor": page1["next_cursor"]}).json()
    page2_titles = [item["title"] for item in page2["results"]]

    all_seen = page1_titles + page2_titles
    initial_titles = {p.title for p in initial_projects}

    # No duplicates across the two pages.
    assert len(all_seen) == len(set(all_seen))
    # Every project that existed before the walk started is still present
    # exactly once -- no gaps caused by the concurrent insert.
    assert initial_titles.issubset(set(all_seen))
    # The concurrently-published project sorted ahead of the cursor and
    # never appears on either page of this in-progress walk.
    assert "Published mid-walk" not in all_seen


@pytest.mark.django_db
def test_page_size_is_clamped_to_a_maximum(anon_client, owner):
    response = anon_client.get(LIST_URL, {"page_size": 999999})

    assert response.status_code == 200  # never a 500/timeout from an unbounded page


@pytest.mark.django_db
def test_invalid_cursor_is_a_400_not_a_silently_wrong_page(anon_client):
    response = anon_client.get(LIST_URL, {"cursor": "not-a-real-cursor"})

    assert response.status_code == 400
    assert "cursor" in response.json()["errors"]


@pytest.mark.django_db
def test_cursor_round_trips(owner):
    project = _make_project(owner, title="Round trip")
    when = timezone.now()
    cursor = encode_cursor(when, project.id)
    decoded_when, decoded_id = decode_cursor(cursor)

    assert decoded_id == project.id
    assert abs((decoded_when - when).total_seconds()) < 0.001


# --- Anonymous vs signed-in: identical fields ---


@pytest.mark.django_db
def test_anonymous_and_signed_in_requests_return_identical_fields(owner_client, anon_client, owner):
    project = _make_project(owner, title="Same for everyone", description="d")
    _publish_directly(project)

    anon_body = anon_client.get(LIST_URL).json()
    signed_in_body = owner_client.get(LIST_URL).json()  # requested by the project's own owner

    assert anon_body == signed_in_body


# --- Field exclusion: no private data anywhere in the response ---


@pytest.mark.django_db
def test_response_excludes_private_and_internal_fields(owner_client, anon_client, owner):
    project = _make_project(
        owner,
        title="Field exclusion check",
        description="A real description that must not leak.",
        scene=copy.deepcopy(BLANK_SCENE),
    )
    project.tags = ["private-tag-one", "private-tag-two"]
    project.save(update_fields=["tags"])
    _publish_via_api(owner_client, project)

    # A draft with camera/session data that must never surface through the
    # gallery, structurally -- this endpoint never touches EditSessionDraft
    # at all, but assert it exists to prove absence isn't a coincidence of
    # an empty table.
    draft_scene = copy.deepcopy(BLANK_SCENE)
    draft_scene["id"] = "camera-calibration-secret-marker"
    EditSessionDraft.objects.create(
        project=project,
        user=owner,
        session_id="camera-session-1",
        draft_json=draft_scene,
        client_seq=1,
    )

    response = anon_client.get(LIST_URL)
    assert response.status_code == 200
    body = response.json()
    assert len(body["results"]) == 1
    item = body["results"][0]

    assert set(item.keys()) == {
        "id",
        "title",
        "owner",
        "thumbnail_url",
        "remix_provenance",
        "published_at",
    }

    # Only the public_id-derived `id` -- no separate internal-pk field.
    assert item["id"] == str(project.public_id)

    raw_body = json.dumps(body)
    # Description, tags, scene content, prompts, and camera/draft data are
    # never present anywhere in the response body.
    assert "A real description that must not leak" not in raw_body
    assert "private-tag-one" not in raw_body
    assert "private-tag-two" not in raw_body
    assert "camera-calibration-secret-marker" not in raw_body
    assert "camera-session-1" not in raw_body
    assert "scene_json" not in raw_body
    assert "export_attribution" not in raw_body
    assert "allow_public_remix" not in raw_body
    assert "description" not in raw_body
    assert "tags" not in raw_body
    assert "visibility" not in raw_body

    # Creator attribution is the owner's username, never their email.
    assert item["owner"] == "alice"
    assert owner.email not in raw_body


@pytest.mark.django_db
def test_remix_provenance_is_null_for_a_project_with_no_fork(owner_client, anon_client, owner):
    """A project with no `ForkProvenance` row (not a remix) always has
    `remix_provenance: null` -- the field is structurally present (never
    omitted) but never an empty object or partial data. See
    `tests/test_remix_provenance_api.py` for real-fork provenance
    coverage (Task 53, issue #52)."""
    project = _make_project(owner, title="No provenance yet", description="d")
    _publish_via_api(owner_client, project)

    response = anon_client.get(LIST_URL)

    item = response.json()["results"][0]
    assert "remix_provenance" in item
    assert item["remix_provenance"] is None


@pytest.mark.django_db
def test_thumbnail_url_is_present_and_resolvable(owner_client, anon_client, owner):
    project = _make_project(owner, title="Has thumbnail", description="d")
    _publish_via_api(owner_client, project)

    response = anon_client.get(LIST_URL)

    item = response.json()["results"][0]
    assert item["thumbnail_url"] is not None
    assert item["thumbnail_url"].endswith("/thumbnail.png")
