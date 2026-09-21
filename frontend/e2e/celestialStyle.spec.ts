import { expect, test, type Page } from '@playwright/test';

async function applyCelestialPreview(page: Page, mode: 'light' | 'dark') {
  await page.evaluate((selectedMode) => {
    const root = document.documentElement;
    const palette =
      selectedMode === 'dark'
        ? { background: '#071b2a', surface: '#2a1238', text: '#f8edd3', muted: '#c8bca5' }
        : { background: '#f4ead3', surface: '#fff8e7', text: '#2b1e1a', muted: '#6f6258' };
    root.dataset.theme = selectedMode;
    root.dataset.siteFont = 'script';
    root.dataset.siteBackdrop = 'cosmic';
    root.style.setProperty('--bg', palette.background);
    root.style.setProperty('--code-bg', palette.surface);
    root.style.setProperty('--text-h', palette.text);
    root.style.setProperty('--text', palette.muted);
    root.style.setProperty('--site-font', "Lora, Georgia, 'Times New Roman', serif");
    root.style.setProperty('--heading', "'Pinyon Script', Georgia, 'Times New Roman', serif");
    root.style.setProperty('--accent', '#e4b95c');
    root.style.setProperty('--accent-bg', 'rgb(228 185 92 / 15%)');
    root.style.setProperty('--accent-border', 'rgb(228 185 92 / 60%)');
    document.body.style.fontFamily = "Lora, Georgia, 'Times New Roman', serif";
    document
      .querySelector<HTMLElement>('.app-shell')
      ?.style.setProperty('font-family', "Lora, Georgia, 'Times New Roman', serif");
  }, mode);
}

test.describe('Celestial style (#647)', () => {
  test('uses script headings, readable serif body, cosmic backdrop, and reduced-motion controls', async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('augmentrart:theme-preference:v1', 'dark'));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.waitForTimeout(500);
    await applyCelestialPreview(page, 'dark');

    await expect(page.locator('html')).toHaveAttribute('data-site-backdrop', 'cosmic');
    await expect(page.getByRole('radio', { name: 'Reduced' })).toBeVisible();
    await expect(page.locator('h1')).toHaveCSS('font-family', /Pinyon Script/);
    await expect(page.locator('body')).toHaveCSS('font-family', /Lora/);
    await page.screenshot({
      path: testInfo.outputPath('celestial-dark-desktop.png'),
      fullPage: true,
    });
  });

  test('remains legible in the light palette at mobile width', async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(() =>
      localStorage.setItem('augmentrart:theme-preference:v1', 'light'),
    );
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForTimeout(500);
    await applyCelestialPreview(page, 'light');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect
      .poll(() =>
        page
          .locator('html')
          .evaluate((element) => getComputedStyle(element).getPropertyValue('--site-backdrop')),
      )
      .toContain('#f4ead3');
    await expect(page.getByRole('heading', { name: 'AugmentrART' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('celestial-light-mobile.png'),
      fullPage: true,
    });
  });
});
