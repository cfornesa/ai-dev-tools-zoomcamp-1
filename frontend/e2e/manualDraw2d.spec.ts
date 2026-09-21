import fs from 'node:fs';

import JSZip from 'jszip';
import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const SOURCES = {
  canvas2d:
    '<canvas id="art-piece-canvas" width="320" height="240"></canvas><script>var c=document.getElementById("art-piece-canvas");var x=c.getContext("2d");x.fillStyle="#172554";x.fillRect(0,0,320,240);</script>',
  svg: '<svg id="art-piece-svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#172554"/></svg>',
} as const;

test.describe('Generated 2D manual drawing tools (#667)', () => {
  const fixtures = requireE2EFixtures();

  test('writes, previews, saves, and publishes Canvas2D and SVG manual edits', async ({
    page,
    context,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const profileResponse = await apiGet(context, '/api/account/profile/');
    expect(profileResponse.ok()).toBe(true);
    const profile = (await profileResponse.json()) as { handle: string };

    for (const engine of ['canvas2d', 'svg'] as const) {
      const slug = `manual-2d-${engine}-${Date.now().toString(36)}`;
      const created = await apiPost(context, '/api/art-pieces/', {
        title: `Manual ${engine} fixture`,
        description: 'Manual drawing fixture.',
        prompt: `A ${engine} manual drawing fixture`,
        engine,
        public_slug: slug,
        capabilities: { screenshot: true, download: true, immersive: true },
        source: SOURCES[engine],
      });
      expect(created.status()).toBe(201);

      await page.goto(`/users/@${profile.handle}/edit/${slug}`);
      await expect(
        page.getByRole('heading', { name: `Edit Manual ${engine} fixture` }),
      ).toBeVisible();
      await expect(page.getByTestId('art-piece-editor-tool-add-shape')).toBeEnabled();
      await expect(page.getByTestId('art-piece-editor-tool-add-ellipse')).toBeEnabled();
      await expect(page.getByTestId('art-piece-editor-tool-add-line')).toBeEnabled();
      await expect(page.getByTestId('art-piece-editor-tool-freehand-draw')).toBeEnabled();
      await expect(page.getByTestId('art-piece-editor-tool-erase')).toBeEnabled();
      await page.getByTestId('art-piece-editor-tool-add-shape').click();
      await page.getByTestId('art-piece-editor-tool-add-ellipse').click();
      await page.getByTestId('art-piece-editor-tool-add-line').click();
      await expect(page.getByTestId('art-piece-editor-code-panel')).toContainText(
        'AUGMENTRART_EDITABLE_START',
      );
      await expect(page.locator('#art-piece-editor-code')).toHaveValue(
        new RegExp(engine === 'canvas2d' ? 'ctx\\.ellipse' : '<ellipse'),
      );
      const preview = page.frameLocator('iframe[title="Art piece revision preview"]');
      await expect(
        preview.locator(engine === 'canvas2d' ? '#art-piece-canvas' : '#art-piece-svg'),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/manual-2d-${engine}-before-save.png`,
        fullPage: true,
      });

      await page.getByTestId('art-piece-editor-save-version').click();
      await expect(page.getByTestId('art-piece-editor-version-list')).toContainText('Version 2');
      await page.screenshot({
        path: `test-results/manual-2d-${engine}-after-save.png`,
        fullPage: true,
      });

      const piece = (await created.json()) as { public_id: string };
      const versions = await apiGet(context, `/api/art-pieces/${piece.public_id}/versions/`);
      expect(versions.ok()).toBe(true);
      const savedVersions = (await versions.json()) as Array<{ sequence: number; source: string }>;
      expect(savedVersions).toHaveLength(2);
      expect(savedVersions.find((version) => version.sequence === 2)?.source).toContain(
        engine === 'canvas2d' ? 'ctx.ellipse' : '<ellipse',
      );

      const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
        status: 'published',
      });
      expect(published.status()).toBe(200);
      await page.goto(`/users/@${profile.handle}/pieces/${slug}`);
      await expect(page.getByRole('heading', { name: `Manual ${engine} fixture` })).toBeVisible();
      const downloadMenu = page.getByRole('button', { name: 'Open download menu' });
      await expect(downloadMenu).toBeVisible();
      await downloadMenu.click();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: 'Download Full ZIP' }).click();
      const download = await downloadPromise;
      const zip = await JSZip.loadAsync(fs.readFileSync((await download.path())!));
      const indexHtml = await zip.files['index.html'].async('string');
      expect(indexHtml).toContain(engine === 'canvas2d' ? 'ctx.ellipse' : '<ellipse');
      await page.goto(`/users/@${profile.handle}/immersive/${slug}`);
      await expect(page.getByRole('heading', { name: `Manual ${engine} fixture` })).toBeVisible();
    }
  });
});
