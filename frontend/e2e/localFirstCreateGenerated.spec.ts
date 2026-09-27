import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('Local-first generated creation (#938)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`creates, previews, versions, restores, and exports locally at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/create');
      const serverMutations: string[] = [];
      page.on('request', (request) => {
        if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/')) {
          serverMutations.push(new URL(request.url()).pathname);
        }
      });

      await page
        .getByRole('button', { name: 'Create a local generated piece', exact: true })
        .click();
      await page.waitForURL(/\/local-generated\/[^/]+$/);
      await expect(page.getByRole('heading', { name: 'Local generated SVG' })).toBeVisible();
      await expect(page.getByTitle('Local generated SVG preview')).toBeVisible();
      expect(serverMutations).toEqual([]);

      const screenshot = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Screenshot', exact: true }).click();
      expect((await screenshot).suggestedFilename()).toMatch(/\.png$/);

      const source = page.getByLabel('Generated source');
      await source.fill(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="red"/></svg>',
      );
      await page.getByRole('button', { name: 'Save local version' }).click();
      await expect(page.getByRole('status')).toContainText('Saved locally');
      await expect(page.getByRole('button', { name: 'Restore version 2' })).toBeVisible();

      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export local package' }).click();
      expect((await download).suggestedFilename()).toMatch(/\.zip$/);
      await page.getByRole('button', { name: 'Restore version 1' }).click();
      await expect(source).toHaveValue(/<svg xmlns/);
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Local generated SVG' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Restore version 2' })).toBeVisible();
    });
  }
});
