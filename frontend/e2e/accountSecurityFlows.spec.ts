import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 812 },
  { width: 375, height: 812 },
];

test.describe('account security flows (#562/#563)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`renders verified-email and password security forms at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);

      const emailResponse = await page.goto('/accounts/email/');
      expect(emailResponse?.status()).toBe(200);
      await expect(page.getByRole('textbox', { name: 'Email:' })).toBeVisible();
      await expect(page.getByRole('button', { name: /add email/i })).toBeVisible();
      await expect(page.getByText(fixtures.owner.email)).toBeVisible();

      const passwordResponse = await page.goto('/accounts/password/set/');
      expect(passwordResponse?.status()).toBe(200);
      await expect(page.locator('input[name="password1"]')).toBeVisible();
      await expect(page.locator('input[name="password2"]')).toBeVisible();

      const anonymousContext = await page.context().browser()!.newContext();
      const anonymousPage = await anonymousContext.newPage();
      const resetResponse = await anonymousPage.goto('/accounts/password/reset/');
      expect(resetResponse?.status()).toBe(200);
      await expect(anonymousPage.locator('input[name="email"]')).toBeVisible();
      await expect(anonymousPage.locator('body')).not.toContainText(fixtures.owner.email);
      await anonymousContext.close();
    });
  }
});
