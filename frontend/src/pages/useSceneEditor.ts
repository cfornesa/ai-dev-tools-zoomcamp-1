import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import type { SceneDocument } from '../api/projects';
import { createShape, duplicateShape, getEditableShapes, type ShapeType } from './sceneShapes';

/**
 * Task 23: shape add/select/duplicate/delete, plus this editor's in-session
 * undo/redo policy.
 *
 * ## In-session undo/redo policy (documented here for later tasks to extend)
 *
 * This is a simple linear undo/redo stack of whole-scene snapshots, kept
 * entirely in this hook's React state:
 *  - Every mutating action (add, duplicate, delete — and whatever later
 *    tasks add: transforms in Task 26, style edits in Task 60, etc.) must
 *    push the scene as it was *before* the mutation onto `past` via
 *    `commit()`, then clear `future` (a new action invalidates any redo
 *    history from before it).
 *  - Undo pops the most recent `past` snapshot, pushes the current scene
 *    onto `future`, and restores the popped snapshot.
 *  - Redo is the mirror image.
 *  - The stack is capped at MAX_HISTORY entries — old snapshots just fall
 *    off the back; V1 doesn't need unbounded undo.
 *  - This is in-memory only: it lives in component state, so it's cleared
 *    on navigation away from the editor or a page reload. It is NOT the
 *    persisted version-history system (Task 41) — that's a separate,
 *    server-side concept for named/saved versions, out of scope here.
 *  - Selection is not part of the snapshot; after undo/redo, a selection
 *    that no longer resolves to a shape in the restored scene is cleared,
 *    the same as any other stale-selection case (see `selectShape`).
 *
 * Later tasks that add new mutating operations should route them through
 * `commit()` the same way add/duplicate/delete do here, so undo/redo keeps
 * working uniformly as more editing features land.
 */

const MAX_HISTORY = 50;

function firstLayerId(scene: SceneDocument): string | null {
  const layers = scene.layers;
  if (!Array.isArray(layers) || layers.length === 0) return null;
  const layer = layers[0] as { id?: unknown };
  return typeof layer?.id === 'string' ? layer.id : null;
}

function sceneCanvas(scene: SceneDocument): { width: number; height: number } {
  const canvas = scene.canvas as { width?: unknown; height?: unknown } | undefined;
  const width = typeof canvas?.width === 'number' ? canvas.width : 800;
  const height = typeof canvas?.height === 'number' ? canvas.height : 600;
  return { width, height };
}

function rawShapes(scene: SceneDocument): unknown[] {
  return Array.isArray(scene.shapes) ? scene.shapes : [];
}

function withShapes(scene: SceneDocument, shapes: unknown[]): SceneDocument {
  return { ...scene, shapes };
}

export function useSceneEditor(
  workingCopy: SceneDocument | null,
  setWorkingCopy: Dispatch<SetStateAction<SceneDocument | null>>,
) {
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [past, setPast] = useState<SceneDocument[]>([]);
  const [future, setFuture] = useState<SceneDocument[]>([]);

  const shapes = getEditableShapes(workingCopy ? rawShapes(workingCopy) : []);
  const selectedShape = shapes.find((s) => s.id === selectedShapeId) ?? null;

  // Any action that changes shapes/scene content routes through here so
  // undo/redo (see policy above) stays consistent across every mutation.
  const commit = useCallback(
    (next: SceneDocument) => {
      if (!workingCopy) return;
      setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), workingCopy]);
      setFuture([]);
      setWorkingCopy(next);
    },
    [workingCopy, setWorkingCopy],
  );

  const selectShape = useCallback(
    (id: string | null) => {
      if (id === null) {
        setSelectedShapeId(null);
        return;
      }
      // Ignore selecting an id that doesn't resolve to a current shape
      // (e.g. stale references) rather than putting the editor into an
      // inconsistent selected-but-nonexistent state.
      if (!workingCopy) return;
      const exists = getEditableShapes(rawShapes(workingCopy)).some((s) => s.id === id);
      if (exists) setSelectedShapeId(id);
    },
    [workingCopy],
  );

  const addShape = useCallback(
    (type: ShapeType) => {
      if (!workingCopy) return;
      const layerId = firstLayerId(workingCopy);
      if (!layerId) return;
      const shape = createShape(type, layerId, sceneCanvas(workingCopy));
      commit(withShapes(workingCopy, [...rawShapes(workingCopy), shape]));
      setSelectedShapeId(shape.id);
    },
    [workingCopy, commit],
  );

  const duplicateSelected = useCallback(() => {
    if (!workingCopy || !selectedShapeId) return;
    const editable = getEditableShapes(rawShapes(workingCopy));
    const source = editable.find((s) => s.id === selectedShapeId);
    if (!source) {
      // Stale selection: nothing to duplicate, and nothing to corrupt.
      setSelectedShapeId(null);
      return;
    }
    const copy = duplicateShape(source);
    commit(withShapes(workingCopy, [...rawShapes(workingCopy), copy]));
    setSelectedShapeId(copy.id);
  }, [workingCopy, selectedShapeId, commit]);

  const deleteSelected = useCallback(() => {
    if (!workingCopy || !selectedShapeId) return;
    const all = rawShapes(workingCopy);
    const stillExists = all.some((s) => (s as { id?: unknown })?.id === selectedShapeId);
    if (!stillExists) {
      // Stale selection: clear it without touching scene state.
      setSelectedShapeId(null);
      return;
    }
    const next = all.filter((s) => (s as { id?: unknown })?.id !== selectedShapeId);
    commit(withShapes(workingCopy, next));
    setSelectedShapeId(null);
  }, [workingCopy, selectedShapeId, commit]);

  const reconcileSelectionAgainst = useCallback((scene: SceneDocument) => {
    setSelectedShapeId((current) => {
      if (current === null) return null;
      const exists = getEditableShapes(rawShapes(scene)).some((s) => s.id === current);
      return exists ? current : null;
    });
  }, []);

  const undo = useCallback(() => {
    if (!workingCopy || past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [...f, workingCopy]);
    setWorkingCopy(previous);
    reconcileSelectionAgainst(previous);
  }, [workingCopy, past, setWorkingCopy, reconcileSelectionAgainst]);

  const redo = useCallback(() => {
    if (!workingCopy || future.length === 0) return;
    const next = future[future.length - 1];
    setFuture((f) => f.slice(0, -1));
    setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), workingCopy]);
    setWorkingCopy(next);
    reconcileSelectionAgainst(next);
  }, [workingCopy, future, setWorkingCopy, reconcileSelectionAgainst]);

  return {
    shapes,
    selectedShapeId,
    selectedShape,
    selectShape,
    addShape,
    duplicateSelected,
    deleteSelected,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}

export type SceneEditor = ReturnType<typeof useSceneEditor>;
