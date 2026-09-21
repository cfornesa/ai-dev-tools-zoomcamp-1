/** Issue #662: 3D AI @ targeting uses the shared caret-safe mention field. */
import { expect, test, type TestInfo } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('3D AI @ targeting (#662)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`filters and inserts a typed stable-ID chip at ${viewport.width}px`, async ({
      page,
    }, testInfo: TestInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/');
      await page.getByRole('button', { name: 'More creation options' }).click();
      await page.getByRole('menuitem', { name: 'Create an AI-assisted 3D project' }).click();
      await page.waitForURL(/\/ai-projects3d\/[^/]+$/);

      const prompt = page.getByRole('textbox', {
        name: /describe the scene you want to generate/i,
      });
      await prompt.fill('@');
      const listbox = page.getByRole('listbox', { name: /ai target suggestions/i });
      await expect(listbox).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`mention-3d-list-${viewport.width}.png`),
        fullPage: true,
      });
      await prompt.fill('@zzz');
      await expect(listbox.getByRole('option')).toHaveText('No matches');
      await page.screenshot({
        path: testInfo.outputPath(`mention-3d-no-match-${viewport.width}.png`),
        fullPage: true,
      });
      await prompt.fill('@camera');
      await expect(listbox.getByRole('option')).toHaveCount(1);
      await expect(listbox.getByText('Main camera')).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`mention-3d-filtered-${viewport.width}.png`),
        fullPage: true,
      });
      await page.keyboard.press('Enter');
      await expect(page.getByTestId(/ai-target-chip-/)).toHaveCount(1);
      await expect(page.getByRole('button', { name: /remove .* target/i })).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`mention-3d-chip-${viewport.width}.png`),
        fullPage: true,
      });
    });
  }
});
