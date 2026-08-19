import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { useSceneEditor } from './useSceneEditor';

/**
 * Task 60 (issue #58): hook-level tests for `useSceneEditor`'s Inspector
 * field-edit wiring — `updateSelectedShapeNumericField`/
 * `updateSelectedShapeColorField` commit through the same undo/redo
 * history every other mutation uses, never change the shape's id, and
 * never touch scene state on a rejected edit. See `shapeStyleFields.test.ts`
 * for the underlying pure validation/clamp logic and
 * `EditorWorkspace.shapeInspector.test.tsx` for the rendered UI.
 */

const SCENE_WITH_SHAPE: SceneDocument = {
  schemaVersion: 1,
  id: 'scene-1',
  canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
  renderer: { preferred: 'p5' },
  layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
  shapes: [
    {
      id: 'shape-1',
      type: 'circle',
      layerId: 'layer-1',
      groupId: null,
      transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      style: { fill: '#4f46e5', stroke: null, strokeWidth: 2 },
      radius: 50,
    },
  ],
  groups: [],
  bindings: [],
  graph: { nodes: [], connections: [] },
  accessibility: { reducedMotion: 'auto' },
  randomness: { seed: 0, enabled: false },
};

function renderSceneEditor(initial: SceneDocument = structuredClone(SCENE_WITH_SHAPE)) {
  return renderHook(() => {
    const [workingCopy, setWorkingCopy] = useState<SceneDocument | null>(initial);
    const editor = useSceneEditor(workingCopy, setWorkingCopy);
    return { ...editor, workingCopy };
  });
}

describe('useSceneEditor shape style fields', () => {
  it('is a no-op with no selection', () => {
    const { result } = renderSceneEditor();
    const outcome = result.current.updateSelectedShapeNumericField('rotation', '45');
    expect(outcome).toEqual({ ok: false, error: 'No shape selected.' });
  });

  it('commits a valid numeric edit as one undoable step, preserving the shape id', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.selectShape('shape-1'));

    let outcome: { ok: true } | { ok: false; error: string } = { ok: false, error: '' };
    act(() => {
      outcome = result.current.updateSelectedShapeNumericField('rotation', '45');
    });
    expect(outcome).toEqual({ ok: true });
    expect(result.current.selectedShape?.id).toBe('shape-1');
    expect(result.current.selectedShape?.transform.rotation).toBe(45);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.selectedShape?.transform.rotation).toBe(0);
    expect(result.current.selectedShape?.id).toBe('shape-1');
  });

  it('clamps an out-of-range value into the documented range on commit', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.selectShape('shape-1'));

    act(() => {
      result.current.updateSelectedShapeNumericField('opacity', '5');
    });
    expect(result.current.selectedShape?.transform.opacity).toBe(1);
  });

  it('rejects invalid text and never writes to scene state', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.selectShape('shape-1'));

    let outcome: { ok: true } | { ok: false; error: string } = { ok: true };
    act(() => {
      outcome = result.current.updateSelectedShapeNumericField('positionX', 'not-a-number');
    });
    expect(outcome.ok).toBe(false);
    expect(result.current.selectedShape?.transform.x).toBe(100);
    expect(result.current.canUndo).toBe(false);
  });

  it('rejects non-finite values and never writes to scene state', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.selectShape('shape-1'));

    act(() => {
      result.current.updateSelectedShapeNumericField('rotation', 'Infinity');
    });
    expect(result.current.selectedShape?.transform.rotation).toBe(0);
    expect(result.current.canUndo).toBe(false);
  });

  it('commits a valid color edit, and null clears a color channel', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.selectShape('shape-1'));

    act(() => {
      result.current.updateSelectedShapeColorField('stroke', '#000000');
    });
    expect(result.current.selectedShape?.style.stroke).toBe('#000000');

    act(() => {
      result.current.updateSelectedShapeColorField('stroke', '');
    });
    expect(result.current.selectedShape?.style.stroke).toBeNull();
  });

  it('rejects malformed color text and never writes to scene state', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.selectShape('shape-1'));

    let outcome: { ok: true } | { ok: false; error: string } = { ok: true };
    act(() => {
      outcome = result.current.updateSelectedShapeColorField('fill', 'not-a-color');
    });
    expect(outcome.ok).toBe(false);
    expect(result.current.selectedShape?.style.fill).toBe('#4f46e5');
  });

  it('becomes a no-op once the selected shape is deleted, without throwing', () => {
    const { result } = renderSceneEditor();
    act(() => result.current.selectShape('shape-1'));
    act(() => result.current.deleteSelected());

    expect(result.current.selectedShape).toBeNull();
    const outcome = result.current.updateSelectedShapeNumericField('rotation', '10');
    expect(outcome).toEqual({ ok: false, error: 'No shape selected.' });
  });
});
