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

/** Issue #430: the `<iframe>`'s own `allow` (Permissions Policy)
 * attribute -- distinct from the CSP `<meta>` tag this module injects
 * into the document. `getUserMedia` for the microphone capability is
 * gated by Permissions Policy, not CSP; without this, a sandboxed
 * iframe's own `navigator.mediaDevices.getUserMedia` call rejects with a
 * permissions-policy violation before it can even prompt.
 *
 * No longer includes `camera` or `microphone`: issue #479 found that
 * `getUserMedia` unconditionally throws `SecurityError: Invalid security
 * origin` in any document with an opaque origin (which this sandboxed
 * iframe always has) regardless of Permissions Policy or audio/video kind
 * -- a stricter, separate restriction Permissions Policy cannot override.
 * Real camera capture, hand-tracking, and microphone capture now happen
 * entirely in the trusted parent frame (`PieceStageControls.tsx`), which
 * has a real origin and needs no iframe `allow` delegation at all. */
export const ART_PIECE_IFRAME_ALLOW = '';

/** Issue #199 (Three.js/A-Frame extension): these libraries need
 * their own runtime loaded via a pinned CDN `<script>` this module
 * injects -- never a URL the AI supplies (`art_piece_provider.py`'s
 * system prompts for these two libraries explicitly forbid the model
 * from writing its own `<script src>`). Versions match
 * `ai_provider/art_piece_provider.py`'s `THREEJS_VERSION`/
 * `AFRAME_VERSION` constants -- keep the two in sync by hand, mirroring
 * how `generateHtmlExport.ts`'s `P5_VERSION` is the one place this app
 * already pins a CDN library version. C2 is intentionally excluded from
 * this map: its reference Renderer is not reliable in an opaque srcdoc,
 * so the C2 branch supplies the reference-compatible Canvas2D contract
 * locally. */
const LIBRARY_CDN: Partial<Record<ArtPieceLibrary, string>> = {
  p5js: 'https://cdn.jsdelivr.net/npm/p5@1.9.0/lib/p5.min.js',
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

/** Installs before generated Three.js/A-Frame code runs so the first rendered
 * WebGL frame remains readable by the sandbox screenshot command. This is a
 * browser-only runtime adaptation; generated source still cannot escape the
 * opaque iframe and Django never executes it. */
function webglCapturePrelude(library: ArtPieceLibrary): string {
  if (library !== 'threejs' && library !== 'aframe') return '';
  return `<script>(function () {
  var three = window.THREE;
  var OriginalRenderer = three && three.WebGLRenderer;
  if (!OriginalRenderer || OriginalRenderer.__artPieceCaptureReady) return;
  function CapturableRenderer(parameters) {
    var options = Object.assign({}, parameters || {}, { preserveDrawingBuffer: true });
    return new OriginalRenderer(options);
  }
  CapturableRenderer.prototype = OriginalRenderer.prototype;
  CapturableRenderer.__artPieceCaptureReady = true;
  window.THREE.WebGLRenderer = CapturableRenderer;
}());</script>`;
}

/** Issue #704: the regular generated-piece iframe is mounted inside the
 * responsive stage owned by the parent route. Keep the generated runtime's
 * drawing buffer and CSS box aligned with that stage, regardless of the
 * dimensions a generated snippet initially requests. The camera wrapper is
 * deliberately limited to PerspectiveCamera because that is the camera
 * contract used by generated Three.js pieces; A-Frame's renderer and camera
 * are covered by the same renderer/camera registration once its scene boots.
 * Immersive presentation owns a separate navigation/layout contract and must
 * not be changed here. */
function webglResponsivePrelude(
  library: ArtPieceLibrary,
  presentation: 'regular' | 'immersive',
): string {
  if (presentation !== 'regular' || (library !== 'threejs' && library !== 'aframe')) return '';
  return `<script>(function () {
  var renderers = [];
  var cameras = [];
  var resizeObserver = null;

  function stageFor(element) {
    return element && element.closest('#art-piece-container, a-scene');
  }

  function sizeRenderer(renderer) {
    var canvas = renderer && renderer.domElement;
    var stage = stageFor(canvas) || document.body;
    var rect = stage.getBoundingClientRect();
    var width = Math.max(1, Math.round(rect.width || stage.clientWidth || document.documentElement.clientWidth));
    var height = Math.max(1, Math.round(rect.height || stage.clientHeight || document.documentElement.clientHeight));
    var ratio = Math.max(1, window.devicePixelRatio || 1);
    var responsiveSetSize = renderer.setSize;
    renderer.setSize = renderer.__artPieceOriginalSetSize;
    renderer.__artPieceOriginalSetPixelRatio(ratio);
    renderer.setSize = responsiveSetSize;
    renderer.__artPieceOriginalSetSize(width, height, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    for (var i = 0; i < cameras.length; i += 1) {
      var camera = cameras[i];
      if (camera && typeof camera.aspect === 'number') {
        camera.aspect = width / height;
        if (typeof camera.updateProjectionMatrix === 'function') camera.updateProjectionMatrix();
      }
    }
  }

  function resizeAll() {
    for (var i = 0; i < renderers.length; i += 1) sizeRenderer(renderers[i]);
  }

  function registerRenderer(renderer) {
    if (!renderer || renderer.__artPieceResponsive) return renderer;
    renderer.__artPieceResponsive = true;
    renderer.__artPieceOriginalSetSize = renderer.setSize.bind(renderer);
    renderer.__artPieceOriginalSetPixelRatio = renderer.setPixelRatio.bind(renderer);
    renderer.setSize = function () {
      renderer.__artPieceOriginalSetSize.apply(renderer, arguments);
      sizeRenderer(renderer);
      return renderer;
    };
    renderers.push(renderer);
    setTimeout(resizeAll, 0);
    return renderer;
  }

  var three = window.THREE;
  if (!three || !three.WebGLRenderer) return;
  var OriginalRenderer = three.WebGLRenderer;
  function ResponsiveRenderer(parameters) {
    return registerRenderer(new OriginalRenderer(parameters));
  }
  ResponsiveRenderer.prototype = OriginalRenderer.prototype;
  three.WebGLRenderer = ResponsiveRenderer;

  if (three.PerspectiveCamera) {
    var OriginalPerspectiveCamera = three.PerspectiveCamera;
    function ResponsivePerspectiveCamera() {
      var camera = Reflect.construct(OriginalPerspectiveCamera, Array.prototype.slice.call(arguments), ResponsivePerspectiveCamera);
      cameras.push(camera);
      setTimeout(resizeAll, 0);
      return camera;
    }
    ResponsivePerspectiveCamera.prototype = OriginalPerspectiveCamera.prototype;
    three.PerspectiveCamera = ResponsivePerspectiveCamera;
  }

  window.addEventListener('resize', resizeAll);
  if (typeof window.ResizeObserver === 'function') {
    resizeObserver = new window.ResizeObserver(resizeAll);
    function observeBody() {
      if (document.body) resizeObserver.observe(document.body);
      else setTimeout(observeBody, 0);
    }
    observeBody();
  }
  window.addEventListener('load', resizeAll);
}());</script>`;
}

/** Issue #705: keep regular flat-engine artwork contained by the responsive
 * parent stage while leaving each engine's logical drawing coordinates alone.
 * The event wrapper maps pointer coordinates back through the object-fit
 * letterbox, so an interactive C2 sketch continues to receive its authored
 * 1280x720 (C2, the reference `sizeCanvas` standard, #759/#763), authored canvas
 * size, or SVG viewBox coordinates after the stage is scaled. */
function flatResponsivePrelude(
  library: ArtPieceLibrary,
  presentation: 'regular' | 'immersive',
): string {
  if (
    presentation !== 'regular' ||
    !['canvas2d', 'svg', 'p5js', 'c2js', 'c2js-interactive'].includes(library)
  ) {
    return '';
  }
  return `<script>(function () {
  var patched = false;
  var originalAddEventListener = EventTarget.prototype.addEventListener;
  var originalRemoveEventListener = EventTarget.prototype.removeEventListener;
  var listenerWrappers = new WeakMap();

  function surfaceDimensions(surface) {
    if (surface instanceof SVGElement) {
      var viewBox = surface.viewBox && surface.viewBox.baseVal;
      if (viewBox && viewBox.width && viewBox.height) return { width: viewBox.width, height: viewBox.height };
    }
    return {
      width: Number(surface.getAttribute('width')) || surface.width || 300,
      height: Number(surface.getAttribute('height')) || surface.height || 150
    };
  }

  function surfaceFor(target) {
    return target instanceof HTMLCanvasElement || target instanceof SVGElement ? target : null;
  }

  function logicalPointer(surface, event) {
    var dimensions = surfaceDimensions(surface);
    var rect = surface.getBoundingClientRect();
    var scale = Math.min(rect.width / dimensions.width, rect.height / dimensions.height) || 1;
    var contentWidth = dimensions.width * scale;
    var contentHeight = dimensions.height * scale;
    var contentLeft = rect.left + (rect.width - contentWidth) / 2;
    var contentTop = rect.top + (rect.height - contentHeight) / 2;
    return {
      x: Math.max(0, Math.min(dimensions.width, ((event.clientX - contentLeft) / scale))),
      y: Math.max(0, Math.min(dimensions.height, ((event.clientY - contentTop) / scale)))
    };
  }

  function wrapListener(surface, listener) {
    if (typeof listener !== 'function') return listener;
    var wrapped = function (event) {
      var pointer = logicalPointer(surface, event);
      var proxy = new Proxy(event, { get: function (target, property) {
        if (property === 'offsetX') return pointer.x;
        if (property === 'offsetY') return pointer.y;
        return Reflect.get(target, property, target);
      }});
      return listener.call(this, proxy);
    };
    var wrappers = listenerWrappers.get(surface) || new Map();
    wrappers.set(listener, wrapped);
    listenerWrappers.set(surface, wrappers);
    return wrapped;
  }

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    var surface = surfaceFor(this);
    var pointerEvent = type === 'pointerdown' || type === 'pointermove' || type === 'pointerup' || type === 'pointercancel' || type === 'mousedown' || type === 'mousemove' || type === 'mouseup';
    if (surface && pointerEvent) listener = wrapListener(surface, listener);
    return originalAddEventListener.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    var surface = surfaceFor(this);
    var wrapped = surface && listenerWrappers.get(surface) && listenerWrappers.get(surface).get(listener);
    return originalRemoveEventListener.call(this, type, wrapped || listener, options);
  };

  function fit() {
    var surfaces = document.querySelectorAll('canvas, svg');
    document.documentElement.style.width = '100%';
    document.documentElement.style.height = '100%';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.position = 'relative';
    var mount = document.getElementById('art-piece-container');
    if (mount) { mount.style.position = 'absolute'; mount.style.inset = '0'; }
    for (var i = 0; i < surfaces.length; i += 1) {
      var surface = surfaces[i];
      surface.style.position = 'absolute';
      surface.style.inset = '0';
      surface.style.width = '100%';
      surface.style.height = '100%';
      surface.style.maxWidth = 'none';
      surface.style.objectFit = 'contain';
      surface.style.display = 'block';
    }
  }

  function observe() {
    fit();
    if (typeof ResizeObserver === 'function') new ResizeObserver(fit).observe(document.body);
  }
  window.addEventListener('resize', fit);
  if (document.body) observe();
  else document.addEventListener('DOMContentLoaded', observe);
}());</script>`;
}

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
  const scriptSrc = cdnUrl
    ? `script-src 'unsafe-inline'${unsafeEval} ${ALLOWED_CDN_ORIGIN};`
    : "script-src 'unsafe-inline';";
  // Issue #433: SVG screenshot capture rasterizes the serialized SVG
  // markup through an in-sandbox `Image`/`data:` URL (see the
  // `screenshot` command handler below) so every library downloads a
  // real PNG, not raw SVG text the parent's `atob`-based decoder can't
  // read. `img-src data:` is scoped to that one same-sandbox rasterization
  // step -- it does not let generated code fetch a remote image, since
  // `data:` is not a network origin.
  // Issue #479: real hand-tracking (MediaPipe) now runs entirely in the
  // trusted parent frame, never inside this sandbox -- the CDN/WASM
  // allowances #455 added here are gone, since nothing in the sandbox
  // ever loads MediaPipe anymore.
  return `default-src 'none'; ${scriptSrc} style-src 'unsafe-inline'; img-src data:;`;
}

/** The reference runtime contract supplies p5 and C2 sketches with an
 * explicit mount/runtime object. Keep that adaptation in the trusted wrapper
 * rather than requiring generated source to load scripts or choose a CDN. */
function buildFlatEngineBody(snippet: string, library: ArtPieceLibrary): string {
  if (library === 'p5js') {
    return `<div id="art-piece-container" style="position:absolute;inset:0;"></div>
<script>${snippet}
(function () {
  var mount = document.getElementById('art-piece-container');
  if (typeof window.sketch !== 'function' || typeof window.p5 !== 'function') throw new Error('p5.js sketch runtime was not initialized.');
  window.__artPieceInstance = new window.p5(window.sketch, mount);
}());</script>`;
  }
  if (library === 'c2js' || library === 'c2js-interactive') {
    return `<canvas id="c2-canvas" width="1280" height="720"></canvas>
<script>${snippet}
(function () {
  var canvas = document.getElementById('c2-canvas');
  var c2Fallback = {
    Renderer: function (target) {
      this.context = target.getContext('2d');
      this.clear = function (color) { this.context.fillStyle = color || '#ffffff'; this.context.fillRect(0, 0, target.width, target.height); };
      this.fill = function (color) { this.context.fillStyle = color; };
      this.circle = function (x, y, radius) { this.context.beginPath(); this.context.arc(x, y, radius, 0, Math.PI * 2); this.context.fill(); };
    }
  };
  // The upstream c2.js Renderer is not usable from this opaque srcdoc
  // sandbox in Chromium, even when its global is present. Keep the public
  // reference contract but use the deterministic Canvas2D implementation
  // here so regular and immersive views render consistently.
  var c2Runtime = c2Fallback;
  function boot() {
    if (typeof window.sketch !== 'function') throw new Error('C2.js sketch runtime was not initialized.');
    var frame = 0;
    var callback = null;
    function startFrame(handler) {
      if (typeof handler !== 'function') throw new Error('C2.js startFrame requires a function.');
      callback = handler;
      // Paint one deterministic frame synchronously. This keeps the regular
      // viewer visibly initialized even when a browser throttles animation
      // callbacks for a sandboxed/off-screen iframe; the RAF loop continues
      // for animated and interactive pieces.
      callback(frame++);
      function tick() {
        if (callback) callback(frame++);
        window.requestAnimationFrame(tick);
      }
      window.requestAnimationFrame(tick);
    }
    window.__artPieceInstance = window.sketch({ c2: c2Runtime, canvas: canvas, startFrame: startFrame });
  }
  try { boot(); } catch (error) {
    document.body.setAttribute('data-c2-error', String(error && error.message || error));
    throw error;
  }
}());</script>`;
  }
  return '';
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
    if (status === 'ready' && runtimeFailed) return;
    if (status === 'error') runtimeFailed = true;
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
  var runtimeFailed = false;
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
  // Issue #479: real camera capture and hand-tracking now live entirely
  // in the trusted parent frame (PieceStageControls.tsx) -- this sandbox
  // never calls getUserMedia({video: true}) itself (that unconditionally
  // threw SecurityError: Invalid security origin from inside this
  // opaque-origin iframe, confirmed live, regardless of Permissions
  // Policy). The parent tells this sandbox whether its own camera is
  // active via a set-camera-active command, purely so the
  // enable-hand-steering gate below still requires a camera the same way
  // it always has -- ownership of the actual video stream, overlay
  // rendering, and screenshot compositing all moved to the parent, which
  // renders its own video element positioned over this iframe via CSS.
  var cameraActive = false;
  // Issue #432: hand-steering ownership and Reset, driven by a
  // documented steer-signal command any real or synthetic signal source
  // can call through the same path -- issue #479's real MediaPipe-driven
  // parent frame is one such source, exactly like any other. A piece
  // opts in by calling window.__registerArtPieceCamera({ getPose,
  // setPose, reset }) itself; this runtime never reaches into an
  // arbitrary Three.js/A-Frame scene uninvited.
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
  // Issue #479: real hand-landmark detection driving applySteerDelta above
  // with actual gesture-derived deltas now runs in the trusted parent
  // frame (against MediaPipe's GestureRecognizer, matching
  // Scene3DPreview.tsx's own established pattern), which posts a
  // steer-signal into this sandbox exactly like any other signal source
  // -- this sandbox has no MediaPipe-loading code of its own.
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
      function renderAframeFirstFrame() {
        // A-Frame's render loop can be deferred in an opaque, sandboxed
        // preview until an external frame or resize occurs. Paint one
        // deterministic frame as soon as the scene is ready so generated
        // edits are visible immediately and thumbnail/screenshot capture
        // never observes a blank canvas.
        if (sceneEl.renderer && sceneEl.camera) {
          sceneEl.renderer.render(sceneEl.object3D, sceneEl.camera);
        }
      }
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
      function initializeAframeScene() {
        registerAframeCamera();
        renderAframeFirstFrame();
      }
      if (sceneEl.hasLoaded) initializeAframeScene();
      else sceneEl.addEventListener('loaded', initializeAframeScene);
    });
  }
  window.addEventListener('pagehide', function () {
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
    var allowed = ['screenshot', 'toggle-sound', 'set-volume', 'set-camera-active', 'enable-hand-steering', 'disable-hand-steering', 'steer-signal', 'navigate-signal', 'reset-view'];
    if (!data || data.source !== 'art-piece-parent' || data.version !== 1 || allowed.indexOf(data.type) < 0) return;
    try {
      if (data.type === 'screenshot') {
        // Issue #479: this now returns the artwork alone, uncomposited --
        // the parent frame composites its own live camera frame on top
        // (when active) before presenting/downloading the final image,
        // since this sandbox no longer has any camera feed of its own.
        var canvas = document.querySelector('canvas');
        var filename = typeof data.filename === 'string' ? data.filename : 'art-piece-screenshot.png';
        function reportScreenshot(data, name) {
          window.parent.postMessage({
            source: ${JSON.stringify(ART_PIECE_SANDBOX_MESSAGE_SOURCE)},
            status: 'screenshot', data: data, filename: name
          }, '*');
        }
        if (canvas && canvas.toBlob) {
          reportScreenshot(canvas.toDataURL('image/png'), filename);
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
              reportScreenshot(rasterCanvas.toDataURL('image/png'), filename);
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
      } else if (data.type === 'set-camera-active') {
        // Issue #479: the parent frame owns the real camera stream now
        // (getUserMedia unconditionally throws SecurityError from inside
        // this opaque-origin sandbox) -- it tells this sandbox whether
        // its own camera is active purely so the "camera-required" gate
        // below still works the same way it always has. Losing the
        // camera mid-steering (parent reports inactive) must stop
        // steering too, exactly like the old in-sandbox camera loss did.
        cameraActive = !!data.active;
        if (!cameraActive && steeringActive) {
          steeringActive = false;
          reportState('steering', { active: false, error: 'camera-required' });
        }
      } else if (data.type === 'enable-hand-steering') {
        if (!cameraActive) {
          reportState('steering', { active: false, error: 'camera-required' });
        } else if (pieceLibrary !== 'threejs' && pieceLibrary !== 'aframe') {
          if (!ensureFlatSpatialShell()) {
            reportState('steering', { active: false, error: 'no-camera-registered' });
          } else {
            steeringActive = true;
            flatShellArtwork.style.pointerEvents = 'none';
            reportState('steering', { active: true });
          }
        } else if (!registeredCamera) {
          reportState('steering', { active: false, error: 'no-camera-registered' });
        } else {
          steeringActive = true;
          reportState('steering', { active: true });
        }
      } else if (data.type === 'disable-hand-steering') {
        steeringActive = false;
        if (flatShellArtwork) flatShellArtwork.style.pointerEvents = 'auto';
        reportState('steering', { active: false });
      } else if (data.type === 'steer-signal') {
        // Issue #479: the parent frame's own real MediaPipe hand-tracking
        // loop sends this exactly like any other signal source (its
        // predecessor #455 briefly ran this loop inside the sandbox
        // itself before that architecture moved out) -- also still used
        // directly by this suite's own deterministic e2e fixtures.
        applySteerDelta(data.dx, data.dy, data.dz);
      } else if (data.type === 'navigate-signal') {
        // Issue #434: walkable immersive navigation (arrow-key travel,
        // drag/touch look, zoom) shares the exact same bounded-pose
        // mechanism #432 built for hand-steering, applied to a
        // registered camera via the user's own keyboard/pointer input
        // instead of a hand-tracking gesture. Flat engines lazily register
        // the synthetic room shell on first navigation.
        if (pieceLibrary !== 'threejs' && pieceLibrary !== 'aframe') {
          ensureFlatSpatialShell();
        }
        if (!registeredCamera) {
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
  presentation: 'regular' | 'immersive' = 'regular',
  options: { background?: string } = {},
): string {
  const cdnUrl = LIBRARY_CDN[library];
  const cdnScriptTag = cdnUrl ? `<script src="${cdnUrl}"></script>` : '';
  const body =
    library === 'threejs'
      ? `<div id="art-piece-container" style="position:absolute;inset:0;"></div>\n<script>${snippet}</script>`
      : library === 'p5js' || library === 'c2js' || library === 'c2js-interactive'
        ? buildFlatEngineBody(snippet, library)
        : snippet;
  const background = options.background ?? (presentation === 'immersive' ? '#111827' : '#ffffff');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${buildCsp(library)}">
<style>
  html, body { margin: 0; padding: 0; background: ${background}; height: 100%; }
  canvas { display: block; max-width: 100%; }
  ${presentation === 'immersive' ? `body { display: grid; place-items: center; overflow: hidden; background: ${background}; } canvas, svg { width: 100% !important; height: 100% !important; object-fit: contain; }` : ''}
  a-scene { position: absolute; inset: 0; }
</style>
${cdnScriptTag}
${webglCapturePrelude(library)}
${webglResponsivePrelude(library, presentation)}
${flatResponsivePrelude(library, presentation)}
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
