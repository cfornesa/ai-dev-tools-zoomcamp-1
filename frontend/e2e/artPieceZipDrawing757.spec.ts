import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const C2_INTERACTIVE =
  "window.sketch = ({ canvas, startFrame }) => { const context = canvas.getContext('2d'); " +
  "startFrame(() => { context.fillStyle = '#1f2937'; context.fillRect(0, 0, canvas.width, canvas.height); }); };";

/** Issues #757/#758: the downloaded C2.js Interactive ZIP has the session-only drawing toolset. */
test.describe('C2.js Interactive ZIP drawing toolset (#757, #758)', () => {
  const fixtures = requireE2EFixtures();

  test('regular and immersive ZIPs draw, erase, undo, redo, screenshot marks, and reset on reload', async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(180_000);
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const profile = (await (await apiGet(context, '/api/account/profile/')).json()) as {
      handle: string;
    };
    const slug = `zip-draw-${Date.now().toString(36)}`;
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'ZIP draw fixture',
      description: 'C2 interactive ZIP drawing fixture.',
      prompt: 'A c2 interactive zip fixture',
      engine: 'c2js-interactive',
      public_slug: slug,
      capabilities: { screenshot: true, fullscreen: true, download: true, immersive: true },
      source: C2_INTERACTIVE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    expect(
      (
        await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, { status: 'published' })
      ).status(),
    ).toBe(200);

    for (const surface of ['pieces', 'immersive'] as const) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/users/@${profile.handle}/${surface}/${slug}`);
      await page.getByRole('button', { name: 'Open download menu' }).click();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: 'Download Full ZIP' }).click();
      const zip = await JSZip.loadAsync(fs.readFileSync((await (await downloadPromise).path())!));
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-draw-757-'));
      try {
        for (const [name, entry] of Object.entries(zip.files)) {
          if (entry.dir) continue;
          const target = path.join(root, name);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, await entry.async('nodebuffer'));
        }
        for (const viewport of [
          { width: 1280, height: 900 },
          { width: 375, height: 812 },
        ]) {
          await page.setViewportSize(viewport);
          await page.goto(`file://${path.join(root, 'index.html')}`);

          // Contextual: the tools stay hidden until Draw is on.
          const drawToggle = page.getByRole('button', { name: 'Draw on piece' });
          await expect(drawToggle).toBeVisible();
          const tools = page.getByRole('group', { name: 'Visitor drawing' });
          await expect(tools).toBeHidden();
          await drawToggle.click();
          await expect(tools).toBeVisible();
          await expect(page.getByRole('button', { name: 'Stop drawing' })).toHaveAttribute(
            'aria-pressed',
            'true',
          );
          for (const name of ['Pencil', 'Brush', 'Eraser']) {
            await expect(tools.getByRole('radio', { name })).toBeVisible();
          }
          await expect(tools.getByRole('radio', { name: 'Red' })).toBeVisible();
          await expect(tools.getByRole('slider', { name: 'Drawing size' })).toBeVisible();
          await expect(page.getByRole('button', { name: 'Undo visitor drawing' })).toBeDisabled();

          // Draw a red brush stroke across the middle of the artwork content.
          await tools.getByRole('radio', { name: 'Red' }).click();
          await tools.getByRole('radio', { name: 'Brush' }).click();
          await tools.getByRole('slider', { name: 'Drawing size' }).fill('20');
          const box = (await page.locator('#art-piece-drawing-overlay').boundingBox())!;
          const y = box.y + box.height / 2;
          await page.mouse.move(box.x + box.width * 0.2, y);
          await page.mouse.down();
          await page.mouse.move(box.x + box.width * 0.8, y, { steps: 8 });
          await page.mouse.up();
          const strokes = () =>
            page.evaluate(() =>
              (
                window as unknown as { __artPieceVisitorDrawing: { strokeCount(): number } }
              ).__artPieceVisitorDrawing.strokeCount(),
            );
          expect(await strokes()).toBe(1);
          const centre = await page.evaluate(() => {
            const overlay = document.getElementById(
              'art-piece-drawing-overlay',
            ) as HTMLCanvasElement;
            const data = overlay
              .getContext('2d')!
              .getImageData(overlay.width / 2, overlay.height / 2, 1, 1).data;
            return Array.from(data);
          });
          expect(centre.slice(0, 3)).toEqual([0xef, 0x44, 0x44]);
          expect(centre[3]).toBeGreaterThan(200);
          await page.screenshot({
            path: testInfo.outputPath(`zip-draw-${surface}-${viewport.width}.png`),
          });

          // Undo / Redo / Clear.
          await page.getByRole('button', { name: 'Undo visitor drawing' }).click();
          expect(await strokes()).toBe(0);
          await page.getByRole('button', { name: 'Redo visitor drawing' }).click();
          expect(await strokes()).toBe(1);

          // Eraser removes the touched stroke.
          await tools.getByRole('radio', { name: 'Eraser' }).click();
          await page.mouse.move(box.x + box.width * 0.5, y);
          await page.mouse.down();
          await page.mouse.move(box.x + box.width * 0.52, y, { steps: 3 });
          await page.mouse.up();
          expect(await strokes()).toBe(0);
          await page.getByRole('button', { name: 'Undo visitor drawing' }).click();
          expect(await strokes()).toBe(1);

          // Screenshot includes the marks (pixel at the artwork centre is the stroke colour).
          const shotPromise = page.waitForEvent('download');
          await page.getByRole('button', { name: 'Screenshot' }).click();
          const shot = await shotPromise;
          const png = fs.readFileSync((await shot.path())!).toString('base64');
          const pixel = await page.evaluate(async (base64) => {
            const image = new Image();
            await new Promise<void>((resolve, reject) => {
              image.onload = () => resolve();
              image.onerror = () => reject(new Error('bad png'));
              image.src = `data:image/png;base64,${base64}`;
            });
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(image, 0, 0);
            return {
              size: [image.width, image.height],
              rgb: Array.from(ctx.getImageData(image.width / 2, image.height / 2, 1, 1).data).slice(
                0,
                3,
              ),
            };
          }, png);
          expect(pixel.size).toEqual([1280, 720]);
          expect(pixel.rgb).toEqual([0xef, 0x44, 0x44]);

          // Session-only: nothing persisted, a reload restores the stored piece.
          expect(await page.evaluate(() => window.localStorage.length)).toBe(0);
          await page.reload();
          await expect(page.getByRole('button', { name: 'Draw on piece' })).toBeVisible();
          expect(await strokes()).toBe(0);
        }
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }

    // Non-Camera ZIP keeps drawing: it is not a camera feature.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/users/@${profile.handle}/pieces/${slug}`);
    await page.getByRole('button', { name: 'Open download menu' }).click();
    const nonCamera = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Download Non-Camera ZIP' }).click();
    const nonCameraZip = await JSZip.loadAsync(fs.readFileSync((await (await nonCamera).path())!));
    const html = await nonCameraZip.files['index.html'].async('string');
    expect(html).toContain('data-action="draw"');
    expect(html).toContain('id="art-piece-drawing-tools"');
  });
});
