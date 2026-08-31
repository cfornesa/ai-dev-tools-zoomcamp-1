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
import type { Scene3DDocument } from '../pages/scene3dTypes';

export class Scene3DBundleError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'Scene3DBundleError';
  }
}

export type GenerateScene3DBundleResult =
  { ok: true; zipBlob: Blob; filename: string } | { ok: false; reasons: string[] };

/** Pinned to the exact same CDN URL/version `../generative/artPieceBundle.ts`'s
 * `LIBRARY_CDN.threejs` entry already vendors, matching this app's own
 * installed `three` dependency (`^0.160.0`). */
const THREE_CDN_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
const THREE_RUNTIME_FILENAME = 'three.min.js';

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
`;

const README = `EXPORT: 3D scene

Open index.html to run this piece -- no build step, no server, works
straight from your file system or any static host.

MAKING IT YOUR OWN:
Edit styles/piece.css for appearance, and scripts/piece.js for behavior,
then reopen index.html. The scene document itself lives at the top of
scripts/piece.js as plain JSON (window.__SCENE3D_DATA__).

runtime/ holds a vendored copy of Three.js, fetched once at export time
so this piece works completely offline -- it never depends on a live CDN
connection after you download it.
`;

function buildIndexHtml(): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>3D scene</title>
<link rel="stylesheet" href="styles/piece.css">
<script src="runtime/${THREE_RUNTIME_FILENAME}"></script>
</head>
<body>
<div id="scene3d-canvas-host"></div>
<script src="scripts/piece.js"></script>
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
): Promise<GenerateScene3DBundleResult> {
  const validation = validateScene3D(scene);
  if (!validation.valid) {
    return {
      ok: false,
      reasons: validation.errors.map((error) => `${error.path}: ${error.message}`),
    };
  }

  const runtimeBytes = await fetchThreeRuntime();

  try {
    const zip = new JSZip();
    zip.file('README.txt', README);
    zip.file('styles/piece.css', PIECE_CSS);
    zip.file('index.html', buildIndexHtml());
    zip.file(
      'scripts/piece.js',
      `window.__SCENE3D_DATA__ = ${JSON.stringify(scene)};\n${buildStandaloneThreeRuntimeScript()}`,
    );
    zip.file(`runtime/${THREE_RUNTIME_FILENAME}`, runtimeBytes);
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
