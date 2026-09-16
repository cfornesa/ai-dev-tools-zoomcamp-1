import { expect, test } from '@playwright/test';

import { apiGet } from './support/api.js';

const VIEWPORTS = [
  { width: 1280, height: 812 },
  { width: 375, height: 812 },
];

type GalleryPage = {
  engine_catalog: Array<{ value: string; label: string; count: number; available: boolean }>;
};

test.describe('public gallery engine filter (#564)', () => {
  for (const viewport of VIEWPORTS) {
    test(`derives supported engines and persists the filter at ${viewport.width}x${viewport.height}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize(viewport);
      const response = await apiGet(context, '/api/public/gallery/?type=generated');
      expect(response.ok()).toBe(true);
      const body = (await response.json()) as GalleryPage;

      await page.goto('/gallery?type=generated');
      const engine = page.getByRole('combobox', { name: 'Gallery engine' });
      await expect(engine).toBeVisible();
      await expect(engine.locator('option')).toHaveCount(body.engine_catalog.length + 1);
      for (const option of body.engine_catalog) {
        const uiOption = engine.locator(`option[value="${option.value}"]`);
        await expect(uiOption).toHaveText(`${option.label} (${option.count})`);
        if (option.available) {
          await expect(uiOption).not.toBeDisabled();
        } else {
          await expect(uiOption).toBeDisabled();
        }
      }

      const firstAvailable = body.engine_catalog.find((option) => option.available);
      if (firstAvailable) {
        await engine.selectOption(firstAvailable.value);
        await expect(page).toHaveURL(
          new RegExp(`[?&]type=generated(?:&engine=${firstAvailable.value}|$)`),
        );
        await page.reload();
        await expect(engine).toHaveValue(firstAvailable.value);
      }
    });
  }
});
