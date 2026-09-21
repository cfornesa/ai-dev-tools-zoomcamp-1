import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('Account settings spacing (#680)', () => {
  const fixtures = requireE2EFixtures();

  test('uses shared spacing tokens without overflow at desktop and mobile widths', async ({
    browser,
  }, testInfo) => {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.admin.email, fixtures.password);
      await page.addInitScript((email) => {
        localStorage.setItem(
          `augmentrart:account-settings-layout:v1:${email}`,
          JSON.stringify({
            order: ['plan', 'profile', 'management', 'credentials', 'models', 'personas', 'retry'],
            expanded: {
              plan: true,
              profile: true,
              management: true,
              credentials: true,
              models: true,
              personas: true,
              retry: true,
            },
          }),
        );
      }, fixtures.admin.email);
      await page.goto('/account/settings');
      await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible();
      await expect(page.getByRole('form', { name: 'Profile settings' })).toBeVisible();

      const metrics = await page.locator('.account-settings').evaluate((root) => {
        const grid = root.querySelector<HTMLElement>('.account-settings-grid');
        const layoutItem = root.querySelector<HTMLElement>('.account-settings-layout-item');
        const form = root.querySelector<HTMLElement>('.account-settings-form');
        const field = root.querySelector<HTMLElement>('.account-settings-field');
        if (!grid || !layoutItem || !form || !field) throw new Error('Expected account layout.');
        const rootStyle = getComputedStyle(root);
        const gridStyle = getComputedStyle(grid);
        const itemStyle = getComputedStyle(layoutItem);
        const formStyle = getComputedStyle(form);
        const fieldStyle = getComputedStyle(field);
        return {
          gridGap: gridStyle.gap,
          gridPadding: gridStyle.padding,
          cardPadding: itemStyle.padding,
          formGap: formStyle.gap,
          fieldGap: fieldStyle.gap,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          space2: rootStyle.getPropertyValue('--space-2').trim(),
          space4: rootStyle.getPropertyValue('--space-4').trim(),
          space6: rootStyle.getPropertyValue('--space-6').trim(),
          space8: rootStyle.getPropertyValue('--space-8').trim(),
        };
      });

      expect(metrics).toMatchObject({
        gridGap: '24px',
        cardPadding: '24px',
        formGap: '16px',
        fieldGap: '8px',
        space2: '8px',
        space4: '16px',
        space6: '24px',
        space8: '32px',
      });
      expect(metrics.gridPadding).toContain(viewport.width === 375 ? '32px' : '32px');
      expect(metrics.overflow).toBeLessThanOrEqual(0);

      await page.screenshot({
        path: testInfo.outputPath(
          `account-settings-spacing-${viewport.width}x${viewport.height}.png`,
        ),
        fullPage: true,
      });
      await context.close();
    }
  });
});
