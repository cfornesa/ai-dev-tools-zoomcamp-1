"""Related 2D public card query contract for issue #1141."""

import copy
import json
import uuid
from datetime import timedelta
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from scenes.models import Project, SceneVersion

BLANK_SCENE = json.loads(
    (
        Path(__file__).resolve().parent.parent.parent
        / "schema"
        / "fixtures"
        / "valid"
        / "blank.json"
    ).read_text()
)


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="related-owner", email="owner@example.com")


def make_project(owner, *, tags=(), renderer="p5", published_at=None, public_id=None):
    scene = copy.deepcopy(BLANK_SCENE)
    scene["renderer"]["preferred"] = renderer
    project = Project.objects.create(
        owner=owner,
        title=f"Project {uuid.uuid4().hex[:8]}",
        tags=list(tags),
        public_id=public_id or uuid.uuid4(),
    )
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=scene,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project.current_version = version
    project.visibility = Project.Visibility.PUBLIC
    project.published_at = published_at or timezone.now()
    project.save(update_fields=["current_version", "visibility", "published_at"])
    return project


def url(project):
    return f"/api/public/projects/{project.public_id}/related/"


@pytest.mark.django_db
def test_related_cards_rank_by_tag_count_then_renderer_then_recency_and_id(owner):
    now = timezone.now()
    source = make_project(owner, tags=["one", "two"], renderer="p5", published_at=now)
    renderer_match = make_project(
        owner,
        tags=["one"],
        renderer="p5",
        published_at=now + timedelta(seconds=3),
        public_id=uuid.UUID(int=3),
    )
    tag_match = make_project(
        owner, tags=["one", "two"], renderer="svg", published_at=now, public_id=uuid.UUID(int=2)
    )
    renderer_only = make_project(
        owner,
        tags=["unrelated"],
        renderer="p5",
        published_at=now + timedelta(seconds=5),
        public_id=uuid.UUID(int=1),
    )
    unrelated = make_project(
        owner,
        tags=["unrelated"],
        renderer="svg",
        published_at=now + timedelta(seconds=9),
        public_id=uuid.UUID(int=4),
    )

    response = APIClient().get(url(source))

    assert response.status_code == 200
    results = response.json()["results"]
    assert [item["id"] for item in results] == [
        str(tag_match.public_id),
        str(renderer_match.public_id),
        str(renderer_only.public_id),
    ]
    assert str(source.public_id) not in {item["id"] for item in results}
    assert str(unrelated.public_id) not in {item["id"] for item in results}
    assert all(item["kind"] == "2d" for item in results)
    assert {"id", "kind", "title", "owner", "published_at", "thumbnail_url", "viewer_url"} <= set(
        results[0]
    )
    serialized = json.dumps(results)
    for private_value in ("owner@example.com", "tags", "scene_json", "activity", "draft"):
        assert private_value not in serialized


@pytest.mark.django_db
def test_related_results_cap_at_six_and_break_equal_rank_by_public_id(owner):
    now = timezone.now()
    source = make_project(owner, tags=["shared"], renderer="svg", published_at=now)
    projects = [
        make_project(
            owner,
            tags=["shared"],
            renderer="svg",
            published_at=now,
            public_id=uuid.UUID(int=index),
        )
        for index in range(1, 9)
    ]

    response = APIClient().get(url(source))

    assert response.status_code == 200
    result_ids = [item["id"] for item in response.json()["results"]]
    assert len(result_ids) == 6
    assert result_ids == [str(project.public_id) for project in reversed(projects[-6:])]


@pytest.mark.django_db
def test_related_endpoint_returns_empty_for_no_tag_or_renderer_matches(owner):
    source = make_project(owner, tags=["source"], renderer="p5")
    make_project(owner, tags=["other"], renderer="svg")

    response = APIClient().get(url(source))

    assert response.status_code == 200
    assert response.json() == {"results": []}


@pytest.mark.django_db
def test_related_endpoint_404s_for_non_public_or_deleted_sources(owner):
    client = APIClient()
    private = Project.objects.create(owner=owner, title="private")
    soft_deleted = make_project(owner)
    soft_deleted.is_deleted = True
    soft_deleted.save(update_fields=["is_deleted"])
    unpublished = make_project(owner)
    unpublished.visibility = Project.Visibility.PRIVATE
    unpublished.published_at = None
    unpublished.save(update_fields=["visibility", "published_at"])

    assert client.get(url(private)).status_code == 404
    assert client.get(url(soft_deleted)).status_code == 404
    assert client.get(url(unpublished)).status_code == 404


@pytest.mark.django_db
def test_related_endpoint_uses_bounded_queries_with_bounded_profile_prefetch(
    owner, django_assert_num_queries
):
    source = make_project(owner, tags=["same"])
    for index in range(5):
        candidate_owner = get_user_model().objects.create_user(username=f"candidate-{index}")
        make_project(candidate_owner, tags=["same"])

    with django_assert_num_queries(3):
        response = APIClient().get(url(source))

    assert response.status_code == 200
    assert response.json()["results"]
