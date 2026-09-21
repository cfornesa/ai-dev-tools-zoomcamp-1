import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
] as const;

test.describe('Authenticated app-shell style (#676)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`applies the effective Celestial style at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);

      for (const route of ['/studio', '/account/settings']) {
        await page.goto(route);
        await expect(page.locator('.app-shell')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-site-font', 'script');
        await expect(page.locator('html')).toHaveAttribute('data-site-backdrop', 'cosmic');
        await expect(page.locator('body')).toHaveCSS('font-family', /Lora/);
        await expect(page.locator('h1').first()).toHaveCSS('font-family', /Pinyon Script/);
        await expect(page.locator('.app-shell button').first()).toHaveCSS('border-radius', '8px');

        const overflowing = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(overflowing).toBe(false);
        await page.screenshot({
          path: testInfo.outputPath(`${route.slice(1).replace('/', '-')}-${viewport.width}.png`),
          fullPage: true,
        });
      }
    });
  }
});
