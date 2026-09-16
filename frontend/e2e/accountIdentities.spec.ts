import { expect, test } from '@playwright/test';

import { apiGet } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('account identity linking UI (#559)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`renders provider-aware connect forms at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/account/settings/identities');
      await expect(page.getByRole('heading', { name: 'Linked sign-in methods' })).toBeVisible();
      const providers = (await (
        await apiGet(page.context(), '/api/account/identity-providers/')
      ).json()) as Array<{
        provider: string;
        enabled: boolean;
      }>;
      const linked = (await (
        await apiGet(page.context(), '/api/account/identities/')
      ).json()) as Array<{
        provider: string;
      }>;
      const linkedProviders = new Set(linked.map((item) => item.provider));
      for (const provider of providers.filter(
        (item) => item.enabled && !linkedProviders.has(item.provider),
      )) {
        const form = page.locator(`form[action="/accounts/${provider.provider}/login/"]`);
        await expect(form).toHaveCount(1);
        await expect(form.locator('input[name="process"]')).toHaveValue('connect');
        await expect(form.locator('input[name="next"]')).toHaveValue(
          '/account/settings/identities',
        );
      }
      expect(await page.locator('form input[name="process"][value="connect"]').count()).toBe(
        providers.filter((item) => item.enabled && !linkedProviders.has(item.provider)).length,
      );
    });
  }
});
