/** Issue #485: verify unknown SPA routes render an accessible not-found view
 * with recovery links and no horizontal overflow at desktop and mobile
 * widths. */
import { expect, test } from '@playwright/test';

import { readE2EState } from './support/state.js';

const DESKTOP_VIEWPORT = { width: 1280, height: 900 };
const MOBILE_VIEWPORT = { width: 375, height: 812 };

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
}

test.describe('Not found SPA view', () => {
  test.beforeAll(() => {
    const state = readE2EState();
    test.skip(!state.available, !state.available ? state.reason : undefined);
  });

  test.describe('desktop', () => {
    test.use({ viewport: DESKTOP_VIEWPORT });

    test('direct deep link shows heading, explanation, and recovery links', async ({ page }) => {
      await page.goto('/definitely-not-a-real-route');

      await expect(page.getByRole('heading', { name: 'Page not found', level: 2 })).toBeVisible();
      await expect(page.getByText(/that address does not exist or is unavailable/i)).toBeVisible();

      const homeLink = page.getByRole('link', { name: 'Home' });
      const galleryLink = page.getByRole('link', { name: 'Public gallery' });
      await expect(homeLink).toBeVisible();
      await expect(homeLink).toHaveAttribute('href', '/');
      await expect(galleryLink).toBeVisible();
      await expect(galleryLink).toHaveAttribute('href', '/gallery');

      await homeLink.click();
      await expect(page).toHaveURL('/');

      await page.goto('/definitely-not-a-real-route');
      await page.getByRole('link', { name: 'Public gallery' }).click();
      await expect(page).toHaveURL('/gallery');

      await expectNoHorizontalOverflow(page);
    });

    test('SPA fallback document remains HTTP 200 (edge-level 404 is out of scope)', async ({
      request,
    }) => {
      const response = await request.get('/definitely-not-a-real-route');
      // The static SPA fallback serves the React bundle for any unmatched
      // path; per issue #485, edge-level HTTP 404 handling is explicitly out
      // of scope.
      expect(response.status()).toBe(200);
    });
  });

  test.describe('mobile', () => {
    test.use({ viewport: MOBILE_VIEWPORT });

    test('direct deep link shows heading and recovery links without overflow', async ({ page }) => {
      await page.goto('/definitely-not-a-real-route');

      await expect(page.getByRole('heading', { name: 'Page not found', level: 2 })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Public gallery' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
});
