import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const C2_SOURCE =
  "window.sketch = ({ canvas, startFrame }) => { const context = canvas.getContext('2d'); " +
  "startFrame(() => { context.fillStyle = '#111827'; context.fillRect(0, 0, canvas.width, canvas.height); " +
  "context.fillStyle = '#22d3ee'; context.beginPath(); " +
  'context.arc(canvas.width / 2, canvas.height / 2, canvas.height / 5, 0, Math.PI * 2); context.fill(); }); };';

test.describe('C2.js ZIP canvas uses the reference 1280x720 (#764)', () => {
  const fixtures = requireE2EFixtures();

  test('extracted regular and immersive ZIPs render a 1280x720 canvas that fills the stage', async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(120_000);
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const profile = (await (await apiGet(context, '/api/account/profile/')).json()) as {
      handle: string;
    };

    for (const engine of ['c2js', 'c2js-interactive'] as const) {
      const slug = `c2-zip-764-${engine}-${Date.now().toString(36)}`;
      const created = await apiPost(context, '/api/art-pieces/', {
        title: `C2 ZIP ${engine}`,
        description: 'C2 ZIP canvas fixture.',
        prompt: `A ${engine} zip fixture`,
        engine,
        public_slug: slug,
        capabilities: { screenshot: true, fullscreen: true, download: true, immersive: true },
        source: C2_SOURCE,
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
        await expect(page.getByRole('button', { name: 'Open download menu' })).toBeVisible();
        await page.getByRole('button', { name: 'Open download menu' }).click();
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('menuitem', { name: 'Download Full ZIP' }).click();
        const download = await downloadPromise;
        const zip = await JSZip.loadAsync(fs.readFileSync((await download.path())!));
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'c2-zip-764-'));
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
            const canvas = page.locator('#c2-canvas');
            await expect(canvas).toHaveAttribute('width', '1280');
            await expect(canvas).toHaveAttribute('height', '720');
            const box = (await canvas.boundingBox())!;
            expect(box.width).toBeCloseTo(viewport.width, -1);
            if (surface === 'pieces') {
              expect(box.width / box.height).toBeCloseTo(16 / 9, 1);
            } else {
              // Immersive fills the viewport and letterboxes the 16:9 content (object-fit: contain).
              expect(box.height).toBeCloseTo(viewport.height, -1);
            }
            // The centred cyan circle is drawn at the canvas centre, proving the sketch ran at 1280x720.
            const centre = await canvas.evaluate((element) => {
              const el = element as HTMLCanvasElement;
              const data = el
                .getContext('2d')!
                .getImageData(el.width / 2, el.height / 2, 1, 1).data;
              return Array.from(data);
            });
            expect(centre.slice(0, 3)).toEqual([0x22, 0xd3, 0xee]);
            await page.screenshot({
              path: testInfo.outputPath(`c2-zip-${engine}-${surface}-${viewport.width}.png`),
            });
          }
        } finally {
          fs.rmSync(root, { recursive: true, force: true });
        }
      }
    }
  });
});
