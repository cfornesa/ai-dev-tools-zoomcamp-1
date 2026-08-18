import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import {
  checkRendererCompatibility,
  getAvailableInteractionModes,
  sceneUsesCameraInput,
} from './exportCompatibility';

const BASE_SCENE: SceneDocument = {
  schemaVersion: 1,
  id: 'scene-1',
  canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
  renderer: { preferred: 'p5' },
  layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
  shapes: [],
  groups: [],
  bindings: [],
  graph: { nodes: [], connections: [] },
  accessibility: { reducedMotion: 'auto' },
  randomness: { seed: 0, enabled: false },
};

function sceneWithShapes(...types: string[]): SceneDocument {
  return {
    ...BASE_SCENE,
    shapes: types.map((type, index) => ({ id: `shape-${index}`, type, layerId: 'layer-1' })),
  };
}

function sceneWithNodes(...types: string[]): SceneDocument {
  return {
    ...BASE_SCENE,
    graph: {
      nodes: types.map((type, index) => ({ id: `node-${index}`, family: 'input', type })),
      connections: [],
    },
  };
}

describe('checkRendererCompatibility', () => {
  it('is compatible with every shape/node type the schema and runtime currently allow', () => {
    const scene = {
      ...BASE_SCENE,
      shapes: [
        { id: 's1', type: 'circle', layerId: 'layer-1' },
        { id: 's2', type: 'rect', layerId: 'layer-1' },
        { id: 's3', type: 'line', layerId: 'layer-1' },
        { id: 's4', type: 'path', layerId: 'layer-1' },
        { id: 's5', type: 'particleEmitter', layerId: 'layer-1' },
      ],
      graph: {
        nodes: [
          { id: 'n1', family: 'input', type: 'handSignal' },
          { id: 'n2', family: 'input', type: 'gestureEvent' },
          { id: 'n3', family: 'transform', type: 'mapRange' },
          { id: 'n4', family: 'condition', type: 'ifElse' },
          { id: 'n5', family: 'visual', type: 'shapeProperty' },
          { id: 'n6', family: 'flow', type: 'trigger' },
        ],
        connections: [],
      },
    };

    expect(checkRendererCompatibility(scene, 'p5js')).toEqual([]);
  });

  it('names each exact unsupported shape type, not a generic message', () => {
    const scene = sceneWithShapes('circle', 'sprite3d', 'holographicMesh');

    const errors = checkRendererCompatibility(scene, 'p5js');

    expect(errors).toEqual([
      'Shape type "sprite3d" is not supported by the p5.js renderer.',
      'Shape type "holographicMesh" is not supported by the p5.js renderer.',
    ]);
  });

  it('names each exact unsupported behavior node type', () => {
    const scene = sceneWithNodes('handSignal', 'quantumEntangle');

    const errors = checkRendererCompatibility(scene, 'p5js');

    expect(errors).toEqual([
      'Behavior node type "quantumEntangle" is not supported by the p5.js renderer.',
    ]);
  });
});

describe('sceneUsesCameraInput / getAvailableInteractionModes', () => {
  it('reports no camera input and only demo-only availability for a scene with no handSignal/gestureEvent nodes', () => {
    const scene = sceneWithNodes('timer', 'oscillator');

    expect(sceneUsesCameraInput(scene)).toBe(false);
    expect(getAvailableInteractionModes(scene)).toEqual(['demo']);
  });

  it('reports camera input and all three modes available for a scene using a handSignal node', () => {
    const scene = sceneWithNodes('handSignal');

    expect(sceneUsesCameraInput(scene)).toBe(true);
    expect(getAvailableInteractionModes(scene)).toEqual(['demo', 'camera', 'demo-camera']);
  });

  it('reports camera input for a scene using a gestureEvent node', () => {
    const scene = sceneWithNodes('gestureEvent');

    expect(sceneUsesCameraInput(scene)).toBe(true);
    expect(getAvailableInteractionModes(scene)).toEqual(['demo', 'camera', 'demo-camera']);
  });

  it('treats a scene with an empty graph as demo-only', () => {
    expect(sceneUsesCameraInput(BASE_SCENE)).toBe(false);
    expect(getAvailableInteractionModes(BASE_SCENE)).toEqual(['demo']);
  });
});
