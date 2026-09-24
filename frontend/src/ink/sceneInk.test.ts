import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import type { DrawingShape } from '../pages/scene3dTypes';
import { validateScene } from '../validation/scene';
import {
  INK_GROUP_ID,
  applyInkStrokes,
  hasInkLayer,
  inkStrokeBudget,
  readInkStrokes,
} from './sceneInk';

const emptyScene = (): SceneDocument => ({
  schemaVersion: 1,
  id: 'scene-1',
  canvas: { width: 1280, height: 900, backgroundColor: '#ffffff' },
  renderer: { preferred: 'p5' },
  layers: [{ id: 'layer-a', name: 'Layer 1', order: 0, visible: true, locked: false }],
  shapes: [
    {
      id: 'shape-a',
      type: 'rect',
      layerId: 'layer-a',
      groupId: null,
      transform: { x: 10, y: 10, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      style: { fill: '#ff0000', stroke: null, strokeWidth: 0 },
      width: 40,
      height: 40,
      cornerRadius: 0,
    },
  ],
  groups: [],
  bindings: [],
  graph: { nodes: [], connections: [] },
  accessibility: { reducedMotion: 'auto' },
  randomness: { seed: 0, enabled: false },
});

const stroke = (id: string, x: number): DrawingShape => ({
  id,
  type: 'path',
  points: [
    { x, y: 10 },
    { x: x + 20, y: 30 },
    { x: x + 40, y: 10 },
  ],
  closed: false,
  fill: null,
  stroke: '#123456',
  strokeWidth: 5,
  opacity: 0.7,
});

describe('scene ink layer (#775)', () => {
  it('the base fixture is itself valid', () => {
    expect(validateScene(emptyScene()).valid).toBe(true);
  });

  it('stores many strokes under one ink group and stays schema-valid', () => {
    const result = applyInkStrokes(emptyScene(), [
      stroke('a', 0),
      stroke('b', 100),
      stroke('c', 200),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(validateScene(result.scene).valid).toBe(true);
    const groups = result.scene.groups as Array<{ id: string; childIds: string[] }>;
    expect(groups.filter((g) => g.id === INK_GROUP_ID)).toHaveLength(1);
    expect(groups[0]!.childIds).toHaveLength(3);
    expect(hasInkLayer(result.scene)).toBe(true);
    // Existing artwork is untouched.
    expect((result.scene.shapes as unknown[])[0]).toEqual((emptyScene().shapes as unknown[])[0]);
  });

  it('round-trips strokes (points, colour, width, opacity) through the scene', () => {
    const applied = applyInkStrokes(emptyScene(), [stroke('a', 0), stroke('b', 100)]);
    if (!applied.ok) throw new Error(applied.error);
    const read = readInkStrokes(applied.scene);
    expect(read).toHaveLength(2);
    expect(read[1]).toMatchObject({
      type: 'path',
      stroke: '#123456',
      strokeWidth: 5,
      opacity: 0.7,
      points: [
        { x: 100, y: 10 },
        { x: 120, y: 30 },
        { x: 140, y: 10 },
      ],
    });
  });

  it('re-applying replaces the previous ink instead of accumulating it', () => {
    const first = applyInkStrokes(emptyScene(), [stroke('a', 0), stroke('b', 100)]);
    if (!first.ok) throw new Error(first.error);
    const second = applyInkStrokes(first.scene, [stroke('c', 5)]);
    if (!second.ok) throw new Error(second.error);
    expect(readInkStrokes(second.scene)).toHaveLength(1);
    expect((second.scene.layers as unknown[]).length).toBe(2);
    expect(validateScene(second.scene).valid).toBe(true);
  });

  it('clearing removes the ink group, its strokes and their layers', () => {
    const applied = applyInkStrokes(emptyScene(), [stroke('a', 0)]);
    if (!applied.ok) throw new Error(applied.error);
    const cleared = applyInkStrokes(applied.scene, []);
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(hasInkLayer(cleared.scene)).toBe(false);
    expect(cleared.scene).toEqual(emptyScene());
  });

  it('refuses ink that would exceed the scene limits with a readable message', () => {
    const many = Array.from({ length: 250 }, (_, i) => stroke(`s${i}`, i));
    const result = applyInkStrokes(emptyScene(), many);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(10);
  });

  it('reports the remaining stroke budget', () => {
    expect(inkStrokeBudget(emptyScene(), 200)).toBe(199);
  });
});
