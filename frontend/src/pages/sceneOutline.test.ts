import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import {
  addLayer,
  buildOutline,
  deleteGroupRecursive,
  deleteLayer,
  getGroups,
  getLayers,
  groupItems,
  isEffectivelyLocked,
  moveItem,
  moveItemToGroup,
  moveItemToLayer,
  moveLayer,
  outlineBreadcrumb,
  pruneEmptyGroups,
  removeShapeFromScene,
  renameLayer,
  toggleGroupFlag,
  toggleLayerFlag,
  toggleShapeFlag,
  ungroupItem,
  type Group,
} from './sceneOutline';
import { createShape } from './sceneShapes';
import { LIMITS } from '../validation/scene';

function layer(id: string, order: number, overrides: Partial<Record<string, unknown>> = {}) {
  return { id, name: `Layer ${order}`, order, visible: true, locked: false, ...overrides };
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

// Task 111 (issue #142): every shape needs its own layerId now, so a test
// scene with N shapes needs N corresponding layers -- this generates a
// fresh unique layerId per call plus a matching layer definition, so a
// test that needs many independently-layered shapes doesn't need to
// hand-write each one.
let uniqueLayerCounter = 0;
function uniqueLayerId(): string {
  uniqueLayerCounter += 1;
  return `auto-layer-${uniqueLayerCounter}`;
}
function shapeOnFreshLayer(groupId: string | null = null) {
  const layerId = uniqueLayerId();
  return { shape: shapeIn(layerId, groupId), layerDef: layer(layerId, uniqueLayerCounter) };
}

describe('sceneOutline layers', () => {
  it('adds a layer with the next order and defaults', () => {
    const scene = baseScene();
    const outcome = addLayer(scene);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const layers = getLayers(outcome.scene);
    expect(layers).toHaveLength(2);
    expect(layers[1]).toMatchObject({ order: 1, visible: true, locked: false });
  });

  it('rejects adding a layer beyond maxLayers', () => {
    const many = Array.from({ length: LIMITS.maxLayers }, (_, i) => layer(`layer-${i}`, i));
    const scene = baseScene({ layers: many });
    const outcome = addLayer(scene);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toMatch(/maxLayers/);
  });

  it('renames a layer, trimming whitespace', () => {
    const scene = baseScene();
    const outcome = renameLayer(scene, 'layer-1', '  Background  ');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(getLayers(outcome.scene)[0].name).toBe('Background');
  });

  it('rejects renaming to an empty name', () => {
    const scene = baseScene();
    const outcome = renameLayer(scene, 'layer-1', '   ');
    expect(outcome.ok).toBe(false);
  });

  it('rejects renaming a layer that no longer exists', () => {
    const scene = baseScene();
    const outcome = renameLayer(scene, 'does-not-exist', 'New name');
    expect(outcome.ok).toBe(false);
  });

  it('refuses to delete the last remaining layer', () => {
    const scene = baseScene();
    const outcome = deleteLayer(scene, 'layer-1');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toMatch(/at least one layer/);
  });

  it('refuses to delete a layer that still has shapes', () => {
    const scene = baseScene({
      layers: [layer('layer-1', 0), layer('layer-2', 1)],
      shapes: [shapeIn('layer-1')],
    });
    const outcome = deleteLayer(scene, 'layer-1');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toMatch(/shapes or groups/);
  });

  it('refuses to delete a layer that still has groups', () => {
    const scene = baseScene({
      layers: [layer('layer-1', 0), layer('layer-2', 1)],
      groups: [group({ id: 'g1', layerId: 'layer-1', childIds: ['s1'] })],
    });
    const outcome = deleteLayer(scene, 'layer-1');
    expect(outcome.ok).toBe(false);
  });

  it('deletes an empty, non-last layer and renumbers order', () => {
    const scene = baseScene({ layers: [layer('layer-1', 0), layer('layer-2', 1)] });
    const outcome = deleteLayer(scene, 'layer-1');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const layers = getLayers(outcome.scene);
    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatchObject({ id: 'layer-2', order: 0 });
  });

  it('moves a layer up and down, renumbering order', () => {
    const scene = baseScene({ layers: [layer('layer-1', 0), layer('layer-2', 1)] });
    const outcome = moveLayer(scene, 'layer-2', 'up');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const layers = getLayers(outcome.scene).sort((a, b) => a.order - b.order);
    expect(layers.map((l) => l.id)).toEqual(['layer-2', 'layer-1']);
  });

  it('moving the top layer up is a no-op that does not create a new scene reference', () => {
    const scene = baseScene({ layers: [layer('layer-1', 0), layer('layer-2', 1)] });
    const outcome = moveLayer(scene, 'layer-1', 'up');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.scene).toBe(scene);
  });

  it('toggles layer visible and locked independently', () => {
    const scene = baseScene();
    const visOutcome = toggleLayerFlag(scene, 'layer-1', 'visible');
    expect(visOutcome.ok).toBe(true);
    if (!visOutcome.ok) return;
    expect(getLayers(visOutcome.scene)[0].visible).toBe(false);

    const lockOutcome = toggleLayerFlag(visOutcome.scene, 'layer-1', 'locked');
    expect(lockOutcome.ok).toBe(true);
    if (!lockOutcome.ok) return;
    expect(getLayers(lockOutcome.scene)[0]).toMatchObject({ visible: false, locked: true });
  });
});

describe('sceneOutline per-shape visible/locked (Task 111, issue #142)', () => {
  it('toggleShapeFlag flips a shape from its implicit default and back', () => {
    const s1 = shapeIn('layer-1');
    const scene = baseScene({ shapes: [s1] });
    expect((getEditableShape(scene, s1.id) as { locked?: boolean }).locked).toBeUndefined();

    const locked = toggleShapeFlag(scene, s1.id, 'locked');
    expect(locked.ok).toBe(true);
    if (!locked.ok) return;
    expect((getEditableShape(locked.scene, s1.id) as { locked?: boolean }).locked).toBe(true);

    const unlocked = toggleShapeFlag(locked.scene, s1.id, 'locked');
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;
    expect((getEditableShape(unlocked.scene, s1.id) as { locked?: boolean }).locked).toBe(false);
  });

  it('toggleShapeFlag toggles visible independently of locked', () => {
    const s1 = shapeIn('layer-1');
    const scene = baseScene({ shapes: [s1] });
    const outcome = toggleShapeFlag(scene, s1.id, 'visible');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const shape = getEditableShape(outcome.scene, s1.id) as { visible?: boolean; locked?: boolean };
    expect(shape.visible).toBe(false);
    expect(shape.locked).toBeUndefined();
  });

  it('rejects toggling a shape that no longer exists', () => {
    const scene = baseScene();
    const outcome = toggleShapeFlag(scene, 'missing', 'locked');
    expect(outcome.ok).toBe(false);
  });

  it("a shape's own locked flag is folded into isEffectivelyLocked alongside ancestor group/layer state", () => {
    const s1 = shapeIn('layer-1');
    const scene = baseScene({ shapes: [s1] });
    expect(isEffectivelyLocked(scene, s1.id)).toBe(false);

    const outcome = toggleShapeFlag(scene, s1.id, 'locked');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(isEffectivelyLocked(outcome.scene, s1.id)).toBe(true);
  });

  it('a shape stays effectively locked via an ancestor group even after its own locked flag is off', () => {
    const s1 = shapeIn('layer-1', 'g1');
    const g1 = group({ id: 'g1', layerId: 'layer-1', childIds: [s1.id], locked: true });
    const scene = baseScene({ shapes: [s1], groups: [g1] });
    expect(isEffectivelyLocked(scene, s1.id)).toBe(true);

    // The shape's own flag stays explicitly false, but the ancestor
    // group's lock still makes it effectively locked.
    const outcome = toggleShapeFlag(scene, s1.id, 'locked');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const toggledBack = toggleShapeFlag(outcome.scene, s1.id, 'locked');
    expect(toggledBack.ok).toBe(true);
    if (!toggledBack.ok) return;
    expect(isEffectivelyLocked(toggledBack.scene, s1.id)).toBe(true);
  });

  it('buildOutline folds a shape\'s own visible flag into inheritedVisible, keeping "visible"/"locked" as its own untouched flags', () => {
    const s1 = shapeIn('layer-1');
    const scene = baseScene({ shapes: [s1] });
    const outcome = toggleShapeFlag(scene, s1.id, 'visible');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const row = buildOutline(outcome.scene).find((r) => r.kind === 'shape')!;
    expect(row.kind).toBe('shape');
    if (row.kind !== 'shape') return;
    expect(row.visible).toBe(false);
    expect(row.inheritedVisible).toBe(false);
    expect(row.locked).toBe(false);
  });

  it("grouping shapes that span layers with different visible/locked ancestor state keeps each shape's own effective lock unambiguous", () => {
    // Task 111 (issue #142): s1's layer is locked, s2's is not -- grouping
    // them (now allowed across layers) must not blur which one is
    // actually locked: each shape's own layerId, and therefore its own
    // effective lock, stays exactly as it was before grouping.
    const s1 = shapeIn('layer-1');
    const s2 = shapeIn('layer-2');
    const scene = baseScene({
      layers: [layer('layer-1', 0, { locked: true }), layer('layer-2', 1)],
      shapes: [s1, s2],
    });
    expect(isEffectivelyLocked(scene, s1.id)).toBe(true);
    expect(isEffectivelyLocked(scene, s2.id)).toBe(false);

    const outcome = groupItems(scene, [s1.id, s2.id]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(isEffectivelyLocked(outcome.scene, s1.id)).toBe(true);
    expect(isEffectivelyLocked(outcome.scene, s2.id)).toBe(false);
  });
});

function getEditableShape(scene: SceneDocument, id: string): unknown {
  return (scene.shapes as Array<{ id: string }>).find((s) => s.id === id);
}

describe('sceneOutline grouping', () => {
  it('combines two top-level shapes into a new group with an identity transform', () => {
    const s1 = shapeIn('layer-1');
    const s2 = shapeIn('layer-2');
    const scene = baseScene({
      layers: [layer('layer-1', 0), layer('layer-2', 1)],
      shapes: [s1, s2],
    });

    const outcome = groupItems(scene, [s1.id, s2.id]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const groups = getGroups(outcome.scene);
    expect(groups).toHaveLength(1);
    expect(groups[0].transform).toEqual({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
    });
    expect(groups[0].childIds).toEqual([s1.id, s2.id]);
    expect(outcome.selectId).toBe(groups[0].id);

    const shapes = outcome.scene.shapes as Array<{ id: string; groupId: string | null }>;
    expect(shapes.find((s) => s.id === s1.id)?.groupId).toBe(groups[0].id);
    expect(shapes.find((s) => s.id === s2.id)?.groupId).toBe(groups[0].id);
  });

  it('never changes a grouped shape transform', () => {
    const s1 = shapeIn('layer-1');
    s1.transform = { x: 123, y: 45, scaleX: 2, scaleY: 3, rotation: 90, opacity: 0.5 };
    const s2 = shapeIn('layer-2');
    const scene = baseScene({
      layers: [layer('layer-1', 0), layer('layer-2', 1)],
      shapes: [s1, s2],
    });

    const outcome = groupItems(scene, [s1.id, s2.id]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const shapes = outcome.scene.shapes as Array<{ id: string; transform: unknown }>;
    expect(shapes.find((s) => s.id === s1.id)?.transform).toEqual(s1.transform);
  });

  it('rejects grouping fewer than two items', () => {
    const s1 = shapeIn('layer-1');
    const scene = baseScene({ shapes: [s1] });
    const outcome = groupItems(scene, [s1.id]);
    expect(outcome.ok).toBe(false);
  });

  it('groups items spanning more than one layer (Task 111/#142: every shape is its own layer, so this must succeed, not be rejected)', () => {
    const s1 = shapeIn('layer-1');
    const s2 = shapeIn('layer-2');
    const scene = baseScene({
      layers: [layer('layer-1', 0), layer('layer-2', 1)],
      shapes: [s1, s2],
    });
    const outcome = groupItems(scene, [s1.id, s2.id]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // Each shape's own layerId stays exactly as it was -- only groupId changes.
    const shapes = outcome.scene.shapes as Array<{ id: string; layerId: string }>;
    expect(shapes.find((s) => s.id === s1.id)?.layerId).toBe('layer-1');
    expect(shapes.find((s) => s.id === s2.id)?.layerId).toBe('layer-2');
    // The new group adopts the first selected item's layerId.
    const groups = getGroups(outcome.scene);
    expect(groups[0].layerId).toBe('layer-1');
  });

  it('rejects grouping a group with one of its own descendant groups', () => {
    const s1 = shapeIn('layer-1');
    const inner = group({ id: 'inner', layerId: 'layer-1', childIds: [s1.id] });
    const outer = group({ id: 'outer', layerId: 'layer-1', childIds: ['inner'] });
    const scene = baseScene({ shapes: [s1], groups: [inner, outer] });

    const outcome = groupItems(scene, ['outer', 'inner']);
    expect(outcome.ok).toBe(false);
  });

  it('rejects grouping beyond maxGroups', () => {
    // Each filler group owns a real shape so none of them are empty — the
    // fix that prunes empty groups after grouping must not sweep these
    // away and mask the maxGroups rejection.
    const fillerPairs = Array.from({ length: 50 }, (_, i) => {
      const { shape, layerDef } = shapeOnFreshLayer(`g${i}`);
      return { shape: { ...shape, id: `filler-${i}` }, layerDef };
    });
    const fillerShapes = fillerPairs.map((p) => p.shape);
    const many = fillerShapes.map((s, i) =>
      group({ id: `g${i}`, layerId: s.layerId, childIds: [s.id] }),
    );
    const { shape: s1, layerDef: s1Layer } = shapeOnFreshLayer();
    const { shape: s2, layerDef: s2Layer } = shapeOnFreshLayer();
    const scene = baseScene({
      layers: [layer('layer-1', 0), ...fillerPairs.map((p) => p.layerDef), s1Layer, s2Layer],
      shapes: [...fillerShapes, s1, s2],
      groups: many,
    });
    const outcome = groupItems(scene, [s1.id, s2.id]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toMatch(/maxGroups/);
  });

  it('rejects grouping beyond maxGroupChildIds', () => {
    const pairs = Array.from({ length: 101 }, () => shapeOnFreshLayer());
    const many = pairs.map((p) => p.shape);
    const scene = baseScene({
      layers: [layer('layer-1', 0), ...pairs.map((p) => p.layerDef)],
      shapes: many,
    });
    const outcome = groupItems(
      scene,
      many.map((s) => s.id),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toMatch(/maxGroupChildIds/);
  });

  it('rejects grouping beyond maxGroupNestingDepth', () => {
    // A 6-deep chain of groups (g6 top-level down to leaf g1, which holds
    // two shapes) is exactly at the limit. Grouping the two shapes in g1
    // adds one more level of nesting, pushing every ancestor one level
    // deeper and exceeding the limit.
    const { shape: s1, layerDef: s1Layer } = shapeOnFreshLayer('g1');
    const { shape: s2, layerDef: s2Layer } = shapeOnFreshLayer('g1');
    const g1 = group({ id: 'g1', layerId: 'layer-1', childIds: [s1.id, s2.id] });
    const g2 = group({ id: 'g2', layerId: 'layer-1', childIds: ['g1'] });
    const g3 = group({ id: 'g3', layerId: 'layer-1', childIds: ['g2'] });
    const g4 = group({ id: 'g4', layerId: 'layer-1', childIds: ['g3'] });
    const g5 = group({ id: 'g5', layerId: 'layer-1', childIds: ['g4'] });
    const g6 = group({ id: 'g6', layerId: 'layer-1', childIds: ['g5'] });
    const scene = baseScene({
      layers: [layer('layer-1', 0), s1Layer, s2Layer],
      shapes: [s1, s2],
      groups: [g1, g2, g3, g4, g5, g6],
    });

    const outcome = groupItems(scene, [s1.id, s2.id]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toMatch(/maxGroupNestingDepth/);
  });

  it('combines a top-level shape with a shape nested in an existing group (AC5)', () => {
    const s1 = shapeIn('layer-1');
    const s2 = shapeIn('layer-2', 'parent');
    const parent = group({ id: 'parent', layerId: 'layer-1', childIds: [s2.id] });
    const scene = baseScene({
      layers: [layer('layer-1', 0), layer('layer-2', 1)],
      shapes: [s1, s2],
      groups: [parent],
    });

    const outcome = groupItems(scene, [s1.id, s2.id]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const groups = getGroups(outcome.scene);
    const newGroup = groups.find((g) => g.id !== 'parent')!;
    expect(newGroup).toBeDefined();
    expect(newGroup.childIds.slice().sort()).toEqual([s1.id, s2.id].slice().sort());
    expect(newGroup.transform).toEqual({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
    });

    // s2's previous parent group had no other children, so detaching s2
    // left it empty — it must be auto-removed entirely, not merely have
    // its childIds emptied (the QA regression on the prior fix).
    expect(groups.find((g) => g.id === 'parent')).toBeUndefined();
    expect(groups).toHaveLength(1);

    const shapes = outcome.scene.shapes as Array<{ id: string; groupId: string | null }>;
    expect(shapes.find((s) => s.id === s1.id)?.groupId).toBe(newGroup.id);
    expect(shapes.find((s) => s.id === s2.id)?.groupId).toBe(newGroup.id);
  });

  it('does not prune a source group that still has other children after grouping one of them', () => {
    const s1 = shapeIn('layer-1');
    const s2 = shapeIn('layer-2', 'parent');
    const s3 = shapeIn('layer-3', 'parent');
    const parent = group({ id: 'parent', layerId: 'layer-1', childIds: [s2.id, s3.id] });
    const scene = baseScene({
      layers: [layer('layer-1', 0), layer('layer-2', 1), layer('layer-3', 2)],
      shapes: [s1, s2, s3],
      groups: [parent],
    });

    const outcome = groupItems(scene, [s1.id, s2.id]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const groups = getGroups(outcome.scene);
    // s3 still lives in 'parent', so it must survive with just s3 left.
    const parentAfter = groups.find((g) => g.id === 'parent');
    expect(parentAfter).toBeDefined();
    expect(parentAfter!.childIds).toEqual([s3.id]);
  });

  it('combines siblings already nested in the same parent group', () => {
    const s1 = shapeIn('layer-1', 'parent');
    const s2 = shapeIn('layer-2', 'parent');
    const s3 = shapeIn('layer-3', 'parent');
    const parent = group({ id: 'parent', layerId: 'layer-1', childIds: [s1.id, s2.id, s3.id] });
    const scene = baseScene({
      layers: [layer('layer-1', 0), layer('layer-2', 1), layer('layer-3', 2)],
      shapes: [s1, s2, s3],
      groups: [parent],
    });

    const outcome = groupItems(scene, [s1.id, s2.id]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const groups = getGroups(outcome.scene);
    const parentAfter = groups.find((g) => g.id === 'parent')!;
    const newGroup = groups.find((g) => g.id !== 'parent')!;
    // s3 stays a direct child of parent; the new group takes the place of s1/s2.
    expect(parentAfter.childIds).toEqual([newGroup.id, s3.id]);
    expect(newGroup.childIds).toEqual([s1.id, s2.id]);
  });

  it('ungroups a top-level group, moving its children to the layer top level', () => {
    const s1 = shapeIn('layer-1', 'g1');
    const s2 = shapeIn('layer-1', 'g1');
    const g1 = group({ id: 'g1', layerId: 'layer-1', childIds: [s1.id, s2.id] });
    const scene = baseScene({ shapes: [s1, s2], groups: [g1] });

    const outcome = ungroupItem(scene, 'g1');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(getGroups(outcome.scene)).toHaveLength(0);
    const shapes = outcome.scene.shapes as Array<{ id: string; groupId: string | null }>;
    expect(shapes.find((s) => s.id === s1.id)?.groupId).toBeNull();
    expect(shapes.find((s) => s.id === s2.id)?.groupId).toBeNull();
  });

  it('ungroups a nested group into its parent, preserving order and ids', () => {
    const s1 = shapeIn('layer-1', 'inner');
    const s2 = shapeIn('layer-1', 'inner');
    const s3 = shapeIn('layer-1', 'outer');
    const inner = group({ id: 'inner', layerId: 'layer-1', childIds: [s1.id, s2.id] });
    const outer = group({ id: 'outer', layerId: 'layer-1', childIds: [s3.id, 'inner'] });
    const scene = baseScene({ shapes: [s1, s2, s3], groups: [inner, outer] });

    const outcome = ungroupItem(scene, 'inner');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const groups = getGroups(outcome.scene);
    expect(groups).toHaveLength(1);
    expect(groups[0].childIds).toEqual([s3.id, s1.id, s2.id]);
    const shapes = outcome.scene.shapes as Array<{ id: string; groupId: string | null }>;
    expect(shapes.find((s) => s.id === s1.id)?.groupId).toBe('outer');
    expect(shapes.find((s) => s.id === s2.id)?.groupId).toBe('outer');
  });

  it('rejects ungrouping a group that no longer exists', () => {
    const scene = baseScene();
    const outcome = ungroupItem(scene, 'nope');
    expect(outcome.ok).toBe(false);
  });

  it('deletes a group and all descendant shapes/groups recursively', () => {
    const s1 = shapeIn('layer-1', 'inner');
    const s2 = shapeIn('layer-1', 'outer');
    const inner = group({ id: 'inner', layerId: 'layer-1', childIds: [s1.id] });
    const outer = group({ id: 'outer', layerId: 'layer-1', childIds: [s2.id, 'inner'] });
    const scene = baseScene({ shapes: [s1, s2], groups: [inner, outer] });

    const outcome = deleteGroupRecursive(scene, 'outer');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.scene.shapes).toEqual([]);
    expect(getGroups(outcome.scene)).toHaveLength(0);
  });

  it('deleting a group prunes its now-empty parent automatically', () => {
    const s1 = shapeIn('layer-1', 'inner');
    const inner = group({ id: 'inner', layerId: 'layer-1', childIds: [s1.id] });
    const outer = group({ id: 'outer', layerId: 'layer-1', childIds: ['inner'] });
    const scene = baseScene({ shapes: [s1], groups: [inner, outer] });

    const outcome = deleteGroupRecursive(scene, 'inner');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // outer had only "inner" as a child; once inner is gone, outer is empty
    // and should be auto-pruned too.
    expect(getGroups(outcome.scene)).toHaveLength(0);
  });

  it('toggles group visible and locked', () => {
    const g1 = group({ id: 'g1' });
    const scene = baseScene({ groups: [g1] });
    const outcome = toggleGroupFlag(scene, 'g1', 'visible');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(getGroups(outcome.scene)[0].visible).toBe(false);
  });
});

describe('sceneOutline pruning and shape removal', () => {
  it('prunes an empty group', () => {
    const g1 = group({ id: 'g1', childIds: [] });
    const scene = baseScene({ groups: [g1] });
    const pruned = pruneEmptyGroups(scene);
    expect(getGroups(pruned)).toHaveLength(0);
  });

  it('is a no-op (same reference) when nothing is empty', () => {
    const s1 = shapeIn('layer-1', 'g1');
    const g1 = group({ id: 'g1', childIds: [s1.id] });
    const scene = baseScene({ shapes: [s1], groups: [g1] });
    expect(pruneEmptyGroups(scene)).toBe(scene);
  });

  it('removeShapeFromScene drops the shape and its dangling group reference, pruning if the group is now empty', () => {
    const s1 = shapeIn('layer-1', 'g1');
    const g1 = group({ id: 'g1', childIds: [s1.id] });
    const scene = baseScene({ shapes: [s1], groups: [g1] });

    const next = removeShapeFromScene(scene, s1.id);
    expect(next.shapes).toEqual([]);
    expect(getGroups(next)).toHaveLength(0);
  });
});

describe('sceneOutline reordering', () => {
  it("reorders a top-level shape by reordering its own layer (Task 111/#142: each shape is alone on its layer, so 'move up/down' now delegates to moveLayer)", () => {
    const s1 = shapeIn('layer-1');
    const s2 = shapeIn('layer-2');
    const scene = baseScene({
      layers: [layer('layer-1', 0), layer('layer-2', 1)],
      shapes: [s1, s2],
    });
    const outcome = moveItem(scene, s2.id, 'up');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const layers = getLayers(outcome.scene).sort((a, b) => a.order - b.order);
    expect(layers.map((l) => l.id)).toEqual(['layer-2', 'layer-1']);
    // The shapes array itself, and each shape's own layerId, are untouched.
    const shapes = outcome.scene.shapes as Array<{ id: string; layerId: string }>;
    expect(shapes.map((s) => ({ id: s.id, layerId: s.layerId }))).toEqual([
      { id: s1.id, layerId: 'layer-1' },
      { id: s2.id, layerId: 'layer-2' },
    ]);
  });

  it('is a no-op at the top of the list', () => {
    const s1 = shapeIn('layer-1');
    const s2 = shapeIn('layer-2');
    const scene = baseScene({
      layers: [layer('layer-1', 0), layer('layer-2', 1)],
      shapes: [s1, s2],
    });
    const outcome = moveItem(scene, s1.id, 'up');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.scene).toBe(scene);
  });

  it('reorders top-level groups within a layer, independent of shapes', () => {
    const g1 = group({ id: 'g1', layerId: 'layer-1' });
    const g2 = group({ id: 'g2', layerId: 'layer-1' });
    const scene = baseScene({ groups: [g1, g2] });
    const outcome = moveItem(scene, 'g2', 'up');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(getGroups(outcome.scene).map((g) => g.id)).toEqual(['g2', 'g1']);
  });

  it('reorders children within a parent group childIds array', () => {
    const s1 = shapeIn('layer-1', 'g1');
    const s2 = shapeIn('layer-1', 'g1');
    const g1 = group({ id: 'g1', childIds: [s1.id, s2.id] });
    const scene = baseScene({ shapes: [s1, s2], groups: [g1] });
    const outcome = moveItem(scene, s2.id, 'up');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(getGroups(outcome.scene)[0].childIds).toEqual([s2.id, s1.id]);
  });

  it('rejects moving an item that no longer exists', () => {
    const scene = baseScene();
    const outcome = moveItem(scene, 'nope', 'up');
    expect(outcome.ok).toBe(false);
  });
});

describe('buildOutline', () => {
  it('lists layers, groups, and shapes in deterministic draw order with nesting depth', () => {
    const s1 = shapeIn('layer-1', 'g1');
    const s2 = shapeIn('layer-1');
    const g1 = group({ id: 'g1', layerId: 'layer-1', childIds: [s1.id] });
    const scene = baseScene({ shapes: [s1, s2], groups: [g1] });

    const rows = buildOutline(scene);
    expect(rows.map((r) => [r.kind, r.depth])).toEqual([
      ['layer', 0],
      ['group', 1],
      ['shape', 2],
      ['shape', 1],
    ]);
    expect(rows[0].id).toBe('layer-1');
    expect(rows[1].id).toBe('g1');
    expect(rows[2].id).toBe(s1.id);
    expect(rows[3].id).toBe(s2.id);
  });

  it('sorts layers by ascending order regardless of array position', () => {
    const scene = baseScene({ layers: [layer('layer-b', 1), layer('layer-a', 0)] });
    const rows = buildOutline(scene);
    expect(rows.map((r) => r.id)).toEqual(['layer-a', 'layer-b']);
  });

  it('computes inherited visibility/lock for a shape from its layer and group', () => {
    const s1 = shapeIn('layer-1', 'g1');
    const g1 = group({ id: 'g1', layerId: 'layer-1', childIds: [s1.id], visible: false });
    const scene = baseScene({ shapes: [s1], groups: [g1] });

    const rows = buildOutline(scene);
    const shapeRow = rows.find((r) => r.kind === 'shape');
    expect(shapeRow?.kind).toBe('shape');
    if (shapeRow?.kind !== 'shape') return;
    expect(shapeRow.inheritedVisible).toBe(false);
    expect(shapeRow.inheritedLocked).toBe(false);
  });

  it('marks first/last rows per their reorder scope', () => {
    const s1 = shapeIn('layer-1');
    const s2 = shapeIn('layer-1');
    const scene = baseScene({ shapes: [s1, s2] });
    const rows = buildOutline(scene);
    const shapeRows = rows.filter((r) => r.kind === 'shape');
    expect(shapeRows[0].isFirst).toBe(true);
    expect(shapeRows[0].isLast).toBe(false);
    expect(shapeRows[1].isFirst).toBe(false);
    expect(shapeRows[1].isLast).toBe(true);
  });
});

describe('sceneOutline reparenting: moveItemToLayer', () => {
  function twoLayerScene(overrides: Partial<SceneDocument> = {}) {
    return baseScene({ layers: [layer('layer-1', 0), layer('layer-2', 1)], ...overrides });
  }

  it('moves a top-level shape to a different layer, updating layerId only', () => {
    const s1 = shapeIn('layer-1');
    const scene = twoLayerScene({ shapes: [s1] });

    const outcome = moveItemToLayer(scene, s1.id, 'layer-2');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const shapes = outcome.scene.shapes as Array<{
      id: string;
      layerId: string;
      groupId: string | null;
      transform: unknown;
      style: unknown;
    }>;
    const moved = shapes.find((s) => s.id === s1.id)!;
    expect(moved.layerId).toBe('layer-2');
    expect(moved.groupId).toBeNull();
    expect(moved.transform).toEqual(s1.transform);
    expect(moved.style).toEqual(s1.style);
  });

  it('moves a grouped shape to a different layer, detaching it from its former group', () => {
    const s1 = shapeIn('layer-1', 'g1');
    const s2 = shapeIn('layer-1', 'g1');
    const g1 = group({ id: 'g1', layerId: 'layer-1', childIds: [s1.id, s2.id] });
    const scene = twoLayerScene({ shapes: [s1, s2], groups: [g1] });

    const outcome = moveItemToLayer(scene, s1.id, 'layer-2');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const shapes = outcome.scene.shapes as Array<{
      id: string;
      layerId: string;
      groupId: string | null;
    }>;
    expect(shapes.find((s) => s.id === s1.id)).toMatchObject({ layerId: 'layer-2', groupId: null });
    const groups = getGroups(outcome.scene);
    expect(groups.find((g) => g.id === 'g1')?.childIds).toEqual([s2.id]);
  });

  it('cleans up a group left empty after moving its last child to another layer', () => {
    const s1 = shapeIn('layer-1', 'g1');
    const g1 = group({ id: 'g1', layerId: 'layer-1', childIds: [s1.id] });
    const scene = twoLayerScene({ shapes: [s1], groups: [g1] });

    const outcome = moveItemToLayer(scene, s1.id, 'layer-2');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(getGroups(outcome.scene)).toHaveLength(0);
  });

  it("moves a group and every descendant group's layerId to a different layer, leaving descendant shapes' own layerIds untouched", () => {
    // Task 111 (issue #142): s1/s2 start on distinct layers (every shape
    // is its own independent layer) -- moving the group changes only the
    // group hierarchy's own layerId, never a descendant shape's.
    const s1 = shapeIn('layer-1', 'inner');
    const inner = group({ id: 'inner', layerId: 'layer-1', childIds: [s1.id] });
    const s2 = shapeIn('layer-2', 'outer');
    const outer = group({ id: 'outer', layerId: 'layer-1', childIds: ['inner', s2.id] });
    const scene = twoLayerScene({ shapes: [s1, s2], groups: [inner, outer] });

    const outcome = moveItemToLayer(scene, 'outer', 'layer-2');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const groups = getGroups(outcome.scene);
    expect(groups.find((g) => g.id === 'outer')?.layerId).toBe('layer-2');
    expect(groups.find((g) => g.id === 'inner')?.layerId).toBe('layer-2');
    const shapes = outcome.scene.shapes as Array<{ id: string; layerId: string }>;
    expect(shapes.find((s) => s.id === s1.id)?.layerId).toBe('layer-1');
    expect(shapes.find((s) => s.id === s2.id)?.layerId).toBe('layer-2');
    // The moved group's own id and childIds are preserved untouched.
    expect(groups.find((g) => g.id === 'outer')?.childIds).toEqual(['inner', s2.id]);
  });

  it('detaches a nested group from its parent when moved to a different layer', () => {
    const s1 = shapeIn('layer-1', 'inner');
    const inner = group({ id: 'inner', layerId: 'layer-1', childIds: [s1.id] });
    const s2 = shapeIn('layer-2', 'outer');
    const outer = group({ id: 'outer', layerId: 'layer-1', childIds: ['inner', s2.id] });
    const scene = twoLayerScene({ shapes: [s1, s2], groups: [inner, outer] });

    const outcome = moveItemToLayer(scene, 'inner', 'layer-2');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const groups = getGroups(outcome.scene);
    expect(groups.find((g) => g.id === 'outer')?.childIds).toEqual([s2.id]);
    expect(groups.find((g) => g.id === 'inner')?.layerId).toBe('layer-2');
  });

  it('rejects moving to a layer that no longer exists', () => {
    const s1 = shapeIn('layer-1');
    const scene = twoLayerScene({ shapes: [s1] });
    const outcome = moveItemToLayer(scene, s1.id, 'does-not-exist');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toMatch(/layer no longer exists/);
  });

  it('rejects moving an item that no longer exists', () => {
    const scene = twoLayerScene();
    const outcome = moveItemToLayer(scene, 'missing', 'layer-2');
    expect(outcome.ok).toBe(false);
  });

  it('is a no-op that returns the same scene reference when already at the target layer top level', () => {
    const s1 = shapeIn('layer-1');
    const scene = twoLayerScene({ shapes: [s1] });
    const outcome = moveItemToLayer(scene, s1.id, 'layer-1');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.scene).toBe(scene);
  });
});

describe('sceneOutline reparenting: moveItemToGroup', () => {
  it('moves a top-level shape into an existing group', () => {
    const s1 = shapeIn('layer-1');
    const s2 = shapeIn('layer-2');
    const g1 = group({ id: 'g1', layerId: 'layer-1', childIds: [s2.id] });
    const scene = baseScene({
      layers: [layer('layer-1', 0), layer('layer-2', 1)],
      shapes: [s1, s2],
      groups: [g1],
    });

    const outcome = moveItemToGroup(scene, s1.id, 'g1');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const shapes = outcome.scene.shapes as Array<{
      id: string;
      groupId: string | null;
      transform: unknown;
    }>;
    const moved = shapes.find((s) => s.id === s1.id)!;
    expect(moved.groupId).toBe('g1');
    expect(moved.transform).toEqual(s1.transform);
    expect(getGroups(outcome.scene).find((g) => g.id === 'g1')?.childIds).toEqual([s2.id, s1.id]);
  });

  it('moves a shape from one group into a different group on the same layer', () => {
    const s1 = shapeIn('layer-1', 'g1');
    const g1 = group({ id: 'g1', layerId: 'layer-1', childIds: [s1.id] });
    const g2 = group({ id: 'g2', layerId: 'layer-1', childIds: [] });
    const scene = baseScene({ shapes: [s1], groups: [g1, g2] });

    const outcome = moveItemToGroup(scene, s1.id, 'g2');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const groups = getGroups(outcome.scene);
    // g1 is left with no children, so it's pruned automatically.
    expect(groups.find((g) => g.id === 'g1')).toBeUndefined();
    expect(groups.find((g) => g.id === 'g2')?.childIds).toEqual([s1.id]);
  });

  it('promotes a grouped shape out to its layer top level with targetGroupId: null', () => {
    const s1 = shapeIn('layer-1', 'g1');
    const s2 = shapeIn('layer-2', 'g1');
    const g1 = group({ id: 'g1', layerId: 'layer-1', childIds: [s1.id, s2.id] });
    const scene = baseScene({
      layers: [layer('layer-1', 0), layer('layer-2', 1)],
      shapes: [s1, s2],
      groups: [g1],
    });

    const outcome = moveItemToGroup(scene, s1.id, null);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const shapes = outcome.scene.shapes as Array<{ id: string; groupId: string | null }>;
    expect(shapes.find((s) => s.id === s1.id)?.groupId).toBeNull();
    expect(getGroups(outcome.scene).find((g) => g.id === 'g1')?.childIds).toEqual([s2.id]);
  });

  it('cleans up a group left empty after promoting its last child to top level', () => {
    const s1 = shapeIn('layer-1', 'g1');
    const g1 = group({ id: 'g1', layerId: 'layer-1', childIds: [s1.id] });
    const scene = baseScene({ shapes: [s1], groups: [g1] });

    const outcome = moveItemToGroup(scene, s1.id, null);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(getGroups(outcome.scene)).toHaveLength(0);
  });

  it('moves one group into another group on the same layer', () => {
    const s1 = shapeIn('layer-1', 'g1');
    const g1 = group({ id: 'g1', layerId: 'layer-1', childIds: [s1.id] });
    const g2 = group({ id: 'g2', layerId: 'layer-1', childIds: [] });
    const scene = baseScene({ shapes: [s1], groups: [g1, g2] });

    const outcome = moveItemToGroup(scene, 'g1', 'g2');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const groups = getGroups(outcome.scene);
    expect(groups.find((g) => g.id === 'g2')?.childIds).toEqual(['g1']);
    expect(groups.find((g) => g.id === 'g1')?.childIds).toEqual([s1.id]);
  });

  it('is a no-op that returns the same scene reference when already in the target group', () => {
    const s1 = shapeIn('layer-1', 'g1');
    const g1 = group({ id: 'g1', layerId: 'layer-1', childIds: [s1.id] });
    const scene = baseScene({ shapes: [s1], groups: [g1] });
    const outcome = moveItemToGroup(scene, s1.id, 'g1');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.scene).toBe(scene);
  });

  it('is a no-op when a top-level item is promoted to top level again', () => {
    const s1 = shapeIn('layer-1');
    const scene = baseScene({ shapes: [s1] });
    const outcome = moveItemToGroup(scene, s1.id, null);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.scene).toBe(scene);
  });

  it('rejects moving an item that no longer exists', () => {
    const scene = baseScene();
    const outcome = moveItemToGroup(scene, 'missing', null);
    expect(outcome.ok).toBe(false);
  });

  it('rejects moving into a group that no longer exists', () => {
    const s1 = shapeIn('layer-1');
    const scene = baseScene({ shapes: [s1] });
    const outcome = moveItemToGroup(scene, s1.id, 'missing');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toMatch(/group no longer exists/);
  });

  it('rejects moving a group into itself', () => {
    const s1 = shapeIn('layer-1', 'g1');
    const g1 = group({ id: 'g1', layerId: 'layer-1', childIds: [s1.id] });
    const scene = baseScene({ shapes: [s1], groups: [g1] });
    const outcome = moveItemToGroup(scene, 'g1', 'g1');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toMatch(/into itself/);
  });

  it('rejects moving a group into one of its own descendants (cycle prevention)', () => {
    const s1 = shapeIn('layer-1', 'inner');
    const inner = group({ id: 'inner', layerId: 'layer-1', childIds: [s1.id] });
    const outer = group({ id: 'outer', layerId: 'layer-1', childIds: ['inner'] });
    const scene = baseScene({ shapes: [s1], groups: [inner, outer] });

    const outcome = moveItemToGroup(scene, 'outer', 'inner');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toMatch(/descendant/);
  });

  it('moves a shape into a group on a different layer (Task 111/#142: every shape is its own layer, so this must succeed, not be rejected)', () => {
    const s1 = shapeIn('layer-1');
    const g2 = group({ id: 'g2', layerId: 'layer-2', childIds: [] });
    const scene = baseScene({
      layers: [layer('layer-1', 0), layer('layer-2', 1)],
      shapes: [s1],
      groups: [g2],
    });
    const outcome = moveItemToGroup(scene, s1.id, 'g2');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // s1's own layerId is untouched by moving into a group on another layer.
    const shapes = outcome.scene.shapes as Array<{ id: string; layerId: string }>;
    expect(shapes.find((s) => s.id === s1.id)?.layerId).toBe('layer-1');
    expect(getGroups(outcome.scene).find((g) => g.id === 'g2')?.childIds).toEqual([s1.id]);
  });

  it('rejects a move that would exceed maxGroupChildIds, naming the exact limit', () => {
    const existingPairs = Array.from({ length: 100 }, () => shapeOnFreshLayer('g1'));
    const existingShapes = existingPairs.map((p) => p.shape);
    const g1 = group({ id: 'g1', layerId: 'layer-1', childIds: existingShapes.map((s) => s.id) });
    const { shape: extra, layerDef: extraLayer } = shapeOnFreshLayer();
    const scene = baseScene({
      layers: [layer('layer-1', 0), ...existingPairs.map((p) => p.layerDef), extraLayer],
      shapes: [...existingShapes, extra],
      groups: [g1],
    });

    const outcome = moveItemToGroup(scene, extra.id, 'g1');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toMatch(/maxGroupChildIds/);
    expect(outcome.error).toMatch(/101/);
  });

  it('rejects a move that would exceed maxGroupNestingDepth, naming the exact limit', () => {
    // Build a chain of 6 nested groups (g1 -> g2 -> ... -> g6), each
    // wrapping the next, which is already exactly at the limit.
    const chainIds = Array.from({ length: 6 }, (_, i) => `chain-${i}`);
    const { shape: leafShape, layerDef: leafLayer } = shapeOnFreshLayer(
      chainIds[chainIds.length - 1],
    );
    const chainGroups: Group[] = chainIds.map((id, i) =>
      group({
        id,
        layerId: 'layer-1',
        childIds: i === chainIds.length - 1 ? [leafShape.id] : [chainIds[i + 1]],
      }),
    );
    const { shape: extraShape, layerDef: extraLayer } = shapeOnFreshLayer('extra');
    const extraGroup = group({ id: 'extra', layerId: 'layer-1', childIds: [extraShape.id] });
    const scene = baseScene({
      layers: [layer('layer-1', 0), leafLayer, extraLayer],
      shapes: [leafShape, extraShape],
      groups: [...chainGroups, extraGroup],
    });

    // Moving `extra` into the depth-6 leaf group would push the whole
    // chain to depth 7, exceeding maxGroupNestingDepth (6).
    const outcome = moveItemToGroup(scene, 'extra', chainIds[chainIds.length - 1]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toMatch(/maxGroupNestingDepth/);
    expect(outcome.error).toMatch(/7/);
  });
});

describe('outlineBreadcrumb (Task 80 / issue #110)', () => {
  it('returns an empty path for a null id', () => {
    const scene = baseScene();
    expect(outlineBreadcrumb(scene, null)).toEqual([]);
  });

  it('returns an empty path for an id that resolves to nothing', () => {
    const scene = baseScene();
    expect(outlineBreadcrumb(scene, 'nope')).toEqual([]);
  });

  it('is just [layer, shape] for a top-level shape', () => {
    const s1 = shapeIn('layer-1');
    const scene = baseScene({ shapes: [s1] });

    const path = outlineBreadcrumb(scene, s1.id);
    expect(path.map((seg) => seg.kind)).toEqual(['layer', 'shape']);
    expect(path[0].label).toBe('Layer 0');
    expect(path[1].label).toBe('Circle 1');
  });

  it('includes every ancestor group, outermost first, for a nested shape', () => {
    const s1 = shapeIn('layer-1', 'inner');
    const inner = group({
      id: 'inner',
      name: 'Inner group',
      layerId: 'layer-1',
      childIds: [s1.id],
    });
    const outer = group({
      id: 'outer',
      name: 'Outer group',
      layerId: 'layer-1',
      childIds: ['inner'],
    });
    const scene = baseScene({ shapes: [s1], groups: [inner, outer] });

    const path = outlineBreadcrumb(scene, s1.id);
    expect(path.map((seg) => seg.label)).toEqual([
      'Layer 0',
      'Outer group',
      'Inner group',
      'Circle 1',
    ]);
  });

  it('ends with the group itself when a group (not a shape) is selected', () => {
    const s1 = shapeIn('layer-1', 'g1');
    const g1 = group({ id: 'g1', name: 'My group', layerId: 'layer-1', childIds: [s1.id] });
    const scene = baseScene({ shapes: [s1], groups: [g1] });

    const path = outlineBreadcrumb(scene, 'g1');
    expect(path.map((seg) => seg.label)).toEqual(['Layer 0', 'My group']);
  });
});
