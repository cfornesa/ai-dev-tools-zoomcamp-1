import { expect, test } from '@playwright/test';

test.describe('compact mobile header (#713)', () => {
  test('keeps page navigation in the hamburger and places display settings after mobile content', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const header = page.getByRole('banner');
    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(headerBox!.height).toBeLessThanOrEqual(812 * 0.25);
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    const displayToggles = page.locator('.shell-display-toggles');
    await expect(displayToggles).toHaveCSS('position', 'static');
    await expect(
      displayToggles.getByRole('button', { name: /Use (reduced|full) motion/i }),
    ).toBeVisible();
    await expect(
      displayToggles.getByRole('button', { name: /Switch to (light|dark) mode/i }),
    ).toBeVisible();
    await displayToggles.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('header-mobile-open.png'), fullPage: true });
  });

  test('retains the full desktop header at the 768px boundary', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: /menu/i })).toHaveCount(0);
    const displayToggles = page.locator('.shell-display-toggles');
    await expect(displayToggles).toHaveCSS('position', 'fixed');
    await expect(
      displayToggles.getByRole('button', { name: /Switch to (light|dark) mode/i }),
    ).toBeVisible();
    await expect(
      displayToggles.getByRole('button', { name: /Use (reduced|full) motion/i }),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('header-tablet.png'), fullPage: true });
  });
});
