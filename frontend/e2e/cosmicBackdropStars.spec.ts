import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
] as const;

async function stubCosmicTheme(page: Page) {
  await page.route('**/api/site-theme/', async (route) =>
    route.fulfill({
      json: {
        site_title: 'AugmentrART',
        presentation: {
          font_family: 'script',
          density: 'comfortable',
          radius: 'soft',
          border_style: 'solid',
          backdrop: 'cosmic',
        },
      },
    }),
  );
}

test.describe('Cosmic backdrop star field (#807)', () => {
  for (const viewport of VIEWPORTS) {
    test(`renders a bounded decorative field at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await stubCosmicTheme(page);
      await page.setViewportSize(viewport);
      await page.goto('/');

      const field = page.getByTestId('cosmic-starfield');
      await expect(field).toBeVisible();
      await expect(field).toHaveAttribute('aria-hidden', 'true');
      await expect(field).toHaveCSS('pointer-events', 'none');
      await expect(field.locator('.cosmic-star')).toHaveCount(90);
      await expect(page.locator('.app-shell > .skip-link')).toHaveCSS('z-index', '1');

      await page.screenshot({
        path: testInfo.outputPath(`cosmic-${viewport.width}.png`),
        fullPage: true,
      });
      const before = await field.screenshot();
      await page.waitForTimeout(2100);
      const after = await field.screenshot();
      expect(Buffer.compare(before, after)).not.toBe(0);
    });
  }
});
