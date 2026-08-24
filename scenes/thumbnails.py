"""Task 54: deterministic, artwork-only gallery-card thumbnails.

## Rendering approach (and why)

`frontend/src/render/p5Adapter.ts` (Task 25) is a browser-only renderer:
it draws into a real `<canvas>` via p5.js instance mode, which requires
DOM/WebGL-capable APIs Django has no access to. Three options exist for a
server-side thumbnail:

    (a) drive a headless browser/Chromium from Django,
    (b) have the browser render client-side and upload the resulting
        canvas image, or
    (c) a simplified server-side rasterizer that draws the canonical
        scene's shapes directly (Pillow), without going through p5.js.

This module implements **(c)**. No headless-browser infrastructure exists
in this project (no Playwright/Selenium/Chromium dependency anywhere in
`pyproject.toml`), so (a) would mean adding a heavy, fragile new runtime
dependency. (b) would couple thumbnail correctness to whichever client
happens to publish/save next, requires a signed upload endpoint, and
can't regenerate a thumbnail without a browser open — a poor fit for
Django-side "trigger on publish"/"trigger on version save" hooks. (c) is
fully server-controlled, deterministic, dependency-light (Pillow only),
and trivially satisfies acceptance criterion 2 ("artwork only... no
editor UI, private metadata, or hidden controls") because this rasterizer
*only* knows how to draw `schema/scene.schema.json` shape geometry: it
has no concept of UI chrome, cameras, prompts, or hidden controls to draw
in the first place.

## What gets drawn (mirrors `sceneDrawPlan.ts` + `p5Adapter.ts`)

Canvas background, then layers in ascending `order` (invisible layers
skipped), each layer's top-level groups (in `groups` array order) and
top-level shapes (`groupId: null`, in `shapes` array order), recursively
walking group `childIds` exactly like `sceneDrawPlan.ts`'s
`buildScenePlan`. A `particleEmitter` shape draws only its configured
static marker (position/size/first palette color) — never a live
simulation — identical in spirit to `p5Adapter.ts`'s own
`particleEmitter` case. There is no graph/binding evaluation anywhere in
this module: nothing here ever reads a camera signal, a gesture binding,
or the node graph, so "stable demo mode" (acceptance criterion 1) is true
by construction, not by a special-cased flag — the static scene tree is
the *only* thing this module knows how to draw.

## Determinism (acceptance criterion 3)

`randomness.seed`/`randomness.enabled` (Task 40) only affect *runtime*
graph nodes (seeded random-range/choice/noise/event) and the live
particle simulation (Task 39) — neither is evaluated here. So two
generations from the same immutable `SceneVersion.scene_json` are not
just "visually equivalent" but byte-identical PNGs: same input bytes in,
same deterministic drawing code, same output bytes out. Tests assert
this directly (`tests/test_thumbnails.py`).

## Card size (a documented gap in `_docs/plan.md`)

`_docs/plan.md` documents exactly one thumbnail size: the out-of-scope
1200x630 social-card PNG (Task 59, "Optional social-thumbnail ZIP"). It
never specifies a *gallery-card* size — Task 50 (public gallery) is not
built yet, so nothing in the repo defines one either. `CARD_WIDTH`/
`CARD_HEIGHT` below (320x240, 4:3) is this task's own documented choice,
picked to be small (cheap to generate/serve/store many of, appropriate
for a grid of cards) and clearly distinct from the 1200x630 social
export so the two are never confused. Whoever builds Task 50 should
either accept this size or change `CARD_WIDTH`/`CARD_HEIGHT` (a one-line
change — nothing else hardcodes 320x240) after checking actual gallery
layout needs.

## Cropping

A scene's own `canvas.width`/`canvas.height` (16-4096px, arbitrary
aspect ratio per `schema/scene.schema.json`) essentially never matches
the fixed 4:3 card aspect ratio. The full scene is rendered at its own
native resolution first, then fit to the card box with "cover" semantics
(scale to fill `CARD_WIDTH`x`CARD_HEIGHT`, cropping whichever axis
overflows, centered) — the same behavior as CSS `background-size:
cover`/`object-fit: cover`, so a card never shows letterboxing bars.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from io import BytesIO

from PIL import Image, ImageDraw, ImageOps

from scenes.validation import normalize_scene_layers, validate_scene

CARD_WIDTH = 320
CARD_HEIGHT = 240
CARD_ASPECT = CARD_WIDTH / CARD_HEIGHT

CIRCLE_SEGMENTS = 48

Matrix = tuple[float, float, float, float, float, float]
IDENTITY: Matrix = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)


class ThumbnailRenderError(Exception):
    """Raised when a scene document cannot be rasterized into a thumbnail.

    Covers both "the scene is invalid" (fails `validate_scene`) and any
    unexpected structural surprise while walking an otherwise-valid
    document — callers always catch this single exception type and fall
    back to `FALLBACK_PNG_BYTES` rather than propagating an arbitrary
    exception (KeyError, ZeroDivisionError, ...) out of the generation
    pipeline.
    """


# --- 2D affine matrix helpers (translate * rotate * scale, matching
# `p5Adapter.ts`'s `applyTransform`: `sk.translate(x,y); sk.rotate(rot);
# sk.scale(sx,sy)`) ---


def _matmul(m1: Matrix, m2: Matrix) -> Matrix:
    a1, b1, c1, d1, e1, f1 = m1
    a2, b2, c2, d2, e2, f2 = m2
    return (
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
    )


def _apply(m: Matrix, x: float, y: float) -> tuple[float, float]:
    a, b, c, d, e, f = m
    return (a * x + c * y + e, b * x + d * y + f)


def _effective_scale(m: Matrix) -> float:
    a, b, c, d, _e, _f = m
    return math.sqrt(abs(a * d - b * c)) or 1.0


def _transform_matrix(t: dict) -> Matrix:
    try:
        x, y = float(t["x"]), float(t["y"])
        rotation = math.radians(float(t["rotation"]))
        sx, sy = float(t["scaleX"]), float(t["scaleY"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ThumbnailRenderError(f"malformed transform: {t!r}") from exc
    cos_r, sin_r = math.cos(rotation), math.sin(rotation)
    translate: Matrix = (1.0, 0.0, 0.0, 1.0, x, y)
    rotate: Matrix = (cos_r, sin_r, -sin_r, cos_r, 0.0, 0.0)
    scale: Matrix = (sx, 0.0, 0.0, sy, 0.0, 0.0)
    return _matmul(_matmul(translate, rotate), scale)


def _hex_to_rgba(color: str | None, opacity: float = 1.0) -> tuple[int, int, int, int] | None:
    if color is None:
        return None
    h = color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    try:
        r = int(h[0:2], 16)
        g = int(h[2:4], 16)
        b = int(h[4:6], 16)
        a = int(h[6:8], 16) / 255 if len(h) >= 8 else 1.0
    except (ValueError, IndexError) as exc:
        raise ThumbnailRenderError(f"malformed color: {color!r}") from exc
    alpha = max(0.0, min(1.0, a * opacity))
    return (r, g, b, round(alpha * 255))


def _local_geometry(shape: dict) -> tuple[list[tuple[float, float]], bool, bool]:
    """Returns (local points, stroke_only, closed) for one shape's geometry.

    `stroke_only` means "never filled" (matches p5's `sk.line()`, which
    has no fill concept regardless of `style.fill`). Point coordinates are
    in the shape's own local frame — i.e. *after* its own transform would
    already have been applied to the drawing stack, exactly like
    `drawShapeGeometry` in `p5Adapter.ts`.
    """
    shape_type = shape.get("type")
    if shape_type == "circle":
        radius = float(shape["radius"])
        points = []
        for i in range(CIRCLE_SEGMENTS):
            theta = 2 * math.pi * i / CIRCLE_SEGMENTS
            points.append((radius * math.cos(theta), radius * math.sin(theta)))
        return points, False, True
    if shape_type == "rect":
        # cornerRadius is intentionally not rendered (documented module-level
        # limitation) -- a sharp-cornered rect is visually close enough for
        # a small gallery-card thumbnail.
        w, h = float(shape["width"]), float(shape["height"])
        return [(0.0, 0.0), (w, 0.0), (w, h), (0.0, h)], False, True
    if shape_type == "line":
        tx, ty = shape["transform"]["x"], shape["transform"]["y"]
        x2, y2 = float(shape["x2"]) - tx, float(shape["y2"]) - ty
        return [(0.0, 0.0), (x2, y2)], True, False
    if shape_type == "path":
        points = [(float(p["x"]), float(p["y"])) for p in shape["points"]]
        return points, False, bool(shape["closed"])
    if shape_type == "particleEmitter":
        radius = float(shape["size"]) / 2
        points = []
        for i in range(CIRCLE_SEGMENTS):
            theta = 2 * math.pi * i / CIRCLE_SEGMENTS
            points.append((radius * math.cos(theta), radius * math.sin(theta)))
        return points, False, True
    raise ThumbnailRenderError(f"unknown shape type: {shape_type!r}")


def _draw_shape(base: Image.Image, shape: dict, parent_matrix: Matrix, inherited_opacity: float):
    transform = shape["transform"]
    opacity = inherited_opacity * float(transform["opacity"])
    world_matrix = _matmul(parent_matrix, _transform_matrix(transform))
    local_points, stroke_only, closed = _local_geometry(shape)
    world_points = [_apply(world_matrix, x, y) for x, y in local_points]

    style = shape["style"]
    fill_hex = style.get("fill")
    if shape.get("type") == "particleEmitter" and shape.get("palette"):
        # Matches `drawShapeGeometry`'s particleEmitter case: the marker
        # uses the emitter's own palette when present, overriding style.fill.
        fill_hex = shape["palette"][0]
    stroke_hex = style.get("stroke")
    stroke_width = float(style.get("strokeWidth") or 0)

    if len(world_points) < 2:
        return

    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    if not stroke_only and fill_hex is not None and len(world_points) >= 3:
        fill_rgba = _hex_to_rgba(fill_hex, opacity)
        draw.polygon(world_points, fill=fill_rgba)

    if stroke_hex is not None and stroke_width > 0:
        scale_factor = _effective_scale(world_matrix)
        width_px = max(1, round(stroke_width * scale_factor))
        line_points = [*world_points, world_points[0]] if closed else world_points
        stroke_rgba = _hex_to_rgba(stroke_hex, opacity)
        draw.line(line_points, fill=stroke_rgba, width=width_px, joint="curve")

    base.alpha_composite(layer)


def _draw_node(base: Image.Image, node: dict, parent_matrix: Matrix, inherited_opacity: float):
    if node["kind"] == "shape":
        _draw_shape(base, node["shape"], parent_matrix, inherited_opacity)
        return

    group = node["group"]
    if not group.get("visible", True):
        return
    opacity = inherited_opacity * float(group["transform"]["opacity"])
    group_matrix = _matmul(parent_matrix, _transform_matrix(group["transform"]))
    for child in node["children"]:
        _draw_node(base, child, group_matrix, opacity)


@dataclass
class _ScenePlan:
    width: int
    height: int
    background_color: str
    nodes: list[dict]


def _build_scene_plan(scene: dict) -> _ScenePlan:
    """Validates `scene`, then builds an ordered draw tree.

    Mirrors `sceneDrawPlan.ts`'s `buildScenePlan`: layers in ascending
    `order` (invisible layers skipped entirely), each layer's top-level
    groups (array order) then top-level shapes (array order), each
    group's children walked in `childIds` order. `validate_scene`
    (`scenes/validation.py`) is the single source of truth for referential
    integrity/cycles/limits, so this function does not re-check those --
    it only needs to *read* an already-known-valid structure, matching
    the "backstop" role `sceneDrawPlan.ts` documents for its own
    `validateScene` call.
    """
    # Task 111 (issue #142): an already-published project's current
    # version may predate the shared-layerId invariant `validate_scene`
    # now enforces -- normalize before validating so an existing legacy
    # thumbnail generation request doesn't start failing, matching
    # `useEditorWorkspaceState.ts`'s identical normalization on the
    # editor's load path.
    scene, _ = normalize_scene_layers(scene)

    result = validate_scene(scene)
    if not result.valid:
        first = result.errors[0] if result.errors else None
        detail = f"{first.path} — {first.message}" if first else "invalid scene"
        raise ThumbnailRenderError(f"cannot render an invalid scene: {detail}")

    try:
        canvas = scene["canvas"]
        width, height = int(canvas["width"]), int(canvas["height"])
        background_color = canvas["backgroundColor"]

        layers = list(scene.get("layers") or [])
        groups = list(scene.get("groups") or [])
        shapes = list(scene.get("shapes") or [])

        groups_by_id = {g["id"]: g for g in groups}
        shapes_by_id = {s["id"]: s for s in shapes}
        child_group_ids = {cid for g in groups for cid in g["childIds"] if cid in groups_by_id}

        def build_group_node(group: dict) -> dict:
            children = []
            for cid in group["childIds"]:
                if cid in shapes_by_id:
                    children.append({"kind": "shape", "shape": shapes_by_id[cid]})
                elif cid in groups_by_id:
                    children.append(build_group_node(groups_by_id[cid]))
            return {"kind": "group", "group": group, "children": children}

        sorted_layers = sorted(layers, key=lambda layer: layer["order"])
        nodes: list[dict] = []
        for layer in sorted_layers:
            if not layer.get("visible", True):
                continue
            top_groups = [
                g for g in groups if g["layerId"] == layer["id"] and g["id"] not in child_group_ids
            ]
            top_shapes = [
                s for s in shapes if s["layerId"] == layer["id"] and s.get("groupId") is None
            ]
            for group in top_groups:
                nodes.append(build_group_node(group))
            for shape in top_shapes:
                nodes.append({"kind": "shape", "shape": shape})

        return _ScenePlan(
            width=width, height=height, background_color=background_color, nodes=nodes
        )
    except ThumbnailRenderError:
        raise
    except (KeyError, TypeError, ValueError, ZeroDivisionError) as exc:
        raise ThumbnailRenderError(f"malformed scene document: {exc}") from exc


def render_scene_image(scene: dict) -> Image.Image:
    """Renders `scene` at its own native `canvas.width`x`canvas.height`.

    Raises `ThumbnailRenderError` for anything that stops it from
    producing a well-formed image -- an invalid scene document, or any
    other malformed-input surprise while walking an otherwise-schema-valid
    document (defense in depth: `validate_scene` is the primary gate).
    """
    plan = _build_scene_plan(scene)
    bg = _hex_to_rgba(plan.background_color, 1.0) or (255, 255, 255, 255)
    try:
        base = Image.new("RGBA", (plan.width, plan.height), bg)
        for node in plan.nodes:
            _draw_node(base, node, IDENTITY, 1.0)
    except ThumbnailRenderError:
        raise
    except Exception as exc:  # noqa: BLE001 - any drawing failure becomes a safe fallback upstream
        raise ThumbnailRenderError(f"rendering failed: {exc}") from exc
    return base


def render_card_thumbnail(scene: dict) -> Image.Image:
    """Renders `scene`, then fits it to the fixed `CARD_WIDTH`x`CARD_HEIGHT`
    gallery-card box using "cover" semantics (scale to fill, center-crop
    the overflowing axis) -- see the module docstring's "Cropping"
    section.
    """
    full = render_scene_image(scene)
    # Flatten onto an opaque background: a card thumbnail is always fully
    # opaque (no transparency artifacts on gallery cards with unknown
    # backdrop color).
    opaque = Image.new("RGB", full.size, (255, 255, 255))
    opaque.paste(full, mask=full.split()[3])
    fitted = ImageOps.fit(
        opaque, (CARD_WIDTH, CARD_HEIGHT), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5)
    )
    return fitted


def render_card_thumbnail_png(scene: dict) -> bytes:
    """`render_card_thumbnail`, encoded as PNG bytes."""
    image = render_card_thumbnail(scene)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _build_fallback_png() -> bytes:
    """A static, deterministic, artwork-only placeholder used whenever
    generation fails (see `scenes.thumbnails.ensure_thumbnail_for_version`).
    Neutral flat color plus a simple centered mark -- never derived from
    scene content (a broken scene must never leak partial/garbled scene
    data into what gets served), and contains no text, UI chrome, or
    product branding.
    """
    image = Image.new("RGB", (CARD_WIDTH, CARD_HEIGHT), (226, 226, 230))
    draw = ImageDraw.Draw(image)
    cx, cy = CARD_WIDTH / 2, CARD_HEIGHT / 2
    r = min(CARD_WIDTH, CARD_HEIGHT) / 6
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(196, 196, 204))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


FALLBACK_PNG_BYTES = _build_fallback_png()
