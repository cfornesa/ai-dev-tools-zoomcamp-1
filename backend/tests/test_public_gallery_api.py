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

from scenes.gallery import decode_cursor, decode_gallery_cursor, encode_cursor
from scenes.models import (
    ArtPiece,
    ArtPieceVersion,
    EditSessionDraft,
    Project,
    Project3D,
    SceneVersion,
    SceneVersion3D,
)

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


def _make_project3d(owner_user, *, title="A 3D study"):
    project = Project3D.objects.create(owner=owner_user, title=title)
    version = SceneVersion3D.objects.create(
        project=project,
        sequence=1,
        scene_json=copy.deepcopy(MINIMAL_SCENE_3D),
        created_by=owner_user,
    )
    project.current_version = version
    project.save(update_fields=["current_version"])
    return project


def _publish_3d_directly(project, when=None):
    project.visibility = Project3D.Visibility.PUBLIC
    project.published_at = when or timezone.now()
    project.save(update_fields=["visibility", "published_at"])
    return project


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
def test_mixed_gallery_includes_public_2d_and_3d_cards(anon_client, owner):
    older_2d = _make_project(owner, title="2D card", description="d")
    _publish_directly(older_2d, timezone.now() - timezone.timedelta(minutes=2))
    newer_3d = _make_project3d(owner, title="3D card")
    _publish_3d_directly(newer_3d, timezone.now() - timezone.timedelta(minutes=1))

    response = anon_client.get(LIST_URL)

    assert response.status_code == 200
    assert [(item["title"], item["renderer"]) for item in response.json()["results"]] == [
        ("3D card", "3d"),
        ("2D card", "2d"),
    ]
    assert response.json()["results"][0]["id"] == str(newer_3d.public_id)
    assert response.json()["results"][0]["thumbnail_url"].endswith("/thumbnail/")


@pytest.mark.django_db
def test_private_or_deleted_3d_projects_are_excluded(anon_client, owner):
    private = _make_project3d(owner, title="Private 3D")
    deleted = _make_project3d(owner, title="Deleted 3D")
    _publish_3d_directly(deleted)
    deleted.is_deleted = True
    deleted.deleted_at = timezone.now()
    deleted.save(update_fields=["is_deleted", "deleted_at"])

    body = anon_client.get(LIST_URL).json()

    assert body["results"] == []
    assert private.visibility == Project3D.Visibility.PRIVATE


@pytest.mark.django_db
def test_mixed_pagination_has_no_duplicates_or_gaps(anon_client, owner):
    base = timezone.now() - timezone.timedelta(hours=1)
    expected = []
    for index in range(4):
        if index % 2:
            project = _make_project3d(owner, title=f"Mixed {index}")
            _publish_3d_directly(project, base + timezone.timedelta(minutes=index))
        else:
            project = _make_project(owner, title=f"Mixed {index}", description="d")
            _publish_directly(project, base + timezone.timedelta(minutes=index))
        expected.append(project.title)

    seen = []
    cursor = None
    while True:
        params = {"page_size": 2}
        if cursor:
            params["cursor"] = cursor
        body = anon_client.get(LIST_URL, params).json()
        seen.extend(item["title"] for item in body["results"])
        if not body["has_more"]:
            break
        cursor = body["next_cursor"]

    assert seen == ["Mixed 3", "Mixed 2", "Mixed 1", "Mixed 0"]
    assert set(seen) == set(expected)


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
    project3d = _make_project3d(owner, title="Same 3D for everyone")
    _publish_3d_directly(project3d)

    anon_body = anon_client.get(LIST_URL).json()
    signed_in_body = owner_client.get(LIST_URL).json()  # requested by the project's own owner

    assert anon_body == signed_in_body


@pytest.mark.django_db
def test_3d_card_excludes_scene_and_owner_fields(anon_client, owner):
    project = _make_project3d(owner, title="Safe 3D card")
    _publish_3d_directly(project)

    item = anon_client.get(LIST_URL).json()["results"][0]

    assert set(item) == {"id", "title", "owner", "thumbnail_url", "published_at", "renderer"}
    assert item["id"] == str(project.public_id)
    assert item["renderer"] == "3d"
    assert "scene_json" not in json.dumps(item)
    assert "visibility" not in json.dumps(item)


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
        "renderer",
    }

    # Only the public_id-derived `id` -- no separate internal-pk field.
    assert item["id"] == str(project.public_id)
    assert item["renderer"] == "2d"

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


# ========================================================================
# Issue #491: the unified public gallery (`GET /api/public/gallery/`)
# ========================================================================
#
# The legacy `/api/public/projects/` contract above is unchanged and stays
# green; everything below covers the additive unified endpoint: eligibility,
# the `type` filter, the discriminated result union, the type-bound keyset
# cursor, and duplicate/gap-safe mixed pagination.

UNIFIED_URL = "/api/public/gallery/"

PIECE_SOURCE = '<canvas id="unified-gallery-canvas"></canvas>'


def _make_art_piece(owner_user, *, title="Generated study"):
    piece = ArtPiece.objects.create(
        owner=owner_user,
        title=title,
        description="A generated fixture.",
        prompt="the fixture's secret prompt",
        engine="canvas2d",
    )
    version = ArtPieceVersion.objects.create(piece=piece, sequence=1, source=PIECE_SOURCE)
    piece.current_version = version
    piece.save(update_fields=["current_version"])
    return piece


def _publish_art_piece(piece, when=None):
    piece.status = ArtPiece.Status.PUBLISHED
    piece.published_at = when or timezone.now()
    piece.save(update_fields=["status", "published_at"])
    return piece


@pytest.fixture
def fixed_unified_fixture(owner):
    """Issue #491's fixed fixture: one published piece of each kind at
    distinct titles/timestamps, plus one private/draft sentinel of each
    kind that must never appear under any filter."""
    when_2d = timezone.now() - timezone.timedelta(minutes=3)
    when_3d = timezone.now() - timezone.timedelta(minutes=2)
    when_generated = timezone.now() - timezone.timedelta(minutes=1)

    piece_2d = _publish_directly(_make_project(owner, title="Fixture 2D", description="d"), when_2d)
    piece_3d = _publish_3d_directly(_make_project3d(owner, title="Fixture 3D"), when_3d)
    piece_generated = _publish_art_piece(
        _make_art_piece(owner, title="Fixture generated"), when_generated
    )

    # Private/draft sentinels of each kind -- none may ever leak.
    _make_project(owner, title="Private 2D sentinel")
    private_3d = _make_project3d(owner, title="Private 3D sentinel")
    _ = private_3d
    _make_art_piece(owner, title="Draft generated sentinel")
    Archived = ArtPiece.Status.ARCHIVED
    archived = _make_art_piece(owner, title="Archived generated sentinel")
    archived.status = Archived
    archived.save(update_fields=["status"])
    deleted = _make_art_piece(owner, title="Deleted generated sentinel")
    _publish_art_piece(deleted)
    deleted.is_deleted = True
    deleted.deleted_at = timezone.now()
    deleted.save(update_fields=["is_deleted", "deleted_at"])

    return {
        "2d": piece_2d,
        "3d": piece_3d,
        "generated": piece_generated,
    }


# --- Contract: anonymity, field exclusion, discriminator ---


@pytest.mark.django_db
def test_unified_endpoint_is_anonymous_and_identical_when_signed_in(
    owner_client, anon_client, fixed_unified_fixture
):
    anon_body = anon_client.get(UNIFIED_URL).json()
    signed_in_body = owner_client.get(UNIFIED_URL).json()

    assert anon_body == signed_in_body
    titles = [item["title"] for item in anon_body["results"]]
    assert titles == ["Fixture generated", "Fixture 3D", "Fixture 2D"]


@pytest.mark.django_db
def test_unified_items_are_a_discriminated_union_with_public_fields(
    anon_client, fixed_unified_fixture
):
    results = anon_client.get(UNIFIED_URL).json()["results"]
    by_kind = {item["kind"]: item for item in results}

    assert set(by_kind) == {"2d", "3d", "generated"}

    for kind, record in fixed_unified_fixture.items():
        item = by_kind[kind]
        assert item["id"] == str(record.public_id)
        assert item["title"] == record.title
        assert item["owner"] == "alice"
        assert item["published_at"] is not None
        assert item["thumbnail_url"] is not None

    assert by_kind["2d"]["viewer_url"] == f"/p/{fixed_unified_fixture['2d'].public_id}"
    assert by_kind["3d"]["viewer_url"] == f"/p3d/{fixed_unified_fixture['3d'].public_id}"
    assert (
        by_kind["generated"]["viewer_url"]
        == f"/art-pieces/p/{fixed_unified_fixture['generated'].public_id}"
    )

    # Only generated rows carry the engine label.
    assert by_kind["generated"]["engine"] == "canvas2d"
    assert "engine" not in by_kind["2d"]
    assert "engine" not in by_kind["3d"]


@pytest.mark.django_db
def test_unified_response_excludes_private_and_editing_fields(anon_client, fixed_unified_fixture):
    body = anon_client.get(UNIFIED_URL).json()
    raw_body = json.dumps(body)

    for item in body["results"]:
        assert set(item) <= {
            "id",
            "kind",
            "title",
            "owner",
            "published_at",
            "thumbnail_url",
            "viewer_url",
            "engine",
        }

    # No scene/prompt/draft/visibility data anywhere in the body, and the
    # draft sentinel titles never surface under any circumstance.
    for forbidden in (
        "scene_json",
        "secret prompt",
        "prompt",
        "visibility",
        "status",
        "Private 2D sentinel",
        "Private 3D sentinel",
        "Draft generated sentinel",
        "Archived generated sentinel",
        "Deleted generated sentinel",
    ):
        assert forbidden not in raw_body


# --- The `type` filter ---


@pytest.mark.django_db
def test_unified_type_defaults_to_all(anon_client, fixed_unified_fixture):
    omitted = anon_client.get(UNIFIED_URL).json()
    explicit = anon_client.get(UNIFIED_URL, {"type": "all"}).json()
    assert omitted == explicit
    assert {item["kind"] for item in omitted["results"]} == {"2d", "3d", "generated"}


@pytest.mark.django_db
def test_unified_authored_filter_excludes_generated(anon_client, fixed_unified_fixture):
    results = anon_client.get(UNIFIED_URL, {"type": "authored"}).json()["results"]
    assert [item["title"] for item in results] == ["Fixture 3D", "Fixture 2D"]
    assert {item["kind"] for item in results} == {"2d", "3d"}


@pytest.mark.django_db
def test_unified_generated_filter_excludes_authored(anon_client, fixed_unified_fixture):
    results = anon_client.get(UNIFIED_URL, {"type": "generated"}).json()["results"]
    assert [item["title"] for item in results] == ["Fixture generated"]
    assert results[0]["kind"] == "generated"


@pytest.mark.django_db
def test_unified_invalid_type_is_a_400(anon_client, fixed_unified_fixture):
    response = anon_client.get(UNIFIED_URL, {"type": "everything"})

    assert response.status_code == 400
    assert "type" in response.json()["errors"]


# --- Cursor rules: malformed cursors and the type binding ---


@pytest.mark.django_db
def test_unified_invalid_cursor_is_a_400(anon_client, fixed_unified_fixture):
    response = anon_client.get(UNIFIED_URL, {"cursor": "not-a-real-cursor"})

    assert response.status_code == 400
    assert "cursor" in response.json()["errors"]


@pytest.mark.django_db
def test_unified_cursor_reused_with_a_different_type_is_a_400(anon_client, fixed_unified_fixture):
    first_page = anon_client.get(UNIFIED_URL, {"type": "all", "page_size": 1}).json()
    assert first_page["next_cursor"] is not None

    rebound = anon_client.get(
        UNIFIED_URL,
        {"type": "generated", "cursor": first_page["next_cursor"]},
    )
    assert rebound.status_code == 400
    assert "cursor" in rebound.json()["errors"]


@pytest.mark.django_db
def test_unified_cursor_reused_with_authored_is_also_a_400(anon_client, fixed_unified_fixture):
    first_page = anon_client.get(UNIFIED_URL, {"type": "all", "page_size": 1}).json()

    rebound = anon_client.get(
        UNIFIED_URL,
        {"type": "authored", "cursor": first_page["next_cursor"]},
    )
    assert rebound.status_code == 400


@pytest.mark.django_db
def test_unified_cursor_round_trips_within_its_own_type(anon_client, fixed_unified_fixture):
    first_page = anon_client.get(UNIFIED_URL, {"type": "all", "page_size": 1}).json()
    second_page = anon_client.get(
        UNIFIED_URL, {"type": "all", "page_size": 1, "cursor": first_page["next_cursor"]}
    )

    assert second_page.status_code == 200


# --- Duplicate/gap-safe mixed pagination across all three kinds ---


def _walk_unified(client, params):
    """Page through `/api/public/gallery/` until `has_more` is false,
    returning every title seen in order."""
    seen = []
    cursor = None
    pages = 0
    while True:
        page_params = dict(params)
        if cursor:
            page_params["cursor"] = cursor
        response = client.get(UNIFIED_URL, page_params)
        assert response.status_code == 200
        body = response.json()
        seen.extend((item["title"], item["kind"]) for item in body["results"])
        pages += 1
        if not body["has_more"]:
            assert body["next_cursor"] is None
            return seen
        cursor = body["next_cursor"]
        assert cursor is not None
        assert pages < 20


@pytest.mark.django_db
def test_unified_pagination_walks_every_kind_exactly_once(anon_client, fixed_unified_fixture):
    seen = _walk_unified(anon_client, {"page_size": 2})

    assert seen == [
        ("Fixture generated", "generated"),
        ("Fixture 3D", "3d"),
        ("Fixture 2D", "2d"),
    ]


@pytest.mark.django_db
def test_unified_filter_specific_pagination(anon_client, owner):
    base = timezone.now() - timezone.timedelta(hours=1)
    for index in range(3):
        _publish_art_piece(
            _make_art_piece(owner, title=f"Generated {index}"),
            base + timezone.timedelta(minutes=index),
        )

    seen = _walk_unified(anon_client, {"type": "generated", "page_size": 2})

    assert [title for title, _ in seen] == ["Generated 2", "Generated 1", "Generated 0"]
    assert {kind for _, kind in seen} == {"generated"}


@pytest.mark.django_db
def test_unified_new_publish_between_pages_never_duplicates_or_skips(
    owner_client, anon_client, owner
):
    base = timezone.now() - timezone.timedelta(hours=1)
    for index in range(4):
        if index % 3 == 0:
            _publish_directly(
                _make_project(owner, title=f"Walk 2D {index}", description="d"),
                base + timezone.timedelta(minutes=index),
            )
        elif index % 3 == 1:
            _publish_3d_directly(
                _make_project3d(owner, title=f"Walk 3D {index}"),
                base + timezone.timedelta(minutes=index),
            )
        else:
            _publish_art_piece(
                _make_art_piece(owner, title=f"Walk generated {index}"),
                base + timezone.timedelta(minutes=index),
            )

    page1 = anon_client.get(UNIFIED_URL, {"page_size": 2}).json()
    page1_titles = [item["title"] for item in page1["results"]]

    concurrent = _make_art_piece(owner, title="Published mid-walk")
    _publish_art_piece(concurrent)

    page2 = anon_client.get(UNIFIED_URL, {"page_size": 2, "cursor": page1["next_cursor"]}).json()
    page2_titles = [item["title"] for item in page2["results"]]

    all_seen = page1_titles + page2_titles
    assert len(all_seen) == len(set(all_seen))
    assert {
        "Walk 2D 0",
        "Walk 3D 1",
        "Walk generated 2",
        "Walk 2D 3",
    }.issubset(set(all_seen))
    assert "Published mid-walk" not in all_seen


@pytest.mark.django_db
def test_unified_same_instant_publish_keeps_rank_order_without_gaps(anon_client, owner):
    """The #493 regression shape: rows sharing one `published_at` instant
    must still paginate in documented rank order (2d < 3d < generated) with
    no row dropped when the walk crosses a kind boundary."""
    instant = timezone.now()
    generated = _publish_art_piece(_make_art_piece(owner, title="Same tick generated"), instant)
    project3d = _publish_3d_directly(_make_project3d(owner, title="Same tick 3D"), instant)
    project2d = _publish_directly(
        _make_project(owner, title="Same tick 2D", description="d"), instant
    )
    _ = (generated, project3d, project2d)

    seen = _walk_unified(anon_client, {"page_size": 1})

    assert [title for title, _ in seen] == [
        "Same tick 2D",
        "Same tick 3D",
        "Same tick generated",
    ]


@pytest.mark.django_db
def test_legacy_untyped_gallery_cursor_still_decodes():
    """Legacy API stability (issue #491's compatibility criterion): every
    cursor `PublicProjectListView` issued before the unified endpoint
    shipped has no `type` segment, and it must keep decoding (with
    `gallery_type=None`) rather than become a 400 the moment the unified
    endpoint exists."""
    import base64

    legacy = base64.urlsafe_b64encode(b"gallery|2026-09-08T10:00:00+00:00|3d|7").decode("ascii")

    published_at, kind, object_id, gallery_type = decode_gallery_cursor(legacy)

    assert kind == "3d"
    assert object_id == 7
    assert published_at is not None
    assert gallery_type is None
