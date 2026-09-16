import { expect, test } from '@playwright/test';

import { apiGet } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('admin navigation discoverability (#558)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`shows Admin only to administrators at ${viewport.width}x${viewport.height}`, async ({
      browser,
    }) => {
      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      await adminPage.setViewportSize(viewport);
      await loginViaUI(adminPage, fixtures.admin.email, fixtures.password);
      await adminPage.goto('/admin/content');
      if (viewport.width < 768) await adminPage.getByRole('button', { name: 'Open menu' }).click();
      await expect(adminPage.getByRole('link', { name: 'Admin' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await adminContext.close();

      const ordinaryContext = await browser.newContext();
      const ordinaryPage = await ordinaryContext.newPage();
      await ordinaryPage.setViewportSize(viewport);
      await loginViaUI(ordinaryPage, fixtures.other.email, fixtures.password);
      if (viewport.width < 768)
        await ordinaryPage.getByRole('button', { name: 'Open menu' }).click();
      await expect(ordinaryPage.getByRole('link', { name: 'Admin' })).toHaveCount(0);
      expect((await apiGet(ordinaryContext, '/api/admin/settings/')).status()).toBe(403);
      await ordinaryContext.close();
    });
  }
});
