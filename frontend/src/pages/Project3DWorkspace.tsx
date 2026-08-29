import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getProject3D, type Project3D, type SceneVersion3D } from '../api/projects3d';
import Outline3DInspector from './Outline3DInspector';
import Scene3DCodeEditor from './Scene3DCodeEditor';
import type { Scene3DDocument } from './scene3dTypes';

type LoadState = 'loading' | 'ready' | 'access-denied' | 'no-scene' | 'error';
type PreviewView = 'visual' | 'code';

/**
 * Issue #226/#227/#229: makes a `scene3d` project openable, with the
 * outline/inspector panel (#227, in-memory only -- see #234 for wiring
 * its edits to persistence) and the embedded Code tab (#229, which DOES
 * save through #228's endpoint per that issue's own explicit
 * requirement). No real Three.js/A-Frame rendering yet.
 */
function Project3DWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [project, setProject] = useState<Project3D | null>(null);
  const [workingScene, setWorkingScene] = useState<Scene3DDocument | null>(null);
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
          setWorkingScene(loadedProject.current_version.scene_json as unknown as Scene3DDocument);
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

  // Issue #229: a save through the Code tab is the one path in this
  // editor that actually persists -- sync both the working scene (so the
  // Visual/outline views reflect it) and project.current_version.
  function handleCodeSaved(version: SceneVersion3D) {
    setWorkingScene(version.scene_json as unknown as Scene3DDocument);
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
            {/* Issue #226: a placeholder -- real Three.js/A-Frame rendering
                is a future follow-on, filed once this UI's shape is
                concrete. */}
            <div
              className="project3d-preview-placeholder"
              data-testid="project3d-preview-placeholder"
            >
              <p>3D preview is not yet available.</p>
              <p>
                {workingScene.objects.length} object(s), {workingScene.lights.length} light(s),{' '}
                {workingScene.groups.length} group(s) in this scene.
              </p>
            </div>
          </section>
          <Outline3DInspector scene={workingScene} onChange={setWorkingScene} />
        </>
      )}
      {previewView === 'code' && (
        <section aria-label="Code" role="region" data-panel="code">
          <Scene3DCodeEditor projectId={id} scene={workingScene} onSaved={handleCodeSaved} />
        </section>
      )}
    </div>
  );
}

export default Project3DWorkspace;
