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
 * `transform.x/y`. `shapeBounds()` (and therefore the selection/hover
 * outline and click/drag hit-testing, which are all built on it) accounts
 * for `scaleX`/`scaleY`/`rotation` — Task 26 added rotate/resize handles
 * that do write non-default values for these, and `p5Adapter.ts`'s
 * `applyTransform` applies them (`translate` then `rotate` then `scale`)
 * when actually drawing a shape's body, so the bounds math here matches
 * that same order (issue #155).
 */

import rawLimits from '../../../schema/limits.json';

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
  // Task 111 (issue #142): a shape's own visibility/lock state,
  // independent of any ancestor group/layer's flag (see
  // schema/scene.schema.json's `shape.visible`/`shape.locked` doc
  // comments). Optional for backward compatibility with documents saved
  // before these fields existed -- absent means visible/unlocked, the
  // same default `sceneOutline.ts`'s `isEffectivelyLocked` and
  // `buildOutline` apply.
  visible?: boolean;
  locked?: boolean;
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

/** Maps a shape's *local* (unrotated, unscaled, origin-relative) bounding
 * box to its actual on-screen axis-aligned bounding box, applying
 * `transform.scaleX/scaleY` then `transform.rotation` then
 * `transform.x/y` to each of the box's four corners — the same
 * scale-then-rotate-then-translate order `p5Adapter.ts`'s `applyTransform`
 * renders with (issue #155). Reduces to a plain translate of `localBounds`
 * when `scaleX === scaleY === 1` and `rotation === 0`. */
function transformedBounds(localBounds: Bounds, transform: Transform): Bounds {
  const { x, y, scaleX, scaleY, rotation } = transform;
  const corners: Point[] = [
    { x: localBounds.minX * scaleX, y: localBounds.minY * scaleY },
    { x: localBounds.maxX * scaleX, y: localBounds.minY * scaleY },
    { x: localBounds.maxX * scaleX, y: localBounds.maxY * scaleY },
    { x: localBounds.minX * scaleX, y: localBounds.maxY * scaleY },
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const corner of corners) {
    const rotated = rotateAround(corner.x, corner.y, 0, 0, rotation);
    const worldX = x + rotated.x;
    const worldY = y + rotated.y;
    minX = Math.min(minX, worldX);
    maxX = Math.max(maxX, worldX);
    minY = Math.min(minY, worldY);
    maxY = Math.max(maxY, worldY);
  }
  return { minX, minY, maxX, maxY };
}

export function shapeBounds(shape: Shape): Bounds {
  const { x, y } = shape.transform;
  switch (shape.type) {
    case 'circle':
      return transformedBounds(
        { minX: -shape.radius, minY: -shape.radius, maxX: shape.radius, maxY: shape.radius },
        shape.transform,
      );
    case 'rect':
      return transformedBounds(
        { minX: 0, minY: 0, maxX: shape.width, maxY: shape.height },
        shape.transform,
      );
    case 'line': {
      const pad = Math.max(shape.style.strokeWidth, 6) / 2 + 4;
      const localX2 = shape.x2 - x;
      const localY2 = shape.y2 - y;
      const b = transformedBounds(
        {
          minX: Math.min(0, localX2),
          minY: Math.min(0, localY2),
          maxX: Math.max(0, localX2),
          maxY: Math.max(0, localY2),
        },
        shape.transform,
      );
      return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
    }
    case 'path': {
      const xs = shape.points.map((p) => p.x);
      const ys = shape.points.map((p) => p.y);
      return transformedBounds(
        {
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          maxX: Math.max(...xs),
          maxY: Math.max(...ys),
        },
        shape.transform,
      );
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

/** Task 80 (issue #110): the friendly, human-facing name for each shape
 * type — used everywhere a shape's type is shown to a user (the outline,
 * the Inspector breadcrumb, the Shapes list, behavior-card target pickers)
 * rather than the raw schema `type` string. */
const SHAPE_TYPE_DISPLAY_NAMES: Record<ShapeType, string> = {
  circle: 'Circle',
  rect: 'Rectangle',
  line: 'Line',
  path: 'Polygon',
};

export function shapeTypeDisplayName(type: ShapeType): string {
  return SHAPE_TYPE_DISPLAY_NAMES[type];
}

/** Task 80 (issue #110): a stable, readable label for `shape` — e.g.
 * "Circle 2" — derived from its type plus its 1-based position among
 * same-type shapes in `allShapes`' array order (creation order), rather
 * than a truncated UUID. Shapes carry no user-facing `name` field of their
 * own in the schema (unlike layers/groups — see `schema/scene.schema.json`),
 * so this label is always derived, never persisted; it stays stable across
 * renders of the same scene state, but is not a permanent identity — e.g.
 * deleting "Circle 1" renumbers a later "Circle 2" down to "Circle 1", the
 * same way a plain ordinal position would. Callers that need every shape in
 * a scene labeled (the outline, the Shapes list, behavior-card target
 * pickers) should pass the same `allShapes` array (typically
 * `sceneEditor.shapes`) so labels agree everywhere a shape is named.
 *
 * Falls back to `allShapes.length + 1` as the ordinal when `shape` isn't
 * actually present in `allShapes` (e.g. a stale reference) rather than
 * throwing, so a caller can never crash rendering a shape it's about to
 * discover is gone.
 */
export function shapeLabel(shape: Shape, allShapes: Shape[]): string {
  const sameType = allShapes.filter((s) => s.type === shape.type);
  const index = sameType.findIndex((s) => s.id === shape.id);
  const ordinal = index >= 0 ? index + 1 : sameType.length + 1;
  return `${shapeTypeDisplayName(shape.type)} ${ordinal}`;
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
 * Issue #78: snap-to-grid and alignment-guide math for a single-shape
 * drag/resize gesture (`sceneEditor.selectedShapeId` path only — never the
 * multi-shape group path below, per that issue's own "out of scope").
 *
 * Both mechanisms share one fixed tolerance, expressed in scene/canvas
 * units (not screen pixels) so it's zoom/CSS-scale invariant, matching
 * `clientToCanvasPoint`'s own unit convention. The snap preference itself
 * (on/off for each) is a purely client-side `localStorage` setting — see
 * `../editor/snapSettings.ts` — and is never read or written here; this
 * module only exposes pure geometry helpers, leaving the on/off decision
 * to the caller (`EditorWorkspace.tsx`), consistent with how the rest of
 * this file's gesture math has no opinion on UI state either.
 */

/** Default grid spacing, and the shared snap tolerance, in scene units —
 * fixed per issue #78 (no size/tolerance picker in this task's scope). */
export const GRID_SIZE = 20;
export const SNAP_TOLERANCE = 8;

/** Rounds `value` to the nearest multiple of `gridSize`, but only if that
 * nearest grid line is within `tolerance` — otherwise `value` passes
 * through unchanged (the "far enough away moves freely" acceptance
 * criterion). */
export function snapValueToGrid(
  value: number,
  gridSize: number = GRID_SIZE,
  tolerance: number = SNAP_TOLERANCE,
): number {
  if (!Number.isFinite(value)) return value;
  const nearest = Math.round(value / gridSize) * gridSize;
  return Math.abs(nearest - value) <= tolerance ? nearest : value;
}

export type AlignmentGuide = { axis: 'x' | 'y'; value: number };
type AlignmentCandidate = { value: number; delta: number };

/** For a dragged shape's live bounding box, finds the closest-in-tolerance
 * alignment against every sibling's corresponding edge/center, per axis
 * independently (a shape can align horizontally and vertically to two
 * different siblings at once, exactly like Figma-style smart guides).
 * `siblings` should already exclude the shape being dragged itself (see
 * the "no self-alignment" acceptance criterion) — this function doesn't
 * know shape identity, only bounds. Returns `null` for an axis with no
 * candidate inside `tolerance` (in particular: `siblings` is empty, e.g. a
 * lone shape in the scene). */
export function findAlignmentGuides(
  bounds: Bounds,
  siblings: Bounds[],
  tolerance: number = SNAP_TOLERANCE,
): { x: AlignmentGuide | null; y: AlignmentGuide | null } {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const xCandidates = [bounds.minX, bounds.maxX, centerX];
  const yCandidates = [bounds.minY, bounds.maxY, centerY];

  let bestX: AlignmentCandidate | null = null;
  let bestY: AlignmentCandidate | null = null;

  for (const sibling of siblings) {
    const sCenterX = (sibling.minX + sibling.maxX) / 2;
    const sCenterY = (sibling.minY + sibling.maxY) / 2;
    for (const cx of xCandidates) {
      for (const sx of [sibling.minX, sibling.maxX, sCenterX]) {
        const delta = sx - cx;
        if (Math.abs(delta) <= tolerance && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) {
          bestX = { value: sx, delta };
        }
      }
    }
    for (const cy of yCandidates) {
      for (const sy of [sibling.minY, sibling.maxY, sCenterY]) {
        const delta = sy - cy;
        if (Math.abs(delta) <= tolerance && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) {
          bestY = { value: sy, delta };
        }
      }
    }
  }

  return {
    x: bestX ? { axis: 'x', value: bestX.value } : null,
    y: bestY ? { axis: 'y', value: bestY.value } : null,
  };
}

export type SnapOptions = { gridEnabled: boolean; guidesEnabled: boolean; tolerance?: number };

export type MoveSnapResult = {
  shape: Shape;
  guides: { x: AlignmentGuide | null; y: AlignmentGuide | null };
};

/** Applies grid/alignment-guide snapping to the result of a single-shape
 * "move" gesture (`applyShapeDrag('move', ...)`'s output), adjusting
 * `updated`'s position and, when a guide is in range, returning the guide
 * line(s) to render. Alignment guides take precedence over the grid per
 * axis (the "both in range simultaneously" acceptance criterion) — grid is
 * only consulted for an axis with no guide in range. Every adjusted
 * coordinate is re-clamped through `clamp()`/`POSITION_LIMIT`, exactly
 * like the unsnapped path. A no-op (both disabled, or nothing in range)
 * returns `updated` unchanged by reference. */
export function applyMoveSnap(
  updated: Shape,
  siblingBounds: Bounds[],
  options: SnapOptions,
): MoveSnapResult {
  const tolerance = options.tolerance ?? SNAP_TOLERANCE;
  let dx = 0;
  let dy = 0;
  let guideX: AlignmentGuide | null = null;
  let guideY: AlignmentGuide | null = null;

  if (options.guidesEnabled && siblingBounds.length > 0) {
    const bounds = shapeBounds(updated);
    const guides = findAlignmentGuides(bounds, siblingBounds, tolerance);
    guideX = guides.x;
    guideY = guides.y;
  }

  // The guide value is a target for one of the shape's edges/center,
  // expressed in bounds space; translating the whole shape by (target -
  // currentCandidateValue) moves that edge/center onto the guide (the same
  // offset applies to transform.x/y since bounds are a fixed local offset
  // from the transform origin for every shape type here — see
  // shapeBounds()).
  if (guideX || guideY) {
    const bounds = shapeBounds(updated);
    if (guideX) {
      const candidates = [bounds.minX, bounds.maxX, (bounds.minX + bounds.maxX) / 2];
      const closest = candidates.reduce((best, c) =>
        Math.abs(guideX!.value - c) < Math.abs(guideX!.value - best) ? c : best,
      );
      dx = guideX.value - closest;
    }
    if (guideY) {
      const candidates = [bounds.minY, bounds.maxY, (bounds.minY + bounds.maxY) / 2];
      const closest = candidates.reduce((best, c) =>
        Math.abs(guideY!.value - c) < Math.abs(guideY!.value - best) ? c : best,
      );
      dy = guideY.value - closest;
    }
  }

  if (options.gridEnabled) {
    if (!guideX) {
      const snappedX = snapValueToGrid(updated.transform.x, GRID_SIZE, tolerance);
      dx = snappedX - updated.transform.x;
    }
    if (!guideY) {
      const snappedY = snapValueToGrid(updated.transform.y, GRID_SIZE, tolerance);
      dy = snappedY - updated.transform.y;
    }
  }

  if (dx === 0 && dy === 0) return { shape: updated, guides: { x: guideX, y: guideY } };

  const shape: Shape = {
    ...updated,
    transform: {
      ...updated.transform,
      x: clamp(updated.transform.x + dx, POSITION_LIMIT.min, POSITION_LIMIT.max),
      y: clamp(updated.transform.y + dy, POSITION_LIMIT.min, POSITION_LIMIT.max),
    },
  };
  return { shape, guides: { x: guideX, y: guideY } };
}

/** Applies grid snapping to the result of a single-shape "box" resize
 * gesture (`applyShapeDrag('resize', ...)`'s output): snaps the resized
 * edge/corner (the same absolute point `getShapeHandles` places the
 * resize handle at) to the nearest grid line per axis, within tolerance,
 * then re-derives the shape's size fields by re-running the exact same
 * `applyShapeDrag('resize', ...)` math against that snapped point — so
 * every existing per-type resize convention (and its `clamp()`/
 * `SIZE_LIMIT` handling) is reused rather than duplicated. Alignment
 * guides don't apply to resize (issue #78's own scope: guides only cover
 * drag). A no-op (grid disabled, or nothing in range) returns `updated`
 * unchanged by reference. */
export function applyResizeSnap(
  startShape: Shape,
  startPointer: Point,
  updated: Shape,
  options: { gridEnabled: boolean; tolerance?: number },
): Shape {
  if (!options.gridEnabled) return updated;
  const tolerance = options.tolerance ?? SNAP_TOLERANCE;
  const point = getShapeHandles(updated).resize;
  const snappedX = snapValueToGrid(point.x, GRID_SIZE, tolerance);
  const snappedY = snapValueToGrid(point.y, GRID_SIZE, tolerance);
  if (snappedX === point.x && snappedY === point.y) return updated;
  return applyShapeDrag('resize', startShape, startPointer, { x: snappedX, y: snappedY });
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

/**
 * Issue #79: per-vertex editing of a single `path` shape's individual
 * points — a mode that coexists with (never replaces) Task 26's whole-shape
 * path "resize" (`applyResize`'s/`applyGroupResize`'s `'path'` branches
 * above, both untouched by this section). Deliberately single-shape only
 * (`selectedShapeId`, never `multiSelectedIds`/the group-gesture machinery
 * above) and unsnapped (no interaction with issue #78's
 * `applyMoveSnap`/`applyResizeSnap`) — see this task's own "Out of scope".
 */

// schema/limits.json's `maxPathPoints` — read directly (not duplicated as a
// plain number) since it's already a plain JSON value with no schema
// validation logic to avoid re-implementing, unlike the schema-derived
// ranges above.
export const MAX_PATH_POINTS: number = (rawLimits as { maxPathPoints: number }).maxPathPoints;

// schema/scene.schema.json's `$defs` path branch: `points` has
// `minItems: 2` — duplicated here as a plain number per this task's
// constraint not to modify the schema itself, the same convention
// `PATH_MIN_SCALE`/`POSITION_LIMIT`/etc. above already use.
export const MIN_PATH_POINTS = 2;

// Fixed tolerance (scene units, not screen pixels) for double-click-to-
// insert hit testing against a path segment — same rationale as
// `SNAP_TOLERANCE` above: expressed in scene units so it stays zoom/CSS-
// scale invariant regardless of how large or small the canvas is rendered
// on screen.
export const VERTEX_SEGMENT_INSERT_TOLERANCE = 10;

/** The absolute, rotated on-screen position of every point in a path
 * shape — one draggable vertex handle per entry, in the same "local point,
 * rotated around the transform origin" convention `getShapeHandles` uses
 * for the whole-shape handles it replaces while vertex edit mode is
 * active. */
export function getPathPointHandles(shape: PathShape): Point[] {
  const { x, y, rotation } = shape.transform;
  return shape.points.map((p) => rotateAround(x + p.x, y + p.y, x, y, rotation));
}

/** Moves exactly one point (`pointIndex`) of `startShape` — an immutable
 * snapshot taken once at gesture start, exactly like `applyShapeDrag`'s own
 * `startShape` parameter — to `pointer` (canvas-local, client-space-
 * converted). `pointer` is unrotated back through the shape's transform
 * (mirroring `applyResize`'s `'path'` branch unrotate step) before being
 * stored, since `points[]` entries are local, unrotated offsets from
 * `transform.x/y`. Every other point is left byte-for-byte unchanged. The
 * written coordinates are clamped to the schema's `point` range
 * (`POSITION_LIMIT`, reused from the whole-shape path above) and are never
 * `NaN`/`Infinity` (see `clamp`'s own doc comment). */
export function applyVertexDrag(
  startShape: PathShape,
  pointIndex: number,
  pointer: Point,
): PathShape {
  const { x, y, rotation } = startShape.transform;
  const local = rotateAround(pointer.x, pointer.y, x, y, -rotation);
  const px = clamp(local.x - x, POSITION_LIMIT.min, POSITION_LIMIT.max);
  const py = clamp(local.y - y, POSITION_LIMIT.min, POSITION_LIMIT.max);
  const points = startShape.points.map((p, i) => (i === pointIndex ? { x: px, y: py } : p));
  return { ...startShape, points };
}

/** Point-to-segment distance in the same flat coordinate space `a`/`b`/`p`
 * already share (no unit conversion here) — the plain closed-form
 * projection-onto-segment-then-clamp-to-endpoints calculation. */
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

export type SegmentHit = { index: number; point: Point };

/** Finds the closest path segment to `pointer` (canvas-local, client-
 * space-converted) within `tolerance` scene units — the double-click-to-
 * insert hit test. `pointer` is converted into the shape's local,
 * unrotated point space first (the same unrotate step `applyVertexDrag`
 * above uses), so the returned `point` is the raw double-click location
 * already expressed in the same convention `points[]` entries use, ready
 * to insert as-is (not projected onto the segment — the acceptance
 * criterion is "the new point's coordinates are the double-click
 * location"). `index` is the array index the new point should be spliced
 * in at: between segment `i` and `i + 1`, or — for a `closed` path's
 * final segment connecting the last point back to the first — at
 * `points.length` (append). Returns `null` when no segment is within
 * `tolerance` (a path with fewer than 2 segments, e.g. an open 2-point
 * path with only one segment, still works: `segmentCount` is simply 1). */
export function findClosestPathSegment(
  shape: PathShape,
  pointer: Point,
  tolerance: number = VERTEX_SEGMENT_INSERT_TOLERANCE,
): SegmentHit | null {
  const { x, y, rotation } = shape.transform;
  const local = rotateAround(pointer.x, pointer.y, x, y, -rotation);
  const localPoint: Point = { x: local.x - x, y: local.y - y };
  const points = shape.points;
  if (points.length < 2) return null;
  const segmentCount = shape.closed ? points.length : points.length - 1;
  let bestIndex = -1;
  let bestDist = Infinity;
  for (let i = 0; i < segmentCount; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dist = distanceToSegment(localPoint, a, b);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i + 1;
    }
  }
  if (bestIndex === -1 || bestDist > tolerance) return null;
  return {
    index: bestIndex,
    point: {
      x: clamp(localPoint.x, POSITION_LIMIT.min, POSITION_LIMIT.max),
      y: clamp(localPoint.y, POSITION_LIMIT.min, POSITION_LIMIT.max),
    },
  };
}

export type PathPointMutationResult = { ok: true; shape: PathShape } | { ok: false; error: string };

/** Inserts `point` (already local/unrotated — see `findClosestPathSegment`)
 * into `shape.points` at `index`, or rejects with no mutation when the
 * shape is already at `MAX_PATH_POINTS` (the "insert rejected at the cap"
 * acceptance criterion). */
export function insertPathPoint(
  shape: PathShape,
  index: number,
  point: Point,
): PathPointMutationResult {
  if (shape.points.length >= MAX_PATH_POINTS) {
    return {
      ok: false,
      error: `This shape already has the maximum of ${MAX_PATH_POINTS} points — no more can be added.`,
    };
  }
  const points = shape.points.slice();
  const clampedIndex = Math.max(0, Math.min(points.length, index));
  points.splice(clampedIndex, 0, {
    x: clamp(point.x, POSITION_LIMIT.min, POSITION_LIMIT.max),
    y: clamp(point.y, POSITION_LIMIT.min, POSITION_LIMIT.max),
  });
  return { ok: true, shape: { ...shape, points } };
}

/** Appends a new point near the shape's current last point — the "Add
 * point" keyboard button's action, subject to the same `MAX_PATH_POINTS`
 * cap `insertPathPoint` already enforces. */
export function appendPathPointNearLast(shape: PathShape): PathPointMutationResult {
  const last = shape.points[shape.points.length - 1] ?? { x: 0, y: 0 };
  const point = { x: last.x + 20, y: last.y + 20 };
  return insertPathPoint(shape, shape.points.length, point);
}

/** Removes the point at `index` from `shape.points`, or rejects with no
 * mutation when the shape is already at the schema's `MIN_PATH_POINTS`
 * floor (the "delete rejected at the floor" acceptance criterion) or
 * `index` no longer resolves to a point. */
export function deletePathPoint(shape: PathShape, index: number): PathPointMutationResult {
  if (shape.points.length <= MIN_PATH_POINTS) {
    return {
      ok: false,
      error: `This shape must keep at least ${MIN_PATH_POINTS} points — this point can't be deleted.`,
    };
  }
  if (index < 0 || index >= shape.points.length) {
    return { ok: false, error: 'That point no longer exists.' };
  }
  const points = shape.points.filter((_, i) => i !== index);
  return { ok: true, shape: { ...shape, points } };
}
