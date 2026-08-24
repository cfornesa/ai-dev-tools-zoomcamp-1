import { describe, expect, it } from 'vitest';

import {
  buildScenePlan,
  SceneRenderError,
  type DrawGroupNode,
  type DrawShapeNode,
} from './sceneDrawPlan';
import {
  baseScene,
  circleShape,
  group,
  layer,
  lineShape,
  particleEmitterShape,
  pathShape,
  rectShape,
  style,
  transform,
} from './testSceneFixtures';

function nodeIds(nodes: ReturnType<typeof buildScenePlan>['nodes']): string[] {
  return nodes.map((n) => (n.kind === 'shape' ? n.shape.id : n.group.id));
}

describe('buildScenePlan', () => {
  // Acceptance criterion 1
  it('reads canvas width/height/backgroundColor', () => {
    const plan = buildScenePlan(
      baseScene({ canvas: { width: 320, height: 240, backgroundColor: '#abcdef' } }),
    );
    expect(plan.canvas).toEqual({ width: 320, height: 240, backgroundColor: '#abcdef' });
  });

  // Acceptance criterion 2
  it('resolves each of the five shape types with their type-specific fields', () => {
    // Task 111 (issue #142): every shape needs its own layerId now.
    const scene = baseScene({
      layers: [
        layer({ id: 'layer-c' }),
        layer({ id: 'layer-r' }),
        layer({ id: 'layer-l' }),
        layer({ id: 'layer-p' }),
        layer({ id: 'layer-e' }),
      ],
      shapes: [
        circleShape({ id: 'c', radius: 12, layerId: 'layer-c' }),
        rectShape({ id: 'r', width: 8, height: 9, cornerRadius: 2, layerId: 'layer-r' }),
        lineShape({ id: 'l', x2: 30, y2: 40, layerId: 'layer-l' }),
        pathShape({
          id: 'p',
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          closed: false,
          layerId: 'layer-p',
        }),
        particleEmitterShape({
          id: 'e',
          size: 6,
          palette: ['#112233'],
          layerId: 'layer-e',
        }),
      ],
    });
    const plan = buildScenePlan(scene);
    const shapes = plan.nodes
      .filter((n): n is DrawShapeNode => n.kind === 'shape')
      .map((n) => n.shape);
    const byId = Object.fromEntries(shapes.map((s) => [s.id, s]));
    expect(byId.c).toMatchObject({ type: 'circle', radius: 12 });
    expect(byId.r).toMatchObject({ type: 'rect', width: 8, height: 9, cornerRadius: 2 });
    expect(byId.l).toMatchObject({ type: 'line', x2: 30, y2: 40 });
    expect(byId.p).toMatchObject({
      type: 'path',
      closed: false,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    });
    expect(byId.e).toMatchObject({ type: 'particleEmitter', size: 6, palette: ['#112233'] });
  });

  // Acceptance criterion 3
  it('carries every transform2D field through for shapes and groups', () => {
    const scene = baseScene({
      shapes: [
        circleShape({
          groupId: 'g',
          transform: transform({ x: 1, y: 2, scaleX: 3, scaleY: 4, rotation: 5, opacity: 0.5 }),
        }),
      ],
      groups: [
        group({
          id: 'g',
          childIds: ['shape-circle'],
          transform: transform({ x: 6, y: 7, scaleX: 8, scaleY: 9, rotation: 10, opacity: 0.25 }),
        }),
      ],
    });
    const plan = buildScenePlan(scene);
    const groupNode = plan.nodes[0] as DrawGroupNode;
    expect(groupNode.group.transform).toEqual({
      x: 6,
      y: 7,
      scaleX: 8,
      scaleY: 9,
      rotation: 10,
      opacity: 0.25,
    });
    const shapeNode = groupNode.children[0] as DrawShapeNode;
    expect(shapeNode.shape.transform).toEqual({
      x: 1,
      y: 2,
      scaleX: 3,
      scaleY: 4,
      rotation: 5,
      opacity: 0.5,
    });
  });

  // Acceptance criterion 4
  it('carries independent null fill/stroke and full-range strokeWidth through', () => {
    const scene = baseScene({
      layers: [layer({ id: 'layer-a' }), layer({ id: 'layer-b' })],
      shapes: [
        circleShape({
          id: 'a',
          layerId: 'layer-a',
          style: style({ fill: null, stroke: '#ffffff', strokeWidth: 0 }),
        }),
        circleShape({
          id: 'b',
          layerId: 'layer-b',
          style: style({ fill: '#ffffff', stroke: null, strokeWidth: 64 }),
        }),
      ],
    });
    const plan = buildScenePlan(scene);
    const [a, b] = plan.nodes
      .filter((n): n is DrawShapeNode => n.kind === 'shape')
      .map((n) => n.shape);
    expect(a.style).toEqual({ fill: null, stroke: '#ffffff', strokeWidth: 0 });
    expect(b.style).toEqual({ fill: '#ffffff', stroke: null, strokeWidth: 64 });
  });

  // Acceptance criterion 5
  it('orders layers ascending by order, then top-level groups before top-level shapes', () => {
    const scene = baseScene({
      layers: [layer({ id: 'l2', order: 1 }), layer({ id: 'l1', order: 0 })],
      shapes: [
        circleShape({ id: 'shape-a', layerId: 'l1' }),
        circleShape({ id: 'shape-b', layerId: 'l2' }),
      ],
      groups: [group({ id: 'group-a', layerId: 'l1', childIds: [] })],
    });
    const plan = buildScenePlan(scene);
    // l1 (order 0) first: its top-level group before its top-level shape;
    // then l2 (order 1)'s shape.
    expect(nodeIds(plan.nodes)).toEqual(['group-a', 'shape-a', 'shape-b']);
  });

  it('orders top-level groups/shapes by their array order, and group children by childIds order', () => {
    const scene = baseScene({
      layers: [
        layer(),
        layer({ id: 'layer-s1' }),
        layer({ id: 'layer-s2' }),
        layer({ id: 'layer-cb' }),
        layer({ id: 'layer-ca' }),
      ],
      shapes: [
        circleShape({ id: 's1', layerId: 'layer-s1' }),
        circleShape({ id: 's2', layerId: 'layer-s2' }),
        circleShape({ id: 'child-b', layerId: 'layer-cb', groupId: 'g' }),
        circleShape({ id: 'child-a', layerId: 'layer-ca', groupId: 'g' }),
      ],
      groups: [group({ id: 'g', childIds: ['child-a', 'child-b'] })],
    });
    const plan = buildScenePlan(scene);
    // groups array is empty at index before 'g'? Here groups=[g] so g draws
    // first among top-level (groups array order), then s1, s2 (shapes
    // array order).
    expect(nodeIds(plan.nodes)).toEqual(['g', 's1', 's2']);
    const groupNode = plan.nodes[0] as DrawGroupNode;
    expect(nodeIds(groupNode.children)).toEqual(['child-a', 'child-b']);
  });

  // Acceptance criterion 6
  it('excludes an invisible layer entirely; a locked layer still renders', () => {
    const scene = baseScene({
      layers: [
        layer({ id: 'hidden', order: 0, visible: false }),
        layer({ id: 'locked', order: 1, locked: true }),
      ],
      shapes: [
        circleShape({ id: 'in-hidden', layerId: 'hidden' }),
        circleShape({ id: 'in-locked', layerId: 'locked' }),
      ],
    });
    const plan = buildScenePlan(scene);
    expect(nodeIds(plan.nodes)).toEqual(['in-locked']);
  });

  // Acceptance criterion 7
  it('nests groups to the max depth (6) and preserves each level for transform composition', () => {
    const depth = 6;
    const groups = [];
    let childId = 'leaf-shape';
    for (let i = depth; i >= 1; i -= 1) {
      const id = `g${i}`;
      groups.push(group({ id, childIds: [childId], transform: transform({ x: i, y: 0 }) }));
      childId = id;
    }
    const scene = baseScene({
      shapes: [circleShape({ id: 'leaf-shape', groupId: 'g6' })],
      groups,
    });
    const plan = buildScenePlan(scene);
    let node = plan.nodes[0] as DrawGroupNode;
    for (let i = 1; i < depth; i += 1) {
      expect(node.group.id).toBe(`g${i}`);
      node = node.children[0] as DrawGroupNode;
    }
    expect(node.group.id).toBe(`g${depth}`);
    const leaf = node.children[0] as DrawShapeNode;
    expect(leaf.shape.id).toBe('leaf-shape');
  });

  // Acceptance criterion 8
  it('carries randomness.seed/enabled through unchanged', () => {
    const enabled = buildScenePlan(baseScene({ randomness: { seed: 42, enabled: true } }));
    expect(enabled.randomness).toEqual({ seed: 42, enabled: true });
    const disabled = buildScenePlan(baseScene({ randomness: { seed: 42, enabled: false } }));
    expect(disabled.randomness).toEqual({ seed: 42, enabled: false });
  });

  // Acceptance criterion 10
  it('throws, naming the shape id and field, for a shape type outside the schema enum', () => {
    const scene = baseScene({ shapes: [circleShape({ id: 'bad-shape', type: 'blob' })] });
    expect(() => buildScenePlan(scene)).toThrow(SceneRenderError);
    try {
      buildScenePlan(scene);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SceneRenderError);
      expect((err as Error).message).toContain('bad-shape');
      expect((err as Error).message).toContain('type');
    }
  });

  it('throws, naming the shape id and field, for a dangling groupId', () => {
    const scene = baseScene({ shapes: [circleShape({ id: 'orphan', groupId: 'nope' })] });
    try {
      buildScenePlan(scene);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SceneRenderError);
      expect((err as Error).message).toContain('orphan');
      expect((err as Error).message).toContain('groupId');
      expect((err as Error).message).toContain('nope');
    }
  });

  it('throws, naming the shape id and field, for a dangling layerId', () => {
    const scene = baseScene({ shapes: [circleShape({ id: 'orphan2', layerId: 'nope-layer' })] });
    try {
      buildScenePlan(scene);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SceneRenderError);
      expect((err as Error).message).toContain('orphan2');
      expect((err as Error).message).toContain('layerId');
    }
  });

  it('throws, naming the group id and field, for a dangling group layerId', () => {
    const scene = baseScene({ groups: [group({ id: 'orphan-group', layerId: 'missing' })] });
    try {
      buildScenePlan(scene);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SceneRenderError);
      expect((err as Error).message).toContain('orphan-group');
      expect((err as Error).message).toContain('layerId');
    }
  });

  it('throws, naming the group id and field, for a dangling childId', () => {
    const scene = baseScene({ groups: [group({ id: 'g', childIds: ['does-not-exist'] })] });
    try {
      buildScenePlan(scene);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SceneRenderError);
      expect((err as Error).message).toContain('g');
      expect((err as Error).message).toContain('childIds');
      expect((err as Error).message).toContain('does-not-exist');
    }
  });

  // Acceptance criterion 11
  it('throws before building anything when the scene fails validateScene (missing required field)', () => {
    const scene = baseScene();
    delete (scene as Record<string, unknown>).canvas;
    expect(() => buildScenePlan(scene)).toThrow(SceneRenderError);
  });

  it('throws when the scene fails validateScene on a scene-wide limit (duplicate ids)', () => {
    const scene = baseScene({
      layers: [layer({ id: 'dup' }), layer({ id: 'dup', order: 1 })],
    });
    expect(() => buildScenePlan(scene)).toThrow(SceneRenderError);
  });

  it('throws for a scene that is not an object at all', () => {
    expect(() => buildScenePlan(null)).toThrow(SceneRenderError);
    expect(() => buildScenePlan('not a scene')).toThrow(SceneRenderError);
    expect(() => buildScenePlan(42)).toThrow(SceneRenderError);
  });

  // Acceptance criterion 12
  it('never executes a color/string field as code — a non-color string in style.fill is rejected, not run', () => {
    const scene = baseScene({
      shapes: [circleShape({ style: style({ fill: 'javascript:alert(1)' as unknown as string }) })],
    });
    // Rejected by the schema's color pattern (via the validateScene
    // backstop) before any draw call — never interpreted as code.
    expect(() => buildScenePlan(scene)).toThrow(SceneRenderError);
  });
});
