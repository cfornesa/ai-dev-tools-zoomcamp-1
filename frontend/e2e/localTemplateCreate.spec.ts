import { expect, test, type TestInfo } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('Local-first template creation (#955)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`transfers a template locally and reloads at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo: TestInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/templates');

      const forbiddenServerWrites: string[] = [];
      page.on('request', (request) => {
        if (
          request.method() === 'POST' &&
          /\/api\/(projects|templates\/[^/]+\/clone)\//.test(new URL(request.url()).pathname)
        ) {
          forbiddenServerWrites.push(request.url());
        }
      });

      await page.getByRole('button', { name: /use the "blank canvas" template/i }).click();
      await page.waitForURL(/\/local-projects\/[^/]+$/);
      await expect(page.getByRole('heading', { name: 'Blank canvas' })).toBeVisible();
      expect(forbiddenServerWrites).toEqual([]);

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Blank canvas' })).toBeVisible();
      await page.goto('/');
      await expect(page.getByText('Local only')).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath('local-template-create.png'),
        fullPage: true,
      });
    });
  }
});
