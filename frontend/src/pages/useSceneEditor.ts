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
  addGraphConnection as addGraphConnectionOp,
  addGraphNode as addGraphNodeOp,
  moveGraphNode as moveGraphNodeOp,
  removeGraphConnection as removeGraphConnectionOp,
  removeGraphNode as removeGraphNodeOp,
  updateGraphNodeParams as updateGraphNodeParamsOp,
  type GraphConnectionData,
  type GraphNodeData,
} from './graphEditing';
import {
  addLayer as addLayerOp,
  buildOutline,
  createLayerFor,
  deleteGroupRecursive,
  deleteLayer as deleteLayerOp,
  getGroups,
  getLayers,
  groupItems,
  isEffectivelyLocked,
  moveItem as moveItemOp,
  moveItemToGroup as moveItemToGroupOp,
  moveItemToLayer as moveItemToLayerOp,
  moveLayer as moveLayerOp,
  outlineBreadcrumb,
  removeShapeFromScene,
  renameGroup as renameGroupOp,
  groupDisplayLabel,
  renameLayer as renameLayerOp,
  renameShape as renameShapeOp,
  toggleGroupFlag,
  toggleShapeFlag as toggleShapeFlagOp,
  toggleLayerFlag,
  ungroupItem,
  type Group,
  type Outcome,
} from './sceneOutline';
import {
  appendPathPointNearLast,
  clamp,
  createShape,
  deletePathPoint,
  duplicateShape,
  findClosestPathSegment,
  getEditableShapes,
  insertPathPoint,
  POSITION_LIMIT,
  shapeLabel,
  type PathShape,
  type Point,
  type Shape,
  type ShapeType,
} from './sceneShapes';
import {
  applyColorFieldToShape,
  applyNumericFieldToShape,
  NUMERIC_FIELD_SPECS,
  parseColorFieldEdit,
  parseNumericFieldEdit,
  type ColorShapeField,
  type NumericShapeField,
} from './shapeStyleFields';
import { parseCanvasBackgroundColorEdit, parseCanvasOpacityEdit } from './canvasSettingsFields';

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

// Issue #77: expands one `multiSelectedIds` entry that refers to a group
// (rather than a shape) into every one of that group's recursive
// descendant shape ids — a group's `childIds` can itself contain nested
// group ids (see sceneOutline.ts's "Group membership model"), so this
// walks the whole subtree. `visited` guards against a malformed/cyclic
// `childIds` graph looping forever; it should never actually trigger
// against a scene `groupItems`/`ungroupItem` produced, but costs nothing
// to keep here defensively.
function expandGroupToDescendantIds(
  groups: Group[],
  groupId: string,
  visited: Set<string> = new Set(),
): string[] {
  if (visited.has(groupId)) return [];
  visited.add(groupId);
  const group = groups.find((g) => g.id === groupId);
  if (!group) return [];
  const ids: string[] = [];
  for (const childId of group.childIds) {
    if (groups.some((g) => g.id === childId)) {
      ids.push(...expandGroupToDescendantIds(groups, childId, visited));
    } else {
      ids.push(childId);
    }
  }
  return ids;
}

// Issue #77: resolves the outline's `multiSelectedIds` (a flat, additive
// pick of shape ids and/or group ids — see `toggleMultiSelect` below) into
// the concrete list of shapes a group manipulation gesture should act on:
// group ids expand to their recursive descendant shapes, ids that no
// longer resolve to a shape or group in `scene` (stale selections) are
// silently skipped rather than rejecting the whole gesture, and duplicate
// resolutions (e.g. a shape id and its containing group both present in
// `multiSelectedIds`) collapse to one entry each. Draw order is preserved
// by returning shapes in `shapes` array order rather than selection order.
function resolveMultiSelection(scene: SceneDocument, ids: string[]): Shape[] {
  const shapes = getEditableShapes(rawShapes(scene));
  const groups = getGroups(scene);
  const shapeIds = new Set(shapes.map((s) => s.id));
  const resolvedIds = new Set<string>();
  for (const id of ids) {
    if (shapeIds.has(id)) {
      resolvedIds.add(id);
      continue;
    }
    const group = groups.find((g) => g.id === id);
    if (!group) continue; // stale id: silently skipped
    for (const descendantId of expandGroupToDescendantIds(groups, id)) {
      if (shapeIds.has(descendantId)) resolvedIds.add(descendantId);
    }
  }
  return shapes.filter((s) => resolvedIds.has(s.id));
}

// Task 80 (issue #80): the single shared lock guard every mutation entry
// point in this hook (and, via `checkUnlocked` below, every pointer-gesture
// entry point in EditorWorkspace.tsx) routes through, rather than each call
// site re-deriving `isEffectivelyLocked` inline. Pure and stateless — it
// reads no hook state itself, so it works identically whether the caller
// reports the rejection through `lockError` (via `checkUnlocked`), an
// existing channel like `outlineError`/`vertexError`, or a field-edit
// function's own `{ ok, error }` return value (this result type is
// deliberately identical in shape to that convention, so a caller can
// `return guardUnlocked(...)` directly when it fails).
export type LockGuardResult = { ok: true } | { ok: false; error: string };

export function guardUnlocked(
  scene: SceneDocument,
  ids: string[],
  message: string,
): LockGuardResult {
  return ids.some((id) => isEffectivelyLocked(scene, id))
    ? { ok: false, error: message }
    : { ok: true };
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
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [isLayerSelection, setIsLayerSelection] = useState(false);
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [outlineStatus, setOutlineStatus] = useState<string | null>(null);
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
  // Task 36: the advanced graph editor's rejection channel — same pattern
  // as `outlineError`/`cardError`: set on a failed mutation, never on a
  // successful one, and scene state is never touched when it's set (see
  // `graphEditing.ts`'s `Outcome` type).
  const [graphError, setGraphError] = useState<string | null>(null);

  // Issue #79: per-vertex path editing mode. `vertexEditShapeId` is the id
  // of the single `path` shape currently in "Edit points" mode (never a
  // group, never a multi-selection — see this task's own "Out of scope"),
  // or null when no shape is in that mode. `selectedVertexIndex` is a
  // separate, narrower selection concept — which one of that shape's
  // points is the target for keyboard Delete/Backspace — distinct from
  // `selectedShapeId` itself. `vertexError` is the same "surfaced,
  // non-blocking rejection" channel `outlineError`/`cardError`/`graphError`
  // above already use for insert-at-cap/delete-at-floor rejections.
  const [vertexEditShapeId, setVertexEditShapeId] = useState<string | null>(null);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const [vertexError, setVertexError] = useState<string | null>(null);

  // Task 80 (issue #80): the net-new error channel for guarded call sites
  // that had no existing rejection channel of their own before this issue
  // (duplicateSelected, deleteSelected, and pointer-gesture initiation in
  // EditorWorkspace.tsx) — every other guarded call site reuses whichever
  // channel it already had (`outlineError`, `vertexError`, or a field
  // edit's own `{ ok, error }` return), per this issue's own UI-feedback
  // convention.
  const [lockError, setLockError] = useState<string | null>(null);

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
  // Issue #79: the selection changing (to a different shape, a group, or
  // nothing — including via undo/redo's `reconcileSelectionAgainst`
  // below) always exits vertex edit mode and clears the selected-vertex
  // concept, synchronously before the next render — the "no stale vertex
  // handles are ever left rendered" acceptance criterion. Toggling edit
  // mode on/off itself never changes `selectedShapeId`, so this effect
  // doesn't re-fire (and doesn't fight) that toggle.
  useEffect(() => {
    setVertexEditShapeId(null);
    setSelectedVertexIndex(null);
    setVertexError(null);
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
  // Issue #79: true only while the shape currently in vertex edit mode is
  // still the single active selection *and* still a `path` — the extra
  // `selectedShape?.type === 'path'` check is a belt-and-suspenders
  // guard alongside the selection-change effect above, since both must
  // hold for canvas vertex handles / the point list to render.
  const vertexEditActive =
    vertexEditShapeId !== null &&
    vertexEditShapeId === selectedShapeId &&
    selectedShape?.type === 'path';
  // Issue #77: the resolved multi-shape selection a group manipulation
  // gesture acts on — only ever non-empty once `multiSelectedIds` holds
  // 2+ entries (below that threshold, canvas manipulation stays on the
  // single-shape `selectedShapeId` path Task 26 already built; see
  // EditorWorkspace.tsx). Group ids expand to descendants and stale ids
  // are dropped by `resolveMultiSelection` above.
  const multiSelectedShapes = useMemo(
    () =>
      workingCopy && multiSelectedIds.length >= 2
        ? resolveMultiSelection(workingCopy, multiSelectedIds)
        : [],
    [workingCopy, multiSelectedIds],
  );
  const outline = useMemo(() => (workingCopy ? buildOutline(workingCopy) : []), [workingCopy]);
  // Task 80 (issue #110): the layer → group → … → item path for whichever
  // shape or group is the single active selection, so the Inspector panel
  // can show that context ("Layer 1 > Group A > Circle 2") right alongside
  // the attributes it edits — see `sceneOutline.ts`'s `outlineBreadcrumb`.
  // Empty when nothing is selected or the selection is stale.
  const selectedBreadcrumb = useMemo(
    () => (workingCopy ? outlineBreadcrumb(workingCopy, selectedShapeId) : []),
    [workingCopy, selectedShapeId],
  );
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
  // Task 36: the advanced graph, re-derived fresh from `workingCopy.graph`
  // every render — same rationale as `behaviorCards` above: no separate
  // state to keep in sync, so save/reload and undo/redo round-trip for
  // free.
  const graphNodes = useMemo<GraphNodeData[]>(() => {
    const graph = workingCopy?.graph as { nodes?: unknown } | undefined;
    return Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNodeData[]) : [];
  }, [workingCopy]);
  const graphConnections = useMemo<GraphConnectionData[]>(() => {
    const graph = workingCopy?.graph as { connections?: unknown } | undefined;
    return Array.isArray(graph?.connections) ? (graph!.connections as GraphConnectionData[]) : [];
  }, [workingCopy]);

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

  // Issue #77: the multi-shape analogue of `updateSelectedTransform` —
  // writes every shape in `updatedShapes` (one live intermediate frame of
  // a group move/resize/rotate gesture, produced by `sceneShapes.ts`'s
  // `applyGroupDrag`) straight into `workingCopy` by id, bypassing
  // `commit()` exactly like the single-shape path so the whole gesture
  // still lands as one history entry via `commitTransform`/`cancelTransform`
  // below. Iterating the *current* `shapes` array (rather than
  // `updatedShapes`) means a shape deleted by some other means mid-gesture
  // (e.g. a concurrent keyboard delete) is simply no longer present to
  // write into — no throw, no special-casing needed here.
  const updateMultiSelectedTransform = useCallback(
    (updatedShapes: Shape[]) => {
      if (updatedShapes.length === 0) return;
      const byId = new Map(updatedShapes.map((s) => [s.id, s]));
      setWorkingCopy((current) => {
        if (!current) return current;
        const shapes = rawShapes(current);
        let changed = false;
        const next = shapes.map((s) => {
          const id = (s as { id?: unknown })?.id;
          const replacement = typeof id === 'string' ? byId.get(id) : undefined;
          if (!replacement) return s;
          changed = true;
          return replacement;
        });
        return changed ? withShapes(current, next) : current;
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
        setSelectedLayerId(null);
        setIsLayerSelection(false);
        return;
      }
      // Ignore selecting an id that doesn't resolve to a current shape or
      // group (e.g. stale references, or a layer id — layers aren't a
      // valid `binding.targetScope` and aren't selectable) rather than
      // putting the editor into an inconsistent selected-but-nonexistent
      // state.
      if (!workingCopy) return;
      const isShape = getEditableShapes(rawShapes(workingCopy)).some((s) => s.id === id);
      const groups = getGroups(workingCopy);
      const group = groups.find((g) => g.id === id);
      const isGroup = !!group;
      if (isShape || isGroup) {
        setSelectedShapeId(id);
        // Keep the owning layer selected with the item. This is intentionally
        // additive: the item remains the single canvas/HUD selection while
        // the layer row gets the complete selected-block treatment.
        const shape = getEditableShapes(rawShapes(workingCopy)).find((s) => s.id === id);
        setSelectedLayerId(shape?.layerId ?? group?.layerId ?? null);
        setIsLayerSelection(false);
      }
    },
    [workingCopy],
  );

  const selectLayer = useCallback(
    (id: string | null) => {
      if (id === null) {
        setSelectedLayerId(null);
        setIsLayerSelection(false);
        return;
      }
      if (!workingCopy || !getLayers(workingCopy).some((layer) => layer.id === id)) return;
      setSelectedLayerId(id);
      setIsLayerSelection(true);
      // A layer selection also exposes its first selectable shape to the
      // canvas. Keeping both ids lets the layer HUD describe the layer while
      // the selected shape receives the normal canvas handles.
      const firstShape = getEditableShapes(rawShapes(workingCopy)).find(
        (shape) => shape.layerId === id,
      );
      setSelectedShapeId(firstShape?.id ?? null);
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

  // Task 80 (issue #80): the `lockError`-channel wrapper around the shared
  // `guardUnlocked` above, exposed so EditorWorkspace.tsx's pointer-gesture
  // initiation (single-shape move/resize/rotate, the multi-shape group
  // gesture, and vertex-handle drag) can guard *before* a drag starts —
  // "the gesture does not start" per this issue's acceptance criteria,
  // rather than being rejected mid-gesture. Every internal call site in
  // this hook that reports through `lockError` (duplicateSelected,
  // deleteSelected) calls `guardUnlocked` directly instead, for the same
  // reason `applyOutcome` isn't used for those: no `Outcome`/scene-replacing
  // result is involved, just a boolean gate.
  const checkUnlocked = useCallback(
    (ids: string[], message: string): boolean => {
      if (!workingCopy) return true;
      const result = guardUnlocked(workingCopy, ids, message);
      if (!result.ok) {
        setLockError(result.error);
        return false;
      }
      setLockError(null);
      return true;
    },
    [workingCopy],
  );

  const addShape = useCallback(
    (type: ShapeType) => {
      if (!workingCopy) return;
      // Task 111 (issue #142): every shape is its own independent layer --
      // a new shape gets a brand-new layer of its own rather than reusing
      // `firstLayerId` (which used to put every new shape on the same
      // layer). Both the new layer and the new shape are added in one
      // `commit()`, so undo/redo treats them as a single step.
      const newLayer = createLayerFor(workingCopy);
      const shape = createShape(type, newLayer.id, sceneCanvas(workingCopy));
      const nextScene = withShapes(
        { ...workingCopy, layers: [...getLayers(workingCopy), newLayer] },
        [...rawShapes(workingCopy), shape],
      );
      commit(nextScene);
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
    if (
      !checkUnlocked(
        [selectedShapeId],
        "This shape is on a locked layer or group and can't be duplicated. Unlock it first.",
      )
    ) {
      return;
    }
    // Task 111 (issue #142): the duplicate gets its own new layer too --
    // sharing the source shape's layerId would violate the one-shape-per-
    // layer invariant immediately.
    const newLayer = createLayerFor(workingCopy);
    const copy = { ...duplicateShape(source), layerId: newLayer.id };
    const nextScene = withShapes(
      { ...workingCopy, layers: [...getLayers(workingCopy), newLayer] },
      [...rawShapes(workingCopy), copy],
    );
    commit(nextScene);
    setSelectedShapeId(copy.id);
  }, [workingCopy, selectedShapeId, commit, checkUnlocked]);

  // Issue #131: generalized to take an explicit shape `id`, defaulting to
  // the current selection so every pre-existing caller (the Tools panel's
  // "Delete selected shape" button) is unchanged. This lets LayersPanel's
  // per-row delete button remove *any* row's shape directly, without first
  // calling `selectShape` and racing this hook's not-yet-committed state —
  // see this hook's module doc comment / issue #131's stale-closure hazard
  // for why a two-call `selectShape` + `deleteSelected` sequence in one
  // event handler would silently operate on the *previous* selection.
  const deleteSelected = useCallback(
    (id?: string) => {
      const targetId = id ?? selectedShapeId;
      if (!workingCopy || !targetId) return;
      const all = rawShapes(workingCopy);
      const stillExists = all.some((s) => (s as { id?: unknown })?.id === targetId);
      if (!stillExists) {
        // Stale selection: clear it without touching scene state.
        if (targetId === selectedShapeId) setSelectedShapeId(null);
        return;
      }
      if (
        !checkUnlocked(
          [targetId],
          "This shape is on a locked layer or group and can't be deleted. Unlock it first.",
        )
      ) {
        return;
      }
      // Task 24: a shape can now belong to a group, so deleting it must also
      // drop its id from that group's childIds (and prune the group if that
      // was its last child) rather than just filtering `shapes`.
      commit(removeShapeFromScene(workingCopy, targetId));
      if (targetId === selectedShapeId) setSelectedShapeId(null);
    },
    [workingCopy, selectedShapeId, commit, checkUnlocked],
  );

  // Task 60 (issue #58): Inspector panel field edits for the single
  // actively selected shape's transform/style properties (position X/Y,
  // scale X/Y, rotation, opacity, fill, stroke, stroke width). Unlike
  // `updateSelectedTransform` above (which writes every live intermediate
  // frame of a pointer drag straight to `workingCopy`, bypassing
  // `commit()` until the gesture ends), a field edit here is a single
  // discrete value change, so each valid edit commits its own undo/redo
  // step immediately — the same "one user-visible change, one history
  // entry" granularity `applyOutcome`/`addShape`/etc. already use
  // elsewhere in this hook.
  //
  // Validation happens in `shapeStyleFields.ts` (see that file's module
  // doc comment for the documented clamp-vs-reject policy) *before*
  // anything here touches `workingCopy`: an invalid/non-finite numeric
  // value or a malformed color never reaches `commit()` — the caller gets
  // back `{ ok: false, error }` and scene state is left untouched.
  const updateSelectedShapeNumericField = useCallback(
    (field: NumericShapeField, raw: string): { ok: true } | { ok: false; error: string } => {
      if (!workingCopy || !selectedShape) {
        return { ok: false, error: 'No shape selected.' };
      }
      const guard = guardUnlocked(
        workingCopy,
        [selectedShape.id],
        "This shape is on a locked layer or group and can't be edited. Unlock it first.",
      );
      if (!guard.ok) return guard;
      const spec = NUMERIC_FIELD_SPECS.find((s) => s.field === field)!;
      const outcome = parseNumericFieldEdit(spec, raw);
      if (!outcome.ok) return outcome;
      const shapesArr = rawShapes(workingCopy);
      const idx = shapesArr.findIndex((s) => (s as { id?: unknown })?.id === selectedShape.id);
      if (idx === -1) return { ok: false, error: 'That shape no longer exists.' };
      const updated = applyNumericFieldToShape(selectedShape, field, outcome.value);
      const next = shapesArr.slice();
      next[idx] = updated;
      commit(withShapes(workingCopy, next));
      return { ok: true };
    },
    [workingCopy, selectedShape, commit],
  );

  const updateSelectedShapeColorField = useCallback(
    (field: ColorShapeField, raw: string): { ok: true } | { ok: false; error: string } => {
      if (!workingCopy || !selectedShape) {
        return { ok: false, error: 'No shape selected.' };
      }
      const guard = guardUnlocked(
        workingCopy,
        [selectedShape.id],
        "This shape is on a locked layer or group and can't be edited. Unlock it first.",
      );
      if (!guard.ok) return guard;
      const outcome = parseColorFieldEdit(field, raw);
      if (!outcome.ok) return outcome;
      const shapesArr = rawShapes(workingCopy);
      const idx = shapesArr.findIndex((s) => (s as { id?: unknown })?.id === selectedShape.id);
      if (idx === -1) return { ok: false, error: 'That shape no longer exists.' };
      const updated = applyColorFieldToShape(selectedShape, field, outcome.value);
      const next = shapesArr.slice();
      next[idx] = updated;
      commit(withShapes(workingCopy, next));
      return { ok: true };
    },
    [workingCopy, selectedShape, commit],
  );

  // Task 138 (issue #170): the canvas/background settings row —
  // `canvas.backgroundColor` (already required by the schema, but
  // previously reachable only via the Code tab's raw JSON, #159) and the
  // new `canvas.opacity` field. Neither field belongs to a shape or
  // layer, so unlike `updateSelectedShapeColorField`/
  // `updateSelectedShapeNumericField` above these need no selection and
  // no lock guard — the canvas itself has no lock/visibility concept
  // (issue #170 explicitly excludes a canvas visibility toggle), and its
  // settings are always editable whenever a scene is loaded at all.
  const updateCanvasBackgroundColor = useCallback(
    (raw: string): { ok: true } | { ok: false; error: string } => {
      if (!workingCopy) return { ok: false, error: 'No scene loaded.' };
      const outcome = parseCanvasBackgroundColorEdit(raw);
      if (!outcome.ok) return outcome;
      const canvas = (workingCopy.canvas ?? {}) as Record<string, unknown>;
      commit({ ...workingCopy, canvas: { ...canvas, backgroundColor: outcome.value } });
      return { ok: true };
    },
    [workingCopy, commit],
  );

  const updateCanvasOpacity = useCallback(
    (raw: string): { ok: true } | { ok: false; error: string } => {
      if (!workingCopy) return { ok: false, error: 'No scene loaded.' };
      const outcome = parseCanvasOpacityEdit(raw);
      if (!outcome.ok) return outcome;
      const canvas = (workingCopy.canvas ?? {}) as Record<string, unknown>;
      commit({ ...workingCopy, canvas: { ...canvas, opacity: outcome.value } });
      return { ok: true };
    },
    [workingCopy, commit],
  );

  // --- Issue #79: per-vertex path editing ---
  // `toggleVertexEditMode` only ever turns edit mode *on* for a single
  // selected `path` shape (never a group/multi-selection — the toggle
  // button itself isn't even rendered otherwise, but this guards the
  // invariant here too); turning it off is always allowed. Every mutation
  // below (`insertVertexAtPoint`/`deleteVertexAt`/`addVertexNearLast`/
  // `updateVertexPointField`) reads `selectedShape` fresh, requires it to
  // still be a `path`, and commits exactly one undo/redo step on success —
  // the same "one user-visible change, one history entry" granularity
  // `updateSelectedShapeNumericField` above already uses — while a
  // rejection (at the `MAX_PATH_POINTS`/`MIN_PATH_POINTS` boundary, or a
  // stale shape/point reference) only ever sets `vertexError` and never
  // touches `workingCopy`/`commit`.

  const toggleVertexEditMode = useCallback(() => {
    setSelectedVertexIndex(null);
    setVertexEditShapeId((current) => {
      if (current !== null) {
        setVertexError(null);
        return null;
      }
      if (!selectedShape || selectedShape.type !== 'path' || !workingCopy) {
        setVertexError(null);
        return null;
      }
      const guard = guardUnlocked(
        workingCopy,
        [selectedShape.id],
        "This shape is on a locked layer or group and can't be reshaped. Unlock it first.",
      );
      if (!guard.ok) {
        setVertexError(guard.error);
        return null;
      }
      setVertexError(null);
      return selectedShape.id;
    });
  }, [selectedShape, workingCopy]);

  const exitVertexEditMode = useCallback(() => {
    setVertexEditShapeId(null);
    setSelectedVertexIndex(null);
  }, []);

  const selectVertex = useCallback((index: number | null) => {
    setSelectedVertexIndex(index);
  }, []);

  // Shared by every discrete (non-drag) vertex mutation below: looks up
  // the currently selected path shape's live array index and, on success,
  // writes the replacement shape through the normal `commit()` path so it
  // participates in undo/redo exactly like every other mutation in this
  // hook.
  const commitPathShapeReplacement = useCallback(
    (updated: PathShape) => {
      if (!workingCopy) return;
      const shapesArr = rawShapes(workingCopy);
      const idx = shapesArr.findIndex((s) => (s as { id?: unknown })?.id === updated.id);
      if (idx === -1) return;
      const next = shapesArr.slice();
      next[idx] = updated;
      commit(withShapes(workingCopy, next));
    },
    [workingCopy, commit],
  );

  // Task 80 (issue #80): every vertex mutation below guards against the
  // selected `path` shape being effectively locked before doing anything
  // else — reusing `vertexError`, the channel this task's insert/delete-cap
  // rejections already surface through, rather than introducing a second
  // channel for the same shape.
  const guardVertexEdit = useCallback((): boolean => {
    if (!selectedShape || selectedShape.type !== 'path' || !workingCopy) return false;
    const guard = guardUnlocked(
      workingCopy,
      [selectedShape.id],
      "This shape is on a locked layer or group and can't be reshaped. Unlock it first.",
    );
    if (!guard.ok) {
      setVertexError(guard.error);
      return false;
    }
    return true;
  }, [selectedShape, workingCopy]);

  const insertVertexAtPoint = useCallback(
    (pointer: Point) => {
      if (!selectedShape || selectedShape.type !== 'path') return;
      if (!guardVertexEdit()) return;
      const hit = findClosestPathSegment(selectedShape, pointer);
      if (!hit) return; // not close enough to any segment: a silent no-op, not a rejection
      const result = insertPathPoint(selectedShape, hit.index, hit.point);
      if (!result.ok) {
        setVertexError(result.error);
        return;
      }
      setVertexError(null);
      setSelectedVertexIndex(null);
      commitPathShapeReplacement(result.shape);
    },
    [selectedShape, commitPathShapeReplacement, guardVertexEdit],
  );

  const addVertexNearLast = useCallback(() => {
    if (!selectedShape || selectedShape.type !== 'path') return;
    if (!guardVertexEdit()) return;
    const result = appendPathPointNearLast(selectedShape);
    if (!result.ok) {
      setVertexError(result.error);
      return;
    }
    setVertexError(null);
    setSelectedVertexIndex(null);
    commitPathShapeReplacement(result.shape);
  }, [selectedShape, commitPathShapeReplacement, guardVertexEdit]);

  const deleteVertexAt = useCallback(
    (index: number) => {
      if (!selectedShape || selectedShape.type !== 'path') return;
      if (!guardVertexEdit()) return;
      const result = deletePathPoint(selectedShape, index);
      if (!result.ok) {
        setVertexError(result.error);
        return;
      }
      setVertexError(null);
      setSelectedVertexIndex(null);
      commitPathShapeReplacement(result.shape);
    },
    [selectedShape, commitPathShapeReplacement, guardVertexEdit],
  );

  // The keyboard point-coordinate list's per-axis numeric field — same
  // "parse, then clamp a finite value into the schema's point range,
  // reject anything else" policy `shapeStyleFields.ts`'s
  // `parseNumericFieldEdit` documents for the position/scale/rotation
  // fields it already covers, applied here to an individual point instead
  // of the whole shape's transform.
  const updateVertexPointField = useCallback(
    (index: number, axis: 'x' | 'y', raw: string): { ok: true } | { ok: false; error: string } => {
      if (!selectedShape || selectedShape.type !== 'path' || !workingCopy) {
        return { ok: false, error: 'No path shape selected.' };
      }
      const guard = guardUnlocked(
        workingCopy,
        [selectedShape.id],
        "This shape is on a locked layer or group and can't be reshaped. Unlock it first.",
      );
      if (!guard.ok) {
        setVertexError(guard.error);
        return guard;
      }
      const label = axis === 'x' ? 'Point X' : 'Point Y';
      const rangeText = `${POSITION_LIMIT.min} to ${POSITION_LIMIT.max}`;
      const trimmed = raw.trim();
      if (trimmed === '') {
        return { ok: false, error: `${label} must be a number (${rangeText}).` };
      }
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        return { ok: false, error: `${label} must be a finite number (${rangeText}).` };
      }
      if (index < 0 || index >= selectedShape.points.length) {
        return { ok: false, error: 'That point no longer exists.' };
      }
      const value = clamp(parsed, POSITION_LIMIT.min, POSITION_LIMIT.max);
      const points = selectedShape.points.map((p, i) =>
        i === index ? { ...p, [axis]: value } : p,
      );
      commitPathShapeReplacement({ ...selectedShape, points });
      return { ok: true };
    },
    [selectedShape, workingCopy, commitPathShapeReplacement],
  );

  const reconcileSelectionAgainst = useCallback(
    (scene: SceneDocument) => {
      const shapeIds = new Set(getEditableShapes(rawShapes(scene)).map((s) => s.id));
      const groupIds = new Set(getGroups(scene).map((g) => g.id));
      setSelectedShapeId((current) => {
        if (current === null) return null;
        return shapeIds.has(current) || groupIds.has(current) ? current : null;
      });
      const layerIds = new Set(getLayers(scene).map((layer) => layer.id));
      const nextShapeIds = new Set([...shapeIds, ...groupIds]);
      setSelectedLayerId((current) => {
        if (current && layerIds.has(current)) return current;
        if (!current) return null;
        const shape = getEditableShapes(rawShapes(scene)).find((s) => s.id === current);
        const group = getGroups(scene).find((g) => g.id === current);
        return shape?.layerId ?? group?.layerId ?? null;
      });
      setIsLayerSelection(
        (current) => current && !!getLayers(scene).some((l) => l.id === selectedLayerId),
      );
      setMultiSelectedIds((current) => current.filter((id) => nextShapeIds.has(id)));
    },
    [selectedLayerId],
  );

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

  const renameShape = useCallback(
    (shapeId: string, name: string) => {
      if (!workingCopy) return;
      applyOutcome(renameShapeOp(workingCopy, shapeId, name));
    },
    [workingCopy, applyOutcome],
  );

  const renameGroup = useCallback(
    (groupId: string, name: string) => {
      if (!workingCopy) return;
      const guard = guardUnlocked(
        workingCopy,
        [groupId],
        "This group is locked and can't be renamed. Unlock it first.",
      );
      if (!guard.ok) {
        setOutlineError(guard.error);
        return;
      }
      applyOutcome(renameGroupOp(workingCopy, groupId, name));
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

  // Task 111 (issue #142): a shape's own visibility/lock toggle -- the
  // per-shape mirror of `toggleGroupVisible`/`toggleGroupLocked` above,
  // now that a shape carries its own flag rather than only inheriting an
  // ancestor's.
  const toggleShapeVisible = useCallback(
    (shapeId: string) => {
      if (!workingCopy) return;
      applyOutcome(toggleShapeFlagOp(workingCopy, shapeId, 'visible'));
    },
    [workingCopy, applyOutcome],
  );

  const toggleShapeLocked = useCallback(
    (shapeId: string) => {
      if (!workingCopy) return;
      applyOutcome(toggleShapeFlagOp(workingCopy, shapeId, 'locked'));
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

  // Issue #127: the Layers panel's pointer drag-and-drop can reorder an
  // item to any position among its siblings, not just one step up/down —
  // but the "one undo step per drop" convention every other outline
  // mutation here follows (see `commit`'s doc comment and
  // `applyOutcome`) means a single drag-drop gesture must still land as
  // exactly one `past` entry, not one per intermediate swap. Rather than
  // duplicating `moveItemOp`'s/`moveLayerOp`'s swap logic to jump straight
  // to an arbitrary index, these two helpers apply the *existing* pure
  // adjacent-swap functions repeatedly against a local candidate scene
  // (never touching React state until the loop finishes), then call
  // `commit()` exactly once with the final result — the same "reuse the
  // existing mutation, don't reimplement it" approach every other Task 24/
  // 76 mutation uses, just sequenced by the caller instead of the scene
  // document. `LayersPanel.tsx` computes `steps` by diffing the dragged
  // item's current sibling-list position against its intended one (see
  // that file's `planReorder`).
  const moveItemBySteps = useCallback(
    (itemId: string, direction: 'up' | 'down', steps: number) => {
      if (!workingCopy || steps <= 0) return;
      let current = workingCopy;
      for (let i = 0; i < steps; i += 1) {
        const outcome = moveItemOp(current, itemId, direction);
        if (!outcome.ok) {
          setOutlineError(outcome.error);
          return;
        }
        current = outcome.scene;
      }
      setOutlineError(null);
      if (current !== workingCopy) commit(current);
    },
    [workingCopy, commit],
  );

  const moveLayerBySteps = useCallback(
    (layerId: string, direction: 'up' | 'down', steps: number) => {
      if (!workingCopy || steps <= 0) return;
      let current = workingCopy;
      for (let i = 0; i < steps; i += 1) {
        const outcome = moveLayerOp(current, layerId, direction);
        if (!outcome.ok) {
          setOutlineError(outcome.error);
          return;
        }
        current = outcome.scene;
      }
      setOutlineError(null);
      if (current !== workingCopy) commit(current);
    },
    [workingCopy, commit],
  );

  // Task 76: reparenting — move a shape/group to a different layer's top
  // level, or into a different group on the same layer (or promote it out
  // to that layer's top level with `targetGroupId: null`). Both route
  // through `applyOutcome` the same way every other outline mutation does,
  // so a rejected move only ever surfaces `outlineError` and a successful
  // one commits exactly one undo step.
  // Task 80 (issue #80): reparenting is guarded in both directions — the
  // item being moved can't be effectively locked at its current location
  // (blocks moving a locked item out), and the destination can't be locked
  // either (blocks moving an unlocked item into a locked layer/group). Both
  // guards route through the shared `guardUnlocked`/`isEffectivelyLocked`
  // pair and report through `outlineError`, the channel every other
  // outline mutation here already uses via `applyOutcome`.
  // `isEffectivelyLocked` also accepts a bare layer id (its own `locked`
  // flag, since a layer has no ancestor to cascade through — see that
  // function's own doc comment), so the destination check below routes
  // through the exact same guard `moveItemToGroup`'s destination check
  // uses just below, rather than a second, separate `layer.locked` read.
  const moveItemToLayer = useCallback(
    (itemId: string, targetLayerId: string) => {
      if (!workingCopy) return;
      setOutlineError(null);
      setOutlineStatus(null);
      const itemGuard = guardUnlocked(
        workingCopy,
        [itemId],
        "This item is on a locked layer or group and can't be moved. Unlock it first.",
      );
      if (!itemGuard.ok) {
        setOutlineError(itemGuard.error);
        return;
      }
      const destGuard = guardUnlocked(
        workingCopy,
        [targetLayerId],
        "That layer is locked and can't receive this item. Unlock it first.",
      );
      if (!destGuard.ok) {
        setOutlineError(destGuard.error);
        return;
      }
      const outcome = moveItemToLayerOp(workingCopy, itemId, targetLayerId);
      if (!outcome.ok) {
        applyOutcome(outcome);
        return;
      }
      if (outcome.scene === workingCopy) {
        setOutlineError(
          'Move to layer had no effect because the item is already at that layer top level.',
        );
        return;
      }
      applyOutcome(outcome);
      const item = getEditableShapes(rawShapes(workingCopy)).find(
        (candidate) => candidate.id === itemId,
      );
      const group = getGroups(workingCopy).find((candidate) => candidate.id === itemId);
      const itemName = item
        ? shapeLabel(item, getEditableShapes(rawShapes(workingCopy)))
        : group
          ? groupDisplayLabel(group, getGroups(workingCopy).indexOf(group))
          : itemId;
      const layer = getLayers(workingCopy).find((candidate) => candidate.id === targetLayerId);
      setOutlineStatus(`Moved ${itemName} to layer ${layer?.name ?? targetLayerId}.`);
    },
    [workingCopy, applyOutcome],
  );

  const moveItemToGroup = useCallback(
    (itemId: string, targetGroupId: string | null) => {
      if (!workingCopy) return;
      setOutlineError(null);
      setOutlineStatus(null);
      const itemGuard = guardUnlocked(
        workingCopy,
        [itemId],
        "This item is on a locked layer or group and can't be moved. Unlock it first.",
      );
      if (!itemGuard.ok) {
        setOutlineError(itemGuard.error);
        return;
      }
      if (targetGroupId !== null) {
        const destGuard = guardUnlocked(
          workingCopy,
          [targetGroupId],
          "That group is locked and can't receive this item. Unlock it first.",
        );
        if (!destGuard.ok) {
          setOutlineError(destGuard.error);
          return;
        }
      }
      const outcome = moveItemToGroupOp(workingCopy, itemId, targetGroupId);
      if (!outcome.ok) {
        applyOutcome(outcome);
        return;
      }
      if (outcome.scene === workingCopy) {
        setOutlineError(
          `Move to group had no effect because the item is already at ${targetGroupId ? 'that group' : 'Top level'}.`,
        );
        return;
      }
      applyOutcome(outcome);
      const item = getEditableShapes(rawShapes(workingCopy)).find(
        (candidate) => candidate.id === itemId,
      );
      const group = getGroups(workingCopy).find((candidate) => candidate.id === itemId);
      const itemName = item
        ? shapeLabel(item, getEditableShapes(rawShapes(workingCopy)))
        : group
          ? groupDisplayLabel(group, getGroups(workingCopy).indexOf(group))
          : itemId;
      const targetName = targetGroupId
        ? (getGroups(workingCopy).find((candidate) => candidate.id === targetGroupId)?.name ??
          targetGroupId)
        : 'Top level';
      setOutlineStatus(`Moved ${itemName} to ${targetName}.`);
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
    const guard = guardUnlocked(
      workingCopy,
      multiSelectedIds,
      "One of the selected items is on a locked layer or group and can't be grouped. Unlock it first.",
    );
    if (!guard.ok) {
      setOutlineError(guard.error);
      return;
    }
    const outcome = groupItems(workingCopy, multiSelectedIds);
    applyOutcome(outcome);
    if (outcome.ok) setMultiSelectedIds([]);
  }, [workingCopy, multiSelectedIds, applyOutcome]);

  const ungroupSelected = useCallback(() => {
    if (!workingCopy || !selectedShapeId) return;
    if (!getGroups(workingCopy).some((g) => g.id === selectedShapeId)) return;
    const guard = guardUnlocked(
      workingCopy,
      [selectedShapeId],
      "This group is on a locked layer or is itself locked, and can't be ungrouped. Unlock it first.",
    );
    if (!guard.ok) {
      setOutlineError(guard.error);
      return;
    }
    const outcome = ungroupItem(workingCopy, selectedShapeId);
    applyOutcome(outcome);
    if (outcome.ok) setSelectedShapeId(null);
  }, [workingCopy, selectedShapeId, applyOutcome]);

  // Issue #131: generalized to take an explicit group `id`, defaulting to
  // the current selection — same rationale as `deleteSelected` above, for
  // LayersPanel's per-row delete button on a group row.
  const deleteGroupSelected = useCallback(
    (id?: string) => {
      const targetId = id ?? selectedShapeId;
      if (!workingCopy || !targetId) return;
      if (!getGroups(workingCopy).some((g) => g.id === targetId)) return;
      const guard = guardUnlocked(
        workingCopy,
        [targetId],
        "This group is on a locked layer or is itself locked, and can't be deleted. Unlock it first.",
      );
      if (!guard.ok) {
        setOutlineError(guard.error);
        return;
      }
      const outcome = deleteGroupRecursive(workingCopy, targetId);
      applyOutcome(outcome);
      if (outcome.ok && targetId === selectedShapeId) setSelectedShapeId(null);
    },
    [workingCopy, selectedShapeId, applyOutcome],
  );

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

  // --- Task 36: the advanced graph editor ---
  // Every action here goes through `graphEditing.ts`'s pure functions,
  // which validate the *entire* candidate scene with `validateBehaviorGraph`
  // before ever returning `ok: true` — so exactly like `applyOutcome`
  // above, a rejected mutation only ever sets `graphError` and never
  // touches `workingCopy`/`commit`. `GraphView.tsx` (drag-and-drop) and
  // `GraphListView.tsx` (keyboard-operable list) both call these same six
  // functions, so they can only ever produce the same graphs.

  const applyGraphOutcome = useCallback(
    (outcome: { ok: true; scene: SceneDocument } | { ok: false; error: string }) => {
      if (!outcome.ok) {
        setGraphError(outcome.error);
        return;
      }
      setGraphError(null);
      if (workingCopy && outcome.scene !== workingCopy) commit(outcome.scene);
    },
    [workingCopy, commit],
  );

  const addGraphNode = useCallback(
    (type: string, position: { x: number; y: number }) => {
      if (!workingCopy) return;
      const outcome = addGraphNodeOp(workingCopy, type, position);
      applyGraphOutcome(outcome);
      return outcome.ok ? outcome.nodeId : undefined;
    },
    [workingCopy, applyGraphOutcome],
  );

  const removeGraphNode = useCallback(
    (nodeId: string) => {
      if (!workingCopy) return;
      applyGraphOutcome(removeGraphNodeOp(workingCopy, nodeId));
    },
    [workingCopy, applyGraphOutcome],
  );

  const addGraphConnection = useCallback(
    (candidate: { fromNodeId: string; fromPort: string; toNodeId: string; toPort: string }) => {
      if (!workingCopy) return;
      applyGraphOutcome(addGraphConnectionOp(workingCopy, candidate));
    },
    [workingCopy, applyGraphOutcome],
  );

  const removeGraphConnection = useCallback(
    (connectionId: string) => {
      if (!workingCopy) return;
      applyGraphOutcome(removeGraphConnectionOp(workingCopy, connectionId));
    },
    [workingCopy, applyGraphOutcome],
  );

  const moveGraphNode = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      if (!workingCopy) return;
      applyGraphOutcome(moveGraphNodeOp(workingCopy, nodeId, position));
    },
    [workingCopy, applyGraphOutcome],
  );

  const updateGraphNodeParams = useCallback(
    (nodeId: string, params: Record<string, unknown>) => {
      if (!workingCopy) return;
      applyGraphOutcome(updateGraphNodeParamsOp(workingCopy, nodeId, params));
    },
    [workingCopy, applyGraphOutcome],
  );

  const clearGraphError = useCallback(() => setGraphError(null), []);

  return {
    // Task 40: exposed so read-only presentational components (e.g.
    // `RandomnessIndicator.tsx`) can read scene-level fields
    // (`randomness`, `graph`) without this hook growing a bespoke derived
    // field for every such component.
    workingCopy,
    shapes,
    selectedShapeId,
    selectedLayerId,
    isLayerSelection,
    selectedShape,
    selectShape,
    selectLayer,
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
    // Issue #77
    multiSelectedShapes,
    updateMultiSelectedTransform,
    // Task 80 (issue #80): the shared lock guard's own error channel, plus
    // the wrapper EditorWorkspace.tsx calls to gate pointer-gesture
    // initiation (single-shape and group move/resize/rotate, and
    // vertex-handle drag) before a drag starts.
    lockError,
    checkUnlocked,
    // Task 60 (issue #58)
    updateSelectedShapeNumericField,
    updateSelectedShapeColorField,
    // Task 138 (issue #170)
    updateCanvasBackgroundColor,
    updateCanvasOpacity,
    // Issue #79
    vertexEditActive,
    toggleVertexEditMode,
    exitVertexEditMode,
    selectedVertexIndex,
    selectVertex,
    vertexError,
    insertVertexAtPoint,
    addVertexNearLast,
    deleteVertexAt,
    updateVertexPointField,
    // Task 24
    layers,
    groups,
    selectedGroup,
    outline,
    selectedBreadcrumb,
    multiSelectedIds,
    toggleMultiSelect,
    clearMultiSelect,
    outlineError,
    outlineStatus,
    addLayer,
    renameLayer,
    renameShape,
    renameGroup,
    deleteLayer,
    moveLayer,
    toggleLayerVisible,
    toggleLayerLocked,
    toggleGroupVisible,
    toggleGroupLocked,
    toggleShapeVisible,
    toggleShapeLocked,
    moveItem,
    moveItemBySteps,
    moveLayerBySteps,
    moveItemToLayer,
    moveItemToGroup,
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
    // Task 36
    graphNodes,
    graphConnections,
    graphError,
    addGraphNode,
    removeGraphNode,
    addGraphConnection,
    removeGraphConnection,
    moveGraphNode,
    updateGraphNodeParams,
    clearGraphError,
    // Task 142 (issue #174): the Code tab's HTML/CSS sub-tab save handler
    // needs to apply a whole-scene replacement (parsed from hand-edited
    // HTML+CSS) as exactly one undo/redo step, the same guarantee every
    // other mutation above already gets via `commit()` -- exposed under
    // a more self-descriptive name than the internal `commit` since it's
    // now part of this hook's public surface.
    commitScene: commit,
  };
}

export type SceneEditor = ReturnType<typeof useSceneEditor>;
