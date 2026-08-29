import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getProject3D, type Project3D } from '../api/projects3d';

type LoadState = 'loading' | 'ready' | 'access-denied' | 'no-scene' | 'error';

/**
 * Issue #226: the smallest slice that makes a `scene3d` project openable
 * for the first time -- route, fetch, title display, and a placeholder
 * preview. No outline/inspector (#227), no embedded code editor (#229),
 * no way to save edits back (#228 exists at the API level but nothing
 * here writes to it yet), and no real Three.js/A-Frame rendering -- all
 * explicitly out of scope per the issue, filed as their own follow-ons.
 */
function Project3DWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [project, setProject] = useState<Project3D | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadState('loading');

    getProject3D(id)
      .then((loadedProject) => {
        if (cancelled) return;
        setProject(loadedProject);
        setLoadState(loadedProject.current_version ? 'ready' : 'no-scene');
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

  const scene = project?.current_version?.scene_json as
    { objects?: unknown[]; lights?: unknown[]; groups?: unknown[] } | undefined;

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
            {scene?.objects?.length ?? 0} object(s), {scene?.lights?.length ?? 0} light(s),{' '}
            {scene?.groups?.length ?? 0} group(s) in this scene.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Project3DWorkspace;
