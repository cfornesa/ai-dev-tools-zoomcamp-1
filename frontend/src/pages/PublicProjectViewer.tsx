import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { forkProject, getPublicProject, type PublicProject } from '../api/projects';
import { useAuth } from '../auth/useAuth';
import CameraControl, { type CameraStatus } from '../components/CameraControl';
import {
  clampCameraOverlayGeometry,
  getCameraOverlayLayerOrder,
  useCameraOverlayGeometry,
} from '../editor/cameraOverlayGeometry';
import { useCameraOverlaySettings } from '../editor/cameraOverlaySettings';
import { createScenePreview, resolveSceneRendererId } from '../render/createScenePreview';
import type { RenderableCameraOverlay, ScenePreview } from '../render/scenePreview';
import { normalizeSceneLayers } from '../validation/scene';
import { captureLiveScreenshot, screenshotFilename } from '../export/captureLiveScreenshot';
import { downloadBlob } from '../export/downloadBlob';
import { generateHtmlExport, triggerHtmlDownload } from '../export/generateHtmlExport';
import { getAvailableInteractionModes } from '../export/exportCompatibility';
import PieceStageToolbar from '../components/PieceStageToolbar';
import StageControlsPopover from '../components/StageControlsPopover';
import { TWO_D_STAGE_CAPABILITIES } from '../components/pieceStageCapabilities';
import DemoControlsPanel from './DemoControlsPanel';
import { useCameraOverlayRedrawLoop } from './useCameraOverlayRedrawLoop';
import { useFullscreenToggle } from './useFullscreenToggle';

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
 * ## Camera video overlay (Task 119, issue #152; compositing fixed by #195)
 *
 * Ports `EditorWorkspace.tsx`'s Task 110/118 (issues #141, #147) live
 * camera video overlay + opacity slider + mirror toggle to this page,
 * duplicating that layout JSX rather than extracting a shared component —
 * see issue #152's "Design decisions". The opacity/mirror preference reads
 * and writes through the exact same `useCameraOverlaySettings()` store
 * (`../editor/cameraOverlaySettings.ts`), not a second instance: it is
 * `localStorage`-persisted under one generic, page-agnostic key, so a
 * visitor who adjusts it here also sees it applied in the editor (and vice
 * versa) in the same browser, after reload. Issue #195: this page's
 * original port predated the editor's own Task 137/#169 compositing fix
 * and was never updated to match, so the camera image is now drawn inside
 * the p5 canvas via `getCameraOverlay`/`render()`'s `cameraOverlay`
 * argument — the same as the editor — rather than as a separately
 * CSS-stacked, always-behind-the-opaque-canvas `<video>` element. The
 * camera z-order/geometry read the same shared, editor-persisted stores
 * (`cameraOverlayGeometry.ts`) too, though this page still has no
 * drag/resize/reorder UI of its own (unchanged from #152's original
 * scope decision).
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
  // Issue #293: a copyable <iframe> embed snippet, offered on every
  // reachable render of this page -- reaching this component's "ready"
  // state at all already implies the project is published (a private/
  // unpublished/deleted/nonexistent id 404s in `loadState === 'unavailable'`
  // before ever getting here), so no separate visibility check is needed:
  // the existing load-state gate *is* the "only published projects offer
  // this" guarantee.
  const [showEmbedSnippet, setShowEmbedSnippet] = useState(false);
  const [embedCopyStatus, setEmbedCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const forkRequestIdRef = useRef<string | null>(null);

  // Task 119 (issue #152): mirrors `EditorWorkspace.tsx`'s identical
  // `cameraStatus`/`cameraStream`/`cameraVideoRef` state and `srcObject`
  // effect — see that file's own doc comments for why `cameraStatus` must
  // be in the effect's dependency array alongside `cameraStream`.
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const {
    opacity: cameraOverlayOpacity,
    mirrored: cameraOverlayMirrored,
    setOpacity: setCameraOverlayOpacity,
    setMirrored: setCameraOverlayMirrored,
  } = useCameraOverlaySettings();
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  // Issue #195: the same shared, localStorage-persisted geometry store the
  // editor's drag/resize controls write to (`cameraOverlayGeometry.ts`) --
  // this page has no drag/resize UI of its own (#151/#152 excluded it from
  // scope), but reads the same store so a visitor sees whatever position/
  // size the editor last set, consistent with how opacity/mirrored are
  // already shared above.
  const { setGeometry: _setCameraGeometry, ...cameraGeometry } = useCameraOverlayGeometry();

  useEffect(() => {
    const videoEl = cameraVideoRef.current;
    if (!videoEl) return;
    videoEl.srcObject = cameraStream;
    if (cameraStream) {
      void Promise.resolve(videoEl.play()).catch(() => {
        // Autoplay can be rejected in some environments; the video element
        // still renders (just paused) and this is not a scene-breaking
        // failure worth surfacing as `previewError`.
      });
    }
  }, [cameraStream, cameraStatus]);

  // Issue #195: the camera image is composited in the p5 canvas so artwork
  // layers can appear in front of it. The source `<video>` remains visible
  // behind that transparent canvas as a resilient public-surface fallback:
  // it makes the active camera feed observable even when a renderer cannot
  // draw a frame, while the canvas remains the authoritative layer-aware
  // composite. This matches the editor's stage layering (Task 137, issue
  // #169) without hiding the public camera surface.
  const getCameraOverlay = useCallback((): RenderableCameraOverlay | undefined => {
    if (cameraStatus !== 'active' || !cameraStream || !cameraVideoRef.current) return undefined;
    const rawLayers = project?.current_version?.scene_json.layers;
    const layers = Array.isArray(rawLayers) ? (rawLayers as { order?: unknown }[]) : [];
    const orders = layers
      .map((layer) => layer.order)
      .filter((order): order is number => typeof order === 'number');
    const defaultOrder = Math.max(-1, ...orders) + 1;
    return {
      source: cameraVideoRef.current,
      geometry: clampCameraOverlayGeometry(cameraGeometry, 800, 600),
      opacity: cameraOverlayOpacity,
      mirrored: cameraOverlayMirrored,
      layerOrder: getCameraOverlayLayerOrder(defaultOrder),
    };
  }, [
    cameraStatus,
    cameraStream,
    cameraGeometry,
    cameraOverlayOpacity,
    cameraOverlayMirrored,
    project,
  ]);

  const previewRef = useRef<ScenePreview | null>(null);
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreenToggle(previewStageRef);
  // Issue #206: "latest value" ref (same rationale as `EditorWorkspace.tsx`'s
  // `workingCopyRef`) so `previewMountCallbackRef` below -- memoized with
  // `[]` deps -- still reads whichever project is current at the moment the
  // mount div actually attaches, to pick the right renderer adapter.
  const projectRef = useRef(project);
  projectRef.current = project;
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
      previewRef.current = createScenePreview(
        node,
        resolveSceneRendererId(projectRef.current?.current_version?.scene_json),
      );
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

  // Issue #192 follow-up: a plain useCallback, not inlined into the effect
  // below, so `useCameraOverlayRedrawLoop` can call the exact same render
  // logic every animation frame while the camera is active -- see that
  // hook's own doc comment for why a single reactive render left the camera
  // overlay a frozen (or, if it raced the video's first decoded frame,
  // permanently empty) snapshot instead of a live feed.
  const redrawPreview = useCallback(() => {
    if (!previewRef.current || !project?.current_version) return;
    try {
      // Task 111 (issue #142): a published project's current version may
      // predate the shared-layerId invariant `render()`'s own
      // `validateScene` call now enforces -- normalize first so a legacy
      // public scene still renders, matching `useEditorWorkspaceState.ts`'s
      // identical normalization on the editor's load path.
      const { scene: normalizedScene } = normalizeSceneLayers(project.current_version.scene_json);
      // Issue #195: a transparent canvas background while the camera is
      // active, plus the live camera frame itself, exactly like
      // `EditorWorkspace.tsx`'s identical render call -- see
      // `getCameraOverlay`'s doc comment above for why this page's own
      // opaque-background render previously hid the camera feed almost
      // entirely regardless of the video's CSS opacity/z-index.
      previewRef.current.render(
        normalizedScene,
        [],
        [],
        cameraStatus === 'active',
        getCameraOverlay(),
      );
      setPreviewError(null);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Could not render this scene.');
    }
  }, [project, cameraStatus, getCameraOverlay]);

  useEffect(() => {
    if (!previewMounted) return;
    redrawPreview();
    // `previewMounted` is a real, effect-dependency-visible signal for
    // "does previewRef.current exist yet" -- see the callback ref's own
    // doc comment above for why an untracked ref read in the dependency
    // array (the old bug) isn't enough. `redrawPreview` itself already
    // depends on `cameraStatus`/`getCameraOverlay`/`project`, so this
    // effect re-fires whenever any of those change too.
  }, [previewMounted, redrawPreview]);

  // Issue #192 follow-up: keeps the camera overlay genuinely live -- see
  // `useCameraOverlayRedrawLoop`'s doc comment. Without this, the effect
  // above only ever redraws reactively (once per relevant state change),
  // and the camera overlay freezes at whatever single frame happened to be
  // available at that moment for the rest of the session.
  useCameraOverlayRedrawLoop(cameraStatus === 'active', redrawPreview);

  // Issue #293: targets #292's chrome-less /embed/p/:id route, not this
  // page's own /p/:id -- an iframe embedding the full-chrome page would
  // duplicate the embedding site's own nav/header inside the embed.
  function embedSnippetFor(projectId: string): string {
    const src = `${window.location.origin}/embed/p/${projectId}`;
    return `<iframe src="${src}" width="800" height="600" frameborder="0" allowfullscreen></iframe>`;
  }

  async function handleCopyEmbedSnippet() {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(embedSnippetFor(id));
      setEmbedCopyStatus('copied');
    } catch {
      setEmbedCopyStatus('failed');
    }
  }

  async function handleTakeScreenshot() {
    try {
      const blob = await captureLiveScreenshot(previewRef.current?.getCanvasElement() ?? null);
      downloadBlob(blob, screenshotFilename(project?.title ?? id ?? 'scene'));
    } catch (error) {
      setSurfaceError(error instanceof Error ? error.message : 'Screenshot failed.');
    }
  }

  function handleDownload(variant: 'full' | 'non-camera' = 'full') {
    if (!project?.current_version) return;
    const availableModes = getAvailableInteractionModes(project.current_version.scene_json);
    const interactionMode =
      variant === 'non-camera'
        ? 'demo'
        : availableModes.includes('demo-camera')
          ? 'demo-camera'
          : 'demo';
    const result = generateHtmlExport({
      scene: project.current_version.scene_json,
      title: project.title,
      description: project.description ?? '',
      interactionMode,
      includeAttribution: true,
    });
    if (!result.ok) {
      setSurfaceError(result.reasons.join(' '));
      return;
    }
    setSurfaceError(null);
    triggerHtmlDownload(result.html, result.filename);
  }

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

        <p>
          <button
            type="button"
            onClick={() => {
              setShowEmbedSnippet((current) => !current);
              setEmbedCopyStatus('idle');
            }}
            aria-expanded={showEmbedSnippet}
            data-testid="toggle-embed-snippet"
          >
            {showEmbedSnippet ? 'Hide embed code' : 'Embed'}
          </button>
        </p>
        {showEmbedSnippet && id && (
          <div className="public-project-embed-snippet" data-testid="embed-snippet-panel">
            <label htmlFor="embed-snippet-textarea">Embed this piece on another site</label>
            <textarea
              id="embed-snippet-textarea"
              readOnly
              value={embedSnippetFor(id)}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button type="button" onClick={() => void handleCopyEmbedSnippet()}>
              Copy
            </button>
            {embedCopyStatus === 'copied' && (
              <p role="status" aria-live="polite">
                Copied!
              </p>
            )}
            {embedCopyStatus === 'failed' && (
              <p role="alert" aria-live="assertive">
                Couldn't copy automatically -- select the text above and copy manually.
              </p>
            )}
          </div>
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
          <div ref={previewStageRef} className="piece-stage-shell">
            <div
              data-testid="public-scene-canvas"
              role="group"
              aria-label="Scene canvas"
              className="editor-scene-canvas"
              style={{ position: 'relative', width: 800, height: 600, maxWidth: '100%' }}
            >
              {/* Issue #195: the p5 canvas draws the layer-aware composite,
                while this visible source video sits behind its transparent
                background. That fallback keeps the public camera surface
                visibly usable if a renderer cannot draw a frame. */}
              {cameraStatus === 'active' && cameraStream && (
                <video
                  ref={cameraVideoRef}
                  data-testid="camera-overlay-video"
                  aria-hidden="true"
                  muted
                  playsInline
                  autoPlay
                  className="editor-camera-overlay"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: -2,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    visibility: 'visible',
                    transform: cameraOverlayMirrored ? 'scaleX(-1)' : 'none',
                    opacity: cameraOverlayOpacity,
                    pointerEvents: 'none',
                  }}
                />
              )}
              {/* Task 25's p5.js preview mounts its <canvas> into this div;
                see EditorWorkspace.tsx's identical comment for why React
                is never given children to reconcile here. */}
              <div
                ref={previewMountCallbackRef}
                aria-hidden="true"
                style={{ position: 'absolute', inset: 0, zIndex: -1 }}
              />
              <PieceStageToolbar
                onScreenshot={() => void handleTakeScreenshot()}
                onDownload={(variant) => handleDownload(variant)}
                capabilities={TWO_D_STAGE_CAPABILITIES}
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => void toggleFullscreen()}
                controlsControl={
                  <StageControlsPopover>
                    <CameraControl
                      onStatusChange={setCameraStatus}
                      onStreamChange={setCameraStream}
                    />
                    {cameraStatus === 'active' && (
                      <div className="editor-camera-overlay-control">
                        <label htmlFor="public-camera-overlay-opacity">
                          Camera overlay opacity
                        </label>
                        <input
                          id="public-camera-overlay-opacity"
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={Math.round(cameraOverlayOpacity * 100)}
                          aria-valuetext={`${Math.round(cameraOverlayOpacity * 100)}%`}
                          onChange={(event) =>
                            setCameraOverlayOpacity(Number(event.target.value) / 100)
                          }
                        />
                        <label htmlFor="public-camera-overlay-mirror">
                          <input
                            id="public-camera-overlay-mirror"
                            type="checkbox"
                            checked={cameraOverlayMirrored}
                            onChange={(event) => setCameraOverlayMirrored(event.target.checked)}
                          />
                          Mirror camera overlay
                        </label>
                      </div>
                    )}
                    <DemoControlsPanel />
                  </StageControlsPopover>
                }
              />
            </div>
            {surfaceError && (
              <p role="alert" aria-live="assertive">
                {surfaceError}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default PublicProjectViewer;
