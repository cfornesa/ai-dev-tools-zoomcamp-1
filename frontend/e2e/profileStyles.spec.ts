import { expect, test, type BrowserContext } from '@playwright/test';

import { apiGet, apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

async function profile(context: BrowserContext) {
  const response = await apiGet(context, '/api/account/profile/');
  expect(response.ok()).toBe(true);
  return (await response.json()) as {
    handle: string;
    style_key: string;
    is_public: boolean;
    revision: number;
    available_styles: Array<{ key: string }>;
  };
}

test.describe('profile style catalog (#552)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`admin controls and responsive style selection at ${viewport.width}x${viewport.height}`, async ({
      browser,
    }) => {
      const adminContext = await browser.newContext({ baseURL: 'http://localhost:5000' });
      const adminPage = await adminContext.newPage();
      await adminPage.setViewportSize(viewport);
      await loginViaUI(adminPage, fixtures.admin.email, fixtures.password);

      const ordinaryContext = await browser.newContext({ baseURL: 'http://localhost:5000' });
      const ordinaryPage = await ordinaryContext.newPage();
      await ordinaryPage.setViewportSize(viewport);
      await loginViaUI(ordinaryPage, fixtures.other.email, fixtures.password);

      const anonymousStyles = await apiGet(
        await browser.newContext(),
        '/api/admin/profile-styles/',
      );
      expect(anonymousStyles.status()).toBe(401);
      const ordinaryStyles = await apiGet(ordinaryContext, '/api/admin/profile-styles/');
      expect(ordinaryStyles.status()).toBe(403);

      await adminPage.goto('/admin/settings');
      await expect(adminPage.getByRole('heading', { name: 'Profile style catalog' })).toBeVisible();
      await expect(adminPage.getByLabel('Ocean preview')).toBeVisible();

      const stylesResponse = await apiGet(adminContext, '/api/admin/profile-styles/');
      const styles = (await stylesResponse.json()) as Array<{
        id: number;
        key: string;
        enabled: boolean;
        revision: number;
      }>;
      const ocean = styles.find((style) => style.key === 'ocean');
      if (!ocean) throw new Error('Expected seeded ocean style.');

      const before = await profile(ordinaryContext);
      const selected = await apiPatch(ordinaryContext, '/api/account/profile/', {
        revision: before.revision,
        style_key: 'ocean',
        theme_config: {},
      });
      expect(selected.ok(), await selected.text()).toBe(true);
      expect((await selected.json()).style_key).toBe('ocean');

      const disabled = await apiPatch(adminContext, `/api/admin/profile-styles/${ocean.id}/`, {
        enabled: false,
        revision: ocean.revision,
      });
      expect(disabled.ok(), await disabled.text()).toBe(true);

      const stillReadable = await profile(ordinaryContext);
      expect(stillReadable.style_key).toBe('ocean');
      expect(stillReadable.available_styles.some((style) => style.key === 'ocean')).toBe(false);
      const defaulted = await apiPatch(ordinaryContext, '/api/account/profile/', {
        revision: stillReadable.revision,
        style_key: 'default',
        theme_config: {},
      });
      expect(defaulted.ok()).toBe(true);
      const rejected = await apiPatch(ordinaryContext, '/api/account/profile/', {
        revision: (await profile(ordinaryContext)).revision,
        style_key: 'ocean',
      });
      expect(rejected.status()).toBe(400);

      const restored = await apiPatch(adminContext, `/api/admin/profile-styles/${ocean.id}/`, {
        enabled: true,
        revision: (await (await apiGet(adminContext, '/api/admin/profile-styles/')).json()).find(
          (style: { id: number }) => style.id === ocean.id,
        ).revision,
      });
      expect(restored.ok()).toBe(true);

      await ordinaryPage.goto('/account/settings');
      await expect(ordinaryPage.getByLabel('Profile style', { exact: true })).toBeVisible();
      await expect(ordinaryPage.getByLabel('Profile style preview')).toBeVisible();
      await ordinaryPage.getByLabel('Profile style', { exact: true }).selectOption('ocean');
      await ordinaryPage.getByRole('button', { name: 'Save profile' }).click();
      await expect(ordinaryPage.getByText('Profile saved.')).toBeVisible();
      await ordinaryPage.getByRole('button', { name: 'Reset style' }).click();

      await adminContext.close();
      await ordinaryContext.close();
    });
  }
});
