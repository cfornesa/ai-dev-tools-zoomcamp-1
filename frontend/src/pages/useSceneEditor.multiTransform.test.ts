import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { useSceneEditor } from './useSceneEditor';

/**
 * Issue #77: hook-level tests for the multi-shape selection resolution
 * (`multiSelectedShapes`) and the group gesture's scene-writing primitive
 * (`updateMultiSelectedTransform` + the shared `beginTransform`/
 * `commitTransform`/`cancelTransform` one-snapshot-per-gesture mechanism
 * Task 26 already established). Pure geometry (combined bounds, group
 * move/resize/rotate math) is covered in `sceneShapes.transform.test.ts`;
 * the DOM/pointer gesture wiring is covered in
 * `EditorWorkspace.multiTransform.test.tsx`.
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

describe('useSceneEditor.multiSelectedShapes', () => {
  it('is empty when fewer than two ids are multi-selected', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const [a] = result.current.shapes;
    expect(result.current.multiSelectedShapes).toHaveLength(0);
    act(() => result.current.toggleMultiSelect(a.id));
    expect(result.current.multiSelectedShapes).toHaveLength(0);
  });

  it('resolves plain shape ids directly', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    expect(result.current.multiSelectedShapes.map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('expands a group id to its recursive descendant shapes, including nested groups', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [a, b, c] = result.current.shapes;

    // Group a+b into an inner group, then multi-select just that group's
    // id alongside the ungrouped c — the resolved selection should be all
    // three shapes even though only one raw checkbox-equivalent id (the
    // group) and one shape id are in `multiSelectedIds`.
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.groupSelected());
    const innerGroupId = result.current.selectedShapeId!;
    expect(result.current.selectedGroup?.id).toBe(innerGroupId);

    act(() => result.current.toggleMultiSelect(innerGroupId));
    act(() => result.current.toggleMultiSelect(c.id));
    expect(result.current.multiSelectedIds).toEqual([innerGroupId, c.id]);
    expect(result.current.multiSelectedShapes.map((s) => s.id).sort()).toEqual(
      [a.id, b.id, c.id].sort(),
    );
  });

  it('silently skips a stale id that no longer resolves to a shape or group', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('circle'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    act(() => result.current.toggleMultiSelect('not-a-real-id'));
    expect(result.current.multiSelectedIds).toHaveLength(3);
    // The stale third id contributes nothing; the two real shapes still
    // resolve normally rather than the whole gesture being rejected.
    expect(result.current.multiSelectedShapes.map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('is a valid selection across different layers, with no shared-group/-layer requirement', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const [a] = result.current.shapes;
    // Move a fresh shape onto the second layer so the two selected shapes
    // don't share a layer.
    act(() => result.current.addShape('rect'));
    const b = result.current.shapes[1];
    act(() => result.current.moveItemToLayer(b.id, 'layer-2'));

    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));
    expect(result.current.multiSelectedShapes.map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
  });
});

describe('useSceneEditor group transform gesture', () => {
  it('writes every shape passed to updateMultiSelectedTransform and lands as one commitTransform undo step', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('circle'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));

    act(() => result.current.beginTransform());
    act(() =>
      result.current.updateMultiSelectedTransform([
        { ...a, transform: { ...a.transform, x: a.transform.x + 10, y: a.transform.y + 10 } },
        { ...b, transform: { ...b.transform, x: b.transform.x + 10, y: b.transform.y + 10 } },
      ]),
    );
    act(() =>
      result.current.updateMultiSelectedTransform([
        { ...a, transform: { ...a.transform, x: a.transform.x + 20, y: a.transform.y + 20 } },
        { ...b, transform: { ...b.transform, x: b.transform.x + 20, y: b.transform.y + 20 } },
      ]),
    );
    act(() => result.current.commitTransform());

    const updatedA = result.current.shapes.find((s) => s.id === a.id)!;
    const updatedB = result.current.shapes.find((s) => s.id === b.id)!;
    expect(updatedA.transform.x).toBe(a.transform.x + 20);
    expect(updatedB.transform.x).toBe(b.transform.x + 20);

    // Exactly one undo step reverts BOTH shapes' whole gesture together,
    // not one step per intermediate frame and not one step per shape.
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.shapes.find((s) => s.id === a.id)!.transform.x).toBe(a.transform.x);
    expect(result.current.shapes.find((s) => s.id === b.id)!.transform.x).toBe(b.transform.x);
    // Undoing the whole gesture leaves exactly the two "add" steps behind.
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    act(() => result.current.undo());
    expect(result.current.canUndo).toBe(false);
  });

  it('cancelTransform restores every shape to its pre-gesture value with no undo step created', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('circle'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));

    // Undo currently only has the two "add" steps.
    const undoCountBefore = result.current.canUndo;

    act(() => result.current.beginTransform());
    act(() =>
      result.current.updateMultiSelectedTransform([
        { ...a, transform: { ...a.transform, x: 9999 } },
        { ...b, transform: { ...b.transform, x: 9999 } },
      ]),
    );
    expect(result.current.shapes.find((s) => s.id === a.id)!.transform.x).toBe(9999);
    act(() => result.current.cancelTransform());

    expect(result.current.shapes.find((s) => s.id === a.id)!.transform.x).toBe(a.transform.x);
    expect(result.current.shapes.find((s) => s.id === b.id)!.transform.x).toBe(b.transform.x);
    expect(result.current.canUndo).toBe(undoCountBefore);
  });

  it('skips writing a shape that was deleted mid-gesture rather than throwing', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('circle'));
    const [a, b] = result.current.shapes;
    act(() => result.current.toggleMultiSelect(a.id));
    act(() => result.current.toggleMultiSelect(b.id));

    act(() => result.current.beginTransform());
    // Simulate a is deleted by some other means mid-gesture (e.g. a
    // concurrent keyboard delete): remove it directly from scene state.
    act(() => result.current.selectShape(a.id));
    act(() => result.current.deleteSelected());

    expect(() =>
      act(() =>
        result.current.updateMultiSelectedTransform([
          { ...a, transform: { ...a.transform, x: 500 } },
          { ...b, transform: { ...b.transform, x: 500 } },
        ]),
      ),
    ).not.toThrow();

    expect(result.current.shapes.find((s) => s.id === b.id)!.transform.x).toBe(500);
    expect(result.current.shapes.find((s) => s.id === a.id)).toBeUndefined();
  });
});
