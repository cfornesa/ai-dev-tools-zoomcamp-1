/** Browser acceptance for the explicit Google-only signup policy (#416). */
import { expect, test } from '@playwright/test';

test.describe('Google-only account creation policy', () => {
  test('desktop auth pages use the dark shell and preserve provider policy', async ({
    page,
  }, testInfo) => {
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
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(22, 23, 29)');
    await page.screenshot({ path: testInfo.outputPath('auth-login-1280x900.png'), fullPage: true });
  });

  test('mobile auth pages preserve the same policy and remain usable', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/accounts/signup/');
    await expect(
      page.getByRole('heading', { name: 'Sign-up is currently unavailable' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return to log in' })).toBeVisible();
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(22, 23, 29)');
    await page.screenshot({ path: testInfo.outputPath('auth-signup-375x812.png'), fullPage: true });
  });
});
