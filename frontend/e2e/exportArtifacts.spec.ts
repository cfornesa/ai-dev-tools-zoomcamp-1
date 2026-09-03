/**
 * Task 69 (issue #69): export end-to-end tests, Tier 1 — the part of this
 * suite that needs **no Django, no PostgreSQL, and no Vite dev server**.
 *
 * ## Why this suite has two tiers, and why that split matters
 *
 * Every prior E2E suite in this repo (Tasks 65-68) needed a real running
 * Django + PostgreSQL backend because the thing under test — saving a
 * scene, restoring a version, publishing, remixing — only happens by
 * calling a Django endpoint. Export is structurally different:
 * `../src/export/generateHtmlExport.ts` and
 * `../src/export/generateSocialThumbnailZip.ts` (Tasks 56-59) are pure
 * client-side functions that take a scene document the browser already
 * has and return a string/Blob — no network call, no Django endpoint,
 * nothing server-side to fake or provision. That means the *generation and
 * execution* of an export artifact can be proven correct with only a real
 * Chromium instance and this repo's own `frontend/node_modules`, which is
 * exactly what this file does:
 *
 *  - **Generation** happens inside a real browser page, via the exact
 *    same `generateHtmlExport`/`generateSocialThumbnailZip` functions
 *    `ExportConfigDialog.tsx` calls — bundled with Vite's own
 *    library-mode build (`./support/exportHarness.ts`'s
 *    `createExportGeneratorPage`, see that module's doc comment for why
 *    generation happens in-browser rather than by importing the module
 *    directly into this Node-side test file).
 *  - **Execution** happens by writing the generated HTML to a temp file
 *    and loading it into a *second*, completely separate, isolated
 *    Chromium `BrowserContext` via a `file://` URL — proving the artifact
 *    works as a genuinely standalone file a user could double-click open,
 *    in a real browser engine, not just that it evaluates correctly
 *    inside jsdom (which
 *    `generateHtmlExportRuntime.test.ts`/`generateHtmlExportCameraRuntime.test.ts`,
 *    Tasks 56-57, already prove — this is a *stronger*, additional layer
 *    of confidence on top of that, never a replacement for it).
 *
 * This genuinely executes in this environment: it needs only a Chromium
 * binary (already installed for Tasks 65-68's suites) and this repo's own
 * `frontend/node_modules` — confirmed by actually running it; see this
 * task's issue comment for the real pass/fail result.
 *
 * The one thing this tier *cannot* prove is that `ExportConfigDialog.tsx`
 * itself is wired correctly — that opening the real dialog, picking a
 * historical version from a real project's real version history, and
 * clicking the real "Export" button produces the file this tier already
 * proved is correct. That's `exportConfigDialog.spec.ts`'s job (Tier 2) —
 * it needs the same real Django+PostgreSQL stack every prior E2E suite
 * needed, and is verified the same way those were introduced when they
 * cannot execute in this environment (statically — `--list`, typecheck,
 * selector review) per this repo's own established precedent.
 *
 * ## No real network access required
 *
 * A generated export's `<script src>` points at a real CDN
 * (`P5_CDN_URL`/`MEDIAPIPE_VISION_BUNDLE_CDN_URL`) — reaching out to the
 * real internet for that on every CI run would make this suite flaky and
 * non-deterministic (acceptance criterion: "runs deterministically in
 * CI"). Every test below intercepts exactly those CDN URLs with
 * `page.route` and fulfills them locally with a minimal fake
 * implementation (the same technique
 * `generateHtmlExportRuntime.test.ts`/`generateHtmlExportCameraRuntime.test.ts`
 * already use in jsdom, ported to a real page) — nothing here ever makes a
 * real network request, and every observed request is asserted to be
 * either the local `file://` document itself or one of those two exact,
 * intentionally-intercepted CDN URLs. That is also the literal mechanism
 * behind this suite's "runs without Django" acceptance criterion: no
 * request to any `/api/`, `/accounts/`, or `/health/` path is even
 * possible, since nothing here ever constructs one.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { expect, test, type Browser, type Page, type Route } from '@playwright/test';

import {
  assertNoLeaks,
  cleanupExportHarnessArtifacts,
  createExportGeneratorPage,
  exportFixtureScene,
  findUnpinnedDependencyScriptSrcs,
  historicalExportFixtureScene,
  INTERNAL_SCENE_ID_MARKER,
  leakProbeExtras,
  pngDimensions,
  writeTempArtifact,
  type ExportGeneratorPage,
} from './support/exportHarness.js';

let generator: ExportGeneratorPage;

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  generator = await createExportGeneratorPage(browser);
});

test.afterAll(async () => {
  await generator.close();
  cleanupExportHarnessArtifacts();
});

/** A minimal fake `p5` global, adapted from
 * `generateHtmlExportRuntime.test.ts`'s `installFakeP5` for a real browser
 * page rather than jsdom — implements only the p5 API surface the export
 * runtime script (`../src/export/standaloneRuntimeSource.ts`) actually
 * calls, so `<script src="P5_CDN_URL">` can be fulfilled locally instead
 * of reaching a real CDN. */
const FAKE_P5_SOURCE = `
window.p5 = function (sketch) {
  var offsetStack = [{ x: 0, y: 0 }];
  this.createCanvas = function () {
    var canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    return {
      elt: canvas,
      // Real p5's createCanvas().parent(host) reparents the canvas into
      // host -- standaloneRuntimeSource.ts relies on exactly this to move
      // the canvas into #scene-canvas-host, so the fake must actually do
      // it too (a no-op here would leave the canvas outside that host and
      // make "the export actually renders into its own canvas host"
      // unverifiable).
      parent: function (host) {
        if (typeof host === 'string') host = document.getElementById(host);
        if (host && host.appendChild) host.appendChild(canvas);
      },
    };
  };
  this.pixelDensity = function () {};
  this.noSmooth = function () {};
  this.frameRate = function () {};
  this.millis = function () { return 0; };
  this.push = function () { offsetStack.push(Object.assign({}, offsetStack[offsetStack.length - 1])); };
  this.pop = function () { offsetStack.pop(); };
  this.translate = function (dx, dy) {
    var top = offsetStack[offsetStack.length - 1];
    top.x += dx; top.y += dy;
  };
  this.rotate = function () {};
  this.radians = function (deg) { return (deg * Math.PI) / 180; };
  this.scale = function () {};
  this.noFill = function () {};
  this.fill = function () {};
  this.noStroke = function () {};
  this.stroke = function () {};
  this.strokeWeight = function () {};
  this.background = function () {};
  this.circle = function () {};
  this.rect = function () {};
  this.line = function () {};
  this.beginShape = function () {};
  this.vertex = function () {};
  this.endShape = function () {};
  this.randomSeed = function () {};
  this.noiseSeed = function () {};
  this.isLooping = function () { return true; };
  this.loop = function () {};
  this.noLoop = function () {};
  this.CLOSE = 'close';
  sketch(this);
  this.createCanvas();
  if (this.setup) this.setup();
  if (this.draw) this.draw();
};
`;

/** Installs a `page.route` handler that fulfills the p5 CDN URL with the
 * fake p5 global above (never a real network request), and records every
 * other request this page makes so a test can assert nothing else was
 * ever requested. */
function interceptCdnAndTrackRequests(
  page: Page,
  options: { allowCamera?: boolean } = {},
): string[] {
  const observed: string[] = [];
  page.route('**/*', (route: Route) => {
    const url = route.request().url();
    observed.push(url);
    if (url === generator.constants.P5_CDN_URL) {
      route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_P5_SOURCE });
      return;
    }
    if (options.allowCamera && url === generator.constants.MEDIAPIPE_VISION_BUNDLE_CDN_URL) {
      // Never actually exercised -- every camera test below installs
      // window.__exportCameraLoadVisionTasksModule before navigation
      // (see installCameraTestSeams), so the real dynamic import this URL
      // belongs to is never reached. Fulfilling defensively anyway so a
      // future regression that *does* reach it fails on an assertion
      // about the fake module, not a real, flaky network request.
      route.fulfill({ status: 200, contentType: 'application/javascript', body: 'export {};' });
      return;
    }
    if (url.startsWith('file://')) {
      route.continue();
      return;
    }
    // Anything else (a real CDN hit, an /api/ call, anything) is a bug --
    // fail loudly rather than silently letting it reach the network.
    route.abort('failed');
  });
  return observed;
}

/** Writes `html` to a temp file and navigates a fresh, isolated
 * `BrowserContext`'s page to it via `file://` — never `about:blank`'s
 * `page.setContent` (which can't hold a `<script src>` browsers actually
 * fetch) and never any app origin/dev server. */
async function openExportInIsolatedContext(
  page: Page,
  html: string,
  filename: string,
): Promise<void> {
  const { fileUrl } = writeTempArtifact(filename, html);
  await page.goto(fileUrl);
}

async function openExportPieceControls(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open piece controls menu' }).click();
  await page.getByRole('button', { name: 'Piece controls', exact: true }).click();
}

test.describe('HTML export: responsive piece action surface', () => {
  test('stacks labeled actions and confines scrolling to opened controls at desktop and mobile widths', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    interceptCdnAndTrackRequests(page);
    const result = await generator.generateHtmlExport({
      scene: exportFixtureScene(),
      title: 'Responsive standalone piece',
      description: 'Responsive standalone piece for browser QA.',
      interactionMode: 'demo',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    await openExportInIsolatedContext(page, result.html, 'responsive-actions.html');

    const menuToggle = page.getByRole('button', { name: 'Open piece controls menu' });
    await expect(menuToggle).toBeVisible();

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await menuToggle.click();

      const overlay = page.getByRole('dialog', { name: 'Piece actions' });
      await expect(overlay).toBeVisible();
      await expect(page.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Piece controls', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toBeVisible();

      const geometry = await page.evaluate(() => {
        const card = document.getElementById('piece-command-card');
        const actions = [...document.querySelectorAll('#piece-action-list > button')];
        const rect = (element: Element) => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        };
        return {
          card: card ? rect(card) : null,
          cardOverflow: card ? getComputedStyle(card).overflow : null,
          cardScrolls: card ? card.scrollHeight > card.clientHeight : true,
          actions: actions.map(rect),
          documentWidth: document.documentElement.scrollWidth,
          documentHeight: document.documentElement.scrollHeight,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        };
      });
      expect(geometry.card).not.toBeNull();
      expect(geometry.cardOverflow).toBe('visible');
      expect(geometry.cardScrolls).toBe(false);
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
      expect(geometry.documentHeight).toBeLessThanOrEqual(geometry.viewportHeight);
      for (const action of geometry.actions) {
        expect(action.left).toBeGreaterThanOrEqual(geometry.card!.left);
        expect(action.right).toBeLessThanOrEqual(geometry.card!.right);
        expect(action.top).toBeGreaterThanOrEqual(geometry.card!.top);
        expect(action.bottom).toBeLessThanOrEqual(geometry.card!.bottom);
      }
      for (let index = 1; index < geometry.actions.length; index += 1) {
        expect(geometry.actions[index]!.top).toBeGreaterThanOrEqual(
          geometry.actions[index - 1]!.bottom,
        );
      }

      await page.getByRole('button', { name: 'Piece controls', exact: true }).click();
      await expect(page.locator('#piece-controls-panel')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(overlay).toBeHidden();
    }

    await context.close();
  });
});

test.describe('3D ZIP export: responsive packaged command surface', () => {
  const scene3d = {
    schemaVersion: 1,
    documentType: 'scene3d',
    id: 'browser-3d-export-fixture',
    scene: { backgroundColor: '#101018' },
    camera: {
      position: { x: 0, y: 5, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
      near: 0.1,
      far: 1000,
    },
    lights: [{ id: 'sun', type: 'ambient', color: '#ffffff', intensity: 1 }],
    groups: [],
    objects: [
      {
        id: 'sphere',
        type: 'sphere',
        groupId: null,
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          opacity: 1,
        },
        material: { color: '#ff0000' },
        visible: true,
        radius: 1,
      },
    ],
    randomness: { seed: 1, enabled: false },
  };

  test('extracts Full and Non-Camera bundles and keeps their command dialog responsive', async ({
    page,
  }) => {
    await generator.page.route('**/*', (route) => {
      const url = route.request().url();
      if (url === generator.constants.THREE_CDN_URL) {
        return route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: '/* browser QA fake three runtime */',
        });
      }
      if (url.startsWith('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@')) {
        return route.fulfill({ status: 200, body: '/* browser QA fake MediaPipe asset */' });
      }
      if (url.startsWith('https://storage.googleapis.com/mediapipe-models/')) {
        return route.fulfill({ status: 200, body: '/* browser QA fake MediaPipe model */' });
      }
      return route.abort('failed');
    });

    for (const immersive of [false, true]) {
      for (const variant of ['full', 'non-camera'] as const) {
        if (variant === 'full') {
          await installCameraTestSeams(page, 'succeed');
          await page.addInitScript(() => {
            Object.defineProperty(window, 'isSecureContext', {
              value: true,
              configurable: true,
            });
          });
        }
        const result = await generator.generateScene3DBundle(
          scene3d,
          `Browser QA ${immersive ? 'immersive' : 'regular'} ${variant}`,
          variant,
          immersive,
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const zip = await JSZip.loadAsync(Buffer.from(result.zipBase64, 'base64'));
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'export-3d-e2e-'));
        try {
          for (const [name, entry] of Object.entries(zip.files)) {
            if (entry.dir) continue;
            const target = path.join(root, name);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, await entry.async('nodebuffer'));
          }
          await page.goto(`file://${path.join(root, 'index.html')}`);
          await expect(page.locator('meta[name="creatrweb-export-surface"]')).toHaveAttribute(
            'content',
            immersive ? 'immersive' : 'regular',
          );
          await expect(page.locator('body')).toHaveAttribute(
            'data-piece-surface',
            immersive ? 'immersive' : 'regular',
          );
          const menu = page.getByRole('button', { name: 'Open piece controls menu' });
          await menu.click();
          const dialog = page.getByRole('dialog', { name: 'Piece actions' });
          await expect(dialog).toBeVisible();
          await expect(dialog.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
          await expect(
            dialog.getByRole('button', { name: 'Piece controls', exact: true }),
          ).toBeVisible();
          await expect(dialog.getByRole('button', { name: 'Enter fullscreen' })).toBeVisible();
          if (variant === 'full') {
            const cameraHost = page.getByRole('group', { name: 'Camera controls' });
            await expect(cameraHost).toBeHidden();
            await dialog.getByRole('button', { name: 'Piece controls', exact: true }).click();
            await expect(cameraHost).toBeVisible();
            await expect(page.getByTestId('camera-enable')).toHaveText('Steer the piece');
            await expect(page.getByTestId('camera-enable')).toHaveAttribute(
              'aria-pressed',
              'false',
            );
            await page.getByTestId('camera-enable').click();
            await expect(page.getByTestId('camera-status')).toContainText(/camera is active/i);
            await expect(page.getByTestId('camera-stop')).toHaveText('Stop steering');
            await page.getByTestId('camera-stop').click();
            await expect(page.getByTestId('camera-status')).toContainText(/camera stopped/i);
          } else {
            await expect(page.getByRole('group', { name: 'Camera controls' })).toHaveCount(0);
          }
          const geometry = await dialog.evaluate((element) => {
            const card = element as HTMLElement;
            const rows = [...card.querySelectorAll('.piece-action-list > button')].map((row) => {
              const rect = row.getBoundingClientRect();
              return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
            });
            return {
              overflow: getComputedStyle(card).overflow,
              rows,
              width: innerWidth,
            };
          });
          // The command drawer is intentionally bounded and scrolls only while
          // open; this keeps the page itself free of a persistent scrollbar on
          // short desktop and mobile viewports.
          expect(geometry.overflow).toBe('auto');
          expect(
            geometry.rows.every((row) => row.left >= 16 && row.right <= geometry.width - 16),
          ).toBe(true);
          for (let index = 1; index < geometry.rows.length; index += 1) {
            expect(geometry.rows[index]!.top).toBeGreaterThanOrEqual(
              geometry.rows[index - 1]!.bottom,
            );
          }
          await page.keyboard.press('Escape');
          await expect(dialog).toBeHidden();
          await expect(menu).toBeFocused();
        } finally {
          fs.rmSync(root, { recursive: true, force: true });
        }
      }
    }
  });
});

test.describe('HTML export: latest and historical versions run in an isolated browser context, no Django', () => {
  test('a "latest version" export opens and runs, requesting only the pinned p5 CDN script -- never any /api/, /accounts/, or /health/ path', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const observed = interceptCdnAndTrackRequests(page);

    const scene = exportFixtureScene();
    const result = await generator.generateHtmlExport({
      scene,
      title: 'Latest version export',
      description: 'The current saved version.',
      interactionMode: 'demo',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await openExportInIsolatedContext(page, result.html, 'latest.html');

    await expect(page.getByRole('heading', { name: 'Latest version export' })).toBeVisible();
    await expect(page.locator('#scene-canvas-host canvas')).toHaveCount(1);

    for (const url of observed) {
      expect(url === generator.constants.P5_CDN_URL || url.startsWith('file://')).toBe(true);
    }
    expect(
      observed.some(
        (u) => u.includes('/api/') || u.includes('/accounts/') || u.includes('/health/'),
      ),
    ).toBe(false);

    await context.close();
  });

  test('a "historical version" export (a differently-shaped scene, standing in for an older saved version) opens and runs identically', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    interceptCdnAndTrackRequests(page);

    const historicalScene = historicalExportFixtureScene();
    const result = await generator.generateHtmlExport({
      scene: historicalScene,
      title: 'Historical version export',
      description: 'An older saved version, exported directly.',
      interactionMode: 'demo',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await openExportInIsolatedContext(page, result.html, 'historical.html');

    await expect(page.getByRole('heading', { name: 'Historical version export' })).toBeVisible();
    await expect(page.locator('#scene-canvas-host canvas')).toHaveCount(1);

    await context.close();
  });
});

test.describe('Interaction modes: demo-only, camera-only, and combined contain exactly the required controls/dependencies', () => {
  test('demo-only: demo controls present, no camera section, no camera script, exactly one external dependency', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    interceptCdnAndTrackRequests(page);

    const result = await generator.generateHtmlExport({
      scene: exportFixtureScene(),
      title: 'Demo only',
      description: 'Demo controls only.',
      interactionMode: 'demo',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Dependencies, checked against the raw source: exactly one external
    // script (p5), no camera module/URL anywhere.
    const externalScripts = [...result.html.matchAll(/<script[^>]*\bsrc=/gi)];
    expect(externalScripts).toHaveLength(1);
    expect(result.html).toContain(generator.constants.P5_CDN_URL);
    // The always-present stylesheet declares (unused, harmless) CSS rules
    // for #camera-controls-host regardless of mode -- checked against the
    // actual DOM element below instead of a raw substring match, which
    // the stylesheet alone would make a false positive.
    expect(result.html).not.toContain('<section id="camera-controls-host"');
    expect(result.html).not.toContain(generator.constants.MEDIAPIPE_VISION_BUNDLE_CDN_URL);

    await openExportInIsolatedContext(page, result.html, 'demo-only.html');
    await openExportPieceControls(page);
    await expect(page.locator('#piece-controls-panel')).toBeVisible();
    await expect(page.locator('#demo-controls-host')).toBeVisible();
    await expect(page.locator('#demo-controls-host button')).not.toHaveCount(0);
    await expect(page.locator('#camera-controls-host')).toHaveCount(0);
    await expect(page.getByTestId('camera-enable')).toHaveCount(0);

    await context.close();
  });

  test('camera-inclusive ("camera" mode): demo controls remain present (always rendered), camera section/script are added', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    interceptCdnAndTrackRequests(page, { allowCamera: true });

    const result = await generator.generateHtmlExport({
      scene: exportFixtureScene(),
      title: 'Camera mode',
      description: 'Camera-inclusive export.',
      interactionMode: 'camera',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html).toContain('camera-controls-host');
    // Runtime + camera module: still exactly one external dependency (p5
    // -- the MediaPipe bundle is loaded lazily via dynamic import at
    // click-time, never a static <script src>).
    const externalScripts = [...result.html.matchAll(/<script[^>]*\bsrc=/gi)];
    expect(externalScripts).toHaveLength(1);

    await openExportInIsolatedContext(page, result.html, 'camera-mode.html');
    await openExportPieceControls(page);
    await expect(page.locator('#demo-controls-host button')).not.toHaveCount(0);
    await expect(page.getByTestId('camera-enable')).toBeVisible();
    await expect(page.getByTestId('camera-stop')).toHaveCSS('display', 'none');

    await context.close();
  });

  test('combined ("demo-camera" mode): both demo and camera controls/dependencies are present together', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    interceptCdnAndTrackRequests(page, { allowCamera: true });

    const result = await generator.generateHtmlExport({
      scene: exportFixtureScene(),
      title: 'Demo + camera',
      description: 'Combined export.',
      interactionMode: 'demo-camera',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html).toContain('demo-controls-host');
    expect(result.html).toContain('camera-controls-host');

    await openExportInIsolatedContext(page, result.html, 'combined.html');
    await openExportPieceControls(page);
    await expect(page.locator('#demo-controls-host button')).not.toHaveCount(0);
    await expect(page.getByTestId('camera-enable')).toBeVisible();

    await context.close();
  });
});

// ---------------------------------------------------------------------
// Camera lifecycle in a real browser: starts inactive, mocked denial,
// stop, retry, and fallback all work -- the same real getUserMedia-mocking
// technique publishingAndRemix.spec.ts (Task 68) uses, plus the
// window.__exportCameraLoadVisionTasksModule test seam
// generateHtmlExportCameraRuntime.test.ts (Task 57) already exposes,
// ported from jsdom to a real Chromium page via page.addInitScript (runs
// before any of the page's own scripts, exactly like jsdom test setup runs
// before eval'ing the runtime source).
// ---------------------------------------------------------------------

async function cameraModeExportHtml(): Promise<string> {
  const result = await generator.generateHtmlExport({
    scene: exportFixtureScene(),
    title: 'Camera lifecycle fixture',
    description: 'Used by the camera lifecycle scenarios.',
    interactionMode: 'demo-camera',
  });
  if (!result.ok) throw new Error(`unexpected: ${result.reasons.join(' ')}`);
  return result.html;
}

/** Installs the fake MediaPipe module + fake getUserMedia + a real-enough
 * `<video>` shim, entirely via `page.addInitScript` so it exists before
 * the exported page's own `DOMContentLoaded` handler runs -- mirrors
 * `generateHtmlExportCameraRuntime.test.ts`'s
 * `installFakeMediaPipeModule`/`mockVideoReadyState`, ported to a real
 * page. */
async function installCameraTestSeams(
  page: Page,
  behavior: 'deny' | 'missing-device' | 'unsupported' | 'succeed',
): Promise<void> {
  await page.addInitScript((behaviorArg: string) => {
    if (behaviorArg === 'unsupported') {
      // Plain assignment to navigator.mediaDevices silently no-ops in a
      // real browser (it's a non-configurable accessor on the prototype
      // in most engines) -- Object.defineProperty on the instance is
      // required to actually shadow it, exactly like the other branches
      // below already do for the same reason.
      Object.defineProperty(window.navigator, 'mediaDevices', {
        value: undefined,
        configurable: true,
      });
      return;
    }

    const getUserMedia =
      behaviorArg === 'succeed'
        ? () =>
            Promise.resolve({
              getTracks: () => [{ stop: () => {} }],
            })
        : () => {
            const name = behaviorArg === 'missing-device' ? 'NotFoundError' : 'NotAllowedError';
            const error = new Error('mocked failure');
            (error as unknown as { name: string }).name = name;
            return Promise.reject(error);
          };
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });

    if (behaviorArg === 'succeed') {
      // A real browser's <video>.srcObject setter validates its argument
      // is a genuine MediaStream/MediaSource/Blob and throws otherwise --
      // unlike jsdom, which leaves it as a plain, unvalidated property.
      // The fake stream getUserMedia resolves with above is not a real
      // MediaStream, so the native setter must be replaced with a
      // permissive one (matching jsdom's own leniency) for the pipeline
      // to proceed past stream acquisition without throwing.
      const storage = new WeakMap<HTMLMediaElement, unknown>();
      Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
        configurable: true,
        get(this: HTMLMediaElement) {
          return storage.get(this);
        },
        set(this: HTMLMediaElement, value: unknown) {
          storage.set(this, value);
        },
      });
      HTMLMediaElement.prototype.play = () => Promise.resolve();
      HTMLMediaElement.prototype.pause = () => {};
      Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
        configurable: true,
        get: () => 4,
      });

      const fakeRecognizer = {
        recognizeForVideo: () => ({ landmarks: [], gestures: [], handedness: [] }),
        close: () => {},
      };
      // @ts-expect-error -- test-only global shape, matching the seam
      // standaloneCameraSource.ts itself documents.
      window.__exportCameraLoadVisionTasksModule = () =>
        Promise.resolve({
          FilesetResolver: { forVisionTasks: () => Promise.resolve({}) },
          GestureRecognizer: { createFromOptions: () => Promise.resolve(fakeRecognizer) },
        });
    }
  }, behavior);
}

test.describe('Camera lifecycle: starts inactive; mocked denial, stop, retry, and fallback', () => {
  test('starts inactive: steering is off, Stop is hidden, no getUserMedia call before any click', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    interceptCdnAndTrackRequests(page, { allowCamera: true });
    await installCameraTestSeams(page, 'succeed');
    await openExportInIsolatedContext(
      page,
      await cameraModeExportHtml(),
      'lifecycle-inactive.html',
    );
    await openExportPieceControls(page);

    await expect(page.getByTestId('camera-status')).toHaveText('');
    await expect(page.getByTestId('camera-stop')).toHaveCSS('display', 'none');
    await expect(page.getByTestId('camera-enable')).toBeVisible();
    await expect(page.getByTestId('camera-enable')).toHaveText('Steer the piece');
    await expect(page.getByTestId('camera-enable')).toHaveAttribute('aria-pressed', 'false');

    await context.close();
  });

  test('mocked permission denial: shows the denial message, offers Retry, and leaves demo controls usable', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    interceptCdnAndTrackRequests(page, { allowCamera: true });
    await installCameraTestSeams(page, 'deny');
    await openExportInIsolatedContext(page, await cameraModeExportHtml(), 'lifecycle-denied.html');
    await openExportPieceControls(page);

    await page.getByTestId('camera-enable').click();
    await expect(page.getByTestId('camera-error')).toContainText(/camera access was denied/i);
    await expect(page.getByTestId('camera-enable')).toHaveText('Retry steering');

    const demoButtons = page.locator('#demo-controls-host button');
    await expect(demoButtons.first()).toBeVisible();
    await expect(demoButtons.first()).toBeEnabled();

    await context.close();
  });

  test('mocked missing-device fallback: shows the no-camera-found message', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    interceptCdnAndTrackRequests(page, { allowCamera: true });
    await installCameraTestSeams(page, 'missing-device');
    await openExportInIsolatedContext(page, await cameraModeExportHtml(), 'lifecycle-missing.html');
    await openExportPieceControls(page);

    await page.getByTestId('camera-enable').click();
    await expect(page.getByTestId('camera-error')).toContainText(/no camera was found/i);

    await context.close();
  });

  test('mocked unsupported browser (no navigator.mediaDevices): shows the unsupported message, never calls getUserMedia', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    interceptCdnAndTrackRequests(page, { allowCamera: true });
    await installCameraTestSeams(page, 'unsupported');
    await openExportInIsolatedContext(
      page,
      await cameraModeExportHtml(),
      'lifecycle-unsupported.html',
    );
    await openExportPieceControls(page);

    await page.getByTestId('camera-enable').click();
    await expect(page.getByTestId('camera-error')).toContainText(/doesn't support/i);

    await context.close();
  });

  test('successful steering reaches "active", Stop steering tears it down, and Retry can succeed', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    interceptCdnAndTrackRequests(page, { allowCamera: true });
    await installCameraTestSeams(page, 'succeed');
    await openExportInIsolatedContext(page, await cameraModeExportHtml(), 'lifecycle-active.html');
    await openExportPieceControls(page);

    await page.getByTestId('camera-enable').click();
    await expect(page.getByTestId('camera-status')).toContainText(/camera is active/i);
    await expect(page.getByTestId('camera-stop')).toBeVisible();
    await expect(page.getByTestId('camera-stop')).toHaveText('Stop steering');
    await expect(page.getByTestId('camera-stop')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('camera-enable')).toHaveCSS('display', 'none');

    await page.getByTestId('camera-stop').click();
    await expect(page.getByTestId('camera-status')).toContainText(/camera stopped/i);
    await expect(page.getByTestId('camera-enable')).toBeVisible();
    await expect(page.getByTestId('camera-enable')).toHaveText('Steer the piece');
    await expect(page.getByTestId('camera-enable')).toHaveAttribute('aria-pressed', 'false');

    await context.close();
  });

  // Task 73 (issue #73), privacy audit acceptance criterion 1: "Browser
  // network capture during editor, public viewer, thumbnail, and export
  // camera flows contains no video frames or frame-derived biometric
  // payloads." Every prior camera-lifecycle test above already reaches
  // "active" and runs `installCameraTestSeams('succeed')`'s fake
  // `recognizeForVideo` (called once per `requestAnimationFrame` tick,
  // exactly like the real `standaloneCameraSource.ts` pipeline), but none
  // of them capture and assert on `observed` afterward -- a passing test
  // only proves no *illegal* request was attempted strongly enough to
  // trip `route.abort('failed')` on this run, not that this suite ever
  // produced positive, recorded evidence of the full request list for the
  // network-capture criterion. This test closes that gap: it drives the
  // camera through several real animation-frame ticks while active (so
  // `recognizeForVideo`/landmark processing genuinely runs repeatedly,
  // not just once), then asserts the complete captured request list is
  // still nothing but the two pinned CDN URLs (p5, MediaPipe) and the
  // local `file://` document -- structurally proving that a real,
  // multi-frame hand-tracking session never emitted a single network
  // request carrying a video frame, image blob, or landmark/gesture JSON
  // payload, because every such request would have been captured in
  // `observed` and none was.
  test('network capture during active multi-frame tracking contains no video frame or landmark payload', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const observed = interceptCdnAndTrackRequests(page, { allowCamera: true });
    await installCameraTestSeams(page, 'succeed');
    await openExportInIsolatedContext(
      page,
      await cameraModeExportHtml(),
      'lifecycle-network-capture.html',
    );
    await openExportPieceControls(page);

    await page.getByTestId('camera-enable').click();
    await expect(page.getByTestId('camera-status')).toContainText(/camera is active/i);

    // Let several requestAnimationFrame ticks elapse while active so the
    // fake recognizer's recognizeForVideo (and the EMA/pinch/gesture
    // signal derivation that consumes its output) actually runs
    // repeatedly, the same way a real multi-second camera session would.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          let ticks = 0;
          function tick() {
            ticks += 1;
            if (ticks >= 10) {
              resolve();
            } else {
              window.requestAnimationFrame(tick);
            }
          }
          window.requestAnimationFrame(tick);
        }),
    );

    await page.getByTestId('camera-stop').click();
    await expect(page.getByTestId('camera-status')).toContainText(/camera stopped/i);

    // Evidence: the complete request list captured across the whole
    // active-tracking session is exactly the two pinned CDN URLs (fetched
    // once each, at startup) plus the local file:// document -- nothing
    // else was ever requested while landmarks were being derived every
    // frame.
    expect(observed.length).toBeGreaterThan(0);
    for (const url of observed) {
      const isAllowed =
        url === generator.constants.P5_CDN_URL ||
        url === generator.constants.MEDIAPIPE_VISION_BUNDLE_CDN_URL ||
        url.startsWith('file://');
      expect(isAllowed).toBe(true);
    }
    // No request MIME/URL shape ever resembles an image/video upload or a
    // landmark/gesture JSON payload (a data: URL, a blob: URL, or any
    // path containing common upload/telemetry markers).
    expect(
      observed.some(
        (u) =>
          u.startsWith('data:') ||
          u.startsWith('blob:') ||
          u.includes('/api/') ||
          u.includes('upload') ||
          u.includes('landmark') ||
          u.includes('frame'),
      ),
    ).toBe(false);

    await context.close();
  });
});

test.describe('Attribution on/off: asserted in both rendered DOM and raw source text', () => {
  test('attribution on: visible footer in the DOM, plus the HTML comment and version marker in the raw source', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    interceptCdnAndTrackRequests(page);

    const result = await generator.generateHtmlExport({
      scene: exportFixtureScene(),
      title: 'Attribution on',
      description: 'Attribution enabled.',
      interactionMode: 'demo',
      includeAttribution: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Source-text assertions.
    expect(result.html).toContain('Created with');
    expect(result.html).toMatch(/<!-- Created with .* -->/);
    expect(result.html).toMatch(/<!-- export-tool-version: \d+ -->/);

    // Rendered-DOM assertions.
    await openExportInIsolatedContext(page, result.html, 'attribution-on.html');
    await expect(page.locator('#export-attribution')).toBeVisible();
    await expect(page.locator('#export-attribution')).toContainText('Created with');
    await expect(page.locator('#export-attribution a')).toHaveAttribute('target', '_blank');

    await context.close();
  });

  test('attribution off: no footer in the DOM, and none of the attribution source markers appear', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    interceptCdnAndTrackRequests(page);

    const result = await generator.generateHtmlExport({
      scene: exportFixtureScene(),
      title: 'Attribution off',
      description: 'Attribution disabled (the default).',
      interactionMode: 'demo',
      includeAttribution: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html).not.toContain('export-attribution');
    expect(result.html).not.toMatch(/<!-- Created with .* -->/);
    expect(result.html).not.toMatch(/<!-- export-tool-version: \d+ -->/);

    await openExportInIsolatedContext(page, result.html, 'attribution-off.html');
    await expect(page.locator('#export-attribution')).toHaveCount(0);

    await context.close();
  });
});

test.describe('Content-exclusion scanning: internal ids, prompts, history, creator identity, drafts, provenance, camera frames, unpinned dependencies', () => {
  test("generateHtmlExport output never contains the scene's own internal id or any excess/mistakenly-attached internal field", async () => {
    const scene = exportFixtureScene();
    // GenerateHtmlExportInput's own type has no field for any of these --
    // attaching them to the object actually passed at runtime (which
    // page.evaluate serializes as plain JSON, bypassing any compile-time
    // excess-property check entirely) proves, against the real function,
    // that none of them can leak -- not just that the type doesn't
    // declare them.
    const extras = leakProbeExtras();
    const supersetInput = {
      scene,
      title: 'Leak scan fixture',
      description: 'Used only for the internal-data exclusion scan.',
      interactionMode: 'demo-camera' as const,
      includeAttribution: true,
      ...extras,
    };
    const result = await generator.generateHtmlExport(supersetInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    assertNoLeaks(result.html, extras);
    // The scene's own top-level id is stripped by
    // sceneExportStripping.ts -- assert it directly too (also covered by
    // extras.internalSceneId above, kept explicit for a precise failure
    // message if stripping regresses).
    expect(result.html).not.toContain(INTERNAL_SCENE_ID_MARKER);
    expect(scene.id).toBe(INTERNAL_SCENE_ID_MARKER); // sanity: the fixture really set it
  });

  test('no unpinned CDN dependency: every CDN <script src> names an exact version, never @latest or unversioned', async () => {
    for (const interactionMode of ['demo', 'camera', 'demo-camera'] as const) {
      const result = await generator.generateHtmlExport({
        scene: exportFixtureScene(),
        title: 'Dependency pin scan',
        description: 'Checked for every interaction mode.',
        interactionMode,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(findUnpinnedDependencyScriptSrcs(result.html)).toEqual([]);
    }

    // The camera module's dynamically-imported MediaPipe bundle/model URLs
    // (never a static <script src>, so the scan above can't see them) are
    // still checked here directly against the same pinned-version pattern.
    const cameraResult = await generator.generateHtmlExport({
      scene: exportFixtureScene(),
      title: 'Camera dependency pin scan',
      description: 'Checks the dynamically-imported MediaPipe bundle URL.',
      interactionMode: 'camera',
    });
    expect(cameraResult.ok).toBe(true);
    if (!cameraResult.ok) return;
    expect(cameraResult.html).toMatch(/@mediapipe\/tasks-vision@\d+\.\d+\.\d+\//);
    expect(cameraResult.html).not.toMatch(/@mediapipe\/tasks-vision@latest\b/);
  });

  test('no captured camera frame ever appears in an exported artifact (structural: no data: URL of any kind anywhere in the source)', async () => {
    const result = await generator.generateHtmlExport({
      scene: exportFixtureScene(),
      title: 'Camera frame scan',
      description: 'Camera-inclusive export, scanned for embedded frame data.',
      interactionMode: 'demo-camera',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).not.toMatch(/data:image\//i);
    expect(result.html).not.toMatch(/data:video\//i);
  });
});

test.describe('ZIP export: real-browser Canvas 2D capture, exactly two root files, 1200x630 artwork-only PNG', () => {
  test("generateSocialThumbnailZip, run against a real Chromium Canvas 2D context (not jsdom's canvas polyfill), produces exactly index.html + thumbnail.png at the root", async () => {
    const scene = exportFixtureScene();
    const zipBase64 = await generator.page.evaluate(async (sceneArg) => {
      const harness = (
        window as unknown as {
          __exportHarness: {
            generateSocialThumbnailZip: (
              input: unknown,
            ) => Promise<
              { ok: true; zipBlob: Blob; filename: string } | { ok: false; reasons: string[] }
            >;
          };
        }
      ).__exportHarness;
      const result = await harness.generateSocialThumbnailZip({
        scene: sceneArg,
        title: 'ZIP export fixture',
        description: 'Bundled and run in a real browser Canvas 2D context.',
        interactionMode: 'demo',
        includeAttribution: false,
      });
      if (!result.ok) throw new Error(`ZIP generation blocked: ${result.reasons.join(' ')}`);
      const buffer = await result.zipBlob.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    }, scene);

    const zipBytes = Buffer.from(zipBase64, 'base64');
    const { filePath } = writeTempArtifact('export.zip', zipBytes);
    expect(fs.existsSync(filePath)).toBe(true);

    const zip = await JSZip.loadAsync(zipBytes);
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(['index.html', 'thumbnail.png']);
    for (const name of names) {
      expect(zip.files[name].dir).toBe(false);
    }

    const pngBuffer = await zip.file('thumbnail.png')!.async('nodebuffer');
    const dims = pngDimensions(new Uint8Array(pngBuffer));
    expect(dims).toEqual({ width: 1200, height: 630 });

    // Artwork-only: the same content-exclusion scan applied to the bundled
    // index.html entry, and confirmed the PNG is meaningfully larger than
    // an empty/blank placeholder (a real capture, not a stub).
    const indexHtml = await zip.file('index.html')!.async('string');
    assertNoLeaks(indexHtml, leakProbeExtras());
    expect(pngBuffer.byteLength).toBeGreaterThan(200);
  });
});
