import { expect, test } from '@playwright/test';

test.describe('public reference shell (#645)', () => {
  test('renders the brand and inline public navigation on desktop', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/gallery');

    await expect(page.getByRole('heading', { name: 'AugmentrART' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Public gallery' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
    await expect(page.locator('.app-shell-header')).toHaveCSS('border-bottom-width', '1px');
    await page.screenshot({
      path: testInfo.outputPath('public-shell-desktop.png'),
      fullPage: true,
    });
  });

  test('collapses to the existing hamburger pattern on mobile', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/gallery');

    await expect(page.getByRole('heading', { name: 'AugmentrART' })).toBeVisible();
    const menuButton = page.getByRole('button', { name: 'Open menu' });
    await expect(menuButton).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeHidden();
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 375);

    await menuButton.click();
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Public gallery' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.screenshot({ path: testInfo.outputPath('public-shell-mobile.png'), fullPage: true });
  });
});
