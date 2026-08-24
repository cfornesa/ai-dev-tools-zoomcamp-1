/**
 * Task 30: the browser-local, camera-backed `TrackingProvider` adapter
 * over MediaPipe Tasks Vision's Gesture Recognizer.
 *
 * Scope (see the issue's "Out of scope"): this module only turns a live
 * camera feed into the Task 27 (`types.ts`) `TrackingFrame`/`Hand`/
 * `GestureEvent` contract with a safe lifecycle. It does not build camera-
 * permission UI (Task 31) and does not derive normalized signals such as
 * pinch strength or hand distance (Task 32/33) — it never emits
 * `pinchStart`/`pinchEnd` events, since those require landmark-distance
 * derivation that belongs to Task 32.
 *
 * No MediaPipe type is exposed on this module's public surface — the only
 * export other code should use is `createMediaPipeTrackingProvider`,
 * which returns a plain `TrackingProvider` (Task 27's contract). MediaPipe
 * types are used internally (mostly erased `import type`s) but never
 * appear on a parameter or return type any caller outside this file sees.
 *
 * Pinned MediaPipe version: this adapter loads `@mediapipe/tasks-vision`
 * as a `dependencies` entry pinned to an exact version in
 * `frontend/package.json` (see that file), and points the Wasm runtime
 * fileset at a CDN URL for that *same* exact version
 * (`MEDIAPIPE_WASM_BASE_URL` below), so the installed package version and
 * the runtime asset version can never drift apart. The gesture-recognizer
 * model asset is Google's official pinned "float16" Gesture Recognizer
 * model (`GESTURE_RECOGNIZER_MODEL_URL` below).
 *
 * Lazy loading (acceptance criterion 1): `@mediapipe/tasks-vision` is
 * imported only via the dynamic `import()` inside `loadVisionTasksModule`,
 * which runs only after `start()` is called — never at module load. A
 * static `import type` elsewhere in this file is erased at compile time
 * (see `verbatimModuleSyntax` in `tsconfig.app.json`) and contributes no
 * runtime import.
 *
 * Throttling (acceptance criterion 3): inference is driven by
 * `requestAnimationFrame`, but only actually calls
 * `GestureRecognizer.recognizeForVideo` when at least
 * `1000 / MAX_INFERENCE_FPS` ms have passed since the last inference call
 * — this is the "documented maximum rate": `MAX_INFERENCE_FPS` (30). An
 * `inFlight` guard also skips a rAF tick entirely while a previous
 * inference call's frame conversion/listener dispatch hasn't finished,
 * so inference calls can never overlap even if a listener is slow.
 *
 * Cleanup (acceptance criterion 4): `stop()` cancels the pending
 * animation frame, stops every `MediaStreamTrack` on the acquired camera
 * stream, detaches the `<video>` element's `srcObject` and pauses it, and
 * calls `GestureRecognizer.close()` to release the recognizer's Wasm/GPU
 * resources. A monotonically increasing `generation` counter invalidates
 * any async step (`getUserMedia`, module load, model load) still in
 * flight when `stop()` is called mid-`start()`, so a late-arriving
 * resource is torn down immediately instead of being adopted.
 *
 * Failure routing (acceptance criterion 5): every failure path (browser
 * unsupported, camera permission/hardware, model/module load, per-frame
 * inference) is caught and delivered through `onError` — this module
 * never lets an exception escape `start()`/the animation-frame loop.
 */
import { sanitizeFrame } from './sanitizeFrame';
import { HAND_LANDMARK_COUNT, MAX_HANDS_PER_FRAME } from './types';
import type {
  GestureEvent,
  GestureName,
  Hand,
  Landmark,
  TrackingFrame,
  TrackingProvider,
  TrackingProviderError,
  Unsubscribe,
} from './types';
import type {
  FilesetResolver as FilesetResolverType,
  GestureRecognizer as GestureRecognizerType,
  GestureRecognizerResult,
  NormalizedLandmark,
} from '@mediapipe/tasks-vision';

/** The exact `@mediapipe/tasks-vision` version this adapter is pinned to
 * (matches the `dependencies` entry in `frontend/package.json`). Kept as
 * a named constant so the Wasm CDN URL below can never silently drift
 * from the installed package version. */
export const MEDIAPIPE_TASKS_VISION_VERSION = '1.0.1';

/** Where the Gesture Recognizer's Wasm runtime is loaded from, pinned to
 * `MEDIAPIPE_TASKS_VISION_VERSION`. */
export const MEDIAPIPE_WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/wasm`;

/** Google's officially published, versioned Gesture Recognizer model
 * asset (the "float16", revision-1 build) — the standard pinned model
 * path documented by MediaPipe's own Gesture Recognizer guide. */
export const GESTURE_RECOGNIZER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

/** The documented maximum inference rate this adapter throttles to (see
 * the module doc comment's "Throttling" section). 30 Hz comfortably
 * matches typical webcam frame rates and MediaPipe's own live-tracking
 * guidance while keeping CPU/GPU load bounded; the animation-frame loop
 * still runs at display refresh rate, but skips inference on ticks that
 * arrive before this interval elapses. */
export const MAX_INFERENCE_FPS = 30;

const MIN_INFERENCE_INTERVAL_MS = 1000 / MAX_INFERENCE_FPS;

/** MediaPipe's canned gesture category names, mapped to the Task 27
 * `GestureName` vocabulary. Categories with no `GestureName` counterpart
 * (`None`, `Thumb_Down`, `ILoveYou`) map to `null` — no gesture. */
const CANNED_GESTURE_TO_NAME: Record<string, GestureName | undefined> = {
  Closed_Fist: 'closedFist',
  Open_Palm: 'openPalm',
  Pointing_Up: 'pointingUp',
  Thumb_Up: 'thumbsUp',
  Victory: 'victory',
};

type MediaPipeVisionModule = {
  FilesetResolver: typeof FilesetResolverType;
  GestureRecognizer: typeof GestureRecognizerType;
};

/** Task 115 (issue #150): a real-browser e2e test seam, mirroring the
 * shipped `window.__exportCameraLoadVisionTasksModule` pattern in
 * `../export/standaloneCameraSource.ts`. A real user's build never
 * defines this global, so `resolveDeps`'s default always falls through
 * to the real dynamic `import('@mediapipe/tasks-vision')` below -- this
 * is not gated behind `import.meta.env.DEV` or any build flag, exactly
 * like that shipped precedent. Only a Playwright test installs it, via
 * `page.addInitScript`/`context.addInitScript` before the app's own
 * bundle evaluates. */
declare global {
  interface Window {
    __mediapipeLoadVisionTasksModule?: () => Promise<MediaPipeVisionModule>;
  }
}

/** Injectable dependencies. Every field defaults to the real browser API;
 * tests override them with mocks so this module never needs a physical
 * camera, a real MediaPipe download, or a real WebGL/Wasm runtime. */
export type MediaPipeTrackingProviderDeps = {
  /** Loads the MediaPipe Tasks Vision module. Defaults to a dynamic
   * `import('@mediapipe/tasks-vision')` — see the module doc comment's
   * "Lazy loading" section for why this must stay dynamic. */
  loadVisionTasksModule?: () => Promise<MediaPipeVisionModule>;
  /** Requests camera access. Defaults to
   * `navigator.mediaDevices.getUserMedia`. */
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  /** Creates the `<video>` element frames are read from. Defaults to
   * `document.createElement('video')`. */
  createVideoElement?: () => HTMLVideoElement;
  /** Monotonic clock in milliseconds. Defaults to `performance.now`. */
  now?: () => number;
  /** Schedules the next throttled tick. Defaults to
   * `window.requestAnimationFrame`. */
  requestFrame?: (callback: () => void) => number;
  /** Cancels a pending tick. Defaults to `window.cancelAnimationFrame`. */
  cancelFrame?: (handle: number) => void;
  /** Reports whether this browser has the APIs this adapter needs
   * (camera capture + `requestAnimationFrame`). Defaults to a real
   * feature check. Returning `false` routes an "unsupported browser"
   * error through `onError` instead of attempting to start. */
  isSupported?: () => boolean;
};

function defaultIsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    typeof window.requestAnimationFrame === 'function'
  );
}

function resolveDeps(deps: MediaPipeTrackingProviderDeps): Required<MediaPipeTrackingProviderDeps> {
  return {
    loadVisionTasksModule:
      deps.loadVisionTasksModule ??
      (typeof window !== 'undefined' ? window.__mediapipeLoadVisionTasksModule : undefined) ??
      (() => import('@mediapipe/tasks-vision') as Promise<MediaPipeVisionModule>),
    getUserMedia:
      deps.getUserMedia ?? ((constraints) => navigator.mediaDevices.getUserMedia(constraints)),
    createVideoElement: deps.createVideoElement ?? (() => document.createElement('video')),
    now: deps.now ?? (() => performance.now()),
    requestFrame: deps.requestFrame ?? ((callback) => window.requestAnimationFrame(callback)),
    cancelFrame: deps.cancelFrame ?? ((handle) => window.cancelAnimationFrame(handle)),
    isSupported: deps.isSupported ?? defaultIsSupported,
  };
}

type HandSlot = {
  id: string;
  gesture: GestureName | null;
};

type ProviderStatus = 'idle' | 'starting' | 'running' | 'stopped';

/**
 * Creates a `TrackingProvider` backed by a live camera and MediaPipe's
 * Gesture Recognizer. See the module doc comment for the full lifecycle,
 * throttling, and failure-routing contract.
 */
export function createMediaPipeTrackingProvider(
  deps: MediaPipeTrackingProviderDeps = {},
): TrackingProvider {
  const {
    loadVisionTasksModule,
    getUserMedia,
    createVideoElement,
    now,
    requestFrame,
    cancelFrame,
    isSupported,
  } = resolveDeps(deps);

  let status: ProviderStatus = 'idle';
  let generation = 0;
  let rafHandle: number | null = null;
  let inFlight = false;
  let stream: MediaStream | null = null;
  let video: HTMLVideoElement | null = null;
  let recognizer: GestureRecognizerType | null = null;
  let lastInferenceTime = -Infinity;
  let lastVideoTimestamp = 0;
  let handCounter = 0;
  const handSlots = new Map<'left' | 'right', HandSlot>();

  const frameListeners = new Set<(frame: TrackingFrame) => void>();
  const errorListeners = new Set<(error: TrackingProviderError) => void>();
  const streamListeners = new Set<(stream: MediaStream | null) => void>();

  function emitError(message: string, cause?: unknown): void {
    const error: TrackingProviderError = { message, timestamp: now(), cause };
    for (const listener of errorListeners) listener(error);
  }

  function emitFrame(frame: TrackingFrame): void {
    const sanitized = sanitizeFrame(frame);
    for (const listener of frameListeners) listener(sanitized);
  }

  function emitStream(nextStream: MediaStream | null): void {
    for (const listener of streamListeners) listener(nextStream);
  }

  function stopStream(): void {
    if (!stream) return;
    for (const track of stream.getTracks()) track.stop();
    stream = null;
    emitStream(null);
  }

  function detachVideo(): void {
    if (!video) return;
    video.pause();
    video.srcObject = null;
    video = null;
  }

  function closeRecognizer(): void {
    if (!recognizer) return;
    try {
      recognizer.close();
    } catch {
      // Releasing a Wasm resource should never surface as a crash; a
      // failure here has nothing left downstream to report to.
    }
    recognizer = null;
  }

  function cancelPendingFrame(): void {
    if (rafHandle === null) return;
    cancelFrame(rafHandle);
    rafHandle = null;
  }

  /** Tears down every acquired resource. Safe to call from any state,
   * including partway through `start()`'s async pipeline. */
  function releaseResources(): void {
    cancelPendingFrame();
    stopStream();
    detachVideo();
    closeRecognizer();
    inFlight = false;
    handSlots.clear();
    lastInferenceTime = -Infinity;
    lastVideoTimestamp = 0;
  }

  function start(): void {
    // Idempotent — see the `TrackingProvider` interface doc comment.
    if (status === 'starting' || status === 'running') return;

    status = 'starting';
    const myGeneration = ++generation;

    if (!isSupported()) {
      emitError('MediaPipe hand tracking is not supported in this browser.');
      status = 'stopped';
      return;
    }

    void runStartPipeline(myGeneration);
  }

  async function runStartPipeline(myGeneration: number): Promise<void> {
    let acquiredStream: MediaStream;
    try {
      acquiredStream = await getUserMedia({ video: { facingMode: 'user' }, audio: false });
    } catch (cause) {
      if (myGeneration !== generation) return;
      emitError('Camera access was denied or no camera is available.', cause);
      status = 'stopped';
      return;
    }
    if (myGeneration !== generation) {
      for (const track of acquiredStream.getTracks()) track.stop();
      return;
    }
    stream = acquiredStream;
    emitStream(acquiredStream);

    const videoElement = createVideoElement();
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.srcObject = acquiredStream;
    try {
      await videoElement.play();
    } catch (cause) {
      if (myGeneration !== generation) return;
      emitError('Unable to start camera video playback.', cause);
      releaseResources();
      status = 'stopped';
      return;
    }
    if (myGeneration !== generation) return;
    video = videoElement;

    let visionModule: MediaPipeVisionModule;
    try {
      visionModule = await loadVisionTasksModule();
    } catch (cause) {
      if (myGeneration !== generation) return;
      emitError('Failed to load the MediaPipe Tasks Vision module.', cause);
      releaseResources();
      status = 'stopped';
      return;
    }
    if (myGeneration !== generation) return;

    let createdRecognizer: GestureRecognizerType;
    try {
      const fileset = await visionModule.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE_URL);
      if (myGeneration !== generation) return;
      createdRecognizer = await visionModule.GestureRecognizer.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: GESTURE_RECOGNIZER_MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: MAX_HANDS_PER_FRAME,
      });
    } catch (cause) {
      if (myGeneration !== generation) return;
      emitError('Failed to load the gesture recognizer model.', cause);
      releaseResources();
      status = 'stopped';
      return;
    }
    if (myGeneration !== generation) {
      try {
        createdRecognizer.close();
      } catch {
        // See closeRecognizer's comment — nothing left to report to.
      }
      return;
    }
    recognizer = createdRecognizer;

    status = 'running';
    lastInferenceTime = -Infinity;
    lastVideoTimestamp = 0;
    scheduleNextTick(myGeneration);
  }

  function scheduleNextTick(myGeneration: number): void {
    rafHandle = requestFrame(() => onAnimationFrame(myGeneration));
  }

  function onAnimationFrame(myGeneration: number): void {
    if (myGeneration !== generation || status !== 'running') return;

    const nowMs = now();
    const videoElement = video;
    const activeRecognizer = recognizer;
    if (
      !inFlight &&
      videoElement &&
      activeRecognizer &&
      nowMs - lastInferenceTime >= MIN_INFERENCE_INTERVAL_MS &&
      videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      inFlight = true;
      try {
        const videoTimestamp = Math.max(Math.round(nowMs), lastVideoTimestamp + 1);
        lastVideoTimestamp = videoTimestamp;
        lastInferenceTime = nowMs;
        const result = activeRecognizer.recognizeForVideo(videoElement, videoTimestamp);
        if (myGeneration === generation) {
          emitFrame(buildFrame(result, videoTimestamp));
        }
      } catch (cause) {
        if (myGeneration === generation) {
          emitError('Gesture recognizer inference failed.', cause);
        }
      } finally {
        inFlight = false;
      }
    }

    if (myGeneration === generation && status === 'running') {
      scheduleNextTick(myGeneration);
    }
  }

  function buildFrame(result: GestureRecognizerResult, timestamp: number): TrackingFrame {
    const events: GestureEvent[] = [];
    const seenHandedness = new Set<'left' | 'right'>();
    const hands: Hand[] = [];

    const handCount = Math.min(result.landmarks.length, MAX_HANDS_PER_FRAME);
    for (let i = 0; i < handCount; i += 1) {
      const handednessCategory = result.handedness[i]?.[0];
      const rawHandedness = handednessCategory?.categoryName?.toLowerCase();
      if (rawHandedness !== 'left' && rawHandedness !== 'right') continue;
      const handedness = rawHandedness;
      seenHandedness.add(handedness);

      let slot = handSlots.get(handedness);
      if (!slot) {
        handCounter += 1;
        slot = { id: `mediapipe-hand-${handCounter}`, gesture: null };
        handSlots.set(handedness, slot);
        events.push({ type: 'handAppear', handId: slot.id, timestamp });
      }

      const gestureCategory = result.gestures[i]?.[0]?.categoryName;
      const nextGesture = gestureCategory
        ? (CANNED_GESTURE_TO_NAME[gestureCategory] ?? null)
        : null;
      if (nextGesture !== slot.gesture) {
        if (slot.gesture) {
          events.push({ type: 'gestureExit', handId: slot.id, gesture: slot.gesture, timestamp });
        }
        if (nextGesture) {
          events.push({ type: 'gestureEnter', handId: slot.id, gesture: nextGesture, timestamp });
        }
        slot.gesture = nextGesture;
      }

      hands.push({
        id: slot.id,
        handedness,
        landmarks: toLandmarks(result.landmarks[i]),
        confidence: handednessCategory?.score ?? 0,
      });
    }

    for (const [handedness, slot] of handSlots) {
      if (seenHandedness.has(handedness)) continue;
      if (slot.gesture) {
        events.push({ type: 'gestureExit', handId: slot.id, gesture: slot.gesture, timestamp });
      }
      events.push({ type: 'handDisappear', handId: slot.id, timestamp });
      handSlots.delete(handedness);
    }

    return { timestamp, hands, events };
  }

  function toLandmarks(rawLandmarks: NormalizedLandmark[]): Landmark[] {
    const landmarks = rawLandmarks
      .slice(0, HAND_LANDMARK_COUNT)
      .map((landmark) => ({ x: landmark.x, y: landmark.y, z: landmark.z }));
    // sanitizeFrame drops any hand whose landmark count doesn't exactly
    // match HAND_LANDMARK_COUNT, so a short result (which should not
    // happen for a conformant model, but is not this adapter's contract
    // to enforce) is padded rather than silently accepted as a different
    // shape.
    while (landmarks.length < HAND_LANDMARK_COUNT) {
      landmarks.push({ x: 0, y: 0, z: 0 });
    }
    return landmarks;
  }

  function stop(): void {
    // Idempotent and never throws — see the `TrackingProvider` interface
    // doc comment. Invalidating `generation` here is what stops any
    // async step still in flight (getUserMedia, module load, model load)
    // from adopting its result after this call.
    generation += 1;
    releaseResources();
    status = 'stopped';
  }

  function onFrame(listener: (frame: TrackingFrame) => void): Unsubscribe {
    frameListeners.add(listener);
    return () => frameListeners.delete(listener);
  }

  function onError(listener: (error: TrackingProviderError) => void): Unsubscribe {
    errorListeners.add(listener);
    return () => errorListeners.delete(listener);
  }

  function onStream(listener: (stream: MediaStream | null) => void): Unsubscribe {
    streamListeners.add(listener);
    return () => streamListeners.delete(listener);
  }

  return { start, stop, onFrame, onError, onStream };
}
