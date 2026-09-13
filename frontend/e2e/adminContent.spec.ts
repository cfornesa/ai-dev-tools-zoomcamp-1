import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { apiPost } from './support/api.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Application-admin content operations (#518)', () => {
  const fixtures = requireE2EFixtures();

  test('anonymous and ordinary users cannot discover content operations', async ({ page }) => {
    await page.goto('/admin/content');
    await expect(page).toHaveURL(/\/$/);

    await loginViaUI(page, fixtures.other.email, fixtures.password);
    await page.goto('/admin/content');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Content operations' })).toHaveCount(0);
  });

  test('admin can inspect and safely trash/restore server content responsively', async ({
    page,
  }, testInfo) => {
    await loginViaUI(page, fixtures.admin.email, fixtures.password);
    const created = await apiPost(page.context(), '/api/projects/blank/');
    expect(created.status()).toBe(201);

    await page.goto('/admin/content');
    await expect(page.getByRole('heading', { name: 'Content operations' })).toBeVisible();
    const row = page.locator('.admin-page-row').filter({ hasText: 'Untitled animation' }).first();
    await expect(row).toContainText('project');
    await expect(row).toContainText(fixtures.admin.username);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: testInfo.outputPath('admin-content-1280x900.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({
      path: testInfo.outputPath('admin-content-375x812.png'),
      fullPage: true,
    });

    page.once('dialog', (dialog) => void dialog.accept());
    await row.getByRole('button', { name: 'Move to trash' }).click();
    await expect(row.getByRole('button', { name: 'Restore' })).toBeVisible();
    await row.getByRole('button', { name: 'Restore' }).click();
    await expect(row.getByRole('button', { name: 'Move to trash' })).toBeVisible();
  });
});
