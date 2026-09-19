import { expect, test } from '@playwright/test';

import { apiGet, apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Theme customization (#521)', () => {
  const fixtures = requireE2EFixtures();

  test('admin and profile token controls are scoped and responsive', async ({
    page,
    context,
  }, testInfo) => {
    await loginViaUI(page, fixtures.admin.email, fixtures.password);
    await page.goto('/admin/settings');
    const settings = (await (await apiGet(context, '/api/admin/settings/')).json()) as {
      revision: number;
      theme_config: Record<string, string>;
    };
    const themeForm = page.getByRole('form', { name: 'Site title settings' });
    await expect(themeForm.getByLabel('accent', { exact: true })).toBeVisible();
    await themeForm.getByLabel('accent', { exact: true }).fill('#00ff00');
    await themeForm.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(themeForm.getByText('Global site metadata saved.')).toBeVisible();
    await apiPatch(context, '/api/admin/settings/', {
      site_title: 'AugmentrART',
      theme_config: settings.theme_config,
      revision: settings.revision + 1,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: testInfo.outputPath('theme-1280x900.png'), fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: testInfo.outputPath('theme-375x812.png'), fullPage: true });
  });
});
