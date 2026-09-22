import { expect, test } from '@playwright/test';

test.describe('compact mobile header (#713)', () => {
  test('keeps display settings inside the closed hamburger menu at 375px', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const header = page.getByRole('banner');
    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(headerBox!.height).toBeLessThanOrEqual(812 * 0.25);
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Color mode/ })).toBeHidden();
    await expect(page.getByRole('radiogroup', { name: 'Reduce motion' })).toBeHidden();

    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('combobox', { name: /Color mode/ })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Reduce motion' })).toBeVisible();
    await expect(page.locator('.reduced-motion-status')).toHaveClass(/visually-hidden/);
    await page.screenshot({ path: testInfo.outputPath('header-mobile-open.png'), fullPage: true });
  });

  test('retains the full desktop header at the 768px boundary', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: /menu/i })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: /Color mode/ })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Reduce motion' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('header-tablet.png'), fullPage: true });
  });
});
