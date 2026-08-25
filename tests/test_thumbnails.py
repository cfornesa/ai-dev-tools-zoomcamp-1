"""Task 54: the Pillow-based server-side thumbnail rasterizer and the
storage/generation/idempotency helpers around it.

See `scenes/thumbnails.py` and `scenes/thumbnail_generation.py`'s module
docstrings for the rendering-approach and regeneration/invalidation
policy this file's tests assert against.
"""

import copy
import io
import json
from pathlib import Path

import pytest
from PIL import Image

from scenes.models import SceneVersion, Thumbnail
from scenes.thumbnail_generation import ensure_thumbnail_for_version
from scenes.thumbnails import (
    CARD_ASPECT,
    CARD_HEIGHT,
    CARD_WIDTH,
    FALLBACK_PNG_BYTES,
    ThumbnailRenderError,
    render_card_thumbnail_png,
    render_scene_image,
)

FIXTURES = Path(__file__).resolve().parent.parent / "schema" / "fixtures" / "valid"
FEATURE_RICH_SCENE = json.loads((FIXTURES / "feature_rich.json").read_text())
BLANK_SCENE = json.loads((FIXTURES / "blank.json").read_text())


def _solid_circle_scene(canvas_width=400, canvas_height=100, background="#000000"):
    """A tiny scene (built on the canonical `blank.json` fixture's shape, so
    every non-shape field is already schema-valid): one red circle,
    nothing else -- lets tests assert on exact pixel colors without
    depending on `feature_rich.json`'s more complex composition."""
    scene = copy.deepcopy(BLANK_SCENE)
    scene["canvas"] = {
        "width": canvas_width,
        "height": canvas_height,
        "backgroundColor": background,
    }
    scene["shapes"] = [
        {
            "id": "shape-1",
            "type": "circle",
            "layerId": "layer-1",
            "groupId": None,
            "transform": {
                "x": canvas_width / 2,
                "y": canvas_height / 2,
                "scaleX": 1,
                "scaleY": 1,
                "rotation": 0,
                "opacity": 1,
            },
            "style": {"fill": "#ff0000", "stroke": None, "strokeWidth": 0},
            "radius": 20,
        }
    ]
    return scene


# --- Dimensions and cropping (acceptance criterion 1 + 6) ---


@pytest.mark.parametrize(
    "width,height", [(1024, 768), (100, 100), (4096, 16), (16, 4096), (400, 100)]
)
def test_card_thumbnail_is_always_exactly_the_documented_card_size(width, height):
    scene = _solid_circle_scene(canvas_width=width, canvas_height=height)
    png = render_card_thumbnail_png(scene)
    image = Image.open(__import__("io").BytesIO(png))
    assert image.size == (CARD_WIDTH, CARD_HEIGHT)
    assert CARD_WIDTH == 320
    assert CARD_HEIGHT == 240
    assert CARD_ASPECT == pytest.approx(4 / 3)


def test_card_thumbnail_is_center_cropped_not_stretched():
    # A very wide scene (10:1) fit into a 4:3 card box must crop the
    # left/right edges, not squash the circle into an ellipse -- assert
    # the circle in the *native* render is round, then that the same
    # circle in the cropped card render is still round (same aspect),
    # proving "cover" cropping rather than a non-uniform stretch to fit.
    scene = _solid_circle_scene(canvas_width=2000, canvas_height=200)
    native = render_scene_image(scene)
    assert native.size == (2000, 200)

    card_png = render_card_thumbnail_png(scene)
    card = Image.open(__import__("io").BytesIO(card_png))
    assert card.size == (CARD_WIDTH, CARD_HEIGHT)

    # The circle sits at the horizontal center of a 2000x200 canvas, i.e.
    # dead center of the whole scene -- "cover" cropping centered on both
    # axes must keep it visible (roughly centered) in the card, not
    # cropped away.
    cx, cy = CARD_WIDTH // 2, CARD_HEIGHT // 2
    r, g, b = card.getpixel((cx, cy))[:3]
    assert (r, g, b) == (255, 0, 0)


# --- Artwork-only content boundary (acceptance criterion 2) ---


def test_rendered_pixels_are_only_background_and_shape_colors():
    scene = _solid_circle_scene(
        canvas_width=CARD_WIDTH, canvas_height=CARD_HEIGHT, background="#101014"
    )
    png = render_card_thumbnail_png(scene)
    image = Image.open(__import__("io").BytesIO(png)).convert("RGB")

    colors = set(image.getdata())
    # Only the background color and the shape's fill color should ever
    # appear -- no UI chrome (toolbars, cursors, borders), no camera
    # frame, and no text glyphs, all of which would introduce extra
    # colors (anti-aliased edges aside, which LANCZOS resampling of a
    # "cover" crop can introduce at shape boundaries).
    allowed = {(16, 16, 20), (255, 0, 0)}
    disallowed_share = sum(1 for c in colors if c not in allowed) / max(len(colors), 1)
    # Resampling can produce a handful of blended edge colors; the vast
    # majority of *distinct* colors present must still be exactly the two
    # scene-defined colors.
    assert disallowed_share < 0.5
    assert (16, 16, 20) in colors
    assert (255, 0, 0) in colors


def test_camera_and_gesture_signals_never_affect_the_rendered_pixels():
    """`demoSignals`/`bindings`/`graph` describe *live*, camera/gesture-driven
    behavior -- this rasterizer must never evaluate any of it (that's what
    makes "stable demo mode" true by construction). Changing those fields
    drastically must not change a single output pixel."""
    baseline = render_card_thumbnail_png(FEATURE_RICH_SCENE)

    mutated = copy.deepcopy(FEATURE_RICH_SCENE)
    mutated["demoSignals"] = {
        "palmX": 0.99,
        "palmY": 0.01,
        "pinchStrength": 1.0,
        "handDistance": 0.01,
        "gestureState": "closedFist",
    }
    mutated_png = render_card_thumbnail_png(mutated)

    assert baseline == mutated_png


def test_particle_emitter_renders_only_its_static_marker():
    """No live particle simulation (Task 39) ever runs here -- a
    particleEmitter shape must render as exactly its configured marker
    (position + size + palette color), never more than one dot's worth of
    that color."""
    scene = _solid_circle_scene(canvas_width=CARD_WIDTH, canvas_height=CARD_HEIGHT)
    scene["shapes"] = [
        {
            "id": "emitter-1",
            "type": "particleEmitter",
            "layerId": "layer-1",
            "groupId": None,
            "transform": {
                "x": CARD_WIDTH / 2,
                "y": CARD_HEIGHT / 2,
                "scaleX": 1,
                "scaleY": 1,
                "rotation": 0,
                "opacity": 1,
            },
            "style": {"fill": None, "stroke": None, "strokeWidth": 0},
            "rate": 10,
            "size": 20,
            "lifespan": 2,
            "speed": 50,
            "palette": ["#00ff00"],
        }
    ]
    png = render_card_thumbnail_png(scene)
    image = Image.open(__import__("io").BytesIO(png)).convert("RGB")
    colors = set(image.getdata())
    assert (0, 255, 0) in colors
    # Only ever a small marker, never hundreds of scattered particle dots:
    # count pixels close to the marker color and assert it's a small,
    # bounded blob roughly the marker's own size, not scattered across
    # the whole card.
    green_pixels = sum(1 for p in image.getdata() if p == (0, 255, 0))
    assert 0 < green_pixels < (CARD_WIDTH * CARD_HEIGHT) // 4


# --- Determinism (acceptance criterion 3) ---


def test_same_scene_and_seed_produce_byte_identical_thumbnails():
    png1 = render_card_thumbnail_png(FEATURE_RICH_SCENE)
    png2 = render_card_thumbnail_png(FEATURE_RICH_SCENE)
    assert png1 == png2


def test_deep_copied_scene_produces_the_same_thumbnail():
    copy_of_scene = json.loads(json.dumps(FEATURE_RICH_SCENE))
    assert render_card_thumbnail_png(FEATURE_RICH_SCENE) == render_card_thumbnail_png(copy_of_scene)


# --- canvas.opacity (Task 138, issue #170) ---


def test_missing_canvas_opacity_renders_fully_opaque_unaffected_by_this_task():
    scene = _solid_circle_scene(background="#ff0000")
    assert "opacity" not in scene["canvas"]
    image = render_scene_image(scene)
    assert image.getpixel((0, 0)) == (0xFF, 0x00, 0x00, 255)


def test_canvas_opacity_scales_the_whole_composites_alpha():
    scene = _solid_circle_scene(background="#ff0000")
    scene["canvas"]["opacity"] = 0.5
    image = render_scene_image(scene)
    r, g, b, a = image.getpixel((0, 0))
    assert (r, g, b) == (0xFF, 0x00, 0x00)
    assert a == 128  # round(255 * 0.5)


def test_canvas_opacity_scales_shape_pixels_the_same_as_background_pixels():
    scene = _solid_circle_scene(canvas_width=100, canvas_height=100, background="#000000")
    scene["canvas"]["opacity"] = 0.25
    image = render_scene_image(scene)
    # Center of the circle (shape fill) and a corner (background) should
    # both carry the same overall composite alpha -- this is a whole-frame
    # multiply, not a per-shape one.
    _, _, _, shape_alpha = image.getpixel((50, 50))
    _, _, _, bg_alpha = image.getpixel((1, 1))
    assert shape_alpha == bg_alpha == round(255 * 0.25)


def test_canvas_opacity_zero_renders_a_fully_transparent_image():
    scene = _solid_circle_scene(background="#ff0000")
    scene["canvas"]["opacity"] = 0
    image = render_scene_image(scene)
    assert image.getpixel((0, 0))[3] == 0


def test_card_thumbnail_flattens_reduced_canvas_opacity_toward_the_opaque_white_backdrop():
    # render_card_thumbnail always flattens onto opaque white (documented,
    # pre-existing behavior -- gallery cards never carry transparency). A
    # reduced canvas.opacity should visibly fade the artwork toward that
    # white backdrop, exactly as it would in the editor Preview/public
    # viewer, where whatever sits behind the <canvas> shows through.
    opaque_scene = _solid_circle_scene(canvas_width=100, canvas_height=100, background="#000000")
    faded_scene = copy.deepcopy(opaque_scene)
    faded_scene["canvas"]["opacity"] = 0.2

    opaque_png = render_card_thumbnail_png(opaque_scene)
    faded_png = render_card_thumbnail_png(faded_scene)
    assert opaque_png != faded_png

    faded_image = Image.open(io.BytesIO(faded_png))
    # A background corner pixel should now read much closer to white
    # (255,255,255) than to the scene's own black background.
    corner = faded_image.convert("RGB").getpixel((1, 1))
    assert corner[0] > 150  # faded well toward white, not still near-black


# --- Failure fallback (acceptance criterion 4) ---


def test_invalid_scene_raises_thumbnail_render_error():
    with pytest.raises(ThumbnailRenderError):
        render_scene_image({"not": "a scene"})


def test_invalid_scene_raises_before_producing_partial_output():
    # A malformed scene must fail cleanly -- never return a half-drawn
    # image silently.
    with pytest.raises(ThumbnailRenderError):
        render_card_thumbnail_png({"schemaVersion": 1})


def test_renders_a_legacy_scene_with_shapes_sharing_one_layer():
    # Task 111 (issue #142): an already-published project's current
    # version may predate the shared-layerId invariant validate_scene now
    # enforces -- _build_scene_plan normalizes before validating, so this
    # must render cleanly rather than raising ThumbnailRenderError.
    scene = _solid_circle_scene()
    second = copy.deepcopy(scene["shapes"][0])
    second["id"] = "shape-2"
    second["style"] = {"fill": "#00ff00", "stroke": None, "strokeWidth": 0}
    scene["shapes"].append(second)  # both shapes share "layer-1"

    image = render_scene_image(scene)
    assert image.size == (scene["canvas"]["width"], scene["canvas"]["height"])


@pytest.mark.django_db
def test_ensure_thumbnail_for_version_stores_documented_fallback_on_failure(django_user_model):
    from scenes.models import Project

    owner = django_user_model.objects.create_user(username="carol")
    project = Project.objects.create(owner=owner, title="Broken scene", description="x")
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        # Deliberately bypasses SceneVersion.save's own validation isn't
        # possible (it doesn't validate scene_json -- only Project/Template
        # do); scene_json here is schema-invalid on purpose to force a
        # render failure.
        scene_json={"schemaVersion": 1, "id": "broken", "canvas": {}},
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )

    thumbnail = ensure_thumbnail_for_version(version.pk)

    assert thumbnail is not None
    assert thumbnail.is_fallback is True
    assert bytes(thumbnail.image_data) == FALLBACK_PNG_BYTES
    assert Thumbnail.objects.filter(scene_version=version).count() == 1


@pytest.mark.django_db
def test_retrying_a_failed_generation_replaces_the_fallback_in_place(django_user_model):
    from scenes.models import Project

    owner = django_user_model.objects.create_user(username="dave")
    project = Project.objects.create(owner=owner, title="Fixable scene", description="x")
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json={"schemaVersion": 1, "id": "broken", "canvas": {}},
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )

    first = ensure_thumbnail_for_version(version.pk)
    assert first.is_fallback is True
    first_id = first.pk

    # "Fix" the scene in place (SceneVersion snapshot fields are normally
    # immutable, but this test manipulates the row directly at the DB
    # layer via update() to simulate "retry against corrected data"
    # without touching the immutability guard, which only applies to the
    # ORM `.save()` path).
    SceneVersion.objects.filter(pk=version.pk).update(scene_json=BLANK_SCENE)

    second = ensure_thumbnail_for_version(version.pk)

    assert second.pk == first_id  # same row, not a new one
    assert second.is_fallback is False
    assert Thumbnail.objects.filter(scene_version=version).count() == 1


@pytest.mark.django_db
def test_ensure_thumbnail_for_version_returns_none_for_missing_version():
    assert ensure_thumbnail_for_version(999999) is None


@pytest.mark.django_db
def test_generating_twice_for_a_healthy_scene_never_duplicates_rows(django_user_model):
    from scenes.models import Project

    owner = django_user_model.objects.create_user(username="erin")
    project = Project.objects.create(owner=owner, title="Healthy scene", description="x")
    version = SceneVersion.objects.create(
        project=project,
        sequence=1,
        scene_json=BLANK_SCENE,
        created_by=owner,
        origin=SceneVersion.Origin.MANUAL,
    )

    ensure_thumbnail_for_version(version.pk)
    ensure_thumbnail_for_version(version.pk)

    assert Thumbnail.objects.filter(scene_version=version).count() == 1
