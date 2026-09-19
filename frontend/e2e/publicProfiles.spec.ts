import { expect, test } from '@playwright/test';

import { apiGet, apiPatch } from './support/api.js';
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
    const publicHandle = `e2e-profile-${testInfo.project.name}-${Date.now().toString(36)}`.slice(
      0,
      32,
    );
    await page.getByLabel('Handle').fill(publicHandle);
    await page.getByLabel('Display name').fill('E2E Artist');
    await page.getByLabel('Bio').fill('A public profile bio.');
    await page.getByLabel('Make profile public').check();
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Profile saved.')).toBeVisible();

    // Use the server's canonical response rather than assuming the submitted
    // handle survived validation/normalization unchanged. This also makes a
    // failed profile write observable before the browser follows the public
    // route, instead of turning it into an opaque missing-heading failure.
    const savedProfile = (await (await apiGet(page.context(), '/api/account/profile/')).json()) as {
      handle: string;
      display_name: string;
      is_public: boolean;
    };
    expect(savedProfile.handle).toBe(publicHandle);
    expect(savedProfile.display_name).toBe('E2E Artist');
    expect(savedProfile.is_public).toBe(true);
    await page.goto(`/users/@${savedProfile.handle}`);
    await expect(page.getByRole('heading', { name: 'E2E Artist' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Public pieces' })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: testInfo.outputPath('profile-1280x900.png'), fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: testInfo.outputPath('profile-375x812.png'), fullPage: true });

    const current = await (await apiGet(page.context(), '/api/account/profile/')).json();
    await apiPatch(page.context(), '/api/account/profile/', {
      ...(current as Record<string, unknown>),
      handle: 'e2e_other',
      is_public: false,
    });
  });
});
