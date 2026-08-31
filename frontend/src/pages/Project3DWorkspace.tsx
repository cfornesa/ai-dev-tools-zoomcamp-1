import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import {
  getProject3D,
  saveSceneVersion3D,
  type Project3D,
  type SceneVersion3D,
} from '../api/projects3d';
import { validateScene3D } from '../validation/scene3d';
import {
  generateScene3DBundle,
  triggerScene3DBundleDownload,
} from '../export/generateHtmlExport3D';
import AIProposalPanel3D from './AIProposalPanel3D';
import Outline3DInspector from './Outline3DInspector';
import Scene3DCodeEditor from './Scene3DCodeEditor';
import Scene3DPreview from './Scene3DPreview';
import type { Scene3DDocument } from './scene3dTypes';

type LoadState = 'loading' | 'ready' | 'access-denied' | 'no-scene' | 'error';
type PreviewView = 'visual' | 'code';
type SaveState = { pending: boolean; error: string | null };
type ExportState = { pending: boolean; error: string | null };

const IDLE_SAVE_STATE: SaveState = { pending: false, error: null };
const IDLE_EXPORT_STATE: ExportState = { pending: false, error: null };

/**
 * Issue #226/#227/#229/#234: makes a `scene3d` project openable, with the
 * outline/inspector panel (#227) and the embedded Code tab (#229, saves
 * through #228's endpoint directly on blur). #234 adds the outline/
 * inspector's own explicit Save action -- until now its edits were only
 * ever held in memory. No real Three.js/A-Frame rendering yet.
 */
function Project3DWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [project, setProject] = useState<Project3D | null>(null);
  const [workingScene, setWorkingScene] = useState<Scene3DDocument | null>(null);
  // Issue #234: the last-saved scene, tracked separately from
  // `workingScene` so a dirty check (`workingScene !== persistedScene`,
  // by reference -- every mutation path replaces the object wholesale,
  // matching the 2D editor's `workingCopy`/`persistedVersion` convention)
  // can tell the user whether there's anything to save.
  const [persistedScene, setPersistedScene] = useState<Scene3DDocument | null>(null);
  const [previewView, setPreviewView] = useState<PreviewView>('visual');
  const [saveState, setSaveState] = useState<SaveState>(IDLE_SAVE_STATE);
  // Issue #290: a standalone export/download action, always against the
  // current `workingScene` (never a stale/persisted copy), so the
  // downloaded bundle always reflects unsaved edits too -- matching the
  // acceptance criterion that export never uses cached output.
  const [exportState, setExportState] = useState<ExportState>(IDLE_EXPORT_STATE);
  async function handleExport() {
    if (!workingScene) return;
    setExportState({ pending: true, error: null });
    try {
      const result = await generateScene3DBundle(workingScene, project?.title ?? 'scene');
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

  if (!workingScene || !id) return null; // unreachable once loadState === 'ready'

  // Shared by both save paths in this editor (the Code tab's on-blur save,
  // and #234's explicit outline/inspector Save button) -- syncs
  // workingScene/persistedScene/project.current_version from the server's
  // exact response, matching the 2D editor's handleVersionSaved pattern.
  function handleVersionSaved(version: SceneVersion3D) {
    const scene = version.scene_json as unknown as Scene3DDocument;
    setWorkingScene(scene);
    setPersistedScene(scene);
    setProject((current) => (current ? { ...current, current_version: version } : current));
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
        <h2>{project?.title}</h2>
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
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!isDirty || saveState.pending}
          data-testid="project3d-save-button"
        >
          {saveState.pending ? 'Saving…' : 'Save'}
        </button>
        {saveState.error && (
          <p role="alert" aria-live="assertive" data-testid="project3d-save-error">
            {saveState.error}
          </p>
        )}
        {/* Issue #290: a 3D counterpart of the 2D manual editor's
            ExportConfigDialog.tsx -- a single button, not a full dialog,
            since scene3d has no interaction modes/camera overlay to
            configure (documented implementation decision: the 2D dialog
            isn't a clean fit here, per the issue's own escape hatch). */}
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exportState.pending}
          data-testid="project3d-export-button"
        >
          {exportState.pending ? 'Generating export…' : 'Download standalone bundle'}
        </button>
        {exportState.error && (
          <p role="alert" aria-live="assertive" data-testid="project3d-export-error">
            {exportState.error}
          </p>
        )}
      </header>
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
      {previewView === 'visual' && (
        <>
          <section aria-label="Preview" role="region" data-panel="preview">
            {/* Issue #244: real Three.js rendering, replacing the
                #226 placeholder. */}
            <Scene3DPreview scene={workingScene} screenshotBaseName={project?.title} />
          </section>
          <Outline3DInspector scene={workingScene} onChange={setWorkingScene} />
          <div role="group" aria-label="Whole-scene AI actions" className="editor-tool-group">
            <button type="button" onClick={handleAskAiImproveScene}>
              Ask AI to improve this scene
            </button>
          </div>
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
                onAccepted={handleVersionSaved}
                seed={aiSeed}
              />
            </section>
          )}
        </>
      )}
      {previewView === 'code' && (
        <section aria-label="Code" role="region" data-panel="code">
          <Scene3DCodeEditor projectId={id} scene={workingScene} onSaved={handleVersionSaved} />
        </section>
      )}
    </div>
  );
}

export default Project3DWorkspace;
