import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { stripSceneForExport } from './sceneExportStripping';

const SCENE: SceneDocument = {
  schemaVersion: 1,
  id: 'scene-internal-id-123',
  canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
  renderer: { preferred: 'p5' },
  layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
  shapes: [{ id: 'shape-1', type: 'circle', layerId: 'layer-1' }],
  groups: [],
  bindings: [],
  graph: { nodes: [], connections: [] },
  accessibility: { reducedMotion: 'auto' },
  randomness: { seed: 0, enabled: false },
};

describe('stripSceneForExport', () => {
  it('removes the scene document top-level id', () => {
    const stripped = stripSceneForExport(SCENE);
    expect(stripped).not.toHaveProperty('id');
  });

  it('preserves structural ids on shapes/layers needed for rendering', () => {
    const stripped = stripSceneForExport(SCENE);
    expect((stripped.layers as Array<{ id: string }>)[0].id).toBe('layer-1');
    expect((stripped.shapes as Array<{ id: string }>)[0].id).toBe('shape-1');
  });

  it('preserves every other field unchanged', () => {
    const stripped = stripSceneForExport(SCENE);
    expect(stripped.canvas).toEqual(SCENE.canvas);
    expect(stripped.schemaVersion).toBe(1);
  });

  it('does not mutate the input', () => {
    const clone = JSON.parse(JSON.stringify(SCENE));
    stripSceneForExport(SCENE);
    expect(SCENE).toEqual(clone);
  });
});
