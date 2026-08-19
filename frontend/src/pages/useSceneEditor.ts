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
  deleteGroupRecursive,
  deleteLayer as deleteLayerOp,
  getGroups,
  getLayers,
  groupItems,
  moveItem as moveItemOp,
  moveItemToGroup as moveItemToGroupOp,
  moveItemToLayer as moveItemToLayerOp,
  moveLayer as moveLayerOp,
  removeShapeFromScene,
  renameLayer as renameLayerOp,
  toggleGroupFlag,
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
    setVertexError(null);
    setSelectedVertexIndex(null);
    setVertexEditShapeId((current) => {
      if (current !== null) return null;
      return selectedShape && selectedShape.type === 'path' ? selectedShape.id : null;
    });
  }, [selectedShape]);

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

  const insertVertexAtPoint = useCallback(
    (pointer: Point) => {
      if (!selectedShape || selectedShape.type !== 'path') return;
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
    [selectedShape, commitPathShapeReplacement],
  );

  const addVertexNearLast = useCallback(() => {
    if (!selectedShape || selectedShape.type !== 'path') return;
    const result = appendPathPointNearLast(selectedShape);
    if (!result.ok) {
      setVertexError(result.error);
      return;
    }
    setVertexError(null);
    setSelectedVertexIndex(null);
    commitPathShapeReplacement(result.shape);
  }, [selectedShape, commitPathShapeReplacement]);

  const deleteVertexAt = useCallback(
    (index: number) => {
      if (!selectedShape || selectedShape.type !== 'path') return;
      const result = deletePathPoint(selectedShape, index);
      if (!result.ok) {
        setVertexError(result.error);
        return;
      }
      setVertexError(null);
      setSelectedVertexIndex(null);
      commitPathShapeReplacement(result.shape);
    },
    [selectedShape, commitPathShapeReplacement],
  );

  // The keyboard point-coordinate list's per-axis numeric field — same
  // "parse, then clamp a finite value into the schema's point range,
  // reject anything else" policy `shapeStyleFields.ts`'s
  // `parseNumericFieldEdit` documents for the position/scale/rotation
  // fields it already covers, applied here to an individual point instead
  // of the whole shape's transform.
  const updateVertexPointField = useCallback(
    (index: number, axis: 'x' | 'y', raw: string): { ok: true } | { ok: false; error: string } => {
      if (!selectedShape || selectedShape.type !== 'path') {
        return { ok: false, error: 'No path shape selected.' };
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
    [selectedShape, commitPathShapeReplacement],
  );

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

  // Task 76: reparenting — move a shape/group to a different layer's top
  // level, or into a different group on the same layer (or promote it out
  // to that layer's top level with `targetGroupId: null`). Both route
  // through `applyOutcome` the same way every other outline mutation does,
  // so a rejected move only ever surfaces `outlineError` and a successful
  // one commits exactly one undo step.
  const moveItemToLayer = useCallback(
    (itemId: string, targetLayerId: string) => {
      if (!workingCopy) return;
      applyOutcome(moveItemToLayerOp(workingCopy, itemId, targetLayerId));
    },
    [workingCopy, applyOutcome],
  );

  const moveItemToGroup = useCallback(
    (itemId: string, targetGroupId: string | null) => {
      if (!workingCopy) return;
      applyOutcome(moveItemToGroupOp(workingCopy, itemId, targetGroupId));
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
    // Issue #77
    multiSelectedShapes,
    updateMultiSelectedTransform,
    // Task 60 (issue #58)
    updateSelectedShapeNumericField,
    updateSelectedShapeColorField,
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
  };
}

export type SceneEditor = ReturnType<typeof useSceneEditor>;
