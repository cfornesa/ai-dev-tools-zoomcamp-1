import { expect, test, type TestInfo } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('Local-first 3D creation (#937)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`creates, edits, saves, and reloads a local-only 3D project at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo: TestInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/create');

      const serverCreateRequests: string[] = [];
      page.on('request', (request) => {
        if (
          request.method() === 'POST' &&
          /\/api\/projects3d(?:\/|$)/.test(new URL(request.url()).pathname)
        ) {
          serverCreateRequests.push(request.url());
        }
      });

      await page.getByRole('button', { name: 'Create a new 3D project', exact: true }).click();
      await page.waitForURL(/\/local-projects\/[^/]+$/);
      await expect(page.getByRole('heading', { name: 'Untitled 3D scene' })).toBeVisible();
      expect(serverCreateRequests).toEqual([]);

      await page.getByRole('button', { name: '3D authoring' }).click();
      await page.getByRole('button', { name: 'Add sphere' }).click();
      await expect(page.getByText('Sphere 1')).toBeVisible();
      await page.getByRole('button', { name: 'Save scene' }).click();
      await expect(page.getByTestId('project3d-save-status')).toHaveText(/Saved as version 2/);

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Untitled 3D scene' })).toBeVisible();
      await expect(page.getByText('Sphere 1')).toBeVisible();
      await expect(page.getByTestId('project3d-save-status')).toHaveText(/Saved as version 2/);
      await page.screenshot({ path: testInfo.outputPath('local-first-3d.png'), fullPage: true });
    });
  }
});
