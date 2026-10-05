import { expect, test } from '@playwright/test';

test('login page separates password and social sign-in accessibly at mobile and desktop sizes', async ({
  page,
}, testInfo) => {
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('/accounts/login/');

      await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
      await expect(page.getByRole('separator', { name: 'or continue with' })).toBeVisible();
      const providerGroup = page.getByRole('region', { name: 'Continue with a provider' });
      await expect(providerGroup).toBeVisible();
      const providerButtons = providerGroup.getByRole('button');
      const providerNames = (await providerButtons.allTextContents()).map((name) => name.trim());
      expect(providerNames).toEqual([...providerNames].sort((a, b) => a.localeCompare(b)));
      expect(await providerButtons.count()).toBeGreaterThan(0);
      const providerForms = providerGroup.locator('form');
      expect(await providerForms.count()).toBe(providerNames.length);
      for (const form of await providerForms.all()) {
        await expect(form).toHaveAttribute('method', 'post');
        await expect(form.locator('input[name="csrfmiddlewaretoken"]')).toHaveCount(1);
        await expect(form.locator('button[type="submit"]')).toHaveCount(1);
      }
      await expect(
        page.getByText(
          'New accounts can be created with an enabled social sign-in provider after you consent.',
        ),
      ).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));
      expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
      await page.screenshot({
        path: testInfo.outputPath(`login-${viewport.width}-${theme}.png`),
        fullPage: true,
      });
    }
  }
});
