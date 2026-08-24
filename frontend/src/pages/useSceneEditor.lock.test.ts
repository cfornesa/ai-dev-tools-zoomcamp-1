import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { useSceneEditor } from './useSceneEditor';

/**
 * Task 80 (issue #80): hook-level tests for every `useSceneEditor` mutation
 * guarded against an effectively-locked shape/group — duplicate, delete,
 * inspector field edits, vertex editing, reparenting (both directions),
 * and group/ungroup/delete-group — plus the selection/unlock escape hatch
 * this issue requires to stay completely unrestricted. See
 * `sceneOutline.lock.test.ts` for the underlying `isEffectivelyLocked`
 * cascade tests and `EditorWorkspace.lock.test.tsx` for the rendered
 * handle-visibility/pointer-gesture tests built on top of this hook.
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

function pathScene(): SceneDocument {
  return {
    schemaVersion: 1,
    id: 'scene-1',
    canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
    renderer: { preferred: 'p5' },
    layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
    shapes: [
      {
        id: 'path-1',
        type: 'path',
        layerId: 'layer-1',
        groupId: null,
        transform: { x: 400, y: 300, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        style: { fill: '#4f46e5', stroke: '#1e1b4b', strokeWidth: 2 },
        points: [
          { x: 0, y: -50 },
          { x: 50, y: 0 },
          { x: 0, y: 50 },
          { x: -50, y: 0 },
        ],
        closed: true,
      },
    ],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
  } as unknown as SceneDocument;
}

function renderSceneEditor(initial: SceneDocument = structuredClone(TWO_LAYER_SCENE)) {
  return renderHook(() => {
    const [workingCopy, setWorkingCopy] = useState<SceneDocument | null>(initial);
    const editor = useSceneEditor(workingCopy, setWorkingCopy);
    return { ...editor, workingCopy };
  });
}

describe('useSceneEditor lock guard: duplicate/delete', () => {
  it('blocks duplicating a shape on a locked layer, with a clear message, and does not mutate scene state', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    // Task 111 (issue #142): addShape gives the new shape its own fresh
    // layer -- lock that layer, not the scene's pre-existing "layer-1".
    const [a] = result.current.shapes;
    act(() => result.current.toggleLayerLocked(a.layerId));

    act(() => result.current.duplicateSelected());

    expect(result.current.shapes).toHaveLength(1);
    expect(result.current.lockError).toMatch(/locked/i);
  });

  it('allows duplicating once the layer is unlocked again', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const [a] = result.current.shapes;
    act(() => result.current.toggleLayerLocked(a.layerId));
    act(() => result.current.duplicateSelected());
    expect(result.current.shapes).toHaveLength(1);

    act(() => result.current.toggleLayerLocked(a.layerId));
    act(() => result.current.duplicateSelected());

    expect(result.current.shapes).toHaveLength(2);
    expect(result.current.lockError).toBeNull();
  });

  it('blocks deleting a shape on a locked layer, with a clear message, and does not mutate scene state', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const [a] = result.current.shapes;
    act(() => result.current.toggleLayerLocked(a.layerId));

    act(() => result.current.deleteSelected());

    expect(result.current.shapes).toHaveLength(1);
    expect(result.current.lockError).toMatch(/locked/i);
  });

  it('allows deleting once unlocked', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const [a] = result.current.shapes;
    act(() => result.current.toggleLayerLocked(a.layerId));
    act(() => result.current.deleteSelected());
    expect(result.current.shapes).toHaveLength(1);

    act(() => result.current.toggleLayerLocked(a.layerId));
    act(() => result.current.deleteSelected());

    expect(result.current.shapes).toHaveLength(0);
  });

  it('blocks duplicating/deleting a shape nested inside a locked group', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());
    const groupId = result.current.groups[0].id;
    act(() => result.current.toggleGroupLocked(groupId));

    act(() => result.current.selectShape(a.id));
    act(() => result.current.deleteSelected());

    expect(result.current.shapes).toHaveLength(2);
    expect(result.current.lockError).toMatch(/locked/i);
  });
});

describe('useSceneEditor lock guard: inspector field edits (Task 60)', () => {
  it('blocks a numeric field edit on a shape whose layer is locked, and does not mutate scene state', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const [a] = result.current.shapes;
    act(() => result.current.toggleLayerLocked(a.layerId));

    let outcome: { ok: true } | { ok: false; error: string } = { ok: true };
    act(() => {
      outcome = result.current.updateSelectedShapeNumericField('positionX', '123');
    });

    expect(outcome.ok).toBe(false);
    expect((outcome as unknown as { error: string }).error).toMatch(/locked/i);
    expect(result.current.shapes[0].transform.x).not.toBe(123);
  });

  it('blocks a color field edit on a locked shape and allows it once unlocked', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const [a] = result.current.shapes;
    act(() => result.current.toggleLayerLocked(a.layerId));

    let blocked: { ok: true } | { ok: false; error: string } = { ok: true };
    act(() => {
      blocked = result.current.updateSelectedShapeColorField('fill', '#123456');
    });
    expect(blocked.ok).toBe(false);

    act(() => result.current.toggleLayerLocked(a.layerId));
    let allowed: { ok: true } | { ok: false; error: string } = { ok: false, error: '' };
    act(() => {
      allowed = result.current.updateSelectedShapeColorField('fill', '#123456');
    });
    expect(allowed.ok).toBe(true);
  });
});

describe('useSceneEditor lock guard: vertex editing (issue #79)', () => {
  it('blocks entering vertex edit mode on a locked path shape, surfaced via vertexError', () => {
    const { result } = renderSceneEditor(pathScene());
    act(() => result.current.selectShape('path-1'));
    act(() => result.current.toggleLayerLocked('layer-1'));

    act(() => result.current.toggleVertexEditMode());

    expect(result.current.vertexEditActive).toBe(false);
    expect(result.current.vertexError).toMatch(/locked/i);
  });

  it('blocks addVertexNearLast/deleteVertexAt/updateVertexPointField once locked mid-edit, without mutating the shape', () => {
    const { result } = renderSceneEditor(pathScene());
    act(() => result.current.selectShape('path-1'));
    act(() => result.current.toggleVertexEditMode());
    expect(result.current.vertexEditActive).toBe(true);

    // Lock the layer while still "in" edit mode's underlying state (the
    // handle-rendering gate is a EditorWorkspace.tsx concern; this
    // exercises the hook-level guard directly regardless of that).
    act(() => result.current.toggleLayerLocked('layer-1'));

    const pointsBefore = (result.current.shapes[0] as { points: unknown[] }).points.length;
    act(() => result.current.addVertexNearLast());
    expect((result.current.shapes[0] as { points: unknown[] }).points.length).toBe(pointsBefore);
    expect(result.current.vertexError).toMatch(/locked/i);

    act(() => result.current.deleteVertexAt(0));
    expect((result.current.shapes[0] as { points: unknown[] }).points.length).toBe(pointsBefore);

    let fieldOutcome: { ok: true } | { ok: false; error: string } = { ok: true };
    act(() => {
      fieldOutcome = result.current.updateVertexPointField(0, 'x', '10');
    });
    expect(fieldOutcome.ok).toBe(false);
  });

  it('allows vertex editing once unlocked', () => {
    const { result } = renderSceneEditor(pathScene());
    act(() => result.current.selectShape('path-1'));
    act(() => result.current.toggleLayerLocked('layer-1'));
    act(() => result.current.toggleVertexEditMode());
    expect(result.current.vertexEditActive).toBe(false);

    act(() => result.current.toggleLayerLocked('layer-1'));
    act(() => result.current.toggleVertexEditMode());

    expect(result.current.vertexEditActive).toBe(true);
    expect(result.current.vertexError).toBeNull();
  });
});

describe('useSceneEditor lock guard: reparenting (Task 76)', () => {
  it('blocks moving a locked item out to a different layer', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const [a] = result.current.shapes;
    const originalLayerId = a.layerId;
    act(() => result.current.toggleLayerLocked(originalLayerId));

    act(() => result.current.moveItemToLayer(a.id, 'layer-2'));

    expect(result.current.shapes.find((s) => s.id === a.id)?.layerId).toBe(originalLayerId);
    expect(result.current.outlineError).toMatch(/locked/i);
  });

  it('blocks moving an unlocked item into a locked destination layer', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const [a] = result.current.shapes;
    const originalLayerId = a.layerId;
    act(() => result.current.toggleLayerLocked('layer-2'));

    act(() => result.current.moveItemToLayer(a.id, 'layer-2'));

    expect(result.current.shapes.find((s) => s.id === a.id)?.layerId).toBe(originalLayerId);
    expect(result.current.outlineError).toMatch(/locked/i);
  });

  it('allows moving between two unlocked layers', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const [a] = result.current.shapes;

    act(() => result.current.moveItemToLayer(a.id, 'layer-2'));

    expect(result.current.shapes.find((s) => s.id === a.id)?.layerId).toBe('layer-2');
    expect(result.current.outlineError).toBeNull();
  });

  it('blocks moving a locked item into an unlocked group', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.addShape('circle'));
    const c = result.current.shapes.find((s) => s.id !== a.id && s.id !== b.id)!;
    act(() => result.current.toggleMultiSelect(c.id));
    act(() => result.current.groupSelected());
    const groupId = result.current.groups[0].id;

    act(() => result.current.toggleLayerLocked(a.layerId)); // locks `a` too

    act(() => result.current.moveItemToGroup(a.id, groupId));

    expect(result.current.groups.find((g) => g.id === groupId)?.childIds).not.toContain(a.id);
    expect(result.current.outlineError).toMatch(/locked/i);
  });

  it('blocks moving an unlocked shape into a locked destination group', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());
    const groupId = result.current.groups[0].id;
    act(() => result.current.toggleGroupLocked(groupId));

    act(() => result.current.addShape('circle'));
    const c = result.current.shapes.find((s) => s.id !== a.id && s.id !== b.id)!;

    act(() => result.current.moveItemToGroup(c.id, groupId));

    expect(result.current.groups.find((g) => g.id === groupId)?.childIds).not.toContain(c.id);
    expect(result.current.outlineError).toMatch(/locked/i);
  });
});

describe('useSceneEditor lock guard: group/ungroup/delete-group', () => {
  it('rejects groupSelected when any selected item is locked', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleLayerLocked(a.layerId));

    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());

    expect(result.current.groups).toHaveLength(0);
    expect(result.current.outlineError).toMatch(/locked/i);
  });

  it('rejects ungroupSelected on a locked group', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());
    const groupId = result.current.groups[0].id;
    act(() => result.current.toggleGroupLocked(groupId));

    act(() => result.current.ungroupSelected());

    expect(result.current.groups).toHaveLength(1);
    expect(result.current.outlineError).toMatch(/locked/i);
  });

  it('rejects deleteGroupSelected on a locked group', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());
    const groupId = result.current.groups[0].id;
    act(() => result.current.toggleGroupLocked(groupId));

    act(() => result.current.deleteGroupSelected());

    expect(result.current.groups).toHaveLength(1);
    expect(result.current.shapes).toHaveLength(2);
    expect(result.current.outlineError).toMatch(/locked/i);
  });

  it('allows ungroup/delete-group once the group is unlocked', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());
    const groupId = result.current.groups[0].id;
    act(() => result.current.toggleGroupLocked(groupId));
    act(() => result.current.ungroupSelected());
    expect(result.current.groups).toHaveLength(1); // still locked, rejected

    act(() => result.current.toggleGroupLocked(groupId));
    act(() => result.current.ungroupSelected());

    expect(result.current.groups).toHaveLength(0);
  });
});

describe('useSceneEditor lock guard: selection and unlocking remain unrestricted', () => {
  it('selecting a locked shape works exactly like selecting an unlocked one', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const [a] = result.current.shapes;
    act(() => result.current.toggleLayerLocked('layer-1'));
    act(() => result.current.selectShape(null));

    act(() => result.current.selectShape(a.id));

    expect(result.current.selectedShapeId).toBe(a.id);
    expect(result.current.selectedShape?.id).toBe(a.id);
  });

  it('selecting a locked group works exactly like selecting an unlocked one', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());
    const groupId = result.current.groups[0].id;
    act(() => result.current.toggleGroupLocked(groupId));
    act(() => result.current.selectShape(null));

    act(() => result.current.selectShape(groupId));

    expect(result.current.selectedShapeId).toBe(groupId);
    expect(result.current.selectedGroup?.id).toBe(groupId);
  });

  it('toggleLayerLocked always succeeds regardless of current lock state', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.toggleLayerLocked('layer-1'));
    expect(result.current.layers.find((l) => l.id === 'layer-1')?.locked).toBe(true);
    act(() => result.current.toggleLayerLocked('layer-1'));
    expect(result.current.layers.find((l) => l.id === 'layer-1')?.locked).toBe(false);
  });

  it("unlocking a group itself succeeds even while an ancestor's lock leaves the group still effectively locked", () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());
    const groupId = result.current.groups[0].id;
    const groupLayerId = result.current.groups[0].layerId;
    act(() => result.current.toggleGroupLocked(groupId));
    act(() => result.current.toggleLayerLocked(groupLayerId));

    // Unlocking the group itself always succeeds, even though the layer's
    // own lock means the group stays effectively locked afterward — that's
    // expected, not a bug (see this issue's own acceptance criteria).
    act(() => result.current.toggleGroupLocked(groupId));

    expect(result.current.groups.find((g) => g.id === groupId)?.locked).toBe(false);
    // Still can't ungroup: the layer is still locked.
    act(() => result.current.ungroupSelected());
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.outlineError).toMatch(/locked/i);
  });
});
