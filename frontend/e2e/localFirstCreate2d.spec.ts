import { expect, test, type TestInfo } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('Local-first 2D creation (#934)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`creates and reloads a local-only 2D project at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo: TestInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/create');

      const serverCreateRequests: string[] = [];
      page.on('request', (request) => {
        if (
          request.method() === 'POST' &&
          /\/api\/projects(?:\/|$)/.test(new URL(request.url()).pathname)
        ) {
          serverCreateRequests.push(request.url());
        }
      });

      await page.getByRole('button', { name: 'Create a new 2D project', exact: true }).click();
      await page.waitForURL(/\/local-projects\/[^/]+$/);
      await expect(page.getByRole('heading', { name: 'Untitled animation' })).toBeVisible();
      await expect(page.getByText('Scene 1')).toBeVisible();
      expect(serverCreateRequests).toEqual([]);

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Untitled animation' })).toBeVisible();
      await expect(page.getByText('Scene 1')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('local-first-2d.png'), fullPage: true });
    });
  }
});
