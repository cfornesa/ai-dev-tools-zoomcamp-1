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
      const colorGroup = page.getByRole('radiogroup', { name: 'Stroke color' });
      await expect(colorGroup).toBeVisible();
      await expect(colorGroup.getByRole('radio')).toHaveCount(8);
      await expect(colorGroup.getByRole('radio', { name: 'White' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await expect(page.getByRole('radiogroup', { name: 'Drawing tool' })).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Pencil' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await expect(page.getByRole('radio', { name: 'Brush' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
      const sizeSlider = page.getByRole('slider', { name: 'Drawing size' });
      await expect(sizeSlider).toHaveValue('4');
      await expect(page.locator('output[for="visitor-drawing-size"]')).toHaveText('4px');
      const bounds = await overlay.boundingBox();
      expect(bounds).not.toBeNull();
      const drawStroke = async (startRatio: number, endRatio: number, pointerId: number) => {
        const start = {
          x: bounds!.x + bounds!.width * startRatio,
          y: bounds!.y + bounds!.height * 0.35,
        };
        const end = {
          x: bounds!.x + bounds!.width * endRatio,
          y: bounds!.y + bounds!.height * 0.65,
        };
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
            pointerId,
            pointerType: 'touch',
          });
          await overlay.dispatchEvent('pointermove', {
            bubbles: true,
            clientX: end.x,
            clientY: end.y,
            pointerId,
            pointerType: 'touch',
          });
          await overlay.dispatchEvent('pointerup', {
            bubbles: true,
            clientX: end.x,
            clientY: end.y,
            pointerId,
            pointerType: 'touch',
          });
        }
      };
      await drawStroke(0.25, 0.7, 1);
      await page.getByRole('radio', { name: 'Brush' }).click();
      await colorGroup.getByRole('radio', { name: 'Red' }).click();
      await sizeSlider.fill('24');
      await expect(page.getByRole('radio', { name: 'Brush' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await expect(page.locator('output[for="visitor-drawing-size"]')).toHaveText('24px');
      await drawStroke(0.55, 0.9, 2);
      const customColor = page.getByLabel('Custom stroke color');
      await customColor.fill('#22c55e');
      await expect(customColor).toHaveValue('#22c55e');
      await drawStroke(0.15, 0.35, 3);
      await page.getByRole('radio', { name: 'Eraser' }).click();
      await expect(page.getByRole('radio', { name: 'Eraser' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await expect(page.getByText('Eraser removes touched strokes.')).toBeVisible();
      await drawStroke(0.55, 0.55, 4);
      await expect(page.getByRole('button', { name: 'Clear visitor drawing' })).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Undo visitor drawing' })).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Redo visitor drawing' })).toBeDisabled();
      await page.screenshot({
        path: `test-results/public-draw-${surface}-${viewport.width}-erased.png`,
        fullPage: true,
      });
      await page.getByRole('button', { name: 'Undo visitor drawing' }).click();
      await expect(page.getByRole('button', { name: 'Redo visitor drawing' })).toBeEnabled();
      await page.getByRole('button', { name: 'Redo visitor drawing' }).click();
      await overlay.focus();
      await page.keyboard.press('Control+z');
      await expect(page.getByRole('button', { name: 'Redo visitor drawing' })).toBeEnabled();
      await page.keyboard.press('Control+Shift+z');
      await expect(page.getByRole('button', { name: 'Redo visitor drawing' })).toBeDisabled();
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
      await page.getByRole('button', { name: 'Undo visitor drawing' }).click();
      await expect(page.getByRole('button', { name: 'Clear visitor drawing' })).toBeEnabled();
      await page.getByRole('button', { name: 'Redo visitor drawing' }).click();
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
