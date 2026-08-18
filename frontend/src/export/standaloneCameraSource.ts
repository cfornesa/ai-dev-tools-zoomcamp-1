/**
 * Task 57 (issue #56): the camera/tracking module embedded as an
 * additional plain-JS `<script>` in every export whose `interactionMode`
 * includes camera (`'camera'` or `'demo-camera'`) — never embedded for a
 * `'demo'`-only export (see `generateHtmlExport.ts`).
 *
 * ## Why a second hand-written plain-JS module, not a bundled copy
 *
 * Same rationale as `standaloneRuntimeSource.ts` (see that module's doc
 * comment): the export has no bundler, so `../tracking/mediapipeProvider.ts`
 * and `../components/cameraFailure.ts` can't be embedded verbatim (they're
 * TypeScript ES modules that `import type` from `@mediapipe/tasks-vision`,
 * a package resolved by the app's own bundler at dev/build time). This
 * module is a compact, faithful port of both, scoped to exactly what a
 * standalone export needs.
 *
 * ## Lifecycle faithfully ported from `mediapipeProvider.ts`
 *
 * - **Lazy loading**: `@mediapipe/tasks-vision`'s ESM bundle is loaded via
 *   a dynamic `import()` of its exact CDN URL (`VISION_BUNDLE_URL` below),
 *   called only from inside `start()`'s pipeline — never at script
 *   evaluation time, never before the user clicks "Enable camera". Dynamic
 *   `import()` is valid in a plain (non-`module`) `<script>` per spec, so
 *   this needs no `type="module"` script tag or bundler.
 * - **Pinned version**: `MEDIAPIPE_TASKS_VISION_VERSION` below is the exact
 *   same pinned version `mediapipeProvider.ts` uses (`1.0.1`, matching
 *   `frontend/package.json`'s `@mediapipe/tasks-vision` dependency) — see
 *   that module's own doc comment for why the installed package version
 *   and the runtime asset version must never drift apart. The Wasm fileset
 *   URL and the Gesture Recognizer model URL are copied verbatim.
 * - **Throttling**: inference is driven by `requestAnimationFrame` but only
 *   actually calls `recognizeForVideo` once at least
 *   `1000 / MAX_INFERENCE_FPS` ms have passed since the last call, with an
 *   `inFlight` guard preventing overlapping inference calls — identical
 *   values and structure to `mediapipeProvider.ts`.
 * - **Cleanup**: `stop()` cancels the pending animation frame, stops every
 *   acquired `MediaStreamTrack`, detaches/pauses the `<video>` element, and
 *   closes the Gesture Recognizer. A monotonically increasing `generation`
 *   counter invalidates any async step (`getUserMedia`, dynamic import,
 *   Wasm fileset load, recognizer creation) still in flight when `stop()`
 *   is called mid-`start()`, so a late-arriving resource is torn down
 *   immediately instead of adopted — same technique as
 *   `mediapipeProvider.ts`'s `generation`/`releaseResources`.
 * - **Failure routing**: every failure site (unsupported browser, camera
 *   permission/hardware, video playback, module/model load, per-frame
 *   inference) is caught and routed through the same category vocabulary
 *   `cameraFailure.ts` defines, never left to throw uncaught.
 *
 * ## Signal derivation: a compact single-hand port of `handSignals.ts`
 *
 * The demo controls' `bindingsRuntime` (in `standaloneRuntimeSource.ts`)
 * consumes signals shaped like `handSignals.ts`'s `HandSignals` (only the
 * subset `manualProvider.ts`'s demo vocabulary already covers:
 * `indexTipX`/`Y`, `palmX`/`Y`, `pinchStrength`/`Distance`,
 * `gestureConfidence`, `handPresence`, plus `event:*` transitions). This
 * module derives that same signal shape from live Gesture Recognizer
 * output so a camera-driven export's bindings evaluate identically to a
 * demo-driven one — tracking only the single highest-confidence
 * (`landmarks[0]`) hand per frame (the demo vocabulary itself has no
 * concept of a second hand), with the same EMA smoothing and pinch
 * hysteresis constants `handSignals.ts` documents
 * (`smoothingAlpha`/`pinchEngageThreshold`/`pinchReleaseThreshold`/
 * `maxPinchDistance`).
 *
 * ## Integration with the demo runtime: never replaces, only overrides
 *
 * `standaloneRuntimeSource.ts` exposes a small, optional extension point
 * (`window.__exportSetActiveInput`) that this module calls only while the
 * camera is genuinely active, and clears (reverting to demo signals)
 * immediately on `stop()`/error. A demo-only export (no camera script
 * present) never has anything call that function, so its behavior is
 * completely unchanged — see that module's own doc comment.
 *
 * ## Demo controls are never hidden or disabled by camera state
 *
 * This module only ever appends into its own `#camera-controls-host`
 * element; it never touches `#demo-controls-host` or disables any control
 * inside it. Every failure category below (and the idle/starting/stopped
 * states) leaves the demo controls exactly as usable as they were before
 * `Enable camera` was ever clicked — satisfying issue #56's "each failure
 * preserves usable demo controls" acceptance criterion structurally,
 * rather than by ad hoc per-branch bookkeeping.
 *
 * ## No transmission, no persistence
 *
 * Nothing in this module (or the export as a whole) makes a network
 * request other than the CDN script/model loads and the dynamic import
 * above -- no `fetch`/`XMLHttpRequest`/`sendBeacon`/WebSocket call ever
 * carries a video frame, landmark, or derived signal anywhere. Nothing is
 * written to `localStorage`/`sessionStorage`/`indexedDB`/cookies. There is
 * no analytics hook anywhere in the exported page. This holds structurally
 * (the exported file has no such API calls anywhere in its source), not
 * merely as an intended behavior.
 */

/** The exact `@mediapipe/tasks-vision` version `mediapipeProvider.ts` is
 * pinned to (`MEDIAPIPE_TASKS_VISION_VERSION` in that module) -- kept in
 * sync manually; `generateHtmlExport.test.ts` asserts this constant
 * matches that module's exported version so the two can never silently
 * drift apart. */
export const MEDIAPIPE_TASKS_VISION_VERSION = '1.0.1';

/** ESM entry point for `@mediapipe/tasks-vision`, loaded via dynamic
 * `import()` at runtime -- this is the CDN counterpart of what
 * `mediapipeProvider.ts` gets from its bundler-resolved
 * `import('@mediapipe/tasks-vision')`. */
export const MEDIAPIPE_VISION_BUNDLE_CDN_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/vision_bundle.mjs`;

/** Same Wasm runtime fileset base URL `mediapipeProvider.ts` uses,
 * pinned to the same version. */
export const MEDIAPIPE_WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/wasm`;

/** Same Gesture Recognizer model asset `mediapipeProvider.ts` uses. */
export const GESTURE_RECOGNIZER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

/** Same throttling rate `mediapipeProvider.ts` documents and uses. */
export const MAX_INFERENCE_FPS = 30;

/** Returns the camera/tracking module as a plain-JS source string, ready
 * to be wrapped in a `<script>` tag by `generateHtmlExport.ts`, immediately
 * after the standalone runtime script (`standaloneRuntimeSource.ts`'s
 * `buildStandaloneRuntimeScript()`) so `window.__exportSetActiveInput`
 * already exists by the time any camera state change tries to call it. */
export function buildStandaloneCameraScript(): string {
  return `
(function () {
  "use strict";

  var MEDIAPIPE_VERSION = ${JSON.stringify(MEDIAPIPE_TASKS_VISION_VERSION)};
  var VISION_BUNDLE_URL = ${JSON.stringify(MEDIAPIPE_VISION_BUNDLE_CDN_URL)};
  var WASM_BASE_URL = ${JSON.stringify(MEDIAPIPE_WASM_BASE_URL)};
  var MODEL_URL = ${JSON.stringify(GESTURE_RECOGNIZER_MODEL_URL)};
  var MAX_INFERENCE_FPS = ${MAX_INFERENCE_FPS};
  var MIN_INFERENCE_INTERVAL_MS = 1000 / MAX_INFERENCE_FPS;

  // ---------------------------------------------------------------------
  // Failure classification: compact port of cameraFailure.ts's category
  // vocabulary and recovery messages (adapted wording for a standalone
  // exported page rather than the editor).
  // ---------------------------------------------------------------------

  var RECOVERY_MESSAGES = {
    "insecure-context":
      "Camera access needs a secure connection (HTTPS) or localhost. Reload this page over HTTPS, or use the demo controls above instead.",
    "unsupported-browser":
      "This browser doesn't support the camera hand-tracking features this page needs. Try an up-to-date version of Chrome, Edge, or Firefox, or use the demo controls above instead.",
    "permission-denied":
      "Camera access was denied. Allow camera access for this page from your browser's address bar or site settings, then try again -- or use the demo controls above instead.",
    "missing-device":
      "No camera was found on this device. Connect a camera and try again, or use the demo controls above instead.",
    "model-failure":
      "The hand-tracking model could not be loaded, possibly due to a network issue. Check your connection and try again, or use the demo controls above instead.",
    "tracking-failure":
      "Hand tracking stopped unexpectedly. Try again, or use the demo controls above instead.",
    "unknown-failure":
      "Something went wrong starting the camera. Try again, or use the demo controls above instead."
  };

  var PERMISSION_DENIED_NAMES = { NotAllowedError: true, SecurityError: true };
  var MISSING_DEVICE_NAMES = { NotFoundError: true, DevicesNotFoundError: true, OverconstrainedError: true };

  function causeName(cause) {
    if (cause && typeof cause === "object" && typeof cause.name === "string") return cause.name;
    return undefined;
  }

  /** Mirrors cameraFailure.ts's categorizeProviderError -- exported on the
   * module scope (not just used internally) so tests can reach it via
   * window.__exportCameraTestHooks. */
  function categorizeGetUserMediaFailure(cause) {
    var name = causeName(cause);
    if (name && MISSING_DEVICE_NAMES[name]) return "missing-device";
    if (name && PERMISSION_DENIED_NAMES[name]) return "permission-denied";
    return "permission-denied";
  }

  function isSupported() {
    return (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    );
  }

  // ---------------------------------------------------------------------
  // Signal derivation: compact single-hand port of handSignals.ts's EMA
  // smoothing and pinch hysteresis, reading MediaPipe's raw landmarks
  // directly (no intermediate TrackingFrame contract -- unnecessary for a
  // single embedded consumer).
  // ---------------------------------------------------------------------

  var WRIST = 0, THUMB_TIP = 4, INDEX_MCP = 5, INDEX_TIP = 8, MIDDLE_MCP = 9, RING_MCP = 13, PINKY_MCP = 17;
  var PALM_CENTER_LANDMARKS = [WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP];
  var SMOOTHING_ALPHA = 0.35;
  var PINCH_ENGAGE_THRESHOLD = 0.75;
  var PINCH_RELEASE_THRESHOLD = 0.55;
  var MAX_PINCH_DISTANCE = 0.35;

  var CANNED_GESTURE_TO_NAME = {
    Closed_Fist: "closedFist",
    Open_Palm: "openPalm",
    Pointing_Up: "pointingUp",
    Thumb_Up: "thumbsUp",
    Victory: "victory"
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function dist2D(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function landmarkAverage(landmarks, indices) {
    var x = 0, y = 0;
    indices.forEach(function (i) { x += landmarks[i].x; y += landmarks[i].y; });
    return { x: x / indices.length, y: y / indices.length };
  }

  // ---------------------------------------------------------------------
  // Camera controller: compact port of mediapipeProvider.ts's start/stop
  // lifecycle, generation-counter invalidation, and throttled inference
  // loop -- adapted to emit the demo-shaped signal object directly instead
  // of a TrackingFrame.
  // ---------------------------------------------------------------------

  function createCameraController() {
    var status = "idle"; // idle | starting | active | error | stopped
    var generation = 0;
    var rafHandle = null;
    var inFlight = false;
    var stream = null;
    var video = null;
    var recognizer = null;
    var lastInferenceTime = -Infinity;
    var lastVideoTimestamp = 0;

    var ema = null;
    var pinching = false;
    var currentGesture = null;
    var handPresent = false;

    var statusListeners = [];
    var errorListeners = [];
    var eventListeners = [];

    function emitStatus(next) {
      status = next;
      statusListeners.forEach(function (l) { l(status); });
    }

    function emitError(category) {
      errorListeners.forEach(function (l) { l(category, RECOVERY_MESSAGES[category]); });
    }

    function emitEvents(events) {
      if (events.length === 0) return;
      eventListeners.forEach(function (l) { l(events); });
    }

    /** Tears down every acquired resource. Safe to call from any state,
     * including partway through start()'s async pipeline -- mirrors
     * mediapipeProvider.ts's releaseResources. */
    function releaseResources() {
      if (rafHandle !== null) {
        window.cancelAnimationFrame(rafHandle);
        rafHandle = null;
      }
      if (stream) {
        stream.getTracks().forEach(function (track) { track.stop(); });
        stream = null;
      }
      if (video) {
        video.pause();
        video.srcObject = null;
        video = null;
      }
      if (recognizer) {
        try {
          recognizer.close();
        } catch (e) {
          // Releasing a Wasm resource should never surface as a crash.
        }
        recognizer = null;
      }
      inFlight = false;
      ema = null;
      pinching = false;
      currentGesture = null;
      handPresent = false;
      lastInferenceTime = -Infinity;
      lastVideoTimestamp = 0;
    }

    function start() {
      // Idempotent -- mirrors the TrackingProvider contract.
      if (status === "starting" || status === "active") return;

      if (!isSupported()) {
        emitError("unsupported-browser");
        emitStatus("error");
        return;
      }

      emitStatus("starting");
      var myGeneration = ++generation;
      runStartPipeline(myGeneration);
    }

    function runStartPipeline(myGeneration) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "user" }, audio: false })
        .then(
          function (acquiredStream) {
            if (myGeneration !== generation) {
              acquiredStream.getTracks().forEach(function (track) { track.stop(); });
              return;
            }
            stream = acquiredStream;
            var videoElement = document.createElement("video");
            videoElement.muted = true;
            videoElement.playsInline = true;
            videoElement.srcObject = acquiredStream;
            videoElement
              .play()
              .then(
                function () {
                  if (myGeneration !== generation) return;
                  video = videoElement;
                  loadModel(myGeneration);
                },
                function () {
                  if (myGeneration !== generation) return;
                  emitError("tracking-failure");
                  releaseResources();
                  emitStatus("error");
                }
              );
          },
          function (cause) {
            if (myGeneration !== generation) return;
            emitError(categorizeGetUserMediaFailure(cause));
            emitStatus("error");
          }
        );
    }

    function loadModel(myGeneration) {
      import(/* @vite-ignore */ VISION_BUNDLE_URL).then(
        function (visionModule) {
          if (myGeneration !== generation) return;
          visionModule.FilesetResolver.forVisionTasks(WASM_BASE_URL).then(
            function (fileset) {
              if (myGeneration !== generation) return;
              visionModule.GestureRecognizer.createFromOptions(fileset, {
                baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
                runningMode: "VIDEO",
                numHands: 2
              }).then(
                function (createdRecognizer) {
                  if (myGeneration !== generation) {
                    try { createdRecognizer.close(); } catch (e) {}
                    return;
                  }
                  recognizer = createdRecognizer;
                  emitStatus("active");
                  lastInferenceTime = -Infinity;
                  lastVideoTimestamp = 0;
                  scheduleNextTick(myGeneration);
                },
                function () { handleModelFailure(myGeneration); }
              );
            },
            function () { handleModelFailure(myGeneration); }
          );
        },
        function () { handleModelFailure(myGeneration); }
      );
    }

    function handleModelFailure(myGeneration) {
      if (myGeneration !== generation) return;
      emitError("model-failure");
      releaseResources();
      emitStatus("error");
    }

    function scheduleNextTick(myGeneration) {
      rafHandle = window.requestAnimationFrame(function () { onAnimationFrame(myGeneration); });
    }

    function onAnimationFrame(myGeneration) {
      if (myGeneration !== generation || status !== "active") return;

      var nowMs = performance.now();
      if (
        !inFlight &&
        video &&
        recognizer &&
        nowMs - lastInferenceTime >= MIN_INFERENCE_INTERVAL_MS &&
        video.readyState >= 2 /* HTMLMediaElement.HAVE_CURRENT_DATA */
      ) {
        inFlight = true;
        var failed = false;
        try {
          var videoTimestamp = Math.max(Math.round(nowMs), lastVideoTimestamp + 1);
          lastVideoTimestamp = videoTimestamp;
          lastInferenceTime = nowMs;
          var result = recognizer.recognizeForVideo(video, videoTimestamp);
          if (myGeneration === generation) processResult(result);
        } catch (cause) {
          failed = true;
        } finally {
          inFlight = false;
        }
        if (failed) {
          if (myGeneration === generation) {
            emitError("tracking-failure");
            releaseResources();
            emitStatus("error");
          }
          return;
        }
      }

      if (myGeneration === generation && status === "active") {
        scheduleNextTick(myGeneration);
      }
    }

    function processResult(result) {
      var events = [];
      var landmarksList = (result && result.landmarks) || [];

      if (landmarksList.length === 0) {
        if (handPresent) {
          if (currentGesture) events.push("event:gestureExit");
          if (pinching) events.push("event:pinchEnd");
          events.push("event:handDisappear");
        }
        handPresent = false;
        ema = null;
        pinching = false;
        currentGesture = null;
        emitEvents(events);
        return;
      }

      var landmarks = landmarksList[0];
      var isNewSegment = !handPresent;
      if (isNewSegment) {
        handPresent = true;
        events.push("event:handAppear");
      }

      var palm = landmarkAverage(landmarks, PALM_CENTER_LANDMARKS);
      var rawIndexX = landmarks[INDEX_TIP].x;
      var rawIndexY = landmarks[INDEX_TIP].y;
      var rawPinchDistance = clamp(
        dist2D(landmarks[THUMB_TIP], landmarks[INDEX_TIP]) / MAX_PINCH_DISTANCE,
        0,
        1
      );
      var rawPinchStrength = 1 - rawPinchDistance;

      if (isNewSegment || !ema) {
        ema = {
          indexTipX: rawIndexX,
          indexTipY: rawIndexY,
          palmX: palm.x,
          palmY: palm.y,
          pinchStrength: rawPinchStrength
        };
      } else {
        ema.indexTipX += SMOOTHING_ALPHA * (rawIndexX - ema.indexTipX);
        ema.indexTipY += SMOOTHING_ALPHA * (rawIndexY - ema.indexTipY);
        ema.palmX += SMOOTHING_ALPHA * (palm.x - ema.palmX);
        ema.palmY += SMOOTHING_ALPHA * (palm.y - ema.palmY);
        ema.pinchStrength += SMOOTHING_ALPHA * (rawPinchStrength - ema.pinchStrength);
      }

      var gestures = result.gestures && result.gestures[0];
      var gestureCategory = gestures && gestures[0] && gestures[0].categoryName;
      var nextGesture = gestureCategory ? (CANNED_GESTURE_TO_NAME[gestureCategory] || null) : null;
      if (nextGesture !== currentGesture) {
        if (currentGesture) events.push("event:gestureExit");
        if (nextGesture) events.push("event:gestureEnter");
        currentGesture = nextGesture;
      }

      if (!pinching && ema.pinchStrength >= PINCH_ENGAGE_THRESHOLD) {
        pinching = true;
        events.push("event:pinchStart");
      } else if (pinching && ema.pinchStrength <= PINCH_RELEASE_THRESHOLD) {
        pinching = false;
        events.push("event:pinchEnd");
      }

      emitEvents(events);
    }

    /** Returns the current signals in the exact shape
     * standaloneRuntimeSource.ts's bindingsRuntime consumes (matching
     * manualProvider.ts's demo vocabulary) -- see the module doc comment's
     * "Signal derivation" section. Never transmitted or persisted anywhere
     * -- read only by the local draw loop via window.__exportSetActiveInput. */
    function getSignals() {
      if (!handPresent || !ema) {
        return {
          indexTipX: null,
          indexTipY: null,
          palmX: null,
          palmY: null,
          pinchStrength: null,
          pinchDistance: null,
          gestureConfidence: 0,
          handPresence: false
        };
      }
      return {
        indexTipX: clamp(ema.indexTipX, 0, 1),
        indexTipY: clamp(ema.indexTipY, 0, 1),
        palmX: clamp(ema.palmX, 0, 1),
        palmY: clamp(ema.palmY, 0, 1),
        pinchStrength: clamp(ema.pinchStrength, 0, 1),
        pinchDistance: clamp(1 - ema.pinchStrength, 0, 1),
        gestureConfidence: currentGesture ? 0.9 : 0,
        handPresence: true
      };
    }

    function stop() {
      // Idempotent and never throws. Invalidating generation here is what
      // stops any async step still in flight (getUserMedia, dynamic
      // import, fileset/model load) from adopting its result after this
      // call -- mirrors mediapipeProvider.ts's stop().
      generation += 1;
      releaseResources();
      emitStatus("stopped");
    }

    return {
      start: start,
      stop: stop,
      onStatus: function (l) { statusListeners.push(l); },
      onError: function (l) { errorListeners.push(l); },
      onEvents: function (l) { eventListeners.push(l); },
      getSignals: getSignals,
      getStatus: function () { return status; }
    };
  }

  // ---------------------------------------------------------------------
  // UI wiring: privacy notice, Enable/Retry + Stop, visible + programmatic
  // active-state indicator, per-category error message. Mirrors
  // CameraControl.tsx's structure (Task 31), adapted to plain DOM.
  // ---------------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", function () {
    var host = document.getElementById("camera-controls-host");
    if (!host) return;

    var controller = createCameraController();
    var pendingCameraEvents = [];
    controller.onEvents(function (events) {
      pendingCameraEvents = pendingCameraEvents.concat(events);
    });

    var activeInputHandle = {
      getSignals: controller.getSignals,
      drainEvents: function () {
        var events = pendingCameraEvents;
        pendingCameraEvents = [];
        return events;
      }
    };

    function el(tag, props) {
      var e = document.createElement(tag);
      if (props) {
        Object.keys(props).forEach(function (k) {
          if (k === "text") e.textContent = props[k];
          else e.setAttribute(k, props[k]);
        });
      }
      return e;
    }

    var heading = el("h2", { text: "Live camera" });
    var notice = el("p", {
      "class": "camera-privacy-notice",
      text:
        "Live camera hand tracking requires a secure connection (HTTPS) or localhost. " +
        "Video from your camera is processed locally in your browser for hand tracking " +
        "-- it is never recorded, stored, or uploaded."
    });
    var statusEl = el("p", { role: "status", "aria-live": "polite", "data-testid": "camera-status" });
    var errorEl = el("p", { role: "alert", "aria-live": "assertive", "data-testid": "camera-error" });
    errorEl.style.display = "none";
    var enableBtn = el("button", { type: "button", text: "Enable camera", "data-testid": "camera-enable" });
    var stopBtn = el("button", { type: "button", text: "Stop camera", "data-testid": "camera-stop" });
    stopBtn.style.display = "none";

    host.appendChild(heading);
    host.appendChild(notice);
    host.appendChild(statusEl);
    host.appendChild(errorEl);
    host.appendChild(enableBtn);
    host.appendChild(stopBtn);

    function render(status) {
      if (status === "idle") statusEl.textContent = "";
      else if (status === "starting") statusEl.textContent = "Starting camera…";
      else if (status === "active") {
        statusEl.textContent = "Camera is active. Hand tracking is running locally in your browser.";
      } else if (status === "stopped") statusEl.textContent = "Camera stopped. No video is being captured.";

      errorEl.style.display = status === "error" ? "" : "none";
      var showEnableOrRetry = status === "idle" || status === "stopped" || status === "error";
      var showStop = status === "starting" || status === "active";
      enableBtn.style.display = showEnableOrRetry ? "" : "none";
      enableBtn.textContent = status === "error" ? "Retry" : "Enable camera";
      stopBtn.style.display = showStop ? "" : "none";
      enableBtn.setAttribute("aria-pressed", status === "active" ? "true" : "false");

      if (typeof window.__exportSetActiveInput === "function") {
        window.__exportSetActiveInput(status === "active" ? activeInputHandle : null);
      }
    }

    controller.onStatus(render);
    controller.onError(function (category, message) {
      errorEl.textContent = message;
    });

    enableBtn.addEventListener("click", function () {
      // Checked here, before ever touching getUserMedia or the recognizer
      // -- an insecure context can't be fixed by retrying the same
      // request, matching CameraControl.tsx's exact rule (Task 31).
      if (!window.isSecureContext) {
        errorEl.textContent = RECOVERY_MESSAGES["insecure-context"];
        render("error");
        return;
      }
      errorEl.textContent = "";
      controller.start();
    });

    stopBtn.addEventListener("click", function () {
      controller.stop();
    });

    // Releases camera/tracking resources if the page is closed/navigated
    // away from while starting or active -- mirrors CameraControl.tsx's
    // unmount cleanup.
    window.addEventListener("beforeunload", function () {
      controller.stop();
    });

    // Test-only hook: never referenced by any real runtime path above,
    // exposed purely so a jsdom test can drive/inspect this module without
    // relying on internal closures it has no other way to reach.
    window.__exportCameraTestHooks = {
      controller: controller,
      categorizeGetUserMediaFailure: categorizeGetUserMediaFailure,
      recoveryMessages: RECOVERY_MESSAGES
    };

    render("idle");
  });
})();
`;
}
