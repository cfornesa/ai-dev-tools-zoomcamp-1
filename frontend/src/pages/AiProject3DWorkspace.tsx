import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getProject3D, type Project3D } from '../api/projects3d';
import type { Scene3DDocument } from './scene3dTypes';

type LoadState = 'loading' | 'ready' | 'access-denied' | 'no-scene' | 'error';

/**
 * Issue #231: the 3D counterpart of #223 -- a real, navigable route for
 * the 3D AI-assisted editor product, reusing #226's groundwork (fetch
 * pattern, preview placeholder) rather than reimplementing independently,
 * per #215's "not four independent implementations." No outline/
 * inspector (that's the 3D manual editor's concept, #227), no AI prompt
 * panel yet (#232), no embedded code editor yet (#233).
 */
function AiProject3DWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [project, setProject] = useState<Project3D | null>(null);
  const [scene, setScene] = useState<Scene3DDocument | null>(null);

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

  if (!scene) return null; // unreachable once loadState === 'ready'

  return (
    <div>
      <header className="editor-workspace-header">
        <h2>{project?.title}</h2>
      </header>
      <section aria-label="Preview" role="region" data-panel="preview">
        {/* Issue #226/#231: a placeholder -- real Three.js/A-Frame
            rendering is a future follow-on, filed once this UI's shape
            is concrete. */}
        <div className="project3d-preview-placeholder" data-testid="project3d-preview-placeholder">
          <p>3D preview is not yet available.</p>
          <p>
            {scene.objects.length} object(s), {scene.lights.length} light(s), {scene.groups.length}{' '}
            group(s) in this scene.
          </p>
        </div>
      </section>
    </div>
  );
}

export default AiProject3DWorkspace;
