import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { forkProject, getPublicProject, type PublicProject } from '../api/projects';
import { useAuth } from '../auth/useAuth';
import CameraControl from '../components/CameraControl';
import { createP5ScenePreview, type P5ScenePreview } from '../render/p5Adapter';
import { normalizeSceneLayers } from '../validation/scene';
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
 *
 * ## Remix provenance (Task 53, issue #52)
 *
 * `project.remix_provenance` is `null` for an original project — nothing
 * renders for that case. When present, the header carries
 * `data-project-kind="remix"` (an original carries `"original"`) plus a
 * visible "Remix" badge for programmatic/visual distinguishability, and a
 * "Remixed from [creator]" line linking to `/p/<source id>` when the
 * source is still public (`source_public_id` non-null), or the same
 * wording as plain unlinked text when the source has gone private,
 * unpublished, or deleted (`source_public_id` is `null`, but
 * `source_creator` is always durable — see `RemixProvenance`'s docstring
 * in `api/projects.ts` and `scenes/serializers.py`'s
 * `remix_provenance_data` for the full policy).
 *
 * ## Fork action (Task 51)
 *
 * The minimal Fork action lives here — just the button/request. The
 * button is hidden entirely for a signed-out visitor and for a project
 * with remixing turned off (`project.allow_public_remix`), matching the
 * acceptance criteria's "unavailable when ... private or remix disabled"
 * (a private project never reaches this page at all — `getPublicProject`
 * 404s first). A signed-in visitor gets one client-generated
 * `client_request_id` per click, reused on any accidental double-submit
 * from React re-render, so a double-click never risks a second fork (see
 * `ProjectForkView`'s idempotency-key docstring in `scenes/api.py`) — on
 * success, the visitor is sent straight to their new private project's
 * editor.
 */
function PublicProjectViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auth = useAuth();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [project, setProject] = useState<PublicProject | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [forkState, setForkState] = useState<'idle' | 'forking'>('idle');
  const [forkError, setForkError] = useState<string | null>(null);
  const forkRequestIdRef = useRef<string | null>(null);

  const previewRef = useRef<P5ScenePreview | null>(null);
  // Task 113 (issue #144): a *callback* ref, not a plain `useRef` +
  // `useEffect(fn, [])` pair -- porting `EditorWorkspace.tsx`'s issue #83
  // fix here too. The mount div below only exists in the DOM once
  // `loadState` reaches `'ready'`, so a `[]`-deps effect reading a plain
  // ref runs (once, on this component's first render, while still in the
  // `'loading'` early-return branch) *before* the div — and therefore
  // `previewRef.current` — ever exists, and never runs again: the p5
  // preview was silently never created for any project loaded the normal
  // (async) way. Confirmed live: no earlier test asserted an actual
  // `<canvas>` element ever appeared here, only the wrapper div's
  // visibility (see `publishingAndRemix.spec.ts`'s "publishing..."
  // scenario) -- this task's own new pixel-level rendering assertion is
  // what caught it. A callback ref sidesteps "which commit was the div
  // actually attached during": React invokes it with the real node the
  // instant it's attached, whichever commit that turns out to be.
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

  useEffect(() => {
    if (!previewRef.current || !project?.current_version) return;
    try {
      // Task 111 (issue #142): a published project's current version may
      // predate the shared-layerId invariant `render()`'s own
      // `validateScene` call now enforces -- normalize first so a legacy
      // public scene still renders, matching `useEditorWorkspaceState.ts`'s
      // identical normalization on the editor's load path.
      const { scene: normalizedScene } = normalizeSceneLayers(project.current_version.scene_json);
      previewRef.current.render(normalizedScene);
      setPreviewError(null);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Could not render this scene.');
    }
    // `previewMounted` is a real, effect-dependency-visible signal for
    // "does previewRef.current exist yet" -- see the callback ref's own
    // doc comment above for why an untracked ref read in the dependency
    // array (the old bug) isn't enough.
  }, [project, previewMounted]);

  async function handleFork() {
    if (!id) return;
    // One client_request_id per fork attempt, reused across retries of the
    // *same* click (e.g. React firing the handler twice) — a fresh id is
    // only ever generated the first time this handler runs after mount.
    if (!forkRequestIdRef.current) {
      forkRequestIdRef.current = crypto.randomUUID();
    }
    setForkState('forking');
    setForkError(null);
    try {
      const forked = await forkProject(id, forkRequestIdRef.current);
      navigate(`/projects/${forked.id}`);
    } catch {
      setForkState('idle');
      forkRequestIdRef.current = null;
      setForkError('Could not fork this project. Please try again.');
    }
  }

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

  const provenance = project.remix_provenance;

  return (
    <div className="public-project-viewer" data-project-kind={provenance ? 'remix' : 'original'}>
      <header>
        <h2>{project.title}</h2>
        {provenance && (
          <span className="remix-badge" role="status" aria-label="Remix">
            Remix
          </span>
        )}
        {project.description && <p>{project.description}</p>}
        <p className="public-project-attribution">By {project.owner}</p>

        {provenance &&
          (provenance.source_public_id ? (
            <p className="public-project-provenance" data-testid="provenance">
              Remixed from{' '}
              <Link to={`/p/${provenance.source_public_id}`}>{provenance.source_creator}</Link>
            </p>
          ) : (
            <p className="public-project-provenance" data-testid="provenance">
              Remixed from {provenance.source_creator}
            </p>
          ))}

        {auth.status === 'signed-in' && project.allow_public_remix && (
          <p>
            <button type="button" onClick={handleFork} disabled={forkState === 'forking'}>
              {forkState === 'forking' ? 'Forking…' : 'Fork this project'}
            </button>
          </p>
        )}
        {forkError && (
          <p role="alert" aria-live="assertive">
            {forkError}
          </p>
        )}
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
            role="group"
            aria-label="Scene canvas"
            className="editor-scene-canvas"
            style={{ position: 'relative', width: 800, height: 600, maxWidth: '100%' }}
          >
            {/* Task 25's p5.js preview mounts its <canvas> into this div;
                see EditorWorkspace.tsx's identical comment for why React
                is never given children to reconcile here. */}
            <div
              ref={previewMountCallbackRef}
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
