/** Issue #485: verify unknown SPA routes render an accessible not-found view
 * with recovery links and no horizontal overflow at desktop and mobile
 * widths. */
import { expect, test } from '@playwright/test';

import { readE2EState } from './support/state.js';

const DESKTOP_VIEWPORT = { width: 1280, height: 900 };
const MOBILE_VIEWPORT = { width: 375, height: 812 };

/** Issue #485 criterion 4: capture the rendered not-found view and attach it
 * to the report so the screenshot itself can be inspected, not just DOM
 * assertions. QA re-entry 2026-09-08: this was never done before and the
 * missing rendered evidence is exactly where the nav-duplication defect
 * lived. */
async function attachRenderedScreenshot(
  testInfo: import('@playwright/test').TestInfo,
  page: import('@playwright/test').Page,
  label: string,
): Promise<void> {
  const path = testInfo.outputPath(`${label}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(label, { path });
}

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

    test('direct deep link shows heading, explanation, and recovery links', async ({
      page,
    }, testInfo) => {
      await page.goto('/definitely-not-a-real-route');

      await expect(page.getByRole('heading', { name: 'Page not found', level: 2 })).toBeVisible();
      await expect(page.getByText(/that address does not exist or is unavailable/i)).toBeVisible();

      // QA re-entry (issue #485): the recovery links carry distinct
      // accessible names so they never duplicate the shell nav's bare
      // "Home"/"Public gallery" links -- the strict-mode violation that
      // failed the first Chromium run lived exactly here.
      const homeLink = page.getByRole('link', { name: 'Return to the home page' });
      const galleryLink = page.getByRole('link', { name: 'Browse the public gallery' });
      await expect(homeLink).toBeVisible();
      await expect(homeLink).toHaveAttribute('href', '/');
      await expect(galleryLink).toBeVisible();
      await expect(galleryLink).toHaveAttribute('href', '/gallery');

      await homeLink.click();
      await expect(page).toHaveURL('/');

      await page.goto('/definitely-not-a-real-route');
      await galleryLink.click();
      await expect(page).toHaveURL('/gallery');

      await page.goto('/definitely-not-a-real-route');
      await expectNoHorizontalOverflow(page);
      await attachRenderedScreenshot(testInfo, page, 'not-found-1280x900');
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

    test('direct deep link shows heading and recovery links without overflow', async ({
      page,
    }, testInfo) => {
      await page.goto('/definitely-not-a-real-route');

      await expect(page.getByRole('heading', { name: 'Page not found', level: 2 })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Return to the home page' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Browse the public gallery' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await attachRenderedScreenshot(testInfo, page, 'not-found-375x812');
    });
  });
});
