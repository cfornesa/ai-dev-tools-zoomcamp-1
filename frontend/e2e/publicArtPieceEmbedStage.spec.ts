import { expect, test, type TestInfo } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const fixtures = [
  {
    id: 'ratio-4-3',
    engine: 'canvas2d',
    source:
      '<canvas id="embed-stage-canvas" width="320" height="240"></canvas>' +
      '<script>const canvas = document.querySelector("#embed-stage-canvas");' +
      'const context = canvas.getContext("2d"); context.fillStyle = "#172554";' +
      'context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = "#fbbf24";' +
      'context.fillRect(32, 32, 64, 64);</script>',
  },
  {
    id: 'interactive',
    engine: 'c2js-interactive',
    source:
      "window.sketch = ({ canvas, startFrame }) => { const context = canvas.getContext('2d'); " +
      "canvas.addEventListener('pointermove', (event) => { canvas.dataset.pointerX = String(event.offsetX); }); " +
      "startFrame(() => { context.fillStyle = '#172554'; context.fillRect(0, 0, canvas.width, canvas.height); " +
      "context.fillStyle = '#fbbf24'; context.fillRect(Number(canvas.dataset.pointerX || 80), 40, 60, 60); }); };",
  },
] as const;

test('chrome-less embeds preserve stage ratio and put phone controls below artwork', async ({
  browser,
}, testInfo: TestInfo) => {
  test.setTimeout(240_000);
  const fixturesForRun = requireE2EFixtures();
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await loginViaUI(ownerPage, fixturesForRun.owner.email, fixturesForRun.password);
  const runId = Date.now().toString(36);
  const pieceIds = new Map<string, string>();

  for (const fixture of fixtures) {
    const created = await apiPost(ownerContext, '/api/art-pieces/', {
      title: `Embed stage ${fixture.id}`,
      description: 'Published fixture for anonymous embed stage geometry.',
      prompt: `Embed stage fixture ${fixture.id}`,
      engine: fixture.engine,
      public_slug: `embed-stage-${runId}-${fixture.id}`,
      capabilities: { screenshot: true, fullscreen: true },
      generation_metadata: { aspect_ratio: '4:3', canvas: { width: 320, height: 240 } },
      source: fixture.source,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(ownerContext, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);
    pieceIds.set(fixture.id, piece.public_id);
  }

  const anonymousContext = await browser.newContext();
  const page = await anonymousContext.newPage();
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const fixture of fixtures) {
      await page.goto(`/embed/art-pieces/${pieceIds.get(fixture.id)}`);
      await expect(page.getByRole('banner')).toHaveCount(0);
      const stage = page.getByRole('region', { name: 'Art piece stage' });
      const iframe = page.getByTitle('Art piece preview');
      const toolbarRow = page.getByTestId('regular-piece-toolbar-row');
      await expect(stage).toBeVisible();
      await expect(iframe).toBeVisible();
      await expect(toolbarRow.getByRole('toolbar', { name: 'Piece actions' })).toBeVisible();

      const geometry = await page.evaluate(() => {
        const stage = document.querySelector<HTMLElement>('.public-art-piece-stage')!;
        const iframe = stage.querySelector('iframe')!;
        const row = document.querySelector<HTMLElement>('.public-art-piece-toolbar-row')!;
        const stageBox = stage.getBoundingClientRect();
        const frameBox = iframe.getBoundingClientRect();
        const rowBox = row.getBoundingClientRect();
        return {
          stageAspectRatio: getComputedStyle(stage).aspectRatio,
          stageMinHeight: getComputedStyle(stage).minHeight,
          frame: {
            left: frameBox.left,
            right: frameBox.right,
            top: frameBox.top,
            bottom: frameBox.bottom,
            width: frameBox.width,
            height: frameBox.height,
          },
          stage: { top: stageBox.top, bottom: stageBox.bottom },
          row: { top: rowBox.top, bottom: rowBox.bottom },
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      });

      if (viewport.width <= 700) {
        expect(geometry.documentWidth).toBeLessThanOrEqual(viewport.width);
        expect(geometry.row.top).toBeGreaterThanOrEqual(geometry.frame.bottom);
        if (fixture.engine === 'canvas2d') {
          expect(Math.abs(geometry.frame.width / geometry.frame.height - 4 / 3)).toBeLessThan(0.02);
          expect(geometry.stageAspectRatio).not.toBe('auto');
        } else {
          expect(geometry.frame.height).toBeGreaterThanOrEqual(300);
          expect(geometry.stageAspectRatio).toBe('auto');
          await expect(stage).toHaveAttribute('data-visitor-drawing', 'true');
          await expect(page.getByRole('group', { name: 'Visitor drawing' })).toBeVisible();
        }

        const targets = toolbarRow.locator('button:visible:not(.sr-only), a:visible:not(.sr-only)');
        for (let index = 0; index < (await targets.count()); index += 1) {
          const box = await targets.nth(index).boundingBox();
          expect(box).not.toBeNull();
          expect(box!.width).toBeGreaterThanOrEqual(44);
          expect(box!.height).toBeGreaterThanOrEqual(44);
        }
      } else {
        expect(geometry.stageAspectRatio).toBe('4 / 3');
        expect(Math.abs(geometry.frame.width / geometry.frame.height - 4 / 3)).toBeLessThan(0.02);
        expect(geometry.row.top).toBeLessThanOrEqual(geometry.stage.bottom);
        expect(geometry.row.bottom).toBeLessThanOrEqual(geometry.stage.bottom);
      }

      await page.screenshot({
        path: testInfo.outputPath(
          `embed-stage-${fixture.id}-${viewport.width}x${viewport.height}.png`,
        ),
        fullPage: true,
      });
    }
  }

  await anonymousContext.close();
  await ownerContext.close();
});
