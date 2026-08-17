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

type Point = { x: number; y: number };

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

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function shapeBounds(shape: Shape): Bounds {
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
