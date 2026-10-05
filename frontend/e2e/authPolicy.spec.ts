/** Browser acceptance for the explicit Google-only signup policy (#416). */
import { expect, test, type Page } from '@playwright/test';

async function getThemedRootBackgroundColor(page: Page): Promise<string> {
  return page.locator('html').evaluate((root) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--bg)';
    root.append(probe);
    const backgroundColor = getComputedStyle(probe).color;
    probe.remove();
    return backgroundColor;
  });
}

test.describe('Google-only account creation policy', () => {
  test('desktop auth pages use the themed shell and preserve provider policy', async ({
    page,
  }, testInfo) => {
    await page.goto('/accounts/signup/');
    await expect(
      page.getByRole('heading', { name: 'Sign-up is currently unavailable' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'New accounts can be created with an enabled social sign-in provider after you consent.',
      ),
    ).toBeVisible();
    await expect(page.locator('#signup-form')).toHaveCount(0);

    await page.goto('/accounts/login/');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(
      page.getByText(
        'New accounts can be created with an enabled social sign-in provider after you consent.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /sign up/i })).toHaveCount(0);
    await expect(page.locator('html')).toHaveCSS(
      'background-color',
      await getThemedRootBackgroundColor(page),
    );
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
    await expect(page.locator('html')).toHaveCSS(
      'background-color',
      await getThemedRootBackgroundColor(page),
    );
    await page.screenshot({ path: testInfo.outputPath('auth-signup-375x812.png'), fullPage: true });
  });
});
