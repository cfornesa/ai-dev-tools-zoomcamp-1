import hashlib
import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.models import PieceIntakeAsset, Project


@pytest.mark.django_db
def test_public_piece_asset_is_anonymous_and_cacheable():
    owner = get_user_model().objects.create_user(username="public-asset-owner")
    piece = Project.objects.create(
        owner=owner,
        title="Public media",
        visibility=Project.Visibility.PUBLIC,
    )
    source_asset_id = uuid.uuid4()
    payload = b"asset-bytes"
    PieceIntakeAsset.objects.create(
        owner=owner,
        piece_kind="2d",
        piece_public_id=piece.public_id,
        source_asset_id=source_asset_id,
        filename="asset.bin",
        mime_type="application/octet-stream",
        byte_size=len(payload),
        checksum=hashlib.sha256(payload).hexdigest(),
        data=payload,
    )

    response = APIClient().get(
        f"/api/pieces/2d/{piece.public_id}/assets/{source_asset_id}/"
    )

    assert response.status_code == 200
    assert response.content == payload
    assert response["Content-Type"] == "application/octet-stream"
    assert response["X-Content-Type-Options"] == "nosniff"
    assert response["Cache-Control"] == "public, immutable"
    assert response["Access-Control-Allow-Origin"] == "*"


@pytest.mark.django_db
def test_private_piece_asset_does_not_leak_to_anonymous_client():
    owner = get_user_model().objects.create_user(username="private-asset-owner")
    piece = Project.objects.create(owner=owner, visibility=Project.Visibility.PRIVATE)
    source_asset_id = uuid.uuid4()
    PieceIntakeAsset.objects.create(
        owner=owner,
        piece_kind="2d",
        piece_public_id=piece.public_id,
        source_asset_id=source_asset_id,
        filename="asset.bin",
        mime_type="application/octet-stream",
        byte_size=1,
        checksum=hashlib.sha256(b"x").hexdigest(),
        data=b"x",
    )

    response = APIClient().get(
        f"/api/pieces/2d/{piece.public_id}/assets/{source_asset_id}/"
    )

    assert response.status_code == 404
