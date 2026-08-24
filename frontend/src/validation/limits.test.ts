/**
 * Boundary tests for schema/limits.json (Task 7).
 *
 * Every limit is checked at exactly the cap (accepted) and exactly one
 * over (rejected), generated programmatically from `schema/limits.json`
 * itself rather than hand-written per-count fixtures. See
 * `tests/test_scene_limits.py` for the equivalent Python suite.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { LIMITS, checkLimits, validateScene } from './scene';

const FIXTURES_DIR = path.resolve(__dirname, '../../../schema/fixtures');

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(path.join(FIXTURES_DIR, relativePath), 'utf-8'));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Scene = any;

function baseScene(): Scene {
  return structuredClone(readJson('valid/blank.json'));
}

function circle(id: string, layerId = 'layer-1', groupId: string | null = null) {
  return {
    id,
    type: 'circle',
    layerId,
    groupId,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    style: { fill: '#ffffff', stroke: null, strokeWidth: 0 },
    radius: 10,
  };
}

function particleEmitter(id: string, rate = 1, layerId = 'layer-1') {
  return {
    id,
    type: 'particleEmitter',
    layerId,
    groupId: null,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    style: { fill: '#ffffff', stroke: null, strokeWidth: 0 },
    rate,
    size: 1,
    lifespan: 1,
    speed: 1,
    palette: ['#ffffff'],
  };
}

function layer(id: string, order: number) {
  return { id, name: id, order, visible: true, locked: false };
}

function group(id: string, layerId = 'layer-1', childIds: string[] = []) {
  return {
    id,
    name: id,
    layerId,
    childIds,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
  };
}

function binding(id: string, targetId: string, targetScope = 'shape') {
  return {
    id,
    signal: 'indexTipX',
    handTarget: 'primary',
    targetScope,
    targetId,
    targetProperty: 'positionX',
    composition: 'replace',
  };
}

function node(id: string, family = 'transform', type = 'mapRange') {
  return { id, family, type, params: {}, position: { x: 0, y: 0 } };
}

function connection(id: string, fromNodeId: string, toNodeId: string) {
  return { id, fromNodeId, fromPort: 'out', toNodeId, toPort: 'in' };
}

describe('scene complexity limits', () => {
  it('accepts exactly maxShapes and rejects one over', () => {
    // Task 111 (issue #142): every shape needs its own layerId now.
    const atLimit = baseScene();
    atLimit.shapes = Array.from({ length: LIMITS.maxShapes }, (_, i) =>
      circle(`shape-${i}`, `layer-${i}`),
    );
    atLimit.layers = Array.from({ length: LIMITS.maxShapes }, (_, i) => layer(`layer-${i}`, i));
    expect(validateScene(atLimit).valid).toBe(true);

    const overLimit = baseScene();
    overLimit.shapes = Array.from({ length: LIMITS.maxShapes + 1 }, (_, i) =>
      circle(`shape-${i}`, `layer-${i}`),
    );
    overLimit.layers = Array.from({ length: LIMITS.maxShapes + 1 }, (_, i) =>
      layer(`layer-${i}`, i),
    );
    const result = validateScene(overLimit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('maxShapes'))).toBe(true);
  });

  it('accepts exactly maxLayers and rejects one over', () => {
    const atLimit = baseScene();
    atLimit.layers = Array.from({ length: LIMITS.maxLayers }, (_, i) => layer(`layer-${i}`, i));
    expect(validateScene(atLimit).valid).toBe(true);

    const overLimit = baseScene();
    overLimit.layers = Array.from({ length: LIMITS.maxLayers + 1 }, (_, i) =>
      layer(`layer-${i}`, i),
    );
    const result = validateScene(overLimit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('maxLayers'))).toBe(true);
  });

  it('accepts exactly maxGroups and rejects one over', () => {
    const atLimit = baseScene();
    atLimit.groups = Array.from({ length: LIMITS.maxGroups }, (_, i) => group(`group-${i}`));
    expect(validateScene(atLimit).valid).toBe(true);

    const overLimit = baseScene();
    overLimit.groups = Array.from({ length: LIMITS.maxGroups + 1 }, (_, i) => group(`group-${i}`));
    const result = validateScene(overLimit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('maxGroups'))).toBe(true);
  });

  it('accepts exactly maxGroupChildIds and rejects one over', () => {
    const limit = LIMITS.maxGroupChildIds;

    const atLimit = baseScene();
    atLimit.shapes = Array.from({ length: limit }, (_, i) =>
      circle(`shape-${i}`, `layer-${i}`, 'group-1'),
    );
    atLimit.layers = Array.from({ length: limit }, (_, i) => layer(`layer-${i}`, i));
    atLimit.groups = [
      group(
        'group-1',
        'layer-0',
        Array.from({ length: limit }, (_, i) => `shape-${i}`),
      ),
    ];
    expect(validateScene(atLimit).valid).toBe(true);

    const overLimit = baseScene();
    overLimit.shapes = Array.from({ length: limit + 1 }, (_, i) =>
      circle(`shape-${i}`, `layer-${i}`, 'group-1'),
    );
    overLimit.layers = Array.from({ length: limit + 1 }, (_, i) => layer(`layer-${i}`, i));
    overLimit.groups = [
      group(
        'group-1',
        'layer-0',
        Array.from({ length: limit + 1 }, (_, i) => `shape-${i}`),
      ),
    ];
    const result = validateScene(overLimit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('maxGroupChildIds'))).toBe(true);
  });

  it('accepts exactly maxBindings and rejects one over', () => {
    const limit = LIMITS.maxBindings;

    const atLimit = baseScene();
    atLimit.shapes = [circle('shape-1')];
    atLimit.bindings = Array.from({ length: limit }, (_, i) => binding(`binding-${i}`, 'shape-1'));
    expect(validateScene(atLimit).valid).toBe(true);

    const overLimit = baseScene();
    overLimit.shapes = [circle('shape-1')];
    overLimit.bindings = Array.from({ length: limit + 1 }, (_, i) =>
      binding(`binding-${i}`, 'shape-1'),
    );
    const result = validateScene(overLimit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('maxBindings'))).toBe(true);
  });

  it('accepts exactly maxGraphNodes/maxGraphConnections and rejects one over', () => {
    const nodeLimit = LIMITS.maxGraphNodes;
    const atNodeLimit = baseScene();
    atNodeLimit.graph.nodes = Array.from({ length: nodeLimit }, (_, i) => node(`node-${i}`));
    expect(validateScene(atNodeLimit).valid).toBe(true);

    const overNodeLimit = baseScene();
    overNodeLimit.graph.nodes = Array.from({ length: nodeLimit + 1 }, (_, i) => node(`node-${i}`));
    let result = validateScene(overNodeLimit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('maxGraphNodes'))).toBe(true);

    const connLimit = LIMITS.maxGraphConnections;
    const atConnLimit = baseScene();
    atConnLimit.graph.nodes = [node('a'), node('b')];
    atConnLimit.graph.connections = Array.from({ length: connLimit }, (_, i) =>
      connection(`conn-${i}`, 'a', 'b'),
    );
    expect(validateScene(atConnLimit).valid).toBe(true);

    const overConnLimit = baseScene();
    overConnLimit.graph.nodes = [node('a'), node('b')];
    overConnLimit.graph.connections = Array.from({ length: connLimit + 1 }, (_, i) =>
      connection(`conn-${i}`, 'a', 'b'),
    );
    result = validateScene(overConnLimit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('maxGraphConnections'))).toBe(true);
  });

  it('caps conditional nodes at exactly three', () => {
    expect(LIMITS.maxConditionalNodes).toBe(3);

    const atLimit = baseScene();
    atLimit.graph.nodes = Array.from({ length: 3 }, (_, i) =>
      node(`cond-${i}`, 'condition', 'ifElse'),
    );
    expect(validateScene(atLimit).valid).toBe(true);

    const overLimit = baseScene();
    overLimit.graph.nodes = Array.from({ length: 4 }, (_, i) =>
      node(`cond-${i}`, 'condition', 'ifElse'),
    );
    const result = validateScene(overLimit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('maxConditionalNodes'))).toBe(true);
  });

  it('accepts exactly maxParticleEmitters/maxTotalParticleRate and rejects one over', () => {
    const emitterLimit = LIMITS.maxParticleEmitters;
    const rateLimit = LIMITS.maxTotalParticleRate;
    const rateEachAtLimit = Math.floor(rateLimit / 2);

    const atLimit = baseScene();
    atLimit.shapes = [
      particleEmitter('emitter-0', rateEachAtLimit, 'layer-0'),
      particleEmitter('emitter-1', rateLimit - rateEachAtLimit, 'layer-1'),
    ];
    atLimit.layers = [layer('layer-0', 0), layer('layer-1', 1)];
    expect(validateScene(atLimit).valid).toBe(true);

    const tooManyEmitters = baseScene();
    tooManyEmitters.shapes = Array.from({ length: emitterLimit + 1 }, (_, i) =>
      particleEmitter(`emitter-${i}`, 1, `layer-${i}`),
    );
    tooManyEmitters.layers = Array.from({ length: emitterLimit + 1 }, (_, i) =>
      layer(`layer-${i}`, i),
    );
    let result = validateScene(tooManyEmitters);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('maxParticleEmitters'))).toBe(true);

    const overRate = baseScene();
    overRate.shapes = [
      particleEmitter('emitter-0', rateEachAtLimit, 'layer-0'),
      particleEmitter('emitter-1', rateLimit - rateEachAtLimit + 1, 'layer-1'),
    ];
    overRate.layers = [layer('layer-0', 0), layer('layer-1', 1)];
    result = validateScene(overRate);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('maxTotalParticleRate'))).toBe(true);
  });

  it('accepts exactly maxPathPoints and rejects one over', () => {
    const limit = LIMITS.maxPathPoints;
    const path_ = (pointCount: number) => ({
      id: 'path-1',
      type: 'path',
      layerId: 'layer-1',
      groupId: null,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      style: { fill: null, stroke: '#000000', strokeWidth: 1 },
      points: Array.from({ length: pointCount }, (_, i) => ({ x: i, y: i })),
      closed: false,
    });

    const atLimit = baseScene();
    atLimit.shapes = [path_(limit)];
    expect(validateScene(atLimit).valid).toBe(true);

    const overLimit = baseScene();
    overLimit.shapes = [path_(limit + 1)];
    const result = validateScene(overLimit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('maxPathPoints'))).toBe(true);
  });

  it('accepts exactly maxScenePayloadBytes and rejects one over', () => {
    // Exercised directly against checkLimits, the same way the Python
    // suite isolates this check — a scene this large legitimately can't
    // be built while also respecting every other per-field/per-collection
    // limit (e.g. maxLayers 20), so validateScene's combined pipeline
    // can't reach this boundary on its own.
    const limit = LIMITS.maxScenePayloadBytes;

    function sized(byteTarget: number) {
      const data: Scene = {
        shapes: [],
        groups: [],
        layers: [],
        bindings: [],
        graph: { nodes: [], connections: [] },
        padding: '',
      };
      const baseline = new TextEncoder().encode(JSON.stringify(data)).length;
      data.padding = 'x'.repeat(byteTarget - baseline);
      return data;
    }

    const atLimit = sized(limit);
    expect(new TextEncoder().encode(JSON.stringify(atLimit)).length).toBe(limit);
    expect(
      checkLimits(atLimit).some(
        (e) => e.rule === 'limitExceeded' && e.message.includes('maxScenePayloadBytes'),
      ),
    ).toBe(false);

    const overLimit = sized(limit + 1);
    expect(new TextEncoder().encode(JSON.stringify(overLimit)).length).toBe(limit + 1);
    expect(checkLimits(overLimit).some((e) => e.message.includes('maxScenePayloadBytes'))).toBe(
      true,
    );
  });

  it('does not let nesting bypass maxShapes', () => {
    const limit = LIMITS.maxShapes;
    const scene = baseScene();
    scene.shapes = Array.from({ length: limit + 1 }, (_, i) =>
      circle(`shape-${i}`, `layer-${i}`, 'group-1'),
    );
    scene.layers = Array.from({ length: limit + 1 }, (_, i) => layer(`layer-${i}`, i));
    scene.groups = [
      group(
        'group-1',
        'layer-0',
        Array.from({ length: limit + 1 }, (_, i) => `shape-${i}`),
      ),
    ];

    const result = validateScene(scene);

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.rule === 'limitExceeded' && e.message.includes('maxShapes')),
    ).toBe(true);
  });

  it('rejects duplicate identifiers rather than treating them as bypassing a limit', () => {
    const scene = baseScene();
    scene.shapes = [circle('shape-1'), circle('shape-1')];

    const result = validateScene(scene);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'duplicateId')).toBe(true);
  });

  it('accepts exactly maxGroupNestingDepth and rejects one over', () => {
    const limit = LIMITS.maxGroupNestingDepth;

    function chain(depth: number) {
      return Array.from({ length: depth }, (_, i) => {
        const childIds = i + 1 < depth ? [`group-${i + 1}`] : ['shape-leaf'];
        return group(`group-${i}`, 'layer-1', childIds);
      });
    }

    const atLimit = baseScene();
    atLimit.shapes = [circle('shape-leaf', 'layer-1', `group-${limit - 1}`)];
    atLimit.groups = chain(limit);
    expect(validateScene(atLimit).valid).toBe(true);

    const overLimit = baseScene();
    overLimit.shapes = [circle('shape-leaf', 'layer-1', `group-${limit}`)];
    overLimit.groups = chain(limit + 1);
    const result = validateScene(overLimit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('maxGroupNestingDepth'))).toBe(true);
  });

  it('has every limits.json key wired into checkLimits', () => {
    const source = readFileSync(path.resolve(__dirname, 'scene.ts'), 'utf-8');
    for (const limitKey of Object.keys(LIMITS)) {
      expect(source.includes(limitKey), `'${limitKey}' not referenced in scene.ts`).toBe(true);
    }
  });
});
