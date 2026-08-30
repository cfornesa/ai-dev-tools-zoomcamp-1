"""Issue #243: deterministic, artwork-only gallery-card thumbnails for the
3D scene document family (`schema/scene3d.schema.json`).

## Rendering approach (mirrors `scenes/thumbnails.py`'s reasoning)

Same constraint as the 2D renderer: no headless-browser/Three.js/A-Frame
runtime exists anywhere in this project (that gap is #244, tracked
separately and explicitly out of scope here). This module is a
simplified, dependency-light (Pillow only) server-side rasterizer that
projects `scene3d` geometry through the document's own camera using a
standard look-at + perspective projection, then draws each face as a
flat-shaded filled polygon in camera-facing order (a painter's-algorithm
depth sort, not a per-pixel z-buffer). There is no lighting model: the
`lights` array is read by nothing in this module, exactly like
`thumbnails.py` never evaluates graph/binding state -- only
`material.color`/`material.opacity` (and each object/group's own
`transform.opacity`) determine what gets drawn, so this stays "artwork
only" by construction.

## Card size

Reuses `scenes.thumbnails.CARD_WIDTH`/`CARD_HEIGHT` (320x240, 4:3) --
one gallery-card size for both document families, not two independently
chosen ones. Unlike the 2D renderer, there is no separate "render at
native size, then crop to cover" step: a 3D scene has no native pixel
size to begin with, so the camera's projection aspect ratio is set
directly to `CARD_WIDTH/CARD_HEIGHT`.

## Determinism

Exactly the same guarantee as `thumbnails.py`: `randomness.seed`/
`randomness.enabled` are declared in the schema for future runtime
features and are never read here, so two renders of the same immutable
`SceneVersion3D.scene_json` are byte-identical PNGs.

## Primitive approximations (documented, not full-fidelity)

- **box**: 6 flat-shaded quads (true geometry).
- **cylinder**: two N-gon caps plus N side quads (`_CYLINDER_SEGMENTS`),
  a faceted approximation rather than a smooth-shaded round surface --
  acceptable for a small gallery-card thumbnail.
- **plane**: a single quad, never backface-culled (a floor/backdrop plane
  must stay visible from the side it's typically viewed from regardless
  of which way its face normal happens to point).
- **sphere**: has no faces in the schema at all (just a `radius`), so it
  is drawn as a camera-facing filled ellipse ("billboard impostor") sized
  from its projected screen-space radius rather than a tessellated
  sphere mesh.

## Depth/visibility

Faces are backface-culled (skipped when their world-space normal points
away from the camera) except planes, then every remaining face across
every object is sorted back-to-front by average camera-space depth and
drawn in that order -- a whole-scene painter's algorithm. This is exact
for convex, non-overlapping primitives and only approximate for deeply
interpenetrating geometry, the same tradeoff `thumbnails.py` accepts by
not implementing a true per-pixel renderer.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from io import BytesIO

from PIL import Image, ImageDraw

from scenes.thumbnails import CARD_ASPECT, CARD_HEIGHT, CARD_WIDTH, FALLBACK_PNG_BYTES
from scenes.validation3d import validate_scene3d

__all__ = [
    "CARD_WIDTH",
    "CARD_HEIGHT",
    "FALLBACK_PNG_BYTES",
    "Thumbnail3DRenderError",
    "render_card_thumbnail3d_png",
]

_CYLINDER_SEGMENTS = 10
Vec3 = tuple[float, float, float]


class Thumbnail3DRenderError(Exception):
    """Raised when a `scene3d` document cannot be rasterized. Covers both
    "the scene is invalid" (fails `validate_scene3d`) and any unexpected
    structural surprise while walking an otherwise-valid document --
    callers always catch this single exception type and fall back to
    `FALLBACK_PNG_BYTES`, matching `thumbnails.ThumbnailRenderError`'s
    contract for the 2D pipeline.
    """


def _add(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def _sub(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _dot(a: Vec3, b: Vec3) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _cross(a: Vec3, b: Vec3) -> Vec3:
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def _length(a: Vec3) -> float:
    return math.sqrt(_dot(a, a))


def _normalize(a: Vec3) -> Vec3:
    length = _length(a)
    if length < 1e-9:
        raise Thumbnail3DRenderError("degenerate zero-length vector")
    return (a[0] / length, a[1] / length, a[2] / length)


def _vec3(data: dict) -> Vec3:
    try:
        return (float(data["x"]), float(data["y"]), float(data["z"]))
    except (KeyError, TypeError, ValueError) as exc:
        raise Thumbnail3DRenderError(f"malformed vec3: {data!r}") from exc


def _rotate_xyz(p: Vec3, rotation_deg: Vec3) -> Vec3:
    """Rotates `p` around X, then Y, then Z (degrees) -- the fixed order
    `schema/scene3d.schema.json`'s `eulerRotation` doc mandates every
    renderer use."""
    x, y, z = p
    rx, ry, rz = (math.radians(r) for r in rotation_deg)

    cx, sx = math.cos(rx), math.sin(rx)
    y, z = y * cx - z * sx, y * sx + z * cx

    cy, sy = math.cos(ry), math.sin(ry)
    x, z = x * cy + z * sy, -x * sy + z * cy

    cz, sz = math.cos(rz), math.sin(rz)
    x, y = x * cz - y * sz, x * sz + y * cz

    return (x, y, z)


@dataclass
class _Transform:
    position: Vec3
    rotation: Vec3
    scale: Vec3
    opacity: float

    @classmethod
    def from_dict(cls, data: dict) -> _Transform:
        try:
            opacity = float(data["opacity"])
        except (KeyError, TypeError, ValueError) as exc:
            raise Thumbnail3DRenderError(f"malformed transform: {data!r}") from exc
        return cls(
            position=_vec3(data["position"]),
            rotation=_vec3(data["rotation"]),
            scale=_vec3(data["scale"]),
            opacity=opacity,
        )

    def apply(self, p: Vec3) -> Vec3:
        scaled = (p[0] * self.scale[0], p[1] * self.scale[1], p[2] * self.scale[2])
        rotated = _rotate_xyz(scaled, self.rotation)
        return _add(rotated, self.position)

    def average_scale(self) -> float:
        return (abs(self.scale[0]) + abs(self.scale[1]) + abs(self.scale[2])) / 3.0


def _hex_to_rgba(color: str | None, opacity: float) -> tuple[int, int, int, int] | None:
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
        raise Thumbnail3DRenderError(f"malformed color: {color!r}") from exc
    alpha = max(0.0, min(1.0, a * opacity))
    return (r, g, b, round(alpha * 255))


def _box_faces(width: float, height: float, depth: float) -> list[list[Vec3]]:
    x, y, z = width / 2, height / 2, depth / 2
    corners = {
        "-x-y-z": (-x, -y, -z),
        "+x-y-z": (x, -y, -z),
        "+x+y-z": (x, y, -z),
        "-x+y-z": (-x, y, -z),
        "-x-y+z": (-x, -y, z),
        "+x-y+z": (x, -y, z),
        "+x+y+z": (x, y, z),
        "-x+y+z": (-x, y, z),
    }
    return [
        [corners["-x-y-z"], corners["+x-y-z"], corners["+x+y-z"], corners["-x+y-z"]],  # -Z
        [corners["+x-y+z"], corners["-x-y+z"], corners["-x+y+z"], corners["+x+y+z"]],  # +Z
        [corners["-x-y+z"], corners["-x-y-z"], corners["-x+y-z"], corners["-x+y+z"]],  # -X
        [corners["+x-y-z"], corners["+x-y+z"], corners["+x+y+z"], corners["+x+y-z"]],  # +X
        [corners["-x-y+z"], corners["+x-y+z"], corners["+x-y-z"], corners["-x-y-z"]],  # -Y
        [corners["-x+y-z"], corners["+x+y-z"], corners["+x+y+z"], corners["-x+y+z"]],  # +Y
    ]


def _cylinder_faces(radius_top: float, radius_bottom: float, height: float) -> list[list[Vec3]]:
    half = height / 2
    top = [
        (
            radius_top * math.cos(2 * math.pi * i / _CYLINDER_SEGMENTS),
            half,
            radius_top * math.sin(2 * math.pi * i / _CYLINDER_SEGMENTS),
        )
        for i in range(_CYLINDER_SEGMENTS)
    ]
    bottom = [
        (
            radius_bottom * math.cos(2 * math.pi * i / _CYLINDER_SEGMENTS),
            -half,
            radius_bottom * math.sin(2 * math.pi * i / _CYLINDER_SEGMENTS),
        )
        for i in range(_CYLINDER_SEGMENTS)
    ]
    faces = [list(reversed(top)), list(bottom)]
    for i in range(_CYLINDER_SEGMENTS):
        j = (i + 1) % _CYLINDER_SEGMENTS
        faces.append([bottom[i], bottom[j], top[j], top[i]])
    return faces


def _plane_faces(width: float, height: float) -> list[list[Vec3]]:
    x, y = width / 2, height / 2
    return [[(-x, -y, 0.0), (x, -y, 0.0), (x, y, 0.0), (-x, y, 0.0)]]


@dataclass
class _Camera:
    position: Vec3
    right: Vec3
    up: Vec3
    forward: Vec3
    tan_half_fov: float
    near: float

    @classmethod
    def from_dict(cls, data: dict) -> _Camera:
        position = _vec3(data["position"])
        target = _vec3(data["target"])
        try:
            fov = float(data["fov"])
            near = float(data["near"])
        except (KeyError, TypeError, ValueError) as exc:
            raise Thumbnail3DRenderError(f"malformed camera: {data!r}") from exc

        forward = _normalize(_sub(target, position))
        world_up: Vec3 = (0.0, 1.0, 0.0)
        if abs(_dot(forward, world_up)) > 0.999:
            world_up = (0.0, 0.0, 1.0)
        right = _normalize(_cross(forward, world_up))
        up = _cross(right, forward)

        return cls(
            position=position,
            right=right,
            up=up,
            forward=forward,
            tan_half_fov=math.tan(math.radians(fov) / 2),
            near=near,
        )

    def view_space(self, world_point: Vec3) -> Vec3:
        delta = _sub(world_point, self.position)
        return (_dot(delta, self.right), _dot(delta, self.up), _dot(delta, self.forward))

    def project(self, view_point: Vec3) -> tuple[float, float] | None:
        cam_x, cam_y, cam_z = view_point
        if cam_z <= self.near:
            return None
        ndc_x = cam_x / (cam_z * self.tan_half_fov * CARD_ASPECT)
        ndc_y = cam_y / (cam_z * self.tan_half_fov)
        screen_x = (ndc_x + 1) / 2 * CARD_WIDTH
        screen_y = (1 - ndc_y) / 2 * CARD_HEIGHT
        return (screen_x, screen_y)


def _draw_faces(scene: dict, camera: _Camera) -> list[tuple[float, str, list, tuple]]:
    """Returns a list of `(depth, kind, payload, rgba)` draw commands,
    unsorted -- caller sorts by depth (descending: far to near)."""
    groups_by_id = {g["id"]: g for g in scene.get("groups") or []}
    commands: list[tuple[float, str, list, tuple]] = []

    for obj in scene.get("objects") or []:
        if not obj.get("visible", True):
            continue
        group_id = obj.get("groupId")
        group_transform = None
        if group_id is not None:
            group = groups_by_id.get(group_id)
            if group is None or not group.get("visible", True):
                continue
            group_transform = _Transform.from_dict(group["transform"])

        obj_transform = _Transform.from_dict(obj["transform"])
        material = obj.get("material") or {}
        opacity = obj_transform.opacity * float(material.get("opacity", 1.0))
        if group_transform is not None:
            opacity *= group_transform.opacity
        rgba = _hex_to_rgba(material.get("color"), opacity)
        if rgba is None or rgba[3] == 0:
            continue

        def to_world(local: Vec3, _obj_transform=obj_transform, _group_transform=group_transform):
            world = _obj_transform.apply(local)
            if _group_transform is not None:
                world = _group_transform.apply(world)
            return world

        obj_type = obj.get("type")
        if obj_type == "box":
            faces = _box_faces(float(obj["width"]), float(obj["height"]), float(obj["depth"]))
            cull = True
        elif obj_type == "cylinder":
            faces = _cylinder_faces(
                float(obj["radiusTop"]), float(obj["radiusBottom"]), float(obj["height"])
            )
            cull = True
        elif obj_type == "plane":
            faces = _plane_faces(float(obj["width"]), float(obj["height"]))
            cull = False
        elif obj_type == "sphere":
            scale = obj_transform.average_scale() * (
                group_transform.average_scale() if group_transform is not None else 1.0
            )
            center_world = to_world((0.0, 0.0, 0.0))
            center_view = camera.view_space(center_world)
            if center_view[2] <= camera.near:
                continue
            edge_world = to_world((float(obj["radius"]) * scale, 0.0, 0.0))
            edge_view = camera.view_space(edge_world)
            center_screen = camera.project(center_view)
            edge_screen = camera.project(edge_view)
            if center_screen is None or edge_screen is None:
                continue
            screen_radius = max(
                1.0,
                math.hypot(edge_screen[0] - center_screen[0], edge_screen[1] - center_screen[1]),
            )
            commands.append((center_view[2], "disc", [center_screen, screen_radius], rgba))
            continue
        else:
            raise Thumbnail3DRenderError(f"unknown object type: {obj_type!r}")

        for face_local in faces:
            face_world = [to_world(p) for p in face_local]
            centroid = (
                sum(p[0] for p in face_world) / len(face_world),
                sum(p[1] for p in face_world) / len(face_world),
                sum(p[2] for p in face_world) / len(face_world),
            )
            if cull:
                normal = _cross(
                    _sub(face_world[1], face_world[0]), _sub(face_world[2], face_world[0])
                )
                if _length(normal) < 1e-9:
                    continue
                to_camera = _sub(camera.position, centroid)
                if _dot(normal, to_camera) <= 0:
                    continue

            face_view = [camera.view_space(p) for p in face_world]
            if any(v[2] <= camera.near for v in face_view):
                continue
            face_screen = [camera.project(v) for v in face_view]
            if any(s is None for s in face_screen):
                continue
            depth = sum(v[2] for v in face_view) / len(face_view)
            commands.append((depth, "poly", face_screen, rgba))

    return commands


def render_scene3d_thumbnail(scene: dict) -> Image.Image:
    """Renders `scene` (a validated `scene3d` document) directly at
    `CARD_WIDTH`x`CARD_HEIGHT`. Raises `Thumbnail3DRenderError` for
    anything that stops it from producing a well-formed image."""
    result = validate_scene3d(scene)
    if not result.valid:
        first = result.errors[0] if result.errors else None
        detail = f"{first.path} — {first.message}" if first else "invalid scene3d"
        raise Thumbnail3DRenderError(f"cannot render an invalid scene3d: {detail}")

    try:
        background = _hex_to_rgba(scene["scene"]["backgroundColor"], 1.0) or (
            255,
            255,
            255,
            255,
        )
        camera = _Camera.from_dict(scene["camera"])
        commands = _draw_faces(scene, camera)
    except Thumbnail3DRenderError:
        raise
    except (KeyError, TypeError, ValueError, ZeroDivisionError) as exc:
        raise Thumbnail3DRenderError(f"malformed scene3d document: {exc}") from exc

    image = Image.new("RGBA", (CARD_WIDTH, CARD_HEIGHT), background)
    try:
        # Painter's algorithm: farthest (largest camera-space depth) first,
        # nearest last, so nearer geometry is drawn on top.
        for _depth, kind, payload, rgba in sorted(commands, key=lambda c: c[0], reverse=True):
            layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
            draw = ImageDraw.Draw(layer)
            if kind == "poly":
                draw.polygon(payload, fill=rgba)
            else:
                (cx, cy), radius = payload
                draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=rgba)
            image.alpha_composite(layer)
    except Exception as exc:  # noqa: BLE001 - any drawing failure becomes a safe fallback upstream
        raise Thumbnail3DRenderError(f"rendering failed: {exc}") from exc

    return image


def render_card_thumbnail3d_png(scene: dict) -> bytes:
    """`render_scene3d_thumbnail`, flattened onto an opaque white
    background and encoded as PNG bytes -- mirrors
    `thumbnails.render_card_thumbnail_png`'s output contract exactly, so
    both document families' thumbnails are interchangeable at the byte
    level as far as any caller is concerned."""
    rendered = render_scene3d_thumbnail(scene)
    opaque = Image.new("RGB", rendered.size, (255, 255, 255))
    opaque.paste(rendered, mask=rendered.split()[3])
    buffer = BytesIO()
    opaque.save(buffer, format="PNG")
    return buffer.getvalue()
