import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Application-admin CMS pages (#517, #594)', () => {
  const fixtures = requireE2EFixtures();

  test('anonymous and ordinary users cannot discover the admin console', async ({ page }) => {
    await page.goto('/admin/pages');
    await expect(page).toHaveURL(/\/$/);

    await loginViaUI(page, fixtures.other.email, fixtures.password);
    await page.goto('/admin/pages');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Pages' })).toHaveCount(0);
  });

  test('admin can create, publish, inspect, and trash a page at both viewports', async ({
    page,
  }, testInfo) => {
    await loginViaUI(page, fixtures.admin.email, fixtures.password);
    await page.goto('/admin/pages');
    await expect(page.getByRole('heading', { name: 'Pages' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return to public site' })).toBeVisible();

    await page.getByLabel('Title', { exact: true }).fill('E2E CMS Page');
    await page.getByLabel('Slug', { exact: true }).fill('e2e-cms-page');
    await page.getByLabel('Description', { exact: true }).fill('Published CMS content.');
    await page.getByLabel('Status', { exact: true }).selectOption('published');
    await page.getByRole('button', { name: 'Save page' }).click();
    await expect(page.getByText('Page saved.', { exact: true })).toBeVisible();

    const pageRow = page.locator('.admin-page-row').filter({ hasText: 'E2E CMS Page' });
    await expect(pageRow).toContainText('published');
    await expect(pageRow).toContainText('e2e-cms-page');

    const publicResponse = await page.request.get('/api/pages/e2e-cms-page/');
    expect(publicResponse.status()).toBe(200);
    expect(await publicResponse.json()).toMatchObject({
      title: 'E2E CMS Page',
      slug: 'e2e-cms-page',
      description: 'Published CMS content.',
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: testInfo.outputPath('admin-pages-1280x900.png'),
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      1280,
    );
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: testInfo.outputPath('admin-pages-375x812.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );

    page.once('dialog', (dialog) => void dialog.accept());
    await pageRow.getByRole('button', { name: 'Move to trash' }).click();
    await expect(page.locator('.admin-page-row').filter({ hasText: 'E2E CMS Page' })).toHaveCount(
      0,
    );
    expect((await page.request.get('/api/pages/e2e-cms-page/')).status()).toBe(404);
  });
});
