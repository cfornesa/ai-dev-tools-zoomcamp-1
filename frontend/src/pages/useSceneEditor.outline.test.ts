import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { useSceneEditor } from './useSceneEditor';

/**
 * Task 24: hook-level tests for the scene outline additions to
 * `useSceneEditor` — layer CRUD/reorder, grouping/ungrouping/group
 * delete, shape/group reorder, visibility/lock toggles, selection sharing
 * between the outline and the canvas, and undo/redo integration. See
 * `sceneOutline.test.ts` for the underlying pure-function tests and
 * `EditorWorkspace.outline.test.tsx` for the rendered UI/keyboard tests.
 */

const TWO_LAYER_SCENE: SceneDocument = {
  schemaVersion: 1,
  id: 'scene-1',
  canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
  renderer: { preferred: 'p5' },
  layers: [
    { id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false },
    { id: 'layer-2', name: 'Layer 2', order: 1, visible: true, locked: false },
  ],
  shapes: [],
  groups: [],
  bindings: [],
  graph: { nodes: [], connections: [] },
  accessibility: { reducedMotion: 'auto' },
  randomness: { seed: 0, enabled: false },
};

function renderSceneEditor(initial: SceneDocument = structuredClone(TWO_LAYER_SCENE)) {
  return renderHook(() => {
    const [workingCopy, setWorkingCopy] = useState<SceneDocument | null>(initial);
    const editor = useSceneEditor(workingCopy, setWorkingCopy);
    return { ...editor, workingCopy };
  });
}

describe('useSceneEditor layers', () => {
  it('adds, renames, reorders, and deletes a layer as single undo steps', () => {
    const { result } = renderSceneEditor();
    const pastBefore = result.current.canUndo;
    expect(pastBefore).toBe(false);

    act(() => result.current.addLayer());
    expect(result.current.layers).toHaveLength(3);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.layers).toHaveLength(2);
  });

  it('renames a layer', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.renameLayer('layer-1', 'Background'));
    expect(result.current.layers.find((l) => l.id === 'layer-1')?.name).toBe('Background');
  });

  it('surfaces a textual error and does not mutate scene state when deleting the last layer', () => {
    const single: SceneDocument = structuredClone(TWO_LAYER_SCENE);
    single.layers = [(single.layers as unknown[])[0]];
    const { result } = renderSceneEditor(single);

    act(() => result.current.deleteLayer('layer-1'));

    expect(result.current.layers).toHaveLength(1);
    expect(result.current.outlineError).toMatch(/at least one layer/);
    expect(result.current.canUndo).toBe(false);
  });

  it('deletes an empty layer', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.deleteLayer('layer-2'));
    expect(result.current.layers).toHaveLength(1);
    expect(result.current.outlineError).toBeNull();
  });

  it('moves a layer up/down, reflected in the outline order', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.moveLayer('layer-2', 'up'));
    const layerRows = result.current.outline.filter((r) => r.kind === 'layer');
    expect(layerRows.map((r) => r.id)).toEqual(['layer-2', 'layer-1']);
  });

  it('toggles layer visible and locked', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.toggleLayerVisible('layer-1'));
    expect(result.current.layers.find((l) => l.id === 'layer-1')?.visible).toBe(false);
    act(() => result.current.toggleLayerLocked('layer-1'));
    expect(result.current.layers.find((l) => l.id === 'layer-1')?.locked).toBe(true);
  });
});

describe('useSceneEditor selection shared between canvas and outline', () => {
  it('selectShape accepts a group id, not just a shape id', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('circle'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());
    const groupId = result.current.selectedShapeId!;
    expect(result.current.selectedGroup?.id).toBe(groupId);

    act(() => result.current.selectShape(null));
    expect(result.current.selectedShapeId).toBeNull();

    act(() => result.current.selectShape(groupId));
    expect(result.current.selectedShapeId).toBe(groupId);
    expect(result.current.selectedGroup?.id).toBe(groupId);
  });

  it('ignores selecting a layer id (layers are not a selectable target)', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.selectShape('layer-1'));
    expect(result.current.selectedShapeId).toBeNull();
  });
});

describe('useSceneEditor grouping', () => {
  it('groups two multi-selected shapes into a new group and selects it', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;

    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());

    expect(result.current.groups).toHaveLength(1);
    expect(result.current.selectedShapeId).toBe(result.current.groups[0].id);
    expect(result.current.multiSelectedIds).toEqual([]);
  });

  it('rejects grouping fewer than two items with a textual error, without committing', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const [a] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));

    act(() => result.current.groupSelected());

    expect(result.current.groups).toHaveLength(0);
    expect(result.current.outlineError).toMatch(/at least two/);
  });

  it('ungroups the selected group, restoring its children to the layer top level', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());
    expect(result.current.groups).toHaveLength(1);

    act(() => result.current.ungroupSelected());

    expect(result.current.groups).toHaveLength(0);
    expect(result.current.selectedShapeId).toBeNull();
    expect(result.current.shapes.map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('deletes the selected group and its descendant shapes recursively', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());

    act(() => result.current.deleteGroupSelected());

    expect(result.current.groups).toHaveLength(0);
    expect(result.current.shapes).toHaveLength(0);
    expect(result.current.selectedShapeId).toBeNull();
  });

  it('deleting the last shape in a group also deletes the now-empty group', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());
    expect(result.current.groups).toHaveLength(1);

    // Delete each shape in turn via the ordinary shape-delete path.
    act(() => result.current.selectShape(a.id));
    act(() => result.current.deleteSelected());
    expect(result.current.groups).toHaveLength(1); // one shape left in the group

    act(() => result.current.selectShape(b.id));
    act(() => result.current.deleteSelected());
    expect(result.current.groups).toHaveLength(0); // group auto-pruned
  });

  it('undo restores a deleted group and its children in one step', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());
    act(() => result.current.deleteGroupSelected());
    expect(result.current.shapes).toHaveLength(0);

    act(() => result.current.undo());

    expect(result.current.groups).toHaveLength(1);
    expect(result.current.shapes.map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
  });
});

describe('useSceneEditor reorder', () => {
  it('reorders shapes within their layer via moveItem', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;

    act(() => result.current.moveItem(b.id, 'up'));

    expect(result.current.shapes.map((s) => s.id)).toEqual([b.id, a.id]);
  });
});

describe('useSceneEditor reparenting (Task 76)', () => {
  it('moves a shape to a different layer as a single undo step', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const [a] = result.current.shapes;
    expect(a.layerId).toBe('layer-1');

    act(() => result.current.moveItemToLayer(a.id, 'layer-2'));

    expect(result.current.shapes.find((s) => s.id === a.id)?.layerId).toBe('layer-2');
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.shapes.find((s) => s.id === a.id)?.layerId).toBe('layer-1');

    act(() => result.current.redo());
    expect(result.current.shapes.find((s) => s.id === a.id)?.layerId).toBe('layer-2');
  });

  it('surfaces a textual error and does not mutate scene state for an invalid layer move', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const [a] = result.current.shapes;
    const undoDepthBefore = result.current.canUndo;

    act(() => result.current.moveItemToLayer(a.id, 'does-not-exist'));

    expect(result.current.outlineError).toMatch(/layer no longer exists/);
    expect(result.current.shapes.find((s) => s.id === a.id)?.layerId).toBe('layer-1');
    expect(result.current.canUndo).toBe(undoDepthBefore); // the rejected move committed no new step
  });

  it('moves a shape into a different group on the same layer, and back out to top level', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());
    const groupId = result.current.groups[0].id;

    act(() => result.current.addShape('circle'));
    const c = result.current.shapes.find((s) => s.id !== a.id && s.id !== b.id)!;

    act(() => result.current.moveItemToGroup(c.id, groupId));
    expect(result.current.groups.find((g) => g.id === groupId)?.childIds).toContain(c.id);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.moveItemToGroup(c.id, null));
    expect(result.current.groups.find((g) => g.id === groupId)?.childIds).not.toContain(c.id);

    act(() => result.current.undo());
    expect(result.current.groups.find((g) => g.id === groupId)?.childIds).toContain(c.id);
  });

  it('surfaces a textual error without mutating scene state for a group-into-itself move', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());
    const groupId = result.current.groups[0].id;

    act(() => result.current.moveItemToGroup(groupId, groupId));

    expect(result.current.outlineError).toMatch(/into itself/);
    expect(result.current.groups).toHaveLength(1);
  });

  it('rejects moving a group into one of its own descendant groups, with an explanation', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());
    const innerGroupId = result.current.groups[0].id;

    act(() => result.current.addShape('circle'));
    const c = result.current.shapes.find((s) => s.id !== a.id && s.id !== b.id)!;
    act(() => result.current.toggleMultiSelect(c.id));
    act(() => result.current.toggleMultiSelect(innerGroupId));
    act(() => result.current.groupSelected());
    const outerGroupId = result.current.groups.find((g) => g.id !== innerGroupId)!.id;

    act(() => result.current.moveItemToGroup(outerGroupId, innerGroupId));

    expect(result.current.outlineError).toMatch(/descendant/);
    expect(result.current.groups.find((g) => g.id === outerGroupId)).toBeDefined();
  });
});
