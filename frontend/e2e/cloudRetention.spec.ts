import { expect, test } from '@playwright/test';

import { apiGet, apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Cloud media retention policy (#522)', () => {
  const fixtures = requireE2EFixtures();

  test('admin can inspect and update the bounded policy responsively', async ({
    page,
    context,
  }, testInfo) => {
    await loginViaUI(page, fixtures.admin.email, fixtures.password);
    await page.goto('/admin/settings');
    const form = page.getByRole('form', { name: 'Cloud retention policy' });
    await expect(form).toBeVisible();
    const baseline = await (await apiGet(context, '/api/admin/cloud-retention/')).json();
    const deletedInput = form.getByLabel('Deleted project grace days');
    await deletedInput.fill('31');
    await form.getByRole('button', { name: 'Save retention policy' }).click();
    await expect(form.getByRole('status')).toContainText('saved');
    expect(
      (await (await apiGet(context, '/api/admin/cloud-retention/')).json()).deleted_grace_days,
    ).toBe(31);
    await apiPatch(context, '/api/admin/cloud-retention/', baseline);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: testInfo.outputPath('cloud-retention-1280x900.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({
      path: testInfo.outputPath('cloud-retention-375x812.png'),
      fullPage: true,
    });
  });
});
