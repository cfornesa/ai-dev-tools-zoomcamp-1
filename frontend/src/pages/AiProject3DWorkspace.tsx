import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import {
  getProject3D,
  updateProjectMetadata3D,
  type Project3D,
  type SceneVersion3D,
} from '../api/projects3d';
import {
  generateScene3DBundle,
  triggerScene3DBundleDownload,
} from '../export/generateHtmlExport3D';
import AIProposalPanel3D from './AIProposalPanel3D';
import PublishControl3D from './PublishControl3D';
import Scene3DCodeEditor from './Scene3DCodeEditor';
import Scene3DPreview from './Scene3DPreview';
import type { Scene3DDocument } from './scene3dTypes';

type LoadState = 'loading' | 'ready' | 'access-denied' | 'no-scene' | 'error';
type PreviewView = 'visual' | 'code';

/**
 * Issue #231/#232/#233: the 3D counterpart of #223/#224/#225 -- a real,
 * navigable route for the 3D AI-assisted editor product, reusing #226's
 * groundwork (fetch pattern, preview placeholder) rather than
 * reimplementing independently, per #215's "not four independent
 * implementations." No outline/inspector (that's the 3D manual editor's
 * concept, #227). The Code tab (#233) reuses Scene3DCodeEditor.tsx
 * unchanged from #229 -- it takes no dependency on the outline/inspector,
 * so the same validate-via-validate_scene3d-then-save-via-#228 component
 * works for both the manual and AI-assisted 3D editors.
 */
function AiProject3DWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [project, setProject] = useState<Project3D | null>(null);
  const [scene, setScene] = useState<Scene3DDocument | null>(null);
  const [previewView, setPreviewView] = useState<PreviewView>('visual');
  // Issue #301: mirrors AiEditorWorkspace.tsx's title-input/onBlur-save
  // pattern -- no separate "Edit title" affordance (unlike the manual 3D
  // editor's `EditableProject3DTitle`), matching the 2D AI-assisted
  // editor's own lighter convention for this same asymmetry.
  const [title, setTitle] = useState('');
  const [titleSaving, setTitleSaving] = useState(false);
  // Issue #283: this panel is already always-present (the whole point of
  // the AI-assisted editor), so "Ask AI to improve this scene" just
  // re-seeds it into Edit mode with a generic prompt rather than mounting
  // a second instance -- unlike the manual 3D editor
  // (`Project3DWorkspace.tsx`), which had no AI panel to reuse.
  const [aiSeed, setAiSeed] = useState<{ prompt: string; nonce: number } | null>(null);
  const handleAskAiImproveScene = () => {
    setAiSeed({ prompt: 'Improve this scene: ', nonce: Date.now() });
  };

  // Issue #291: same wiring as #290's manual-editor export, always
  // against the current `scene` state -- already updated the instant an
  // AI proposal is accepted (`handleVersionPersisted` below), so this
  // never reflects a stale/cached version.
  const [exportState, setExportState] = useState<{ pending: boolean; error: string | null }>({
    pending: false,
    error: null,
  });
  async function handleExport(
    variant: import('../export/generateHtmlExport3D').Scene3DExportVariant = 'full',
  ) {
    if (!scene) return;
    setExportState({ pending: true, error: null });
    try {
      const result = await generateScene3DBundle(scene, project?.title ?? 'scene', { variant });
      if (!result.ok) {
        setExportState({ pending: false, error: result.reasons.join(' ') });
        return;
      }
      triggerScene3DBundleDownload(result.zipBlob, result.filename);
      setExportState({ pending: false, error: null });
    } catch {
      setExportState({
        pending: false,
        error: 'Something went wrong generating the export. Please try again.',
      });
    }
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadState('loading');

    getProject3D(id)
      .then((loadedProject) => {
        if (cancelled) return;
        setProject(loadedProject);
        setTitle(loadedProject.title);
        if (loadedProject.current_version) {
          setScene(loadedProject.current_version.scene_json as unknown as Scene3DDocument);
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
        Loading 3D AI-assisted editor…
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

  if (!scene || !id) return null; // unreachable once loadState === 'ready'

  // Issue #232/#233: applies an accepted AI proposal or a saved Code-tab
  // edit exactly like AiEditorWorkspace.tsx's handleAccepted -- the
  // server has already persisted `version`, so this just syncs local
  // state from it. Both paths converge here since both hand back the
  // same SceneVersion3D shape.
  function handleVersionPersisted(version: SceneVersion3D) {
    setScene(version.scene_json as unknown as Scene3DDocument);
    setProject((current) => (current ? { ...current, current_version: version } : current));
  }

  async function handleTitleBlur() {
    if (!id || !project || title === project.title) return;
    setTitleSaving(true);
    try {
      const updated = await updateProjectMetadata3D(id, { title });
      setProject(updated);
    } catch {
      setTitle(project.title); // revert on failure
    } finally {
      setTitleSaving(false);
    }
  }

  return (
    <div>
      <header className="editor-workspace-header">
        <input
          className="ai-editor-title-input"
          aria-label="Project title"
          value={title}
          disabled={titleSaving}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => void handleTitleBlur()}
        />
        {exportState.error && (
          <p role="alert" aria-live="assertive" data-testid="ai-project3d-export-error">
            {exportState.error}
          </p>
        )}
      </header>
      <div className="ai-project3d-workspace editor-workspace">
        {/* Task 247 (issue #305): a real `.editor-panel` region, scoped
            under `.ai-project3d-workspace` so its grid-row/column rules
            don't inherit the 2D manual editor's unscoped 5-row rules --
            same approach as #303/#304. Visual/Code is a sub-toggle inside
            this panel (issue #159's convention): Preview is never hidden,
            so Code lives alongside it rather than replacing the whole
            panel plus AI assistant/Tools entirely, which is what this file
            did before this fix. */}
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
              <Scene3DCodeEditor projectId={id} scene={scene} onSaved={handleVersionPersisted} />
            </section>
          )}
          <div>
            {/* Issue #244: real Three.js rendering, replacing the
                #226/#231 placeholder. */}
            <Scene3DPreview
              scene={scene}
              screenshotBaseName={project?.title}
              onDownload={(variant) => void handleExport(variant)}
              editorControls={
                <>
                  <button
                    type="button"
                    className="piece-stage-icon-button"
                    onClick={handleAskAiImproveScene}
                    aria-label="Ask AI to improve this scene"
                    title="Ask AI to improve this scene"
                  >
                    <span aria-hidden="true">✦</span>
                  </button>
                  <PublishControl3D id={id} project={project} setProject={setProject} compact />
                </>
              }
            />
          </div>
        </section>
        {/* Issue #232: the prompt panel is this editor's primary
            interaction surface, not tucked into a collapsible section --
            same "prompt-first" convention as #224's 2D
            AiEditorWorkspace.tsx. Task 247 (issue #305): now its own
            always-visible `.editor-panel`, no longer gated by
            `previewView`. */}
        <section
          aria-label="AI assistant"
          role="region"
          data-panel="ai-assistant"
          className="editor-panel"
        >
          <AIProposalPanel3D
            projectId={id}
            workingCopy={scene}
            currentVersionId={project?.current_version?.id ?? null}
            onAccepted={handleVersionPersisted}
            seed={aiSeed}
          />
        </section>
      </div>
    </div>
  );
}

export default AiProject3DWorkspace;
