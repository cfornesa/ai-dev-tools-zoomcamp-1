import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
] as const;

test.describe('Header navigation (#673)', () => {
  let fixtures: ReturnType<typeof requireE2EFixtures>;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  for (const viewport of VIEWPORTS) {
    test(`signed-out navigation and root redirect at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page).toHaveURL(/\/gallery(?:\?.*)?$/);
      await expect(page.getByRole('heading', { name: 'Public gallery' })).toBeVisible();

      const menu = page.getByRole('navigation', { name: 'Primary navigation' });
      if (viewport.width < 600) {
        await page.getByRole('button', { name: 'Open menu' }).click();
      }
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Public gallery', exact: true })).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Home', exact: true })).toHaveCount(0);
    });

    test(`signed-in navigation and root redirect at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/');
      await expect(page).toHaveURL(/\/studio$/);

      const menu = page.getByRole('navigation', { name: 'Primary navigation' });
      if (viewport.width < 600) {
        await page.getByRole('button', { name: 'Open menu' }).click();
      }
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Studio', exact: true })).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Public gallery', exact: true })).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Home', exact: true })).toHaveCount(0);
    });
  }
});
