/**
 * Issue #289: the 3D counterpart of task 200/#200's portable multi-file
 * export bundle -- `../generative/artPieceBundle.ts` is this codebase's
 * only existing precedent for that shape (`index.html` + `styles/` +
 * `scripts/piece.js` + vendored `runtime/`, ZIP-packaged via JSZip), so
 * this module follows it directly rather than inventing a second bundle
 * format. That module bundles the separate, AI-art-piece document family
 * (`api/artPieces.ts`); this one bundles the canonical `scene3d` document
 * family (`schema/scene3d.schema.json`) instead, rendered via a
 * self-contained re-implementation of `render/threeSceneBuilder.ts`'s
 * logic (`standaloneThreeRuntimeSource.ts`) rather than that module's own
 * ESM import (a `file://` page can't resolve bare module specifiers).
 *
 * ## Core generator only (issue #289's own scope)
 *
 * No UI wiring here -- that's #290 (manual 3D editor) and #291
 * (AI-assisted 3D editor), which call `generateScene3DBundle` and hand
 * the result to `triggerScene3DBundleDownload`.
 */
import JSZip from 'jszip';

import { validateScene3D } from '../validation/scene3d';
import { downloadBlob } from './downloadBlob';
import { buildStandaloneThreeRuntimeScript } from './standaloneThreeRuntimeSource';
import {
  GESTURE_RECOGNIZER_MODEL_URL,
  MEDIAPIPE_TASKS_VISION_VERSION,
  buildStandaloneCameraScript,
} from './standaloneCameraSource';
import type { Scene3DDocument } from '../pages/scene3dTypes';

export class Scene3DBundleError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'Scene3DBundleError';
  }
}

export type GenerateScene3DBundleResult =
  { ok: true; zipBlob: Blob; filename: string } | { ok: false; reasons: string[] };

export type Scene3DExportVariant = 'full' | 'non-camera';

export type Scene3DExportOptions = {
  variant?: Scene3DExportVariant;
  /** Preserve the immersive route's navigation contract in the artifact. */
  immersive?: boolean;
};

/** Pinned to the exact same CDN URL/version `../generative/artPieceBundle.ts`'s
 * `LIBRARY_CDN.threejs` entry already vendors, matching this app's own
 * installed `three` dependency (`^0.160.0`). */
const THREE_CDN_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
const THREE_RUNTIME_FILENAME = 'three.min.js';
const MEDIAPIPE_CDN_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}`;
const MEDIAPIPE_ASSET_FILES = [
  ['runtime/mediapipe/vision_bundle.mjs', `${MEDIAPIPE_CDN_BASE_URL}/vision_bundle.mjs`],
  [
    'runtime/mediapipe/wasm/vision_wasm_internal.wasm',
    `${MEDIAPIPE_CDN_BASE_URL}/wasm/vision_wasm_internal.wasm`,
  ],
  [
    'runtime/mediapipe/wasm/vision_wasm_module_internal.wasm',
    `${MEDIAPIPE_CDN_BASE_URL}/wasm/vision_wasm_module_internal.wasm`,
  ],
  [
    'runtime/mediapipe/wasm/vision_wasm_nosimd_internal.wasm',
    `${MEDIAPIPE_CDN_BASE_URL}/wasm/vision_wasm_nosimd_internal.wasm`,
  ],
  [
    'runtime/mediapipe/wasm/vision_wasm_module_internal.js',
    `${MEDIAPIPE_CDN_BASE_URL}/wasm/vision_wasm_module_internal.js`,
  ],
  [
    'runtime/mediapipe/wasm/vision_wasm_internal.js',
    `${MEDIAPIPE_CDN_BASE_URL}/wasm/vision_wasm_internal.js`,
  ],
] as const;
const MEDIAPIPE_MODEL_PATH = 'runtime/mediapipe/gesture_recognizer.task';

const PIECE_CSS = `html, body {
  margin: 0;
  padding: 0;
  background: #000000;
  height: 100%;
  overflow: hidden;
}
#scene3d-canvas-host {
  position: absolute;
  inset: 0;
}
#scene3d-canvas-host canvas {
  display: block;
  width: 100%;
  height: 100%;
}
#piece-toolbar {
  position: fixed;
  left: 1rem;
  bottom: 1rem;
  z-index: 10;
  display: grid;
  gap: .5rem;
}
#piece-menu-trigger, #piece-actions-dialog button {
  min-height: 3rem;
  min-width: 3rem;
  padding: .5rem .75rem;
  border: 1px solid rgba(255,255,255,.28);
  border-radius: .75rem;
  background: rgba(10,12,20,.76);
  color: #fff;
  cursor: pointer;
}
#piece-menu-trigger:focus-visible, #piece-actions-dialog button:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}
#piece-actions-dialog {
  position: fixed;
  inset: 1rem;
  z-index: 30;
  display: grid;
  align-content: start;
  gap: 1rem;
  max-height: calc(100vh - 2rem);
  overflow: auto;
  padding: 1rem;
  color: #fff;
  background: rgba(10,12,20,.94);
  border: 1px solid rgba(255,255,255,.28);
  border-radius: 1rem;
}
#piece-actions-dialog[hidden] { display: none; }
#piece-actions-dialog header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
#piece-actions-dialog h2 { margin: 0; font-size: 1.25rem; }
#piece-actions-dialog .piece-action-list { display: grid; gap: .75rem; }
#piece-actions-dialog .piece-action-list > button { display: flex; align-items: center; justify-content: flex-start; gap: .75rem; width: 100%; text-align: left; }
#piece-actions-dialog .piece-action-icon { width: 1.5rem; text-align: center; font-size: 1.25rem; }
#piece-actions-dialog .piece-action-label { font-size: 1rem; }
#piece-actions-dialog-close { width: 3rem; padding-inline: 0 !important; font-size: 1.5rem; }
#piece-audio-controls {
  position: fixed;
  left: 1rem;
  bottom: 5.5rem;
  z-index: 10;
  display: grid;
  gap: .5rem;
  min-width: 13rem;
  padding: .75rem;
  color: #fff;
  background: rgba(10,12,20,.9);
  border: 1px solid rgba(255,255,255,.28);
  border-radius: .75rem;
}
#piece-actions-dialog > #piece-audio-controls { position: static; left: auto; bottom: auto; z-index: auto; width: auto; min-width: 0; max-width: none; max-height: none; overflow: visible; margin: 0 1rem 1rem; box-sizing: border-box; }
#piece-audio-controls[hidden] { display: none; }
#piece-audio-controls { max-height: min(40vh, 20rem); overflow: auto; box-sizing: border-box; }
#piece-audio-controls label { display: grid; gap: .25rem; font-size: .8rem; }
#piece-hand-guide {
  position: fixed;
  inset: 10% auto auto 50%;
  transform: translateX(-50%);
  z-index: 20;
  width: min(28rem, calc(100vw - 2rem));
  padding: 1rem;
  color: #fff;
  background: rgba(10,12,20,.94);
  border: 1px solid rgba(255,255,255,.28);
  border-radius: .75rem;
}
#piece-hand-guide[hidden] { display: none; }
#piece-hand-guide { max-height: min(60vh, 28rem); overflow: auto; box-sizing: border-box; }
#piece-hand-guide button { width: auto; height: auto; padding: .5rem .75rem; }
#camera-controls-host { position: fixed; left: 1rem; bottom: 5.5rem; z-index: 10; display: grid; gap: .5rem; min-width: 15rem; max-width: min(22rem, calc(100vw - 2rem)); max-height: min(40vh, 20rem); overflow: auto; box-sizing: border-box; padding: .75rem; color: #fff; background: rgba(10,12,20,.9); border: 1px solid rgba(255,255,255,.28); border-radius: .75rem; }
#piece-audio-controls #camera-controls-host { position: static; left: auto; bottom: auto; z-index: auto; min-width: 0; max-width: none; max-height: none; overflow: visible; padding: 0; color: inherit; background: transparent; border: 0; border-radius: 0; }
#camera-controls-host:empty { display: none; }
#camera-controls-host video { width: 100%; max-height: 10rem; object-fit: cover; border-radius: .5rem; }
`;

function buildReadme(immersive: boolean): string {
  return `EXPORT: 3D scene

Open index.html to run this piece -- no build step, no server, works
straight from your file system or any static host.

Use the arrow keys to fly through the piece; WASD remains available for
optional keyboard notes. Drag to orbit, scroll/pinch to zoom, and use Reset
view to return to the authored camera pose.

MAKING IT YOUR OWN:
Edit styles/piece.css for appearance, and scripts/piece.js for behavior,
then reopen index.html. The scene document itself lives at the top of
scripts/piece.js as plain JSON (window.__SCENE3D_DATA__).

runtime/ holds a vendored copy of Three.js, fetched once at export time.
The Full variant also loads the pinned MediaPipe hand-tracking module/model
only after the reader explicitly enables the camera; Non-Camera omits that
feature and all camera permissions.
Surface mode: ${immersive ? 'immersive (arrow-key travel)' : 'regular'}.
`;
}

function buildIndexHtml(variant: Scene3DExportVariant, immersive: boolean): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>3D scene</title>
<meta name="creatrweb-export-variant" content="${variant}">
<meta name="creatrweb-export-surface" content="${immersive ? 'immersive' : 'regular'}">
<link rel="stylesheet" href="styles/piece.css">
<script src="runtime/${THREE_RUNTIME_FILENAME}"></script>
</head>
<body data-piece-surface="${immersive ? 'immersive' : 'regular'}">
<div id="scene3d-canvas-host"></div>
<div id="piece-toolbar" role="toolbar" aria-label="Piece actions">
  <button id="piece-menu-trigger" type="button" aria-label="Open piece controls menu" aria-expanded="false" aria-controls="piece-actions-dialog">☰</button>
</div>
<div id="piece-actions-dialog" role="dialog" aria-label="Piece actions" hidden>
  <header><h2>Piece actions</h2><button id="piece-actions-dialog-close" type="button" aria-label="Close piece controls menu">×</button></header>
  <div class="piece-action-list">
    <button id="piece-screenshot" type="button" aria-label="Take screenshot" title="Take screenshot"><span class="piece-action-icon" aria-hidden="true">⌗</span><span class="piece-action-label">Screenshot</span></button>
    <button id="piece-reset-view" type="button" aria-label="Reset view" title="Reset view"><span class="piece-action-icon" aria-hidden="true">↺</span><span class="piece-action-label">Reset view</span></button>
    <button id="piece-sound" type="button" aria-label="Enable sound" title="Enable sound" aria-pressed="false"><span class="piece-action-icon" aria-hidden="true">♪</span><span class="piece-action-label">Sound</span></button>
    <button id="piece-audio-settings" type="button" aria-label="Piece controls" title="Piece controls" aria-expanded="false"><span class="piece-action-icon" aria-hidden="true">☷</span><span class="piece-action-label">Piece controls</span></button>
    <button id="piece-hand-guide-toggle" type="button" aria-label="Hand gesture guide" title="Hand gesture guide" aria-expanded="false"><span class="piece-action-icon" aria-hidden="true">?</span><span class="piece-action-label">Hand gesture guide</span></button>
    <button id="piece-fullscreen" type="button" aria-label="Enter fullscreen" title="Enter fullscreen"><span class="piece-action-icon" aria-hidden="true">⛶</span><span class="piece-action-label">Fullscreen</span></button>
  </div>
  <div id="piece-audio-controls" role="group" aria-label="Piece controls" hidden>
    <label for="piece-volume">Sound volume <input id="piece-volume" type="range" min="0" max="100" value="50"></label>
    <button id="piece-keyboard" type="button" aria-pressed="false">Keyboard notes</button>
    ${variant === 'full' ? '<button id="piece-mic" type="button" aria-pressed="false">Live mic</button>' : ''}
    ${variant === 'full' ? '<button id="piece-theremin" type="button" aria-pressed="false">Camera theremin</button>' : ''}
    <p>Enable sound, then turn on keyboard notes to play A–L keys.</p>
    ${variant === 'full' ? '<div id="camera-controls-host" role="group" aria-label="Camera controls"></div>' : ''}
  </div>
</div>
<div id="piece-hand-guide" role="dialog" aria-label="Hand gesture guide" hidden>
  <h2>Hand gesture guide</h2>
  <ol>
    <li>Look: keep your hand visible to the camera.</li>
    <li>Move: move your palm to steer the piece.</li>
    <li>Orbit: move left or right to orbit the view.</li>
    <li>Zoom: pinch to change distance.</li>
    <li>Stop: release the gesture or stop the camera.</li>
  </ol>
  <button id="piece-hand-guide-close" type="button">Close</button>
</div>
<script src="scripts/piece.js"></script>
<script>
(() => {
  const host = document.getElementById('scene3d-canvas-host');
  const menuTrigger = document.getElementById('piece-menu-trigger');
  const actionsDialog = document.getElementById('piece-actions-dialog');
  const actionsClose = document.getElementById('piece-actions-dialog-close');
  const screenshot = document.getElementById('piece-screenshot');
  const resetView = document.getElementById('piece-reset-view');
  const fullscreen = document.getElementById('piece-fullscreen');
  const guideToggle = document.getElementById('piece-hand-guide-toggle');
  const guide = document.getElementById('piece-hand-guide');
  const guideClose = document.getElementById('piece-hand-guide-close');
  const audioSettings = document.getElementById('piece-audio-settings');
  const audioPanel = document.getElementById('piece-audio-controls');
  let menuReturnFocus = null;
  function setMenuOpen(open) {
    if (!actionsDialog || !menuTrigger) return;
    actionsDialog.hidden = !open;
    menuTrigger.setAttribute('aria-expanded', String(open));
    if (open) {
      menuReturnFocus = document.activeElement;
      actionsClose?.focus();
    } else {
      menuTrigger.focus();
      menuReturnFocus = null;
    }
  }
  menuTrigger?.addEventListener('click', () => setMenuOpen(Boolean(actionsDialog?.hidden)));
  actionsClose?.addEventListener('click', () => setMenuOpen(false));
  actionsDialog?.addEventListener('click', (event) => {
    if (event.target === actionsDialog) setMenuOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && actionsDialog && !actionsDialog.hidden) setMenuOpen(false);
  });
  const canvas = () => host && host.querySelector('canvas');
  screenshot?.addEventListener('click', () => {
    const current = canvas();
    if (!current) return;
    const link = document.createElement('a');
    link.download = 'piece-screenshot.png';
    link.href = current.toDataURL('image/png');
    link.click();
  });
  resetView?.addEventListener('click', () => window.dispatchEvent(new Event('piece-reset-view')));
  fullscreen?.addEventListener('click', async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await (host?.requestFullscreen?.() ?? Promise.resolve());
    fullscreen.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
  });
  function setGuideOpen(open) {
    if (!guide || !guideToggle) return;
    guide.hidden = !open;
    guideToggle.setAttribute('aria-expanded', String(open));
  }
  guideToggle?.addEventListener('click', () => setGuideOpen(Boolean(guide?.hidden)));
  guideClose?.addEventListener('click', () => setGuideOpen(false));
  audioSettings?.addEventListener('click', () => {
    if (!audioPanel) return;
    audioPanel.hidden = !audioPanel.hidden;
    audioSettings.setAttribute('aria-expanded', String(!audioPanel.hidden));
  });
})();
</script>
</body>
</html>
`;
}

/** Fetches Three.js's vendored UMD build. Mirrors
 * `../generative/artPieceBundle.ts`'s identical `fetchRuntimeFile`. */
async function fetchThreeRuntime(): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await fetch(THREE_CDN_URL);
  } catch (error) {
    throw new Scene3DBundleError(
      `Could not download the Three.js runtime file -- check your network connection and try again.`,
      { cause: error },
    );
  }
  if (!response.ok) {
    throw new Scene3DBundleError(
      `Could not download the Three.js runtime file (HTTP ${response.status}).`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchBinaryAsset(url: string, label: string): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Scene3DBundleError(
      `Could not download the ${label} -- check your network connection.`,
      {
        cause: error,
      },
    );
  }
  if (!response.ok) {
    throw new Scene3DBundleError(`Could not download the ${label} (HTTP ${response.status}).`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchMediaPipeAssets(): Promise<Map<string, Uint8Array>> {
  const assets = await Promise.all(
    [...MEDIAPIPE_ASSET_FILES, [MEDIAPIPE_MODEL_PATH, GESTURE_RECOGNIZER_MODEL_URL] as const].map(
      async ([path, url]) =>
        [path, await fetchBinaryAsset(url, `MediaPipe asset ${path}`)] as const,
    ),
  );
  return new Map(assets);
}

/** Turns `title` into a filesystem-safe, lowercase, hyphenated basename --
 * same convention `generateHtmlExport.ts`'s `slugifyFilename` uses for
 * the 2D single-file export. */
function slugifyFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'export';
}

/** Builds the downloadable ZIP bundle for `scene`, or reports the exact
 * validation-failure reasons if it can't be generated -- never returns a
 * partial/broken bundle. `scene` is embedded as plain JSON at the top of
 * `scripts/piece.js` (a `.js` file is never HTML-parsed, so no
 * `</script>`-breakout/XSS concern the 2D single-file export's
 * `safeEmbed.ts` exists to guard against applies here); the same object
 * reference always produces byte-identical script/HTML content (no
 * caching involved anywhere in this module), so re-running this on the
 * same input always reflects it exactly. */
export async function generateScene3DBundle(
  scene: Scene3DDocument,
  baseName: string,
  options: Scene3DExportOptions = {},
): Promise<GenerateScene3DBundleResult> {
  const validation = validateScene3D(scene);
  if (!validation.valid) {
    return {
      ok: false,
      reasons: validation.errors.map((error) => `${error.path}: ${error.message}`),
    };
  }

  const variant = options.variant ?? 'full';
  const immersive = options.immersive ?? false;
  const runtimeBytes = await fetchThreeRuntime();
  const mediapipeAssets = variant === 'full' ? await fetchMediaPipeAssets() : null;

  try {
    const zip = new JSZip();
    zip.file('README.txt', buildReadme(immersive));
    zip.file('styles/piece.css', PIECE_CSS);
    zip.file('index.html', buildIndexHtml(variant, immersive));
    zip.file(
      'scripts/piece.js',
      `window.__SCENE3D_DATA__ = ${JSON.stringify(scene)};\n${buildStandaloneThreeRuntimeScript({ includeCameraFeatures: variant === 'full', immersive })}${variant === 'full' ? `\n${buildStandaloneCameraScript({ visionBundleUrl: './runtime/mediapipe/vision_bundle.mjs', wasmBaseUrl: './runtime/mediapipe/wasm', modelUrl: `./${MEDIAPIPE_MODEL_PATH}` })}` : ''}`,
    );
    zip.file(`runtime/${THREE_RUNTIME_FILENAME}`, runtimeBytes);
    mediapipeAssets?.forEach((bytes, path) => zip.file(path, bytes));
    const zipBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
    return { ok: true, zipBlob, filename: `${slugifyFilename(baseName)}.zip` };
  } catch (error) {
    if (error instanceof Scene3DBundleError) throw error;
    throw new Scene3DBundleError(
      `ZIP encoding failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

/** Reuses #285's shared `downloadBlob.ts` helper rather than adding a 4th
 * hand-rolled copy of the same object-URL/anchor-click pattern
 * (`../generative/artPieceBundle.ts`'s `triggerArtPieceBundleDownload`
 * and `generateSocialThumbnailZip.ts`'s `triggerZipDownload` are the two
 * pre-existing ones `downloadBlob.ts` was itself extracted from). */
export const triggerScene3DBundleDownload = downloadBlob;
