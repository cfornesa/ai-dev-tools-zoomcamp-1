import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { buildOutline, isEffectivelyLocked, type Group } from './sceneOutline';
import { createShape } from './sceneShapes';

/**
 * Task 80 (issue #80): tests for `isEffectivelyLocked`'s OR-cascade (own
 * flag, ancestor group flags at multiple nesting depths, and the layer
 * flag) and for `buildOutline()`'s refactor to call it instead of
 * duplicating the cascade — see `sceneOutline.test.ts` for the rest of this
 * module's tests and `useSceneEditor.lock.test.ts`/`EditorWorkspace.lock.test.tsx`
 * for the guard/handle-visibility tests built on top of this.
 */

function layer(id: string, order: number, locked = false) {
  return { id, name: `Layer ${order}`, order, visible: true, locked };
}

function group(overrides: Partial<Group>): Group {
  return {
    id: 'group',
    name: 'Group',
    layerId: 'layer-1',
    childIds: [],
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    ...overrides,
  };
}

function baseScene(overrides: Partial<SceneDocument> = {}): SceneDocument {
  return {
    schemaVersion: 1,
    id: 'scene-1',
    canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
    renderer: { preferred: 'p5' },
    layers: [layer('layer-1', 0)],
    shapes: [],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
    ...overrides,
  };
}

function shapeIn(layerId: string, groupId: string | null = null) {
  const shape = createShape('circle', layerId, { width: 800, height: 600 });
  return { ...shape, groupId };
}

describe('isEffectivelyLocked', () => {
  it('returns false for a top-level, unlocked shape on an unlocked layer', () => {
    const shape = shapeIn('layer-1');
    const scene = baseScene({ shapes: [shape] });
    expect(isEffectivelyLocked(scene, shape.id)).toBe(false);
  });

  it('returns false for an id that does not exist in the scene', () => {
    const scene = baseScene();
    expect(isEffectivelyLocked(scene, 'nope')).toBe(false);
  });

  it("a shape is locked when its layer's own locked flag is true", () => {
    const shape = shapeIn('layer-1');
    const scene = baseScene({ layers: [layer('layer-1', 0, true)], shapes: [shape] });
    expect(isEffectivelyLocked(scene, shape.id)).toBe(true);
  });

  it('a group is locked when its own locked flag is true, independent of its layer', () => {
    const g = group({ id: 'g1', locked: true });
    const scene = baseScene({ groups: [g] });
    expect(isEffectivelyLocked(scene, g.id)).toBe(true);
  });

  it("a group's own locked=false does not override an unlocked ancestor/layer", () => {
    const g = group({ id: 'g1', locked: false });
    const scene = baseScene({ groups: [g] });
    expect(isEffectivelyLocked(scene, g.id)).toBe(false);
  });

  it('a shape inside a locked group is effectively locked even though its own layer is unlocked', () => {
    const shape = shapeIn('layer-1', 'g1');
    const g = group({ id: 'g1', locked: true, childIds: [shape.id] });
    const scene = baseScene({ groups: [g], shapes: [shape] });
    expect(isEffectivelyLocked(scene, shape.id)).toBe(true);
  });

  it('cascades through an unlocked immediate parent group up to a locked grandparent group (2 levels of nesting)', () => {
    const shape = shapeIn('layer-1', 'inner');
    const inner = group({ id: 'inner', locked: false, childIds: [shape.id] });
    const outer = group({ id: 'outer', locked: true, childIds: ['inner'] });
    const scene = baseScene({ groups: [inner, outer], shapes: [shape] });
    expect(isEffectivelyLocked(scene, shape.id)).toBe(true);
    // The intermediate group itself is also effectively locked via its
    // locked ancestor, even though its own flag is false.
    expect(isEffectivelyLocked(scene, 'inner')).toBe(true);
  });

  it('cascades through three levels of unlocked nesting up to a locked great-grandparent', () => {
    const shape = shapeIn('layer-1', 'g3');
    const g3 = group({ id: 'g3', locked: false, childIds: [shape.id] });
    const g2 = group({ id: 'g2', locked: false, childIds: ['g3'] });
    const g1 = group({ id: 'g1', locked: true, childIds: ['g2'] });
    const scene = baseScene({ groups: [g1, g2, g3], shapes: [shape] });
    expect(isEffectivelyLocked(scene, shape.id)).toBe(true);
  });

  it('a shape nested several levels deep is effectively locked purely via the layer flag, with every ancestor group unlocked', () => {
    const shape = shapeIn('layer-1', 'g2');
    const g2 = group({ id: 'g2', locked: false, childIds: [shape.id] });
    const g1 = group({ id: 'g1', locked: false, childIds: ['g2'] });
    const scene = baseScene({
      layers: [layer('layer-1', 0, true)],
      groups: [g1, g2],
      shapes: [shape],
    });
    expect(isEffectivelyLocked(scene, shape.id)).toBe(true);
  });

  it('OR-combines all three sources: false only when own, every ancestor, and the layer are all unlocked', () => {
    const shape = shapeIn('layer-1', 'g1');
    const g1 = group({ id: 'g1', locked: false, childIds: [shape.id] });
    const scene = baseScene({
      layers: [layer('layer-1', 0, false)],
      groups: [g1],
      shapes: [shape],
    });
    expect(isEffectivelyLocked(scene, shape.id)).toBe(false);

    // Flip just the group: now locked.
    const scene2 = baseScene({
      layers: [layer('layer-1', 0, false)],
      groups: [{ ...g1, locked: true }],
      shapes: [shape],
    });
    expect(isEffectivelyLocked(scene2, shape.id)).toBe(true);
  });

  it('a sibling shape on the same layer/group as a locked one stays unaffected', () => {
    const shapeA = shapeIn('layer-1');
    const shapeB = shapeIn('layer-1');
    // Only shapeA sits in a locked group; shapeB is a top-level sibling.
    const g1 = group({ id: 'g1', locked: true, childIds: [shapeA.id] });
    const scene = baseScene({
      groups: [g1],
      shapes: [{ ...shapeA, groupId: 'g1' }, shapeB],
    });
    expect(isEffectivelyLocked(scene, shapeA.id)).toBe(true);
    expect(isEffectivelyLocked(scene, shapeB.id)).toBe(false);
  });
});

describe('buildOutline uses isEffectivelyLocked for inheritedLocked (no duplicated cascade)', () => {
  it("a shape row's inheritedLocked matches isEffectivelyLocked for the same id", () => {
    const shape = shapeIn('layer-1', 'g2');
    const g2 = group({ id: 'g2', locked: false, childIds: [shape.id] });
    const g1 = group({ id: 'g1', locked: true, childIds: ['g2'] });
    const scene = baseScene({ groups: [g1, g2], shapes: [shape] });

    const outline = buildOutline(scene);
    const shapeRow = outline.find((r) => r.kind === 'shape' && r.id === shape.id);
    expect(shapeRow?.kind).toBe('shape');
    if (shapeRow?.kind !== 'shape') return;
    expect(shapeRow.inheritedLocked).toBe(true);
    expect(shapeRow.inheritedLocked).toBe(isEffectivelyLocked(scene, shape.id));
  });

  it("an unlocked top-level shape's row shows inheritedLocked: false", () => {
    const shape = shapeIn('layer-1');
    const scene = baseScene({ shapes: [shape] });
    const outline = buildOutline(scene);
    const shapeRow = outline.find((r) => r.kind === 'shape' && r.id === shape.id);
    expect(shapeRow?.kind === 'shape' && shapeRow.inheritedLocked).toBe(false);
  });

  it("a group row's own locked field still reflects its own flag, not the inherited cascade", () => {
    const inner = group({ id: 'inner', locked: false, childIds: [] });
    const outer = group({ id: 'outer', locked: true, childIds: ['inner'] });
    outer.childIds = ['inner'];
    const scene = baseScene({ groups: [outer, inner] });
    const outline = buildOutline(scene);
    const innerRow = outline.find((r) => r.id === 'inner');
    // The group row's own `locked` is its own flag (false), even though
    // it's effectively locked via its ancestor.
    expect(innerRow?.kind === 'group' && innerRow.locked).toBe(false);
    expect(isEffectivelyLocked(scene, 'inner')).toBe(true);
  });
});
