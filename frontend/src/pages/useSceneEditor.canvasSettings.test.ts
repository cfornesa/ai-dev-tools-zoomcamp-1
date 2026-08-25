import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { useSceneEditor } from './useSceneEditor';

/**
 * Task 138 (issue #170): hook-level tests for `useSceneEditor`'s canvas
 * settings wiring -- `updateCanvasBackgroundColor`/`updateCanvasOpacity`.
 * Mirrors `useSceneEditor.shapeStyle.test.ts`'s structure for the shape
 * equivalents: commits through the same undo/redo history, and never
 * touches scene state on a rejected edit.
 */

const BLANK_SCENE: SceneDocument = {
  schemaVersion: 1,
  id: 'scene-1',
  canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
  renderer: { preferred: 'p5' },
  layers: [],
  shapes: [],
  groups: [],
  bindings: [],
  graph: { nodes: [], connections: [] },
  accessibility: { reducedMotion: 'auto' },
  randomness: { seed: 0, enabled: false },
};

function renderSceneEditor(initial: SceneDocument = structuredClone(BLANK_SCENE)) {
  return renderHook(() => {
    const [workingCopy, setWorkingCopy] = useState<SceneDocument | null>(initial);
    const editor = useSceneEditor(workingCopy, setWorkingCopy);
    return { ...editor, workingCopy };
  });
}

describe('useSceneEditor canvas settings (Task 138, issue #170)', () => {
  describe('updateCanvasBackgroundColor', () => {
    it('commits a valid edit as one undoable step', () => {
      const { result } = renderSceneEditor();
      let outcome: { ok: true } | { ok: false; error: string } = { ok: false, error: '' };
      act(() => {
        outcome = result.current.updateCanvasBackgroundColor('#112233');
      });
      expect(outcome).toEqual({ ok: true });
      expect(
        (result.current.workingCopy!.canvas as { backgroundColor: string }).backgroundColor,
      ).toBe('#112233');
      expect(result.current.canUndo).toBe(true);

      act(() => result.current.undo());
      expect(
        (result.current.workingCopy!.canvas as { backgroundColor: string }).backgroundColor,
      ).toBe('#ffffff');
    });

    it('rejects an empty value and never writes to scene state', () => {
      const { result } = renderSceneEditor();
      let outcome: { ok: true } | { ok: false; error: string } = { ok: true };
      act(() => {
        outcome = result.current.updateCanvasBackgroundColor('');
      });
      expect(outcome.ok).toBe(false);
      expect(
        (result.current.workingCopy!.canvas as { backgroundColor: string }).backgroundColor,
      ).toBe('#ffffff');
      expect(result.current.canUndo).toBe(false);
    });

    it('rejects a malformed value and never writes to scene state', () => {
      const { result } = renderSceneEditor();
      act(() => {
        result.current.updateCanvasBackgroundColor('not-a-color');
      });
      expect(
        (result.current.workingCopy!.canvas as { backgroundColor: string }).backgroundColor,
      ).toBe('#ffffff');
      expect(result.current.canUndo).toBe(false);
    });

    it('is a no-op with no scene loaded', () => {
      const { result } = renderHook(() => {
        const [workingCopy, setWorkingCopy] = useState<SceneDocument | null>(null);
        return useSceneEditor(workingCopy, setWorkingCopy);
      });
      const outcome = result.current.updateCanvasBackgroundColor('#000000');
      expect(outcome).toEqual({ ok: false, error: 'No scene loaded.' });
    });
  });

  describe('updateCanvasOpacity', () => {
    it('commits a valid edit as one undoable step, defaulting to 1 beforehand', () => {
      const { result } = renderSceneEditor();
      expect((result.current.workingCopy!.canvas as { opacity?: number }).opacity).toBeUndefined();

      let outcome: { ok: true } | { ok: false; error: string } = { ok: false, error: '' };
      act(() => {
        outcome = result.current.updateCanvasOpacity('0.4');
      });
      expect(outcome).toEqual({ ok: true });
      expect((result.current.workingCopy!.canvas as { opacity: number }).opacity).toBe(0.4);
      expect(result.current.canUndo).toBe(true);

      act(() => result.current.undo());
      expect((result.current.workingCopy!.canvas as { opacity?: number }).opacity).toBeUndefined();
    });

    it('clamps an out-of-range value on commit', () => {
      const { result } = renderSceneEditor();
      act(() => {
        result.current.updateCanvasOpacity('5');
      });
      expect((result.current.workingCopy!.canvas as { opacity: number }).opacity).toBe(1);
    });

    it('rejects invalid text and never writes to scene state', () => {
      const { result } = renderSceneEditor();
      let outcome: { ok: true } | { ok: false; error: string } = { ok: true };
      act(() => {
        outcome = result.current.updateCanvasOpacity('not-a-number');
      });
      expect(outcome.ok).toBe(false);
      expect((result.current.workingCopy!.canvas as { opacity?: number }).opacity).toBeUndefined();
      expect(result.current.canUndo).toBe(false);
    });
  });
});
