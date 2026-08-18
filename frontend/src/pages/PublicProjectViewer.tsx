import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getPublicProject, type PublicProject } from '../api/projects';
import CameraControl from '../components/CameraControl';
import { createP5ScenePreview, type P5ScenePreview } from '../render/p5Adapter';
import DemoControlsPanel from './DemoControlsPanel';

type LoadState = 'loading' | 'ready' | 'unavailable' | 'error';

/**
 * Task 51 (issue #53): the anonymous-reachable public project viewer —
 * `_docs/plan.md`'s "Public viewing" section, and the page Task 50's
 * public gallery cards link to (that task deliberately left cards
 * non-clickable; see `PublicGallery.tsx`'s own docstring).
 *
 * Fetches `GET /api/public/projects/<public_id>/` (`PublicProjectDetailView`,
 * Task 49) and renders exactly, and only, the `current_version.scene_json`
 * that response returns through the Task 25 p5 adapter — the same
 * `createP5ScenePreview` the authenticated editor (`EditorWorkspace.tsx`)
 * uses, not a second rendering pipeline. There is no draft, unsaved edit,
 * or AI-proposal state anywhere in this component: `PublicProjectSerializer`
 * (`scenes/serializers.py`) never returns any of that to begin with, so
 * "only the current saved validated version" holds structurally rather
 * than by this component's own discipline alone.
 *
 * Camera, demo signals, and reduced motion are the exact same components/
 * hooks the authenticated editor uses — `CameraControl`, `DemoControlsPanel`,
 * and the global `ReducedMotionControl` (rendered once in `Layout.tsx`,
 * which wraps this route too) — never reimplemented here. In particular,
 * nothing in this file calls `getUserMedia` or constructs a tracking
 * provider itself: `CameraControl` only does that lazily, inside its own
 * `Enable camera` click handler, so this page starts in non-camera demo
 * mode and never requests camera permission on mount (acceptance
 * criterion).
 *
 * "Unavailable" (never-existed, not-yet-published, unpublished mid-session,
 * or deleted) is a single, deliberately undifferentiated state:
 * `PublicProjectDetailView` 404s identically for all four cases (see its
 * own docstring), so this page can't and doesn't distinguish them either
 * — the rendered message never confirms or denies that a private project
 * with this id exists.
 */
function PublicProjectViewer() {
  const { id } = useParams<{ id: string }>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [project, setProject] = useState<PublicProject | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const previewMountRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<P5ScenePreview | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadState('loading');
    setProject(null);

    getPublicProject(id)
      .then((fetched) => {
        if (cancelled) return;
        setProject(fetched);
        setLoadState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
          setLoadState('unavailable');
        } else {
          setLoadState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Same pattern as EditorWorkspace.tsx's Task 25 wiring: mount the p5
  // instance once, tear it down on unmount, and never mount it into a div
  // React itself reconciles children into.
  useEffect(() => {
    if (!previewMountRef.current) return;
    const preview = createP5ScenePreview(previewMountRef.current);
    previewRef.current = preview;
    return () => {
      preview.destroy();
      previewRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!previewRef.current || !project?.current_version) return;
    try {
      previewRef.current.render(project.current_version.scene_json);
      setPreviewError(null);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Could not render this scene.');
    }
  }, [project]);

  if (loadState === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading project…
      </p>
    );
  }

  if (loadState === 'unavailable') {
    return (
      <div>
        <p role="alert" aria-live="assertive">
          This project isn't available. It may have been unpublished, deleted, or never existed.
        </p>
        <p>
          <Link to="/gallery">Back to the public gallery</Link>
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
        <p>
          <Link to="/gallery">Back to the public gallery</Link>
        </p>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="public-project-viewer">
      <header>
        <h2>{project.title}</h2>
        {project.description && <p>{project.description}</p>}
        <p className="public-project-attribution">By {project.owner}</p>
      </header>

      <div className="editor-workspace">
        <section role="region" aria-label="Preview" data-panel="preview" className="editor-panel">
          <h3>Preview</h3>
          {previewError && (
            <p role="alert" aria-live="assertive">
              Couldn't render the preview: {previewError}
            </p>
          )}
          <div
            data-testid="public-scene-canvas"
            aria-label="Scene canvas"
            className="editor-scene-canvas"
            style={{ position: 'relative', width: 800, height: 600, maxWidth: '100%' }}
          >
            {/* Task 25's p5.js preview mounts its <canvas> into this div;
                see EditorWorkspace.tsx's identical comment for why React
                is never given children to reconcile here. */}
            <div
              ref={previewMountRef}
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, zIndex: -1 }}
            />
          </div>
        </section>

        <section role="region" aria-label="Demo and camera controls" className="editor-panel">
          {/* Task 31: the exact same camera permission/privacy control the
              authenticated editor uses (`CameraControl.tsx`) — notice,
              status, stop, and denial/unsupported/failure messaging, all
              unchanged. Never auto-starts; only its own `Enable camera`
              button can ever request camera access. */}
          <CameraControl />

          {/* Task 28: the exact same demo signal controls the authenticated
              editor uses (`DemoControlsPanel.tsx`) — this is the
              deterministic non-camera mode this page starts in by
              default. */}
          <DemoControlsPanel />
        </section>
      </div>
    </div>
  );
}

export default PublicProjectViewer;
