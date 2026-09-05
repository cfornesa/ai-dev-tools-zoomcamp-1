/** Browser acceptance for the explicit Google-only signup policy (#416). */
import { expect, test } from '@playwright/test';

test.describe('Google-only account creation policy', () => {
  test('desktop signup is closed and login offers Google account creation', async ({ page }) => {
    await page.goto('/accounts/signup/');
    await expect(
      page.getByRole('heading', { name: 'Sign-up is currently unavailable' }),
    ).toBeVisible();
    await expect(page.getByText('uses Google sign-in for new accounts.')).toBeVisible();
    await expect(page.locator('#signup-form')).toHaveCount(0);

    await page.goto('/accounts/login/');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByText('Continue with Google to create your account.')).toBeVisible();
    await expect(page.getByRole('link', { name: /sign up/i })).toHaveCount(0);
  });

  test('mobile signup preserves the same policy and remains usable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/accounts/signup/');
    await expect(
      page.getByRole('heading', { name: 'Sign-up is currently unavailable' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return to log in' })).toBeVisible();
  });
});
