import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { useSceneEditor } from './useSceneEditor';

const BLANK_SCENE: SceneDocument = {
  schemaVersion: 1,
  id: 'scene-1',
  canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
  renderer: { preferred: 'p5' },
  layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
  shapes: [],
  groups: [],
  bindings: [],
  graph: { nodes: [], connections: [] },
  accessibility: { reducedMotion: 'auto' },
  randomness: { seed: 0, enabled: false },
};

function renderSceneEditor(initial: SceneDocument | null = structuredClone(BLANK_SCENE)) {
  return renderHook(() => {
    const [workingCopy, setWorkingCopy] = useState<SceneDocument | null>(initial);
    const editor = useSceneEditor(workingCopy, setWorkingCopy);
    return { workingCopy, ...editor };
  });
}

describe('useSceneEditor add', () => {
  it('adds a shape with a stable id and selects it', () => {
    const { result } = renderSceneEditor();

    act(() => result.current.addShape('circle'));

    expect(result.current.shapes).toHaveLength(1);
    expect(result.current.selectedShapeId).toBe(result.current.shapes[0].id);
  });

  it('adds each of the four supported primitive types', () => {
    const { result } = renderSceneEditor();

    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    act(() => result.current.addShape('line'));
    act(() => result.current.addShape('path'));

    expect(result.current.shapes.map((s) => s.type)).toEqual(['circle', 'rect', 'line', 'path']);
  });

  it('does nothing when there is no working copy', () => {
    const { result } = renderSceneEditor(null);
    act(() => result.current.addShape('circle'));
    expect(result.current.shapes).toEqual([]);
  });
});

describe('useSceneEditor selection', () => {
  it('selects a shape by id via selectShape', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [circle] = result.current.shapes;

    act(() => result.current.selectShape(circle.id));

    expect(result.current.selectedShapeId).toBe(circle.id);
    expect(result.current.selectedShape?.id).toBe(circle.id);
  });

  it('ignores selecting an id that does not resolve to any current shape', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const [circle] = result.current.shapes;
    act(() => result.current.selectShape(circle.id));

    act(() => result.current.selectShape('does-not-exist'));

    // Selection is left as it was, not corrupted into a dangling reference.
    expect(result.current.selectedShapeId).toBe(circle.id);
  });

  it('allows clearing the selection with null', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.selectShape(null));
    expect(result.current.selectedShapeId).toBeNull();
  });
});

describe('useSceneEditor duplicate', () => {
  it('duplicates the selected shape into an independent shape with a new id', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('rect'));
    const original = result.current.shapes[0];

    act(() => result.current.duplicateSelected());

    expect(result.current.shapes).toHaveLength(2);
    const copy = result.current.shapes[1];
    expect(copy.id).not.toBe(original.id);
    expect(copy.type).toBe(original.type);
    expect(result.current.selectedShapeId).toBe(copy.id);
  });

  it('does nothing when nothing is selected', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('rect'));
    act(() => result.current.selectShape(null));

    act(() => result.current.duplicateSelected());

    expect(result.current.shapes).toHaveLength(1);
  });

  it('clears a stale selection instead of duplicating a nonexistent shape', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('rect'));
    act(() => result.current.deleteSelected()); // shape gone, but pretend selection stuck around

    act(() => result.current.duplicateSelected());

    expect(result.current.shapes).toHaveLength(0);
    expect(result.current.selectedShapeId).toBeNull();
  });
});

describe('useSceneEditor delete', () => {
  it('removes only the selected shape', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [circle, rect] = result.current.shapes;
    act(() => result.current.selectShape(circle.id));

    act(() => result.current.deleteSelected());

    expect(result.current.shapes.map((s) => s.id)).toEqual([rect.id]);
    expect(result.current.selectedShapeId).toBeNull();
  });

  it('is a no-op when there is no selection', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.selectShape(null));

    act(() => result.current.deleteSelected());

    expect(result.current.shapes).toHaveLength(1);
  });

  it('a repeated delete call after selection already cleared is inert and safe', () => {
    // selectShape only ever accepts ids that resolve to a live shape, and
    // the selection is cleared as part of a successful delete, so a
    // deleteSelected() with a stale/no selection can't corrupt the shapes
    // array — this exercises that guard directly.
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const [circle] = result.current.shapes;
    act(() => result.current.selectShape(circle.id));
    act(() => result.current.deleteSelected()); // circle now gone, selection cleared

    act(() => result.current.deleteSelected());

    expect(result.current.shapes).toHaveLength(1);
    expect(result.current.shapes[0].type).toBe('rect');
  });
});

describe('useSceneEditor undo/redo', () => {
  it('undoes an add', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    expect(result.current.shapes).toHaveLength(1);

    act(() => result.current.undo());

    expect(result.current.shapes).toHaveLength(0);
    expect(result.current.canRedo).toBe(true);
  });

  it('redoes after an undo', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const added = result.current.shapes[0];
    act(() => result.current.undo());

    act(() => result.current.redo());

    expect(result.current.shapes.map((s) => s.id)).toEqual([added.id]);
  });

  it('undoes a delete, restoring the deleted shape', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const shape = result.current.shapes[0];
    act(() => result.current.selectShape(shape.id));
    act(() => result.current.deleteSelected());
    expect(result.current.shapes).toHaveLength(0);

    act(() => result.current.undo());

    expect(result.current.shapes.map((s) => s.id)).toEqual([shape.id]);
  });

  it('undoes a duplicate, removing the copy but keeping the source', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    const source = result.current.shapes[0];
    act(() => result.current.duplicateSelected());
    expect(result.current.shapes).toHaveLength(2);

    act(() => result.current.undo());

    expect(result.current.shapes.map((s) => s.id)).toEqual([source.id]);
  });

  it('a new action after an undo clears the redo stack', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.addShape('rect'));

    expect(result.current.canRedo).toBe(false);
  });

  it('clears a selection that no longer resolves after undo', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.addShape('circle'));
    act(() => result.current.addShape('rect'));
    const rect = result.current.shapes[1];
    act(() => result.current.selectShape(rect.id));

    act(() => result.current.undo()); // removes the rect add

    expect(result.current.selectedShapeId).toBeNull();
  });

  it('is a no-op when there is nothing to undo/redo', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(result.current.shapes).toEqual([]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
