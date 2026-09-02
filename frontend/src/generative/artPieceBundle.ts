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

import type { ArtPieceCapabilitySet, ArtPieceLibrary } from '../api/artPieces';

export type ArtPieceExportMode = 'full' | 'non-camera';

export type ArtPieceExportOptions = {
  capabilities?: ArtPieceCapabilitySet;
  mode?: ArtPieceExportMode;
};

export class ArtPieceBundleError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ArtPieceBundleError';
  }
}

const PIECE_CSS = `html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  height: 100%;
  overflow: hidden;
}
canvas {
  display: block;
  max-width: 100%;
}
a-scene {
  position: absolute;
  inset: 0;
}
`;

/** Mirrors `artPieceSandbox.ts`'s `LIBRARY_CDN`/pinned versions -- kept as
 * its own copy (not a shared import) since this module's needs differ
 * (fetch-and-vendor at export time, vs. reference-by-URL at preview
 * time), the same way `art_piece_provider.py`'s backend constants and
 * `artPieceSandbox.ts`'s frontend constants are already two hand-synced
 * copies rather than one shared source. */
const LIBRARY_CDN: Partial<Record<ArtPieceLibrary, { url: string; filename: string }>> = {
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

function stripCameraArtifacts(code: string): string {
  return code
    .replace(/<script[^>]*?(?:mediapipe|camera)[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/(?:navigator\.)?mediaDevices\.getUserMedia/gi, 'undefined')
    .replace(/@mediapipe\/[\w/-]+/gi, '')
    .replace(/\b(?:camera|webcam|mediapipe|hand[_-]?tracking)\b/gi, 'non-camera');
}

function buildExportControls(
  capabilities: ArtPieceCapabilitySet,
  mode: ArtPieceExportMode,
): string {
  const buttons = [
    capabilities.screenshot !== false ? '<button data-action="screenshot">Screenshot</button>' : '',
    capabilities.sound ? '<button data-action="sound">Mute sound</button>' : '',
    capabilities.hand_steering && mode === 'full'
      ? '<button data-action="hand">Hand steering</button>'
      : '',
    capabilities.camera_view && mode === 'full'
      ? '<button data-action="camera">Camera view</button>'
      : '',
    capabilities.fullscreen !== false ? '<button data-action="fullscreen">Fullscreen</button>' : '',
    '<button data-action="reset">Reset view</button>',
  ].filter(Boolean);
  return `<nav class="art-piece-controls" aria-label="Piece controls">${buttons.join('')}</nav>
<script>
(function () {
  var controls = document.querySelector('.art-piece-controls');
  function canvas() { return document.querySelector('canvas'); }
  function filename() { return 'art-piece-screenshot-' + Date.now() + '.png'; }
  function save(blob, name) {
    var url = URL.createObjectURL(blob); var a = document.createElement('a');
    a.href = url; a.download = name; a.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }
  if (!controls) return;
  controls.addEventListener('click', function (event) {
    var action = event.target && event.target.getAttribute('data-action');
    if (action === 'screenshot') {
      var target = canvas();
      if (target && target.toBlob) target.toBlob(function (blob) { if (blob) save(blob, filename()); });
      else {
        var svg = document.querySelector('svg');
        if (svg) save(new Blob([new XMLSerializer().serializeToString(svg)], {type: 'image/svg+xml'}), filename().replace('.png', '.svg'));
      }
    } else if (action === 'fullscreen') {
      document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    } else if (action === 'reset') {
      window.dispatchEvent(new CustomEvent('art-piece-command', {detail: {type: 'reset-view', version: 1}}));
    } else if (action === 'sound' || action === 'camera' || action === 'hand') {
      window.dispatchEvent(new CustomEvent('art-piece-command', {detail: {type: action, version: 1}}));
    }
  });
})();
</script>`;
}

function buildIndexHtml(
  library: ArtPieceLibrary,
  code: string,
  runtimeFilename: string | undefined,
  options: ArtPieceExportOptions,
): string {
  const mode = options.mode ?? 'full';
  const exportCode = mode === 'non-camera' ? stripCameraArtifacts(code) : code;
  const runtimeScriptTag = runtimeFilename
    ? `<script src="runtime/${runtimeFilename}"></script>\n`
    : '';
  let body: string;
  if (library === 'threejs') {
    body =
      '<div id="art-piece-container" style="position:absolute;inset:0;"></div>\n<script src="scripts/piece.js"></script>';
  } else {
    // canvas2d, svg, aframe: natural content already includes whatever
    // markup/script it needs -- see this module's doc comment for why
    // these aren't split further.
    body = exportCode;
  }
  const controls = buildExportControls(options.capabilities ?? {}, mode);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Art piece</title>
<link rel="stylesheet" href="styles/piece.css">
${runtimeScriptTag}</head>
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
library (Three.js or A-Frame), fetched once at export time so this piece
works completely offline -- it never depends on a live CDN connection
after you download it.
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
    zip.file('styles/piece.css', PIECE_CSS);
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
