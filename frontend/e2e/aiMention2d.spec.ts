/** Issue #661: 2D AI @ targeting is keyboard accessible and usable at both
 * the desktop and phone reference viewports. The focused component/API tests
 * prove descendant expansion and stable-ID request serialization; this browser
 * check proves the real editor entry point exposes the listbox and chip. */
import { expect, test, type TestInfo } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('2D AI @ targeting (#661)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`opens a filtered keyboard list and inserts a typed chip at ${viewport.width}px`, async ({
      page,
    }, testInfo: TestInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/');
      await page.getByRole('button', { name: 'More creation options' }).click();
      await page.getByRole('menuitem', { name: 'Create an AI-assisted animation' }).click();
      await page.waitForURL(/\/ai-projects\/[^/]+$/);

      const prompt = page.getByRole('textbox', {
        name: /describe the scene you want to generate/i,
      });
      await prompt.fill('@');
      const listbox = page.getByRole('listbox', { name: /ai target suggestions/i });
      await expect(listbox).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`mention-list-${viewport.width}.png`),
        fullPage: true,
      });
      const firstAvailable = listbox.getByRole('option').first();
      await expect(firstAvailable).toBeVisible();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      await expect(page.getByTestId(/ai-target-chip-/)).toHaveCount(1);
      await expect(page.getByRole('button', { name: /remove .* target/i })).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`mention-chip-${viewport.width}.png`),
        fullPage: true,
      });
    });
  }
});
