"""Issue #588: content SEO/AEO metadata for Project and Project3D."""

import json
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from scenes.models import Project, Project3D, SceneVersion, SceneVersion3D

SEO_CONFIG = {
    "title": "Configured project title",
    "description": "A bounded project description.",
    "canonical_policy": "self",
    "indexing": "index",
    "og_title": "Configured social title",
    "og_description": "A social description.",
    "twitter_card": "summary",
    "answer_summary": "A concise answer for agents.",
    "structured_data": {"@context": "https://schema.org", "@type": "VisualArtwork"},
}


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="seo-owner")


@pytest.fixture
def other_user(db):
    return get_user_model().objects.create_user(username="seo-other")


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


def _scene_json():
    return json.loads(
        (
            Path(__file__).resolve().parent.parent.parent
            / "schema"
            / "fixtures"
            / "valid"
            / "blank.json"
        ).read_text()
    )


def _scene3d_json():
    return json.loads(
        (
            Path(__file__).resolve().parent.parent.parent
            / "schema"
            / "fixtures3d"
            / "valid"
            / "minimal.json"
        ).read_text()
    )


@pytest.mark.django_db
@pytest.mark.parametrize("path", ["project", "project3d"])
def test_owner_metadata_patch_accepts_and_returns_seo_config(owner_client, owner, path):
    if path == "project":
        project = Project.objects.create(owner=owner)
        url = f"/api/projects/{project.public_id}/"
    else:
        project = Project3D.objects.create(owner=owner)
        url = f"/api/projects3d/{project.public_id}/"

    response = owner_client.patch(url, {"seo_config": SEO_CONFIG}, format="json")

    assert response.status_code == 200
    assert response.json()["seo_config"] == SEO_CONFIG


@pytest.mark.django_db
@pytest.mark.parametrize("path", ["project", "project3d"])
def test_owner_metadata_patch_rejects_invalid_seo_config_without_mutation(
    owner_client, owner, path
):
    invalid = {"seo_config": {"unknown": "must be rejected"}}
    if path == "project":
        project = Project.objects.create(owner=owner)
        url = f"/api/projects/{project.public_id}/"
    else:
        project = Project3D.objects.create(owner=owner)
        url = f"/api/projects3d/{project.public_id}/"

    response = owner_client.patch(url, invalid, format="json")

    assert response.status_code == 400
    project.refresh_from_db()
    assert project.seo_config == {}


@pytest.mark.django_db
def test_published_project_exposes_seo_config_but_private_project_does_not(
    owner, anon_client, other_client
):
    project = Project.objects.create(
        owner=owner,
        title="Public SEO project",
        visibility=Project.Visibility.PUBLIC,
        published_at=timezone.now(),
        seo_config=SEO_CONFIG,
    )
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=_scene_json(),
        created_by=owner,
    )
    project.current_version = version
    project.save(update_fields=["current_version"])

    response = anon_client.get(f"/api/public/projects/{project.public_id}/")

    assert response.status_code == 200
    assert response.json()["seo_config"] == SEO_CONFIG

    project.visibility = Project.Visibility.PRIVATE
    project.save(update_fields=["visibility"])
    assert anon_client.get(f"/api/public/projects/{project.public_id}/").status_code == 404
    assert other_client.get(f"/api/projects/{project.public_id}/").status_code == 404


@pytest.mark.django_db
def test_published_project3d_exposes_seo_config_but_private_project_does_not(
    owner, anon_client, other_client
):
    project = Project3D.objects.create(
        owner=owner,
        title="Public 3D SEO project",
        visibility=Project3D.Visibility.PUBLIC,
        published_at=timezone.now(),
        seo_config=SEO_CONFIG,
    )
    version = SceneVersion3D.objects.create(
        project=project,
        sequence=1,
        scene_json=_scene3d_json(),
        created_by=owner,
    )
    project.current_version = version
    project.save(update_fields=["current_version"])

    response = anon_client.get(f"/api/public/projects3d/{project.public_id}/")

    assert response.status_code == 200
    assert response.json()["seo_config"] == SEO_CONFIG

    project.visibility = Project3D.Visibility.PRIVATE
    project.save(update_fields=["visibility"])
    assert anon_client.get(f"/api/public/projects3d/{project.public_id}/").status_code == 404
    assert other_client.get(f"/api/projects3d/{project.public_id}/").status_code == 404
