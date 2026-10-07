import { expect, test } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { expandGeneratedArtEditorTools } from './support/expandCollapsibleSections.js';
import { requireE2EFixtures } from './support/prerequisites.js';

// The fake AI refinement edits the fake generator's own fixture tokens (`teal`, `#2a9d8f`), so the
// fixtures contain them (backend/scenes/art_piece_api.py `_FakeArtPieceProvider.refine`).
const SOURCES = {
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="teal"/></svg>',
  'c2js-interactive':
    "window.sketch = ({ canvas, startFrame }) => { canvas.addEventListener('pointermove', () => {}); const context = canvas.getContext('2d'); startFrame(() => { context.fillStyle = '#2a9d8f'; context.fillRect(0, 0, canvas.width, canvas.height); }); };",
} as const;

test.describe('2D AI editor engine modes (#618)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('catalogs all 2D engines and preserves source-only editor identity through revision/save', async ({
    browser,
  }, testInfo) => {
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
        const piece = (await created.json()) as { public_id: string };
        await testInfo.attach(`piece-${engine}-${viewport.width}`, {
          body: JSON.stringify({ public_id: piece.public_id, public_slug: slug }, null, 2),
          contentType: 'application/json',
        });

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
        await expect(page.getByRole('group', { name: 'Publication status' })).toBeVisible();
        await expect(page.getByTestId('art-piece-editor-publication-status')).toContainText(
          'Draft (private)',
        );
        await expect(page.getByRole('button', { name: 'Export piece package' })).toBeEnabled();
        await page.getByRole('button', { name: 'Toggle thumbnail panel' }).click();
        await expect(page.getByRole('heading', { name: 'Current version' })).toBeVisible();
        await expect(page.getByTestId('art-piece-editor-regenerate-thumbnail')).toBeEnabled();
        await page.getByRole('button', { name: 'Toggle thumbnail panel' }).click();
        await page.getByText('Sound', { exact: true }).click();
        await expect(page.getByRole('button', { name: 'Save sound defaults' })).toBeEnabled();
        await page.getByText('Sound', { exact: true }).click();
        await page.getByRole('button', { name: 'Published', exact: true }).click();
        const publishDialog = page.getByRole('alertdialog', { name: /Publish/ });
        await expect(publishDialog).toBeVisible();
        await publishDialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(page.getByTestId('art-piece-editor-publication-status')).toContainText(
          'Draft (private)',
        );
        await page.getByRole('button', { name: 'Published', exact: true }).click();
        await page
          .getByRole('alertdialog', { name: /Publish/ })
          .getByRole('button', { name: 'Publish', exact: true })
          .click();
        await expect(page.getByTestId('art-piece-editor-publication-status')).toContainText(
          'Published (public)',
        );
        await page.getByRole('button', { name: 'Draft', exact: true }).click();
        await expect(page.getByTestId('art-piece-editor-publication-status')).toContainText(
          'Draft (private)',
        );
        await page.screenshot({
          path: testInfo.outputPath(`generated-2d-editor-${engine}-${viewport.width}.png`),
          fullPage: true,
        });

        await page.getByTestId('art-piece-editor-edit-source').click();
        await expect(page.getByTestId('art-piece-editor-code-panel')).toBeVisible();
        await expect(page.getByTestId('art-piece-editor-save-version')).toBeEnabled({
          timeout: 15_000,
        });
        await page
          .getByLabel('Editable source preview')
          .fill(`${SOURCES[engine]}\n// manual source parity edit`);
        await expect(page.getByTestId('art-piece-editor-save-version')).toBeEnabled();
        await page.getByTestId('art-piece-editor-save-version').click();
        await expect(page.getByTestId('art-piece-editor-version-list')).toContainText('Version 2');

        await expandGeneratedArtEditorTools(page);
        await page.getByRole('button', { name: 'AI edit' }).click();
        await page
          .getByLabel('Describe the revision you want to generate')
          .fill('make it brighter');
        await page.getByRole('button', { name: 'Refine piece' }).click();
        await expect(page.getByTestId('art-piece-editor-preview')).toBeVisible();
        await expect(page.getByTestId('art-piece-refine-accepted')).toBeVisible();
        await expect(page.getByTestId('art-piece-editor-version-list')).toContainText('Version 3');
        await expect(page.getByTestId('art-piece-editor-version-list')).toContainText('(current)');
        await context.close();
      }
    }
  });
});
