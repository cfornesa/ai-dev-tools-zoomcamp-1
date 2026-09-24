/**
 * Issue #200 (epic #196): bundles a generated art piece
 * (`../api/artPieces.ts`'s `GenerateArtPieceResponse`) into a downloadable,
 * portable multi-file ZIP -- `index.html` + `styles/piece.css` (+
 * `scripts/piece.js` for script-based libraries) + `runtime/` (vendored
 * CDN runtime for Three.js/A-Frame, so the exported piece never depends on
 * a live network connection to jsdelivr once downloaded).
 *
 * ## Why this exists alongside the single-file preview/download already in
 * `ArtPieceStudio.tsx`
 *
 * `ArtPieceStudio.tsx`'s existing Download button saves
 * `buildArtPieceSandboxDocument`'s output verbatim -- a single HTML file
 * that still references the CDN for Three.js/A-Frame pieces, and still
 * carries the postMessage ready/error listener that only matters for the
 * *live preview*, not a piece someone downloads to keep or re-host. This
 * module produces the "real" portable export: no postMessage machinery
 * (nothing to report status to once downloaded), no live-preview-only
 * concerns, and the CDN runtime fetched once and vendored into the ZIP so
 * a Three.js/A-Frame piece still works completely offline after
 * downloading, matching the reference bundle structure design decision
 * from this epic's original distillation (issue #200's "index.html +
 * scripts/ + styles/ + runtime/" shape).
 *
 * ## What's NOT split into a separate file, and why
 *
 * Canvas2D's AI output is a single `<canvas>+<script>` markup block (not
 * pure JS); SVG and A-Frame outputs are pure declarative markup. None of
 * these separate cleanly into a "script" file without parsing HTML this
 * module has no reason to trust the shape of beyond what
 * `art_piece_provider.py`'s validator already guarantees loosely. Only
 * Three.js's output is pure JavaScript with no markup at all, so only
 * Three.js gets a real `scripts/piece.js` split -- the others keep their
 * natural content inline in `index.html`'s body, exactly as the preview
 * already renders them, still fully portable and functional.
 *
 * ## No local-server helper script
 *
 * Unlike the reference bundle this epic's distillation looked at (which
 * needed one for ES-module/camera-dependent features), nothing this
 * feature generates needs an ES module or camera access -- Canvas2D/SVG/
 * Three.js/A-Frame all run from a plain `file://` double-click. This is
 * exactly the "out of scope" boundary issue #200's grooming already
 * recorded.
 */
import JSZip from 'jszip';

import type { ArtPieceCapabilitySet, ArtPieceLibrary, CameraPlacement } from '../api/artPieces';
import { buildStandaloneArtPieceRuntimeScript } from '../export/standaloneArtPieceRuntimeSource';
import {
  EXPORT_STAGE_TOOLBAR_CSS,
  renderExportStageToolbar,
  type ExportToolbarButtonId,
} from '../export/exportStageToolbar';

export type ArtPieceExportMode = 'full' | 'non-camera';

/** Issue #448: `'regular'` (the default) is the small, fixed-height
 * stage `PublicArtPieceViewer.tsx` downloads from; `'immersive'` is
 * `ImmersiveArtPieceViewer.tsx`'s own walkable full-viewport
 * presentation -- a full-height container plus arrow-key/drag/wheel
 * navigation, in addition to (not instead of) the shared Screenshot/
 * Sound/Camera/Steer/Fullscreen contract every export already has. */
export type ArtPieceExportPresentation = 'regular' | 'immersive';

const SPATIAL_ART_PIECE_LIBRARIES: ArtPieceLibrary[] = [
  'canvas2d',
  'svg',
  'p5js',
  'c2js',
  'c2js-interactive',
  'threejs',
  'aframe',
];

export type ArtPieceExportOptions = {
  capabilities?: ArtPieceCapabilitySet;
  mode?: ArtPieceExportMode;
  presentation?: ArtPieceExportPresentation;
  cameraPlacement?: CameraPlacement | null;
};

export class ArtPieceBundleError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ArtPieceBundleError';
  }
}

/** Issue #436/#448: unlike the live-preview sandbox iframe (where a
 * Three.js/A-Frame scene's absolute-positioned container legitimately
 * fills the *entire* isolated document, since the stage toolbar lives in
 * a completely separate parent document), this exported bundle renders
 * the scene and its controls nav in one shared document. A full-page
 * position: absolute; inset: 0 container painted above the nav (an
 * absolutely-positioned element stacks above normal-flow siblings
 * regardless of DOM order), intercepting every click aimed at it.
 * Constraining the stage to a fixed-height box lets the controls render
 * normally below it instead -- `'immersive'` presentation (#448) gets a
 * taller box (matching `ImmersiveArtPieceViewer.tsx`'s own `height: 640`
 * stage) than the regular small-preview export, but the same fixed-box
 * containment approach either way. */
function buildPieceCss(
  presentation: ArtPieceExportPresentation,
  cameraPlacement: CameraPlacement,
): string {
  const immersive = presentation === 'immersive';
  const stageHeight = immersive ? '100dvh' : '480px';
  const cameraBackground = cameraPlacement === 'background';
  return `html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: ${cameraBackground ? 'transparent' : immersive ? '#111827' : '#ffffff'};
  color: ${immersive ? '#f4f6fb' : '#111827'};
}
canvas {
  display: block;
  max-width: 100%;
}
#c2-canvas {
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
}
#art-piece-container, a-scene {
  display: block;
  position: relative;
  width: 100%;
  height: ${stageHeight};
}
${cameraBackground ? '#art-piece-container, a-scene, canvas, svg:not(.piece-stage-icon) { position: relative; z-index: 1; }' : ''}
${EXPORT_STAGE_TOOLBAR_CSS}
#art-piece-controls-panel, #art-piece-guide-dialog { font: 14px/1.4 system-ui, sans-serif; }
#art-piece-controls-panel {
  position: fixed;
  top: 4.5rem;
  left: .75rem;
  z-index: 10;
  display: grid;
  gap: .5rem;
  width: min(22rem, calc(100vw - 1.5rem));
  box-sizing: border-box;
  padding: .75rem;
  color: #fff;
  background: rgba(10,12,20,.97);
  border: 1px solid rgba(255,255,255,.5);
  border-radius: .75rem;
}
#art-piece-controls-panel[hidden] { display: none; }
#art-piece-controls-panel button, #art-piece-guide-dialog button {
  min-height: 2.75rem;
  padding: .4rem .75rem;
  border: 1px solid rgba(255,255,255,.7);
  border-radius: .75rem;
  background: rgba(10,12,20,.94);
  color: #fff;
  cursor: pointer;
}
#art-piece-controls-panel p { margin: 0; font-size: .85rem; }
#art-piece-guide-dialog {
  position: fixed;
  top: 10%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  width: min(28rem, calc(100vw - 2rem));
  box-sizing: border-box;
  padding: 1rem;
  color: #fff;
  background: rgba(10,12,20,.97);
  border: 1px solid rgba(255,255,255,.5);
  border-radius: .75rem;
}
#art-piece-guide-dialog[hidden] { display: none; }
#art-piece-runtime-error { position: fixed; left: 1rem; right: 1rem; bottom: 1rem; z-index: 30; margin: 0; padding: .8rem; color: #fee2e2; background: #450a0a; border: 1px solid #fca5a5; }
#art-piece-runtime-error[hidden] { display: none; }
#art-piece-navigation-pose { position: fixed; right: .75rem; top: .75rem; z-index: 10; margin: 0; color: #fff; font: .75rem/1.2 system-ui, sans-serif; }
.art-piece-sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
a-scene canvas.a-canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
${
  immersive
    ? `
canvas, svg:not(.piece-stage-icon) {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain;
}`
    : ''
}
`;
}

/** Mirrors `artPieceSandbox.ts`'s `LIBRARY_CDN`/pinned versions -- kept as
 * its own copy (not a shared import) since this module's needs differ
 * (fetch-and-vendor at export time, vs. reference-by-URL at preview
 * time), the same way `art_piece_provider.py`'s backend constants and
 * `artPieceSandbox.ts`'s frontend constants are already two hand-synced
 * copies rather than one shared source. */
const LIBRARY_CDN: Partial<Record<ArtPieceLibrary, { url: string; filename: string }>> = {
  p5js: {
    url: 'https://cdn.jsdelivr.net/npm/p5@1.9.0/lib/p5.min.js',
    filename: 'p5.min.js',
  },
  threejs: {
    url: 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js',
    filename: 'three.min.js',
  },
  aframe: {
    // Pinned to 1.4.2, not 1.5.0: jsdelivr's aframe@1.5.0 package has no
    // `dist/aframe.min.js` (404 in production, #236) -- see
    // `ai_provider/art_piece_provider.py`'s `AFRAME_VERSION` comment.
    url: 'https://cdn.jsdelivr.net/npm/aframe@1.4.2/dist/aframe.min.js',
    filename: 'aframe.min.js',
  },
};

/**
 * Issue #437: this used to also blanket-replace the bare word "camera"
 * (and "webcam"/"mediapipe"/"hand-tracking") anywhere in the generated
 * source with the literal text "non-camera" -- which corrupts perfectly
 * ordinary Three.js code that (like the reference fixture itself) simply
 * names its own perspective-camera variable `camera`: `var camera = new
 * THREE.PerspectiveCamera()` became `var non-camera = ...`, a
 * `SyntaxError` at parse time (`non-camera` isn't a legal identifier).
 * Regex text replacement can never reliably distinguish "the identifier
 * `camera`" from "a device-access call" in arbitrary generated
 * JavaScript, and it does nothing at all against aliased or computed
 * access (`navigator['mediaDevices']['getUserMedia']`, or capturing the
 * function into a local variable first) -- see `buildDeviceIsolationScript`
 * below for the actual enforcement mechanism, which patches the real
 * `getUserMedia` function object itself before any generated code runs,
 * so no textual disguise can route around it.
 *
 * What's left here is markup-only and narrowly tag-anchored -- dropping
 * an externally-referenced `<script src="...mediapipe...">`/`<script
 * src="...camera...">` tag (should a future generator ever emit one, see
 * #455's planned full MediaPipe integration) or a bare `@mediapipe/...`
 * import specifier -- neither of which can ever match inside a bare JS
 * identifier or string literal a normal Three.js/Canvas2D piece uses.
 */
function stripCameraArtifacts(code: string): string {
  return code
    .replace(/<script[^>]*?(?:mediapipe|camera)[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/@mediapipe\/[\w/-]+/gi, '');
}

/**
 * The actual enforcement for a "Non-Camera ZIP": overrides
 * `navigator.mediaDevices.getUserMedia` (and the legacy
 * `navigator.getUserMedia`/vendor-prefixed names) to reject any request
 * whose constraints ask for video, before rejecting through to the real
 * implementation for an audio-only request -- so the Microphone control
 * (which this export mode still supports) keeps working while camera
 * access is unconditionally refused. Because this patches the actual
 * function objects `navigator`/`navigator.mediaDevices` expose, it holds
 * regardless of how calling code reaches them: a direct call, a computed
 * property lookup (`navigator['mediaDevices']['getUserMedia']`), or a
 * reference captured into a local variable first -- all of those resolve
 * through the same patched property. It must run before any other
 * `<script>` in the document (this export mode's own generated code
 * included), which is why `buildIndexHtml` places it first in `<head>`.
 */
function buildDeviceIsolationScript(): string {
  return `<script>
(function () {
  var deniedError = function () {
    return new DOMException('Camera access is disabled in this export.', 'NotAllowedError');
  };
  var nativeGetUserMedia =
    navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      : null;
  function guardedGetUserMedia(constraints) {
    if (constraints && constraints.video) return Promise.reject(deniedError());
    if (nativeGetUserMedia) return nativeGetUserMedia(constraints);
    return Promise.reject(deniedError());
  }
  if (!navigator.mediaDevices) navigator.mediaDevices = {};
  // A plain "=" assignment silently no-ops (in non-strict mode, with no
  // thrown error at all) if the browser's own getUserMedia property
  // happens to be non-writable -- defineProperty always succeeds as long
  // as the property is configurable, which every browser's own
  // implementation is.
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true,
    writable: true,
    value: guardedGetUserMedia,
  });
  ['getUserMedia', 'webkitGetUserMedia', 'mozGetUserMedia'].forEach(function (legacyName) {
    Object.defineProperty(navigator, legacyName, {
      configurable: true,
      writable: true,
      value: function (constraints, onSuccess, onError) {
        guardedGetUserMedia(constraints).then(onSuccess, onError);
      },
    });
  });
})();
</script>`;
}

/** Issue #436: real controls (a click actually calls the standalone
 * runtime's function and reflects its real outcome), not the previous
 * fire-and-forget `art-piece-command` events nothing in the exported
 * bundle ever consumed. Each togglable control gets an initial
 * `aria-pressed="false"` and its own status paragraph, matching the
 * live preview's `PieceStageControls.tsx` naming so this stays
 * recognizable as the same runtime contract, ported to a standalone
 * document. */
function buildExportControls(
  capabilities: ArtPieceCapabilitySet,
  mode: ArtPieceExportMode,
  presentation: ArtPieceExportPresentation,
  library: ArtPieceLibrary,
): string {
  const includeCamera = mode === 'full' && capabilities.camera_view === true;
  const includeSteering = mode === 'full' && capabilities.hand_steering === true;
  const includeMicrophone = capabilities.microphone === true;
  const includeNavigation =
    presentation === 'immersive' && SPATIAL_ART_PIECE_LIBRARIES.includes(library);
  // Issue #755: the same icon-only toolbar as the live stage, in the parity-matrix order
  // (docs/piece-toolbar-parity-matrix.md) minus Download/Immersive, Fullscreen last. Reset view
  // is the spatial engines' tool (row 7). Steer, camera, and microphone live in the single
  // Piece controls popover, and the hand guide exists only when steering does.
  const buttons: ExportToolbarButtonId[] = [
    ...(capabilities.screenshot !== false ? (['screenshot'] as const) : []),
    ...(capabilities.sound === true ? (['sound'] as const) : []),
    ...(includeMicrophone || includeCamera || includeSteering ? (['controls'] as const) : []),
    ...(includeSteering ? (['guide'] as const) : []),
    'reset',
    ...(capabilities.fullscreen !== false ? (['fullscreen'] as const) : []),
  ];
  const toolbar = renderExportStageToolbar({
    buttons,
    dataActions: true,
    controlsPanelId: 'art-piece-controls-panel',
    labels: {
      sound: 'Unmute sound',
      guide: 'Show hand gesture guide',
      fullscreen: 'Fullscreen',
    },
  });
  const panelRows = [
    includeMicrophone
      ? '<button type="button" data-action="microphone" aria-pressed="false">Enable microphone</button>\n  <p id="art-piece-microphone-status" role="status">Microphone is off.</p>'
      : '',
    includeCamera
      ? '<button type="button" data-action="camera" aria-pressed="false">Enable camera view</button>\n  <p id="art-piece-camera-status" role="status">Camera is off.</p>'
      : '',
    includeSteering
      ? '<button type="button" data-action="hand" aria-pressed="false">Steer the piece</button>\n  <p id="art-piece-steering-status" role="status">Steering is off.</p>'
      : '',
  ].filter(Boolean);
  const panel =
    panelRows.length > 0
      ? `<div id="art-piece-controls-panel" role="group" aria-label="Piece controls" hidden>\n  ${panelRows.join('\n  ')}\n</div>`
      : '';
  const soundStatus =
    capabilities.sound === true
      ? '<p id="art-piece-sound-status" role="status" class="art-piece-sr-only">Sound is off.</p>'
      : '';
  const navigationPose = includeNavigation
    ? '<p id="art-piece-navigation-pose" role="status">0.00,0.00,5.00</p>'
    : '';
  const guideDialog = includeSteering
    ? `<div id="art-piece-guide-dialog" role="dialog" aria-label="Hand gesture guide" aria-modal="true" hidden>
  <h3>Hand gesture guide</h3>
  <ol>
    <li>Look around with an open hand.</li>
    <li>Move your hand to orbit.</li>
    <li>Pinch to zoom.</li>
    <li>Release to stop.</li>
    <li>Disable steering safely from Piece controls.</li>
  </ol>
  <button type="button" data-action="guide-close">Close</button>
</div>`
    : '';
  return [
    toolbar,
    panel,
    soundStatus,
    navigationPose,
    guideDialog,
    '<p id="art-piece-runtime-error" role="alert" hidden></p>',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildIndexHtml(
  library: ArtPieceLibrary,
  code: string,
  runtimeFilename: string | undefined,
  options: ArtPieceExportOptions,
): string {
  const mode = options.mode ?? 'full';
  const presentation = options.presentation ?? 'regular';
  const exportCode = mode === 'non-camera' ? stripCameraArtifacts(code) : code;
  const runtimeScriptTag = runtimeFilename
    ? `<script src="runtime/${runtimeFilename}"></script>\n`
    : '';
  let body: string;
  if (library === 'threejs') {
    body = '<div id="art-piece-container"></div>\n<script src="scripts/piece.js"></script>';
  } else if (library === 'p5js') {
    body = `<div id="art-piece-container"></div>
<script>${exportCode}
(function () {
  var mount = document.getElementById('art-piece-container');
  if (typeof window.sketch !== 'function' || typeof window.p5 !== 'function') {
    throw new Error('p5.js sketch runtime was not initialized.');
  }
  window.__artPieceInstance = new window.p5(window.sketch, mount);
}());</script>`;
  } else if (library === 'c2js' || library === 'c2js-interactive') {
    body = `<canvas id="c2-canvas" width="1280" height="720"></canvas>
<script>${exportCode}
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
  if (typeof window.sketch !== 'function') throw new Error('C2.js sketch runtime was not initialized.');
  var frame = 0;
  var callback = null;
  function startFrame(handler) {
    if (typeof handler !== 'function') throw new Error('C2.js startFrame requires a function.');
    callback = handler;
    callback(frame++);
    function tick() {
      if (callback) callback(frame++);
      window.requestAnimationFrame(tick);
    }
    window.requestAnimationFrame(tick);
  }
  window.__artPieceInstance = window.sketch({ c2: c2Fallback, canvas: canvas, startFrame: startFrame });
}());</script>`;
  } else {
    // canvas2d, svg, aframe: natural content already includes whatever
    // markup/script it needs -- see this module's doc comment for why
    // these aren't split further.
    body = exportCode;
  }
  const controls = buildExportControls(options.capabilities ?? {}, mode, presentation, library);
  // The runtime script (defines window.__registerArtPieceCamera among
  // other globals) must load before scripts/piece.js, which calls it --
  // same execution-order requirement buildArtPieceSandboxDocument
  // already relies on for its own listener/snippet ordering.
  const runtimeControlsScript = buildStandaloneArtPieceRuntimeScript(
    library,
    options.capabilities ?? {},
    mode,
    presentation,
    options.cameraPlacement ?? 'overlay',
  );
  // Issue #437: must be the first script in the document -- before the
  // CDN/vendored runtime and before scripts/piece.js -- so no generated
  // code ever runs against the unpatched, real getUserMedia first.
  const deviceIsolationScript = mode === 'non-camera' ? `${buildDeviceIsolationScript()}\n` : '';
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Art piece</title>
<link rel="stylesheet" href="styles/piece.css">
${deviceIsolationScript}${runtimeScriptTag}${runtimeControlsScript}
</head>
<body>
${body}
${controls}
</body>
</html>
`;
}

const README = `EXPORT: AI-generated art piece

Open index.html to run this piece -- no build step, no server, works
straight from your file system or any static host.

MAKING IT YOUR OWN:
Edit styles/piece.css for appearance, and scripts/piece.js (if present --
only Three.js pieces have one; Canvas2D/SVG/A-Frame pieces keep their
generated markup directly in index.html) for behavior, then reopen
index.html.

runtime/ (if present) holds a vendored copy of this piece's rendering
library (p5.js, Three.js, or A-Frame), fetched once at export time so this piece
works completely offline -- it never depends on a live CDN connection
after you download it.

C2.js and C2.js Interactive use the bundled compatibility adapter matching
the live opaque-sandbox contract; no external runtime is required.
`;

/** Fetches `url` and returns its bytes as a `Uint8Array` (JSZip's most
 * broadly-recognized binary input type -- more robust than handing it a
 * raw `ArrayBuffer` across realms, e.g. jsdom's test environment), or
 * throws `ArtPieceBundleError`. The CDN files this ever fetches are the
 * exact same pinned, hardcoded URLs `artPieceSandbox.ts` already loads
 * live for the preview -- this function does not accept a caller-
 * supplied URL. */
async function fetchRuntimeFile(url: string): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new ArtPieceBundleError(
      `Could not download the ${url} runtime file -- check your network connection and try again.`,
      { cause: error },
    );
  }
  if (!response.ok) {
    throw new ArtPieceBundleError(
      `Could not download the ${url} runtime file (HTTP ${response.status}).`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

/** Builds a downloadable ZIP for a generated art piece: `index.html`,
 * `styles/piece.css`, `scripts/piece.js` (Three.js only), and `runtime/`
 * (Three.js/A-Frame only, vendored from the pinned CDN so the exported
 * piece works offline). Rejects with `ArtPieceBundleError` if fetching
 * the runtime file or ZIP encoding fails -- never returns a partial/
 * broken bundle. */
export async function generateArtPieceBundle(
  library: ArtPieceLibrary,
  code: string,
  options: ArtPieceExportOptions = {},
): Promise<Blob> {
  const runtime = LIBRARY_CDN[library];
  const runtimeBytes = runtime ? await fetchRuntimeFile(runtime.url) : null;

  try {
    const zip = new JSZip();
    zip.file('README.txt', README);
    zip.file(
      'styles/piece.css',
      buildPieceCss(options.presentation ?? 'regular', options.cameraPlacement ?? 'overlay'),
    );
    zip.file('index.html', buildIndexHtml(library, code, runtime?.filename, options));
    if (library === 'threejs') {
      zip.file(
        'scripts/piece.js',
        options.mode === 'non-camera' ? stripCameraArtifacts(code) : code,
      );
    }
    if (runtime && runtimeBytes) {
      zip.file(`runtime/${runtime.filename}`, runtimeBytes);
    }
    return await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
  } catch (error) {
    if (error instanceof ArtPieceBundleError) throw error;
    throw new ArtPieceBundleError(
      `ZIP encoding failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

/** Same create-URL/click/revoke-in-`finally` pattern
 * `generateSocialThumbnailZip.ts`'s `triggerZipDownload` already uses. */
export function triggerArtPieceBundleDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(url);
  }
}
