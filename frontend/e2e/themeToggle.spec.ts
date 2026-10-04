import { expect, test } from '@playwright/test';

async function readThemeState(page: import('@playwright/test').Page) {
  return page.locator('html').evaluate((root) => ({
    theme: root.dataset.theme,
    preference: root.dataset.themePreference,
  }));
}

test.describe('visitor theme preference (#644)', () => {
  test('persists light/dark/system choices across routes and reloads', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    await expect.poll(() => readThemeState(page)).toEqual({ theme: 'dark', preference: 'system' });
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();

    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await expect.poll(() => readThemeState(page)).toEqual({ theme: 'light', preference: 'light' });
    await page.reload();
    await expect.poll(() => readThemeState(page)).toEqual({ theme: 'light', preference: 'light' });

    await page.goto('/gallery');
    await expect.poll(() => readThemeState(page)).toEqual({ theme: 'light', preference: 'light' });
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect.poll(() => readThemeState(page)).toEqual({ theme: 'dark', preference: 'dark' });
    await page.reload();
    await expect.poll(() => readThemeState(page)).toEqual({ theme: 'dark', preference: 'dark' });

    await page.emulateMedia({ colorScheme: 'light' });
    await page.evaluate(() => localStorage.removeItem('augmentrart:theme-preference:v1'));
    await page.reload();
    await expect.poll(() => readThemeState(page)).toEqual({ theme: 'light', preference: 'system' });
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => readThemeState(page)).toEqual({ theme: 'dark', preference: 'system' });
  });

  test('pre-paint preference applies on a shell-less immersive route', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('augmentrart:theme-preference:v1', 'dark'));
    await page.goto('/immersive/p3d/not-a-real-piece');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
