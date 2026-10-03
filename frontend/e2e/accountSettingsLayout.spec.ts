import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

const sections = (page: import('@playwright/test').Page) =>
  page
    .locator('[data-settings-section]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-settings-section')));

test.describe('account settings layout persistence (#555)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`persists keyboard reorder and recovers malformed storage at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/account/settings');

      await page.getByRole('button', { name: 'Expand Automatic retry' }).click();

      const initialOrder = await sections(page);
      const retryIndex = initialOrder.indexOf('retry');
      expect(retryIndex).toBeGreaterThanOrEqual(0);
      for (let index = 0; index < retryIndex; index += 1) {
        await page.getByRole('button', { name: 'Move Automatic retry up' }).click();
      }
      const reordered = await sections(page);
      expect(reordered).toEqual([
        'retry',
        ...initialOrder.filter((section) => section !== 'retry'),
      ]);
      expect(reordered[0]).toBe('retry');
      await page
        .locator('[data-settings-section="retry"]')
        .getByRole('button', { name: 'Collapse' })
        .click();
      await page.reload();
      await expect(
        page
          .locator('[data-settings-section="retry"]')
          .getByRole('button', { name: 'Expand Automatic retry' }),
      ).toBeVisible();
      expect((await sections(page))[0]).toBe('retry');

      await page.evaluate(() =>
        localStorage.setItem(
          `augmentrart:account-settings-layout:v1:${'e2e-owner@example.test'}`,
          '{invalid',
        ),
      );
      await page.reload();
      await expect(page.locator('[data-settings-section]').first()).toBeVisible();
      expect((await sections(page))[0]).toBe('plan');
      await page.getByRole('button', { name: 'Expand Plan and usage' }).click();
      await expect(
        page.locator('[data-settings-section="plan"]').getByRole('button', { name: 'Collapse' }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Use reduced motion' }).click();
      await expect(page.getByRole('button', { name: 'Use full motion' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  }
});
