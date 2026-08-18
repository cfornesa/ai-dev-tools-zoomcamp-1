import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import type { SceneDocument } from '../api/projects';
import {
  addCardToScene,
  buildCardsFromScene,
  removeCardFromScene,
  replaceCardInScene,
  sceneHasTwoHandBinding,
  type BehaviorCard,
  type BehaviorCardDraft,
} from './behaviorCards';
import {
  addLayer as addLayerOp,
  buildOutline,
  deleteGroupRecursive,
  deleteLayer as deleteLayerOp,
  getGroups,
  getLayers,
  groupItems,
  moveItem as moveItemOp,
  moveLayer as moveLayerOp,
  removeShapeFromScene,
  renameLayer as renameLayerOp,
  toggleGroupFlag,
  toggleLayerFlag,
  ungroupItem,
  type Outcome,
} from './sceneOutline';
import {
  createShape,
  duplicateShape,
  getEditableShapes,
  type Shape,
  type ShapeType,
} from './sceneShapes';

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
  // Task 24: the active selection concept above already broadened to cover
  // outline rows too — `selectedShapeId` can now hold a shape id *or* a
  // group id (never a layer id: layers aren't a valid `binding.targetScope`
  // and aren't a selectable target), so canvas click-selection and outline
  // selection always agree on the same single selected item. `multiSelectedIds`
  // is a separate, additive outline-only pick used only to gather items to
  // combine into a group — it never overwrites the single active selection.
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [past, setPast] = useState<SceneDocument[]>([]);
  const [future, setFuture] = useState<SceneDocument[]>([]);
  // Task 34: behavior cards. `cardConflict` holds the pending draft plus
  // the existing card it collides with while the user is asked to
  // explicitly confirm a replace — never set as a side effect of adding a
  // card automatically. `cardError` surfaces any other rejection (e.g. a
  // complexity/payload limit) the same way `outlineError` does.
  const [cardConflict, setCardConflict] = useState<{
    draft: BehaviorCardDraft;
    existingCard: BehaviorCard;
  } | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);

  // Task 26: "latest value" refs kept in sync every render (see the two
  // effects just below) so the transform-gesture callbacks further down —
  // which must stay referentially stable across renders, since they're
  // registered once as `window` pointermove/keydown listeners for the
  // duration of a drag (see EditorWorkspace.tsx) — always read the current
  // working copy/selection rather than whatever was current when the drag
  // began.
  const workingCopyRef = useRef(workingCopy);
  useEffect(() => {
    workingCopyRef.current = workingCopy;
  }, [workingCopy]);
  const selectedShapeIdRef = useRef(selectedShapeId);
  useEffect(() => {
    selectedShapeIdRef.current = selectedShapeId;
  }, [selectedShapeId]);
  // Snapshot of the scene as it was immediately before the in-progress
  // transform gesture started — the "before" half of the single commit()-
  // equivalent history entry the gesture produces on completion.
  const transformSnapshotRef = useRef<SceneDocument | null>(null);

  const shapes = getEditableShapes(workingCopy ? rawShapes(workingCopy) : []);
  const selectedShape = shapes.find((s) => s.id === selectedShapeId) ?? null;
  const groups = useMemo(() => (workingCopy ? getGroups(workingCopy) : []), [workingCopy]);
  const layers = useMemo(() => (workingCopy ? getLayers(workingCopy) : []), [workingCopy]);
  const selectedGroup = groups.find((g) => g.id === selectedShapeId) ?? null;
  const outline = useMemo(() => (workingCopy ? buildOutline(workingCopy) : []), [workingCopy]);
  // Task 34: cards are reconstructed fresh from `workingCopy.bindings` on
  // every render rather than kept as separate state — that's what makes
  // save/reload (and undo/redo) round trip losslessly for free, with no
  // extra bookkeeping to keep in sync.
  const behaviorCards = useMemo(
    () => (workingCopy ? buildCardsFromScene(workingCopy) : []),
    [workingCopy],
  );
  const hasTwoHandBinding = useMemo(
    () => (workingCopy ? sceneHasTwoHandBinding(workingCopy) : false),
    [workingCopy],
  );

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

  // Task 26: pointer-driven move/resize/rotate handles in the preview
  // update the selected shape's transform/size live as the pointer moves,
  // but per the undo/redo policy above must still land as exactly one
  // history entry for the whole gesture, not one per pointer-move frame.
  // These four are the primitives EditorWorkspace.tsx's drag handling
  // composes: beginTransform() snapshots the pre-gesture scene,
  // updateSelectedTransform() writes each live intermediate value straight
  // to `workingCopy` (bypassing `commit()`, so no history entry yet),
  // and the gesture ends with exactly one of commitTransform() (push the
  // snapshot onto `past`) or cancelTransform() (restore it, discarding
  // every intermediate write).

  const beginTransform = useCallback(() => {
    transformSnapshotRef.current = workingCopyRef.current;
  }, []);

  const updateSelectedTransform = useCallback(
    (updated: Shape) => {
      const shapeId = selectedShapeIdRef.current;
      if (!shapeId) return;
      setWorkingCopy((current) => {
        if (!current) return current;
        const shapes = rawShapes(current);
        const idx = shapes.findIndex((s) => (s as { id?: unknown })?.id === shapeId);
        if (idx === -1) return current;
        const next = shapes.slice();
        next[idx] = updated;
        return withShapes(current, next);
      });
    },
    [setWorkingCopy],
  );

  const commitTransform = useCallback(() => {
    const before = transformSnapshotRef.current;
    transformSnapshotRef.current = null;
    const current = workingCopyRef.current;
    if (!before || !current || before === current) return;
    setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), before]);
    setFuture([]);
  }, []);

  const cancelTransform = useCallback(() => {
    const before = transformSnapshotRef.current;
    transformSnapshotRef.current = null;
    if (before) setWorkingCopy(before);
  }, [setWorkingCopy]);

  const selectShape = useCallback(
    (id: string | null) => {
      if (id === null) {
        setSelectedShapeId(null);
        return;
      }
      // Ignore selecting an id that doesn't resolve to a current shape or
      // group (e.g. stale references, or a layer id — layers aren't a
      // valid `binding.targetScope` and aren't selectable) rather than
      // putting the editor into an inconsistent selected-but-nonexistent
      // state.
      if (!workingCopy) return;
      const isShape = getEditableShapes(rawShapes(workingCopy)).some((s) => s.id === id);
      const isGroup = getGroups(workingCopy).some((g) => g.id === id);
      if (isShape || isGroup) setSelectedShapeId(id);
    },
    [workingCopy],
  );

  // Applies the outcome of a sceneOutline.ts mutation: on success, commits
  // the new scene (skipping the commit — and any undo step — when the
  // outcome is a legitimate no-op that returned the same scene reference
  // back, e.g. "already at the top"), and optionally moves the active
  // selection to a newly-created item (e.g. the new group after grouping).
  // On failure, surfaces the textual explanation via `outlineError` instead
  // of touching scene state.
  const applyOutcome = useCallback(
    (outcome: Outcome) => {
      if (!outcome.ok) {
        setOutlineError(outcome.error);
        return;
      }
      setOutlineError(null);
      if (workingCopy && outcome.scene !== workingCopy) {
        commit(outcome.scene);
      }
      if (outcome.selectId) {
        setSelectedShapeId(outcome.selectId);
      }
    },
    [workingCopy, commit],
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
    // Task 24: a shape can now belong to a group, so deleting it must also
    // drop its id from that group's childIds (and prune the group if that
    // was its last child) rather than just filtering `shapes`.
    commit(removeShapeFromScene(workingCopy, selectedShapeId));
    setSelectedShapeId(null);
  }, [workingCopy, selectedShapeId, commit]);

  const reconcileSelectionAgainst = useCallback((scene: SceneDocument) => {
    const shapeIds = new Set(getEditableShapes(rawShapes(scene)).map((s) => s.id));
    const groupIds = new Set(getGroups(scene).map((g) => g.id));
    setSelectedShapeId((current) => {
      if (current === null) return null;
      return shapeIds.has(current) || groupIds.has(current) ? current : null;
    });
    setMultiSelectedIds((current) => current.filter((id) => shapeIds.has(id) || groupIds.has(id)));
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

  // --- Task 24: scene outline (layers, groups, and outline reordering) ---
  // Every action below routes through `applyOutcome`, so it commits exactly
  // one undo step on success and never touches scene state on failure —
  // it just surfaces `outlineError`.

  const addLayer = useCallback(() => {
    if (!workingCopy) return;
    applyOutcome(addLayerOp(workingCopy));
  }, [workingCopy, applyOutcome]);

  const renameLayer = useCallback(
    (layerId: string, name: string) => {
      if (!workingCopy) return;
      applyOutcome(renameLayerOp(workingCopy, layerId, name));
    },
    [workingCopy, applyOutcome],
  );

  const deleteLayer = useCallback(
    (layerId: string) => {
      if (!workingCopy) return;
      applyOutcome(deleteLayerOp(workingCopy, layerId));
    },
    [workingCopy, applyOutcome],
  );

  const moveLayer = useCallback(
    (layerId: string, direction: 'up' | 'down') => {
      if (!workingCopy) return;
      applyOutcome(moveLayerOp(workingCopy, layerId, direction));
    },
    [workingCopy, applyOutcome],
  );

  const toggleLayerVisible = useCallback(
    (layerId: string) => {
      if (!workingCopy) return;
      applyOutcome(toggleLayerFlag(workingCopy, layerId, 'visible'));
    },
    [workingCopy, applyOutcome],
  );

  const toggleLayerLocked = useCallback(
    (layerId: string) => {
      if (!workingCopy) return;
      applyOutcome(toggleLayerFlag(workingCopy, layerId, 'locked'));
    },
    [workingCopy, applyOutcome],
  );

  const toggleGroupVisible = useCallback(
    (groupId: string) => {
      if (!workingCopy) return;
      applyOutcome(toggleGroupFlag(workingCopy, groupId, 'visible'));
    },
    [workingCopy, applyOutcome],
  );

  const toggleGroupLocked = useCallback(
    (groupId: string) => {
      if (!workingCopy) return;
      applyOutcome(toggleGroupFlag(workingCopy, groupId, 'locked'));
    },
    [workingCopy, applyOutcome],
  );

  const moveItem = useCallback(
    (itemId: string, direction: 'up' | 'down') => {
      if (!workingCopy) return;
      applyOutcome(moveItemOp(workingCopy, itemId, direction));
    },
    [workingCopy, applyOutcome],
  );

  const toggleMultiSelect = useCallback((id: string) => {
    setMultiSelectedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }, []);

  const clearMultiSelect = useCallback(() => setMultiSelectedIds([]), []);

  const groupSelected = useCallback(() => {
    if (!workingCopy) return;
    const outcome = groupItems(workingCopy, multiSelectedIds);
    applyOutcome(outcome);
    if (outcome.ok) setMultiSelectedIds([]);
  }, [workingCopy, multiSelectedIds, applyOutcome]);

  const ungroupSelected = useCallback(() => {
    if (!workingCopy || !selectedShapeId) return;
    if (!getGroups(workingCopy).some((g) => g.id === selectedShapeId)) return;
    const outcome = ungroupItem(workingCopy, selectedShapeId);
    applyOutcome(outcome);
    if (outcome.ok) setSelectedShapeId(null);
  }, [workingCopy, selectedShapeId, applyOutcome]);

  const deleteGroupSelected = useCallback(() => {
    if (!workingCopy || !selectedShapeId) return;
    if (!getGroups(workingCopy).some((g) => g.id === selectedShapeId)) return;
    const outcome = deleteGroupRecursive(workingCopy, selectedShapeId);
    applyOutcome(outcome);
    if (outcome.ok) setSelectedShapeId(null);
  }, [workingCopy, selectedShapeId, applyOutcome]);

  // --- Task 34: behavior cards ---
  // `addBehaviorCard` never silently overwrites an occupied continuous
  // target channel: on a collision it sets `cardConflict` instead of
  // committing anything, and the panel must call `confirmReplaceCard`
  // (or `cancelCardConflict`) to proceed. Every successful path commits
  // exactly one undo/redo step, same as every other mutation here.

  const addBehaviorCard = useCallback(
    (draft: BehaviorCardDraft) => {
      if (!workingCopy) return;
      const outcome = addCardToScene(workingCopy, draft);
      if (outcome.status === 'added') {
        setCardError(null);
        setCardConflict(null);
        commit(outcome.scene);
      } else if (outcome.status === 'conflict') {
        setCardError(null);
        setCardConflict({ draft, existingCard: outcome.existingCard });
      } else {
        setCardConflict(null);
        setCardError(outcome.error);
      }
    },
    [workingCopy, commit],
  );

  const confirmReplaceCard = useCallback(() => {
    if (!workingCopy || !cardConflict) return;
    const outcome = replaceCardInScene(
      workingCopy,
      cardConflict.existingCard.id,
      cardConflict.draft,
    );
    setCardConflict(null);
    if (outcome.ok) {
      setCardError(null);
      commit(outcome.scene);
    } else {
      setCardError(outcome.error);
    }
  }, [workingCopy, cardConflict, commit]);

  const cancelCardConflict = useCallback(() => setCardConflict(null), []);

  const removeBehaviorCard = useCallback(
    (cardId: string) => {
      if (!workingCopy) return;
      const outcome = removeCardFromScene(workingCopy, cardId);
      if (outcome.ok) {
        setCardError(null);
        commit(outcome.scene);
      } else {
        setCardError(outcome.error);
      }
    },
    [workingCopy, commit],
  );

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
    // Task 26
    beginTransform,
    updateSelectedTransform,
    commitTransform,
    cancelTransform,
    // Task 24
    layers,
    groups,
    selectedGroup,
    outline,
    multiSelectedIds,
    toggleMultiSelect,
    clearMultiSelect,
    outlineError,
    addLayer,
    renameLayer,
    deleteLayer,
    moveLayer,
    toggleLayerVisible,
    toggleLayerLocked,
    toggleGroupVisible,
    toggleGroupLocked,
    moveItem,
    groupSelected,
    ungroupSelected,
    deleteGroupSelected,
    // Task 34
    behaviorCards,
    hasTwoHandBinding,
    cardConflict,
    cardError,
    addBehaviorCard,
    confirmReplaceCard,
    cancelCardConflict,
    removeBehaviorCard,
  };
}

export type SceneEditor = ReturnType<typeof useSceneEditor>;
