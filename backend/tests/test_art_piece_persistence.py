"""Issue #314 API/privacy/concurrency regression coverage."""

from __future__ import annotations

from io import BytesIO

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from scenes.models import ArtPiece, ArtPieceVersion
from scenes.thumbnails import FALLBACK_PNG_BYTES

SOURCE = '<canvas id="art-piece-canvas"></canvas>'


def _png_bytes(width: int, height: int, color: tuple[int, int, int] = (37, 99, 235)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (width, height), color).save(buffer, format="PNG")
    return buffer.getvalue()


def _png_upload(width: int = 320, height: int = 240, name: str = "thumb.png") -> SimpleUploadedFile:
    return SimpleUploadedFile(name, _png_bytes(width, height), content_type="image/png")


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="piece-owner")


@pytest.fixture
def client(owner):
    api = APIClient()
    api.force_authenticate(owner)
    return api


def create_piece(client):
    response = client.post(
        "/api/art-pieces/",
        {
            "prompt": "a calm blue piece",
            "engine": "canvas2d",
            "source": SOURCE,
            "title": "Blue",
            "description": "A public piece",
        },
        format="json",
    )
    assert response.status_code == 201
    return response


def test_create_defaults_to_draft_and_persists_fallback_thumbnail(client):
    # Issue #438: Django never renders a piece's arbitrary generated
    # source -- the thumbnail row created at piece/version creation is
    # always the neutral fallback placeholder until a real browser
    # capture is uploaded through ArtPieceThumbnailUploadView.
    response = create_piece(client)
    assert response.data["status"] == "draft"
    assert response.data["current_version"]["sequence"] == 1
    piece = ArtPiece.objects.get(public_id=response.data["public_id"])
    assert piece.current_version.thumbnail.width == 320
    assert piece.current_version.thumbnail.height == 240
    assert piece.current_version.thumbnail.is_fallback is True


def test_publish_requires_meaningful_metadata_and_public_detail_hides_prompt(client):
    response = create_piece(client)
    public_id = response.data["public_id"]
    published = client.patch(
        f"/api/art-pieces/{public_id}/", {"status": "published"}, format="json"
    )
    assert published.status_code == 200
    public = APIClient().get(f"/api/public/art-pieces/{public_id}/")
    assert public.status_code == 200
    assert "prompt" not in public.data
    assert "source" in public.data["current_version"]


def test_private_piece_is_not_confirmed_to_anonymous_or_other_user(client, owner):
    response = create_piece(client)
    public_id = response.data["public_id"]
    assert APIClient().get(f"/api/public/art-pieces/{public_id}/").status_code == 404
    other = get_user_model().objects.create_user(username="piece-other")
    other_client = APIClient()
    other_client.force_authenticate(other)
    assert other_client.get(f"/api/art-pieces/{public_id}/").status_code == 404


def test_publish_and_unpublish_change_public_list_immediately(client):
    response = create_piece(client)
    public_id = response.data["public_id"]
    client.patch(f"/api/art-pieces/{public_id}/", {"status": "published"}, format="json")
    assert len(APIClient().get("/api/public/art-pieces/").data) == 1
    client.patch(f"/api/art-pieces/{public_id}/", {"status": "draft"}, format="json")
    assert APIClient().get(f"/api/public/art-pieces/{public_id}/").status_code == 404


def test_capabilities_are_allowlisted(client):
    response = client.post(
        "/api/art-pieces/",
        {
            "prompt": "piece",
            "engine": "svg",
            "source": "<svg />",
            "capabilities": {"not_real": True},
        },
        format="json",
    )
    assert response.status_code == 400


def test_new_version_updates_current_and_existing_version_is_immutable(client):
    response = create_piece(client)
    public_id = response.data["public_id"]
    version = client.post(
        f"/api/art-pieces/{public_id}/versions/",
        {"source": "<svg />", "capabilities": {"fullscreen": True}},
        format="json",
    )
    assert version.status_code == 201
    assert version.data["sequence"] == 2
    piece = ArtPiece.objects.get(public_id=public_id)
    assert piece.current_version_id == version.data["id"]
    piece.current_version.source = "changed"
    with pytest.raises(ValidationError):
        piece.current_version.save()


def test_public_thumbnail_is_reachable_only_after_publish(client):
    response = create_piece(client)
    public_id = response.data["public_id"]
    assert APIClient().get(f"/api/public/art-pieces/{public_id}/thumbnail.png").status_code == 404
    client.patch(f"/api/art-pieces/{public_id}/", {"status": "published"}, format="json")
    thumbnail = APIClient().get(f"/api/public/art-pieces/{public_id}/thumbnail.png")
    assert thumbnail.status_code == 200
    assert thumbnail["Content-Type"] == "image/png"


def test_regenerate_endpoint_resets_to_fallback(client):
    # #438: /thumbnail/regenerate/ is the "capture failed/timed out"
    # path -- it only ever resets to the fallback, never renders anything
    # itself.
    response = create_piece(client)
    public_id = response.data["public_id"]
    version_id = response.data["current_version"]["id"]
    upload = client.post(
        f"/api/art-pieces/{public_id}/versions/{version_id}/thumbnail/",
        {"image": _png_upload()},
        format="multipart",
    )
    assert upload.status_code == 200
    piece = ArtPiece.objects.get(public_id=public_id)
    assert piece.current_version.thumbnail.is_fallback is False

    reset = client.post(f"/api/art-pieces/{public_id}/thumbnail/regenerate/")
    assert reset.status_code == 200
    assert reset.data["is_fallback"] is True
    piece.refresh_from_db()
    assert piece.current_version.thumbnail.is_fallback is True
    assert bytes(piece.current_version.thumbnail.image_data) == FALLBACK_PNG_BYTES


def test_thumbnail_upload_replaces_fallback_with_real_capture(client):
    response = create_piece(client)
    public_id = response.data["public_id"]
    version_id = response.data["current_version"]["id"]
    piece = ArtPiece.objects.get(public_id=public_id)
    assert piece.current_version.thumbnail.is_fallback is True

    png = _png_bytes(320, 240)
    upload = client.post(
        f"/api/art-pieces/{public_id}/versions/{version_id}/thumbnail/",
        {"image": SimpleUploadedFile("thumb.png", png, content_type="image/png")},
        format="multipart",
    )
    assert upload.status_code == 200
    assert upload.data["is_fallback"] is False
    piece.refresh_from_db()
    assert piece.current_version.thumbnail.is_fallback is False
    assert bytes(piece.current_version.thumbnail.image_data) == png


def test_thumbnail_upload_rejects_wrong_dimensions_and_wrong_format(client):
    response = create_piece(client)
    public_id = response.data["public_id"]
    version_id = response.data["current_version"]["id"]

    wrong_size = client.post(
        f"/api/art-pieces/{public_id}/versions/{version_id}/thumbnail/",
        {"image": _png_upload(width=640, height=480)},
        format="multipart",
    )
    assert wrong_size.status_code == 400

    buffer = BytesIO()
    Image.new("RGB", (320, 240), (10, 10, 10)).save(buffer, format="JPEG")
    wrong_format = client.post(
        f"/api/art-pieces/{public_id}/versions/{version_id}/thumbnail/",
        {"image": SimpleUploadedFile("thumb.jpg", buffer.getvalue(), content_type="image/jpeg")},
        format="multipart",
    )
    assert wrong_format.status_code == 400

    # Neither rejected upload disturbed the existing fallback thumbnail.
    piece = ArtPiece.objects.get(public_id=public_id)
    assert piece.current_version.thumbnail.is_fallback is True


def test_thumbnail_upload_denied_for_non_owner_without_existence_leakage(client, owner):
    response = create_piece(client)
    public_id = response.data["public_id"]
    version_id = response.data["current_version"]["id"]

    other = get_user_model().objects.create_user(username="piece-thumbnail-other")
    other_client = APIClient()
    other_client.force_authenticate(other)
    denied = other_client.post(
        f"/api/art-pieces/{public_id}/versions/{version_id}/thumbnail/",
        {"image": _png_upload()},
        format="multipart",
    )
    assert denied.status_code == 404

    anonymous_denied = APIClient().post(
        f"/api/art-pieces/{public_id}/versions/{version_id}/thumbnail/",
        {"image": _png_upload()},
        format="multipart",
    )
    assert anonymous_denied.status_code == 404

    piece = ArtPiece.objects.get(public_id=public_id)
    assert piece.current_version.thumbnail.is_fallback is True


def test_stale_version_upload_cannot_attach_to_a_newer_current_version(client):
    # #438's concurrency/staleness criterion: an upload captured against
    # an older version (e.g. a slow browser capture that finishes after
    # a newer version was already saved) must land on that exact
    # version's own thumbnail row -- never on whatever is "current" by
    # the time the upload lands.
    response = create_piece(client)
    public_id = response.data["public_id"]
    old_version_id = response.data["current_version"]["id"]

    new_version = client.post(
        f"/api/art-pieces/{public_id}/versions/",
        {"source": "<svg />", "capabilities": {}},
        format="json",
    )
    assert new_version.status_code == 201
    new_version_id = new_version.data["id"]

    stale_png = _png_bytes(320, 240, color=(200, 30, 30))
    upload = client.post(
        f"/api/art-pieces/{public_id}/versions/{old_version_id}/thumbnail/",
        {"image": SimpleUploadedFile("stale.png", stale_png, content_type="image/png")},
        format="multipart",
    )
    assert upload.status_code == 200

    piece = ArtPiece.objects.get(public_id=public_id)
    old_version = ArtPieceVersion.objects.get(pk=old_version_id)
    new_version_obj = ArtPieceVersion.objects.get(pk=new_version_id)
    assert bytes(old_version.thumbnail.image_data) == stale_png
    assert old_version.thumbnail.is_fallback is False
    # The current version's own thumbnail is untouched by the stale
    # upload -- still the fallback it got at creation time.
    assert new_version_obj.thumbnail.is_fallback is True
    assert piece.current_version_id == new_version_id
