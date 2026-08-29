import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getProject3D, type Project3D } from '../api/projects3d';
import Outline3DInspector from './Outline3DInspector';
import type { Scene3DDocument } from './scene3dTypes';

type LoadState = 'loading' | 'ready' | 'access-denied' | 'no-scene' | 'error';

/**
 * Issue #226/#227: makes a `scene3d` project openable, with the outline/
 * inspector panel (#227) editing a local in-memory copy of the current
 * version's scene -- no server save wiring here (that's a follow-on once
 * this UI's shape is concrete, tracked outside this issue's scope; see
 * the #227 QA notes). No embedded code editor yet (#229), no real
 * Three.js/A-Frame rendering.
 */
function Project3DWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [project, setProject] = useState<Project3D | null>(null);
  const [workingScene, setWorkingScene] = useState<Scene3DDocument | null>(null);

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

  if (!workingScene) return null; // unreachable once loadState === 'ready'

  return (
    <div>
      <header className="editor-workspace-header">
        <h2>{project?.title}</h2>
      </header>
      <section aria-label="Preview" role="region" data-panel="preview">
        {/* Issue #226: a placeholder -- real Three.js/A-Frame rendering is
            a future follow-on, filed once this UI's shape is concrete. */}
        <div className="project3d-preview-placeholder" data-testid="project3d-preview-placeholder">
          <p>3D preview is not yet available.</p>
          <p>
            {workingScene.objects.length} object(s), {workingScene.lights.length} light(s),{' '}
            {workingScene.groups.length} group(s) in this scene.
          </p>
        </div>
      </section>
      <Outline3DInspector scene={workingScene} onChange={setWorkingScene} />
    </div>
  );
}

export default Project3DWorkspace;
