import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import CameraControl, {
  type CameraControlProps,
  type CameraStatus,
} from '../components/CameraControl';
import PieceStageToolbar from '../components/PieceStageToolbar';
import StageControlsPopover from '../components/StageControlsPopover';
import PieceStageIcon from '../components/PieceStageIcon';
import { THREE_D_STAGE_CAPABILITIES } from '../components/pieceStageCapabilities';
import {
  categorizeMicError,
  isMicSupported,
  micRecoveryMessageFor,
  type MicFailureCategory,
} from '../audio/micFailure';
import { isEditableElement, PIANO_KEY_MAP } from '../audio/pianoKeyMap';
import {
  createSonicEngine,
  SONIC_INSTRUMENT_OPTIONS,
  type SonicEngine,
  type SonicInstrument,
  type SonicVoice,
} from '../audio/sonicEngine';
import { useCameraOverlaySettings } from '../editor/cameraOverlaySettings';
import { captureLiveScreenshot, screenshotFilename } from '../export/captureLiveScreenshot';
import { downloadBlob } from '../export/downloadBlob';
import {
  buildThreeSceneGraph,
  disposeThreeSceneGraph,
  updateThreeCameraAspect,
} from '../render/threeSceneBuilder';
import { createHandSignalExtractor, type HandSignals } from '../tracking/handSignals';
import type { TrackingFrame } from '../tracking/types';
import HandGestureGuideDialog from './HandGestureGuideDialog';
import type { Scene3DDocument } from './scene3dTypes';
import { useFullscreenToggle } from './useFullscreenToggle';
import type { Scene3DExportVariant } from '../export/generateHtmlExport3D';

const HAND_MOVE_PINCH_THRESHOLD = 0.75;

/** Translate normalized hand signals into bounded immersive travel axes. */
export function getImmersiveHandMoveAxes(signals: HandSignals): {
  strafe: number;
  forward: number;
} {
  if (
    !signals.handPresence ||
    signals.pinchStrength === null ||
    signals.pinchStrength < HAND_MOVE_PINCH_THRESHOLD
  ) {
    return { strafe: 0, forward: 0 };
  }

  const strafe =
    signals.palmX === null ? 0 : THREE.MathUtils.clamp((signals.palmX - 0.5) * 2, -1, 1);
  const forwardSource = signals.handDepth ?? (signals.palmY === null ? 0 : 0.5 - signals.palmY);
  return {
    strafe,
    forward: THREE.MathUtils.clamp(forwardSource * 2, -1, 1),
  };
}

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
 * corner of `.scene3d-preview-canvas-frame`, shown only while gesture
 * control is on and `CameraControl`'s own status reaches `'active'`. No
 * drag/resize (out of scope -- the 2D feature's geometry system is a
 * separate, more involved concern this issue never asked for). Opacity
 * and mirroring reuse
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
 *
 * ## Fixed-height canvas without clipping its own siblings (issue #299)
 *
 * The outer element this component returns (`containerRef`, `.scene3d-preview`)
 * must stay auto-height: it's the target `useFullscreenToggle` requests
 * fullscreen on, and every control must remain its descendant while
 * fullscreen is active. It used to also carry the canvas's own fixed 360px
 * height directly, which let controls spill below it and overlap the next
 * sibling. The fixed height now lives on a dedicated inner
 * `.scene3d-preview-canvas-frame`; the opt-in settings panels are positioned
 * over that frame so the stage remains compact without clipping.
 *
 * ## Sound: master enable/volume (issue #306)
 *
 * A single, always-alive `SonicEngine` instance (`../audio/sonicEngine.ts`)
 * per mounted `Scene3DPreview`, independent of `scene`/rebuild churn --
 * `enable()` is idempotent and only actually starts audio the first time a
 * real user gesture (this button's own click) calls it, matching the
 * browser's autoplay-gesture requirement the same way `CameraControl.tsx`'s
 * "Enable camera" click is what's allowed to call `getUserMedia`. The
 * render loop below reports the camera's own per-frame position delta via
 * `reportMovement`, driving the engine's "movement" voice from real scene
 * motion. This is a minimal, always-reachable control -- issue #310 will
 * consolidate it (plus keyboard/mic/camera-theremin from #307-#309) into a
 * proper "Piece controls" settings surface.
 */
function Scene3DPreview({
  scene,
  showScreenshotButton = true,
  showGestureControl = true,
  showSoundControl = true,
  flyControls = false,
  screenshotBaseName,
  onDownload,
  downloadFormat = 'zip',
  immersiveHref,
  editorControls,
  createGestureCameraProvider,
}: {
  scene: Scene3DDocument;
  showScreenshotButton?: boolean;
  showGestureControl?: boolean;
  /** Issue #306: an unaccepted AI proposal preview passes `false`, matching
   * `showScreenshotButton`/`showGestureControl`'s existing precedent for
   * that surface -- an unaccepted proposal isn't the project's actual
   * saved state, so sounding it out would be confusing. */
  showSoundControl?: boolean;
  /** Issue #311: arrow-key "fly" translation for the immersive first-
   * person view (`ImmersiveProject3DViewer.tsx`) -- off by default for
   * every other caller, since it changes what arrow keys do (translation
   * instead of `OrbitControls`' own built-in panning). */
  flyControls?: boolean;
  /** Stage-level download action supplied by the owning editor/viewer. */
  onDownload?: (variant?: Scene3DExportVariant) => void | Promise<void>;
  /** Artifact format used by the owning surface, for accurate menu labels. */
  downloadFormat?: 'html' | 'zip';
  /** Optional public immersive entry point rendered in the stage toolbar. */
  immersiveHref?: string;
  /** Optional authoring actions rendered inside the same stage toolbar. */
  editorControls?: ReactNode;
  /** Test seam mirroring `CameraControl.tsx`'s own `createProvider` prop
   * -- lets tests inject a fake `TrackingProvider` for the gesture-camera
   * feature without touching a real camera/MediaPipe. */
  createGestureCameraProvider?: CameraControlProps['createProvider'];
  /** Base name for the downloaded screenshot filename (e.g. the project
   * title) -- falls back to the scene document's own `id`. */
  screenshotBaseName?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasFrameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [renderError, setRenderError] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreenToggle(containerRef);

  // Issue #306: one `SonicEngine` per mount, independent of `scene`/rebuild
  // churn -- see this component's own doc comment above.
  const sonicEngineRef = useRef<SonicEngine | null>(null);
  if (sonicEngineRef.current === null) sonicEngineRef.current = createSonicEngine();
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundControlsResetKey, setSoundControlsResetKey] = useState(0);
  const [soundVolume, setSoundVolume] = useState(50);
  const [voiceInstruments, setVoiceInstruments] = useState<Record<SonicVoice, SonicInstrument>>({
    ambient: 'synth',
    movement: 'synth',
    melodic: 'synth',
  });
  useEffect(() => {
    const engine = sonicEngineRef.current;
    return () => engine?.dispose();
  }, []);

  async function handleToggleSound() {
    const engine = sonicEngineRef.current;
    if (!engine) return;
    // Reset the nested disclosure before the asynchronous audio transition.
    // Deriving the reset key from `soundEnabled` lets a user reopen Piece
    // controls while enable() is pending, only for the later state commit to
    // hide that freshly reopened panel in some browsers.
    setSoundControlsResetKey((current) => current + 1);
    if (soundEnabled) {
      engine.disable();
      setSoundEnabled(false);
      setKeyboardEnabled(false);
      setMicState('idle');
      setMicFailure(null);
      setThereminEnabled(false);
      return;
    }
    await engine.enable();
    if (engine.status === 'active') {
      engine.setVolume(soundVolume);
      setSoundEnabled(true);
    }
  }

  function dispatchFlyKey(key: string, type: 'keydown' | 'keyup') {
    window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
  }

  function releaseFlyKey(key: string) {
    dispatchFlyKey(key, 'keyup');
  }

  // Issue #307: keyboard-triggered notes on the melodic voice -- a
  // standard ASDF-piano-key mapping (`../audio/pianoKeyMap.ts`), matching
  // the reference implementation. A `window` keydown listener (not scoped
  // to this component's own container) is what lets a user play notes
  // without first clicking into the 3D canvas, but it must never fire
  // while the user is typing in a form field elsewhere on the page --
  // `isEditableElement` guards exactly that. Only attached at all while
  // both sound and this toggle are on, and torn down immediately if sound
  // itself is muted (see `handleToggleSound` above).
  const [keyboardEnabled, setKeyboardEnabled] = useState(false);
  useEffect(() => {
    if (!soundEnabled || !keyboardEnabled) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || isEditableElement(event.target)) return;
      const note = PIANO_KEY_MAP[event.key.toLowerCase()];
      if (!note) return;
      sonicEngineRef.current?.triggerMelodicNote(note);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [soundEnabled, keyboardEnabled]);

  // Issue #308: "Live mic" -- raw microphone input mixed into the shared
  // bus, reusing `CameraControl.tsx`'s own friendly-failure/privacy-notice
  // conventions for the audio equivalent of a `getUserMedia` permission
  // flow (see `../audio/micFailure.ts`). A genuinely separate permission
  // request from this app's existing camera `getUserMedia({video:true})`
  // flow -- audio-only, never touches the camera.
  const [micState, setMicState] = useState<'idle' | 'requesting' | 'active' | 'error'>('idle');
  const [micFailure, setMicFailure] = useState<MicFailureCategory | null>(null);
  async function handleToggleMic() {
    const engine = sonicEngineRef.current;
    if (!engine) return;
    if (micState === 'active') {
      engine.disconnectMic();
      setMicState('idle');
      setMicFailure(null);
      return;
    }
    if (!isMicSupported()) {
      setMicFailure('unsupported-browser');
      setMicState('error');
      return;
    }
    if (!window.isSecureContext) {
      setMicFailure('insecure-context');
      setMicState('error');
      return;
    }
    setMicState('requesting');
    setMicFailure(null);
    try {
      await engine.connectMic();
      setMicState('active');
    } catch (error) {
      setMicFailure(categorizeMicError(error));
      setMicState('error');
    }
  }

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

  // Issue #309: "camera theremin" -- independently toggleable alongside
  // "Steer the piece", sharing this same `CameraControl`/hand-tracking
  // pipeline (see the combined mount condition below and
  // `handleGestureFrame`'s own doc comment) rather than a second camera
  // stream/model instance.
  const [thereminEnabled, setThereminEnabled] = useState(false);
  const thereminEnabledRef = useRef(thereminEnabled);
  thereminEnabledRef.current = thereminEnabled;
  function handleToggleTheremin() {
    const engine = sonicEngineRef.current;
    if (thereminEnabled) {
      engine?.stopCameraTheremin();
      setThereminEnabled(false);
      return;
    }
    engine?.startCameraTheremin();
    setThereminEnabled(true);
  }

  // Issue #297: camera-feed overlay + opacity/mirror controls, shown only
  // while gesture control is active and the camera itself is live.
  const [gestureCameraStatus, setGestureCameraStatus] = useState<CameraStatus>('idle');
  const [gestureCameraStream, setGestureCameraStream] = useState<MediaStream | null>(null);
  const gestureCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  // Issue #342: a camera preview is independently toggleable from gesture
  // steering and theremin. It uses the existing permission/error lifecycle,
  // but has no frame handler, so it cannot alter the scene or sound.
  const [cameraPreviewEnabled, setCameraPreviewEnabled] = useState(false);
  const [cameraPreviewStatus, setCameraPreviewStatus] = useState<CameraStatus>('idle');
  const [cameraPreviewStream, setCameraPreviewStream] = useState<MediaStream | null>(null);
  const cameraPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const {
    opacity: cameraOverlayOpacity,
    mirrored: cameraOverlayMirrored,
    setOpacity,
    setMirrored,
  } = useCameraOverlaySettings();

  function resetGestureSignals() {
    previousHandSignalsRef.current = null;
    latestHandSignalsRef.current = null;
    gestureStartRef.current = null;
    handSignalExtractorRef.current = createHandSignalExtractor();
  }

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

  useEffect(() => {
    const videoEl = cameraPreviewVideoRef.current;
    if (!videoEl) return;
    videoEl.srcObject = cameraPreviewStream;
    if (cameraPreviewStream) void Promise.resolve(videoEl.play()).catch(() => {});
  }, [cameraPreviewStream, cameraPreviewStatus]);

  function handleGestureFrame(frame: TrackingFrame) {
    if (gestureStartRef.current === null) gestureStartRef.current = performance.now();
    const timestamp = performance.now() - gestureStartRef.current;
    const { signals } = handSignalExtractorRef.current.processFrame({ ...frame, timestamp });
    previousHandSignalsRef.current = latestHandSignalsRef.current;
    latestHandSignalsRef.current = signals;

    // Issue #309: "camera theremin" -- runs off the exact same tracked-hand
    // frame "Steer the piece" already processes above, rather than a
    // second detection pipeline. Wrist/palm Y drives a continuous pitch
    // glide (matching the reference's own theremin feel: near the top of
    // frame is a higher hand, so a higher pitch); this codebase's existing
    // `pinchStrength` signal (fingers together = 1, already normalized
    // [0, 1] by `handSignals.ts`) stands in for the reference's own
    // wrist-to-fingertip "hand spread" metric as the volume control --
    // an open hand (pinchStrength near 0) is louder, a closed pinch is
    // quieter, the same open/louder relationship the reference uses,
    // without adding a second landmark-distance signal just for this.
    if (thereminEnabledRef.current && signals.handPresence && signals.palmY !== null) {
      const midiNote = 36 + (1 - signals.palmY) * 24; // ~C2-C4, two octaves
      const frequencyHz = 440 * Math.pow(2, (midiNote - 69) / 12);
      const openness = signals.pinchStrength === null ? 0.5 : 1 - signals.pinchStrength;
      const volumeDb = -30 + openness * 30;
      sonicEngineRef.current?.updateCameraTheremin(frequencyHz, volumeDb);
    }
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
  // component's lifetime, and resize it to the canvas frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    // Issue #299: sized from `canvasFrameRef` (the fixed-height box that
    // wraps only the canvas), not `containerRef` (the outer element, which
    // also owns the stage-local toolbar and opt-in settings overlays).
    // `containerRef` remains the fullscreen target (`useFullscreenToggle`
    // below): the "Exit fullscreen" button and every other control must
    // stay a descendant of whatever element enters native fullscreen, or
    // they'd disappear from view entirely while fullscreen is active.
    const canvasFrame = canvasFrameRef.current;
    if (!canvas || !canvasFrame) return;

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
      if (!canvasFrame) return;
      const width = canvasFrame.clientWidth || 1;
      const height = canvasFrame.clientHeight || 1;
      renderer.setSize(width, height, false);
      if (cameraRef.current) updateThreeCameraAspect(cameraRef.current, width, height);
    }
    resize();

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvasFrame);
    }

    return () => {
      resizeObserver?.disconnect();
      renderer.dispose();
      rendererRef.current = null;
      cameraRef.current = null;
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
    cameraRef.current = camera;

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
    // Issue #311: `flyControls` (the immersive view) drives arrow keys
    // itself (see the fly-translation block in `tick()` below) -- calling
    // `listenToKeyEvents` too would double-handle every arrow key (its own
    // built-in pan alongside this component's fly-translation), so it's
    // skipped in that mode. Everything else about `OrbitControls` (mouse-
    // drag orbit, wheel/pinch zoom) is unaffected either way.
    if (!flyControls) controls.listenToKeyEvents(window);
    controls.update();

    // Issue #294: applies the latest smoothed hand signals (if "Steer the
    // piece" is on and a hand is present) as an orbit/zoom adjustment,
    // layered on top of -- not replacing -- OrbitControls' own pointer/
    // keyboard-driven state, since both share the same `camera`/
    // `controls.target`.
    const ORBIT_SENSITIVITY = 4; // radians per full frame-width/-height palm move
    const MIN_ZOOM_RADIUS = 2;
    const MAX_ZOOM_RADIUS = 30;
    const MAX_GESTURE_TRAVEL = 20;
    const GESTURE_MOVE_SPEED_UNITS_PER_SECOND = 4;
    let gestureTravel = new THREE.Vector3();

    function applyGestureCameraControl(deltaSeconds: number) {
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

      if (!flyControls) return;
      const axes = getImmersiveHandMoveAxes(current);
      if (axes.strafe === 0 && axes.forward === 0) return;

      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward).normalize();
      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      const requested = forward
        .multiplyScalar(axes.forward)
        .add(right.multiplyScalar(axes.strafe))
        .multiplyScalar(GESTURE_MOVE_SPEED_UNITS_PER_SECOND * deltaSeconds);
      const nextTravel = gestureTravel.clone().add(requested);
      if (nextTravel.length() > MAX_GESTURE_TRAVEL) {
        nextTravel.setLength(MAX_GESTURE_TRAVEL);
      }
      const applied = nextTravel.clone().sub(gestureTravel);
      gestureTravel = nextTravel;
      camera.position.add(applied);
      controls.target.add(applied);
    }

    // Issue #306: "movement" sound-voice input -- the camera's own
    // per-frame position delta, fed to the sonic engine regardless of
    // whether sound is currently enabled (a no-op call when it isn't;
    // `reportMovement` is always safe to call, matching this component's
    // existing "safe no-op while idle" conventions).
    let previousCameraPosition: THREE.Vector3 | null = null;

    // Issue #311: arrow-key "fly" translation for the immersive view --
    // investigated directly against the reference implementation's own
    // `createKeyboardNavigation` (a sibling repo, not guessed): arrow keys
    // (never WASD -- WASD is reserved for #307's piano-key notes, the
    // exact same key-collision problem the reference itself worked around
    // the same way) translate the camera's position *and* orbit target
    // together along the camera's own forward/right vectors, layered on
    // top of -- not replacing -- mouse-drag orbit and wheel/pinch zoom.
    const FLY_SPEED_UNITS_PER_SECOND = 6;
    const FLY_ZOOM_SPEED_UNITS_PER_SECOND = 8;
    const heldFlyKeys = new Set<string>();
    function handleFlyKeyDown(event: KeyboardEvent) {
      if (event.key.startsWith('Arrow') || event.key === 'ZoomIn' || event.key === 'ZoomOut') {
        heldFlyKeys.add(event.key);
      }
    }
    function handleFlyKeyUp(event: KeyboardEvent) {
      heldFlyKeys.delete(event.key);
    }
    if (flyControls) {
      window.addEventListener('keydown', handleFlyKeyDown);
      window.addEventListener('keyup', handleFlyKeyUp);
    }
    function applyFlyTranslation(deltaSeconds: number) {
      if (heldFlyKeys.size === 0) return;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      const move = new THREE.Vector3();
      if (heldFlyKeys.has('ArrowUp')) move.add(forward);
      if (heldFlyKeys.has('ArrowDown')) move.sub(forward);
      if (heldFlyKeys.has('ArrowRight')) move.add(right);
      if (heldFlyKeys.has('ArrowLeft')) move.sub(right);
      if (move.lengthSq() !== 0) {
        move.normalize().multiplyScalar(FLY_SPEED_UNITS_PER_SECOND * deltaSeconds);
        camera.position.add(move);
        controls.target.add(move);
      }

      const zoomDirection =
        (heldFlyKeys.has('ZoomIn') ? -1 : 0) + (heldFlyKeys.has('ZoomOut') ? 1 : 0);
      if (zoomDirection !== 0) {
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(camera.position.clone().sub(controls.target));
        spherical.radius = THREE.MathUtils.clamp(
          spherical.radius + zoomDirection * FLY_ZOOM_SPEED_UNITS_PER_SECOND * deltaSeconds,
          MIN_ZOOM_RADIUS,
          MAX_ZOOM_RADIUS,
        );
        camera.position.setFromSpherical(spherical).add(controls.target);
        camera.lookAt(controls.target);
      }
    }

    let frameId: number;
    let lastTickAt = performance.now();
    function tick() {
      const now = performance.now();
      // Capped so a tab backgrounded mid-fly (a large real elapsed time on
      // the next visible frame) never produces one huge teleport-like jump.
      const deltaSeconds = Math.min((now - lastTickAt) / 1000, 0.1);
      lastTickAt = now;

      if (gestureControlEnabledRef.current) applyGestureCameraControl(deltaSeconds);
      if (flyControls) applyFlyTranslation(deltaSeconds);
      controls.update();
      if (previousCameraPosition) {
        sonicEngineRef.current?.reportMovement({
          dx: camera.position.x - previousCameraPosition.x,
          dy: camera.position.y - previousCameraPosition.y,
          dz: camera.position.z - previousCameraPosition.z,
        });
      }
      previousCameraPosition = camera.position.clone();
      activeRenderer.render(threeScene, camera);
      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      if (flyControls) {
        window.removeEventListener('keydown', handleFlyKeyDown);
        window.removeEventListener('keyup', handleFlyKeyUp);
      }
      controls.dispose();
      disposeThreeSceneGraph(threeScene);
      cameraRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rendererRef/renderError are refs/state read once per effect run, not reactive inputs the loop needs to resubscribe to independently of `scene`.
  }, [scene, renderError]);

  if (renderError) {
    return (
      <div ref={containerRef} className="scene3d-preview scene3d-preview-unavailable">
        <div role="status" aria-live="polite" data-testid="scene3d-preview-unavailable">
          <p>3D preview isn't available in this browser.</p>
          <p>
            {scene.objects.length} object(s), {scene.lights.length} light(s), {scene.groups.length}{' '}
            group(s) in this scene.
          </p>
        </div>
        {(onDownload || editorControls) && (
          <PieceStageToolbar
            ariaLabel="Preview actions"
            immersiveHref={immersiveHref}
            onDownload={onDownload}
            downloadFormat={downloadFormat}
            capabilities={THREE_D_STAGE_CAPABILITIES}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            editorControls={editorControls}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="scene3d-preview" data-testid="scene3d-preview">
      <div
        ref={canvasFrameRef}
        className="scene3d-preview-canvas-frame"
        data-testid="scene3d-preview-canvas-frame"
      >
        <canvas ref={canvasRef} data-testid="scene3d-preview-canvas" />
        {showGestureControl && gestureCameraStatus === 'active' && gestureCameraStream && (
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
        {cameraPreviewEnabled && cameraPreviewStatus === 'active' && cameraPreviewStream && (
          <video
            ref={cameraPreviewVideoRef}
            data-testid="scene3d-camera-preview-video"
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
        <PieceStageToolbar
          ariaLabel="Preview actions"
          className="editor-tool-group scene3d-preview-actions"
          onScreenshot={showScreenshotButton ? handleTakeScreenshot : undefined}
          onDownload={onDownload}
          downloadFormat={downloadFormat}
          capabilities={THREE_D_STAGE_CAPABILITIES}
          immersiveHref={immersiveHref}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          soundControl={
            showSoundControl ? (
              <button
                type="button"
                className="piece-stage-icon-button"
                title={soundEnabled ? 'Mute sound' : 'Enable sound'}
                aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
                aria-pressed={soundEnabled}
                onClick={() => void handleToggleSound()}
              >
                <PieceStageIcon name="sound" />
                <span className="piece-stage-action-label">
                  {soundEnabled ? 'Mute sound' : 'Sound'}
                </span>
                <span className="piece-stage-tooltip" role="tooltip">
                  {soundEnabled ? 'Mute sound' : 'Enable sound'}
                </span>
              </button>
            ) : undefined
          }
          controlsControl={
            <StageControlsPopover resetKey={soundControlsResetKey}>
              <div className="editor-tool-group">
                <button
                  type="button"
                  aria-pressed={cameraPreviewEnabled}
                  onClick={() => {
                    if (cameraPreviewEnabled) {
                      setCameraPreviewEnabled(false);
                      setCameraPreviewStatus('idle');
                      setCameraPreviewStream(null);
                    } else {
                      setCameraPreviewEnabled(true);
                    }
                  }}
                >
                  {cameraPreviewEnabled ? 'Hide camera' : 'Show camera'}
                </button>
              </div>
              {cameraPreviewEnabled && (
                <div role="region" aria-label="Camera preview" data-testid="camera-preview-control">
                  <CameraControl
                    onStatusChange={setCameraPreviewStatus}
                    onStreamChange={setCameraPreviewStream}
                  />
                  {cameraPreviewStatus === 'active' && (
                    <div className="editor-camera-overlay-control">
                      <label htmlFor="scene3d-camera-preview-opacity">Camera overlay opacity</label>
                      <input
                        id="scene3d-camera-preview-opacity"
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={Math.round(cameraOverlayOpacity * 100)}
                        aria-valuetext={`${Math.round(cameraOverlayOpacity * 100)}%`}
                        onChange={(event) => setOpacity(Number(event.target.value) / 100)}
                      />
                      <label htmlFor="scene3d-camera-preview-mirror">
                        <input
                          id="scene3d-camera-preview-mirror"
                          type="checkbox"
                          checked={cameraOverlayMirrored}
                          onChange={(event) => setMirrored(event.target.checked)}
                        />
                        Mirror camera overlay
                      </label>
                    </div>
                  )}
                </div>
              )}
              {showSoundControl && soundEnabled && (
                <div className="scene3d-sound-settings-inline">
                  <div className="editor-camera-overlay-control">
                    <label htmlFor="scene3d-sound-volume">Sound volume</label>
                    <input
                      id="scene3d-sound-volume"
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={soundVolume}
                      aria-valuetext={`${soundVolume}%`}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setSoundVolume(next);
                        sonicEngineRef.current?.setVolume(next);
                      }}
                    />
                  </div>
                  <div className="editor-tool-group scene3d-voice-instrument-pickers">
                    {(['ambient', 'movement', 'melodic'] as const).map((voice) => (
                      <label key={voice} htmlFor={`scene3d-${voice}-instrument`}>
                        {voice[0].toUpperCase() + voice.slice(1)}
                        <select
                          id={`scene3d-${voice}-instrument`}
                          aria-label={`${voice[0].toUpperCase() + voice.slice(1)} instrument`}
                          value={voiceInstruments[voice]}
                          onChange={(event) => {
                            const instrument = event.target.value as SonicInstrument;
                            if (sonicEngineRef.current?.setVoiceInstrument(voice, instrument)) {
                              setVoiceInstruments((current) => ({
                                ...current,
                                [voice]: instrument,
                              }));
                            }
                          }}
                        >
                          {SONIC_INSTRUMENT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <div className="editor-tool-group">
                    <button
                      type="button"
                      aria-pressed={keyboardEnabled}
                      onClick={() => setKeyboardEnabled((current) => !current)}
                    >
                      {keyboardEnabled ? 'Stop keyboard notes' : 'Keyboard notes'}
                    </button>
                    <button
                      type="button"
                      aria-pressed={micState === 'active'}
                      disabled={micState === 'requesting'}
                      onClick={() => void handleToggleMic()}
                    >
                      {micState === 'requesting'
                        ? 'Requesting mic…'
                        : micState === 'active'
                          ? 'Stop live mic'
                          : 'Live mic'}
                    </button>
                    <button
                      type="button"
                      aria-pressed={thereminEnabled}
                      onClick={handleToggleTheremin}
                    >
                      {thereminEnabled ? 'Stop camera theremin' : 'Camera theremin'}
                    </button>
                  </div>
                  {(micState === 'requesting' || micState === 'active') && (
                    <p role="status" aria-live="polite" data-testid="mic-privacy-notice">
                      Audio from your microphone is processed locally in your browser. It is never
                      recorded, stored, or uploaded.
                    </p>
                  )}
                  {micState === 'error' && micFailure && (
                    <p role="alert" aria-live="assertive" data-testid="mic-error">
                      {micRecoveryMessageFor(micFailure)}
                    </p>
                  )}
                </div>
              )}
              {((showGestureControl && gestureControlEnabled) ||
                (showSoundControl && thereminEnabled)) && (
                <div
                  role="region"
                  aria-label="Gesture camera control"
                  data-testid="gesture-camera-control"
                >
                  <CameraControl
                    onFrame={handleGestureFrame}
                    createProvider={createGestureCameraProvider}
                    onStatusChange={(status) => {
                      setGestureCameraStatus(status);
                      if (status !== 'active') resetGestureSignals();
                    }}
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
                </div>
              )}
            </StageControlsPopover>
          }
          gestureControl={
            showGestureControl ? (
              <button
                type="button"
                className="piece-stage-icon-button"
                title={gestureControlEnabled ? 'Stop steering with gestures' : 'Steer the piece'}
                aria-label={
                  gestureControlEnabled ? 'Stop steering with gestures' : 'Steer the piece'
                }
                aria-pressed={gestureControlEnabled}
                onClick={() => {
                  resetGestureSignals();
                  setGestureCameraStatus('idle');
                  setGestureCameraStream(null);
                  setGestureControlEnabled((current) => !current);
                }}
              >
                <PieceStageIcon name="steer" />
                <span className="piece-stage-action-label">
                  {gestureControlEnabled ? 'Stop steer' : 'Steer'}
                </span>
                <span className="piece-stage-tooltip" role="tooltip">
                  {gestureControlEnabled ? 'Stop steering with gestures' : 'Steer the piece'}
                </span>
              </button>
            ) : undefined
          }
          gestureGuide={showGestureControl ? <HandGestureGuideDialog /> : undefined}
          editorControls={editorControls}
        />
        {flyControls && (
          <div className="scene3d-touch-dpad" role="region" aria-label="Immersive touch navigation">
            <div className="scene3d-touch-dpad-directions" aria-label="Move through piece">
              {(
                [
                  ['ArrowUp', 'Move forward', '↑'],
                  ['ArrowLeft', 'Move left', '←'],
                  ['ArrowDown', 'Move backward', '↓'],
                  ['ArrowRight', 'Move right', '→'],
                ] as const
              ).map(([key, label, glyph]) => (
                <button
                  key={key}
                  type="button"
                  aria-label={label}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    dispatchFlyKey(key, 'keydown');
                  }}
                  onPointerUp={() => releaseFlyKey(key)}
                  onPointerCancel={() => releaseFlyKey(key)}
                  onPointerLeave={() => releaseFlyKey(key)}
                  onClick={(event) => {
                    // Native button keyboard activation emits click with no
                    // pointer detail. Pointer clicks already use the held
                    // press/release handlers above, so avoid dispatching the
                    // travel key twice for those clicks.
                    if (event.detail !== 0) return;
                    dispatchFlyKey(key, 'keydown');
                    releaseFlyKey(key);
                  }}
                >
                  {glyph}
                </button>
              ))}
            </div>
            <div className="scene3d-touch-dpad-zoom" aria-label="Zoom view">
              {(
                [
                  ['ZoomIn', 'Zoom in', '+'],
                  ['ZoomOut', 'Zoom out', '−'],
                ] as const
              ).map(([key, label, glyph]) => (
                <button
                  key={key}
                  type="button"
                  aria-label={label}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    dispatchFlyKey(key, 'keydown');
                  }}
                  onPointerUp={() => releaseFlyKey(key)}
                  onPointerCancel={() => releaseFlyKey(key)}
                  onPointerLeave={() => releaseFlyKey(key)}
                  onClick={(event) => {
                    if (event.detail !== 0) return;
                    dispatchFlyKey(key, 'keydown');
                    releaseFlyKey(key);
                  }}
                >
                  {glyph}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {screenshotError && (
        <p role="alert" aria-live="assertive" data-testid="screenshot-error">
          {screenshotError}
        </p>
      )}
    </div>
  );
}

export default Scene3DPreview;
