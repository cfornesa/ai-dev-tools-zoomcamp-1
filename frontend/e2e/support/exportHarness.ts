/**
 * Task 69 (issue #69): shared Node-side helpers for the export
 * end-to-end suite's Tier 1 layer (`exportArtifacts.spec.ts`) — the part
 * of this suite that needs no Django, no PostgreSQL, and no Vite dev
 * server, because export *generation* itself
 * (`../../src/export/generateHtmlExport.ts`,
 * `../../src/export/generateSocialThumbnailZip.ts`) is a pure
 * client-side/TypeScript function, not an API call. See this file's
 * companion spec's own module doc comment for the full Tier 1/Tier 2
 * rationale.
 *
 * ## Generation happens inside a real browser, not this Node process
 *
 * The obvious-looking shortcut — import `generateHtmlExport` directly into
 * this Node-side test file, the same way `generateHtmlExport.test.ts` does
 * under vitest — does not actually work here: that module's transitive
 * dependency chain (`../render/sceneDrawPlan.ts` →
 * `../validation/scene.ts`) imports `ajv` via the extensionless subpath
 * `ajv/dist/2020`, which Vite/Vitest's own resolver accepts but
 * Playwright's plain Node ESM loader for test files rejects
 * (`ERR_MODULE_NOT_FOUND`) — confirmed by trying it first. Both
 * `generateHtmlExport` and `generateSocialThumbnailZip` are instead
 * bundled with Vite's own library-mode `build()` API (already a
 * `frontend` devDependency — no new tooling added) into a single
 * self-contained IIFE script (`bundleExportModuleForBrowser` below) and
 * loaded into a real Chromium page via `page.addScriptTag` + written from
 * there, so both *generation and execution* happen inside a real browser
 * engine. For `generateSocialThumbnailZip` specifically (which calls
 * `captureSocialThumbnail`, needing a real Canvas 2D context to render the
 * scene through the app's own p5.js adapter) this is not just a
 * workaround but a genuinely stronger check than Task 59's own jsdom unit
 * tests, which render through the `canvas` npm package's C++ polyfill
 * rather than a real browser engine.
 *
 * The *execution* half of the HTML-export criterion ("opens in an
 * isolated browser context") still uses a second, completely separate
 * `BrowserContext` — the generated HTML string is written to a temp file
 * and loaded via `file://` into a fresh context with no relationship to
 * the one used to generate it (see `exportArtifacts.spec.ts`).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FRONTEND_ROOT = path.resolve(import.meta.dirname, '..', '..');

/** A loose local stand-in for `../../src/api/projects.ts`'s
 * `SceneDocument` (itself just `Record<string, unknown>`) -- deliberately
 * not imported here. `tsconfig.e2e.json` uses strict `nodenext` module
 * resolution, which requires explicit `.js` extensions on every relative
 * import *transitively reachable* from an e2e file; pulling in
 * `../../src/render/testSceneFixtures.ts` (whose own doc comment already
 * scopes it to exactly two non-e2e test files) would drag its
 * extensionless production-source imports into that same strict program.
 * Building this suite's own small, self-contained scene fixtures instead
 * avoids that entirely, at the cost of a little duplication with
 * `testSceneFixtures.ts`'s shape -- an acceptable tradeoff for two tiny
 * builder functions. */
type SceneDocument = Record<string, unknown>;

/** A distinctive, never-otherwise-occurring marker used as the scene's own
 * internal `id` in every Tier 1 fixture — `stripSceneForExport`
 * (`../../src/export/sceneExportStripping.ts`) removes exactly this field,
 * so asserting this exact string never appears anywhere in a generated
 * artifact is a precise, false-positive-free way to prove that stripping
 * actually happened in the real generated output, not just in a unit
 * test's mocked call. */
export const INTERNAL_SCENE_ID_MARKER = 'INTERNAL-EDITOR-SCENE-ID-4f19c2a6';

/** A minimal, self-contained circle-shaped scene document builder —
 * structurally the same shape `../../src/render/testSceneFixtures.ts`'s
 * `baseScene`/`circleShape` produce (one layer, one circle shape, empty
 * groups/bindings/graph), duplicated locally rather than imported — see
 * the `SceneDocument` type alias above for why. */
function fixtureScene(overrides: {
  id?: string;
  canvas?: { width: number; height: number; backgroundColor: string };
  circle?: { fill: string; radius: number };
  seed?: number;
}): SceneDocument {
  const canvas = overrides.canvas ?? { width: 200, height: 150, backgroundColor: '#123456' };
  const circle = overrides.circle ?? { fill: '#ff8800', radius: 30 };
  return {
    schemaVersion: 1,
    id: overrides.id ?? INTERNAL_SCENE_ID_MARKER,
    canvas,
    renderer: { preferred: 'p5' },
    layers: [{ id: 'layer-1', name: 'Layer', order: 0, visible: true, locked: false }],
    shapes: [
      {
        id: 'shape-circle',
        type: 'circle',
        layerId: 'layer-1',
        groupId: null,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        style: { fill: circle.fill, stroke: null, strokeWidth: 0 },
        radius: circle.radius,
      },
    ],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: overrides.seed ?? 3, enabled: true },
  };
}

/** Builds a small, deterministic scene document for Tier 1 fixtures. */
export function exportFixtureScene(): SceneDocument {
  return fixtureScene({});
}

/** A second, visually distinct fixture standing in for "a historical saved
 * version" (a different radius/color/canvas size than
 * `exportFixtureScene`'s "latest" shape) — `generateHtmlExport` takes
 * scene data directly regardless of whether it came from a project's
 * current version or an older one, so two different scene documents are
 * all that's needed to prove "export of a historical version" generates
 * and runs correctly, matching this suite's brief. */
export function historicalExportFixtureScene(): SceneDocument {
  return fixtureScene({
    canvas: { width: 200, height: 150, backgroundColor: '#654321' },
    circle: { fill: '#00aaff', radius: 12 },
  });
}

// ---------------------------------------------------------------------
// Temp-file bookkeeping (acceptance criterion: "cleans downloaded and
// temporary artifacts").
// ---------------------------------------------------------------------

const tempPaths: string[] = [];
let tempDir: string | null = null;

function ensureTempDir(): string {
  if (!tempDir) {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-e2e-'));
  }
  return tempDir;
}

/** Writes `contents` to a fresh temp file named `name` and returns both its
 * filesystem path and a `file://` URL Playwright can navigate to. Tracked
 * for removal by `cleanupExportHarnessArtifacts()`. */
export function writeTempArtifact(
  name: string,
  contents: string | Buffer,
): { filePath: string; fileUrl: string } {
  const dir = ensureTempDir();
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, contents);
  tempPaths.push(filePath);
  return { filePath, fileUrl: `file://${filePath}` };
}

/** Removes every temp file this harness wrote (HTML fixtures, downloaded
 * ZIPs, decoded PNGs) and the temp directory itself. Idempotent — safe to
 * call from an `afterAll`/`afterEach` even if nothing was ever written. */
export function cleanupExportHarnessArtifacts(): void {
  for (const filePath of tempPaths.splice(0)) {
    try {
      fs.rmSync(filePath, { force: true });
    } catch {
      // Already gone -- nothing to clean up.
    }
  }
  if (tempDir) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best effort -- OS temp dirs are cleaned up eventually regardless.
    }
    tempDir = null;
  }
}

// ---------------------------------------------------------------------
// In-browser bundle of the export modules (for ZIP/thumbnail generation,
// which needs a real Canvas 2D context — see module doc comment above).
// ---------------------------------------------------------------------

const BROWSER_ENTRY_SOURCE = `import { generateHtmlExport, P5_CDN_URL } from '../../src/export/generateHtmlExport';
import { generateSocialThumbnailZip } from '../../src/export/generateSocialThumbnailZip';
import { generateScene3DBundle } from '../../src/export/generateHtmlExport3D';
import { MEDIAPIPE_VISION_BUNDLE_CDN_URL } from '../../src/export/standaloneCameraSource';

(window as unknown as { __exportHarness: unknown }).__exportHarness = {
  generateHtmlExport,
  generateSocialThumbnailZip,
  generateScene3DBundle,
  P5_CDN_URL,
  MEDIAPIPE_VISION_BUNDLE_CDN_URL,
  THREE_CDN_URL: 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js',
};
`;

/** Where the temporary bundle-entry source file is written, deliberately
 * *inside* `e2e/support/` (not an OS temp dir) so its relative imports
 * (`../../src/export/...`) resolve exactly the way every other module in
 * this directory's relative imports already do. Removed again immediately
 * after the bundle build completes -- see the `finally` block below. */
const BUNDLE_ENTRY_PATH = path.join(import.meta.dirname, '.generatedExportHarnessEntry.ts');

let bundlePromise: Promise<string> | null = null;

/** Bundles `generateHtmlExport`/`generateSocialThumbnailZip` (and every
 * real module they import, including `p5` and the ajv-based scene
 * validator) into a single IIFE script string via Vite's library-mode
 * `build()` API, memoized for the whole test run since the source doesn't
 * change mid-run. Returns the bundle's JS source — the caller loads it
 * into a page with `page.addScriptTag({ content })`. No dev server, no
 * Django, no network request: everything Vite needs is already on disk in
 * `frontend/node_modules`.
 *
 * This is also *why* this suite generates artifacts inside a real browser
 * page rather than by importing `generateHtmlExport.ts` directly from this
 * Node-side test file: that module's transitive dependency chain
 * (`../render/sceneDrawPlan.ts` → `../validation/scene.ts`) imports `ajv`
 * via the extensionless subpath `ajv/dist/2020`, which Vite/Vitest's own
 * resolver handles happily but Playwright's plain Node ESM loader for test
 * files does not (`ERR_MODULE_NOT_FOUND`, confirmed by attempting the
 * direct-import approach first). Routing generation through this real
 * Vite-built bundle sidesteps that entirely — and, as a side effect, is an
 * even stronger proof than a Node-side call would have been: it confirms
 * `generateHtmlExport`/`generateSocialThumbnailZip` themselves execute
 * correctly inside a real browser engine, not just that their *output*
 * does. */
export async function bundleExportModuleForBrowser(): Promise<string> {
  if (!bundlePromise) {
    bundlePromise = (async () => {
      const { build } = await import('vite');
      fs.writeFileSync(BUNDLE_ENTRY_PATH, BROWSER_ENTRY_SOURCE);
      try {
        const output = await build({
          root: FRONTEND_ROOT,
          logLevel: 'warn',
          configFile: false,
          build: {
            write: false,
            minify: false,
            target: 'es2020',
            lib: {
              entry: BUNDLE_ENTRY_PATH,
              formats: ['iife'],
              name: 'ExportHarnessBundle',
            },
          },
        });
        const results = Array.isArray(output) ? output : [output];
        for (const result of results) {
          if ('output' in result) {
            const chunk = result.output.find(
              (item): item is Extract<typeof item, { type: 'chunk' }> => item.type === 'chunk',
            );
            if (chunk) return chunk.code;
          }
        }
        throw new Error(
          'Vite library build produced no output chunk for the export harness bundle.',
        );
      } finally {
        fs.rmSync(BUNDLE_ENTRY_PATH, { force: true });
      }
    })();
  }
  return bundlePromise;
}

export type GenerateHtmlExportBrowserResult =
  { ok: true; html: string; filename: string } | { ok: false; reasons: string[] };

export type GenerateScene3DBrowserResult =
  { ok: true; filename: string; zipBase64: string } | { ok: false; reasons: string[] };

/** A Playwright `Page` with the export-module bundle already injected
 * (`window.__exportHarness`), plus the two CDN URL constants it also
 * exposes and Node-side wrappers around its exported functions —
 * everything `exportArtifacts.spec.ts` needs to *generate* an artifact.
 * Callers are still responsible for opening a completely separate,
 * isolated context/page to *execute* the resulting HTML — this page is
 * a generation harness only, never itself asserted against as "the
 * isolated context an export runs in". */
export type ExportGeneratorPage = {
  page: import('@playwright/test').Page;
  constants: {
    P5_CDN_URL: string;
    MEDIAPIPE_VISION_BUNDLE_CDN_URL: string;
    THREE_CDN_URL: string;
  };
  generateHtmlExport: (input: Record<string, unknown>) => Promise<GenerateHtmlExportBrowserResult>;
  generateScene3DBundle: (
    scene: Record<string, unknown>,
    title: string,
    variant: 'full' | 'non-camera',
  ) => Promise<GenerateScene3DBrowserResult>;
  close: () => Promise<void>;
};

/** Creates a blank page with the export-module bundle loaded, for calling
 * `generateHtmlExport`/`generateSocialThumbnailZip` for real, inside a
 * real browser. `about:blank` origin, never touched by the app's own
 * routes/cookies — this page exists purely to host the bundle. */
export async function createExportGeneratorPage(
  browser: import('@playwright/test').Browser,
): Promise<ExportGeneratorPage> {
  const bundleCode = await bundleExportModuleForBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('about:blank');
  await page.addScriptTag({ content: bundleCode });

  const constants = await page.evaluate(() => {
    const harness = (
      window as unknown as {
        __exportHarness: {
          P5_CDN_URL: string;
          MEDIAPIPE_VISION_BUNDLE_CDN_URL: string;
          THREE_CDN_URL: string;
        };
      }
    ).__exportHarness;
    return {
      P5_CDN_URL: harness.P5_CDN_URL,
      MEDIAPIPE_VISION_BUNDLE_CDN_URL: harness.MEDIAPIPE_VISION_BUNDLE_CDN_URL,
      THREE_CDN_URL: harness.THREE_CDN_URL,
    };
  });

  return {
    page,
    constants,
    generateHtmlExport: (input) =>
      page.evaluate((inputArg) => {
        const harness = (
          window as unknown as {
            __exportHarness: {
              generateHtmlExport: (i: unknown) => GenerateHtmlExportBrowserResult;
            };
          }
        ).__exportHarness;
        return harness.generateHtmlExport(inputArg);
      }, input),
    generateScene3DBundle: (scene, title, variant) =>
      page.evaluate(
        async ({ scene: sceneArg, title: titleArg, variant: variantArg }) => {
          const harness = (
            window as unknown as {
              __exportHarness: {
                generateScene3DBundle: (
                  scene: unknown,
                  title: string,
                  options: { variant: 'full' | 'non-camera' },
                ) => Promise<
                  { ok: true; zipBlob: Blob; filename: string } | { ok: false; reasons: string[] }
                >;
              };
            }
          ).__exportHarness;
          const result = await harness.generateScene3DBundle(sceneArg, titleArg, {
            variant: variantArg,
          });
          if (!result.ok) return result;
          const bytes = new Uint8Array(await result.zipBlob.arrayBuffer());
          let binary = '';
          const chunkSize = 0x8000;
          for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
          }
          return { ok: true as const, filename: result.filename, zipBase64: btoa(binary) };
        },
        { scene, title, variant },
      ),
    close: () => context.close(),
  };
}

// ---------------------------------------------------------------------
// Content-exclusion scanning (acceptance criterion: scan every artifact
// for internal IDs, prompts, history, creator identity, drafts,
// provenance, camera frames, unpinned dependencies).
// ---------------------------------------------------------------------

/** Secret-shaped values a generated artifact must never contain, standing
 * in for exactly the categories issue #69 names: internal ids, an AI
 * prompt, version-history bookkeeping, the creator's identity, draft
 * state, fork/remix provenance, and a captured camera frame. None of
 * these are fields `GenerateHtmlExportInput` even declares — attaching
 * them to an input object (as an intentionally excess-property superset,
 * simulating a caller mistake) and then scanning the real output proves
 * structurally, in a real generated artifact, that no such field can leak,
 * not just that the type doesn't list it. */
export function leakProbeExtras(): Record<string, string> {
  return {
    internalSceneId: INTERNAL_SCENE_ID_MARKER,
    aiPrompt: 'SECRET-AI-PROMPT-a scowling cat riding a rocket, cinematic lighting',
    versionHistoryNote: 'SECRET-VERSION-HISTORY-restored from version 3 of 9',
    creatorUsername: 'SECRET-CREATOR-e2e_owner_9f1',
    creatorEmail: 'SECRET-CREATOR-EMAIL-owner9f1@example.invalid',
    draftMarker: 'SECRET-DRAFT-unsaved-draft-id-77213',
    provenanceParentId: 'SECRET-PROVENANCE-forked-from-project-55219',
    cameraFrameDataUrl:
      'data:image/png;base64,SECRET-CAMERA-FRAME-BASE64-PAYLOAD-should-never-embed',
    // Task 73 (issue #73), privacy audit acceptance criterion 2 ("...
    // client bundles, source maps ... contain no provider credentials"):
    // a provider API key, shaped like a real Mistral key, added the same
    // superset-injection way as every other marker above. `ai_provider`
    // is entirely server-side and `GenerateHtmlExportInput` has no
    // key-shaped field at all, so this proves the same "structurally
    // cannot leak" property this file's other markers already prove for
    // prompts/drafts/provenance, extended to cover credentials too.
    providerApiKey: 'SECRET-MISTRAL-API-KEY-sk-do-not-leak-9182734abcdef',
  };
}

/** Every unpinned-dependency pattern to fail on: a `<script src="...">`
 * pointing at a CDN URL with no explicit package version segment (a bare
 * `@latest`, a version-less path, or `main`/`latest` tags) — the opposite
 * of `generateHtmlExport.ts`'s `P5_VERSION`-pinned CDN URL and
 * `standaloneCameraSource.ts`'s `MEDIAPIPE_TASKS_VISION_VERSION`-pinned
 * URLs. */
export function findUnpinnedDependencyScriptSrcs(html: string): string[] {
  const offending: string[] = [];
  const scriptSrcPattern = /<script[^>]*\bsrc=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptSrcPattern.exec(html)) !== null) {
    const src = match[1];
    const isCdn =
      /cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|storage\.googleapis\.com/i.test(src);
    if (!isCdn) continue;
    // A pinned URL names an exact version somewhere in its path, e.g.
    // `/npm/p5@1.11.10/...` or `/npm/@mediapipe/tasks-vision@1.0.1/...`.
    // Anything else (no `@x.y.z` segment, or `@latest`) is unpinned.
    const hasExactVersion = /@\d+\.\d+\.\d+/.test(src);
    const isLatestTag = /@latest\b/i.test(src);
    if (!hasExactVersion || isLatestTag) {
      offending.push(src);
    }
  }
  return offending;
}

/** Asserts (via a thrown `Error` naming every offender, for a clear
 * failure message rather than a bare boolean) that none of `secrets`'
 * values appear anywhere in `haystack` — used to scan a full generated
 * artifact's raw HTML source. */
export function assertNoLeaks(haystack: string, secrets: Record<string, string>): void {
  const found = Object.entries(secrets).filter(([, value]) => haystack.includes(value));
  if (found.length > 0) {
    throw new Error(`Artifact leaked internal data: ${found.map(([label]) => label).join(', ')}`);
  }
}

/** Reads a PNG's IHDR width/height without decoding pixels — the same
 * technique `generateSocialThumbnailZip.test.ts`'s own `pngDimensions`
 * helper uses (Task 59), reused here rather than reimplemented so both
 * suites agree on what "1200x630" means for a PNG byte stream. */
export function pngDimensions(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}
