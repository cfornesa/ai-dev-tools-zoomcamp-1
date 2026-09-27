import io
import json
import zipfile

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from PIL import Image
from rest_framework.test import APIClient

from scenes.models import PieceIntakeAsset, PieceIntakeReceipt, Project, SceneVersion, SiteSettings
from scenes.piece_intake import _image_bytes


def _scene() -> dict:
    return {
        "schemaVersion": 1,
        "id": "scene-intake",
        "canvas": {"width": 800, "height": 600, "backgroundColor": "#ffffff"},
        "renderer": {"preferred": "p5"},
        "layers": [
            {"id": "layer-1", "name": "Layer 1", "order": 0, "visible": True, "locked": False}
        ],
        "shapes": [],
        "groups": [],
        "bindings": [],
        "graph": {"nodes": [], "connections": []},
        "accessibility": {"reducedMotion": "auto"},
        "randomness": {"seed": 0, "enabled": False},
    }


def _package() -> bytes:
    record = json.dumps(_scene()).encode()
    import hashlib

    manifest = {
        "formatVersion": 1,
        "kind": "2d",
        "metadata": {
            "title": "Imported",
            "description": "Imported fixture",
            "tags": [],
            "visibilityIntent": "public",
            "origin": {"appVersion": "test", "exportedAt": "2026-09-26T00:00:00Z"},
        },
        "records": [{"index": 0, "schemaVersion": 1, "fileIndex": 0}],
        "mediaAssets": [],
        "files": [
            {
                "index": 0,
                "path": "files/0.json",
                "byteSize": len(record),
                "sha256": hashlib.sha256(record).hexdigest(),
            }
        ],
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("manifest.json", json.dumps(manifest))
        archive.writestr("files/0.json", record)
    return output.getvalue()


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="intake-owner")


@pytest.fixture
def client(owner, monkeypatch):
    import scenes.piece_intake as intake

    monkeypatch.setattr(intake, "get_effective_cap", lambda user, feature: 1)
    settings = SiteSettings.get_solo()
    settings.cloud_sync_enabled = True
    settings.save(update_fields=["cloud_sync_enabled"])
    api = APIClient()
    api.force_authenticate(owner)
    return api


@pytest.mark.django_db
def test_intake_creates_private_piece_and_is_idempotent(client):
    package = _package()
    first = client.post(
        "/api/pieces/intake/",
        {"package": io.BytesIO(package), "idempotency_key": "one"},
        format="multipart",
    )
    assert first.status_code == 201
    assert first.json()["visibility"] == "private"
    assert Project.objects.count() == 1
    assert SceneVersion.objects.count() == 1
    replay = client.post(
        "/api/pieces/intake/",
        {"package": io.BytesIO(package), "idempotency_key": "one"},
        format="multipart",
    )
    assert replay.status_code == 200
    assert replay.json() == first.json()
    assert Project.objects.count() == 1
    assert PieceIntakeReceipt.objects.count() == 1


@pytest.mark.django_db
def test_intake_rejects_foreign_target_without_leaking_existence(client, owner):
    other = get_user_model().objects.create_user(username="other-intake-owner")
    project = Project.objects.create(owner=other)
    response = client.post(
        "/api/pieces/intake/",
        {"package": io.BytesIO(_package()), "piece_id": str(project.public_id)},
        format="multipart",
    )
    assert response.status_code == 404
    assert Project.objects.filter(owner=other).count() == 1
    assert PieceIntakeAsset.objects.count() == 0


@pytest.mark.django_db
def test_image_normalization_removes_exif_payload():
    image = Image.new("RGB", (2, 2), "red")
    exif = Image.Exif()
    exif[34853] = {}
    exif[270] = "GPS fixture metadata"
    import io

    source = io.BytesIO()
    image.save(source, format="JPEG", exif=exif)
    normalized = _image_bytes("image/jpeg", source.getvalue())
    assert normalized.startswith(b"\x89PNG")
    with Image.open(io.BytesIO(normalized)) as result:
        assert not result.getexif()
