import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import {
  getProject3D,
  saveSceneVersion3D,
  updateProjectMetadata3D,
  type Project3D,
  type SceneVersion3D,
} from '../api/projects3d';
import { resourceOwnershipStatus } from '../auth/resourceOwnership';
import { useAuth } from '../auth/useAuth';
import { validateProjectMetadataForPrivateSave } from '../validation/projectMetadata';
import { resolveScene3DRenderer, validateScene3D } from '../validation/scene3d';
import {
  generateScene3DBundle,
  triggerScene3DBundleDownload,
} from '../export/generateHtmlExport3D';
import AIProposalPanel3D from './AIProposalPanel3D';
import Outline3DInspector from './Outline3DInspector';
import PlaneSelectionOverlay from './PlaneSelectionOverlay';
import PublishControl3D from './PublishControl3D';
import Scene3DCodeEditor from './Scene3DCodeEditor';
import Scene3DPreview from './Scene3DPreview';
import {
  DRAWING_PLANE_MAX_POINTS,
  DRAWING_PLANE_MAX_SHAPES,
  DRAWING_PLANE_RESOLUTION,
} from './drawingPlaneDefaults';
import type { Group3D, Object3D, Scene3DDocument, Transform3D } from './scene3dTypes';
import { object3DLabel, type DrawingShape, type Object3DType } from './scene3dTypes';
import { type Outline3DSelection } from './Outline3DInspector';
import InkModeButton from '../components/InkModeButton';
import StageControlsPopover from '../components/StageControlsPopover';
import { InkEditor } from '../ink/InkEditor';

type LoadState = 'loading' | 'ready' | 'access-denied' | 'no-scene' | 'error';
type PreviewView = 'visual' | 'code';
type SaveState = { pending: boolean; error: string | null };
type ExportState = { pending: boolean; error: string | null };

const IDLE_SAVE_STATE: SaveState = { pending: false, error: null };
const IDLE_EXPORT_STATE: ExportState = { pending: false, error: null };

/**
 * Issue #301: inline title editing for `Project3D`, mirroring
 * `EditorWorkspace.tsx`'s `EditableProjectTitle` -- scoped to just `title`
 * (no description/tags fields exist to edit here), writing through
 * `updateProjectMetadata3D` with no navigation or reload.
 */
function EditableProject3DTitle({
  id,
  project,
  setProject,
}: {
  id: string | undefined;
  project: Project3D | null;
  setProject: Dispatch<SetStateAction<Project3D | null>>;
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
      const updated = await updateProjectMetadata3D(id, { title: draft });
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
      <label htmlFor="project3d-title-input">Title</label>
      <input
        id="project3d-title-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'project3d-title-error' : undefined}
        autoFocus
      />
      <button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button type="button" onClick={cancelEditing}>
        Cancel
      </button>
      {error && (
        <p id="project3d-title-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * Issue #226/#227/#229/#234: makes a `scene3d` project openable, with the
 * outline/inspector panel (#227) and the embedded Code tab (#229, saves
 * through #228's endpoint directly on blur). #234 adds the outline/
 * inspector's own explicit Save action -- until now its edits were only
 * ever held in memory. No real Three.js/A-Frame rendering yet.
 */
function Project3DWorkspace({ initialProjectId }: { initialProjectId?: string } = {}) {
  const { id: routeId } = useParams<{ id: string }>();
  const id = initialProjectId ?? routeId;
  const auth = useAuth();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [project, setProject] = useState<Project3D | null>(null);
  const [workingScene, setWorkingScene] = useState<Scene3DDocument | null>(null);
  // Issue #234: the last-saved scene, tracked separately from
  // `workingScene` so a dirty check (`workingScene !== persistedScene`,
  // by reference -- every mutation path replaces the object wholesale,
  // matching the 2D editor's `workingCopy`/`persistedVersion` convention)
  // can tell the user whether there's anything to save.
  const [persistedScene, setPersistedScene] = useState<Scene3DDocument | null>(null);
  const [selectedOutlineItem, setSelectedOutlineItem] = useState<Outline3DSelection>(null);
  // #781: the drawing plane currently being drawn on (Draw mode), or null.
  const [drawObjectId, setDrawObjectId] = useState<string | null>(null);
  // #782: lets the stage (a click on an object, Escape) drive the outline selection.
  const [selectionRequest, setSelectionRequest] = useState<{
    selection: Outline3DSelection;
    nonce: number;
  }>({ selection: null, nonce: 0 });
  // #782: a drag gesture edits the scene transiently and is folded into ONE undo step when it ends.
  const gestureBaseRef = useRef<Scene3DDocument | null>(null);
  // #796: true while a handle drag is in flight (the A-Frame stage holds its last render meanwhile).
  const [gestureActive, setGestureActive] = useState(false);
  const workingSceneRef = useRef<Scene3DDocument | null>(null);
  workingSceneRef.current = workingScene;
  const [undoStack, setUndoStack] = useState<Scene3DDocument[]>([]);
  const [redoStack, setRedoStack] = useState<Scene3DDocument[]>([]);
  const [previewView, setPreviewView] = useState<PreviewView>('visual');
  const [saveState, setSaveState] = useState<SaveState>(IDLE_SAVE_STATE);
  // Issue #290: a standalone export/download action, always against the
  // current `workingScene` (never a stale/persisted copy), so the
  // downloaded bundle always reflects unsaved edits too -- matching the
  // acceptance criterion that export never uses cached output.
  const [exportState, setExportState] = useState<ExportState>(IDLE_EXPORT_STATE);
  async function handleExport(
    variant: import('../export/generateHtmlExport3D').Scene3DExportVariant = 'full',
  ) {
    if (!workingScene) return;
    setExportState({ pending: true, error: null });
    try {
      const result = await generateScene3DBundle(workingScene, project?.title ?? 'scene', {
        variant,
      });
      if (!result.ok) {
        setExportState({ pending: false, error: result.reasons.join(' ') });
        return;
      }
      triggerScene3DBundleDownload(result.zipBlob, result.filename);
      setExportState(IDLE_EXPORT_STATE);
    } catch {
      setExportState({
        pending: false,
        error: 'Something went wrong generating the export. Please try again.',
      });
    }
  }
  // Issue #283: this manual 3D editor previously had no AI panel at all
  // (unlike its 2D counterpart's always-present "AI proposals" section) --
  // mounted only while a whole-scene "Ask AI to improve this scene"
  // request is active, mirroring the 2D manual editor's "Ask AI to fix
  // this"/"Ask AI to change this" floating-panel pattern (#159/#282).
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiSeed, setAiSeed] = useState<{ prompt: string; nonce: number } | null>(null);
  const handleAskAiImproveScene = () => {
    setAiSeed({ prompt: 'Improve this scene: ', nonce: Date.now() });
    setShowAiPanel(true);
  };
  // Issue #284: per-item counterpart of the whole-scene action above,
  // seeded from a specific outline row (post-#281's redesign) rather than
  // a generic prompt -- mirrors #282's 2D `handleAskAiChangeLayer` exactly.
  const handleAskAiChangeItem = (label: string) => {
    setAiSeed({ prompt: `Change ${label}: `, nonce: Date.now() });
    setShowAiPanel(true);
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadState('loading');

    getProject3D(id)
      .then((loadedProject) => {
        if (cancelled) return;
        setProject(loadedProject);
        if (loadedProject.current_version) {
          const scene = loadedProject.current_version.scene_json as unknown as Scene3DDocument;
          setWorkingScene(scene);
          setPersistedScene(scene);
          setLoadState('ready');
        } else {
          setLoadState('no-scene');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setLoadState('access-denied');
          return;
        }
        setLoadState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loadState === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading 3D editor…
      </p>
    );
  }

  if (loadState === 'access-denied') {
    return (
      <p role="alert" aria-live="assertive">
        This project doesn't exist, or you don't have access to it.
      </p>
    );
  }

  if (loadState === 'no-scene') {
    return (
      <p role="alert" aria-live="assertive">
        This project has no saved scene yet.
      </p>
    );
  }

  if (loadState === 'error') {
    return (
      <p role="alert" aria-live="assertive">
        Something went wrong loading this project. Please try again.
      </p>
    );
  }

  // Issue #458: PROJECT3D_READ deliberately lets any visitor -- signed
  // out included -- fetch a *published* project's detail response, so a
  // successful load here doesn't mean the viewer owns it. Redirect
  // anyone but the actual owner to the read-only public viewer instead
  // of rendering Edit/Publish/Save controls; a private project already
  // 404s for a non-owner before reaching this point.
  // `useAuth()` resolving is not itself a reason to block rendering --
  // treat "still pending" as "not yet confirmed non-owner" so the real
  // owner's fast common case (auth resolves in one quick request) never
  // shows an extra loading flash; a genuine non-owner is still redirected
  // the moment auth resolves.
  if (resourceOwnershipStatus(auth, project?.owner) === false) {
    return <Navigate to={`/p3d/${id}`} replace />;
  }

  if (!workingScene || !id) return null; // unreachable once loadState === 'ready'
  const currentScene = workingScene;

  // Shared by both save paths in this editor (the Code tab's on-blur save,
  // and #234's explicit outline/inspector Save button) -- syncs
  // workingScene/persistedScene/project.current_version from the server's
  // exact response, matching the 2D editor's handleVersionSaved pattern.
  function handleVersionSaved(version: SceneVersion3D) {
    const scene = version.scene_json as unknown as Scene3DDocument;
    setWorkingScene(scene);
    setPersistedScene(scene);
    setProject((current) => (current ? { ...current, current_version: version } : current));
    setUndoStack([]);
    setRedoStack([]);
  }

  /**
   * #784: an accepted AI proposal selects the drawing plane it created or changed, so the same
   * on-canvas handles and floating toolbar (#782) are there for manual follow-up.
   */
  function handleAiAccepted(version: SceneVersion3D) {
    const previousScene = workingScene;
    const before = previousScene?.objects ?? [];
    handleVersionSaved(version);
    // Undo steps back to the pre-proposal scene (as an unsaved working-copy edit).
    if (previousScene) setUndoStack([previousScene]);
    const after = (version.scene_json as unknown as Scene3DDocument).objects ?? [];
    const affected = after
      .filter((object) => object.type === 'drawingPlane')
      .filter((object) => {
        const previous = before.find((candidate) => candidate.id === object.id);
        return !previous || JSON.stringify(previous) !== JSON.stringify(object);
      })
      .at(-1);
    if (affected) requestSelection({ kind: 'object', id: affected.id });
  }

  function updateWorkingScene(next: Scene3DDocument) {
    setWorkingScene((current) => {
      if (!current || current === next) return next;
      setUndoStack((history) => [...history, current]);
      setRedoStack([]);
      return next;
    });
  }

  function createId(prefix: string, existing: string[]): string {
    let index = 1;
    while (existing.includes(`${prefix}-${index}`)) index += 1;
    return `${prefix}-${index}`;
  }

  const identityTransform: Transform3D = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    opacity: 1,
  };

  function addObject(type: Extract<Object3DType, 'sphere' | 'plane' | 'drawingPlane'>) {
    const id = createId(
      type,
      currentScene.objects.map((object) => object.id),
    );
    const object: Object3D =
      type === 'sphere'
        ? {
            id,
            name: `Sphere ${currentScene.objects.filter((item) => item.type === 'sphere').length + 1}`,
            type,
            groupId: null,
            transform: structuredClone(identityTransform),
            material: { color: '#c44b4b' },
            visible: true,
            radius: 1,
          }
        : type === 'drawingPlane'
          ? {
              id,
              name: `Drawing plane ${currentScene.objects.filter((item) => item.type === 'drawingPlane').length + 1}`,
              type,
              groupId: null,
              transform: structuredClone(identityTransform),
              material: { color: '#ffffff' },
              visible: true,
              width: 4,
              height: 3,
              doubleSided: true,
              // #781: the documented drawing resolution (4:3, matching the default 4 x 3 plane).
              drawing: {
                width: DRAWING_PLANE_RESOLUTION.width,
                height: DRAWING_PLANE_RESOLUTION.height,
                background: '#ffffff',
                shapes: [],
              },
            }
          : {
              id,
              name: `Plane ${currentScene.objects.filter((item) => item.type === 'plane').length + 1}`,
              type,
              groupId: null,
              transform: structuredClone(identityTransform),
              material: { color: '#7b7bd8' },
              visible: true,
              width: 4,
              height: 4,
            };
    // #781: the plane's material is lit, so in a scene with no lights at all the drawing would render
    // black. Adding the first drawing plane also adds a neutral ambient light so it shows true colours.
    const lights =
      type === 'drawingPlane' && currentScene.lights.length === 0
        ? [{ id: 'ambient-1', type: 'ambient' as const, color: '#ffffff', intensity: 1 }]
        : currentScene.lights;
    updateWorkingScene({ ...currentScene, lights, objects: [...currentScene.objects, object] });
    setSelectedOutlineItem({ kind: 'object', id });
  }

  function selectedObject(): Object3D | undefined {
    return selectedOutlineItem?.kind === 'object'
      ? currentScene.objects.find((object) => object.id === selectedOutlineItem.id)
      : undefined;
  }

  const drawTarget = drawObjectId
    ? currentScene.objects.find(
        (object) => object.id === drawObjectId && object.type === 'drawingPlane',
      )
    : undefined;

  function requestSelection(selection: Outline3DSelection) {
    setSelectionRequest((current) => ({ selection, nonce: current.nonce + 1 }));
  }

  function replaceObject(next: Object3D): Scene3DDocument {
    return {
      ...currentScene,
      objects: currentScene.objects.map((object) => (object.id === next.id ? next : object)),
    };
  }

  function beginGesture() {
    gestureBaseRef.current = workingSceneRef.current;
    setGestureActive(true);
  }

  function changeGesture(next: Object3D) {
    setWorkingScene((scene) =>
      scene
        ? {
            ...scene,
            objects: scene.objects.map((object) => (object.id === next.id ? next : object)),
          }
        : scene,
    );
  }

  function endGesture() {
    const base = gestureBaseRef.current;
    gestureBaseRef.current = null;
    setGestureActive(false);
    if (!base) return;
    // Defer one tick so `workingSceneRef` reflects the gesture's last transient edit.
    window.setTimeout(() => {
      if (workingSceneRef.current === base) return;
      setUndoStack((history) => [...history, base]);
      setRedoStack([]);
    }, 0);
  }

  const overlayObject =
    selectedOutlineItem?.kind === 'object' && drawObjectId === null
      ? currentScene.objects.find(
          (object) => object.id === selectedOutlineItem.id && object.type === 'drawingPlane',
        )
      : undefined;

  function confirmDrawing(shapes: DrawingShape[]) {
    if (!drawTarget?.drawing) return;
    const drawing = drawTarget.drawing;
    updateWorkingScene({
      ...currentScene,
      objects: currentScene.objects.map((object) =>
        object.id === drawTarget.id ? { ...object, drawing: { ...drawing, shapes } } : object,
      ),
    });
    setDrawObjectId(null);
  }

  function deleteSelected() {
    if (selectedOutlineItem?.kind === 'object') {
      updateWorkingScene({
        ...currentScene,
        objects: currentScene.objects.filter((object) => object.id !== selectedOutlineItem.id),
      });
      setSelectedOutlineItem(null);
    } else if (selectedOutlineItem?.kind === 'group') {
      updateWorkingScene({
        ...currentScene,
        groups: currentScene.groups.filter((group) => group.id !== selectedOutlineItem.id),
        objects: currentScene.objects.map((object) =>
          object.groupId === selectedOutlineItem.id ? { ...object, groupId: null } : object,
        ),
      });
      setSelectedOutlineItem(null);
    }
  }

  function duplicateSelected() {
    const source = selectedObject();
    if (!source) return;
    const id = createId(
      'object',
      currentScene.objects.map((object) => object.id),
    );
    const duplicate: Object3D = {
      ...structuredClone(source),
      id,
      name: `${object3DLabel(source, currentScene.objects)} copy`,
      transform: {
        ...source.transform,
        position: { ...source.transform.position, x: source.transform.position.x + 1 },
      },
    };
    updateWorkingScene({ ...currentScene, objects: [...currentScene.objects, duplicate] });
    setSelectedOutlineItem({ kind: 'object', id });
  }

  function addGroup() {
    const id = createId(
      'group',
      currentScene.groups.map((group) => group.id),
    );
    const group: Group3D = {
      id,
      name: `Group ${currentScene.groups.length + 1}`,
      transform: structuredClone(identityTransform),
      visible: true,
      locked: false,
    };
    updateWorkingScene({ ...currentScene, groups: [...currentScene.groups, group] });
    setSelectedOutlineItem({ kind: 'group', id });
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setUndoStack((history) => history.slice(0, -1));
    setRedoStack((history) => [...history, currentScene]);
    setWorkingScene(previous);
  }

  function redo() {
    const next = redoStack.at(-1);
    if (!next) return;
    setRedoStack((history) => history.slice(0, -1));
    setUndoStack((history) => [...history, currentScene]);
    setWorkingScene(next);
  }

  // Issue #234: validates client-side (the server's validate_scene3d
  // remains authoritative) before ever posting, mirroring the 2D manual
  // editor's pre-save validation.
  async function handleSave() {
    if (!id || !workingScene) return;
    const validation = validateScene3D(workingScene);
    if (!validation.valid) {
      const detail = validation.errors
        .slice(0, 3)
        .map((e) => `${e.path}: ${e.message}`)
        .join('; ');
      setSaveState({ pending: false, error: detail || 'This scene failed validation.' });
      return;
    }
    setSaveState({ pending: true, error: null });
    try {
      const version = await saveSceneVersion3D(id, workingScene);
      setSaveState(IDLE_SAVE_STATE);
      handleVersionSaved(version);
    } catch {
      setSaveState({ pending: false, error: 'Something went wrong saving. Please try again.' });
    }
  }

  const isDirty = workingScene !== persistedScene;

  return (
    <div>
      <header className="editor-workspace-header">
        <EditableProject3DTitle id={id} project={project} setProject={setProject} />
        {id && <PublishControl3D id={id} project={project} setProject={setProject} />}
        {workingScene && (
          // #771/#772: the piece's explicit rendering library. Changing it is an undoable edit
          // that is saved as a new version like any other scene change.
          <label className="editor-engine-label" htmlFor="project3d-engine-select">
            Rendering library
            <select
              id="project3d-engine-select"
              data-testid="project3d-engine"
              value={resolveScene3DRenderer(workingScene)}
              onChange={(event) =>
                updateWorkingScene({
                  ...workingScene,
                  renderer: { preferred: event.target.value as 'threejs' | 'aframe' },
                })
              }
            >
              <option value="threejs">Three.js</option>
              <option value="aframe">A-Frame</option>
            </select>
          </label>
        )}
        <p
          role="status"
          aria-live="polite"
          data-testid="project3d-save-status"
          className="editor-save-status"
        >
          {isDirty
            ? 'Unsaved changes'
            : `Saved${project?.current_version ? ` as version ${project.current_version.sequence}` : ''}`}
        </p>
        {saveState.error && (
          <p role="alert" aria-live="assertive" data-testid="project3d-save-error">
            {saveState.error}
          </p>
        )}
        {exportState.error && (
          <p role="alert" aria-live="assertive" data-testid="project3d-export-error">
            {exportState.error}
          </p>
        )}
      </header>
      <div className="project3d-workspace editor-workspace">
        {/* Task 246 (issue #304): a real `.editor-panel` region, scoped
            under `.project3d-workspace` so its grid-row/column rules don't
            inherit the 2D manual editor's unscoped 5-row rules -- same
            approach as #303's `.ai-editor-workspace`. Visual/Code is a
            sub-toggle inside this panel (issue #159's convention, also
            just corrected for the 2D AI-assisted editor in #303): Preview
            itself is never hidden, so Code lives alongside it rather than
            replacing the whole panel. Previously this file hid Preview
            *and* Outline/Tools entirely while Code was active -- corrected
            here too. */}
        <section aria-label="Preview" role="region" data-panel="preview" className="editor-panel">
          <div role="radiogroup" aria-label="Preview view" className="editor-tool-group">
            <button
              type="button"
              role="radio"
              aria-checked={previewView === 'visual'}
              onClick={() => setPreviewView('visual')}
            >
              Visual
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={previewView === 'code'}
              onClick={() => setPreviewView('code')}
            >
              Code
            </button>
          </div>
          {previewView === 'code' && (
            <section aria-label="Code" role="region" data-panel="code">
              <Scene3DCodeEditor projectId={id} scene={workingScene} onSaved={handleVersionSaved} />
            </section>
          )}
          {drawTarget?.drawing && (
            <InkEditor
              width={drawTarget.drawing.width}
              height={drawTarget.drawing.height}
              initialShapes={drawTarget.drawing.shapes}
              background={drawTarget.drawing.background ?? null}
              checkerboard={!drawTarget.drawing.background}
              strokeIdPrefix="draw"
              maxPointsPerStroke={DRAWING_PLANE_MAX_POINTS}
              maxStrokes={DRAWING_PLANE_MAX_SHAPES}
              onCancel={() => setDrawObjectId(null)}
              onConfirm={confirmDrawing}
            />
          )}
          <div hidden={drawTarget !== undefined}>
            {/* Issue #244: real Three.js rendering, replacing the
                #226 placeholder. */}
            <Scene3DPreview
              frozen={drawTarget !== undefined}
              // Handles are drawn at the authored pose, so a selected plane's animation holds still.
              pauseAnimations={overlayObject !== undefined}
              holdRender={gestureActive}
              onPickObject={(objectId) =>
                requestSelection(objectId ? { kind: 'object', id: objectId } : null)
              }
              renderOverlay={
                overlayObject
                  ? (stage) => (
                      <PlaneSelectionOverlay
                        object={overlayObject}
                        group={
                          overlayObject.groupId
                            ? (currentScene.groups.find(
                                (group) => group.id === overlayObject.groupId,
                              ) ?? null)
                            : null
                        }
                        camera={stage.camera}
                        width={stage.width}
                        height={stage.height}
                        onGestureStart={beginGesture}
                        onGestureChange={changeGesture}
                        onGestureEnd={endGesture}
                        onCommit={(next) => updateWorkingScene(replaceObject(next))}
                        onEditDrawing={() => setDrawObjectId(overlayObject.id)}
                        onDuplicate={duplicateSelected}
                        onDelete={deleteSelected}
                        onDeselect={() => requestSelection(null)}
                      />
                    )
                  : undefined
              }
              scene={workingScene}
              screenshotBaseName={project?.title}
              immersiveHref={id ? `/immersive/p3d/${id}` : undefined}
              onDownload={(variant) => void handleExport(variant)}
              editorControls={
                <>
                  <span role="group" aria-label="Editor actions" className="editor-tool-group">
                    <StageControlsPopover
                      label="3D authoring"
                      panelClassName="editor-authoring-controls-panel"
                    >
                      <div
                        role="group"
                        aria-label="3D authoring actions"
                        className="editor-authoring-command-group"
                      >
                        <button
                          type="button"
                          onClick={() => addObject('sphere')}
                          aria-label="Add sphere"
                        >
                          Add sphere
                        </button>
                        <button
                          type="button"
                          onClick={() => addObject('plane')}
                          aria-label="Add plane"
                        >
                          Add plane
                        </button>
                        <button
                          type="button"
                          onClick={() => addObject('drawingPlane')}
                          aria-label="Add drawing plane"
                        >
                          Add drawing plane
                        </button>
                        <button
                          type="button"
                          onClick={deleteSelected}
                          disabled={!selectedObject()}
                          aria-label="Delete selected object"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={duplicateSelected}
                          disabled={!selectedObject()}
                          aria-label="Duplicate selected object"
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={undo}
                          disabled={undoStack.length === 0}
                          aria-label="Undo"
                        >
                          Undo
                        </button>
                        <button
                          type="button"
                          onClick={redo}
                          disabled={redoStack.length === 0}
                          aria-label="Redo"
                        >
                          Redo
                        </button>
                        <button type="button" onClick={addGroup} aria-label="Add group">
                          Add group
                        </button>
                        <button
                          type="button"
                          onClick={deleteSelected}
                          disabled={selectedOutlineItem?.kind !== 'group'}
                          aria-label="Delete selected group"
                        >
                          Delete group
                        </button>
                      </div>
                    </StageControlsPopover>
                    {selectedObject()?.type === 'drawingPlane' && (
                      <InkModeButton
                        label="Draw on plane"
                        testId="draw-plane-button"
                        active={drawTarget !== undefined}
                        onBegin={() => setDrawObjectId(selectedObject()?.id ?? null)}
                      />
                    )}
                    <button
                      type="button"
                      className="piece-stage-icon-button"
                      onClick={() => void handleSave()}
                      disabled={!isDirty || saveState.pending}
                      data-testid="project3d-save-button"
                      aria-label={saveState.pending ? 'Saving scene' : 'Save scene'}
                      title={saveState.pending ? 'Saving scene' : 'Save scene'}
                    >
                      <span aria-hidden="true">▣</span>
                      <span className="piece-stage-action-label">Save scene</span>
                    </button>
                    <button
                      type="button"
                      className="piece-stage-icon-button"
                      onClick={handleAskAiImproveScene}
                      aria-label="Ask AI to improve this scene"
                      title="Ask AI to improve this scene"
                    >
                      <span aria-hidden="true">✦</span>
                      <span className="piece-stage-action-label">Ask AI to improve this scene</span>
                    </button>
                  </span>
                </>
              }
            />
          </div>
        </section>
        <Outline3DInspector
          scene={workingScene}
          onChange={updateWorkingScene}
          onSelectionChange={setSelectedOutlineItem}
          requestedSelection={selectionRequest}
          onAskAiChange={handleAskAiChangeItem}
        />
        <section aria-label="Tools" role="region" data-panel="tools" className="editor-panel">
          {showAiPanel && (
            <section
              aria-label="Ask AI to improve this scene"
              role="region"
              data-testid="project3d-ai-improve-panel"
            >
              <button type="button" onClick={() => setShowAiPanel(false)}>
                Close
              </button>
              <AIProposalPanel3D
                projectId={id}
                workingCopy={workingScene}
                currentVersionId={project?.current_version?.id ?? null}
                onAccepted={handleAiAccepted}
                seed={aiSeed}
              />
            </section>
          )}
        </section>
      </div>
    </div>
  );
}

export default Project3DWorkspace;
