"""#776: an ink layer over a generated 2D piece is validated, versioned, inherited, and public."""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scenes.ink_document import (
    metadata_with_inherited_ink,
    validate_ink_document,
)

SOURCE = '<canvas id="art-piece-canvas"></canvas>'


def stroke(shape_id: str = "s1", points: int = 3):
    return {
        "id": shape_id,
        "type": "path",
        "points": [{"x": float(i), "y": float(i * 2)} for i in range(points)],
        "closed": False,
        "fill": None,
        "stroke": "#112233",
        "strokeWidth": 4,
        "opacity": 0.8,
    }


def ink(*shapes):
    return {"width": 1280, "height": 720, "background": None, "shapes": list(shapes or [stroke()])}


@pytest.fixture
def owner(db):
    return get_user_model().objects.create_user(username="ink-owner")


@pytest.fixture
def client(owner):
    api = APIClient()
    api.force_authenticate(owner)
    return api


def create_piece(client, engine="canvas2d", source=SOURCE):
    response = client.post(
        "/api/art-pieces/",
        {
            "prompt": "an inked piece",
            "engine": engine,
            "source": source,
            "title": "Inked",
            "description": "A piece with ink",
        },
        format="json",
    )
    assert response.status_code == 201
    return response.data["public_id"]


def test_valid_ink_document_has_no_problems():
    assert validate_ink_document(ink(stroke("a"), stroke("b"))) == []


@pytest.mark.parametrize(
    "document",
    [
        "not-an-object",
        {"width": 1280, "height": 720, "shapes": [{"id": "x", "type": "script"}]},
        ink({**stroke(), "stroke": "javascript:alert(1)"}),
        ink({**stroke(), "id": "bad id!"}),
        ink(stroke("dup"), stroke("dup")),
        ink(stroke(points=2001)),
        {"width": 4, "height": 720, "background": None, "shapes": []},
    ],
)
def test_invalid_ink_documents_are_rejected(document):
    assert validate_ink_document(document)


def test_too_many_shapes_is_rejected():
    document = ink(*[stroke(f"s{i}", 2) for i in range(501)])
    assert any("limit" in problem for problem in validate_ink_document(document))


def test_saving_ink_creates_a_new_version_with_identical_source(client):
    public_id = create_piece(client)
    response = client.post(
        f"/api/art-pieces/{public_id}/versions/",
        {"source": SOURCE, "generation_metadata": {"ink": ink()}},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["sequence"] == 2
    assert response.data["source"] == SOURCE
    assert response.data["ink"]["shapes"][0]["id"] == "s1"
    versions = {v["sequence"]: v for v in client.get(f"/api/art-pieces/{public_id}/versions/").data}
    assert versions[1]["ink"] is None  # the earlier version is untouched


def test_invalid_ink_is_rejected_with_a_readable_error(client):
    public_id = create_piece(client)
    response = client.post(
        f"/api/art-pieces/{public_id}/versions/",
        {"source": SOURCE, "generation_metadata": {"ink": {"width": 1, "shapes": "x"}}},
        format="json",
    )
    assert response.status_code == 400


def test_ink_is_only_allowed_on_2d_pieces(client):
    source = "const scene = new THREE.Scene();"
    public_id = create_piece(client, engine="threejs", source=source)
    response = client.post(
        f"/api/art-pieces/{public_id}/versions/",
        {"source": source, "generation_metadata": {"ink": ink()}},
        format="json",
    )
    assert response.status_code == 400


def test_source_only_edits_inherit_the_previous_ink_and_null_clears_it(client):
    public_id = create_piece(client)
    client.post(
        f"/api/art-pieces/{public_id}/versions/",
        {"source": SOURCE, "generation_metadata": {"ink": ink()}},
        format="json",
    )
    edited = client.post(
        f"/api/art-pieces/{public_id}/versions/", {"source": SOURCE + "<!-- x -->"}, format="json"
    )
    assert edited.data["ink"]["shapes"][0]["id"] == "s1"
    cleared = client.post(
        f"/api/art-pieces/{public_id}/versions/",
        {"source": SOURCE, "generation_metadata": {"ink": None}},
        format="json",
    )
    assert cleared.data["ink"] is None


def test_public_piece_exposes_ink_but_never_the_prompt(client):
    public_id = create_piece(client)
    client.post(
        f"/api/art-pieces/{public_id}/versions/",
        {
            "source": SOURCE,
            "generation_metadata": {
                "ink": ink(),
                "aspect_ratio": "4:3",
                "model_label": "private model",
            },
        },
        format="json",
    )
    client.patch(f"/api/art-pieces/{public_id}/", {"status": "published"}, format="json")
    public = APIClient().get(f"/api/public/art-pieces/{public_id}/")
    assert public.data["current_version"]["ink"]["width"] == 1280
    assert "prompt" not in public.data
    assert "generation_metadata" not in public.data["current_version"]
    assert public.data["current_version"]["presentation"] == {"aspect_ratio": "4:3"}


def test_public_piece_allowlists_dimension_presentation_metadata(client):
    public_id = create_piece(client)
    client.post(
        f"/api/art-pieces/{public_id}/versions/",
        {
            "source": SOURCE,
            "generation_metadata": {
                "canvas": {"width": 320, "height": 240},
                "provider": "private provider",
            },
        },
        format="json",
    )
    client.patch(f"/api/art-pieces/{public_id}/", {"status": "published"}, format="json")
    public = APIClient().get(f"/api/public/art-pieces/{public_id}/")
    assert public.data["current_version"]["presentation"] == {"width": 320, "height": 240}
    assert "provider" not in public.data["current_version"]


def test_metadata_inheritance_helper_prefers_an_explicit_ink():
    previous = {"ink": ink(stroke("old"))}
    assert metadata_with_inherited_ink(previous, {"a": 1})["ink"]["shapes"][0]["id"] == "old"
    explicit = metadata_with_inherited_ink(previous, {"ink": ink(stroke("new"))})
    assert explicit["ink"]["shapes"][0]["id"] == "new"
    assert "ink" not in metadata_with_inherited_ink(previous, {"ink": None})
