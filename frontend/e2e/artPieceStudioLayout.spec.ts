import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Art piece studio form layout (#1082)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;

  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`keeps the form usable at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixture.empty.email, fixture.password);
      // App.tsx's current route table names the studio /art-pieces; the
      // issue's older /art-piece/s shorthand is no longer registered.
      await page.goto('/art-pieces');

      const studio = page.locator('.art-piece-studio');
      const form = studio.locator('form');
      const controls = studio.locator('select, input, textarea');
      const textarea = page.getByLabel('Describe the art piece you want to generate');

      await expect(studio).toBeVisible();
      await expect(textarea).toHaveAttribute('rows', '8');
      await expect(textarea).toHaveCSS('min-height', /^(1[2-9]\d|[2-9]\d\d)px$/);
      const formBox = await form.boundingBox();
      expect(formBox).not.toBeNull();
      for (let index = 0; index < (await controls.count()); index += 1) {
        const box = await controls.nth(index).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(formBox!.width * 0.8);
      }
      await page.screenshot({
        path: testInfo.outputPath(`art-piece-studio-${viewport.width}.png`),
        fullPage: true,
      });
    });
  }
});
