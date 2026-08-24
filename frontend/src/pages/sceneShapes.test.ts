import { describe, expect, it } from 'vitest';

import { validateScene } from '../validation/scene';
import {
  createShape,
  duplicateShape,
  getEditableShapes,
  hitTestTopmostShapeAt,
  shapeLabel,
  type ShapeType,
} from './sceneShapes';

const CANVAS = { width: 800, height: 600 };

function baseScene(shapes: unknown[]) {
  return {
    schemaVersion: 1,
    id: 'scene-1',
    canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
    renderer: { preferred: 'p5' },
    layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
    shapes,
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
  };
}

describe('createShape', () => {
  const types: ShapeType[] = ['circle', 'rect', 'line', 'path'];

  it.each(types)('produces a schema-valid %s shape with a unique id', (type) => {
    const shape = createShape(type, 'layer-1', CANVAS);
    const scene = baseScene([shape]);
    const result = validateScene(scene);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(shape.id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(shape.layerId).toBe('layer-1');
  });

  it('gives each created shape a distinct id', () => {
    const a = createShape('circle', 'layer-1', CANVAS);
    const b = createShape('circle', 'layer-1', CANVAS);
    expect(a.id).not.toBe(b.id);
  });

  it('produces the approved polygon primitive as a closed path', () => {
    const shape = createShape('path', 'layer-1', CANVAS);
    expect(shape.type).toBe('path');
    if (shape.type !== 'path') throw new Error('expected a path shape');
    expect(shape.closed).toBe(true);
    expect(shape.points.length).toBeGreaterThanOrEqual(2);
  });
});

describe('duplicateShape', () => {
  it('gives the duplicate a new id while preserving supported source properties', () => {
    const source = createShape('rect', 'layer-1', CANVAS);
    const copy = duplicateShape(source);

    expect(copy.id).not.toBe(source.id);
    expect(copy.type).toBe(source.type);
    expect(copy.layerId).toBe(source.layerId);
    expect(copy.style).toEqual(source.style);
    if (copy.type === 'rect' && source.type === 'rect') {
      expect(copy.width).toBe(source.width);
      expect(copy.height).toBe(source.height);
    }
  });

  it('is independent of the source: mutating the copy does not affect the source', () => {
    const source = createShape('path', 'layer-1', CANVAS);
    const copy = duplicateShape(source);
    if (copy.type === 'path') {
      copy.points.push({ x: 999, y: 999 });
    }
    if (source.type === 'path') {
      expect(source.points).not.toContainEqual({ x: 999, y: 999 });
    }
  });

  it('offsets the duplicate position so it is not exactly stacked on the source', () => {
    const source = createShape('circle', 'layer-1', CANVAS);
    const copy = duplicateShape(source);
    expect(copy.transform.x).not.toBe(source.transform.x);
    expect(copy.transform.y).not.toBe(source.transform.y);
  });

  it('produces a schema-valid duplicate alongside its source', () => {
    // Task 111 (issue #142): duplicateShape itself only copies position/id
    // -- the caller (useSceneEditor.ts's duplicateSelected) is responsible
    // for giving the copy its own new layer, since every shape needs one.
    // baseScene's second layer here stands in for that caller-assigned layer.
    const source = createShape('line', 'layer-1', CANVAS);
    const copy = { ...duplicateShape(source), layerId: 'layer-2' };
    const scene = baseScene([source, copy]);
    scene.layers.push({ id: 'layer-2', name: 'Layer 2', order: 1, visible: true, locked: false });
    const result = validateScene(scene);
    expect(result.valid).toBe(true);
  });
});

describe('getEditableShapes', () => {
  it('returns only the four V1 primitives this task supports', () => {
    const circle = createShape('circle', 'layer-1', CANVAS);
    const particleEmitter = {
      id: 'emitter-1',
      type: 'particleEmitter',
      layerId: 'layer-1',
      groupId: null,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      style: { fill: '#fff', stroke: null, strokeWidth: 0 },
      rate: 1,
      size: 1,
      lifespan: 1,
      speed: 1,
      palette: ['#ffffff'],
    };

    const editable = getEditableShapes([circle, particleEmitter]);

    expect(editable).toHaveLength(1);
    expect(editable[0].id).toBe(circle.id);
  });

  it('returns an empty array for non-array input', () => {
    expect(getEditableShapes(undefined)).toEqual([]);
    expect(getEditableShapes(null)).toEqual([]);
  });
});

describe('hitTestTopmostShapeAt', () => {
  it('resolves overlapping shapes to the topmost (last-in-array) one', () => {
    const bottom = createShape('rect', 'layer-1', CANVAS); // centered at (350,260)-(450,340)
    const top = createShape('circle', 'layer-1', CANVAS); // centered at (400,300), r=50

    // Both shapes overlap around the canvas center (400, 300).
    const hit = hitTestTopmostShapeAt([bottom, top], 400, 300);
    expect(hit?.id).toBe(top.id);
  });

  it('picks the correct shape when three shapes overlap, by z-order', () => {
    const a = createShape('circle', 'layer-1', CANVAS);
    const b = createShape('circle', 'layer-1', CANVAS);
    const c = createShape('circle', 'layer-1', CANVAS);

    expect(hitTestTopmostShapeAt([a, b, c], 400, 300)?.id).toBe(c.id);
    // Removing the topmost shape reveals the next one down.
    expect(hitTestTopmostShapeAt([a, b], 400, 300)?.id).toBe(b.id);
    expect(hitTestTopmostShapeAt([a], 400, 300)?.id).toBe(a.id);
  });

  it('returns null when the point is outside every shape', () => {
    const circle = createShape('circle', 'layer-1', CANVAS);
    expect(hitTestTopmostShapeAt([circle], 0, 0)).toBeNull();
  });

  it('returns null for an empty shape list', () => {
    expect(hitTestTopmostShapeAt([], 400, 300)).toBeNull();
  });
});

describe('shapeLabel', () => {
  it('labels a shape with its friendly type name and 1-based ordinal', () => {
    const shape = createShape('circle', 'layer-1', CANVAS);
    expect(shapeLabel(shape, [shape])).toBe('Circle 1');
  });

  it('numbers same-type shapes independently in array order', () => {
    const rect1 = createShape('rect', 'layer-1', CANVAS);
    const circle1 = createShape('circle', 'layer-1', CANVAS);
    const rect2 = createShape('rect', 'layer-1', CANVAS);
    const all = [rect1, circle1, rect2];
    expect(shapeLabel(rect1, all)).toBe('Rectangle 1');
    expect(shapeLabel(circle1, all)).toBe('Circle 1');
    expect(shapeLabel(rect2, all)).toBe('Rectangle 2');
  });

  it('never includes the raw UUID', () => {
    const shape = createShape('path', 'layer-1', CANVAS);
    expect(shapeLabel(shape, [shape])).not.toContain(shape.id);
  });
});
