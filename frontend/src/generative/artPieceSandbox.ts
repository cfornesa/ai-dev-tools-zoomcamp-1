/**
 * Issue #199 (epic #196): builds the sandboxed document that renders a
 * raw, AI-generated Canvas2D art-piece snippet returned by
 * `POST /api/ai/art-pieces/generate/` (`../api/artPieces.ts`).
 *
 * ## This is the actual security control, not the server's system prompt
 *
 * Per issue #197's architecture decision, a generated piece is a new,
 * fully untrusted trust boundary. The backend (`ai_provider/art_piece_
 * provider.py`) asks Mistral for network-free, self-contained code, but
 * that request is not a security control -- nothing stops a model from
 * ignoring it. Safety comes entirely from how this module renders the
 * result:
 *
 * 1. The document this function returns is only ever loaded into an
 *    `<iframe sandbox="allow-scripts">` via `srcdoc` -- **never**
 *    `allow-same-origin`, and never a `src` pointing at this app's own
 *    origin. Omitting `allow-same-origin` gives the iframe a permanently
 *    opaque ("null") origin, so even if the generated code tries to read
 *    `document.cookie`, `localStorage`, or reach this app's own `/api`
 *    surface via a same-origin credentialed request, none of that
 *    succeeds -- there is no origin for those APIs to succeed *as*.
 * 2. A strict Content-Security-Policy `<meta>` tag is injected by this
 *    function itself -- never left to the AI's own output to include
 *    correctly (it can't be trusted to). `default-src 'none'` blocks any
 *    network egress (fetch/XHR/WebSocket/images/fonts/frames/etc.) the
 *    generated script might still attempt despite the system prompt;
 *    `script-src`/`style-src 'unsafe-inline'` allow only the inline
 *    `<script>`/styling this function itself controls the shape of.
 * 3. An inert error/ready listener (this module's own code, never the
 *    AI's) is placed *before* the untrusted snippet in document order,
 *    so it's already registered before the snippet's own `<script>` runs.
 *    It reports success/failure to the parent via `postMessage` -- the
 *    only channel available to an opaque-origin sandboxed iframe -- so
 *    the caller (`ArtPieceStudio.tsx`) knows whether to enable Download.
 *
 * `parseArtPieceSandboxMessage` is the parent-side counterpart: since a
 * sandboxed iframe with no `allow-same-origin` always has an opaque
 * origin, a `message` event's `event.origin` is the literal string
 * `"null"` for every such iframe indiscriminately -- it cannot be used to
 * distinguish this sandbox from any other opaque-origin content on the
 * page. The caller must instead check `event.source === iframe
 * .contentWindow` (an object identity check, not an origin/string check)
 * before trusting a message's contents; this module only handles parsing
 * the payload once that identity check has already passed.
 */

import type { ArtPieceLibrary } from '../api/artPieces';

export const ART_PIECE_SANDBOX_MESSAGE_SOURCE = 'art-piece-sandbox';
export const ART_PIECE_BRIDGE_VERSION = 1;

export type ArtPieceSandboxMessage =
  | { source: typeof ART_PIECE_SANDBOX_MESSAGE_SOURCE; status: 'ready' }
  | { source: typeof ART_PIECE_SANDBOX_MESSAGE_SOURCE; status: 'error'; message: string };

/** The exact `sandbox` attribute value every art-piece preview iframe must
 * use. Exported as a single constant (rather than inlined at each call
 * site) so a test can assert the literal string never grows
 * `allow-same-origin` (or any other capability) by an incautious future
 * edit -- see `artPieceSandbox.test.ts`. */
export const ART_PIECE_IFRAME_SANDBOX = 'allow-scripts';

/** Issue #430/#431: the `<iframe>`'s own `allow` (Permissions Policy)
 * attribute -- distinct from the CSP `<meta>` tag this module injects
 * into the document. `getUserMedia` for the microphone and camera
 * capabilities is gated by Permissions Policy, not CSP; without this, a
 * sandboxed iframe's own `navigator.mediaDevices.getUserMedia` call
 * rejects with a permissions-policy violation before it can even
 * prompt. */
export const ART_PIECE_IFRAME_ALLOW = 'microphone; camera';

/** Issue #199 (Three.js/A-Frame extension): these two libraries need
 * their own runtime loaded via a pinned CDN `<script>` this module
 * injects -- never a URL the AI supplies (`art_piece_provider.py`'s
 * system prompts for these two libraries explicitly forbid the model
 * from writing its own `<script src>`). Versions match
 * `ai_provider/art_piece_provider.py`'s `THREEJS_VERSION`/
 * `AFRAME_VERSION` constants -- keep the two in sync by hand, mirroring
 * how `generateHtmlExport.ts`'s `P5_VERSION` is the one place this app
 * already pins a CDN library version. */
const LIBRARY_CDN: Partial<Record<ArtPieceLibrary, string>> = {
  threejs: 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js',
  // Pinned to 1.4.2, not 1.5.0: jsdelivr's aframe@1.5.0 package has no
  // `dist/aframe.min.js` (404 in production, #236) -- see
  // `ai_provider/art_piece_provider.py`'s `AFRAME_VERSION` comment.
  aframe: 'https://cdn.jsdelivr.net/npm/aframe@1.4.2/dist/aframe.min.js',
};
// The one external host any pinned CDN URL above may ever point at --
// checked at the call site (`cdnScriptTag`) so an accidental future
// typo/edit to `LIBRARY_CDN` can't silently widen the CSP's `script-src`
// to an unintended host.
const ALLOWED_CDN_ORIGIN = 'https://cdn.jsdelivr.net';

function buildCsp(library: ArtPieceLibrary): string {
  const cdnUrl = LIBRARY_CDN[library];
  if (cdnUrl && !cdnUrl.startsWith(`${ALLOWED_CDN_ORIGIN}/`)) {
    throw new Error(`Refusing to build a CSP for an unexpected CDN origin: ${cdnUrl}`);
  }
  // A-Frame's own system-initialization code calls a dynamic
  // eval/Function-constructor internally (confirmed live in production
  // while investigating #236: with 'unsafe-eval' absent, every scene
  // threw "Uncaught TypeError: a[e] is not a constructor" from deep
  // inside aframe.min.js's initSystem, a CSP-blocked-eval failure
  // masquerading as a library bug -- reproduced 3/3 with the policy
  // below, 0/3 once 'unsafe-eval' was added). Three.js's own script
  // needs no such allowance, so this stays scoped to A-Frame only
  // rather than widening the CSP for every library.
  const unsafeEval = library === 'aframe' ? " 'unsafe-eval'" : '';
  // Issue #455: real hand-steering loads `@mediapipe/tasks-vision`'s ESM
  // bundle from the same pinned CDN as the library scripts above, plus
  // its WASM runtime and the gesture-recognizer model file it fetches at
  // startup -- the model happens to be hosted on
  // `storage.googleapis.com` (Google's own model CDN), a second, narrow
  // origin distinct from `ALLOWED_CDN_ORIGIN`. `script-src` covers the
  // ESM bundle fetch itself; `connect-src` (absent before this issue,
  // which meant `default-src 'none'` silently blocked every fetch) covers
  // the WASM binary and model file; `worker-src blob:` covers the Worker
  // MediaPipe's WASM runtime spins up via a Blob URL; `'wasm-unsafe-eval'`
  // is required for WebAssembly compilation under a strict CSP that
  // doesn't otherwise allow 'unsafe-eval' (Three.js pieces). Hand-steering
  // is available to every library (Canvas2D/SVG via the flat spatial
  // shell), so these allowances apply unconditionally, not only when
  // `cdnUrl` is set.
  const MEDIAPIPE_MODEL_ORIGIN = 'https://storage.googleapis.com';
  const scriptSrc = cdnUrl
    ? `script-src 'unsafe-inline'${unsafeEval} 'wasm-unsafe-eval' ${ALLOWED_CDN_ORIGIN};`
    : `script-src 'unsafe-inline' 'wasm-unsafe-eval' ${ALLOWED_CDN_ORIGIN};`;
  const connectSrc = `connect-src ${ALLOWED_CDN_ORIGIN} ${MEDIAPIPE_MODEL_ORIGIN};`;
  // Issue #433: SVG screenshot capture rasterizes the serialized SVG
  // markup through an in-sandbox `Image`/`data:` URL (see the
  // `screenshot` command handler below) so every library downloads a
  // real PNG, not raw SVG text the parent's `atob`-based decoder can't
  // read. `img-src data:` is scoped to that one same-sandbox rasterization
  // step -- it does not let generated code fetch a remote image, since
  // `data:` is not a network origin.
  return `default-src 'none'; ${scriptSrc} ${connectSrc} worker-src blob:; style-src 'unsafe-inline'; img-src data:;`;
}

/** This function's own code -- never the AI's output -- registers the
 * error/ready listeners before the untrusted snippet's `<script>` runs
 * (document order = execution order for synchronous inline scripts), so
 * even a snippet that throws synchronously during its own top-level
 * evaluation is still caught. */
function buildListenerScript(library: ArtPieceLibrary): string {
  return `
<script>
(function () {
  var pieceLibrary = ${JSON.stringify(library)};
  function report(status, message) {
    try {
      window.parent.postMessage(
        { source: ${JSON.stringify(ART_PIECE_SANDBOX_MESSAGE_SOURCE)}, status: status, message: message },
        '*'
      );
    } catch (e) {
      // The parent frame is the only postMessage target; if that somehow
      // throws, there is nothing else this sandbox can do to report it.
    }
  }
  // Issue #430: reports acknowledged runtime state (not just command
  // receipt) for sound/microphone, so the parent -- and this suite's own
  // E2E spec -- observe what the sandbox actually did, never a spoofed
  // "success" for a command that had no real effect.
  function reportState(status, extra) {
    try {
      var payload = { source: ${JSON.stringify(ART_PIECE_SANDBOX_MESSAGE_SOURCE)}, status: status };
      for (var key in extra) { if (Object.prototype.hasOwnProperty.call(extra, key)) payload[key] = extra[key]; }
      window.parent.postMessage(payload, '*');
    } catch (e) {}
  }
  // Sound only ever starts from an explicit "toggle-sound" activation
  // (never on load), per #430's own acceptance criterion. The
  // AudioContext is created lazily on first activation so a piece that
  // never touches Sound never even requests one.
  var audioCtx = null;
  var masterGain = null;
  var soundOn = false;
  var micStream = null;
  var NOTE_FREQUENCIES = {
    a: 220.0, s: 246.94, d: 261.63, f: 293.66, g: 329.63, h: 349.23, j: 392.0, k: 440.0
  };
  function ensureAudio() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.2;
      masterGain.connect(audioCtx.destination);
    }
    return audioCtx;
  }
  function stopMicrophone() {
    if (micStream) {
      micStream.getTracks().forEach(function (track) { track.stop(); });
      micStream = null;
    }
  }
  // Issue #431: camera composition. cameraOverlay is a real <video>
  // element -- never intercepts pointer input (pointer-events: none) and
  // sits on top of the artwork at an adjustable opacity, matching the
  // acceptance criterion's "visibly composites overlay/background"
  // requirement rather than an invisible/decorative element.
  var CAMERA_OVERLAY_ID = 'art-piece-camera-overlay';
  var cameraStream = null;
  var cameraOpacity = 0.5;
  function getCameraOverlay() {
    var video = document.getElementById(CAMERA_OVERLAY_ID);
    if (!video) {
      video = document.createElement('video');
      video.id = CAMERA_OVERLAY_ID;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.style.position = 'fixed';
      video.style.inset = '0';
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.pointerEvents = 'none';
      video.style.opacity = String(cameraOpacity);
      document.body.appendChild(video);
    }
    return video;
  }
  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(function (track) { track.stop(); });
      cameraStream = null;
    }
    var video = document.getElementById(CAMERA_OVERLAY_ID);
    if (video) video.remove();
    // Issue #455: hand-steering reads frames from this same camera feed --
    // losing the camera (an explicit disable, or the track ending on its
    // own) must stop that loop too, not leave it spinning against a
    // removed <video> element.
    stopHandTrackingLoop();
    if (steeringActive) {
      steeringActive = false;
      reportState('steering', { active: false, error: 'camera-required' });
    }
  }
  // Issue #431: composite the camera overlay into a screenshot in the
  // same stacking order it renders live (artwork first, camera on top at
  // its current opacity) -- a plain canvas.toDataURL() would silently
  // drop the camera the acceptance criterion requires be visible in the
  // captured PNG.
  function compositeScreenshot(baseCanvas) {
    var video = document.getElementById(CAMERA_OVERLAY_ID);
    if (!cameraStream || !video || !video.videoWidth) return baseCanvas.toDataURL('image/png');
    var composite = document.createElement('canvas');
    composite.width = baseCanvas.width;
    composite.height = baseCanvas.height;
    var compositeContext = composite.getContext('2d');
    compositeContext.drawImage(baseCanvas, 0, 0);
    compositeContext.save();
    compositeContext.globalAlpha = cameraOpacity;
    compositeContext.drawImage(video, 0, 0, composite.width, composite.height);
    compositeContext.restore();
    return composite.toDataURL('image/png');
  }
  // Issue #432: hand-steering ownership and Reset. Full real hand-
  // landmark detection (MediaPipe running inside this sandbox) is
  // explicitly deferred to a separate, approved follow-up -- see
  // #455 -- since it needs a backend system-prompt change so generated
  // Three.js/A-Frame snippets register a controllable camera, plus a
  // CDN-loaded vision model inside this CSP-locked sandbox. This scoped
  // pass implements the real, testable half: activation gating,
  // ownership of exactly one registered camera adapter, bounded pose
  // changes, and Reset -- driven by a documented steer-signal command
  // any real or synthetic signal source can call through the same path,
  // so swapping in real landmarks later changes nothing about this
  // lifecycle. A piece opts in by calling
  // window.__registerArtPieceCamera({ getPose, setPose, reset })
  // itself; this runtime never reaches into an arbitrary Three.js/
  // A-Frame scene uninvited.
  var steeringActive = false;
  var registeredCamera = null;
  var initialCameraPose = null;
  window.__registerArtPieceCamera = function (adapter) {
    registeredCamera = adapter;
    try {
      initialCameraPose = adapter.getPose();
    } catch (e) {
      initialCameraPose = null;
    }
  };
  var STEER_MIN_RADIUS = 1.5;
  var STEER_MAX_RADIUS = 20;
  function clampSteerPose(pose) {
    var radius = Math.sqrt(pose.x * pose.x + pose.y * pose.y + pose.z * pose.z);
    if (radius === 0) return pose;
    var clampedRadius = Math.max(STEER_MIN_RADIUS, Math.min(STEER_MAX_RADIUS, radius));
    var scale = clampedRadius / radius;
    return { x: pose.x * scale, y: pose.y * scale, z: pose.z * scale };
  }
  // Shared by the 'steer-signal'/'navigate-signal' command handlers below
  // and, since #455, the real hand-tracking loop -- one bounded-pose
  // application path regardless of which signal source drove it.
  function applySteerDelta(dx, dy, dz) {
    if (!steeringActive || !registeredCamera) {
      reportState('steering', { active: steeringActive, error: 'not-ready' });
      return;
    }
    var currentPose = registeredCamera.getPose();
    var nextPose = clampSteerPose({
      x: currentPose.x + (typeof dx === 'number' ? dx : 0),
      y: currentPose.y + (typeof dy === 'number' ? dy : 0),
      z: currentPose.z + (typeof dz === 'number' ? dz : 0)
    });
    registeredCamera.setPose(nextPose.x, nextPose.y, nextPose.z);
    reportState('steering', { active: true, pose: nextPose });
  }
  // Issue #455: real hand-landmark detection driving applySteerDelta above
  // with actual gesture-derived deltas, replacing the purely-synthetic
  // 'steer-signal' command as the piece's real signal source. Loaded
  // lazily -- only once hand-steering is first enabled -- from the exact
  // CDN origin/version the main app's own mediapipeProvider.ts already
  // pins (at mediapipe/tasks-vision, version 1.0.1), so a piece that never
  // touches steering never pays for the model download. Runs on the same
  // camera video element enable-camera already created for the overlay --
  // never a second getUserMedia stream -- matching the existing
  // "camera-required" gate this feature already had before real tracking
  // existed to drive it.
  var MEDIAPIPE_VISION_VERSION = '1.0.1';
  var MEDIAPIPE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MEDIAPIPE_VISION_VERSION + '/wasm';
  var MEDIAPIPE_BUNDLE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MEDIAPIPE_VISION_VERSION + '/vision_bundle.mjs';
  var GESTURE_RECOGNIZER_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
  var handTracking = { recognizer: null, loading: false, rafId: null, prevPalm: null, prevPinch: null };
  function reportModelStatus(modelStatus, extra) {
    var payload = { modelStatus: modelStatus };
    for (var key in extra) { if (Object.prototype.hasOwnProperty.call(extra, key)) payload[key] = extra[key]; }
    reportState('hand-tracking-model', payload);
  }
  // Palm center: the mean of the five MediaPipe hand-landmark points that
  // sit at the base of each finger/the wrist (0, 5, 9, 13, 17) -- stable
  // across an open or closed hand, unlike a single fingertip landmark.
  function palmCenter(landmarks) {
    var ids = [0, 5, 9, 13, 17];
    var x = 0, y = 0;
    for (var i = 0; i < ids.length; i++) { x += landmarks[ids[i]].x; y += landmarks[ids[i]].y; }
    return { x: x / ids.length, y: y / ids.length };
  }
  // Thumb tip (4) to index fingertip (8) distance, in MediaPipe's own
  // normalized [0, 1] image-space coordinates -- shrinking (a pinch
  // closing) drives zoom-in, growing (opening) drives zoom-out.
  function pinchDistance(landmarks) {
    var thumb = landmarks[4], index = landmarks[8];
    var dx = thumb.x - index.x, dy = thumb.y - index.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  var HAND_PAN_SENSITIVITY = 6;
  var HAND_ZOOM_SENSITIVITY = 20;
  function handleHandTrackingResult(result) {
    if (!result.landmarks || !result.landmarks.length) {
      handTracking.prevPalm = null;
      handTracking.prevPinch = null;
      return;
    }
    var landmarks = result.landmarks[0];
    var palm = palmCenter(landmarks);
    var pinch = pinchDistance(landmarks);
    if (handTracking.prevPalm) {
      var dx = (palm.x - handTracking.prevPalm.x) * HAND_PAN_SENSITIVITY;
      var dy = (palm.y - handTracking.prevPalm.y) * HAND_PAN_SENSITIVITY;
      var dz = handTracking.prevPinch === null ? 0 : (pinch - handTracking.prevPinch) * HAND_ZOOM_SENSITIVITY;
      applySteerDelta(dx, dy, dz);
    }
    handTracking.prevPalm = palm;
    handTracking.prevPinch = pinch;
  }
  function handTrackingLoop() {
    if (!steeringActive || !handTracking.recognizer) return;
    var video = document.getElementById(CAMERA_OVERLAY_ID);
    if (video && video.readyState >= 2) {
      try {
        handleHandTrackingResult(handTracking.recognizer.recognizeForVideo(video, performance.now()));
      } catch (e) {
        // A single bad frame should not stop tracking for the rest of
        // the session.
      }
    }
    handTracking.rafId = requestAnimationFrame(handTrackingLoop);
  }
  function stopHandTrackingLoop() {
    if (handTracking.rafId !== null) {
      cancelAnimationFrame(handTracking.rafId);
      handTracking.rafId = null;
    }
    handTracking.prevPalm = null;
    handTracking.prevPinch = null;
  }
  function ensureHandTracking() {
    if (handTracking.recognizer) { handTrackingLoop(); return; }
    if (handTracking.loading) return;
    handTracking.loading = true;
    reportModelStatus('loading');
    import(/* @vite-ignore */ MEDIAPIPE_BUNDLE_URL).then(function (visionModule) {
      return visionModule.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL).then(function (fileset) {
        return visionModule.GestureRecognizer.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: GESTURE_RECOGNIZER_MODEL_URL, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numHands: 1
        });
      });
    }).then(function (recognizer) {
      handTracking.recognizer = recognizer;
      handTracking.loading = false;
      reportModelStatus('ready');
      handTrackingLoop();
    }).catch(function (err) {
      handTracking.loading = false;
      reportModelStatus('failed', { error: String((err && err.message) || err) });
    });
  }
  // Issue #449: Canvas2D/SVG pieces have no native spatial camera to
  // register the way a Three.js/A-Frame snippet does -- this lazily
  // builds a CSS 3D presentation of the *existing*, unmodified canvas/svg
  // element (never touching its own drawing code) and registers a
  // synthetic camera adapter through the exact same
  // window.__registerArtPieceCamera hook, so the shared steer-signal/
  // reset-view handlers below drive it identically to a real Three.js
  // camera -- no separate steering mechanism, no engine-specific branch
  // past this one lazy setup step. Pose (x, y, z) maps to (rotateY,
  // rotateX, zoom) the same way an orbiting camera's position would;
  // clampSteerPose's existing radius bound (1.5-20, unchanged for
  // Three.js/A-Frame) is reused as-is, centered on the flat piece's own
  // home pose (0, 0, 5) -- the same starting radius the reference
  // Three.js fixture's own camera.position.set(0, 0, 5) uses.
  var flatShellArtwork = null;
  var flatShellOriginalStyle = null;
  var flatShellPose = { x: 0, y: 0, z: 5 };
  function applyFlatShellPose(x, y, z) {
    if (!flatShellArtwork) return;
    var rotateY = x * 15;
    var rotateX = -y * 15;
    var zoom = 5 / z;
    flatShellArtwork.style.transform =
      'rotateY(' + rotateY + 'deg) rotateX(' + rotateX + 'deg) scale(' + zoom + ')';
  }
  function ensureFlatSpatialShell() {
    if (registeredCamera) return true;
    var artwork = document.querySelector('canvas') || document.querySelector('svg');
    if (!artwork) return false;
    flatShellArtwork = artwork;
    flatShellOriginalStyle = artwork.getAttribute('style');
    document.body.style.perspective = '800px';
    artwork.style.transformOrigin = 'center center';
    artwork.style.transition = 'none';
    flatShellPose = { x: 0, y: 0, z: 5 };
    applyFlatShellPose(0, 0, 5);
    window.__registerArtPieceCamera({
      getPose: function () { return flatShellPose; },
      setPose: function (x, y, z) {
        flatShellPose = { x: x, y: y, z: z };
        applyFlatShellPose(x, y, z);
      }
    });
    return true;
  }
  function disposeFlatSpatialShell() {
    if (flatShellArtwork) {
      if (flatShellOriginalStyle === null) flatShellArtwork.removeAttribute('style');
      else flatShellArtwork.setAttribute('style', flatShellOriginalStyle);
    }
    flatShellArtwork = null;
    registeredCamera = null;
    initialCameraPose = null;
  }
  // Issue #455: A-Frame generated markup can never call
  // window.__registerArtPieceCamera itself -- its own system prompt
  // forbids any custom JavaScript, unlike Three.js's. This trusted wrapper
  // code (never AI-generated) auto-detects the scene's active camera once
  // A-Frame finishes initializing it and registers it the same way a
  // Three.js snippet would register its own, so the shared steer-signal/
  // hand-tracking path above drives it identically either way.
  if (pieceLibrary === 'aframe') {
    document.addEventListener('DOMContentLoaded', function () {
      var sceneEl = document.querySelector('a-scene');
      if (!sceneEl) return;
      function registerAframeCamera() {
        // Issue #480: sceneEl.camera is A-Frame's raw underlying
        // THREE.Camera object -- its own .position is a *local* offset
        // within its own Object3D hierarchy (effectively always near
        // (0,0,0) in practice, or A-Frame's own default eye-height "0 1.6
        // 0" when the <a-camera> itself carries no position attribute).
        // The system prompt's own recommended authoring pattern wraps
        // <a-camera> in a positioned <a-entity> (e.g. <a-entity
        // position="0 1.6 4"><a-camera></a-camera></a-entity>) precisely
        // so that wrapping entity, not the camera element itself, carries
        // the actual placement -- confirmed live: for that pattern the
        // camera element's own object3D stays at A-Frame's default local
        // eye-height regardless of the wrapper's position. For a bare
        // <a-camera position="..."> directly under <a-scene> (no
        // wrapper), the camera element's own object3D is exactly what
        // carries that authored position instead. Move whichever entity
        // actually carries the placement, one level up if the camera
        // isn't a direct child of the scene.
        var camObj = sceneEl.camera;
        if (!camObj || !camObj.el || !camObj.el.object3D) return;
        var cameraEl = camObj.el;
        var wrappingEl = cameraEl.parentEl;
        var placedObject3D = (wrappingEl && wrappingEl.tagName !== 'A-SCENE')
          ? wrappingEl.object3D
          : cameraEl.object3D;
        window.__registerArtPieceCamera({
          getPose: function () {
            return { x: placedObject3D.position.x, y: placedObject3D.position.y, z: placedObject3D.position.z };
          },
          setPose: function (x, y, z) {
            placedObject3D.position.set(x, y, z);
            placedObject3D.lookAt(0, 0, 0);
          }
        });
      }
      if (sceneEl.hasLoaded) registerAframeCamera();
      else sceneEl.addEventListener('loaded', registerAframeCamera);
    });
  }
  window.addEventListener('pagehide', function () {
    stopMicrophone();
    stopCamera();
    stopHandTrackingLoop();
    if (audioCtx) { try { audioCtx.close(); } catch (e) {} }
  });
  // Keyboard notes: a real, audible tone per key, gated on Sound already
  // being on -- distinct from any application logic the generated
  // snippet may separately bind to its own keyboard handling.
  window.addEventListener('keydown', function (event) {
    if (!soundOn || !audioCtx) return;
    var frequency = NOTE_FREQUENCIES[(event.key || '').toLowerCase()];
    if (!frequency) return;
    var oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    oscillator.connect(masterGain);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
    reportState('note', { key: event.key, frequency: frequency });
  });
  window.addEventListener('error', function (event) {
    report('error', (event && event.message) || 'The generated piece threw an error.');
  });
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    report('error', (reason && reason.message) || String(reason) || 'An unhandled promise rejection occurred.');
  });
  window.addEventListener('load', function () {
    // Issue #457: two deferred ticks, one to let the snippet's own first
    // paint happen, one more so a same-tick synchronous throw from that
    // first paint has already been caught by the error listener above
    // before this reports success -- using setTimeout, not
    // requestAnimationFrame. Chromium throttles requestAnimationFrame
    // for a cross-origin iframe that isn't intersecting the viewport
    // (confirmed: the first callback fires but a nested second one never
    // does, even after 6+ seconds), which is exactly how this sandbox
    // renders on /art-pieces -- below the fold behind the
    // Library/prompt/Generate form. setTimeout has no such
    // visibility-based throttling and still defers past the current
    // synchronous execution twice, preserving the same ordering
    // guarantee without depending on this iframe ever actually painting.
    setTimeout(function () {
      setTimeout(function () {
        report('ready', '');
      }, 0);
    }, 0);
  });
  // Versioned, allowlisted commands are surfaced as DOM events. Generated
  // code may opt into them, but never receives arbitrary parent messages.
  window.addEventListener('message', function (event) {
    // Issue #432 hardening: the untrusted generated snippet runs in this
    // exact window and could otherwise call window.postMessage({source:
    // 'art-piece-parent', ...}, '*') on itself to spoof a trusted parent
    // command (e.g. silently self-activating the camera/microphone with
    // no real user gesture at all) -- the data-shape check alone never
    // verified who actually sent it. Only the real parent frame's window
    // reference can pass this identity check.
    if (event.source !== window.parent) return;
    var data = event && event.data;
    var allowed = ['screenshot', 'toggle-sound', 'set-volume', 'enable-microphone', 'disable-microphone', 'enable-camera', 'disable-camera', 'set-camera-opacity', 'enable-hand-steering', 'disable-hand-steering', 'steer-signal', 'navigate-signal', 'reset-view'];
    if (!data || data.source !== 'art-piece-parent' || data.version !== 1 || allowed.indexOf(data.type) < 0) return;
    try {
      if (data.type === 'screenshot') {
        var canvas = document.querySelector('canvas');
        var filename = typeof data.filename === 'string' ? data.filename : 'art-piece-screenshot.png';
        function reportScreenshot(data, name) {
          window.parent.postMessage({
            source: ${JSON.stringify(ART_PIECE_SANDBOX_MESSAGE_SOURCE)},
            status: 'screenshot', data: data, filename: name
          }, '*');
        }
        if (canvas && canvas.toBlob) {
          reportScreenshot(compositeScreenshot(canvas), filename);
        } else {
          var svg = document.querySelector('svg');
          if (!svg) throw new Error('The generated piece has no capturable artwork.');
          var svgText = new XMLSerializer().serializeToString(svg);
          var svgViewBox = svg.viewBox && svg.viewBox.baseVal;
          var svgWidth = (svgViewBox && svgViewBox.width) || (svg.width && svg.width.baseVal && svg.width.baseVal.value) || svg.getBoundingClientRect().width || 300;
          var svgHeight = (svgViewBox && svgViewBox.height) || (svg.height && svg.height.baseVal && svg.height.baseVal.value) || svg.getBoundingClientRect().height || 150;
          // Issue #433: rasterize to a real PNG instead of returning raw
          // SVG markup -- the parent's screenshot handler decodes every
          // library's payload with atob(), which cannot read the
          // percent-encoded SVG text this used to send.
          var svgImage = new Image();
          svgImage.onload = function () {
            try {
              var rasterCanvas = document.createElement('canvas');
              rasterCanvas.width = svgWidth;
              rasterCanvas.height = svgHeight;
              var rasterContext = rasterCanvas.getContext('2d');
              rasterContext.drawImage(svgImage, 0, 0, svgWidth, svgHeight);
              reportScreenshot(compositeScreenshot(rasterCanvas), filename);
            } catch (rasterError) {
              report('error', (rasterError && rasterError.message) || 'The generated piece could not be captured as an image.');
            }
          };
          svgImage.onerror = function () {
            report('error', 'The generated piece could not be captured as an image.');
          };
          svgImage.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
        }
      } else if (data.type === 'toggle-sound') {
        ensureAudio();
        soundOn = !soundOn;
        if (soundOn) { audioCtx.resume(); } else { audioCtx.suspend(); }
        reportState('sound', { enabled: soundOn, volume: masterGain.gain.value });
      } else if (data.type === 'set-volume') {
        ensureAudio();
        var requestedVolume = typeof data.value === 'number' ? data.value : NaN;
        var clampedVolume = isNaN(requestedVolume) ? masterGain.gain.value : Math.max(0, Math.min(1, requestedVolume));
        masterGain.gain.value = clampedVolume;
        reportState('sound', { enabled: soundOn, volume: clampedVolume });
      } else if (data.type === 'enable-microphone') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          reportState('microphone', { active: false, error: 'unavailable' });
        } else {
          navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function (stream) {
            micStream = stream;
            reportState('microphone', { active: true });
          }).catch(function () {
            reportState('microphone', { active: false, error: 'denied' });
          });
        }
      } else if (data.type === 'disable-microphone') {
        stopMicrophone();
        reportState('microphone', { active: false });
      } else if (data.type === 'enable-camera') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          reportState('camera', { active: false, error: 'unavailable' });
        } else {
          navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(function (stream) {
            cameraStream = stream;
            var overlay = getCameraOverlay();
            overlay.srcObject = stream;
            var track = stream.getVideoTracks()[0];
            if (track) {
              track.addEventListener('ended', function () {
                stopCamera();
                reportState('camera', { active: false, error: 'ended' });
              });
            }
            reportState('camera', { active: true, opacity: cameraOpacity });
          }).catch(function () {
            reportState('camera', { active: false, error: 'denied' });
          });
        }
      } else if (data.type === 'disable-camera') {
        stopCamera();
        reportState('camera', { active: false });
      } else if (data.type === 'set-camera-opacity') {
        var requestedOpacity = typeof data.value === 'number' ? data.value : NaN;
        cameraOpacity = isNaN(requestedOpacity) ? cameraOpacity : Math.max(0, Math.min(1, requestedOpacity));
        var existingOverlay = document.getElementById(CAMERA_OVERLAY_ID);
        if (existingOverlay) existingOverlay.style.opacity = String(cameraOpacity);
        reportState('camera', { active: !!cameraStream, opacity: cameraOpacity });
      } else if (data.type === 'enable-hand-steering') {
        if (!cameraStream) {
          reportState('steering', { active: false, error: 'camera-required' });
        } else if (pieceLibrary !== 'threejs' && pieceLibrary !== 'aframe') {
          if (!ensureFlatSpatialShell()) {
            reportState('steering', { active: false, error: 'no-camera-registered' });
          } else {
            steeringActive = true;
            flatShellArtwork.style.pointerEvents = 'none';
            reportState('steering', { active: true });
            ensureHandTracking();
          }
        } else if (!registeredCamera) {
          reportState('steering', { active: false, error: 'no-camera-registered' });
        } else {
          steeringActive = true;
          reportState('steering', { active: true });
          ensureHandTracking();
        }
      } else if (data.type === 'disable-hand-steering') {
        steeringActive = false;
        stopHandTrackingLoop();
        if (flatShellArtwork) flatShellArtwork.style.pointerEvents = 'auto';
        reportState('steering', { active: false });
      } else if (data.type === 'steer-signal') {
        // Issue #455: a real hand-tracking frame calls applySteerDelta
        // directly (see handleHandTrackingResult above) -- this command
        // remains for a still-valid external/synthetic signal source
        // (this suite's own deterministic e2e replay fixtures), sharing
        // the exact same bounded-pose path.
        applySteerDelta(data.dx, data.dy, data.dz);
      } else if (data.type === 'navigate-signal') {
        // Issue #434: walkable immersive navigation (arrow-key travel,
        // drag/touch look, zoom) shares the exact same bounded-pose
        // mechanism #432 built for hand-steering, applied to a
        // registered camera via the user's own keyboard/pointer input
        // instead of a hand-tracking gesture -- never gated on camera_
        // view/hand_steering, since it needs no device permission at
        // all. Same honest engine-support boundary as steering: a flat
        // Canvas2D/SVG piece has no registerable spatial camera.
        if (pieceLibrary !== 'threejs' && pieceLibrary !== 'aframe') {
          reportState('navigation', { active: false, error: 'unsupported-engine' });
        } else if (!registeredCamera) {
          reportState('navigation', { active: false, error: 'no-camera-registered' });
        } else {
          var navCurrentPose = registeredCamera.getPose();
          var navDx = typeof data.dx === 'number' ? data.dx : 0;
          var navDy = typeof data.dy === 'number' ? data.dy : 0;
          var navDz = typeof data.dz === 'number' ? data.dz : 0;
          var navNextPose = clampSteerPose({
            x: navCurrentPose.x + navDx,
            y: navCurrentPose.y + navDy,
            z: navCurrentPose.z + navDz
          });
          registeredCamera.setPose(navNextPose.x, navNextPose.y, navNextPose.z);
          reportState('navigation', { active: true, pose: navNextPose });
        }
      } else if (data.type === 'reset-view') {
        if (registeredCamera && initialCameraPose) {
          registeredCamera.reset
            ? registeredCamera.reset()
            : registeredCamera.setPose(initialCameraPose.x, initialCameraPose.y, initialCameraPose.z);
          reportState('steering', { active: steeringActive, pose: initialCameraPose });
        }
        // Issue #449: "Reset while steering on preserves activation" (the
        // shell and its synthetic camera stay registered, just re-homed
        // above); "Reset after steering off returns to exact framed
        // presentation and disposes the shell" -- only tear the shell
        // down once steering is confirmed off, never mid-activation.
        if (!steeringActive && flatShellArtwork) {
          disposeFlatSpatialShell();
        }
        // Always also dispatched for pieces that handle their own reset
        // via the DOM event instead of the camera-registration API.
        window.dispatchEvent(new CustomEvent('art-piece-command', { detail: { type: data.type, version: 1 } }));
      } else {
        window.dispatchEvent(new CustomEvent('art-piece-command', { detail: { type: data.type, version: 1 } }));
      }
    } catch (e) { report('error', (e && e.message) || 'The requested piece action failed.'); }
  });
})();
</script>
`;
}

/** Builds the full sandboxed document for `srcdoc`. `snippet` is the raw,
 * unmodified string `POST /api/ai/art-pieces/generate/` returned -- this
 * function does not parse or validate its shape: the sandbox (CSP +
 * `allow-scripts`-only iframe) is what makes any content here safe to
 * render, not a check on what the content contains.
 *
 * `library` selects how `snippet` is placed into the document:
 * - `canvas2d`/`svg`: the snippet is already complete, self-contained
 *   markup (a `<canvas>`+`<script>` pair, or an `<svg>` tree) -- placed
 *   directly in `<body>` unchanged, exactly as before this parameter
 *   existed.
 * - `threejs`: the snippet is plain JavaScript (no markup) that expects
 *   a `THREE` global and a sized container element -- this function
 *   provides both: the pinned CDN `<script>` (loading before the
 *   listener/snippet scripts, so `THREE` exists when they run) and a
 *   `<div id="art-piece-container">` sized to fill the iframe, then
 *   wraps `snippet` in the `<script>` tag the backend's system prompt
 *   told the model not to write itself.
 * - `aframe`: the snippet is complete `<a-scene>` markup -- placed
 *   directly in `<body>`, after the pinned CDN `<script>` that defines
 *   the `<a-scene>`/`<a-box>`/etc. custom elements it uses. */
export function buildArtPieceSandboxDocument(
  snippet: string,
  library: ArtPieceLibrary = 'canvas2d',
): string {
  const cdnUrl = LIBRARY_CDN[library];
  const cdnScriptTag = cdnUrl ? `<script src="${cdnUrl}"></script>` : '';
  const body =
    library === 'threejs'
      ? `<div id="art-piece-container" style="position:absolute;inset:0;"></div>\n<script>${snippet}</script>`
      : snippet;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${buildCsp(library)}">
<style>
  html, body { margin: 0; padding: 0; background: #ffffff; height: 100%; }
  canvas { display: block; max-width: 100%; }
  a-scene { position: absolute; inset: 0; }
</style>
${cdnScriptTag}
${buildListenerScript(library)}
</head>
<body>
${body}
</body>
</html>`;
}

/** Parses a `message` event's `data` into a typed
 * `ArtPieceSandboxMessage`, or `null` if it doesn't match the shape this
 * module's own `LISTENER_SCRIPT` produces. Callers must independently
 * verify `event.source === iframe.contentWindow` before calling this --
 * see this module's own doc comment for why `event.origin` can't do that
 * job for an opaque-origin sandboxed iframe. */
export function parseArtPieceSandboxMessage(data: unknown): ArtPieceSandboxMessage | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record.source !== ART_PIECE_SANDBOX_MESSAGE_SOURCE) return null;
  if (record.status === 'ready')
    return { source: ART_PIECE_SANDBOX_MESSAGE_SOURCE, status: 'ready' };
  if (record.status === 'error') {
    return {
      source: ART_PIECE_SANDBOX_MESSAGE_SOURCE,
      status: 'error',
      message: typeof record.message === 'string' ? record.message : 'Unknown error.',
    };
  }
  return null;
}
