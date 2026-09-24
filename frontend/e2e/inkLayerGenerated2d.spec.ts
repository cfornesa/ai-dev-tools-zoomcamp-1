/**
 * Issue #776: an owner draws on a generated 2D piece through a separate ink layer. The generated source is
 * never edited: Confirm saves a NEW version whose source is identical and whose `ink` is a validated
 * drawing document, and that ink is composited over the sandboxed piece on the regular viewer, the embed,
 * the immersive viewer, screenshots, and the ZIP export. Replaces the fixed-snippet #667 spec.
 */
import fs from 'node:fs';

import JSZip from 'jszip';
import { expect, test, type Page } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const SOURCES = {
  canvas2d:
    '<canvas id="art-piece-canvas" width="320" height="240"></canvas><script>var c=document.getElementById("art-piece-canvas");var x=c.getContext("2d");x.fillStyle="#172554";x.fillRect(0,0,320,240);</script>',
  svg: '<svg id="art-piece-svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#172554"/></svg>',
  p5js: 'window.sketch = (p) => { p.setup = () => { p.createCanvas(320, 240); }; p.draw = () => { p.background(23, 37, 84); }; };',
  c2js: "window.sketch = ({ canvas, startFrame }) => { const context = canvas.getContext('2d'); startFrame(() => { context.fillStyle = '#172554'; context.fillRect(0, 0, canvas.width, canvas.height); }); };",
  'c2js-interactive':
    "window.sketch = ({ canvas, startFrame }) => { const context = canvas.getContext('2d'); startFrame(() => { context.fillStyle = '#172554'; context.fillRect(0, 0, canvas.width, canvas.height); }); };",
} as const;

type Engine = keyof typeof SOURCES;
const ENGINES = Object.keys(SOURCES) as Engine[];
const HAS_IMMERSIVE: Engine[] = ['canvas2d', 'svg'];

async function drawStroke(page: Page) {
  const canvas = page.getByTestId('ink-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const at = (fx: number, fy: number) => ({
    x: box.x + box.width * fx,
    y: box.y + box.height * fy,
  });
  const from = at(0.15, 0.3);
  const to = at(0.85, 0.7);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i += 1) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10);
  }
  await page.mouse.up();
}

/** True when the sandboxed piece shows the ink overlay with a real, on-screen size. */
async function overlayVisible(page: Page, frameTitle: string) {
  const overlay = page
    .frameLocator(`iframe[title="${frameTitle}"]`)
    .locator('#art-piece-ink-overlay');
  await expect(overlay).toHaveCount(1);
  await expect
    .poll(async () => ((await overlay.boundingBox())?.width ?? 0) > 100, { timeout: 8000 })
    .toBe(true);
}

/** Counts pixels near the ink colour (#1d4ed8) in a PNG file. */
async function inkPixelsInPng(page: Page, path: string) {
  const base64 = fs.readFileSync(path).toString('base64');
  return page.evaluate(async (data) => {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = `data:image/png;base64,${data}`;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let hits = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (
        Math.abs(px[i]! - 29) < 14 &&
        Math.abs(px[i + 1]! - 78) < 14 &&
        Math.abs(px[i + 2]! - 216) < 14
      )
        hits += 1;
    }
    return hits;
  }, base64);
}

test.describe('Generated 2D ink layer (#776)', () => {
  const fixtures = requireE2EFixtures();

  for (const engine of ENGINES) {
    test(`${engine}: draw, confirm, and see the ink on every surface`, async ({
      page,
      context,
    }, testInfo) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1280, height: 900 });
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const profile = (await (await apiGet(context, '/api/account/profile/')).json()) as {
        handle: string;
      };
      const slug = `ink-2d-${engine}-${Date.now().toString(36)}`;
      const created = await apiPost(context, '/api/art-pieces/', {
        title: `Ink ${engine} fixture`,
        description: 'Ink layer fixture.',
        prompt: `An ${engine} ink fixture`,
        engine,
        public_slug: slug,
        capabilities: { screenshot: true, download: true, immersive: true },
        source: SOURCES[engine],
      });
      expect(created.status()).toBe(201);
      const piece = (await created.json()) as { public_id: string };

      // Draw: the piece freezes, the ink editor opens with the requested tool.
      await page.goto(`/users/@${profile.handle}/edit/${slug}`);
      await expect(page.getByRole('heading', { name: `Edit Ink ${engine} fixture` })).toBeVisible();
      await page.getByTestId('art-piece-editor-tool-freehand-draw').click();
      await expect(page.getByTestId('ink-editor')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('ink-frozen-indicator')).toBeVisible();
      await expect(page.getByTestId('ink-tool-pen')).toHaveAttribute('aria-checked', 'true');
      await drawStroke(page);
      await page.screenshot({ path: testInfo.outputPath(`${engine}-drawing.png`) });
      await page.getByTestId('ink-confirm').click();
      await expect(page.getByTestId('ink-editor')).toHaveCount(0);

      // Saved as a new version with IDENTICAL source and a validated ink document.
      const versions = (await (
        await apiGet(context, `/api/art-pieces/${piece.public_id}/versions/`)
      ).json()) as Array<{
        sequence: number;
        source: string;
        ink: { width: number; height: number; shapes: Array<{ type: string }> } | null;
      }>;
      expect(versions).toHaveLength(2);
      const v1 = versions.find((v) => v.sequence === 1)!;
      const v2 = versions.find((v) => v.sequence === 2)!;
      expect(v2.source).toBe(v1.source);
      expect(v1.ink).toBeNull();
      expect(v2.ink?.shapes).toHaveLength(1);
      expect(v2.ink?.shapes[0]!.type).toBe('path');

      // The editor preview shows the ink over the piece.
      await overlayVisible(page, 'Art piece with ink layer');
      await page.screenshot({ path: testInfo.outputPath(`${engine}-editor.png`) });

      // Publish, then the regular, embed, and (where supported) immersive surfaces show it.
      expect(
        (
          await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, { status: 'published' })
        ).status(),
      ).toBe(200);
      await page.goto(`/users/@${profile.handle}/pieces/${slug}`);
      await overlayVisible(page, 'Art piece preview');
      await page.screenshot({ path: testInfo.outputPath(`${engine}-regular.png`) });

      // Screenshot composites the ink into the captured image.
      const shot = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Take screenshot' }).click();
      const shotPath = (await (await shot).path())!;
      expect(await inkPixelsInPng(page, shotPath)).toBeGreaterThan(200);

      // ZIP export carries the ink overlay.
      await page.getByRole('button', { name: 'Open download menu' }).click();
      const download = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: 'Download Full ZIP' }).click();
      const zip = await JSZip.loadAsync(fs.readFileSync((await (await download).path())!));
      const indexHtml = await zip.files['index.html']!.async('string');
      expect(indexHtml).toContain('id="art-piece-ink-overlay"');

      await page.goto(`/embed/art-pieces/${piece.public_id}`);
      await overlayVisible(page, 'Art piece preview');
      if (HAS_IMMERSIVE.includes(engine)) {
        await page.goto(`/users/@${profile.handle}/immersive/${slug}`);
        await overlayVisible(page, 'Immersive art piece preview');
        await page.screenshot({ path: testInfo.outputPath(`${engine}-immersive.png`) });
      }
    });
  }

  test('invalid ink is refused by the API', async ({ page, context }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Ink refusal fixture',
      description: 'Ink refusal.',
      prompt: 'ink refusal',
      engine: 'canvas2d',
      source: SOURCES.canvas2d,
    });
    const piece = (await created.json()) as { public_id: string };
    const rejected = await apiPost(context, `/api/art-pieces/${piece.public_id}/versions/`, {
      source: SOURCES.canvas2d,
      generation_metadata: { ink: { width: 1, height: 1, shapes: 'nope' } },
    });
    expect(rejected.status()).toBe(400);
  });
});
