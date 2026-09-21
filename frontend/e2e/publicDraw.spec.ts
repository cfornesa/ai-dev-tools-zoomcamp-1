import fs from 'node:fs';

import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const SOURCE =
  "window.sketch = ({ canvas, startFrame }) => { canvas.addEventListener('pointermove', () => {}); const context = canvas.getContext('2d'); startFrame(() => { context.fillStyle = '#172554'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#fbbf24'; context.fillRect(120, 80, 80, 80); }); };";

test.describe('C2.js Interactive visitor drawing (#670)', () => {
  const fixtures = requireE2EFixtures();

  test('draws temporarily on regular and immersive views and captures the marks', async ({
    browser,
    context,
  }) => {
    test.setTimeout(120_000);
    const ownerPage = await context.newPage();
    await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);
    const profile = (await (await apiGet(context, '/api/account/profile/')).json()) as {
      handle: string;
    };
    const slug = `visitor-draw-${Date.now().toString(36)}`;
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Visitor draw fixture',
      description: 'Temporary drawing fixture.',
      prompt: 'C2 interactive drawing fixture',
      engine: 'c2js-interactive',
      public_slug: slug,
      capabilities: { screenshot: true, immersive: true },
      source: SOURCE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);
    await ownerPage.close();

    const scenarios = [
      { surface: 'pieces', viewport: { width: 1280, height: 900 }, pointerType: 'mouse' },
      { surface: 'immersive', viewport: { width: 1280, height: 900 }, pointerType: 'mouse' },
      { surface: 'pieces', viewport: { width: 375, height: 812 }, pointerType: 'touch' },
      { surface: 'immersive', viewport: { width: 375, height: 812 }, pointerType: 'touch' },
    ] as const;
    for (const scenario of scenarios) {
      const { surface, viewport, pointerType } = scenario;
      const page = await (await browser.newContext()).newPage();
      await page.setViewportSize(viewport);
      const writes: string[] = [];
      page.on('request', (request) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method());
      });
      await page.goto(`/users/@${profile.handle}/${surface}/${slug}`);
      await expect(page.getByRole('heading', { name: 'Visitor draw fixture' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Draw on piece' })).toBeVisible();
      const overlay = page.getByLabel('Temporary visitor drawing overlay');
      await page.getByRole('button', { name: 'Draw on piece' }).click();
      await expect(page.getByRole('button', { name: 'Stop drawing' })).toBeVisible();
      const bounds = await overlay.boundingBox();
      expect(bounds).not.toBeNull();
      const start = { x: bounds!.x + bounds!.width * 0.25, y: bounds!.y + bounds!.height * 0.35 };
      const end = { x: bounds!.x + bounds!.width * 0.7, y: bounds!.y + bounds!.height * 0.65 };
      if (pointerType === 'mouse') {
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(end.x, end.y, { steps: 5 });
        await page.mouse.up();
      } else {
        await overlay.dispatchEvent('pointerdown', {
          bubbles: true,
          clientX: start.x,
          clientY: start.y,
          pointerId: 1,
          pointerType: 'touch',
        });
        await overlay.dispatchEvent('pointermove', {
          bubbles: true,
          clientX: end.x,
          clientY: end.y,
          pointerId: 1,
          pointerType: 'touch',
        });
        await overlay.dispatchEvent('pointerup', {
          bubbles: true,
          clientX: end.x,
          clientY: end.y,
          pointerId: 1,
          pointerType: 'touch',
        });
      }
      await expect(page.getByRole('button', { name: 'Clear visitor drawing' })).toBeEnabled();
      await page.waitForTimeout(100);
      const firstScreenshot = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Take screenshot' }).click();
      const firstDownload = await firstScreenshot;
      const firstBytes = fs.readFileSync((await firstDownload.path())!);
      expect(firstBytes.length).toBeGreaterThan(1000);
      await page.screenshot({
        path: `test-results/public-draw-${surface}-${viewport.width}-marked.png`,
        fullPage: true,
      });

      await page.getByRole('button', { name: 'Clear visitor drawing' }).click();
      await expect(page.getByRole('button', { name: 'Clear visitor drawing' })).toBeDisabled();
      await page.screenshot({
        path: `test-results/public-draw-${surface}-${viewport.width}.png`,
        fullPage: true,
      });
      expect(writes).toEqual([]);
      await page.reload();
      await expect(page.getByRole('button', { name: 'Draw on piece' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Clear visitor drawing' })).toBeDisabled();
      await page.close();
    }
  });
});
