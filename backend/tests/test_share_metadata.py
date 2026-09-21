"""Issue #653 public share metadata/image privacy and dimension contracts."""

import json
from io import BytesIO
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from scenes.models import (
    ArtPiece,
    ArtPieceThumbnail,
    ArtPieceVersion,
    Project,
    Project3D,
    SceneVersion,
    SceneVersion3D,
)

FIXTURES = Path(__file__).resolve().parent.parent.parent / "schema" / "fixtures"


@pytest.fixture
def public_records(db):
    owner = get_user_model().objects.create_user(username="share-owner")
    scene_version = SceneVersion.objects.create(
        project=Project.objects.create(
            owner=owner,
            title='2D "share" <script>alert(1)</script>',
            description="2D description",
        ),
        sequence=1,
        scene_json=json.loads((FIXTURES / "valid" / "blank.json").read_text()),
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )
    project = scene_version.project
    project.current_version = scene_version
    project.visibility = Project.Visibility.PUBLIC
    project.published_at = timezone.now()
    project.save(update_fields=["current_version", "visibility", "published_at"])

    scene3d_version = SceneVersion3D.objects.create(
        project=Project3D.objects.create(owner=owner, title="3D share"),
        sequence=1,
        scene_json=json.loads(
            (FIXTURES / "../fixtures3d/valid/minimal.json").resolve().read_text()
        ),
        created_by=owner,
        origin=SceneVersion3D.Origin.MANUAL,
    )
    project3d = scene3d_version.project
    project3d.current_version = scene3d_version
    project3d.visibility = Project3D.Visibility.PUBLIC
    project3d.published_at = timezone.now()
    project3d.save(update_fields=["current_version", "visibility", "published_at"])

    version = ArtPieceVersion.objects.create(
        piece=ArtPiece.objects.create(
            owner=owner,
            title="Generated share",
            description="Generated description",
            prompt="share",
            engine=ArtPiece.Engine.CANVAS2D,
            status=ArtPiece.Status.PUBLISHED,
            published_at=timezone.now(),
        ),
        sequence=1,
        source='<canvas id="art-piece-canvas" width="320" height="240"></canvas>',
        capabilities={},
    )
    piece = version.piece
    piece.current_version = version
    piece.save(update_fields=["current_version"])
    image = BytesIO()
    Image.new("RGB", (320, 240), (30, 120, 220)).save(image, format="PNG")
    ArtPieceThumbnail.objects.create(
        version=version,
        image_data=image.getvalue(),
        width=320,
        height=240,
        content_type="image/png",
        is_fallback=False,
    )
    return project, project3d, piece


@pytest.mark.django_db(transaction=True)
def test_public_share_metadata_and_images_are_canonical_and_1200x630(public_records):
    project, project3d, piece = public_records
    client = APIClient()

    for kind, record in (("2d", project), ("3d", project3d), ("generated", piece)):
        metadata = client.get(f"/api/public/share-meta/{kind}/{record.public_id}/")
        assert metadata.status_code == 200
        assert metadata.data["title"] == record.title
        assert metadata.data["image_url"] is not None
        image = client.get(metadata.data["image_url"])
        assert image.status_code == 200
        with Image.open(BytesIO(image.content)) as decoded:
            assert decoded.size == (1200, 630)
            assert decoded.format == "PNG"


@pytest.mark.django_db(transaction=True)
def test_private_records_have_no_share_metadata_or_image(public_records):
    project, project3d, piece = public_records
    project.visibility = Project.Visibility.PRIVATE
    project.save(update_fields=["visibility"])
    project3d.visibility = Project3D.Visibility.PRIVATE
    project3d.save(update_fields=["visibility"])
    piece.status = ArtPiece.Status.DRAFT
    piece.save(update_fields=["status"])
    client = APIClient()

    for kind, record in (("2d", project), ("3d", project3d), ("generated", piece)):
        assert client.get(f"/api/public/share-meta/{kind}/{record.public_id}/").status_code == 404
        assert (
            client.get(f"/api/public/share-image/{kind}/{record.public_id}.png").status_code == 404
        )
