import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getProject3D, type Project3D, type SceneVersion3D } from '../api/projects3d';
import AIProposalPanel3D from './AIProposalPanel3D';
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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadState('loading');

    getProject3D(id)
      .then((loadedProject) => {
        if (cancelled) return;
        setProject(loadedProject);
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

  return (
    <div>
      <header className="editor-workspace-header">
        <h2>{project?.title}</h2>
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
                #226/#231 placeholder. */}
            <Scene3DPreview scene={scene} />
          </section>
          {/* Issue #232: the prompt panel is this editor's primary
              interaction surface, not tucked into a collapsible section
              -- same "prompt-first" convention as #224's 2D
              AiEditorWorkspace.tsx. */}
          <section aria-label="AI assistant" role="region" data-panel="ai-assistant">
            <AIProposalPanel3D
              projectId={id}
              workingCopy={scene}
              currentVersionId={project?.current_version?.id ?? null}
              onAccepted={handleVersionPersisted}
            />
          </section>
        </>
      )}
      {previewView === 'code' && (
        <section aria-label="Code" role="region" data-panel="code">
          <Scene3DCodeEditor projectId={id} scene={scene} onSaved={handleVersionPersisted} />
        </section>
      )}
    </div>
  );
}

export default AiProject3DWorkspace;
