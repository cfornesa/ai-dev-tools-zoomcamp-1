import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Public profiles (#520)', () => {
  const fixtures = requireE2EFixtures();

  test('owner publishes profile metadata and only its public profile route is visible', async ({
    page,
  }, testInfo) => {
    await loginViaUI(page, fixtures.other.email, fixtures.password);
    await page.goto('/account/settings');
    await expect(page.getByRole('heading', { name: 'Public profile' })).toBeVisible();
    await expect(page.getByLabel('Handle')).toHaveValue('e2e_other');
    await page.getByLabel('Handle').fill('e2e-profile');
    await page.getByLabel('Display name').fill('E2E Artist');
    await page.getByLabel('Bio').fill('A public profile bio.');
    await page.getByLabel('Make profile public').check();
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Profile saved.')).toBeVisible();

    await page.goto('/users/@e2e-profile');
    await expect(page.getByRole('heading', { name: 'E2E Artist' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Public pieces' })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: testInfo.outputPath('profile-1280x900.png'), fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: testInfo.outputPath('profile-375x812.png'), fullPage: true });
  });
});
