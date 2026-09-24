import { describe, expect, it } from 'vitest';

import type { DrawingShape } from '../pages/scene3dTypes';
import {
  INK_MAX_STROKES,
  addStroke,
  buildStroke,
  canRedo,
  canUndo,
  clearAll,
  createInkState,
  deleteSelected,
  eraseAt,
  inkDirty,
  inkShapes,
  moveSelected,
  nextInkId,
  redo,
  selectAt,
  undo,
} from './inkModel';

const brush = { color: '#112233', size: 6 };
const line = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i * 4, y: 10 }));

describe('ink model (#775)', () => {
  it('builds pen and pencil strokes with distinct weight and opacity', () => {
    const pen = buildStroke('a', 'pen', line(10), brush) as Extract<DrawingShape, { type: 'path' }>;
    const pencil = buildStroke('b', 'pencil', line(10), brush) as Extract<
      DrawingShape,
      { type: 'path' }
    >;
    expect(pen.strokeWidth).toBe(6);
    expect(pen.opacity).toBe(1);
    expect(pencil.strokeWidth).toBe(3);
    expect(pencil.opacity).toBe(0.7);
    expect(pen.closed).toBe(false);
  });

  it('caps the points of a very long stroke at the schema limit', () => {
    const stroke = buildStroke(
      'a',
      'pen',
      line(9000).map((p) => ({ x: p.x / 4, y: p.y })),
      {
        color: '#000000',
        size: 1,
      },
    ) as Extract<DrawingShape, { type: 'path' }>;
    expect(stroke.points.length).toBeLessThanOrEqual(2000);
  });

  it('adds, undoes and redoes strokes on an independent history', () => {
    let state = createInkState([]);
    state = addStroke(state, buildStroke('s1', 'pen', line(5), brush)).state;
    state = addStroke(state, buildStroke('s2', 'pen', line(5), brush)).state;
    expect(inkShapes(state)).toHaveLength(2);
    expect(inkDirty(state)).toBe(true);
    state = undo(state);
    expect(inkShapes(state).map((s) => s.id)).toEqual(['s1']);
    expect(canRedo(state)).toBe(true);
    state = redo(state);
    expect(inkShapes(state)).toHaveLength(2);
    state = undo(undo(state));
    expect(canUndo(state)).toBe(false);
    expect(inkShapes(state)).toEqual([]);
  });

  it('a new stroke after undo drops the redo branch', () => {
    let state = createInkState([]);
    state = addStroke(state, buildStroke('s1', 'pen', line(5), brush)).state;
    state = undo(state);
    state = addStroke(state, buildStroke('s2', 'pen', line(5), brush)).state;
    expect(canRedo(state)).toBe(false);
  });

  it('erases only the strokes the eraser touches', () => {
    let state = createInkState([]);
    state = addStroke(state, buildStroke('near', 'pen', line(10), brush)).state;
    state = addStroke(
      state,
      buildStroke(
        'far',
        'pen',
        line(10).map((p) => ({ x: p.x, y: 200 })),
        brush,
      ),
    ).state;
    state = eraseAt(state, [{ x: 8, y: 10 }], 4);
    expect(inkShapes(state).map((s) => s.id)).toEqual(['far']);
    expect(eraseAt(state, [{ x: 900, y: 900 }], 4)).toBe(state);
  });

  it('selects, moves and deletes a stroke, each undoable', () => {
    let state = addStroke(createInkState([]), buildStroke('s1', 'pen', line(10), brush)).state;
    state = selectAt(state, { x: 8, y: 10 }, 4);
    expect(state.selectedId).toBe('s1');
    state = moveSelected(state, 10, 20);
    expect((inkShapes(state)[0] as Extract<DrawingShape, { type: 'path' }>).points[0]).toEqual({
      x: 10,
      y: 30,
    });
    state = deleteSelected(state);
    expect(inkShapes(state)).toEqual([]);
    state = undo(state);
    expect(inkShapes(state)).toHaveLength(1);
  });

  it('merged moves fold into one undo step', () => {
    let state = addStroke(createInkState([]), buildStroke('s1', 'pen', line(10), brush)).state;
    state = selectAt(state, { x: 8, y: 10 }, 4);
    state = moveSelected(state, 5, 0);
    state = moveSelected(state, 5, 0, true);
    state = moveSelected(state, 5, 0, true);
    expect((inkShapes(state)[0] as Extract<DrawingShape, { type: 'path' }>).points[0]!.x).toBe(15);
    expect(state.history.past).toHaveLength(2);
  });

  it('clear wipes everything and stays undoable; original is kept for Cancel', () => {
    const seed = [buildStroke('seed', 'pen', line(4), brush)];
    let state = createInkState(seed);
    state = clearAll(state);
    expect(inkShapes(state)).toEqual([]);
    expect(state.original).toBe(seed);
    expect(inkShapes(undo(state))).toEqual(seed);
  });

  it('refuses strokes beyond the per-layer limit with a friendly message', () => {
    const many = Array.from({ length: INK_MAX_STROKES }, (_, i) =>
      buildStroke(`m${i}`, 'pen', line(3), brush),
    );
    const result = addStroke(createInkState(many), buildStroke('x', 'pen', line(3), brush));
    expect(result.error).toMatch(/full/);
    expect(inkShapes(result.state)).toHaveLength(INK_MAX_STROKES);
  });

  it('generates unused ids', () => {
    expect(nextInkId([{ id: 'ink-2', type: 'line', x1: 0, y1: 0, x2: 1, y2: 1 }])).toBe('ink-3');
  });
});
