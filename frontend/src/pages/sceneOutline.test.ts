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
  moveItem,
  moveLayer,
  pruneEmptyGroups,
  removeShapeFromScene,
  renameLayer,
  toggleGroupFlag,
  toggleLayerFlag,
  ungroupItem,
  type Group,
} from './sceneOutline';
import { createShape } from './sceneShapes';

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
    const many = Array.from({ length: 20 }, (_, i) => layer(`layer-${i}`, i));
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

describe('sceneOutline grouping', () => {
  it('combines two top-level shapes into a new group with an identity transform', () => {
    const s1 = shapeIn('layer-1');
    const s2 = shapeIn('layer-1');
    const scene = baseScene({ shapes: [s1, s2] });

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
    const s2 = shapeIn('layer-1');
    const scene = baseScene({ shapes: [s1, s2] });

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

  it('rejects grouping items that span more than one layer', () => {
    const s1 = shapeIn('layer-1');
    const s2 = shapeIn('layer-2');
    const scene = baseScene({
      layers: [layer('layer-1', 0), layer('layer-2', 1)],
      shapes: [s1, s2],
    });
    const outcome = groupItems(scene, [s1.id, s2.id]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toMatch(/same layer/);
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
    const many = Array.from({ length: 50 }, (_, i) =>
      group({ id: `g${i}`, layerId: 'layer-1', childIds: [] }),
    );
    const s1 = shapeIn('layer-1');
    const s2 = shapeIn('layer-1');
    const scene = baseScene({ shapes: [s1, s2], groups: many });
    const outcome = groupItems(scene, [s1.id, s2.id]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toMatch(/maxGroups/);
  });

  it('combines siblings already nested in the same parent group', () => {
    const s1 = shapeIn('layer-1', 'parent');
    const s2 = shapeIn('layer-1', 'parent');
    const s3 = shapeIn('layer-1', 'parent');
    const parent = group({ id: 'parent', layerId: 'layer-1', childIds: [s1.id, s2.id, s3.id] });
    const scene = baseScene({ shapes: [s1, s2, s3], groups: [parent] });

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
  it('reorders top-level shapes within a layer', () => {
    const s1 = shapeIn('layer-1');
    const s2 = shapeIn('layer-1');
    const scene = baseScene({ shapes: [s1, s2] });
    const outcome = moveItem(scene, s2.id, 'up');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const shapes = outcome.scene.shapes as Array<{ id: string }>;
    expect(shapes.map((s) => s.id)).toEqual([s2.id, s1.id]);
  });

  it('is a no-op at the top of the list', () => {
    const s1 = shapeIn('layer-1');
    const s2 = shapeIn('layer-1');
    const scene = baseScene({ shapes: [s1, s2] });
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
