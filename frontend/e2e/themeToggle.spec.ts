import { expect, test } from '@playwright/test';

test.describe('visitor theme preference (#644)', () => {
  test('persists light/dark/system choices across routes and reloads', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => {
      if (!localStorage.getItem('augmentrart:theme-preference:v1')) {
        localStorage.setItem('augmentrart:theme-preference:v1', 'dark');
      }
    });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const toggle = page.getByRole('button', { name: 'Switch to light mode' });
    await expect(toggle).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Color mode preference' })).toHaveValue('dark');

    await page.getByRole('combobox', { name: 'Color mode preference' }).selectOption('light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.goto('/gallery');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.getByRole('combobox', { name: 'Color mode preference' }).selectOption('system');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('pre-paint preference applies on a shell-less immersive route', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('augmentrart:theme-preference:v1', 'dark'));
    await page.goto('/immersive/p3d/not-a-real-piece');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
