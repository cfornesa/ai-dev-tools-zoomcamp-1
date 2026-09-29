"""Tests for authenticated ambient-sample sync and public delivery (#1056)."""

import hashlib
import uuid

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from scenes.models import PieceIntakeAsset, Project3D


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="ambient-sample-owner")


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


def upload_sample(client, project_id, asset_id, payload=b"sample-bytes", mime="audio/mpeg"):
    return client.post(
        f"/api/projects3d/{project_id}/ambient-sample/",
        {"asset_id": str(asset_id), "sample": SimpleUploadedFile("loop.mp3", payload, mime)},
        format="multipart",
    )


@pytest.mark.django_db
def test_owner_can_sync_an_ambient_sample_to_the_project_asset_store(owner_client, owner):
    project = Project3D.objects.create(owner=owner)
    asset_id = uuid.uuid4()

    response = upload_sample(owner_client, project.public_id, asset_id)

    assert response.status_code == 200
    asset = PieceIntakeAsset.objects.get(
        piece_public_id=project.public_id, source_asset_id=asset_id
    )
    assert asset.piece_kind == "3d"
    assert asset.mime_type == "audio/mpeg"
    assert bytes(asset.data) == b"sample-bytes"
    assert asset.checksum == hashlib.sha256(b"sample-bytes").hexdigest()


@pytest.mark.django_db
def test_ambient_sample_sync_enforces_type_and_size_limits(owner_client, owner):
    project = Project3D.objects.create(owner=owner)
    asset_id = uuid.uuid4()

    invalid_type_response = upload_sample(
        owner_client, project.public_id, asset_id, mime="audio/flac"
    )
    assert invalid_type_response.status_code == 400
    oversized = b"x" * (10 * 1024 * 1024 + 1)
    assert upload_sample(owner_client, project.public_id, asset_id, oversized).status_code == 413


@pytest.mark.django_db
def test_public_delivery_follows_current_ambient_reference_and_visibility(owner_client):
    create_response = owner_client.post("/api/projects3d/")
    assert create_response.status_code == 201
    project = Project3D.objects.get(public_id=create_response.json()["id"])
    version = project.current_version
    assert version is not None
    asset_id = uuid.uuid4()
    response = upload_sample(owner_client, project.public_id, asset_id)
    assert response.status_code == 200
    version.scene_json = {
        **version.scene_json,
        "sonic": {"extras": {"ambient_sample": str(asset_id)}},
    }
    version.save(update_fields=["scene_json"])
    assert owner_client.post(f"/api/projects3d/{project.public_id}/publish/").status_code == 200

    public_url = f"/api/pieces/3d/{project.public_id}/assets/{asset_id}/"
    anonymous = APIClient()
    assert anonymous.get(public_url).status_code == 200

    version.scene_json = {**version.scene_json, "sonic": {"extras": {}}}
    version.save(update_fields=["scene_json"])
    assert anonymous.get(public_url).status_code == 404

    version.scene_json = {
        **version.scene_json,
        "sonic": {"extras": {"ambient_sample": str(asset_id)}},
    }
    version.save(update_fields=["scene_json"])
    assert owner_client.post(f"/api/projects3d/{project.public_id}/unpublish/").status_code == 200
    assert anonymous.get(public_url).status_code == 404
