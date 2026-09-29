"""Tests for the export-only ambient-sample contract (#1067)."""

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
def test_legacy_ambient_sample_sync_route_is_retired_without_writing(owner_client, owner):
    project = Project3D.objects.create(owner=owner)
    asset_id = uuid.uuid4()

    response = upload_sample(owner_client, project.public_id, asset_id)

    assert response.status_code == 410
    assert not PieceIntakeAsset.objects.filter(
        piece_public_id=project.public_id, source_asset_id=asset_id
    ).exists()


@pytest.mark.django_db
def test_legacy_ambient_sample_sync_route_does_not_validate_or_store_payload(owner_client, owner):
    project = Project3D.objects.create(owner=owner)
    asset_id = uuid.uuid4()

    response = upload_sample(owner_client, project.public_id, asset_id, mime="audio/flac")
    assert response.status_code == 410
    assert not PieceIntakeAsset.objects.filter(
        piece_public_id=project.public_id, source_asset_id=asset_id
    ).exists()


@pytest.mark.django_db
def test_public_delivery_rejects_ambient_sample_references(owner_client, owner):
    create_response = owner_client.post("/api/projects3d/")
    assert create_response.status_code == 201
    project = Project3D.objects.get(public_id=create_response.json()["id"])
    version = project.current_version
    assert version is not None
    asset_id = uuid.uuid4()
    PieceIntakeAsset.objects.create(
        owner=owner,
        piece_kind="3d",
        piece_public_id=project.public_id,
        source_asset_id=asset_id,
        filename="loop.mp3",
        mime_type="audio/mpeg",
        byte_size=12,
        checksum="0" * 64,
        data=b"sample-bytes",
    )
    version.scene_json = {
        **version.scene_json,
        "sonic": {"extras": {"ambient_sample": str(asset_id)}},
    }
    version.save(update_fields=["scene_json"])
    assert owner_client.post(f"/api/projects3d/{project.public_id}/publish/").status_code == 200

    public_url = f"/api/pieces/3d/{project.public_id}/assets/{asset_id}/"
    anonymous = APIClient()
    assert anonymous.get(public_url).status_code == 404
