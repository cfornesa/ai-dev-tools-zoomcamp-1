/**
 * Task 23: shape data helpers for the editor workspace's shape CRUD.
 *
 * These are plain, renderer-neutral helpers over the canonical scene shape
 * shape (see ../../../schema/scene.schema.json's `$defs.shape`). They only
 * cover the four V1 primitives this task adds: circle, rect, line, and path
 * (the schema's approved polygon primitive — a closed path). The schema
 * also defines a fifth shape type, `particleEmitter`, which is out of scope
 * for this task; scenes that already contain one are left untouched by
 * everything here (see `getEditableShapes`).
 *
 * Position convention used by the helpers below (an editor-only convention,
 * not part of the schema): a circle's `transform.x/y` is its center; a
 * rect's `transform.x/y` is its top-left corner; a line runs from
 * `transform.x/y` to `x2/y2`; a path's points are relative offsets from
 * `transform.x/y`. `scaleX/scaleY/rotation` are ignored by the bounds/hit
 * test math below — there's no transform-handle UI yet (Task 26), so
 * nothing in this task produces a non-default scale or rotation.
 */

export type ShapeType = 'circle' | 'rect' | 'line' | 'path';

export type Point = { x: number; y: number };

type Transform = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
};

type Style = {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
};

type BaseShape = {
  id: string;
  layerId: string;
  groupId: string | null;
  transform: Transform;
  style: Style;
};

export type CircleShape = BaseShape & { type: 'circle'; radius: number };
export type RectShape = BaseShape & {
  type: 'rect';
  width: number;
  height: number;
  cornerRadius: number;
};
export type LineShape = BaseShape & { type: 'line'; x2: number; y2: number };
export type PathShape = BaseShape & { type: 'path'; points: Point[]; closed: boolean };

export type Shape = CircleShape | RectShape | LineShape | PathShape;

const DEFAULT_STYLE: Style = { fill: '#4f46e5', stroke: '#1e1b4b', strokeWidth: 2 };

function baseTransform(x: number, y: number): Transform {
  return { x, y, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 };
}

/** Creates a schema-valid shape of `type` with a stable, unique id
 * (`crypto.randomUUID()`, matching the id pattern every scene-graph node
 * uses — `$defs.id` in scene.schema.json), centered on the given canvas. */
export function createShape(
  type: ShapeType,
  layerId: string,
  canvas: { width: number; height: number },
): Shape {
  const id = crypto.randomUUID();
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const base = { id, layerId, groupId: null, style: { ...DEFAULT_STYLE } };

  switch (type) {
    case 'circle':
      return { ...base, type, transform: baseTransform(cx, cy), radius: 50 };
    case 'rect':
      return {
        ...base,
        type,
        transform: baseTransform(cx - 50, cy - 40),
        width: 100,
        height: 80,
        cornerRadius: 0,
      };
    case 'line':
      return { ...base, type, transform: baseTransform(cx - 50, cy), x2: cx + 50, y2: cy };
    case 'path':
      return {
        ...base,
        type,
        transform: baseTransform(cx, cy),
        points: [
          { x: 0, y: -50 },
          { x: 50, y: 0 },
          { x: 0, y: 50 },
          { x: -50, y: 0 },
        ],
        closed: true,
      };
  }
}

/** Duplicates a shape: a new id, everything else about it preserved except
 * a small position offset so the copy is visibly distinct from its source
 * rather than exactly stacked on top of it. */
export function duplicateShape(shape: Shape): Shape {
  const clone = structuredClone(shape) as Shape;
  clone.id = crypto.randomUUID();
  clone.transform = { ...clone.transform, x: clone.transform.x + 20, y: clone.transform.y + 20 };
  return clone;
}

function isShapeType(value: unknown): value is ShapeType {
  return value === 'circle' || value === 'rect' || value === 'line' || value === 'path';
}

/** Narrows a scene's raw `shapes` array down to the shapes this task's UI
 * knows how to draw/select/duplicate/delete. Any other array entries
 * (currently just `particleEmitter`) are simply left out of the editor's
 * shape list/canvas and untouched by every mutation in `useSceneEditor`. */
export function getEditableShapes(shapes: unknown): Shape[] {
  if (!Array.isArray(shapes)) return [];
  return shapes.filter((s): s is Shape => isShapeType((s as { type?: unknown })?.type));
}

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export function shapeBounds(shape: Shape): Bounds {
  const { x, y } = shape.transform;
  switch (shape.type) {
    case 'circle':
      return {
        minX: x - shape.radius,
        minY: y - shape.radius,
        maxX: x + shape.radius,
        maxY: y + shape.radius,
      };
    case 'rect':
      return { minX: x, minY: y, maxX: x + shape.width, maxY: y + shape.height };
    case 'line': {
      const pad = Math.max(shape.style.strokeWidth, 6) / 2 + 4;
      return {
        minX: Math.min(x, shape.x2) - pad,
        maxX: Math.max(x, shape.x2) + pad,
        minY: Math.min(y, shape.y2) - pad,
        maxY: Math.max(y, shape.y2) + pad,
      };
    }
    case 'path': {
      const xs = shape.points.map((p) => p.x + x);
      const ys = shape.points.map((p) => p.y + y);
      return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
      };
    }
  }
}

/** Pointer hit-testing for the placeholder canvas surface: returns the
 * topmost (last-in-array, i.e. drawn-on-top) shape whose bounds contain
 * (x, y), or null if none do. Iterating back-to-front is what makes
 * overlapping shapes resolve to the one visually on top. */
export function hitTestTopmostShapeAt(shapes: Shape[], x: number, y: number): Shape | null {
  for (let i = shapes.length - 1; i >= 0; i -= 1) {
    const b = shapeBounds(shapes[i]);
    if (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY) {
      return shapes[i];
    }
  }
  return null;
}

export function shapeLabel(shape: Shape): string {
  return `${shape.type} (${shape.id.slice(0, 8)})`;
}

/**
 * Task 26: direct-manipulation geometry and mutation helpers for the
 * preview's pointer-driven move/resize/rotate handles.
 *
 * These mirror the position convention above and, for rotation, the exact
 * local-space math `p5Adapter.ts`'s `applyTransform`/`drawShapeGeometry`
 * use to render a shape: `translate(x, y)` then `rotate(rotation)`, so a
 * shape's local-space geometry (its `radius`, `width`/`height`, `x2 - x`/
 * `y2 - y`, or `points`) ends up on screen at `origin + R(rotation) *
 * local`. Every helper below is built on that same relationship so handle
 * positions and the pointer math that drags them agree with what the
 * preview actually draws.
 */

// Ranges from schema/scene.schema.json's `transform2D`/`point`/circle/rect
// `$defs` (see that file's own comments) — duplicated here as plain
// numbers per this task's constraint not to modify the schema itself.
export const POSITION_LIMIT = { min: -100000, max: 100000 };
export const ROTATION_LIMIT = { min: -360, max: 360 };
export const SIZE_LIMIT = { min: 0.1, max: 5000 };

// No schema minimum exists for a path's bounding-box scale (points only
// have a coordinate range, not a shape-size minimum) — this is a small
// floor purely to stop a resize gesture from collapsing every point onto
// the origin (scale 0), which would be a degenerate, invisible shape.
const PATH_MIN_SCALE = 0.01;

/** Clamps `value` into [min, max]; a non-finite `value` (NaN or +/-
 * Infinity — e.g. from a degenerate pointer delta) is treated as `min`
 * rather than being allowed to reach scene state. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Rotates point (px, py) by `degrees` around (ox, oy). */
function rotateAround(px: number, py: number, ox: number, oy: number, degrees: number): Point {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - ox;
  const dy = py - oy;
  return { x: ox + dx * cos - dy * sin, y: oy + dx * sin + dy * cos };
}

function pathLocalBounds(shape: PathShape): Bounds {
  const xs = shape.points.map((p) => p.x);
  const ys = shape.points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

// The absolute (pre-rotation) point each type's resize handle sits at,
// following the same "local point, rotated around the transform origin"
// convention `drawShapeGeometry` uses (see the module comment above).
function localResizeHandle(shape: Shape): Point {
  const { x, y } = shape.transform;
  switch (shape.type) {
    case 'circle':
      return { x: x + shape.radius, y };
    case 'rect':
      return { x: x + shape.width, y: y + shape.height };
    case 'line':
      return { x: shape.x2, y: shape.y2 };
    case 'path': {
      const b = pathLocalBounds(shape);
      return { x: x + b.maxX, y: y + b.maxY };
    }
  }
}

const ROTATE_HANDLE_OFFSET = 24;

function localRotateHandle(shape: Shape): Point {
  const { x, y } = shape.transform;
  switch (shape.type) {
    case 'circle':
      return { x, y: y - shape.radius - ROTATE_HANDLE_OFFSET };
    case 'rect':
      return { x: x + shape.width / 2, y: y - ROTATE_HANDLE_OFFSET };
    case 'line': {
      const dx = shape.x2 - x;
      const dy = shape.y2 - y;
      const len = Math.hypot(dx, dy) || 1;
      const midX = (x + shape.x2) / 2;
      const midY = (y + shape.y2) / 2;
      // Offset perpendicular to the line, to one side.
      return {
        x: midX - (dy / len) * ROTATE_HANDLE_OFFSET,
        y: midY + (dx / len) * ROTATE_HANDLE_OFFSET,
      };
    }
    case 'path': {
      const b = pathLocalBounds(shape);
      return { x: x + (b.minX + b.maxX) / 2, y: y + b.minY - ROTATE_HANDLE_OFFSET };
    }
  }
}

export type HandleKind = 'move' | 'resize' | 'rotate';
export type ShapeHandles = Record<HandleKind, Point>;

/** The three manipulation handle positions for `shape`, in canvas-local
 * coordinates, already rotated to match its current `transform.rotation`
 * about its own transform origin — the same origin the move handle sits
 * at. */
export function getShapeHandles(shape: Shape): ShapeHandles {
  const { x, y, rotation } = shape.transform;
  const resizeLocal = localResizeHandle(shape);
  const rotateLocal = localRotateHandle(shape);
  return {
    move: { x, y },
    resize: rotateAround(resizeLocal.x, resizeLocal.y, x, y, rotation),
    rotate: rotateAround(rotateLocal.x, rotateLocal.y, x, y, rotation),
  };
}

function applyMove(shape: Shape, startPointer: Point, pointer: Point): Shape {
  const dx = pointer.x - startPointer.x;
  const dy = pointer.y - startPointer.y;
  return {
    ...shape,
    transform: {
      ...shape.transform,
      x: clamp(shape.transform.x + dx, POSITION_LIMIT.min, POSITION_LIMIT.max),
      y: clamp(shape.transform.y + dy, POSITION_LIMIT.min, POSITION_LIMIT.max),
    },
  };
}

function applyResize(shape: Shape, pointer: Point): Shape {
  const { x, y, rotation } = shape.transform;
  switch (shape.type) {
    case 'circle': {
      // Distance from the origin is rotation-invariant, so no need to
      // unrotate the pointer first.
      const radius = clamp(
        Math.hypot(pointer.x - x, pointer.y - y),
        SIZE_LIMIT.min,
        SIZE_LIMIT.max,
      );
      return { ...shape, radius };
    }
    case 'rect': {
      const local = rotateAround(pointer.x, pointer.y, x, y, -rotation);
      const width = clamp(local.x - x, SIZE_LIMIT.min, SIZE_LIMIT.max);
      const height = clamp(local.y - y, SIZE_LIMIT.min, SIZE_LIMIT.max);
      return { ...shape, width, height };
    }
    case 'line': {
      const local = rotateAround(pointer.x, pointer.y, x, y, -rotation);
      const x2 = clamp(local.x, POSITION_LIMIT.min, POSITION_LIMIT.max);
      const y2 = clamp(local.y, POSITION_LIMIT.min, POSITION_LIMIT.max);
      return { ...shape, x2, y2 };
    }
    case 'path': {
      const local = rotateAround(pointer.x, pointer.y, x, y, -rotation);
      const bounds = pathLocalBounds(shape);
      const handleDist = Math.hypot(bounds.maxX, bounds.maxY) || 1;
      const pointerDist = Math.hypot(local.x - x, local.y - y);
      let scale = pointerDist / handleDist;
      if (!Number.isFinite(scale) || scale < PATH_MIN_SCALE) scale = PATH_MIN_SCALE;
      const points = shape.points.map((p) => ({
        x: clamp(p.x * scale, POSITION_LIMIT.min, POSITION_LIMIT.max),
        y: clamp(p.y * scale, POSITION_LIMIT.min, POSITION_LIMIT.max),
      }));
      return { ...shape, points };
    }
  }
}

function applyRotate(shape: Shape, startPointer: Point, pointer: Point): Shape {
  const { x, y, rotation } = shape.transform;
  const startAngle = (Math.atan2(startPointer.y - y, startPointer.x - x) * 180) / Math.PI;
  const currentAngle = (Math.atan2(pointer.y - y, pointer.x - x) * 180) / Math.PI;
  const delta = currentAngle - startAngle;
  return {
    ...shape,
    transform: {
      ...shape.transform,
      rotation: clamp(rotation + delta, ROTATION_LIMIT.min, ROTATION_LIMIT.max),
    },
  };
}

/** Applies one manipulation gesture's current pointer position to
 * `startShape` — an immutable snapshot taken once at gesture start — and
 * returns a brand-new shape; `startShape` itself is never mutated.
 * Recomputing from that fixed start snapshot on every call (rather than
 * accumulating a delta frame over frame) keeps a long drag numerically
 * stable and makes Escape-to-cancel trivial: there is no accumulated
 * state to unwind, just the pre-gesture snapshot to restore. */
export function applyShapeDrag(
  kind: HandleKind,
  startShape: Shape,
  startPointer: Point,
  pointer: Point,
): Shape {
  switch (kind) {
    case 'move':
      return applyMove(startShape, startPointer, pointer);
    case 'resize':
      return applyResize(startShape, pointer);
    case 'rotate':
      return applyRotate(startShape, startPointer, pointer);
  }
}

/** Converts a pointer event's client-space coordinates into canvas-local
 * coordinates — the same space shape `transform.x`/`y` live in — correcting
 * for the canvas element being CSS-scaled smaller (or larger) than its
 * logical pixel size, e.g. the `maxWidth: '100%'` rule on
 * `.editor-scene-canvas` at narrow viewports. `rect` is whatever the
 * canvas container's current `getBoundingClientRect()` reports; `canvasWidth`/
 * `canvasHeight` are the scene's logical canvas size. */
export function clientToCanvasPoint(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
  canvasWidth: number,
  canvasHeight: number,
): Point {
  const scaleX = rect.width > 0 ? canvasWidth / rect.width : 1;
  const scaleY = rect.height > 0 ? canvasHeight / rect.height : 1;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

/**
 * Issue #77: combined bounding-box geometry and multi-shape gesture math
 * for a group of two or more simultaneously-selected shapes.
 *
 * These deliberately mirror the single-shape helpers above rather than
 * introducing new conventions: a group "move" writes the same
 * `transform.x/y` fields `applyMove` does (for every selected shape), a
 * group "resize" writes the same type-specific size field(s)
 * `applyResize` does (scaled uniformly from one group scale factor
 * instead of computed per-shape from the raw pointer position), and a
 * group "rotate" writes the same `transform.rotation` field `applyRotate`
 * does, plus rotates each shape's `transform.x/y` around the group's
 * shared pivot. Every numeric write goes through the same `clamp()` /
 * `POSITION_LIMIT` / `SIZE_LIMIT` / `ROTATION_LIMIT` helpers as the
 * single-shape path, independently per shape and per field, so one
 * member hitting its own limit never blocks or rolls back the rest of
 * the group (see the module-level doc comment on why recomputing from a
 * fixed start snapshot on every call already gives this "for free").
 *
 * `shapeBounds` ignores rotation (see its own module comment above); the
 * combined bounding box below inherits that same approximation — it is
 * only ever used to derive a group anchor/pivot and handle positions, not
 * to render anything.
 */

// No schema minimum exists for a *group* scale factor (each member's own
// size field still gets clamped to SIZE_LIMIT individually) — this is a
// small floor purely to stop a group-resize gesture from collapsing the
// whole selection onto its anchor point (scale 0) or flipping through a
// negative scale, mirroring `PATH_MIN_SCALE`'s rationale above.
const MIN_GROUP_SCALE = 0.01;

/** The union of every shape's own `shapeBounds()`, or `null` for an empty
 * list — the "combined bounding box computed at gesture start" the
 * acceptance criteria describe as the anchor for group resize/rotate. */
export function getCombinedBounds(shapes: Shape[]): Bounds | null {
  if (shapes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const shape of shapes) {
    const b = shapeBounds(shape);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return { minX, minY, maxX, maxY };
}

/** The one combined move/resize/rotate handle set for a multi-shape
 * selection's combined bounding box — the group analogue of
 * `getShapeHandles`. Unlike the single-shape handles (which rotate with
 * that shape's own `transform.rotation`), the combined box has no single
 * rotation of its own until a rotate gesture is in progress, so these sit
 * at fixed axis-aligned positions on the box: move at its center, resize
 * at its bottom-right corner, rotate above its top edge. */
export function getGroupHandles(bounds: Bounds): ShapeHandles {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  return {
    move: { x: centerX, y: (bounds.minY + bounds.maxY) / 2 },
    resize: { x: bounds.maxX, y: bounds.maxY },
    rotate: { x: centerX, y: bounds.minY - ROTATE_HANDLE_OFFSET },
  };
}

function applyGroupMove(startShapes: Shape[], startPointer: Point, pointer: Point): Shape[] {
  const dx = pointer.x - startPointer.x;
  const dy = pointer.y - startPointer.y;
  return startShapes.map((shape) => ({
    ...shape,
    transform: {
      ...shape.transform,
      x: clamp(shape.transform.x + dx, POSITION_LIMIT.min, POSITION_LIMIT.max),
      y: clamp(shape.transform.y + dy, POSITION_LIMIT.min, POSITION_LIMIT.max),
    },
  }));
}

function applyGroupResize(startShapes: Shape[], bounds: Bounds, pointer: Point): Shape[] {
  // Anchored at the opposite corner from the resize handle (bounds.maxX,
  // bounds.maxY) — the same anchor convention Task 26 uses for a single
  // shape's box-style resize.
  const anchor: Point = { x: bounds.minX, y: bounds.minY };
  const handleStart: Point = { x: bounds.maxX, y: bounds.maxY };
  const startDist = Math.hypot(handleStart.x - anchor.x, handleStart.y - anchor.y) || 1;
  const pointerDist = Math.hypot(pointer.x - anchor.x, pointer.y - anchor.y);
  let scale = pointerDist / startDist;
  if (!Number.isFinite(scale) || scale < MIN_GROUP_SCALE) scale = MIN_GROUP_SCALE;

  const scalePoint = (px: number, py: number): Point => ({
    x: clamp(anchor.x + (px - anchor.x) * scale, POSITION_LIMIT.min, POSITION_LIMIT.max),
    y: clamp(anchor.y + (py - anchor.y) * scale, POSITION_LIMIT.min, POSITION_LIMIT.max),
  });

  return startShapes.map((shape) => {
    const pos = scalePoint(shape.transform.x, shape.transform.y);
    const transform = { ...shape.transform, x: pos.x, y: pos.y };
    switch (shape.type) {
      case 'circle':
        return {
          ...shape,
          transform,
          radius: clamp(shape.radius * scale, SIZE_LIMIT.min, SIZE_LIMIT.max),
        };
      case 'rect':
        return {
          ...shape,
          transform,
          width: clamp(shape.width * scale, SIZE_LIMIT.min, SIZE_LIMIT.max),
          height: clamp(shape.height * scale, SIZE_LIMIT.min, SIZE_LIMIT.max),
        };
      case 'line': {
        const end = scalePoint(shape.x2, shape.y2);
        return { ...shape, transform, x2: end.x, y2: end.y };
      }
      case 'path': {
        const points = shape.points.map((p) => ({
          x: clamp(p.x * scale, POSITION_LIMIT.min, POSITION_LIMIT.max),
          y: clamp(p.y * scale, POSITION_LIMIT.min, POSITION_LIMIT.max),
        }));
        return { ...shape, transform, points };
      }
    }
  });
}

function applyGroupRotate(
  startShapes: Shape[],
  bounds: Bounds,
  startPointer: Point,
  pointer: Point,
): Shape[] {
  const pivot: Point = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  const startAngle =
    (Math.atan2(startPointer.y - pivot.y, startPointer.x - pivot.x) * 180) / Math.PI;
  const currentAngle = (Math.atan2(pointer.y - pivot.y, pointer.x - pivot.x) * 180) / Math.PI;
  const delta = currentAngle - startAngle;
  return startShapes.map((shape) => {
    const rotated = rotateAround(shape.transform.x, shape.transform.y, pivot.x, pivot.y, delta);
    return {
      ...shape,
      transform: {
        ...shape.transform,
        x: clamp(rotated.x, POSITION_LIMIT.min, POSITION_LIMIT.max),
        y: clamp(rotated.y, POSITION_LIMIT.min, POSITION_LIMIT.max),
        rotation: clamp(shape.transform.rotation + delta, ROTATION_LIMIT.min, ROTATION_LIMIT.max),
      },
    };
  });
}

/** Applies one multi-shape manipulation gesture's current pointer
 * position to `startShapes` — an immutable snapshot of every selected
 * shape taken once at gesture start, alongside `bounds` (their combined
 * bounding box, also computed once at gesture start) — and returns a
 * brand-new array of updated shapes; `startShapes` is never mutated. This
 * is the multi-shape analogue of `applyShapeDrag`: recomputing from the
 * fixed start snapshot on every call, rather than accumulating a delta
 * frame over frame, keeps a long drag numerically stable and makes
 * Escape-to-cancel trivial (see that function's own comment). */
export function applyGroupDrag(
  kind: HandleKind,
  startShapes: Shape[],
  bounds: Bounds,
  startPointer: Point,
  pointer: Point,
): Shape[] {
  switch (kind) {
    case 'move':
      return applyGroupMove(startShapes, startPointer, pointer);
    case 'resize':
      return applyGroupResize(startShapes, bounds, pointer);
    case 'rotate':
      return applyGroupRotate(startShapes, bounds, startPointer, pointer);
  }
}
