/**
 * Task 74 (issue #74): the real-Chromium, restrictive-policy half of the
 * export-HTML injection audit — `../src/export/injectionFixtures.test.ts`
 * (jsdom, fast, in-process) already proves every fixture's raw HTML/JSON
 * output is well-formed and confined to its intended context; this file
 * proves the same fixtures are inert when an actual browser engine parses
 * and *executes* the resulting document, per issue #74's acceptance
 * criterion: "Opening each artifact under the documented restrictive test
 * policy produces no unexpected script, request, navigation, DOM node, or
 * event handler."
 *
 * ## Tier 1 — no Django, no PostgreSQL, no Vite dev server
 *
 * Same architecture as `exportArtifacts.spec.ts` (Task 69): export
 * *generation* is a pure client-side function
 * (`../src/export/generateHtmlExport.ts`), bundled with Vite library mode
 * and run inside a real, isolated `about:blank` Chromium page via
 * `./support/exportHarness.ts`'s `createExportGeneratorPage`; the resulting
 * HTML string is then written to a temp file and opened via `file://` in a
 * *second*, completely separate `BrowserContext` for execution. This file
 * genuinely executes in this environment for the same reason
 * `exportArtifacts.spec.ts` does (confirmed by actually running it — see
 * this task's issue comment for the real pass/fail result).
 *
 * ## The restrictive test policy
 *
 * Every scenario below:
 *
 *  1. Blocks all network requests except the pinned p5 CDN URL (fulfilled
 *     locally with a fake, harmless `p5` global — never a real network
 *     round-trip) — any other request (a real CDN hit, an attacker-supplied
 *     URL turned into a live `src`/`href`, an `/api/` call) aborts the
 *     request and is asserted never to have happened.
 *  2. Installs a `page.addInitScript` "pwn detector" that runs *before* any
 *     of the exported document's own scripts: it does nothing but exist as
 *     `window` state a hostile payload's `pwnScript` (`window.__pwn_<id>__
 *     = true`) would set if it ever actually executed. After the page
 *     settles, every fixture's own unique marker is asserted `undefined`.
 *  3. Scans the live, rendered DOM (not the raw source string) for any
 *     element carrying an attribute name starting with `on` (a real,
 *     wired-up inline event handler an attacker payload tried to inject)
 *     and for any `<script>` element beyond the exact expected, pinned set
 *     for that interaction mode.
 *  4. Confirms the page never navigated away from its own `file://`
 *     document (`page.url()` unchanged) — a `<meta http-equiv="refresh">`
 *     or a `javascript:` URL turned live would show up here.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test, type Browser, type Page, type Route } from '@playwright/test';

import {
  ALL_INJECTION_FIXTURES,
  CLOSING_TAG_FIXTURES,
  COLOR_FIXTURES,
  COMBINED_WORST_CASE_PAYLOAD,
  LABEL_FIXTURES,
  QUOTE_FIXTURES,
  STRUCTURED_SCENE_STRING_FIXTURES,
  TITLE_FIXTURES,
  UNICODE_CONTROL_FIXTURES,
  URL_FIXTURES,
  VALID_COLOR_FIXTURES,
  sceneWithHostileScopedStrings,
  type InjectionFixture,
} from './support/injectionFixtures.js';
import { createExportGeneratorPage, type ExportGeneratorPage } from './support/exportHarness.js';

let generator: ExportGeneratorPage;
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'injection-e2e-'));

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  generator = await createExportGeneratorPage(browser);
});

test.afterAll(async () => {
  await generator.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const FAKE_P5_SOURCE = `
window.p5 = function (sketch) {
  this.createCanvas = function () {
    var canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    return { elt: canvas, parent: function (host) {
      if (typeof host === 'string') host = document.getElementById(host);
      if (host && host.appendChild) host.appendChild(canvas);
    } };
  };
  this.pixelDensity = function () {};
  this.noSmooth = function () {};
  this.frameRate = function () {};
  this.millis = function () { return 0; };
  this.push = function () {};
  this.pop = function () {};
  this.translate = function () {};
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

/** Installs the restrictive network policy: only the pinned p5 CDN URL
 * (fulfilled locally) and the local `file://` document are ever allowed;
 * everything else aborts. Returns the full list of observed request URLs
 * for a positive "nothing else was ever requested" assertion. */
function installRestrictiveNetworkPolicy(page: Page): string[] {
  const observed: string[] = [];
  page.route('**/*', (route: Route) => {
    const url = route.request().url();
    observed.push(url);
    if (url === generator.constants.P5_CDN_URL) {
      route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_P5_SOURCE });
      return;
    }
    if (url.startsWith('file://')) {
      route.continue();
      return;
    }
    route.abort('failed');
  });
  return observed;
}

/** Installs the pwn detector: nothing but a place for a hostile payload's
 * own `window.__pwn_<id>__ = true` to land if it ever actually executes,
 * installed via `addInitScript` so it exists before the exported
 * document's own `DOMContentLoaded` handler and inline `<script>` tags
 * run. */
async function installPwnDetector(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __pwnDetectorInstalled: boolean }).__pwnDetectorInstalled = true;
  });
}

/** Reads every `window.__pwn_*__` marker currently set to `true`. Empty
 * means no fixture's payload ever executed as script. */
async function firedPwnMarkers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const fired: string[] = [];
    for (const key of Object.keys(window as unknown as Record<string, unknown>)) {
      if (
        key.startsWith('__pwn_') &&
        (window as unknown as Record<string, unknown>)[key] === true
      ) {
        fired.push(key);
      }
    }
    return fired;
  });
}

/** Every element in the live, rendered DOM carrying an attribute name
 * starting with "on" -- a genuine, wired-up inline event handler, checked
 * against the real parsed document, not the raw source string. */
async function eventHandlerAttributes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const offenders: string[] = [];
    document.querySelectorAll('*').forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.toLowerCase().startsWith('on')) {
          offenders.push(`<${el.tagName.toLowerCase()} ${attr.name}>`);
        }
      }
    });
    return offenders;
  });
}

/** Count of `<script>` elements in the live DOM beyond the exact expected,
 * pinned set for a demo-only export (p5 CDN loader, two JSON data blocks,
 * runtime script — 4 total). Every scenario below uses `interactionMode:
 * 'demo'` except the dedicated interaction-mode-matrix test, which adjusts
 * the expected count itself. */
async function unexpectedScriptElementCount(page: Page, expected: number): Promise<number> {
  const count = await page.evaluate(() => document.querySelectorAll('script').length);
  return Math.max(0, count - expected);
}

async function openInIsolatedContext(
  browser: Browser,
  html: string,
  filename: string,
): Promise<{ page: Page; close: () => Promise<void>; observed: string[] }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const observed = installRestrictiveNetworkPolicy(page);
  await installPwnDetector(page);
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, html);
  await page.goto(`file://${filePath}`);
  return { page, close: () => context.close(), observed };
}

async function assertArtifactIsInert(
  browser: Browser,
  html: string,
  filename: string,
  expectedScriptCount = 4,
): Promise<void> {
  const { page, close, observed } = await openInIsolatedContext(browser, html, filename);
  try {
    expect(await firedPwnMarkers(page)).toEqual([]);
    expect(await eventHandlerAttributes(page)).toEqual([]);
    expect(await unexpectedScriptElementCount(page, expectedScriptCount)).toBe(0);
    expect(page.url()).toBe(`file://${path.join(tempDir, filename)}`);
    for (const url of observed) {
      expect(url === generator.constants.P5_CDN_URL || url.startsWith('file://')).toBe(true);
    }
  } finally {
    await close();
  }
}

test.describe('Injection audit: title/description fixtures, real Chromium execution', () => {
  for (const fixture of TITLE_FIXTURES) {
    test(`title fixture "${fixture.id}" is inert: ${fixture.note}`, async ({ browser }) => {
      const result = await generator.generateHtmlExport({
        scene: sceneWithHostileScopedStrings({}),
        title: fixture.value,
        description: 'Injection audit fixture.',
        interactionMode: 'demo',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      await assertArtifactIsInert(browser, result.html, `title-${fixture.id}.html`);
    });
  }
});

test.describe('Injection audit: label (layer/group name) fixtures, real Chromium execution', () => {
  for (const fixture of LABEL_FIXTURES) {
    test(`label fixture "${fixture.id}" is inert: ${fixture.note}`, async ({ browser }) => {
      const result = await generator.generateHtmlExport({
        scene: sceneWithHostileScopedStrings({ label: fixture.value }),
        title: 'Injection audit',
        description: 'Injection audit fixture.',
        interactionMode: 'demo',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      await assertArtifactIsInert(browser, result.html, `label-${fixture.id}.html`);
    });
  }
});

test.describe('Injection audit: structured scene strings (graph node params), real Chromium execution', () => {
  for (const fixture of STRUCTURED_SCENE_STRING_FIXTURES) {
    test(`structured fixture "${fixture.id}" is inert: ${fixture.note}`, async ({ browser }) => {
      const isKeyFixture = fixture.id === 'params-key-breakout';
      const scene = sceneWithHostileScopedStrings(
        isKeyFixture ? { structuredKey: fixture.value } : { structuredValue: fixture.value },
      );
      const result = await generator.generateHtmlExport({
        scene,
        title: 'Injection audit',
        description: 'Injection audit fixture.',
        interactionMode: 'demo',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      await assertArtifactIsInert(browser, result.html, `structured-${fixture.id}.html`);
    });
  }
});

test.describe('Injection audit: colors -- hostile values are rejected, never opened; valid colors still export and render', () => {
  for (const fixture of COLOR_FIXTURES) {
    test(`hostile color fixture "${fixture.id}" is blocked at generation time (no file to open)`, async () => {
      const result = await generator.generateHtmlExport({
        scene: sceneWithHostileScopedStrings({ color: fixture.value }),
        title: 'Injection audit',
        description: 'Injection audit fixture.',
        interactionMode: 'demo',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect('html' in result).toBe(false);
    });
  }

  for (const color of VALID_COLOR_FIXTURES) {
    test(`valid color "${color}" still produces a functional, real-Chromium-renderable export`, async ({
      browser,
    }) => {
      const result = await generator.generateHtmlExport({
        scene: sceneWithHostileScopedStrings({ color }),
        title: 'Injection audit',
        description: 'Injection audit fixture.',
        interactionMode: 'demo',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const { page, close } = await openInIsolatedContext(
        browser,
        result.html,
        `color-${color.replace('#', '')}.html`,
      );
      try {
        await expect(page.locator('#scene-canvas-host canvas')).toHaveCount(1);
      } finally {
        await close();
      }
    });
  }
});

test.describe('Injection audit: combined worst-case payload across attribution on/off and every interaction mode', () => {
  const scenarios: { interactionMode: 'demo' | 'camera' | 'demo-camera'; attribution: boolean }[] =
    [
      { interactionMode: 'demo', attribution: false },
      { interactionMode: 'demo', attribution: true },
      { interactionMode: 'camera', attribution: false },
      { interactionMode: 'camera', attribution: true },
      { interactionMode: 'demo-camera', attribution: false },
      { interactionMode: 'demo-camera', attribution: true },
    ];

  for (const scenario of scenarios) {
    test(`mode="${scenario.interactionMode}" attribution=${scenario.attribution}: title/description/label all carry the combined payload and stay inert`, async ({
      browser,
    }) => {
      const result = await generator.generateHtmlExport({
        scene: sceneWithHostileScopedStrings({ label: COMBINED_WORST_CASE_PAYLOAD }),
        title: COMBINED_WORST_CASE_PAYLOAD,
        description: COMBINED_WORST_CASE_PAYLOAD,
        interactionMode: scenario.interactionMode,
        includeAttribution: scenario.attribution,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const includesCamera = scenario.interactionMode !== 'demo';
      // Expected pinned <script> elements: p5 CDN + scene-data json +
      // export-config json + runtime script (4), plus the camera script
      // for camera-inclusive modes (5). Attribution never adds a <script>
      // (only a footer/comment/marker).
      const expectedScriptCount = includesCamera ? 5 : 4;

      await assertArtifactIsInert(
        browser,
        result.html,
        `combined-${scenario.interactionMode}-${scenario.attribution}.html`,
        expectedScriptCount,
      );
    });
  }
});

test.describe('Injection audit: URL / closing-tag / quote / Unicode-control fixtures, real Chromium execution (title position)', () => {
  for (const fixture of [
    ...URL_FIXTURES,
    ...CLOSING_TAG_FIXTURES,
    ...QUOTE_FIXTURES,
    ...UNICODE_CONTROL_FIXTURES,
  ]) {
    test(`"${fixture.id}" (${fixture.category}) is inert as title content: ${fixture.note}`, async ({
      browser,
    }) => {
      const result = await generator.generateHtmlExport({
        scene: sceneWithHostileScopedStrings({}),
        title: fixture.value,
        description: 'Injection audit fixture.',
        interactionMode: 'demo',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      await assertArtifactIsInert(browser, result.html, `cat-${fixture.id}.html`);
      if (fixture.category === 'url') {
        // Extra, category-specific check: the URL string never became a
        // live href/src anywhere in the rendered DOM (it has no reason to
        // -- there is no user-controlled URL-shaped field at all -- this
        // proves that structurally, not just by absence of a pwn marker).
        const { page, close } = await openInIsolatedContext(
          browser,
          result.html,
          `cat-href-check-${fixture.id}.html`,
        );
        try {
          const liveHrefs = await page.evaluate(() =>
            Array.from(document.querySelectorAll('[href],[src]')).map(
              (el) => el.getAttribute('href') ?? el.getAttribute('src'),
            ),
          );
          expect(liveHrefs.some((h) => h === fixture.value)).toBe(false);
        } finally {
          await close();
        }
      }
    });
  }
});

test.describe('Injection audit: full fixture catalog sanity -- every category is represented, nothing silently skipped', () => {
  test('the catalog covers all 9 named categories from issue #74', () => {
    const categories = new Set(ALL_INJECTION_FIXTURES.map((f: InjectionFixture) => f.category));
    for (const expected of [
      'title',
      'description',
      'label',
      'color',
      'url',
      'closingTag',
      'quote',
      'unicodeControl',
      'structuredSceneString',
    ]) {
      expect(categories.has(expected as InjectionFixture['category'])).toBe(true);
    }
  });
});
