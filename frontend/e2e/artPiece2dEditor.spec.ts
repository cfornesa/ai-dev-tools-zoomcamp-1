import { expect, test } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const SOURCES = {
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#172554"/></svg>',
  'c2js-interactive':
    "window.sketch = ({ canvas, startFrame }) => { canvas.addEventListener('pointermove', () => {}); const context = canvas.getContext('2d'); startFrame(() => { context.fillStyle = '#1f2937'; context.fillRect(0, 0, canvas.width, canvas.height); }); };",
} as const;

test.describe('2D AI editor engine modes (#618)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('catalogs all 2D engines and preserves source-only editor identity through revision/save', async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      for (const engine of ['svg', 'c2js-interactive'] as const) {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.setViewportSize(viewport);
        await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);
        const profileResponse = await apiGet(context, '/api/account/profile/');
        expect(profileResponse.ok()).toBe(true);
        const profile = (await profileResponse.json()) as { handle: string };

        if (engine === 'svg') {
          await page.goto('/art-pieces');
          await expect(page.getByLabel('Library')).toHaveValue('canvas2d');
          await expect(page.getByLabel('Library').locator('option')).toHaveCount(7);
          for (const option of ['svg', 'p5js', 'c2js', 'c2js-interactive']) {
            await expect(
              page.getByLabel('Library').locator(`option[value="${option}"]`),
            ).toHaveCount(1);
          }
        }

        const slug = `e2e-2d-${engine}-${viewport.width}-${Date.now().toString(36)}`;
        const created = await apiPost(context, '/api/art-pieces/', {
          title: `2D ${engine} editor fixture`,
          description: 'Source-only editor contract fixture.',
          prompt: `Create a ${engine} editor fixture`,
          engine,
          public_slug: slug,
          capabilities: { screenshot: true, download: true, immersive: true },
          source: SOURCES[engine],
        });
        expect(created.status()).toBe(201);

        await page.goto(`/users/@${profile.handle}/edit/${slug}`);
        await expect(page.getByTestId('art-piece-editor-mode')).toHaveText(
          new RegExp(`2D AI editor.*${engine === 'svg' ? 'SVG' : 'C2.js Interactive'}`),
        );
        await expect(page.locator('[data-editor-family="2d"]')).toHaveAttribute(
          'data-editor-engine',
          engine,
        );
        await expect(page.getByTestId('art-piece-editor-source-only')).toBeVisible();
        await expect(page.getByTestId('art-piece-editor-version-list')).toContainText('Version 1');

        await page
          .getByLabel('Describe the revision you want to generate')
          .fill('make it brighter');
        await page.getByRole('button', { name: 'Generate revision' }).click();
        await expect(page.getByTestId('art-piece-editor-preview')).toBeVisible();
        await expect(page.getByTestId('art-piece-editor-save-version')).toBeVisible();
        await page.getByTestId('art-piece-editor-save-version').click();
        await expect(page.getByTestId('art-piece-editor-version-list')).toContainText('Version 2');
        await expect(page.getByTestId('art-piece-editor-version-list')).toContainText('(current)');
        await context.close();
      }
    }
  });
});
