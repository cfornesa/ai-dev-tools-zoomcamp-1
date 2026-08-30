"""Issue #243: the Pillow-based server-side 3D thumbnail rasterizer and
its storage/generation/idempotency helpers -- the 3D counterpart of
`tests/test_thumbnails.py`. See `scenes/thumbnails3d.py`'s module
docstring for the rendering-approach tradeoffs these tests assert
against.
"""

import copy
import io
import json
from pathlib import Path

import pytest
from PIL import Image

from scenes.thumbnails import CARD_HEIGHT, CARD_WIDTH, FALLBACK_PNG_BYTES
from scenes.thumbnails3d import (
    Thumbnail3DRenderError,
    render_card_thumbnail3d_png,
    render_scene3d_thumbnail,
)

FIXTURES3D = Path(__file__).resolve().parent.parent.parent / "schema" / "fixtures3d" / "valid"
MINIMAL_SCENE3D = json.loads((FIXTURES3D / "minimal.json").read_text())
FEATURE_RICH_SCENE3D = json.loads((FIXTURES3D / "feature_rich.json").read_text())


# --- Dimensions (acceptance criterion) ---


def test_card_thumbnail_is_always_exactly_the_documented_card_size():
    for scene in (MINIMAL_SCENE3D, FEATURE_RICH_SCENE3D):
        png = render_card_thumbnail3d_png(scene)
        image = Image.open(io.BytesIO(png))
        assert image.size == (CARD_WIDTH, CARD_HEIGHT)


def test_card_thumbnail_shares_the_2d_card_size_constants():
    assert CARD_WIDTH == 320
    assert CARD_HEIGHT == 240


# --- Determinism (mirrors thumbnails.py's identical guarantee) ---


def test_identical_scene_renders_byte_identical_png():
    first = render_card_thumbnail3d_png(FEATURE_RICH_SCENE3D)
    second = render_card_thumbnail3d_png(copy.deepcopy(FEATURE_RICH_SCENE3D))
    assert first == second


def test_output_is_a_valid_opaque_png():
    png = render_card_thumbnail3d_png(FEATURE_RICH_SCENE3D)
    image = Image.open(io.BytesIO(png))
    assert image.format == "PNG"
    assert image.mode == "RGB"


# --- Content reflects the scene (not a static placeholder) ---


def test_background_color_is_visible_in_a_corner_with_no_geometry():
    scene = copy.deepcopy(MINIMAL_SCENE3D)
    scene["scene"]["backgroundColor"] = "#123456"
    # Move the only object far away so it can't possibly cover the corner.
    if scene["objects"]:
        scene["objects"][0]["transform"]["position"] = {"x": 5000, "y": 5000, "z": 5000}
    image = render_scene3d_thumbnail(scene)
    corner = image.getpixel((2, 2))
    assert corner[:3] == (0x12, 0x34, 0x56)


def test_different_scenes_render_different_thumbnails():
    minimal_png = render_card_thumbnail3d_png(MINIMAL_SCENE3D)
    feature_rich_png = render_card_thumbnail3d_png(FEATURE_RICH_SCENE3D)
    assert minimal_png != feature_rich_png


def test_a_visible_object_actually_appears_on_canvas():
    """A single bright sphere directly in front of the camera must produce
    at least one pixel close to its material color somewhere on the
    card -- otherwise the renderer silently produced an empty frame."""
    scene = copy.deepcopy(MINIMAL_SCENE3D)
    scene["scene"]["backgroundColor"] = "#000000"
    scene["camera"] = {
        "position": {"x": 0, "y": 0, "z": 10},
        "target": {"x": 0, "y": 0, "z": 0},
        "fov": 60,
        "near": 0.1,
        "far": 1000,
    }
    scene["groups"] = []
    scene["lights"] = []
    scene["objects"] = [
        {
            "id": "obj-1",
            "type": "sphere",
            "groupId": None,
            "transform": {
                "position": {"x": 0, "y": 0, "z": 0},
                "rotation": {"x": 0, "y": 0, "z": 0},
                "scale": {"x": 1, "y": 1, "z": 1},
                "opacity": 1,
            },
            "material": {"color": "#ff0000", "opacity": 1},
            "visible": True,
            "radius": 2,
        }
    ]
    image = render_scene3d_thumbnail(scene)
    center = image.getpixel((CARD_WIDTH // 2, CARD_HEIGHT // 2))
    assert center[:3] == (0xFF, 0x00, 0x00)


def test_invisible_object_is_not_drawn():
    scene = copy.deepcopy(MINIMAL_SCENE3D)
    scene["scene"]["backgroundColor"] = "#000000"
    scene["camera"] = {
        "position": {"x": 0, "y": 0, "z": 10},
        "target": {"x": 0, "y": 0, "z": 0},
        "fov": 60,
        "near": 0.1,
        "far": 1000,
    }
    scene["groups"] = []
    scene["lights"] = []
    scene["objects"] = [
        {
            "id": "obj-1",
            "type": "sphere",
            "groupId": None,
            "transform": {
                "position": {"x": 0, "y": 0, "z": 0},
                "rotation": {"x": 0, "y": 0, "z": 0},
                "scale": {"x": 1, "y": 1, "z": 1},
                "opacity": 1,
            },
            "material": {"color": "#ff0000", "opacity": 1},
            "visible": False,
            "radius": 2,
        }
    ]
    image = render_scene3d_thumbnail(scene)
    center = image.getpixel((CARD_WIDTH // 2, CARD_HEIGHT // 2))
    assert center[:3] == (0x00, 0x00, 0x00)


def test_object_in_an_invisible_group_is_not_drawn():
    scene = copy.deepcopy(MINIMAL_SCENE3D)
    scene["scene"]["backgroundColor"] = "#000000"
    scene["camera"] = {
        "position": {"x": 0, "y": 0, "z": 10},
        "target": {"x": 0, "y": 0, "z": 0},
        "fov": 60,
        "near": 0.1,
        "far": 1000,
    }
    scene["lights"] = []
    scene["groups"] = [
        {
            "id": "group-1",
            "name": "Hidden",
            "transform": {
                "position": {"x": 0, "y": 0, "z": 0},
                "rotation": {"x": 0, "y": 0, "z": 0},
                "scale": {"x": 1, "y": 1, "z": 1},
                "opacity": 1,
            },
            "visible": False,
            "locked": False,
        }
    ]
    scene["objects"] = [
        {
            "id": "obj-1",
            "type": "sphere",
            "groupId": "group-1",
            "transform": {
                "position": {"x": 0, "y": 0, "z": 0},
                "rotation": {"x": 0, "y": 0, "z": 0},
                "scale": {"x": 1, "y": 1, "z": 1},
                "opacity": 1,
            },
            "material": {"color": "#ff0000", "opacity": 1},
            "visible": True,
            "radius": 2,
        }
    ]
    image = render_scene3d_thumbnail(scene)
    center = image.getpixel((CARD_WIDTH // 2, CARD_HEIGHT // 2))
    assert center[:3] == (0x00, 0x00, 0x00)


# --- Error handling (mirrors ThumbnailRenderError's contract) ---


def test_invalid_scene_raises_render_error():
    with pytest.raises(Thumbnail3DRenderError):
        render_scene3d_thumbnail({"not": "a valid scene3d document"})


def test_camera_at_its_own_target_raises_render_error_not_a_crash():
    scene = copy.deepcopy(MINIMAL_SCENE3D)
    scene["camera"]["position"] = {"x": 0, "y": 0, "z": 0}
    scene["camera"]["target"] = {"x": 0, "y": 0, "z": 0}
    with pytest.raises(Thumbnail3DRenderError):
        render_scene3d_thumbnail(scene)


def test_fallback_png_bytes_is_reused_from_the_2d_module():
    # Issue #243 deliberately reuses the same generic, artwork-neutral
    # fallback image rather than defining a second one -- see
    # scenes/thumbnail_generation3d.py's module docstring.
    image = Image.open(io.BytesIO(FALLBACK_PNG_BYTES))
    assert image.size == (CARD_WIDTH, CARD_HEIGHT)
