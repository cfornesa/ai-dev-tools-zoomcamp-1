import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  updateProjectMetadata,
  type Project,
  type SceneDocument,
  type SceneVersion,
} from '../api/projects';
import { useReducedMotion } from '../a11y/reducedMotion';
import CameraControl, { type CameraStatus } from '../components/CameraControl';
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
  type AlignmentGuide,
  type Bounds,
  type HandleKind,
  type PathShape,
  type Point,
  type Shape,
} from './sceneShapes';
import { useAlertDialogFocus } from '../a11y/useAlertDialogFocus';
import { useCameraOverlaySettings } from '../editor/cameraOverlaySettings';
import { useSnapSettings } from '../editor/snapSettings';
import { validateProjectMetadataForPrivateSave } from '../validation/projectMetadata';
import { normalizeSceneLayers } from '../validation/scene';
import { buildOutline, isEffectivelyLocked } from './sceneOutline';
import SnapPreferenceControl from './SnapPreferenceControl';
import { useBeforeUnloadGuard } from './useBeforeUnloadGuard';
import { useDraftAutosave } from './useDraftAutosave';
import { useDraftRecovery } from './useDraftRecovery';
import { useDraftServerSync } from './useDraftServerSync';
import { useEditorWorkspaceState } from './useEditorWorkspaceState';
import { useIsNarrowViewport } from './useIsNarrowViewport';
import { createPreviewTrackingSource } from './previewTrackingSource';
import { sceneHasActiveBehaviors, usePreviewRuntime } from './usePreviewRuntime';
import { useSceneEditor, type SceneEditor } from './useSceneEditor';
import { getColorFieldValue } from './shapeStyleFields';
import AIProposalPanel from './AIProposalPanel';
import BehaviorCardsPanel from './BehaviorCardsPanel';
import CollapsibleSection from './CollapsibleSection';
import DemoControlsPanel from './DemoControlsPanel';
import DraftRecoveryPrompt from './DraftRecoveryPrompt';
import EditorDetailsPanel, {
  type EditorDetailsPanelHandle,
  type PersistDetailsResult,
} from './EditorDetailsPanel';
import ExportConfigDialog from './ExportConfigDialog';
import GraphListView from './GraphListView';
import GraphView from './GraphView';
import LayersPanel from './LayersPanel';
import OnboardingHints from './OnboardingHints';
import PublishControl from './PublishControl';
import RandomnessIndicator from './RandomnessIndicator';
import SaveControl from './SaveControl';
import ShapeInspectorPanel from './ShapeInspectorPanel';
import VersionHistoryPanel from './VersionHistoryPanel';

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

/**
 * Task 94 (issue #94): inline title editing — a pencil/edit affordance next
 * to the project title (above Preview) that swaps the plain `<h2>` for a
 * text input + Save/Cancel, writing through the same `updateProjectMetadata`
 * PATCH `EditorDetailsPanel`/`PublishControl` also use, with no navigation
 * or reload. `setProject` is updated from the server's response on success,
 * exactly like every other metadata write in this file.
 */
function EditableProjectTitle({
  id,
  project,
  setProject,
}: {
  id: string | undefined;
  project: Project | null;
  setProject: Dispatch<SetStateAction<Project | null>>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setDraft(project?.title ?? '');
    setError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setError(null);
  }

  async function saveTitle(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    const errors = validateProjectMetadataForPrivateSave({ title: draft });
    if (errors.title) {
      setError(errors.title.join(' '));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProjectMetadata(id, { title: draft });
      setProject(updated);
      setIsEditing(false);
    } catch {
      setError('Could not save the title. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <div className="editor-title-display">
        <h2>{project?.title}</h2>
        <button
          type="button"
          className="editor-icon-button"
          aria-label="Edit title"
          onClick={startEditing}
        >
          <span aria-hidden="true">✎</span>
        </button>
      </div>
    );
  }

  return (
    <form className="editor-title-edit" onSubmit={(event) => void saveTitle(event)}>
      <label htmlFor="editor-title-input">Title</label>
      <input
        id="editor-title-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'editor-title-error' : undefined}
        autoFocus
      />
      <button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button type="button" onClick={cancelEditing}>
        Cancel
      </button>
      {error && (
        <p id="editor-title-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

/**
 * Task 112 (issue #143): one always-visible toolbar button — a visible
 * `aria-hidden` glyph plus a CSS tooltip (`.editor-toolbar-tooltip`, shown
 * on `:hover`/`:focus-visible` in index.css) so the label is visible on
 * both mouse hover and keyboard focus, while `aria-label` carries the
 * accessible name independent of the tooltip ever being visible.
 */
function ToolbarButton({
  label,
  glyph,
  onClick,
  disabled,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="editor-toolbar-button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <span aria-hidden="true">{glyph}</span>
      <span className="editor-toolbar-tooltip" role="tooltip">
        {label}
      </span>
    </button>
  );
}

/**
 * Task 112 (issue #143): the toolbar's contextual color-edit control for
 * the currently selected shape. Reuses `updateSelectedShapeColorField`
 * (the exact same write path `LayersPanel.tsx`'s `ShapeColorSwatch` uses)
 * so editing color here and editing it from the shape's Layers row stay
 * in sync — this is a second UI surface over one color value, never a
 * second, divergent one. Disabled (not hidden) when nothing is selected,
 * matching Duplicate/Delete's existing pattern, so the toolbar's layout
 * never shifts as the selection changes.
 */
function EditorToolbarColorControl({ sceneEditor }: { sceneEditor: SceneEditor }) {
  const shape = sceneEditor.selectedShape;
  const value = shape ? getColorFieldValue(shape, 'fill') : null;
  const [draft, setDraft] = useState(value ?? '');
  const [error, setError] = useState<string | null>(null);

  // Re-sync the draft to the canonical value whenever the selection or its
  // fill value changes out from under it (e.g. selecting a different
  // shape, or an undo) — the same re-sync `ShapeColorSwatch` performs.
  useEffect(() => {
    setDraft(value ?? '');
    setError(null);
  }, [shape?.id, value]);

  return (
    <span className="editor-toolbar-color-control">
      <label htmlFor="editor-toolbar-fill-color">Fill color</label>
      <input
        id="editor-toolbar-fill-color"
        type="text"
        value={draft}
        disabled={!shape}
        placeholder={shape ? '' : 'No shape selected'}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'editor-toolbar-fill-color-error' : undefined}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          const outcome = sceneEditor.updateSelectedShapeColorField('fill', next);
          setError(outcome.ok ? null : outcome.error);
        }}
      />
      {error && (
        <span id="editor-toolbar-fill-color-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
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

  // Issue #128: a ref to `EditorDetailsPanel`'s imperative handle, so
  // `PublishControl` (rendered as a sibling in the header below) can read
  // and, when needed, persist that panel's currently-pending
  // description/tags/allow-remix/export-attribution values before
  // publishing — without lifting its local `useState` up wholesale, which
  // would have meant rewriting every existing `EditorDetailsPanel`
  // behavior/test around controlled props instead of just adding this one
  // new access path. See `EditorDetailsPanel.tsx`'s own doc comment.
  const detailsPanelRef = useRef<EditorDetailsPanelHandle>(null);

  // Issue #128: `PublishControl`'s "auto-persist, then validate/publish"
  // flow calls this before running `validateProjectMetadataForPublish`.
  // "Concurrent edit safety" (the groomed task doc's term): if the Details
  // panel's current field values already match `project`'s last-saved
  // ones, this skips the PATCH entirely rather than sending a redundant
  // no-op write — the common case where the user never touched the Details
  // panel, or already clicked its own "Save changes".
  const persistPendingDetails = useCallback(async (): Promise<PersistDetailsResult> => {
    const panel = detailsPanelRef.current;
    if (!panel || !project) return { status: 'skipped' };
    const pending = panel.getPendingDetails();
    const changed =
      pending.description !== project.description ||
      JSON.stringify(pending.tags) !== JSON.stringify(project.tags) ||
      pending.allowRemix !== project.allow_public_remix ||
      pending.exportAttribution !== project.export_attribution;
    if (!changed) return { status: 'skipped' };
    return panel.save();
  }, [project]);

  const isNarrow = useIsNarrowViewport();
  // Issue #93: Preview is no longer one of the switchable tabs (it's always
  // rendered — see `panelHidden` below), so the switcher only ever toggles
  // between Tools and Inspector; 'tools' is as good a default as either.
  const [activePanel, setActivePanel] = useState<EditorPanelName>('tools');
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

  // Task 82: observed success signals `OnboardingHints.tsx` uses to
  // auto-clear its camera-enable/pinch hints — sourced from the same
  // `CameraControl`/`DemoControlsPanel` instances already rendered below,
  // not a separate tracking subscription.
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [pinchEventCount, setPinchEventCount] = useState(0);

  // Task 110 (issue #141): the live camera `MediaStream` `CameraControl`'s
  // tracking provider already has open, forwarded here so the Preview
  // overlay can display it via a plain <video> element — no second
  // `getUserMedia` call. Task 118 (issue #147): `cameraOverlayOpacity`/
  // mirrored are now persisted client-side (see `../editor/
  // cameraOverlaySettings.ts`) instead of session-only state that reset to
  // a hardcoded default every time the camera became active — re-enabling
  // the camera now restores the last-chosen values.
  const {
    opacity: cameraOverlayOpacity,
    mirrored: cameraOverlayMirrored,
    setOpacity: setCameraOverlayOpacity,
    setMirrored: setCameraOverlayMirrored,
  } = useCameraOverlaySettings();
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoEl = cameraVideoRef.current;
    if (!videoEl) return;
    videoEl.srcObject = cameraStream;
    if (cameraStream) {
      // `Promise.resolve(...)` normalizes jsdom's non-conformant
      // `HTMLMediaElement.play()` (returns `undefined`, not a `Promise`,
      // and logs its own "Not implemented" notice) into a real promise,
      // so this `.catch` is safe in tests without changing real-browser
      // behavior (where `.play()` already always returns a `Promise`).
      void Promise.resolve(videoEl.play()).catch(() => {
        // Autoplay can be rejected in some environments; the video element
        // still renders (just paused) and this is not a scene-breaking
        // failure worth surfacing as `previewError`.
      });
    }
    // `cameraStream` is set via `onStreamChange` well before `cameraStatus`
    // ever reaches 'active' (mediapipeProvider.ts acquires the stream
    // before the recognizer is ready or any frame flows) -- but the
    // `<video>` element below is only ever mounted while
    // `cameraStatus === 'active'`. Without `cameraStatus` in this
    // dependency array, this effect fires once while the element doesn't
    // exist yet (`cameraVideoRef.current` is null, so it silently no-ops)
    // and never fires again once `cameraStatus` finally flips to 'active'
    // and the element actually mounts -- `srcObject` would never get set,
    // leaving the overlay permanently blank despite a live stream. Live-
    // verified: this exact bug reproduced (video element present with
    // `hasSrcObject: false`) before this dependency was added.
  }, [cameraStream, cameraStatus]);

  // Task 83 (issue #83): the shared "current tracking frame" mailbox the
  // live preview runtime loop reads from — see `previewTrackingSource.ts`'s
  // own doc comment for why this taps into the SAME `CameraControl`/
  // `DemoControlsPanel` frame streams already rendered below, rather than
  // creating a second, competing `TrackingProvider` instance. Created once
  // (`useRef`) and never replaced for the life of this component.
  const trackingSourceRef = useRef(createPreviewTrackingSource());
  const reducedMotion = useReducedMotion();

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

  // Issue #112: `draftAutosave`/`draftServerSync` above already classify
  // and record autosave/sync failures via `getLastFailure()`, but nothing
  // read that back into the UI — a failed local or server draft write
  // failed completely silently, which is indistinguishable from "nothing
  // happened yet" to the person editing. Poll both controllers' recorded
  // failure (cheap in-memory reads, no network) while a project is loaded
  // and surface the most recent one as a non-blocking, actionable status
  // message next to the save status — the editor stays on the same route
  // and the working copy is untouched either way.
  const [draftFailureNotice, setDraftFailureNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!id) {
      setDraftFailureNotice(null);
      return;
    }
    function pollFailures() {
      const autosaveFailure = draftAutosave.getLastFailure();
      const syncFailure = draftServerSync.getLastFailure();
      const failure = syncFailure ?? autosaveFailure;
      setDraftFailureNotice(
        failure
          ? `Recovery draft couldn't be saved (${failure.message}). Your changes are still here — try saving explicitly.`
          : null,
      );
    }
    pollFailures();
    const intervalId = window.setInterval(pollFailures, 3000);
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Issue #95 follow-up: shared by the header's `SaveControl` (the
  // prominent, always-reachable Save action) — the only caller now that
  // `VersionHistoryPanel.tsx`'s own inline Save form was removed in favor
  // of it. Updates `project`/`persistedVersion` from the exact version the
  // server just returned (no refetch needed), so `isDirty` immediately
  // reflects the new saved state, and clears both recovery drafts since
  // Task 42/43's "no changes since last save" write is no longer needed —
  // this callback only ever fires with the saved version on success (see
  // `useVersionHistory.save`'s error handling).
  function handleVersionSaved(version: SceneVersion) {
    setPersistedVersion(version);
    setProject((current) => (current ? { ...current, current_version: version.id } : current));
    // Issue #125: `clearDraft()`/`deleteServerDraft()` called with no
    // argument default to the current `workingCopy` — accurate here
    // because Save persisted exactly that content (this callback never
    // replaces `workingCopy` itself), so it also becomes the "no unsaved
    // changes" baseline that stops periodic/meaningful-action/page-hide
    // sync from recreating a draft afterward (see `draftServerSync.ts`'s
    // `markClean()`).
    void draftAutosave.clearDraft();
    void draftServerSync.deleteServerDraft();
    // An explicit Save just persisted the authoritative version, so a
    // stale draft-sync failure notice from before this save no longer
    // describes anything the user needs to act on.
    setDraftFailureNotice(null);
  }

  async function handleConfirmExit() {
    // Issue #125: same default-to-`workingCopy` baseline as
    // `handleVersionSaved` above — after this, the working copy won't
    // change again in this component (the confirmation navigates away),
    // so no queued/in-flight periodic write can recreate a draft even if
    // the component hasn't fully unmounted yet.
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
  const previewRef = useRef<P5ScenePreview | null>(null);
  // Issue #111: the shape currently under the pointer, hit-tested the same
  // way `handleCanvasClick`/`handleCanvasPointerDown` do (topmost-shape-
  // wins), so hovering can show a distinct affordance from the selected
  // outline below without changing what a click/drag actually acts on.
  // `null` whenever nothing is hovered — including while the pointer is off
  // the canvas entirely (`handleCanvasPointerLeave`) and, deliberately, kept
  // updating during an active drag (it's cheap, and freezing it mid-drag
  // would just leave a stale highlight behind once the gesture ends).
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
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
  // own comment below for why.
  //
  // Task 83 (issue #83): this is a *callback* ref, not a plain `useRef` +
  // `useEffect(fn, [])` pair (what this used to be), plus the
  // `previewMounted` state flag it sets below — that old pairing had a
  // real timing bug this task's own "does the live preview actually mount
  // a canvas" testing surfaced: the mount div only exists in the DOM once
  // `loadState` reaches `'ready'` *and* `useDraftRecovery`'s own async
  // check has resolved (a SEPARATE, later commit — its own
  // IndexedDB/server round trip means it practically never lands in the
  // same commit as `loadState` first turning `'ready'`), so an effect with
  // `[]` deps (the old code) or even `[workingCopy, hasActiveBehaviors]`
  // deps (this task's own first attempt) can both end up running on a
  // commit *before* the div — and therefore `previewRef.current` — has
  // ever existed, with nothing in either dependency array changing again
  // once it finally does. The old `[]`-deps code silently no-opped forever
  // in that case (`if (!previewMountRef.current) return;`), so the p5
  // preview was never created for any project loaded the normal (async)
  // way — nothing exercised this before, since no earlier test asserted an
  // actual `<canvas>` element or a `p5Adapter.render()` call appeared, only
  // DOM text/structure. A callback ref sidesteps "which commit was the div
  // actually attached during": React invokes it with the real node the
  // *instant* it's attached (whichever commit that turns out to be), and
  // with `null` the instant it's detached (on unmount) — exactly once
  // each. `previewMounted` then gives every *effect* that needs to know
  // "does a preview exist yet" (the plain render-on-change effect just
  // below) a real, effect-dependency-array-visible signal for that moment,
  // rather than an untracked ref read.
  const [previewMounted, setPreviewMounted] = useState(false);
  const previewMountCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      previewRef.current = createP5ScenePreview(node);
      setPreviewMounted(true);
    } else {
      previewRef.current?.destroy();
      previewRef.current = null;
      setPreviewMounted(false);
    }
  }, []);

  // Task 83 (issue #83): whenever the working copy has any behavior-card
  // bindings or graph nodes, the live preview runs the real behavior
  // runtime continuously (see `usePreviewRuntime.ts`'s own doc comment for
  // the "when does the runtime run" decision) instead of the plain
  // render-on-change effect below. `hasActiveBehaviors` is recomputed every
  // render from the current `workingCopy` (cheap — two array-length reads),
  // so a binding/graph edit flips it (and therefore which code path is
  // driving the preview) on the very next render, no save/reload needed.
  const hasActiveBehaviors = sceneHasActiveBehaviors(workingCopy);
  usePreviewRuntime({
    previewRef,
    scene: hasActiveBehaviors ? workingCopy : null,
    getTrackingFrame: () => trackingSourceRef.current.consumeFrame(),
    reducedMotion: reducedMotion.effective,
    onRenderError: setPreviewError,
    // Task 110 (issue #141): see the plain render effect's identical
    // comment below for why this must match `cameraStatus === 'active'`.
    transparentBackground: cameraStatus === 'active',
  });

  // Re-renders the p5 preview whenever the working copy changes. A scene
  // that fails the adapter's validation (see p5Adapter.ts/sceneDrawPlan.ts)
  // throws before any draw call rather than drawing something wrong or
  // stale; that's surfaced here instead of crashing the workspace. Only
  // runs while `usePreviewRuntime` above is inactive (no bindings/graph) —
  // once a scene gains a binding or graph node, that hook's own rAF loop
  // takes over rendering entirely, so the two never fight over the same
  // canvas in the same frame.
  useEffect(() => {
    if (!previewRef.current || !workingCopy || hasActiveBehaviors) return;
    try {
      // Task 110 (issue #141): a transparent background while the camera
      // overlay is showing -- see p5Adapter.ts's `render` doc comment for
      // why an opaque background fill would otherwise hide the overlay
      // entirely, regardless of its own CSS opacity.
      previewRef.current.render(workingCopy, [], [], cameraStatus === 'active');
      setPreviewError(null);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Could not render this scene.');
    }
  }, [workingCopy, hasActiveBehaviors, previewMounted, cameraStatus]);

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

  // Task 114 (issue #149): Ctrl/Cmd+D duplicates the selected shape, and
  // Delete/Backspace deletes it -- the same keyboard-only entry points the
  // toolbar's "Duplicate selected shape"/"Delete selected shape" buttons
  // already call (`sceneEditor.duplicateSelected()`/`deleteSelected()`).
  // Ignored while typing in a text field, matching the undo/redo listener's
  // `isTypingTarget` use above, and Delete/Backspace is ignored outright
  // while vertex edit mode is active since that mode's own listener below
  // already owns Delete/Backspace for vertex deletion.
  // `duplicateSelected()`/`deleteSelected()` already no-op with nothing
  // selected and surface `lockError` on a locked layer/group on their own,
  // but `selectedShape` is checked here too so `preventDefault()` is never
  // called (and the browser's own bookmark/back-navigation shortcuts stay
  // live) when there is nothing to act on.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        if (!sceneEditor.selectedShape) return;
        event.preventDefault();
        sceneEditor.duplicateSelected();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (sceneEditor.vertexEditActive || !sceneEditor.selectedShape) return;
        event.preventDefault();
        sceneEditor.deleteSelected();
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

  // Task 111 (issue #142): the selection/hover outline overlay below draws
  // in the scene's real draw order, matching `render/sceneDrawPlan.ts`'s
  // `buildScenePlan` (layers first, sorted by `order`, then each layer's
  // own top-level items) -- `sceneEditor.shapes`' raw array order stopped
  // being equivalent to that once every shape got its own independent
  // layer (previously most shapes shared one layer, where array order and
  // draw order coincided). Recomputed from `buildOutline`, the same
  // source of truth the outline panel itself uses, rather than a second,
  // possibly-diverging draw-order implementation. A plain computed value
  // (not `useMemo`) since this section of the component already runs
  // after several conditional early returns above (`loadState` guards),
  // matching `canvasWidth`/`canvasHeight` just above.
  const shapesInDrawOrder = (() => {
    if (!workingCopy) return sceneEditor.shapes;
    const orderedIds = buildOutline(workingCopy)
      .filter((row) => row.kind === 'shape')
      .map((row) => row.id);
    const byId = new Map(sceneEditor.shapes.map((shape) => [shape.id, shape]));
    return orderedIds
      .map((id) => byId.get(id))
      .filter((shape): shape is (typeof sceneEditor.shapes)[number] => shape !== undefined);
  })();

  // Issue #78: the visible grid-line overlay's coordinates, at the fixed
  // 20-scene-unit spacing — only computed when grid snapping is on (the
  // "when disabled, no grid overlay renders" acceptance criterion).
  const gridLinesX: number[] = [];
  const gridLinesY: number[] = [];
  if (snapSettings.gridEnabled) {
    for (let x = 0; x <= canvasWidth; x += GRID_SIZE) gridLinesX.push(x);
    for (let y = 0; y <= canvasHeight; y += GRID_SIZE) gridLinesY.push(y);
  }

  // Issue #93 hard requirement: at every viewport width, it must be
  // possible to see Preview's live state while using Details/Tools/
  // Inspector — narrower than 1024px may no longer make Preview one of a
  // set of mutually-exclusive tabs. Preview is therefore never hidden;
  // only Details/Tools/Inspector alternate via the switcher below the
  // breakpoint (issue #94 adds Details alongside the two this already
  // covered).
  function panelHidden(panel: EditorPanelName): boolean {
    if (panel === 'preview') return false;
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

  // Issue #111: tracks `hoveredShapeId` for the hover affordance, using the
  // exact same topmost-shape hit test `handleCanvasClick`/
  // `handleCanvasPointerDown` already use, so "what lights up on hover" and
  // "what a click/drag would act on" never disagree.
  function handleCanvasPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = canvasPointFromClient(event.clientX, event.clientY);
    if (!pointer) return;
    const hit = hitTestTopmostShapeAt(sceneEditor.shapes, pointer.x, pointer.y);
    setHoveredShapeId((current) => {
      const nextId = hit ? hit.id : null;
      return current === nextId ? current : nextId;
    });
  }

  function handleCanvasPointerLeave() {
    setHoveredShapeId(null);
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

  // Issue #111: handles are positioned by percentage (so their position
  // always tracks the shape regardless of canvas scale) but sized in fixed
  // CSS pixels (so their hit target stays constant regardless of shape
  // size) — both already true before this issue. The one thing this issue
  // changes: the fixed size itself grew from 12px to 18px, since the canvas
  // is now responsively `aspectRatio`-scaled (issue #109) and can render
  // considerably smaller than its logical size at tablet/narrow widths,
  // where a 12px handle got uncomfortably close to typical touch-target
  // guidance (~44px is the usual recommendation, but this canvas already
  // has small on-screen shapes to contend with — 18px plus the handle's own
  // visible border/shadow, see index.css, is the practical middle ground
  // that stays discoverable without the handles overlapping each other on
  // a small shape).
  const HANDLE_SIZE = 18;

  function handleStyle(point: Point): CSSProperties {
    return {
      position: 'absolute',
      left: `${(point.x / canvasWidth) * 100}%`,
      top: `${(point.y / canvasHeight) * 100}%`,
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
      marginLeft: -HANDLE_SIZE / 2,
      marginTop: -HANDLE_SIZE / 2,
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
        <EditableProjectTitle id={id} project={project} setProject={setProject} />
        <span className="editor-header-break" aria-hidden="true" />
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
        {draftFailureNotice && (
          <p
            role="status"
            aria-live="polite"
            data-testid="draft-sync-error"
            className="editor-save-status editor-draft-sync-error"
          >
            {draftFailureNotice}
          </p>
        )}
        <span className="editor-header-break" aria-hidden="true" />
        {id && (
          <PublishControl
            id={id}
            project={project}
            setProject={setProject}
            persistPendingDetails={persistPendingDetails}
          />
        )}
        {id && (
          <SaveControl
            projectId={id}
            workingCopy={workingCopy}
            isDirty={isDirty}
            onSaved={handleVersionSaved}
          />
        )}
        <span className="editor-header-break editor-header-break-desktop" aria-hidden="true" />
        <button
          type="button"
          className="editor-icon-button editor-exit-button"
          aria-label="Exit without saving"
          onClick={() => setShowExitConfirm(true)}
        >
          <span aria-hidden="true">✕</span>
        </button>
        {showExitConfirm && (
          <ExitWithoutSavingConfirm
            onConfirm={() => void handleConfirmExit()}
            onCancel={() => setShowExitConfirm(false)}
          />
        )}
      </header>

      {/* Task 82: non-modal onboarding hints for the current (typically
          template-derived) scene. Rendered outside the panel switcher so
          it stays visible regardless of which of Tools/Preview/Inspector
          is active on a narrow viewport, and never blocks interaction
          with anything below it. */}
      <OnboardingHints
        hints={(workingCopy as { onboardingHints?: string[] } | null)?.onboardingHints}
        cameraActive={cameraStatus === 'active'}
        pinchEventCount={pinchEventCount}
      />

      {/* Task 112 (issue #143): an always-visible toolbar for the editor's
          most-used actions — Undo, Redo, Duplicate selected shape, Delete
          selected shape, and a contextual fill-color control — reachable
          without expanding a collapsed accordion or switching panel tabs,
          at every supported viewport width. Rendered here (outside the
          panel switcher, same placement as OnboardingHints above) so it
          stays visible regardless of which of Details/Tools/Layers/
          Inspector is active on a narrow viewport, matching how Preview
          is already always visible. `lockError` moved here too, so a
          rejected action is always visibly announced regardless of any
          accordion's open/closed state or active tab. */}
      <div role="toolbar" aria-label="Editor actions" className="editor-toolbar">
        <span role="group" aria-label="History" className="editor-tool-group">
          <ToolbarButton
            label="Undo"
            glyph="↶"
            onClick={() => sceneEditor.undo()}
            disabled={!sceneEditor.canUndo}
          />
          <ToolbarButton
            label="Redo"
            glyph="↷"
            onClick={() => sceneEditor.redo()}
            disabled={!sceneEditor.canRedo}
          />
        </span>
        <span role="group" aria-label="Edit shape" className="editor-tool-group">
          <ToolbarButton
            label="Duplicate selected shape"
            glyph="⧉"
            onClick={() => sceneEditor.duplicateSelected()}
            disabled={!sceneEditor.selectedShape}
          />
          <ToolbarButton
            label="Delete selected shape"
            glyph="✕"
            onClick={() => sceneEditor.deleteSelected()}
            disabled={!sceneEditor.selectedShape}
          />
        </span>
        <EditorToolbarColorControl sceneEditor={sceneEditor} />
        {sceneEditor.lockError && (
          <p role="alert" aria-live="assertive" className="editor-toolbar-lock-error">
            {sceneEditor.lockError}
          </p>
        )}
      </div>

      {isNarrow && <EditorPanelSwitcher activePanel={activePanel} onSelect={setActivePanel} />}

      <div className="editor-workspace">
        {/* Task 94 (issue #94), point 2: Preview leads the layout — the
            first panel in DOM order (and therefore first in both the
            >=1024px side-by-side row and the narrow stacked column, since
            neither changes source order) rather than sandwiched between
            Tools and Inspector, since the live scene is the actual product
            being made. */}
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
          {/* Issue #111: a short, always-visible, non-intrusive explanation
              of the primary pointer interactions — matches the actual
              gestures `getShapeHandles`/`applyShapeDrag` implement (move/
              resize/rotate via three handles, plus Escape-to-cancel already
              wired in `dragHandlers.onKey`) rather than assuming wording
              that doesn't match the code. Plain caption text, not a
              dismissible/modal hint like `OnboardingHints` above — that
              component is for per-scene, dismiss-once template guidance,
              while this is a durable explanation of the canvas itself. */}
          <p className="editor-canvas-hint" data-testid="editor-canvas-hint">
            Click a shape to select it. Drag its body or the round move handle to move it, the
            square handle to resize it, or the top handle to rotate it. Press Esc to cancel a drag
            in progress.
          </p>
          {previewError && (
            <p role="alert" aria-live="assertive">
              Couldn't render the preview: {previewError}
            </p>
          )}
          {/* Task 110 (issue #141): the camera overlay opacity slider,
              visible only while the live camera is active — see the
              <video> overlay itself below, inside `.editor-scene-canvas`.
              Task 118 (issue #147): both the opacity and the mirror toggle
              now persist via `useCameraOverlaySettings`. */}
          {cameraStatus === 'active' && (
            <div className="editor-camera-overlay-control">
              <label htmlFor="editor-camera-overlay-opacity">Camera overlay opacity</label>
              <input
                id="editor-camera-overlay-opacity"
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(cameraOverlayOpacity * 100)}
                aria-valuetext={`${Math.round(cameraOverlayOpacity * 100)}%`}
                onChange={(event) => setCameraOverlayOpacity(Number(event.target.value) / 100)}
              />
              <label htmlFor="editor-camera-overlay-mirror">
                <input
                  id="editor-camera-overlay-mirror"
                  type="checkbox"
                  checked={cameraOverlayMirrored}
                  onChange={(event) => setCameraOverlayMirrored(event.target.checked)}
                />
                Mirror camera overlay
              </label>
            </div>
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
              maxWidth: '100%',
              // Issue #109: the wrapper's own box tracks the scene's
              // aspect ratio (rather than a fixed pixel `height`) so that
              // when `maxWidth: '100%'` caps its width below the logical
              // `canvasWidth` (a panel narrower than the scene, e.g. at
              // tablet/narrow widths), the height shrinks proportionally
              // instead of leaving dead space or a squashed image. The
              // absolutely-positioned overlay SVGs below (`inset: 0`) and
              // the p5-mounted <canvas> (`.editor-scene-canvas canvas`'s
              // own `height: auto !important` in index.css) both then
              // track this same box, so grid/guide/shape overlays and
              // pointer coordinates (`clientToCanvasPoint`, which already
              // scales by the canvas element's actual rendered
              // `getBoundingClientRect()` vs. logical size) stay aligned
              // at any panel width.
              aspectRatio: `${canvasWidth} / ${canvasHeight}`,
            }}
            onClick={handleCanvasClick}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerLeave={handleCanvasPointerLeave}
            onDoubleClick={handleCanvasDoubleClick}
          >
            {/* Task 110 (issue #141): the live camera feed, composited via
                CSS behind the p5 canvas (zIndex -2 vs. the mount div's -1
                below) — never drawn into the p5 canvas itself, so it stays
                structurally absent from any canvas-only capture path
                (thumbnails, exports). Mirrored (selfie view) by default;
                `pointerEvents: 'none'` keeps shape click/drag unaffected.
                Task 118 (issue #147): the mirror toggle flips the
                `transform` live via the `cameraOverlayMirrored` state —
                the `<video>` element itself never re-mounts, so the live
                feed is uninterrupted. */}
            {cameraStatus === 'active' && cameraStream && (
              <video
                ref={cameraVideoRef}
                data-testid="camera-overlay-video"
                aria-hidden="true"
                muted
                playsInline
                autoPlay
                className="editor-camera-overlay"
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: -2,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: cameraOverlayMirrored ? 'scaleX(-1)' : 'none',
                  opacity: cameraOverlayOpacity,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* Task 25: the p5.js preview mounts its <canvas> into this div.
                React is never given any children to reconcile here (no JSX
                children below), so it never touches — or fights over —
                nodes p5 appends directly to the real DOM. */}
            <div
              ref={previewMountCallbackRef}
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
            <svg
              aria-hidden="true"
              className="editor-scene-shapes-layer"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              width={canvasWidth}
              height={canvasHeight}
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            >
              {shapesInDrawOrder.map((shape) => {
                const isSelected = shape.id === sceneEditor.selectedShapeId;
                // Issue #111: a hovered-but-not-selected shape gets its own
                // distinct affordance from the selected outline; a shape
                // that's effectively locked (via its own/layer's/group's
                // lock — see `isEffectivelyLocked`) gets a different "can't
                // manipulate this" hover cue instead of the normal one,
                // matching `checkUnlocked`'s existing error-toast behavior
                // when a drag on it is actually attempted.
                const isHovered = !isSelected && shape.id === hoveredShapeId;
                const isHoveredLocked =
                  isHovered &&
                  !!sceneEditor.workingCopy &&
                  isEffectivelyLocked(sceneEditor.workingCopy, shape.id);
                const bounds = isSelected ? shapeBounds(shape) : null;
                const hoverBounds = isHovered ? shapeBounds(shape) : null;
                const shapeClassName = [
                  'editor-scene-shape',
                  isSelected ? 'editor-scene-shape-selected' : '',
                  isHovered && !isHoveredLocked ? 'editor-scene-shape-hovered' : '',
                  isHoveredLocked ? 'editor-scene-shape-hovered-locked' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <g
                    key={shape.id}
                    data-testid={`scene-shape-${shape.id}`}
                    data-shape-type={shape.type}
                    className={shapeClassName}
                  >
                    {/* Issue #126 (behavior-active case) and issue #130
                        (static case): the p5 canvas beneath this overlay
                        (`previewRef`, mounted in the sibling div with
                        `zIndex: -1` above) is the single source of truth for
                        every shape's *body* — continuously re-rendered from
                        the runtime's live, behavior-evaluated positions
                        while `hasActiveBehaviors` is true
                        (`usePreviewRuntime`), and synchronously re-rendered
                        from `workingCopy` on every change otherwise (the
                        `previewRef.current.render(workingCopy)` effect
                        above). This SVG layer used to also paint each
                        shape's fill/stroke geometry (`shapeGeometry`,
                        removed by issue #130) on top of that canvas for the
                        static case, reasoning the two were always in sync so
                        drawing both was harmless. That reasoning missed that
                        `shapeGeometry` never applied `transform.opacity` —
                        p5Adapter's `drawShapeGeometry` does — so any shape
                        with reduced opacity rendered fully opaque here,
                        stacked on its correctly-translucent p5 render
                        underneath: a real, visible double-paint, not just a
                        redundant identical one. This `<g>` now only ever
                        provides non-body affordances (the testid, the
                        selection/hover outline below, the `<title>`
                        summary) — no path here paints a shape body of its
                        own, active behaviors or not. */}
                    {/* A visible selection highlight independent of the
                        shape's own fill/stroke — a dashed bounding-box
                        outline, the same rotation-ignoring approximation
                        `shapeBounds` already uses for hit-testing (see that
                        function's own comment), since there's no rotated-
                        box primitive to reuse here. */}
                    {bounds && (
                      <rect
                        className="editor-scene-shape-selection-outline"
                        x={bounds.minX - 4}
                        y={bounds.minY - 4}
                        width={bounds.maxX - bounds.minX + 8}
                        height={bounds.maxY - bounds.minY + 8}
                        fill="none"
                      />
                    )}
                    {/* Issue #111: a hover-only outline, visually distinct
                        (thinner, un-dashed, muted color) from the selected
                        outline above so "what's under the pointer" and
                        "what's selected" never look the same. A locked
                        shape gets a different color/dash so hovering it
                        reads as "can't manipulate this" rather than an
                        ordinary hoverable target, matching what actually
                        happens if a drag on it is attempted
                        (`checkUnlocked`'s error toast). */}
                    {hoverBounds && (
                      <rect
                        data-testid={`scene-shape-hover-outline-${shape.id}`}
                        className={
                          isHoveredLocked
                            ? 'editor-scene-shape-hover-outline editor-scene-shape-hover-outline-locked'
                            : 'editor-scene-shape-hover-outline'
                        }
                        x={hoverBounds.minX - 3}
                        y={hoverBounds.minY - 3}
                        width={hoverBounds.maxX - hoverBounds.minX + 6}
                        height={hoverBounds.maxY - hoverBounds.minY + 6}
                        fill="none"
                      />
                    )}
                    {/* Kept as an SVG <title> (not rendered as page text)
                        rather than the plain visible text this used to be:
                        a raw numeric readout isn't the "visible indication
                        of selection" the issue asks for (the outline above
                        is), but existing tests still assert on this text
                        via `.textContent`. */}
                    {isSelected && <title>{shapeSummary(shape)}</title>}
                  </g>
                );
              })}
            </svg>
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

        {/* Task 94 (issue #94), point 1: project-metadata editing folded
            into the editor as a fourth panel, replacing the old standalone
            `/projects/:id/settings` route (`ProjectMetadataForm.tsx`,
            deleted) — same `updateProjectMetadata` API call and
            `validateProjectMetadataForPrivateSave` validation that page
            used, wired to the same `project`/`setProject` state every
            other panel here already shares. Title editing (the header's
            `EditableProjectTitle`) and publish/unpublish (the header's
            `PublishControl`) are deliberately not duplicated here. */}
        <section
          role="region"
          aria-label="Details"
          data-panel="details"
          id="editor-panel-details"
          className="editor-panel"
          hidden={panelHidden('details')}
        >
          <h3>Details</h3>
          {id && (
            <EditorDetailsPanel
              ref={detailsPanelRef}
              projectId={id}
              project={project}
              setProject={setProject}
            />
          )}
        </section>

        <section
          role="region"
          aria-label="Tools"
          data-panel="tools"
          id="editor-panel-tools"
          className="editor-panel"
          hidden={panelHidden('tools')}
        >
          <h3>Tools</h3>

          {/* Task 94 (issue #94), point 3: independently collapsible
              sections — each `CollapsibleSection` owns its own open/closed
              state, so expanding/collapsing one never affects another (not
              a single-open-at-a-time accordion). See
              `EditorWorkspace.accordion.test.tsx`. */}
          {/* Issue #131: this section used to own shape creation (the four
              "Add circle/rectangle/line/polygon" buttons) and a duplicate
              `<ul aria-label="Shape list">` shape listing. Both moved into
              `LayersPanel.tsx` (its outline is now the single place shapes
              are listed, and its own toolbar is where they're created) —
              see that file's module doc comment. What's left here is
              genuinely just shape *actions* (duplicate/delete the current
              selection, undo/redo) plus the snap preference and lock-error
              channel, hence the renamed heading. */}
          <CollapsibleSection heading="Editing preferences">
            {/* Issue #78: the client-only snap-to-grid / alignment-guide
                toggle — editor-specific, so it lives here in the Tools
                panel (not the global header, unlike Reduce motion).
                Task 112 (issue #143): this section used to also hold
                Undo/Redo/Duplicate/Delete and the `lockError` alert; those
                moved into the new always-visible toolbar above the panel
                switcher (see `<div role="toolbar">` near the top of this
                component's return), so the section was renamed to
                describe what actually remains. */}
            <SnapPreferenceControl />
          </CollapsibleSection>

          {/* Issue #95, point 7: what was one "Camera & demo controls"
              section (too large once its content is visible, bundling
              CameraControl and the much larger DemoControlsPanel under one
              disclosure) is now two independent CollapsibleSections, each
              with its own open/closed state — consistent with this file's
              existing "opening one must not close another" rule. */}
          <CollapsibleSection heading="Camera">
            {/* Task 31: the camera permission/privacy control.
                Self-contained (owns its own lazily-created MediaPipe
                tracking-provider instance; see CameraControl.tsx) and
                rendered unconditionally alongside — never in place of —
                DemoControlsPanel below, so the non-camera fallback stays
                available before camera activation, during any camera
                failure, and after Stop camera is pressed (acceptance
                criterion). */}
            <CameraControl
              onStatusChange={(status) => {
                setCameraStatus(status);
                // Task 83: the live preview runtime loop prefers camera
                // frames over demo frames exactly while the camera is
                // actually producing them — see
                // `previewTrackingSource.ts`'s own doc comment.
                trackingSourceRef.current.setCameraActive(status === 'active');
              }}
              onFrame={(frame) => trackingSourceRef.current.reportCameraFrame(frame)}
              onStreamChange={setCameraStream}
            />
          </CollapsibleSection>

          <CollapsibleSection heading="Demo signal controls">
            {/* Task 28: local demo signal controls — sliders/toggles/event
                buttons plus deterministic synthetic playback, so every
                normalized gesture signal can be exercised without a
                camera. Self-contained (owns its own tracking-provider
                controller; see DemoControlsPanel.tsx), so it lives here as
                an independent section rather than threading through
                useSceneEditor/workingCopy. */}
            <DemoControlsPanel
              onPinchStart={() => setPinchEventCount((count) => count + 1)}
              onFrame={(frame) => trackingSourceRef.current.reportDemoFrame(frame)}
            />
          </CollapsibleSection>
        </section>

        {/* Issue #127: the former "Scene outline" `CollapsibleSection`
            buried inside Tools is now its own dedicated, always-reachable
            landmark panel — same chrome (heading, `editor-panel` border/
            background) as Details/Tools/Inspector, and (below the 1024px
            breakpoint) its own `EditorPanelSwitcher` tab, rather than one
            more disclosure a user has to know to expand. `LayersPanel.tsx`
            (renamed from `SceneOutlinePanel.tsx`) reuses the exact same
            `sceneEditor.outline`/mutation surface that section always
            rendered from — this is a container/interaction change, not a
            new data layer. */}
        <section
          role="region"
          aria-label="Layers"
          data-panel="layers"
          id="editor-panel-layers"
          className="editor-panel"
          hidden={panelHidden('layers')}
        >
          <h3>Layers</h3>
          <LayersPanel sceneEditor={sceneEditor} />
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

          {/* Task 94 (issue #94), point 3: same independently collapsible
              section pattern as the Tools panel above — see that panel's
              own comment. */}
          <CollapsibleSection heading="Shape inspector">
            {/* Task 60 (issue #58): position/scale/rotation/opacity/fill/
                stroke/stroke-width fields for the actively selected shape —
                see ShapeInspectorPanel.tsx's own doc comment for the
                out-of-range (clamp) policy and how it handles no
                selection/multi-selection/a hidden selection/selection
                deletion without ever showing a stale value. */}
            <ShapeInspectorPanel sceneEditor={sceneEditor} />
          </CollapsibleSection>

          <CollapsibleSection heading="Version history">
            {/* Task 41: the immutable version-history view
                (list/restore/soft-delete) — explicit Save itself now lives
                in the header (`SaveControl`, above); see
                `VersionHistoryPanel.tsx`'s own doc comment. `onRestored`
                updates `project`/`persistedVersion` from the exact version
                the server just returned — no refetch needed — so
                `isDirty` above immediately reflects the new saved state,
                and also replaces `workingCopy` with the restored snapshot,
                since restoring is meant to load that historical scene back
                into the editor. */}
            {id && (
              <VersionHistoryPanel
                projectId={id}
                project={project}
                persistedVersion={persistedVersion}
                isDirty={isDirty}
                onRestored={(version) => {
                  // Task 111 (issue #142): the restored historical version
                  // may predate the shared-layerId invariant -- see
                  // `useEditorWorkspaceState.ts`'s identical normalization
                  // on initial load.
                  const { scene: normalizedScene } = normalizeSceneLayers(version.scene_json);
                  const normalizedVersion = { ...version, scene_json: normalizedScene };
                  setPersistedVersion(normalizedVersion);
                  setWorkingCopy(structuredClone(normalizedScene));
                  setProject((current) =>
                    current ? { ...current, current_version: version.id } : current,
                  );
                  // Issue #125: restoring a historical version already
                  // persists a new authoritative version server-side, the
                  // same as an explicit Save — so, like Save, it must clear
                  // both drafts rather than the old behavior of calling
                  // `syncAfterMeaningfulAction`, which re-wrote a server
                  // draft duplicating the content this restore just
                  // persisted (and never cleared the local one at all).
                  // Passes `version.scene_json` explicitly (see
                  // `useDraftAutosave`/`useDraftServerSync`'s comments on
                  // `snapshotOverride`) rather than relying on
                  // `workingCopy`, which hasn't re-rendered into either
                  // hook's tracking yet.
                  const restoredScene = structuredClone(normalizedScene);
                  void draftAutosave.clearDraft(restoredScene);
                  void draftServerSync.deleteServerDraft(restoredScene);
                }}
              />
            )}
          </CollapsibleSection>

          <CollapsibleSection heading="Export">
            {/* Task 55: export configuration dialog. Read-only against
                version history/project metadata — it never restores a
                version or changes `project.current_version`, and its
                terminal "Export" action is an intentional stub (logs the
                assembled config) until Task 56+ builds real artifact
                generation. See `ExportConfigDialog.tsx`'s module doc
                comment. */}
            {id && <ExportConfigDialog projectId={id} project={project} />}
          </CollapsibleSection>

          <CollapsibleSection heading="AI proposals">
            {/* Task 48: AI create/edit proposal preview and acceptance.
                The proposal itself is a third state entirely inside
                AIProposalPanel/useAIProposal — nothing here is touched
                until `onAccepted` fires, which only ever happens after
                the accept endpoint has actually persisted a new version.
                Handled exactly like VersionHistoryPanel's onRestored
                above (a new scene replaces the working copy wholesale),
                plus the same draft-clearing/meaningful-action-sync Task
                42/43 already do for save/restore. */}
            {id && (
              <AIProposalPanel
                projectId={id}
                workingCopy={workingCopy}
                currentVersionId={project?.current_version ?? null}
                onAccepted={(version) => {
                  // Task 111 (issue #142): defensive normalization
                  // matching `onRestored` above -- the accepted version's
                  // base scene already comes from this session's
                  // (already-normalized) workingCopy, so this is normally
                  // a no-op, but stays consistent with every other
                  // scene_json load site rather than assuming that
                  // invariant holds without checking.
                  const { scene: normalizedScene } = normalizeSceneLayers(version.scene_json);
                  const normalizedVersion = { ...version, scene_json: normalizedScene };
                  setPersistedVersion(normalizedVersion);
                  setWorkingCopy(structuredClone(normalizedScene));
                  setProject((current) =>
                    current ? { ...current, current_version: version.id } : current,
                  );
                  // Issue #125: same treatment as `onRestored` above — an
                  // accepted AI proposal already persists a new
                  // authoritative version server-side, so it must clear
                  // both drafts rather than re-write a server draft
                  // duplicating that just-persisted content.
                  const acceptedScene = structuredClone(normalizedScene);
                  void draftAutosave.clearDraft(acceptedScene);
                  void draftServerSync.deleteServerDraft(acceptedScene);
                }}
              />
            )}
          </CollapsibleSection>

          <CollapsibleSection heading="Behaviors">
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
          </CollapsibleSection>
        </section>
      </div>
    </div>
  );
}

export default EditorWorkspace;
