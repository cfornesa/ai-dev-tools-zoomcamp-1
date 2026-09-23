"""Focused coverage for issue #731's public 3D version projection."""

import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from scenes.models import Project3D, PublicProfile, SceneVersion3D

with (
    Path(__file__).resolve().parents[2] / "schema/fixtures3d/valid/minimal.json"
).open() as stream:
    MINIMAL_SCENE = json.load(stream)


@pytest.fixture
def published_project3d(db):
    owner = get_user_model().objects.create_user(username="public-3d-history")
    PublicProfile.objects.create(user=owner, handle="public-3d-history", is_public=True)
    project = Project3D.objects.create(
        owner=owner,
        title="Published history",
        public_slug="published-history",
        seo_config={"description": "A public description"},
        visibility=Project3D.Visibility.PUBLIC,
        published_at=timezone.now(),
    )
    versions = [
        SceneVersion3D.objects.create(
            project=project,
            sequence=sequence,
            scene_json={**MINIMAL_SCENE, "id": f"public-history-{sequence}"},
        )
        for sequence in range(1, 4)
    ]
    project.current_version = versions[-1]
    project.save(update_fields=["current_version"])
    return project


@pytest.mark.django_db
def test_public_3d_detail_exposes_ordered_safe_version_summaries(published_project3d):
    response = APIClient().get(f"/api/public/projects3d/{published_project3d.public_id}/")

    assert response.status_code == 200
    body = response.json()
    assert body["description"] == "A public description"
    assert body["version_count"] == 3
    assert [version["sequence"] for version in body["versions"]] == [3, 2, 1]
    assert [version["is_current"] for version in body["versions"]] == [True, False, False]
    assert all("scene_json" not in version for version in body["versions"])
    assert body["current_version"]["scene_json"]["id"] == "public-history-3"


@pytest.mark.django_db
def test_public_3d_canonical_slug_exposes_the_same_safe_version_summary(published_project3d):
    response = APIClient().get("/api/users/@public-3d-history/pieces/published-history/")

    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "3d"
    assert body["piece"]["description"] == "A public description"
    assert body["piece"]["version_count"] == 3
    assert [version["sequence"] for version in body["piece"]["versions"]] == [3, 2, 1]


@pytest.mark.django_db
def test_public_3d_version_history_query_count_is_bounded(published_project3d):
    for sequence in range(4, 24):
        SceneVersion3D.objects.create(
            project=published_project3d,
            sequence=sequence,
            scene_json={**MINIMAL_SCENE, "id": f"public-history-{sequence}"},
        )

    with CaptureQueriesContext(connection) as queries:
        response = APIClient().get(f"/api/public/projects3d/{published_project3d.public_id}/")

    assert response.status_code == 200
    assert response.json()["version_count"] == 23
    assert len(queries) <= 6


@pytest.mark.django_db
def test_public_3d_detail_keeps_unpublished_projects_private(published_project3d):
    published_project3d.visibility = Project3D.Visibility.PRIVATE
    published_project3d.published_at = None
    published_project3d.save(update_fields=["visibility", "published_at"])

    assert (
        APIClient().get(f"/api/public/projects3d/{published_project3d.public_id}/").status_code
        == 404
    )
    assert (
        APIClient().get("/api/users/@public-3d-history/pieces/published-history/").status_code
        == 404
    )
