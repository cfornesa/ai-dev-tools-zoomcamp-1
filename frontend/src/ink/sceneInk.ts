/**
 * Issue #775: the structured 2D scene's single ink layer. The scene model keeps one shape per layer
 * (`duplicateLayerAssignment`), so "one ink layer" is one group with the reserved id `ink-group` whose
 * children are the stroke `path` shapes. Strokes are absolute-coordinate paths (transform at the origin),
 * so they read back into ink-editor shapes without any transform maths.
 */
import type { SceneDocument } from '../api/projects';
import type { DrawingShape } from '../pages/scene3dTypes';
import rawLimits from '../../../schema/limits.json';
import { validateScene } from '../validation/scene';

/** The shared scene limits an ink layer must respect (schema/limits.json). */
export const INK_MAX_PATH_POINTS: number = rawLimits.maxPathPoints;
export const INK_MAX_SHAPES: number = rawLimits.maxShapes;

export const INK_GROUP_ID = 'ink-group';
const STROKE_PREFIX = 'ink-stroke-';
const LAYER_PREFIX = 'ink-layer-';

type Rec = Record<string, unknown>;
const list = (value: unknown): Rec[] => (Array.isArray(value) ? (value as Rec[]) : []);

const isInkShape = (shape: Rec) => shape.groupId === INK_GROUP_ID;

/** The ink strokes stored in `scene`, as editable drawing shapes in canvas pixels. */
export function readInkStrokes(scene: SceneDocument): DrawingShape[] {
  const strokes: DrawingShape[] = [];
  for (const shape of list(scene.shapes)) {
    if (!isInkShape(shape) || shape.type !== 'path') continue;
    const transform = (shape.transform ?? {}) as { x?: number; y?: number; opacity?: number };
    const style = (shape.style ?? {}) as { stroke?: string | null; strokeWidth?: number };
    const dx = transform.x ?? 0;
    const dy = transform.y ?? 0;
    strokes.push({
      id: String(shape.id),
      type: 'path',
      points: list(shape.points).map((p) => ({
        x: Number(p.x) + dx,
        y: Number(p.y) + dy,
      })),
      closed: false,
      fill: null,
      stroke: style.stroke ?? '#000000',
      strokeWidth: style.strokeWidth ?? 4,
      opacity: transform.opacity ?? 1,
    });
  }
  return strokes;
}

export const hasInkLayer = (scene: SceneDocument): boolean =>
  list(scene.groups).some((g) => g.id === INK_GROUP_ID);

/** `scene` with every ink stroke, ink layer, and the ink group removed. */
function withoutInk(scene: SceneDocument): SceneDocument {
  const inkShapeIds = new Set(
    list(scene.shapes)
      .filter(isInkShape)
      .map((s) => String(s.id)),
  );
  const inkLayerIds = new Set(
    list(scene.shapes)
      .filter(isInkShape)
      .map((s) => String(s.layerId)),
  );
  return {
    ...scene,
    shapes: list(scene.shapes).filter((s) => !inkShapeIds.has(String(s.id))),
    layers: list(scene.layers).filter((l) => !inkLayerIds.has(String(l.id))),
    groups: list(scene.groups).filter((g) => g.id !== INK_GROUP_ID),
  };
}

export type ApplyInkResult = { ok: true; scene: SceneDocument } | { ok: false; error: string };

/**
 * Replaces the scene's ink layer with `strokes` (none removes it). The result is validated against the
 * shared scene schema and limits, so an over-full scene is refused with a readable message instead of
 * being silently saved invalid.
 */
export function applyInkStrokes(scene: SceneDocument, strokes: DrawingShape[]): ApplyInkResult {
  const base = withoutInk(scene);
  if (strokes.length === 0) return { ok: true, scene: base };

  const layers = list(base.layers);
  const nextOrder = layers.reduce((max, l) => Math.max(max, Number(l.order) || 0), -1) + 1;
  const paths = strokes.filter(
    (s): s is Extract<DrawingShape, { type: 'path' }> => s.type === 'path',
  );
  const newLayers = paths.map((_, i) => ({
    id: `${LAYER_PREFIX}${i + 1}`,
    name: `Ink stroke ${i + 1}`,
    order: nextOrder + i,
    visible: true,
    locked: false,
  }));
  const newShapes = paths.map((stroke, i) => ({
    id: `${STROKE_PREFIX}${i + 1}`,
    type: 'path',
    layerId: newLayers[i]!.id,
    groupId: INK_GROUP_ID,
    name: `Ink stroke ${i + 1}`,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: stroke.opacity ?? 1 },
    style: { fill: null, stroke: stroke.stroke ?? '#000000', strokeWidth: stroke.strokeWidth ?? 4 },
    points: stroke.points.map((p) => ({ x: p.x, y: p.y })),
    closed: false,
  }));
  const candidate: SceneDocument = {
    ...base,
    layers: [...layers, ...newLayers],
    shapes: [...list(base.shapes), ...newShapes],
    groups: [
      ...list(base.groups),
      {
        id: INK_GROUP_ID,
        name: 'Ink',
        layerId: newLayers[0]!.id,
        childIds: newShapes.map((s) => s.id),
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        visible: true,
        locked: false,
      },
    ],
  };
  const result = validateScene(candidate);
  if (!result.valid) {
    const limit = result.errors.find((e) => e.rule === 'limitExceeded');
    return {
      ok: false,
      error:
        limit?.message ??
        `The ink can't be saved: ${result.errors[0]?.message ?? 'the scene would be invalid'}`,
    };
  }
  return { ok: true, scene: candidate };
}

/** How many more stroke shapes the scene can hold before it hits its shape/layer limits. */
export function inkStrokeBudget(scene: SceneDocument, maxShapes: number): number {
  const others = list(scene.shapes).filter((s) => !isInkShape(s)).length;
  return Math.max(0, maxShapes - others);
}
