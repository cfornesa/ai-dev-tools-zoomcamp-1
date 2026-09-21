import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { buildAITargetOptions, targetIdsFor } from './aiTargeting';

const SCENE = {
  schemaVersion: 1,
  id: 'scene-1',
  canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
  renderer: { preferred: 'p5' },
  layers: [
    { id: 'layer-1', name: 'Artwork', order: 0, visible: true, locked: false },
    { id: 'layer-locked', name: 'Locked', order: 1, visible: true, locked: true },
  ],
  shapes: [
    {
      id: 'shape-1',
      type: 'circle',
      layerId: 'layer-1',
      groupId: 'group-1',
      transform: { x: 10, y: 10, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      style: { fill: '#fff', stroke: null, strokeWidth: 0 },
      radius: 10,
    },
    {
      id: 'image-1',
      type: 'image',
      layerId: 'layer-locked',
      groupId: null,
      transform: { x: 10, y: 10, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      style: { fill: null, stroke: null, strokeWidth: 0 },
      mediaAssetId: 'asset-1',
      altText: null,
      decorative: true,
    },
  ],
  groups: [
    {
      id: 'group-1',
      name: 'Foreground',
      layerId: 'layer-1',
      childIds: ['shape-1'],
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      visible: true,
      locked: false,
    },
  ],
  bindings: [],
  graph: { nodes: [], connections: [] },
  accessibility: { reducedMotion: 'auto' },
  randomness: { seed: 0, enabled: false },
} as unknown as SceneDocument;

describe('AI target options', () => {
  it('offers typed scene targets and expands a group to stable descendant ids', () => {
    const options = buildAITargetOptions(SCENE);
    expect(options.find((option) => option.id === 'group-1')).toMatchObject({
      type: 'group',
      descendantIds: ['group-1', 'shape-1'],
    });
    expect(options.find((option) => option.id === 'asset-1')).toMatchObject({
      type: 'media',
      disabled: true,
      disabledReason: 'Locked',
    });
    expect(options.find((option) => option.id === 'layer-locked')).toMatchObject({
      disabled: true,
      disabledReason: 'Locked',
    });
    expect(targetIdsFor(options, ['group-1'])).toEqual(['group-1', 'shape-1']);
  });

  it('marks draw.io nodes unavailable instead of silently omitting them', () => {
    const options = buildAITargetOptions({
      ...SCENE,
      documentType: 'drawio',
      drawio: { formatVersion: 1, layers: [], objects: [{ id: 'node-1', label: 'Node' }] },
    });
    expect(options.find((option) => option.id === 'node-1')).toMatchObject({
      type: 'drawio-node',
      disabled: true,
    });
  });
});
