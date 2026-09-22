import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const fixtures = {
  canvas2d:
    '<canvas id="piece-canvas" width="320" height="240"></canvas><script>const c=document.querySelector("canvas"); c.getContext("2d").fillRect(0,0,320,240);</script>',
  svg: '<svg id="piece-svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#172554"/></svg>',
  p5js: 'window.sketch = (p) => { p.setup = () => p.createCanvas(320, 240); p.draw = () => p.background(23, 37, 84); };',
  c2js: 'window.sketch = ({ canvas, startFrame }) => { const x = canvas.getContext("2d"); startFrame(() => { x.fillStyle = "#172554"; x.fillRect(0, 0, canvas.width, canvas.height); }); };',
  'c2js-interactive':
    'window.sketch = ({ canvas, startFrame }) => { canvas.addEventListener("pointermove", (event) => { canvas.dataset.pointer = `${event.offsetX},${event.offsetY}`; }); const x = canvas.getContext("2d"); startFrame(() => { x.fillStyle = "#172554"; x.fillRect(0, 0, canvas.width, canvas.height); }); };',
} as const;

test.describe('Generated 2D regular stage fill (#705)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('fills, resizes, preserves pointer coordinates, and supplies inspected screenshots for every 2D engine', async ({
    page,
    context,
  }, testInfo) => {
    await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);
    const profile = (await (await apiGet(context, '/api/account/profile/')).json()) as {
      handle: string;
    };
    const pieces = new Map<string, string>();
    for (const engine of Object.keys(fixtures) as Array<keyof typeof fixtures>) {
      const slug = `issue-705-${engine}-${Date.now().toString(36)}`;
      const created = await apiPost(context, '/api/art-pieces/', {
        title: `Issue 705 ${engine}`,
        description: 'Responsive regular 2D runtime fixture.',
        prompt: `A ${engine} responsive fixture`,
        engine,
        public_slug: slug,
        capabilities: { screenshot: true, fullscreen: true },
        source: fixtures[engine],
      });
      expect(created.status()).toBe(201);
      const piece = (await created.json()) as { public_id: string };
      expect(
        (
          await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, { status: 'published' })
        ).status(),
      ).toBe(200);
      pieces.set(engine, slug);
    }

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      for (const engine of Object.keys(fixtures) as Array<keyof typeof fixtures>) {
        await page.goto(`/users/@${profile.handle}/pieces/${pieces.get(engine)}`);
        const frame = page.frameLocator('iframe[title="Art piece preview"]');
        const surface = frame.locator(
          engine === 'svg'
            ? 'svg'
            : engine === 'p5js'
              ? 'canvas'
              : engine === 'canvas2d'
                ? '#piece-canvas'
                : '#c2-canvas',
        );
        await expect(surface).toBeVisible({ timeout: 15_000 });
        const geometry = await surface.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const stage = element.ownerDocument.body.getBoundingClientRect();
          return {
            surfaceWidth: rect.width,
            stageWidth: stage.width,
            surfaceHeight: rect.height,
            stageHeight: stage.height,
          };
        });
        expect(geometry.surfaceWidth).toBeCloseTo(geometry.stageWidth, 0);
        expect(geometry.surfaceHeight).toBeLessThanOrEqual(geometry.stageHeight + 1);

        if (engine === 'c2js-interactive') {
          await surface.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            element.dispatchEvent(
              new PointerEvent('pointermove', {
                bubbles: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
              }),
            );
          });
          await expect(surface).toHaveAttribute('data-pointer', /^(159|160|161),(119|120|121)$/);
        }
        await page.screenshot({
          path: testInfo.outputPath(`issue-705-${engine}-${viewport.width}.png`),
          fullPage: true,
        });
      }
    }
  });
});
