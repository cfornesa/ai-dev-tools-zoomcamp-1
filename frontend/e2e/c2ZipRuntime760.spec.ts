import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

// Uses API the three-method fallback adapter does not have (Renderer.rect, c2.Random, c2.Color).
const REAL_C2_SKETCH =
  'window.sketch = ({ c2, canvas, startFrame }) => { ' +
  "const renderer = new c2.Renderer(canvas); renderer.size(1280, 720); renderer.background('#111827'); " +
  "renderer.fill('#22d3ee'); renderer.circle(640, 360, 120); " +
  "renderer.fill('#f97316'); renderer.rect(100, 100, 200, 100); " +
  "window.__c2IsUpstream = typeof c2.Random === 'function' && typeof c2.Color === 'function'; " +
  'startFrame(() => {}); };';

test.describe('C2.js ZIP vendors the real c2.min.js (#760)', () => {
  const fixtures = requireE2EFixtures();

  test('extracted ZIPs run a sketch that needs the upstream API, over file:// and http', async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(180_000);
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const profile = (await (await apiGet(context, '/api/account/profile/')).json()) as {
      handle: string;
    };
    for (const engine of ['c2js', 'c2js-interactive'] as const) {
      const slug = `c2-real-${engine}-${Date.now().toString(36)}`;
      const created = await apiPost(context, '/api/art-pieces/', {
        title: `C2 real ${engine}`,
        description: 'C2 real runtime fixture.',
        prompt: `A ${engine} fixture`,
        engine,
        public_slug: slug,
        capabilities: { screenshot: true, fullscreen: true, download: true, immersive: true },
        source: REAL_C2_SKETCH,
      });
      expect(created.status()).toBe(201);
      const piece = (await created.json()) as { public_id: string };
      expect(
        (
          await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, { status: 'published' })
        ).status(),
      ).toBe(200);

      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/users/@${profile.handle}/pieces/${slug}`);
      await page.getByRole('button', { name: 'Open download menu' }).click();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: 'Download Full ZIP' }).click();
      const zip = await JSZip.loadAsync(fs.readFileSync((await (await downloadPromise).path())!));
      expect(Object.keys(zip.files)).toContain('runtime/c2.min.js');
      const html = await zip.files['index.html'].async('string');
      expect(html).toContain('runtime/c2.min.js');
      expect(html).not.toContain('cdn.jsdelivr.net');

      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'c2-real-760-'));
      try {
        for (const [name, entry] of Object.entries(zip.files)) {
          if (entry.dir) continue;
          const target = path.join(root, name);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, await entry.async('nodebuffer'));
        }
        // file:// with every network request refused proves the vendored copy is what runs.
        await page.route('**/*', (route) =>
          route.request().url().startsWith('file://') ? route.continue() : route.abort(),
        );
        await page.goto(`file://${path.join(root, 'index.html')}`);
        const canvas = page.locator('#c2-canvas');
        await expect(canvas).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(() => (window as unknown as Record<string, unknown>).__c2IsUpstream),
          )
          .toBe(true);
        const pixels = await canvas.evaluate((element) => {
          const el = element as HTMLCanvasElement;
          const read = (x: number, y: number) =>
            Array.from(el.getContext('2d')!.getImageData(x, y, 1, 1).data).slice(0, 3);
          return { circle: read(640, 360), rect: read(200, 150) };
        });
        expect(pixels.circle).toEqual([0x22, 0xd3, 0xee]);
        expect(pixels.rect).toEqual([0xf9, 0x73, 0x16]);
        await page.screenshot({ path: testInfo.outputPath(`c2-real-${engine}.png`) });
        await page.unroute('**/*');
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  });
});
