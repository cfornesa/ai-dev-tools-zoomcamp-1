import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Atomic capability policy (#519)', () => {
  const fixtures = requireE2EFixtures();

  test('admin sees role sections and global switches at desktop and mobile sizes', async ({
    page,
  }, testInfo) => {
    await loginViaUI(page, fixtures.admin.email, fixtures.password);
    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: 'Roles and global permissions' })).toBeVisible();
    await expect(page.getByRole('group', { name: /Free \(free\)/i })).toBeVisible();
    await expect(page.getByRole('group', { name: /Premium \(premium\)/i })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Global switches' })).toBeVisible();
    await expect(
      page
        .getByRole('group', { name: 'Global switches' })
        .getByLabel('cloud_project_sync', { exact: true }),
    ).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: testInfo.outputPath('capabilities-1280x900.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({
      path: testInfo.outputPath('capabilities-375x812.png'),
      fullPage: true,
    });
  });
});
