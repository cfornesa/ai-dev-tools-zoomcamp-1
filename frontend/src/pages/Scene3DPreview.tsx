import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import CameraControl, {
  type CameraControlProps,
  type CameraStatus,
} from '../components/CameraControl';
import { useCameraOverlaySettings } from '../editor/cameraOverlaySettings';
import { captureLiveScreenshot, screenshotFilename } from '../export/captureLiveScreenshot';
import { downloadBlob } from '../export/downloadBlob';
import { buildThreeSceneGraph, disposeThreeSceneGraph } from '../render/threeSceneBuilder';
import { createHandSignalExtractor, type HandSignals } from '../tracking/handSignals';
import type { TrackingFrame } from '../tracking/types';
import HandGestureGuideDialog from './HandGestureGuideDialog';
import type { Scene3DDocument } from './scene3dTypes';
import { useFullscreenToggle } from './useFullscreenToggle';

/**
 * Issue #244: replaces `project3d-preview-placeholder` with a real,
 * live-updating Three.js render of the current `scene3d` document.
 * Mounted by both `Project3DWorkspace.tsx` (manual editor) and
 * `AiProject3DWorkspace.tsx` (AI-assisted editor) -- neither owns
 * anything about *how* the scene is drawn; this component and
 * `../render/threeSceneBuilder.ts` are the single implementation both
 * share, exactly like `p5Adapter.ts` is the single 2D renderer both 2D
 * editors go through.
 *
 * ## Rebuild-on-change, not incremental diffing
 *
 * Every time `scene` changes (by reference -- both workspaces already
 * replace `workingScene`/`scene` wholesale on every edit, matching this
 * codebase's existing dirty-check convention), the entire Three.js scene
 * graph is torn down and rebuilt from scratch via
 * `buildThreeSceneGraph`/`disposeThreeSceneGraph`. No incremental
 * diffing -- simple, deterministic, and cheap enough at this app's scene
 * complexity limits (`schema/limits3d.json`). The `WebGLRenderer`/canvas
 * itself is *not* rebuilt on scene changes, only on mount/unmount, so
 * there's no visible flash-of-blank-canvas on every keystroke.
 *
 * ## Graceful degradation when WebGL is unavailable
 *
 * `THREE.WebGLRenderer`'s constructor throws when the canvas can't
 * produce a WebGL context (no GPU/driver support, a locked-down browser,
 * or -- relevant for this repo's own test suite -- jsdom, which never
 * implements WebGL at all). Rather than crashing the whole editor, that
 * failure is caught and this component renders a friendly fallback
 * message instead, mirroring this app's existing "friendly states for
 * denial/missing hardware/unsupported browser" convention from Task 31's
 * camera permission UX -- a 3D preview that can't render is exactly that
 * kind of environment limitation, not a bug to surface as a crash.
 *
 * ## "Take screenshot" (issue #286)
 *
 * Lives inside this shared component (not each of its 3 callers)
 * since only this component holds the live `<canvas>`/renderer ref.
 * `showScreenshotButton` defaults to `true` for the manual/AI-assisted
 * editor callers; `AIProposalPanel3D.tsx` passes `false` for its
 * proposal preview (documented implementation decision: an unaccepted
 * proposal isn't the project's actual saved state yet, so offering a
 * screenshot of it there would be more confusing than useful).
 *
 * ## "Expand piece to fullscreen" (issue #288)
 *
 * Unlike the screenshot button, fullscreen is offered in *all 3*
 * consumers, including the AI-proposal preview -- documented
 * implementation decision: fullscreen is a pure viewing convenience with
 * no side effect and no ambiguity about "which scene" it's of (there's
 * still only ever one canvas on screen), unlike a screenshot download,
 * which implies exporting a specific artifact of a scene that hasn't
 * been accepted yet. Resizing across the fullscreen transition needs no
 * new code: the existing `ResizeObserver`+`renderer.setSize` effect
 * already reacts to any container size change, fullscreen-driven or not
 * (confirmed by a dedicated regression test simulating a
 * `ResizeObserver` callback firing with the browser's fullscreen
 * dimensions).
 *
 * ## Gesture-driven camera control (issue #294)
 *
 * "Steer the piece", off by default, mounts the exact same
 * `CameraControl`/MediaPipe hand-tracking pipeline the 2D gesture-binding
 * system already uses (never a second webcam integration) -- only one of
 * the two can be using the camera in a given browser tab at a time
 * anyway (one `getUserMedia` stream), and this toggle starting off means
 * enabling it here can never silently compete with the 2D system's own
 * use elsewhere in the same session. Frames are run through the existing
 * `createHandSignalExtractor()` (the same extractor
 * `usePreviewRuntime.ts` uses for 2D bindings) to get smoothed
 * `HandSignals`, then mapped every render frame to camera orbit/zoom:
 * `palmX`/`palmY` deltas (open-hand move) drive azimuth/polar rotation
 * ("look"/orbit), and `pinchStrength` (already normalized `[0, 1]`,
 * fingers-together = 1) maps directly to dolly distance ("zoom") -- a
 * closed pinch reads as "pull the camera in," an open hand as "push it
 * out." Pan/move is out of scope for this issue (documented choice: the
 * existing gesture primitives have no clean third independent axis to
 * spend on translation without overloading the same one-hand signals
 * orbit/zoom already use). Shown only when `showGestureControl` is true
 * (default; `AIProposalPanel3D.tsx` passes `false`, matching
 * `showScreenshotButton`'s existing precedent for that proposal-preview
 * surface).
 *
 * ## Hand gesture guide (issue #295)
 *
 * "Show hand gesture guide" is shown alongside "Steer the piece" (same
 * `showGestureControl` gate) and opens `HandGestureGuideDialog.tsx`, a
 * small accessible modal explaining exactly the gesture set documented
 * above -- see that component's own doc comment for why its content is
 * scoped to what this build actually ships.
 *
 * ## Camera-feed overlay + opacity/mirror controls (issue #297)
 *
 * Unlike the 2D editor's camera overlay (`EditorWorkspace.tsx`), which
 * draws the video frame into the p5/Canvas2D canvas itself (so it can be
 * dragged/resized independently of layer order) and keeps its own
 * `<video>` element hidden, this 3D surface has no such compositing step
 * to hook into -- `Scene3DPreview.tsx` hands a live Three.js render straight
 * to the WebGL canvas every frame, with no per-frame drawing hook a DOM
 * element could be composited through. The simplest option the issue's own
 * scope note offers -- a DOM-overlaid `<video>` element positioned over the
 * WebGL canvas -- is what's implemented here: a small `<video>` in the
 * corner of `.scene3d-preview`, shown only while gesture control is on and
 * `CameraControl`'s own status reaches `'active'`. No drag/resize (out of
 * scope -- the 2D feature's geometry system is a separate, more involved
 * concern this issue never asked for). Opacity and mirroring reuse
 * `cameraOverlaySettings.ts`'s existing shared, `localStorage`-persisted
 * store unchanged -- the same preference the 2D editor's identical controls
 * already read/write, not a second copy.
 *
 * ## Preview-action button spacing (issue #298)
 *
 * `.editor-tool-group` (the shared class this button row already used) is
 * only ever given `display: flex; gap: 4px` when nested under
 * `.editor-toolbar` (`index.css`) -- this row never is, so its buttons got
 * no flex layout or gap at all. Rather than adding a new unscoped
 * `.editor-tool-group` base rule (the issue's own scope note flags this as
 * risky without auditing every one of that class's ~15 other consumers
 * first, several of which are radiogroups/action rows this fix has no
 * reason to touch), this row gets its own additional class,
 * `scene3d-preview-actions`, scoped to exactly this component.
 */
function Scene3DPreview({
  scene,
  showScreenshotButton = true,
  showGestureControl = true,
  screenshotBaseName,
  createGestureCameraProvider,
}: {
  scene: Scene3DDocument;
  showScreenshotButton?: boolean;
  showGestureControl?: boolean;
  /** Test seam mirroring `CameraControl.tsx`'s own `createProvider` prop
   * -- lets tests inject a fake `TrackingProvider` for the gesture-camera
   * feature without touching a real camera/MediaPipe. */
  createGestureCameraProvider?: CameraControlProps['createProvider'];
  /** Base name for the downloaded screenshot filename (e.g. the project
   * title) -- falls back to the scene document's own `id`. */
  screenshotBaseName?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [renderError, setRenderError] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreenToggle(containerRef);

  // Issue #294: "Steer the piece" -- gesture-driven camera control.
  const [gestureControlEnabled, setGestureControlEnabled] = useState(false);
  // The scene-rebuild effect below only re-runs when `scene`/`renderError`
  // change, not on every `gestureControlEnabled` toggle (toggling it
  // shouldn't tear down and rebuild the whole Three.js scene graph) -- a
  // ref, kept in sync on every render, is what its render-loop closure
  // actually reads, matching this codebase's existing "latest value ref"
  // convention (e.g. `CameraControl.tsx`'s own `onFrameRef`).
  const gestureControlEnabledRef = useRef(gestureControlEnabled);
  gestureControlEnabledRef.current = gestureControlEnabled;
  const handSignalExtractorRef = useRef(createHandSignalExtractor());
  const latestHandSignalsRef = useRef<HandSignals | null>(null);
  const previousHandSignalsRef = useRef<HandSignals | null>(null);
  const gestureStartRef = useRef<number | null>(null);

  // Issue #297: camera-feed overlay + opacity/mirror controls, shown only
  // while gesture control is active and the camera itself is live.
  const [gestureCameraStatus, setGestureCameraStatus] = useState<CameraStatus>('idle');
  const [gestureCameraStream, setGestureCameraStream] = useState<MediaStream | null>(null);
  const gestureCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const {
    opacity: cameraOverlayOpacity,
    mirrored: cameraOverlayMirrored,
    setOpacity,
    setMirrored,
  } = useCameraOverlaySettings();

  useEffect(() => {
    const videoEl = gestureCameraVideoRef.current;
    if (!videoEl) return;
    videoEl.srcObject = gestureCameraStream;
    if (gestureCameraStream) {
      // See `EditorWorkspace.tsx`'s identical effect for why this is
      // wrapped in `Promise.resolve(...).catch()` -- normalizes jsdom's
      // non-conformant `HTMLMediaElement.play()` and tolerates a real
      // autoplay rejection without treating it as a scene-breaking error.
      void Promise.resolve(videoEl.play()).catch(() => {});
    }
    // `gestureCameraStatus` must stay a dependency here even though it's
    // not read in the body: the `<video>` element only mounts once status
    // reaches 'active' (see the JSX below), so without it this effect
    // would fire once while the ref is still null and never again once the
    // element actually exists -- the identical bug documented on
    // `EditorWorkspace.tsx`'s own version of this effect.
  }, [gestureCameraStream, gestureCameraStatus]);

  function handleGestureFrame(frame: TrackingFrame) {
    if (gestureStartRef.current === null) gestureStartRef.current = performance.now();
    const timestamp = performance.now() - gestureStartRef.current;
    const { signals } = handSignalExtractorRef.current.processFrame({ ...frame, timestamp });
    previousHandSignalsRef.current = latestHandSignalsRef.current;
    latestHandSignalsRef.current = signals;
  }

  async function handleTakeScreenshot() {
    setScreenshotError(null);
    try {
      const blob = await captureLiveScreenshot(canvasRef.current);
      downloadBlob(blob, screenshotFilename(screenshotBaseName ?? scene.id));
    } catch (error) {
      setScreenshotError(
        error instanceof Error ? error.message : 'Something went wrong taking the screenshot.',
      );
    }
  }

  // Mount/unmount only: create the renderer once, tied to this
  // component's lifetime, and resize it to the container.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      // Issue #286: `preserveDrawingBuffer: true` so a screenshot
      // capture (`canvas.toBlob`/`toDataURL`, called from a button
      // click well outside the render loop) reads the last-rendered
      // frame reliably -- without it, browsers are free to clear the
      // drawing buffer between animation frames, so a capture taken
      // between rAF calls can otherwise come back blank.
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    } catch {
      setRenderError(true);
      return;
    }
    rendererRef.current = renderer;

    function resize() {
      if (!container) return;
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      renderer.setSize(width, height, false);
    }
    resize();

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    }

    return () => {
      resizeObserver?.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Rebuild the scene graph and (re)start the render loop whenever
  // `scene` changes -- the renderer/canvas above is untouched.
  useEffect(() => {
    const container = containerRef.current;
    if (!rendererRef.current || !container || renderError) return;
    const activeRenderer: THREE.WebGLRenderer = rendererRef.current;

    const size = activeRenderer.getSize(new THREE.Vector2());
    const aspect = (size.x || 1) / (size.y || 1);
    const { scene: threeScene, camera } = buildThreeSceneGraph(scene, aspect);

    // Issue #271: mouse-drag/touch-drag orbit, scroll/pinch zoom, and
    // (via listenToKeyEvents) arrow-key pan, all out of the box.
    // Rebuilt alongside the scene graph each time `scene` changes (rather
    // than kept alive across rebuilds) since the camera itself is a new
    // object every time -- purely a transient viewport interaction, never
    // persisted back into the scene document; see the issue's own scope
    // note for why that's the simpler default given this component's
    // existing whole-graph-rebuild-on-change architecture.
    const controls = new OrbitControls(camera, activeRenderer.domElement);
    controls.target.set(scene.camera.target.x, scene.camera.target.y, scene.camera.target.z);
    controls.enableDamping = true;
    controls.listenToKeyEvents(window);
    controls.update();

    // Issue #294: applies the latest smoothed hand signals (if "Steer the
    // piece" is on and a hand is present) as an orbit/zoom adjustment,
    // layered on top of -- not replacing -- OrbitControls' own pointer/
    // keyboard-driven state, since both share the same `camera`/
    // `controls.target`.
    const ORBIT_SENSITIVITY = 4; // radians per full frame-width/-height palm move
    const MIN_ZOOM_RADIUS = 2;
    const MAX_ZOOM_RADIUS = 30;
    function applyGestureCameraControl() {
      const current = latestHandSignalsRef.current;
      if (!current?.handPresence) return;
      const previous = previousHandSignalsRef.current;

      const spherical = new THREE.Spherical();
      spherical.setFromVector3(camera.position.clone().sub(controls.target));

      if (
        previous?.handPresence &&
        current.palmX !== null &&
        current.palmY !== null &&
        previous.palmX !== null &&
        previous.palmY !== null
      ) {
        const deltaX = current.palmX - previous.palmX;
        const deltaY = current.palmY - previous.palmY;
        spherical.theta -= deltaX * ORBIT_SENSITIVITY;
        spherical.phi -= deltaY * ORBIT_SENSITIVITY;
        // Clamp away from the poles -- matches OrbitControls' own default
        // min/maxPolarAngle guard against the camera flipping through the
        // target's straight-up/-down axis.
        spherical.phi = Math.min(Math.max(spherical.phi, 0.1), Math.PI - 0.1);
      }

      if (current.pinchStrength !== null) {
        // Fingers together (pinchStrength 1) pulls the camera in; a fully
        // open hand (0) pushes it out to MAX_ZOOM_RADIUS.
        spherical.radius =
          MAX_ZOOM_RADIUS - current.pinchStrength * (MAX_ZOOM_RADIUS - MIN_ZOOM_RADIUS);
      }

      camera.position.setFromSpherical(spherical).add(controls.target);
      camera.lookAt(controls.target);
    }

    let frameId: number;
    function tick() {
      if (gestureControlEnabledRef.current) applyGestureCameraControl();
      controls.update();
      activeRenderer.render(threeScene, camera);
      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      controls.dispose();
      disposeThreeSceneGraph(threeScene);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rendererRef/renderError are refs/state read once per effect run, not reactive inputs the loop needs to resubscribe to independently of `scene`.
  }, [scene, renderError]);

  if (renderError) {
    return (
      <div
        className="scene3d-preview-unavailable"
        role="status"
        aria-live="polite"
        data-testid="scene3d-preview-unavailable"
      >
        <p>3D preview isn't available in this browser.</p>
        <p>
          {scene.objects.length} object(s), {scene.lights.length} light(s), {scene.groups.length}{' '}
          group(s) in this scene.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="scene3d-preview" data-testid="scene3d-preview">
      <canvas ref={canvasRef} data-testid="scene3d-preview-canvas" />
      <div
        role="group"
        aria-label="Preview actions"
        className="editor-tool-group scene3d-preview-actions"
      >
        {showScreenshotButton && (
          <button type="button" onClick={() => void handleTakeScreenshot()}>
            Take screenshot
          </button>
        )}
        <button type="button" onClick={() => void toggleFullscreen()} aria-pressed={isFullscreen}>
          {isFullscreen ? 'Exit fullscreen' : 'Expand piece to fullscreen'}
        </button>
        {showGestureControl && (
          <button
            type="button"
            aria-pressed={gestureControlEnabled}
            onClick={() => {
              // Fresh smoothing/timestamp state on every re-enable, so a
              // stale previous-frame position from a prior session never
              // produces one large spurious jump on the first new frame.
              previousHandSignalsRef.current = null;
              latestHandSignalsRef.current = null;
              gestureStartRef.current = null;
              handSignalExtractorRef.current = createHandSignalExtractor();
              // Issue #297: `CameraControl` unmounts (below) when gesture
              // control turns off, but that only stops its own tracking
              // provider/stream -- reset this component's own mirrored
              // status/stream state too, so a stale 'active' status can
              // never leave the video overlay/opacity controls rendered
              // against a torn-down stream.
              setGestureCameraStatus('idle');
              setGestureCameraStream(null);
              setGestureControlEnabled((current) => !current);
            }}
          >
            {gestureControlEnabled ? 'Stop steering with gestures' : 'Steer the piece'}
          </button>
        )}
        {showGestureControl && <HandGestureGuideDialog />}
      </div>
      {screenshotError && (
        <p role="alert" aria-live="assertive" data-testid="screenshot-error">
          {screenshotError}
        </p>
      )}
      {showGestureControl && gestureControlEnabled && (
        <div role="region" aria-label="Gesture camera control" data-testid="gesture-camera-control">
          <CameraControl
            onFrame={handleGestureFrame}
            createProvider={createGestureCameraProvider}
            onStatusChange={setGestureCameraStatus}
            onStreamChange={setGestureCameraStream}
          />
          {gestureCameraStatus === 'active' && (
            <div className="editor-camera-overlay-control">
              <label htmlFor="scene3d-camera-overlay-opacity">Camera overlay opacity</label>
              <input
                id="scene3d-camera-overlay-opacity"
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(cameraOverlayOpacity * 100)}
                aria-valuetext={`${Math.round(cameraOverlayOpacity * 100)}%`}
                onChange={(event) => setOpacity(Number(event.target.value) / 100)}
              />
              <label htmlFor="scene3d-camera-overlay-mirror">
                <input
                  id="scene3d-camera-overlay-mirror"
                  type="checkbox"
                  checked={cameraOverlayMirrored}
                  onChange={(event) => setMirrored(event.target.checked)}
                />
                Mirror camera overlay
              </label>
            </div>
          )}
          {gestureCameraStatus === 'active' && gestureCameraStream && (
            <video
              ref={gestureCameraVideoRef}
              data-testid="scene3d-camera-overlay-video"
              aria-hidden="true"
              muted
              playsInline
              autoPlay
              className="scene3d-camera-overlay-video"
              style={{
                opacity: cameraOverlayOpacity,
                transform: cameraOverlayMirrored ? 'scaleX(-1)' : undefined,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default Scene3DPreview;
