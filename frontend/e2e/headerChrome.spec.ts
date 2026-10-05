import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
] as const;

test.describe('Header chrome (#674)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`fits the toolbar and exposes one mode control at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/studio');

      const displaySettings = page.getByRole('complementary', { name: 'Display settings' });
      await expect(displaySettings).toBeVisible();
      await expect(
        displaySettings.getByRole('button', { name: /Switch to (light|dark) mode/i }),
      ).toHaveCount(1);
      await expect(
        page
          .locator('.app-shell-header')
          .getByRole('button', { name: /Switch to (light|dark) mode/i }),
      ).toHaveCount(0);
      await expect(
        displaySettings.getByRole('button', { name: /Use (reduced|full) motion/i }),
      ).toBeVisible();

      const overflowing = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflowing).toBe(false);

      const touchTargetHeights = await page
        .locator('.app-shell-header .shell-action')
        .evaluateAll((elements) =>
          elements
            .filter((element) => element.getClientRects().length > 0)
            .map((element) => element.getBoundingClientRect().height),
        );
      expect(touchTargetHeights.every((height) => height >= 44)).toBe(true);
    });
  }
});
