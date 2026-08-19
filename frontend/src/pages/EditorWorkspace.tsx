import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import type { SceneDocument } from '../api/projects';
import CameraControl from '../components/CameraControl';
import EditorPanelSwitcher, { type EditorPanelName } from '../components/EditorPanelSwitcher';
import { createP5ScenePreview, type P5ScenePreview } from '../render/p5Adapter';
import {
  applyGroupDrag,
  applyMoveSnap,
  applyResizeSnap,
  applyShapeDrag,
  applyVertexDrag,
  clientToCanvasPoint,
  getCombinedBounds,
  getGroupHandles,
  getPathPointHandles,
  getShapeHandles,
  GRID_SIZE,
  hitTestTopmostShapeAt,
  shapeBounds,
  shapeLabel,
  type AlignmentGuide,
  type Bounds,
  type HandleKind,
  type PathShape,
  type Point,
  type Shape,
  type ShapeType,
} from './sceneShapes';
import { useAlertDialogFocus } from '../a11y/useAlertDialogFocus';
import { useSnapSettings } from '../editor/snapSettings';
import { isEffectivelyLocked } from './sceneOutline';
import SnapPreferenceControl from './SnapPreferenceControl';
import { useBeforeUnloadGuard } from './useBeforeUnloadGuard';
import { useDraftAutosave } from './useDraftAutosave';
import { useDraftRecovery } from './useDraftRecovery';
import { useDraftServerSync } from './useDraftServerSync';
import { useEditorWorkspaceState } from './useEditorWorkspaceState';
import { useIsNarrowViewport } from './useIsNarrowViewport';
import { useSceneEditor } from './useSceneEditor';
import AIProposalPanel from './AIProposalPanel';
import BehaviorCardsPanel from './BehaviorCardsPanel';
import DemoControlsPanel from './DemoControlsPanel';
import DraftRecoveryPrompt from './DraftRecoveryPrompt';
import ExportConfigDialog from './ExportConfigDialog';
import GraphListView from './GraphListView';
import GraphView from './GraphView';
import RandomnessIndicator from './RandomnessIndicator';
import SceneOutlinePanel from './SceneOutlinePanel';
import ShapeInspectorPanel from './ShapeInspectorPanel';
import VersionHistoryPanel from './VersionHistoryPanel';

const SHAPE_TYPES: Array<{ type: ShapeType; label: string }> = [
  { type: 'circle', label: 'Add circle' },
  { type: 'rect', label: 'Add rectangle' },
  { type: 'line', label: 'Add line' },
  { type: 'path', label: 'Add polygon' },
];

/**
 * Task 64 (issue #64): the "Exit without saving" confirmation, as its own
 * component so `useAlertDialogFocus` (focus-into-dialog on open, Escape
 * dismisses, focus returns to the trigger on close) runs for exactly this
 * dialog's own mount/unmount lifecycle — see that hook's doc comment.
 */
function ExitWithoutSavingConfirm({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { dialogRef, onKeyDown } = useAlertDialogFocus<HTMLDivElement>(onCancel);
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      role="alertdialog"
      aria-labelledby="exit-without-saving-confirm-title"
      className="exit-without-saving-confirm"
    >
      <h3 id="exit-without-saving-confirm-title">Exit without saving?</h3>
      <p>
        Any unsaved changes will stay out of version history. Your local recovery draft for this
        project will also be cleared.
      </p>
      <button type="button" onClick={onConfirm}>
        Exit without saving
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

/**
 * Task 21: the three-panel editor workspace shell. Loads the project and
 * its current scene version into a working copy on mount, then renders
 * three landmark regions (Tools, Preview, Inspector) side by side at
 * >=1024px, or one at a time behind a keyboard-operable switcher below
 * that.
 *
 * Task 23 adds shape add/select/duplicate/delete on top of that shell, via
 * `useSceneEditor` (state) and `sceneShapes` (data helpers): the Tools
 * panel gets add/duplicate/delete/undo/redo controls plus a keyboard-
 * operable shape list, and the Preview panel gets a placeholder canvas
 * surface shapes can be pointer-clicked on to select (real p5.js rendering
 * is Task 25; transform handles are Task 26; style editing is Task 60).
 *
 * Task 26 adds pointer-based move/resize/rotate handles for the single
 * selected shape, as a DOM overlay on top of the p5 canvas (never inside
 * `p5Adapter.ts` — see that file's own comment on why). A drag is tracked
 * in `dragRef` (not React state, since it doesn't need re-renders itself —
 * the live shape mutation it drives, via `sceneEditor.updateSelectedTransform`,
 * already re-renders through `workingCopy`) and driven by `window`-level
 * pointermove/pointerup/keydown listeners, registered once per gesture in
 * `beginDrag`, so the drag keeps tracking the pointer even outside the
 * canvas element's own bounds and Escape can cancel it from anywhere.
 */
function EditorWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    loadState,
    project,
    persistedVersion,
    workingCopy,
    setWorkingCopy,
    setProject,
    setPersistedVersion,
    retry,
  } = useEditorWorkspaceState(id);
  const isNarrow = useIsNarrowViewport();
  const [activePanel, setActivePanel] = useState<EditorPanelName>('preview');
  // Task 36: "Show logic" reveals behavior cards as typed connected nodes
  // (`_docs/plan.md`'s "Progressive disclosure" section) — the advanced
  // graph view/list-view pair, hidden by default so the default editing
  // experience stays "composing an animation recipe."
  const [showLogic, setShowLogic] = useState(false);
  const sceneEditor = useSceneEditor(workingCopy, setWorkingCopy);
  // Issue #78: the client-only snap-to-grid / alignment-guide preference —
  // see `../editor/snapSettings.ts`'s own doc comment for why this is a
  // plain external store rather than scene state.
  const snapSettings = useSnapSettings();
  // The alignment guide(s) currently in effect for an in-progress single-
  // shape move gesture, or nulls when nothing is being dragged/snapped —
  // drives the guide-line overlay below. Cleared on every gesture end
  // (commit or cancel) and whenever a non-move gesture starts, so no stale
  // guide line is ever left rendered after pointerup (acceptance
  // criterion).
  const [activeGuides, setActiveGuides] = useState<{
    x: AlignmentGuide | null;
    y: AlignmentGuide | null;
  }>({ x: null, y: null });

  // Task 41: the working/saved distinction, both visual (the status text
  // rendered below) and programmatic (this boolean, which also gates the
  // Save button in VersionHistoryPanel). A scene with no persisted
  // version at all (shouldn't happen once loadState is 'ready' — Task 18
  // always creates a first version) is treated as dirty rather than
  // silently "saved."
  const isDirty = useMemo(
    () =>
      persistedVersion == null ||
      JSON.stringify(workingCopy) !== JSON.stringify(persistedVersion.scene_json),
    [workingCopy, persistedVersion],
  );

  // Task 44: native beforeunload safeguard — registered only while
  // `isDirty` is true, removed the instant it goes false (successful
  // save, discard, or nothing unsaved to begin with). See
  // `useBeforeUnloadGuard.ts` for why it never sets custom wording.
  useBeforeUnloadGuard(isDirty);

  // Task 44: checks for a valid active draft (local IndexedDB + server,
  // reconciled) for this project BEFORE the interactive editor panels
  // render — see `useDraftRecovery.ts`. `persistedVersion?.scene_json` is
  // the baseline the recovery prompt's change summary is computed against
  // when a server draft (which carries no summary of its own) wins the
  // reconciliation.
  const persistedSceneJson = (persistedVersion?.scene_json as SceneDocument | undefined) ?? null;
  const draftRecovery = useDraftRecovery(id, loadState === 'ready', persistedSceneJson);

  // Task 42/43 must not be allowed to autosave (locally or to the server)
  // while a draft is still only a *candidate* awaiting the user's
  // Recover/Discard/Cancel choice above — an unrelated "no changes since
  // last save" write landing mid-prompt would silently replace the exact
  // draft being offered for recovery. So neither hook below ever sees a
  // real `workingCopy` until `draftRecovery.status` has left
  // `'checking'`/`'prompt'` (see `useDraftRecovery.ts`'s own comment on
  // this same point) — `useDraftAutosave`/`useDraftServerSync` both
  // already no-op on a null working copy, so this is enough to fully gate
  // them.
  const draftGateOpen = draftRecovery.status === 'none' || draftRecovery.status === 'resolved';
  const gatedWorkingCopy = draftGateOpen ? workingCopy : null;

  // Task 42: debounced browser-local crash-recovery draft, autosaved into
  // IndexedDB from the same `workingCopy` change stream `isDirty` above
  // already watches. `clearDraft()` is called from exactly the two places
  // `_docs/plan.md` specifies: after a successful explicit Save (below),
  // and after a confirmed Exit-without-saving (the confirm dialog further
  // down) — never automatically, and never on cancel.
  const draftAutosave = useDraftAutosave(id, gatedWorkingCopy, persistedVersion);

  // Task 43: syncs the same working copy to the authorized server draft
  // endpoint every 20-30s while editing, after defined meaningful actions,
  // and once (bounded, fire-and-forget) on page hide — see
  // `useDraftServerSync.ts` for the full policy. Never reads a server
  // draft back into the editor on its own (that's Task 44's
  // `useDraftRecovery.ts`, above).
  const draftServerSync = useDraftServerSync(id, gatedWorkingCopy);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  async function handleConfirmExit() {
    await draftAutosave.clearDraft();
    void draftServerSync.deleteServerDraft();
    setShowExitConfirm(false);
    navigate('/');
  }

  // Task 44: "Recover draft" loads the reconciled draft's scene as the new
  // *unsaved* working copy — `setWorkingCopy` never touches `project` or
  // `persistedVersion`, so the saved current version stays completely
  // untouched; `isDirty` above immediately reflects the recovered content
  // differing from `persistedVersion.scene_json`.
  function handleRecoverDraft() {
    const scene = draftRecovery.recover();
    if (scene) setWorkingCopy(scene);
  }

  // Task 44: "Discard draft" clears BOTH the local and server draft
  // (`useDraftRecovery.discard`'s `Promise.all`) and only then resolves —
  // the editor only ever opens at the last saved version once both
  // deletions have actually settled, so there's no window where a user
  // could discard and still see the stale draft recovered later.
  async function handleDiscardDraft() {
    await draftRecovery.discard();
  }

  // Task 44: "Cancel" returns to the project gallery without touching
  // either draft or the saved version — nothing here calls `recover()`,
  // `discard()`, or any save/restore endpoint, so the draft stays exactly
  // as recoverable as it was before this prompt was shown.
  function handleCancelDraftPrompt() {
    navigate('/');
  }

  const canvasRef = useRef<HTMLDivElement>(null);
  const previewMountRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<P5ScenePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Task 26: "latest value" refs so the window-level drag listeners below
  // (created once, lazily, and reused for the lifetime of the component —
  // see `dragHandlers`) always act against the current scene editor and
  // canvas size, not whichever render happened to be active when a given
  // drag gesture began.
  const sceneEditorRef = useRef(sceneEditor);
  sceneEditorRef.current = sceneEditor;
  const canvasSizeRef = useRef({ width: 800, height: 600 });
  // Issue #78: same "latest value" pattern as `sceneEditorRef` above, so
  // the window-level drag listeners always read whichever snap preference
  // is current *right now* rather than whatever it was when the gesture
  // began. This is also exactly how "toggling mid-gesture" is decided: a
  // gesture already in progress simply picks up the new setting on its
  // very next pointermove frame — the acceptance criterion explicitly
  // allows either behavior here, and this is the simplest one to build.
  const snapSettingsRef = useRef(snapSettings);
  snapSettingsRef.current = snapSettings;
  // In-progress drag gesture, or null when nothing is being dragged. Not
  // React state: updating it never needs to trigger a re-render itself —
  // the live shape mutation each pointermove performs (via
  // `sceneEditor.updateSelectedTransform`) already re-renders the
  // component through `workingCopy` changing.
  // Issue #77: a drag gesture is either the Task 26 single-shape kind
  // (`mode: 'single'`) or, when it started on a member of a 2+-item
  // `multiSelectedIds` selection, a group gesture (`mode: 'group'`) that
  // carries a snapshot of every selected shape plus their combined
  // bounding box, both fixed at gesture start (see `sceneShapes.ts`'s
  // `applyGroupDrag` doc comment on why fixed-snapshot recomputation is
  // used instead of accumulating a delta frame over frame).
  // Issue #79: a third gesture kind, `mode: 'vertex'` — dragging one point
  // of a single selected `path` shape while vertex edit mode is active.
  // Deliberately carries no `kind: HandleKind` (there's no move/resize/
  // rotate distinction for a single point) and, like the single/group
  // modes above, snapshots its `startShape` once at gesture start so a
  // long drag stays numerically stable and Escape-to-cancel is trivial
  // (see `applyShapeDrag`'s own doc comment in sceneShapes.ts).
  type DragState =
    | { mode: 'single'; kind: HandleKind; startShape: Shape; startPointer: Point }
    | {
        mode: 'group';
        kind: HandleKind;
        startShapes: Shape[];
        bounds: Bounds;
        startPointer: Point;
      }
    | { mode: 'vertex'; startShape: PathShape; pointIndex: number; startPointer: Point };
  const dragRef = useRef<DragState | null>(null);
  // Lazily built once (see the `if` below) and reused for every gesture,
  // so `window.addEventListener`/`removeEventListener` always agree on the
  // exact same function identity — including the unmount cleanup effect
  // further down, which must be able to remove listeners left behind by a
  // gesture still in progress when the workspace unmounts.
  const dragHandlers = useRef<{
    onMove: (event: PointerEvent) => void;
    onUp: (event: PointerEvent) => void;
    onKey: (event: KeyboardEvent) => void;
  } | null>(null);
  if (!dragHandlers.current) {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { width, height } = canvasSizeRef.current;
      const pointer = clientToCanvasPoint(rect, event.clientX, event.clientY, width, height);
      if (drag.mode === 'group') {
        const updated = applyGroupDrag(
          drag.kind,
          drag.startShapes,
          drag.bounds,
          drag.startPointer,
          pointer,
        );
        sceneEditorRef.current.updateMultiSelectedTransform(updated);
        return;
      }
      if (drag.mode === 'vertex') {
        // Issue #79: single-vertex drag is deliberately unsnapped — no
        // `applyMoveSnap`/`applyResizeSnap` call here, matching this
        // task's own "Out of scope" (snapping stays whole-shape-only,
        // issue #78).
        const updated = applyVertexDrag(drag.startShape, drag.pointIndex, pointer);
        sceneEditorRef.current.updateSelectedTransform(updated);
        return;
      }
      const updated = applyShapeDrag(drag.kind, drag.startShape, drag.startPointer, pointer);
      const snap = snapSettingsRef.current;
      // Issue #78: snapping only applies to the single-shape gesture path
      // (already guaranteed here — `drag.mode === 'group'` returned above)
      // and only to move/box-resize, never rotate (no grid/alignment
      // analogue for rotation exists in this task's scope).
      if (drag.kind === 'move' && (snap.gridEnabled || snap.guidesEnabled)) {
        const siblingBounds = sceneEditorRef.current.shapes
          .filter((s) => s.id !== drag.startShape.id)
          .map((s) => shapeBounds(s));
        const result = applyMoveSnap(updated, siblingBounds, {
          gridEnabled: snap.gridEnabled,
          guidesEnabled: snap.guidesEnabled,
        });
        setActiveGuides(result.guides);
        sceneEditorRef.current.updateSelectedTransform(result.shape);
        return;
      }
      if (drag.kind === 'resize' && snap.gridEnabled) {
        const snapped = applyResizeSnap(drag.startShape, drag.startPointer, updated, {
          gridEnabled: true,
        });
        sceneEditorRef.current.updateSelectedTransform(snapped);
        return;
      }
      sceneEditorRef.current.updateSelectedTransform(updated);
    };
    const onUp = (event: PointerEvent) => {
      if (!dragRef.current) return;
      event.preventDefault();
      stopDragListening();
      dragRef.current = null;
      setActiveGuides({ x: null, y: null });
      sceneEditorRef.current.commitTransform();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !dragRef.current) return;
      event.preventDefault();
      stopDragListening();
      dragRef.current = null;
      setActiveGuides({ x: null, y: null });
      sceneEditorRef.current.cancelTransform();
    };
    function stopDragListening() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    }
    dragHandlers.current = { onMove, onUp, onKey };
  }

  // Removes any drag listeners still attached if the workspace unmounts
  // mid-gesture (e.g. navigating away while dragging).
  useEffect(() => {
    return () => {
      const handlers = dragHandlers.current;
      if (!handlers) return;
      window.removeEventListener('pointermove', handlers.onMove);
      window.removeEventListener('pointerup', handlers.onUp);
      window.removeEventListener('keydown', handlers.onKey);
    };
  }, []);

  // Task 25: mounts a p5.js instance (instance mode, never global) into a
  // dedicated child div that React never re-renders into — see the div's
  // own comment below for why. Created once per workspace mount, torn
  // down on unmount.
  useEffect(() => {
    if (!previewMountRef.current) return;
    const preview = createP5ScenePreview(previewMountRef.current);
    previewRef.current = preview;
    return () => {
      preview.destroy();
      previewRef.current = null;
    };
  }, []);

  // Re-renders the p5 preview whenever the working copy changes. A scene
  // that fails the adapter's validation (see p5Adapter.ts/sceneDrawPlan.ts)
  // throws before any draw call rather than drawing something wrong or
  // stale; that's surfaced here instead of crashing the workspace.
  useEffect(() => {
    if (!previewRef.current || !workingCopy) return;
    try {
      previewRef.current.render(workingCopy);
      setPreviewError(null);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Could not render this scene.');
    }
  }, [workingCopy]);

  // Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes — the standard
  // shortcuts for this editor's in-session undo/redo policy (see
  // useSceneEditor.ts for the full policy writeup). Ignored while typing in
  // a text field so it doesn't fight the browser's own undo there.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && event.shiftKey) {
        event.preventDefault();
        sceneEditor.redo();
      } else if (key === 'z') {
        event.preventDefault();
        sceneEditor.undo();
      } else if (key === 'y') {
        event.preventDefault();
        sceneEditor.redo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sceneEditor]);

  // Issue #79: vertex edit mode's two keyboard affordances that aren't
  // already covered by the generic drag-cancel/undo-redo listeners above:
  // Escape exits the mode outright when no point drag is in progress
  // (`dragRef.current` is null — a drag in progress is instead cancelled
  // by `dragHandlers.current.onKey` above, which restores the pre-drag
  // point and creates no undo step, matching Task 26's own drag-cancel
  // exactly), and Delete/Backspace removes the currently selected vertex.
  // Both are no-ops while vertex edit mode isn't active, and both ignore
  // a typing target so they never fight a text field (matching
  // `isTypingTarget`'s use in the undo/redo listener above).
  //
  // This listener is only added/removed when `vertexEditActive` itself
  // flips (not on every render — reading `sceneEditorRef.current` inside
  // the handler, the same "latest value" ref pattern `dragHandlers.current`
  // uses above, keeps it current without that). This matters for
  // correctness, not just performance: if this listener were torn down and
  // re-added on every render (e.g. depending on the whole `sceneEditor`
  // object, which is a new reference every render), it would always end up
  // registered *after* `dragHandlers.current.onKey` by the time a drag is
  // mid-gesture (each pointermove re-renders and would re-register it) —
  // so on Escape, the drag-cancel listener would run first, null out
  // `dragRef.current`, and this listener would then wrongly see "no drag in
  // progress" and exit vertex edit mode entirely instead of just cancelling
  // the drag. Registering this listener once per mode-activation, ahead of
  // `dragHandlers.current.onKey` (which is only ever added later, at
  // pointerdown), keeps the ordering — and the `dragRef.current` check —
  // reliable.
  useEffect(() => {
    if (!sceneEditor.vertexEditActive) return;
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      const editor = sceneEditorRef.current;
      if (event.key === 'Escape') {
        if (dragRef.current) return; // handled by the drag-cancel listener instead
        event.preventDefault();
        editor.exitVertexEditMode();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (editor.selectedVertexIndex === null) return;
        event.preventDefault();
        editor.deleteVertexAt(editor.selectedVertexIndex);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sceneEditor.vertexEditActive]);

  if (loadState === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading editor…
      </p>
    );
  }

  if (loadState === 'access-denied') {
    return (
      <div>
        <p role="alert" aria-live="assertive">
          You don't have access to this project.
        </p>
        <p>
          <Link to="/">Back to your projects</Link>
        </p>
      </div>
    );
  }

  if (loadState === 'no-scene') {
    return (
      <div>
        <p role="alert" aria-live="assertive">
          This project has no valid scene to load.
        </p>
        <p>
          <Link to="/">Back to your projects</Link>
        </p>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div>
        <p role="alert" aria-live="assertive">
          Something went wrong loading this project. Please try again.
        </p>
        <button type="button" onClick={() => retry()}>
          Retry
        </button>
      </div>
    );
  }

  // Task 44: the project and its persisted version have loaded, but the
  // recovery check (local + server draft, reconciled) hasn't resolved
  // yet — the interactive editor must not render until it has, so a
  // reopened project with a valid draft never flashes the persisted
  // version before the recovery prompt appears.
  if (draftRecovery.status === 'checking') {
    return (
      <p role="status" aria-live="polite">
        Checking for recovered work…
      </p>
    );
  }

  if (draftRecovery.status === 'prompt' && draftRecovery.candidate) {
    return (
      <DraftRecoveryPrompt
        candidate={draftRecovery.candidate}
        onRecover={handleRecoverDraft}
        onDiscard={handleDiscardDraft}
        onCancel={handleCancelDraftPrompt}
      />
    );
  }

  const shapeCount = Array.isArray(workingCopy?.shapes) ? workingCopy.shapes.length : 0;
  const canvas = (workingCopy?.canvas as { width?: number; height?: number } | undefined) ?? {
    width: 800,
    height: 600,
  };
  const canvasWidth = canvas.width ?? 800;
  const canvasHeight = canvas.height ?? 600;
  canvasSizeRef.current = { width: canvasWidth, height: canvasHeight };

  // Issue #78: the visible grid-line overlay's coordinates, at the fixed
  // 20-scene-unit spacing — only computed when grid snapping is on (the
  // "when disabled, no grid overlay renders" acceptance criterion).
  const gridLinesX: number[] = [];
  const gridLinesY: number[] = [];
  if (snapSettings.gridEnabled) {
    for (let x = 0; x <= canvasWidth; x += GRID_SIZE) gridLinesX.push(x);
    for (let y = 0; y <= canvasHeight; y += GRID_SIZE) gridLinesY.push(y);
  }

  function panelHidden(panel: EditorPanelName): boolean {
    return isNarrow && activePanel !== panel;
  }

  // Shared by every pointer-to-scene conversion below (click-to-select,
  // drag start, and handle drag start) so they all agree on the same
  // canvas-local point for a given client position — including when the
  // canvas element is CSS-scaled smaller than its logical `canvasWidth`/
  // `canvasHeight` (see `clientToCanvasPoint`'s own comment).
  function canvasPointFromClient(clientX: number, clientY: number): Point | null {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return clientToCanvasPoint(rect, clientX, clientY, canvasWidth, canvasHeight);
  }

  function handleCanvasClick(event: ReactMouseEvent<HTMLDivElement>) {
    const pointer = canvasPointFromClient(event.clientX, event.clientY);
    if (!pointer) return;
    const hit = hitTestTopmostShapeAt(sceneEditor.shapes, pointer.x, pointer.y);
    sceneEditor.selectShape(hit ? hit.id : null);
  }

  // Starts a Task 26 (single-shape) or issue #77 (group) move/resize/
  // rotate gesture: snapshots the pre-gesture scene and registers the
  // window-level listeners `dragHandlers` built once above.
  function beginTransformGesture(next: DragState) {
    const handlers = dragHandlers.current;
    if (!handlers) return;
    dragRef.current = next;
    sceneEditor.beginTransform();
    window.addEventListener('pointermove', handlers.onMove);
    window.addEventListener('pointerup', handlers.onUp);
    window.addEventListener('keydown', handlers.onKey);
  }

  // Issue #77: the shapes/bounds a group gesture would act on right now,
  // derived fresh every render from `multiSelectedIds` — `null` below the
  // 2-item threshold, which is exactly when the canvas must fall back to
  // Task 26's single-shape handles/gesture untouched (see the render
  // below and the acceptance criteria's "0 or 1 ... behaves exactly as it
  // does today").
  const groupSelection =
    sceneEditor.multiSelectedShapes.length >= 2 ? sceneEditor.multiSelectedShapes : null;
  const groupBounds = groupSelection ? getCombinedBounds(groupSelection) : null;
  // Task 80 (issue #80): "no handles at all" for an effectively-locked
  // shape/selection (see this issue's "Handle visibility" acceptance
  // criterion) — precomputed here so both the render below and the
  // pointer-down guards (which fire before `beginTransformGesture`, so the
  // whole gesture never starts rather than being rejected mid-drag) agree
  // on the same lock state. A multi-shape group selection is locked as a
  // whole if *any* member is effectively locked, matching issue #77's
  // "whole gesture" semantics.
  const isSelectedShapeLocked =
    !!sceneEditor.selectedShape &&
    !!sceneEditor.workingCopy &&
    isEffectivelyLocked(sceneEditor.workingCopy, sceneEditor.selectedShape.id);
  const isGroupSelectionLocked =
    !!groupSelection &&
    !!sceneEditor.workingCopy &&
    groupSelection.some((s) => isEffectivelyLocked(sceneEditor.workingCopy!, s.id));

  // Dragging a shape's body is the "move" gesture (per the acceptance
  // criteria: "dragging the shape body or its move handle"). If the hit
  // shape is a member of the current 2+-item multi-selection, this starts
  // a *group* gesture over the whole resolved selection instead of a
  // single-shape one. Otherwise it behaves exactly as it always has:
  // starting on a shape other than the current selection selects it
  // first (matching `handleCanvasClick`'s own click-to-select) and
  // manipulates just that one shape, never touching `multiSelectedIds`.
  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const pointer = canvasPointFromClient(event.clientX, event.clientY);
    if (!pointer) return;
    const hit = hitTestTopmostShapeAt(sceneEditor.shapes, pointer.x, pointer.y);
    if (!hit) return; // no shape body under the pointer: nothing to drag
    if (groupSelection && groupBounds && groupSelection.some((s) => s.id === hit.id)) {
      // Task 80 (issue #80): the guard runs before the gesture starts — a
      // locked member blocks the whole group gesture, not just its own
      // movement (issue #77's "whole gesture" semantics extended to locks).
      if (
        !sceneEditor.checkUnlocked(
          groupSelection.map((s) => s.id),
          "One or more selected shapes are on a locked layer or group and can't be moved. Unlock them first.",
        )
      ) {
        return;
      }
      beginTransformGesture({
        mode: 'group',
        kind: 'move',
        startShapes: groupSelection,
        bounds: groupBounds,
        startPointer: pointer,
      });
      return;
    }
    if (hit.id !== sceneEditor.selectedShapeId) {
      sceneEditor.selectShape(hit.id);
    }
    // Task 80 (issue #80): clicking/dragging a locked shape's body still
    // selects it (the `selectShape` call above already ran) but doesn't
    // begin a move gesture — the guard runs after selection, before the
    // drag starts.
    if (
      !sceneEditor.checkUnlocked(
        [hit.id],
        "This shape is on a locked layer or group and can't be moved. Unlock it first.",
      )
    ) {
      return;
    }
    beginTransformGesture({ mode: 'single', kind: 'move', startShape: hit, startPointer: pointer });
  }

  // A single-shape resize/rotate handle is only ever rendered for the
  // current single selection (see the render below), so there's no
  // separate hit-test or selection step here — just start manipulating
  // the already-selected shape. `stopPropagation` keeps this from also
  // bubbling into `handleCanvasPointerDown`, which would otherwise
  // hit-test the same point against shape bodies underneath the handle.
  function handleHandlePointerDown(kind: HandleKind) {
    return (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      const shape = sceneEditor.selectedShape;
      if (!shape) return;
      if (
        !sceneEditor.checkUnlocked(
          [shape.id],
          "This shape is on a locked layer or group and can't be transformed. Unlock it first.",
        )
      ) {
        return;
      }
      const pointer = canvasPointFromClient(event.clientX, event.clientY);
      if (!pointer) return;
      beginTransformGesture({ mode: 'single', kind, startShape: shape, startPointer: pointer });
    };
  }

  // Issue #77: the combined bounding-box handle's pointer-down — same
  // `stopPropagation` rationale as `handleHandlePointerDown` above, just
  // starting a group gesture over the whole resolved multi-selection
  // instead of the single selected shape.
  function handleGroupHandlePointerDown(kind: HandleKind) {
    return (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      if (!groupSelection || !groupBounds) return;
      if (
        !sceneEditor.checkUnlocked(
          groupSelection.map((s) => s.id),
          "One or more selected shapes are on a locked layer or group and can't be transformed. Unlock them first.",
        )
      ) {
        return;
      }
      const pointer = canvasPointFromClient(event.clientX, event.clientY);
      if (!pointer) return;
      beginTransformGesture({
        mode: 'group',
        kind,
        startShapes: groupSelection,
        bounds: groupBounds,
        startPointer: pointer,
      });
    };
  }

  // Issue #79: a vertex handle's pointer-down both selects that point
  // (distinct from starting a drag — `selectVertex` fires unconditionally
  // here, so a plain click-no-move still selects it for a subsequent
  // Delete/Backspace) and starts the vertex drag gesture. `stopPropagation`
  // matches `handleHandlePointerDown`'s own rationale: without it, this
  // would also bubble into `handleCanvasPointerDown` and hit-test the same
  // point against shape bodies underneath the handle.
  function handleVertexPointerDown(pointIndex: number) {
    return (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      const shape = sceneEditor.selectedShape;
      if (!shape || shape.type !== 'path') return;
      if (
        !sceneEditor.checkUnlocked(
          [shape.id],
          "This shape is on a locked layer or group and can't be reshaped. Unlock it first.",
        )
      ) {
        return;
      }
      sceneEditor.selectVertex(pointIndex);
      const pointer = canvasPointFromClient(event.clientX, event.clientY);
      if (!pointer) return;
      beginTransformGesture({
        mode: 'vertex',
        startShape: shape,
        pointIndex,
        startPointer: pointer,
      });
    };
  }

  // Issue #79: double-clicking a path segment while vertex edit mode is
  // active inserts a new point there — a no-op (not a rejection) outside
  // vertex edit mode or when the double-click lands too far from any
  // segment (`findClosestPathSegment`'s own `null` case, handled inside
  // `insertVertexAtPoint`), and a visible `vertexError` (not a mutation)
  // at the `MAX_PATH_POINTS` cap.
  function handleCanvasDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!sceneEditor.vertexEditActive) return;
    const pointer = canvasPointFromClient(event.clientX, event.clientY);
    if (!pointer) return;
    sceneEditor.insertVertexAtPoint(pointer);
  }

  function handleStyle(point: Point): CSSProperties {
    return {
      position: 'absolute',
      left: `${(point.x / canvasWidth) * 100}%`,
      top: `${(point.y / canvasHeight) * 100}%`,
      width: 12,
      height: 12,
      marginLeft: -6,
      marginTop: -6,
      touchAction: 'none',
    };
  }

  function shapeSummary(shape: Shape): string {
    switch (shape.type) {
      case 'circle':
        return `x=${shape.transform.x}, y=${shape.transform.y}, r=${shape.radius}`;
      case 'rect':
        return `x=${shape.transform.x}, y=${shape.transform.y}, w=${shape.width}, h=${shape.height}`;
      case 'line':
        return `(${shape.transform.x}, ${shape.transform.y}) -> (${shape.x2}, ${shape.y2})`;
      case 'path':
        return `${shape.points.length} point(s), closed=${shape.closed}`;
    }
  }

  return (
    <div>
      <header className="editor-workspace-header">
        <h2>{project?.title}</h2>
        <p
          role="status"
          aria-live="polite"
          data-testid="editor-save-status"
          className="editor-save-status"
        >
          {isDirty
            ? 'Unsaved changes'
            : `Saved${persistedVersion ? ` as version ${persistedVersion.sequence}` : ''}`}
        </p>
        <Link to={`/projects/${id}/settings`}>Edit project details</Link>
        <button type="button" onClick={() => setShowExitConfirm(true)}>
          Exit without saving
        </button>
        {showExitConfirm && (
          <ExitWithoutSavingConfirm
            onConfirm={() => void handleConfirmExit()}
            onCancel={() => setShowExitConfirm(false)}
          />
        )}
      </header>

      {isNarrow && <EditorPanelSwitcher activePanel={activePanel} onSelect={setActivePanel} />}

      <div className="editor-workspace">
        <section
          role="region"
          aria-label="Tools"
          data-panel="tools"
          id="editor-panel-tools"
          className="editor-panel"
          hidden={panelHidden('tools')}
        >
          <h3>Tools</h3>
          <div role="group" aria-label="Add shape" className="editor-tool-group">
            {SHAPE_TYPES.map(({ type, label }) => (
              <button key={type} type="button" onClick={() => sceneEditor.addShape(type)}>
                {label}
              </button>
            ))}
          </div>

          {/* Issue #78: the client-only snap-to-grid / alignment-guide
              toggle — editor-specific, so it lives here in the Tools
              panel (not the global header, unlike Reduce motion). */}
          <SnapPreferenceControl />

          {/* Task 80 (issue #80): the net-new `lockError` channel — surfaces
              a rejected duplicate/delete/move/resize/rotate/reshape against
              an effectively-locked shape or group, for exactly the call
              sites that had no existing rejection channel of their own
              before this issue (every other guarded call site reuses
              `outlineError`/`vertexError`/its own field-edit error, shown
              where those already render). */}
          {sceneEditor.lockError && (
            <p role="alert" aria-live="assertive">
              {sceneEditor.lockError}
            </p>
          )}

          <div role="group" aria-label="Edit shape" className="editor-tool-group">
            <button
              type="button"
              onClick={() => sceneEditor.duplicateSelected()}
              disabled={!sceneEditor.selectedShape}
            >
              Duplicate selected shape
            </button>
            <button
              type="button"
              onClick={() => sceneEditor.deleteSelected()}
              disabled={!sceneEditor.selectedShape}
            >
              Delete selected shape
            </button>
          </div>

          <div role="group" aria-label="History" className="editor-tool-group">
            <button
              type="button"
              onClick={() => sceneEditor.undo()}
              disabled={!sceneEditor.canUndo}
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => sceneEditor.redo()}
              disabled={!sceneEditor.canRedo}
            >
              Redo
            </button>
          </div>

          <h4>Shapes</h4>
          {sceneEditor.shapes.length === 0 ? (
            <p>No shapes yet.</p>
          ) : (
            <ul aria-label="Shape list" className="editor-shape-list">
              {sceneEditor.shapes.map((shape) => (
                <li key={shape.id}>
                  <button
                    type="button"
                    aria-pressed={shape.id === sceneEditor.selectedShapeId}
                    onClick={() => sceneEditor.selectShape(shape.id)}
                  >
                    {shapeLabel(shape)}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <SceneOutlinePanel sceneEditor={sceneEditor} />

          {/* Task 31: the camera permission/privacy control. Self-contained
              (owns its own lazily-created MediaPipe tracking-provider
              instance; see CameraControl.tsx) and rendered unconditionally
              alongside — never in place of — DemoControlsPanel below, so
              the non-camera fallback stays available before camera
              activation, during any camera failure, and after Stop camera
              is pressed (acceptance criterion). */}
          <CameraControl />

          {/* Task 28: local demo signal controls — sliders/toggles/event
              buttons plus deterministic synthetic playback, so every
              normalized gesture signal can be exercised without a camera.
              Self-contained (owns its own tracking-provider controller;
              see DemoControlsPanel.tsx), so it lives here as an
              independent section rather than threading through
              useSceneEditor/workingCopy. */}
          <DemoControlsPanel />
        </section>

        <section
          role="region"
          aria-label="Preview"
          data-panel="preview"
          id="editor-panel-preview"
          className="editor-panel"
          hidden={panelHidden('preview')}
        >
          <h3>Preview</h3>
          <p>{shapeCount} shape(s) in the working copy.</p>
          {previewError && (
            <p role="alert" aria-live="assertive">
              Couldn't render the preview: {previewError}
            </p>
          )}
          <div
            ref={canvasRef}
            data-testid="scene-canvas"
            role="group"
            aria-label="Scene canvas"
            className="editor-scene-canvas"
            style={{
              position: 'relative',
              width: canvasWidth,
              height: canvasHeight,
              maxWidth: '100%',
            }}
            onClick={handleCanvasClick}
            onPointerDown={handleCanvasPointerDown}
            onDoubleClick={handleCanvasDoubleClick}
          >
            {/* Task 25: the p5.js preview mounts its <canvas> into this div.
                React is never given any children to reconcile here (no JSX
                children below), so it never touches — or fights over —
                nodes p5 appends directly to the real DOM. */}
            <div
              ref={previewMountRef}
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, zIndex: -1 }}
            />
            {/* Issue #78: the grid overlay — a visible line at every
                20-scene-unit grid coordinate, so snapping is never
                invisible/implicit (acceptance criterion). Rendered as an
                SVG (not a `p5Adapter.ts` draw call — that file stays
                untouched per the issue's own constraint) sized/viewBox'd
                to exactly the logical canvas, so its coordinates line up
                with shape `transform.x/y` with no separate unit
                conversion. */}
            {snapSettings.gridEnabled && (
              <svg
                aria-hidden="true"
                data-testid="editor-snap-grid-overlay"
                className="editor-snap-grid-overlay"
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                width={canvasWidth}
                height={canvasHeight}
                viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              >
                {gridLinesX.map((x) => (
                  <line
                    key={`grid-x-${x}`}
                    className="editor-snap-grid-line"
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={canvasHeight}
                  />
                ))}
                {gridLinesY.map((y) => (
                  <line
                    key={`grid-y-${y}`}
                    className="editor-snap-grid-line"
                    x1={0}
                    y1={y}
                    x2={canvasWidth}
                    y2={y}
                  />
                ))}
              </svg>
            )}
            {/* Issue #78: alignment-guide lines — only rendered for the
                duration an active single-shape move gesture is actually
                snapped onto a sibling's edge/center (`activeGuides` is
                cleared on every gesture end, so nothing stale is ever left
                behind after pointerup). */}
            {(activeGuides.x || activeGuides.y) && (
              <svg
                aria-hidden="true"
                className="editor-snap-guide-overlay"
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                width={canvasWidth}
                height={canvasHeight}
                viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              >
                {activeGuides.x && (
                  <line
                    data-testid="snap-guide-x"
                    className="editor-snap-guide-line"
                    x1={activeGuides.x.value}
                    y1={0}
                    x2={activeGuides.x.value}
                    y2={canvasHeight}
                  />
                )}
                {activeGuides.y && (
                  <line
                    data-testid="snap-guide-y"
                    className="editor-snap-guide-line"
                    x1={0}
                    y1={activeGuides.y.value}
                    x2={canvasWidth}
                    y2={activeGuides.y.value}
                  />
                )}
              </svg>
            )}
            {sceneEditor.shapes.map((shape, index) => (
              <div
                key={shape.id}
                data-testid={`scene-shape-${shape.id}`}
                data-shape-type={shape.type}
                aria-hidden="true"
                className="editor-scene-shape"
                style={{ position: 'absolute', zIndex: index }}
              >
                {shape.id === sceneEditor.selectedShapeId ? shapeSummary(shape) : null}
              </div>
            ))}
            {/* Issue #77: when 2+ shapes are multi-selected, one combined
                bounding-box handle set drives a rigid group move/resize/
                rotate gesture over the whole resolved selection, entirely
                replacing the single-shape handle set below for that
                state. Task 26: move/resize/rotate handles for the single
                selected shape only, unchanged — a group selection, a
                group-row selection (selectedShape is null then), or no
                selection at all shows none. Both are re-derived fresh
                from the current selection/scene on every render, so a
                selection change, a delete, or an undo/redo that changes
                the selection automatically leaves no stale handle
                behind. */}
            {/* Issue #79: while vertex edit mode is active for the single
                selected `path` shape, one draggable handle per point
                entirely replaces Task 26's move/resize/rotate handles for
                that shape (never issue #77's group handles above it in
                this chain — group selection requires 2+ items, and vertex
                edit mode is single-shape-only, so the two can never be
                simultaneously true). Re-derived fresh from
                `sceneEditor.selectedShape.points` on every render, so an
                insert/delete/undo/redo immediately shows the right set of
                handles with nothing stale left behind. */}
            {sceneEditor.vertexEditActive &&
            sceneEditor.selectedShape?.type === 'path' &&
            !isSelectedShapeLocked
              ? getPathPointHandles(sceneEditor.selectedShape).map((point, index) => (
                  <div
                    key={`vertex-handle-${sceneEditor.selectedShape!.id}-${index}`}
                    data-testid={`path-vertex-handle-${index}`}
                    role="button"
                    tabIndex={-1}
                    aria-pressed={sceneEditor.selectedVertexIndex === index}
                    aria-label={`Point ${index + 1}`}
                    className={
                      sceneEditor.selectedVertexIndex === index
                        ? 'editor-shape-handle editor-vertex-handle editor-vertex-handle-selected'
                        : 'editor-shape-handle editor-vertex-handle'
                    }
                    style={handleStyle(point)}
                    onPointerDown={handleVertexPointerDown(index)}
                  />
                ))
              : groupSelection && groupBounds && !isGroupSelectionLocked
                ? (() => {
                    const handles = getGroupHandles(groupBounds);
                    return (
                      <>
                        <div
                          data-testid="group-handle-move"
                          aria-hidden="true"
                          className="editor-shape-handle editor-group-handle-move"
                          style={handleStyle(handles.move)}
                          onPointerDown={handleGroupHandlePointerDown('move')}
                        />
                        <div
                          data-testid="group-handle-resize"
                          aria-hidden="true"
                          className="editor-shape-handle editor-group-handle-resize"
                          style={handleStyle(handles.resize)}
                          onPointerDown={handleGroupHandlePointerDown('resize')}
                        />
                        <div
                          data-testid="group-handle-rotate"
                          aria-hidden="true"
                          className="editor-shape-handle editor-group-handle-rotate"
                          style={handleStyle(handles.rotate)}
                          onPointerDown={handleGroupHandlePointerDown('rotate')}
                        />
                      </>
                    );
                  })()
                : sceneEditor.selectedShape &&
                  !isSelectedShapeLocked &&
                  (() => {
                    const handles = getShapeHandles(sceneEditor.selectedShape);
                    return (
                      <>
                        <div
                          data-testid="shape-handle-move"
                          aria-hidden="true"
                          className="editor-shape-handle editor-shape-handle-move"
                          style={handleStyle(handles.move)}
                          onPointerDown={handleHandlePointerDown('move')}
                        />
                        <div
                          data-testid="shape-handle-resize"
                          aria-hidden="true"
                          className="editor-shape-handle editor-shape-handle-resize"
                          style={handleStyle(handles.resize)}
                          onPointerDown={handleHandlePointerDown('resize')}
                        />
                        <div
                          data-testid="shape-handle-rotate"
                          aria-hidden="true"
                          className="editor-shape-handle editor-shape-handle-rotate"
                          style={handleStyle(handles.rotate)}
                          onPointerDown={handleHandlePointerDown('rotate')}
                        />
                      </>
                    );
                  })()}
          </div>
        </section>

        <section
          role="region"
          aria-label="Inspector"
          data-panel="inspector"
          id="editor-panel-inspector"
          className="editor-panel"
          hidden={panelHidden('inspector')}
        >
          <h3>Inspector</h3>

          {/* Task 60 (issue #58): position/scale/rotation/opacity/fill/
              stroke/stroke-width fields for the actively selected shape —
              see ShapeInspectorPanel.tsx's own doc comment for the
              out-of-range (clamp) policy and how it handles no
              selection/multi-selection/a hidden selection/selection
              deletion without ever showing a stale value. */}
          <ShapeInspectorPanel sceneEditor={sceneEditor} />

          {/* Task 41: explicit save plus the immutable version-history
              view (list/restore/soft-delete). `onSaved`/`onRestored`
              update `project`/`persistedVersion` from the exact version
              the server just returned — no refetch needed — so
              `isDirty` above immediately reflects the new saved state;
              `onRestored` also replaces `workingCopy` with the restored
              snapshot, since restoring is meant to load that historical
              scene back into the editor. */}
          {id && (
            <VersionHistoryPanel
              projectId={id}
              project={project}
              persistedVersion={persistedVersion}
              workingCopy={workingCopy}
              isDirty={isDirty}
              onSaved={(version) => {
                setPersistedVersion(version);
                setProject((current) =>
                  current ? { ...current, current_version: version.id } : current,
                );
                // Task 42/43: the version-save API call succeeded, so
                // neither the local nor the server recovery draft for this
                // project is needed anymore — clear both. Never called on
                // a failed save (see `useVersionHistory.save`'s error
                // handling: this callback only ever fires with the saved
                // version on success).
                void draftAutosave.clearDraft();
                void draftServerSync.deleteServerDraft();
              }}
              onRestored={(version) => {
                setPersistedVersion(version);
                setWorkingCopy(structuredClone(version.scene_json));
                setProject((current) =>
                  current ? { ...current, current_version: version.id } : current,
                );
                // Task 43: restoring a historical version is this
                // codebase's defined "meaningful action" — sync the
                // restored working copy to the server draft immediately
                // rather than waiting for the next periodic tick. Passes
                // `version.scene_json` explicitly (see
                // `useDraftServerSync.ts`'s comment on `snapshotOverride`)
                // rather than relying on `workingCopy`, which hasn't
                // re-rendered into this hook's ref yet.
                draftServerSync.syncAfterMeaningfulAction(structuredClone(version.scene_json));
              }}
            />
          )}

          {/* Task 55: export configuration dialog. Read-only against
              version history/project metadata — it never restores a
              version or changes `project.current_version`, and its
              terminal "Export" action is an intentional stub (logs the
              assembled config) until Task 56+ builds real artifact
              generation. See `ExportConfigDialog.tsx`'s module doc
              comment. */}
          {id && <ExportConfigDialog projectId={id} project={project} />}

          {/* Task 48: AI create/edit proposal preview and acceptance. The
              proposal itself is a third state entirely inside
              AIProposalPanel/useAIProposal — nothing here is touched until
              `onAccepted` fires, which only ever happens after the accept
              endpoint has actually persisted a new version. Handled
              exactly like VersionHistoryPanel's onRestored above (a new
              scene replaces the working copy wholesale), plus the same
              draft-clearing/meaningful-action-sync Task 42/43 already do
              for save/restore. */}
          {id && (
            <AIProposalPanel
              projectId={id}
              workingCopy={workingCopy}
              currentVersionId={project?.current_version ?? null}
              onAccepted={(version) => {
                setPersistedVersion(version);
                setWorkingCopy(structuredClone(version.scene_json));
                setProject((current) =>
                  current ? { ...current, current_version: version.id } : current,
                );
                void draftAutosave.clearDraft();
                draftServerSync.syncAfterMeaningfulAction(structuredClone(version.scene_json));
              }}
            />
          )}

          {/* Task 40: read-only "Randomness enabled" indicator — renders
              nothing when the scene doesn't use seeded randomness. */}
          <RandomnessIndicator scene={sceneEditor.workingCopy} />

          {/* Task 34: behavior cards ("Follow hand," "React to pinch,"
              "Pulse," "Emit particles") — reads/writes `workingCopy`
              through `sceneEditor`, so it participates in the same
              undo/redo history as every other scene edit. */}
          <BehaviorCardsPanel sceneEditor={sceneEditor} />

          {/* Task 36: the advanced typed behavior graph — React Flow
              canvas plus its accessible keyboard-operable list-view
              alternative, both driven by the exact same `sceneEditor`
              graph actions (see GraphView.tsx/GraphListView.tsx). */}
          <button
            type="button"
            aria-expanded={showLogic}
            aria-controls="editor-graph-section"
            onClick={() => setShowLogic((current) => !current)}
          >
            {showLogic ? 'Hide logic' : 'Show logic'}
          </button>
          {showLogic && (
            <div id="editor-graph-section">
              <h4>Advanced graph</h4>
              <p>
                Inspect and edit the constrained typed behavior graph directly. Only
                type-compatible, directionally valid connections can be created.
              </p>
              <GraphView sceneEditor={sceneEditor} />
              <GraphListView sceneEditor={sceneEditor} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default EditorWorkspace;
