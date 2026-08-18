/**
 * Shared scene-document builders for `sceneDrawPlan.test.ts` and
 * `p5Adapter.test.ts`. Not imported by any non-test module.
 */
import type { SceneDocument } from '../api/projects';

export type Transform = {
  x: number;
  y: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  opacity?: number;
};

export function transform(t: Transform) {
  return {
    x: t.x,
    y: t.y,
    scaleX: t.scaleX ?? 1,
    scaleY: t.scaleY ?? 1,
    rotation: t.rotation ?? 0,
    opacity: t.opacity ?? 1,
  };
}

export function style(
  overrides: Partial<{ fill: string | null; stroke: string | null; strokeWidth: number }> = {},
) {
  return { fill: '#4f46e5', stroke: null, strokeWidth: 0, ...overrides };
}

export function layer(
  overrides: Partial<{
    id: string;
    name: string;
    order: number;
    visible: boolean;
    locked: boolean;
  }> = {},
) {
  return {
    id: 'layer-1',
    name: 'Layer',
    order: 0,
    visible: true,
    locked: false,
    ...overrides,
  };
}

export function baseScene(overrides: Partial<SceneDocument> = {}): SceneDocument {
  return {
    schemaVersion: 1,
    id: 'scene-1',
    canvas: { width: 64, height: 64, backgroundColor: '#000000' },
    renderer: { preferred: 'p5' },
    layers: [layer()],
    shapes: [],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
    ...overrides,
  };
}

export function circleShape(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shape-circle',
    type: 'circle',
    layerId: 'layer-1',
    groupId: null,
    transform: transform({ x: 0, y: 0 }),
    style: style(),
    radius: 5,
    ...overrides,
  };
}

export function rectShape(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shape-rect',
    type: 'rect',
    layerId: 'layer-1',
    groupId: null,
    transform: transform({ x: 0, y: 0 }),
    style: style(),
    width: 10,
    height: 10,
    cornerRadius: 0,
    ...overrides,
  };
}

export function lineShape(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shape-line',
    type: 'line',
    layerId: 'layer-1',
    groupId: null,
    transform: transform({ x: 0, y: 0 }),
    style: style({ stroke: '#ffffff', strokeWidth: 1 }),
    x2: 10,
    y2: 0,
    ...overrides,
  };
}

export function pathShape(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shape-path',
    type: 'path',
    layerId: 'layer-1',
    groupId: null,
    transform: transform({ x: 0, y: 0 }),
    style: style(),
    points: [
      { x: -5, y: -5 },
      { x: 5, y: -5 },
      { x: 5, y: 5 },
      { x: -5, y: 5 },
    ],
    closed: true,
    ...overrides,
  };
}

export function particleEmitterShape(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shape-emitter',
    type: 'particleEmitter',
    layerId: 'layer-1',
    groupId: null,
    transform: transform({ x: 0, y: 0 }),
    style: style({ fill: '#111111' }),
    rate: 10,
    size: 8,
    lifespan: 1,
    speed: 10,
    palette: ['#ff00ff'],
    ...overrides,
  };
}

export function group(overrides: Record<string, unknown> = {}) {
  return {
    id: 'group-1',
    name: 'Group',
    layerId: 'layer-1',
    childIds: [],
    transform: transform({ x: 0, y: 0 }),
    visible: true,
    locked: false,
    ...overrides,
  };
}
