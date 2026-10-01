import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { LIMITS } from '../validation/scene';
import { summarizeSceneDiff } from './sceneDiff';

const BLANK = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../../schema/fixtures/valid/blank.json'), 'utf8'),
) as Record<string, any>;

function sceneWithShapes(count: number): Record<string, any> {
  const scene = structuredClone(BLANK);
  scene.layers = Array.from({ length: count }, (_, index) => ({
    id: `layer-${index}`,
    name: `Layer ${index}`,
    order: index,
    visible: true,
    locked: false,
  }));
  scene.shapes = Array.from({ length: count }, (_, index) => ({
    id: `shape-${index}`,
    type: 'circle',
    layerId: `layer-${index}`,
    groupId: null,
    transform: { x: index, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    style: { fill: '#112233', stroke: null, strokeWidth: 0 },
    radius: 10,
  }));
  return scene;
}

function success(result: ReturnType<typeof summarizeSceneDiff>) {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result;
}

describe('summarizeSceneDiff', () => {
  it('returns an empty stable summary for identical scenes', () => {
    const result = success(summarizeSceneDiff(BLANK, BLANK));
    expect(result.shapes).toEqual({
      added: { count: 0, items: [], omitted: 0 },
      removed: { count: 0, items: [], omitted: 0 },
      changed: { count: 0, items: [], omitted: 0 },
    });
    expect(result.canvas).toEqual({ changed: false, properties: [] });
  });

  it('summarizes additions, removals, reordering, renames, nested properties, canvas and entity changes', () => {
    const before = sceneWithShapes(2);
    const after = structuredClone(before);
    after.shapes = [after.shapes[1]];
    after.shapes[0].style.fill = '#ffffff';
    after.layers = [
      { ...after.layers[1], name: 'Renamed layer' },
      { id: 'layer-new', name: 'New', order: 2, visible: true, locked: false },
    ];
    after.shapes.push({
      ...after.shapes[0],
      id: 'shape-new',
      layerId: 'layer-new',
      groupId: 'group-new',
    });
    after.groups = [
      {
        id: 'group-new',
        name: 'Group',
        layerId: 'layer-new',
        childIds: ['shape-new'],
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        visible: true,
        locked: false,
      },
    ];
    after.bindings = [
      {
        id: 'binding-new',
        targetId: 'shape-new',
        targetScope: 'shape',
        signal: 'indexTipX',
        handTarget: 'primary',
        targetProperty: 'positionX',
        composition: 'replace',
      },
    ];
    after.canvas.width = 900;

    const result = success(summarizeSceneDiff(before, after));
    expect(result.shapes.added.items).toEqual([{ id: 'shape-new' }]);
    expect(result.shapes.removed.items).toEqual([{ id: 'shape-0' }]);
    expect(result.shapes.changed.items).toEqual([{ id: 'shape-1', properties: ['style.fill'] }]);
    expect(result.layers.added.items).toEqual([{ id: 'layer-new' }]);
    expect(result.layers.removed.items).toEqual([{ id: 'layer-0' }]);
    expect(result.layers.renamed.items).toEqual([
      { id: 'layer-1', from: 'Layer 1', to: 'Renamed layer' },
    ]);
    expect(result.groups.added.items).toEqual([{ id: 'group-new' }]);
    expect(result.bindings.added.items).toEqual([{ id: 'binding-new' }]);
    expect(result.canvas).toEqual({ changed: true, properties: ['width'] });
  });

  it('sorts and caps lists while reporting the omitted count', () => {
    const before = sceneWithShapes(0);
    const after = sceneWithShapes(60);
    const result = success(summarizeSceneDiff(before, after));
    expect(result.shapes.added.count).toBe(60);
    expect(result.shapes.added.items).toHaveLength(50);
    expect(result.shapes.added.items[0].id).toBe('shape-0');
    expect(result.shapes.added.omitted).toBe(10);
  });

  it('handles scenes at schema/limits.json shape and layer ceilings without mutating inputs', () => {
    const before = sceneWithShapes(LIMITS.maxShapes);
    const after = structuredClone(before);
    after.shapes[0].transform.x = 42;
    const beforeJson = JSON.stringify(before);
    const afterJson = JSON.stringify(after);
    const started = performance.now();
    const result = success(summarizeSceneDiff(before, after));
    const elapsedMs = performance.now() - started;
    expect(result.shapes.changed.count).toBe(1);
    expect(elapsedMs).toBeLessThan(50);
    expect(JSON.stringify(before)).toBe(beforeJson);
    expect(JSON.stringify(after)).toBe(afterJson);
  });

  it('returns typed errors for malformed and oversized inputs', () => {
    expect(summarizeSceneDiff({}, BLANK)).toMatchObject({
      ok: false,
      error: { code: 'invalid_scene' },
    });
    expect(
      summarizeSceneDiff({ ...BLANK, description: 'x'.repeat(LIMITS.maxScenePayloadBytes) }, BLANK),
    ).toMatchObject({ ok: false, error: { code: 'scene_too_large' } });
  });

  it('does not throw when optional sections are absent', () => {
    const scene = structuredClone(BLANK);
    expect(success(summarizeSceneDiff(scene, { ...scene, sonic: undefined })).ok).toBe(true);
  });
});
