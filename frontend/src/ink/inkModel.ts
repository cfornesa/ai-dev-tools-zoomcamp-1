/**
 * Issues #775/#781: the ink editor's pure state. Strokes are `DrawingShape` paths in the drawing's pixel
 * space. History is a linear undo/redo stack independent of any scene undo stack, so cancelling an ink
 * session never disturbs (or is disturbed by) the surrounding editor's history.
 */
import {
  commitVisitorHistory,
  createVisitorHistory,
  redoVisitorHistory,
  undoVisitorHistory,
  type VisitorHistory,
} from '../pages/visitorDrawingHistory';
import type { DrawingShape } from '../pages/scene3dTypes';
import { moveShape, shapeHit, thinPoints, topShapeAt, type InkPoint } from './inkGeometry';

export type InkTool = 'pen' | 'pencil' | 'eraser' | 'select';
export type InkBrush = { color: string; size: number };

export const INK_MAX_POINTS_PER_STROKE = 2000;
export const INK_MAX_STROKES = 500;

export type InkState = {
  history: VisitorHistory<DrawingShape>;
  selectedId: string | null;
  /** The shapes the session started with, so Cancel restores them exactly. */
  original: DrawingShape[];
};

export function createInkState(shapes: DrawingShape[]): InkState {
  return { history: createVisitorHistory(shapes), selectedId: null, original: shapes };
}

export const inkShapes = (state: InkState): DrawingShape[] => state.history.present;
export const inkDirty = (state: InkState): boolean => state.history.past.length > 0;
export const canUndo = (state: InkState) => state.history.past.length > 0;
export const canRedo = (state: InkState) => state.history.future.length > 0;

export function nextInkId(shapes: DrawingShape[], prefix = 'ink'): string {
  const used = new Set(shapes.map((s) => s.id));
  let n = shapes.length + 1;
  while (used.has(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

/** Builds a stroke shape; a pencil is thinner and slightly translucent, a pen solid. */
export function buildStroke(
  id: string,
  tool: 'pen' | 'pencil',
  points: InkPoint[],
  brush: InkBrush,
  maxPoints = INK_MAX_POINTS_PER_STROKE,
): DrawingShape {
  const thinned = thinPoints(points, Math.max(1, brush.size / 3));
  const capped =
    thinned.length > maxPoints ? thinPoints(thinned, Math.max(brush.size, 2)) : thinned;
  return {
    id,
    type: 'path',
    points: capped
      .slice(0, maxPoints)
      .map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })),
    closed: false,
    fill: null,
    stroke: brush.color,
    strokeWidth: tool === 'pencil' ? Math.max(1, brush.size * 0.5) : brush.size,
    opacity: tool === 'pencil' ? 0.7 : 1,
  };
}

export type AddStrokeResult = { state: InkState; error?: string };

export function addStroke(
  state: InkState,
  stroke: DrawingShape,
  maxStrokes = INK_MAX_STROKES,
): AddStrokeResult {
  const shapes = inkShapes(state);
  if (shapes.length >= maxStrokes) {
    return {
      state,
      error: `This ink layer is full (${maxStrokes} strokes). Erase or clear some before drawing more.`,
    };
  }
  return {
    state: {
      ...state,
      history: commitVisitorHistory(state.history, [...shapes, stroke]),
      selectedId: null,
    },
  };
}

/** Removes every stroke touched by an eraser dab at `points` (stroke-level erase). */
export function eraseAt(state: InkState, points: InkPoint[], radius: number): InkState {
  const shapes = inkShapes(state);
  const kept = shapes.filter((s) => !points.some((p) => shapeHit(s, p, radius)));
  if (kept.length === shapes.length) return state;
  return { ...state, history: commitVisitorHistory(state.history, kept), selectedId: null };
}

export function selectAt(state: InkState, point: InkPoint, radius: number): InkState {
  const hit = topShapeAt(inkShapes(state), point, radius);
  return { ...state, selectedId: hit?.id ?? null };
}

/** Moves the selection; with `merge` the move folds into the latest history entry (one undo per drag). */
export function moveSelected(state: InkState, dx: number, dy: number, merge = false): InkState {
  if (!state.selectedId) return state;
  const shapes = inkShapes(state).map((s) =>
    s.id === state.selectedId ? moveShape(s, dx, dy) : s,
  );
  if (merge) return { ...state, history: { ...state.history, present: shapes } };
  return { ...state, history: commitVisitorHistory(state.history, shapes) };
}

export function deleteSelected(state: InkState): InkState {
  if (!state.selectedId) return state;
  const shapes = inkShapes(state).filter((s) => s.id !== state.selectedId);
  return { ...state, history: commitVisitorHistory(state.history, shapes), selectedId: null };
}

export function clearAll(state: InkState): InkState {
  if (inkShapes(state).length === 0) return state;
  return { ...state, history: commitVisitorHistory(state.history, []), selectedId: null };
}

export function undo(state: InkState): InkState {
  return { ...state, history: undoVisitorHistory(state.history), selectedId: null };
}

export function redo(state: InkState): InkState {
  return { ...state, history: redoVisitorHistory(state.history), selectedId: null };
}
