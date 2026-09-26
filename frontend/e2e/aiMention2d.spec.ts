/** Issue #661: 2D AI @ targeting is keyboard accessible and usable at both
 * the desktop and phone reference viewports. The focused component/API tests
 * prove descendant expansion and stable-ID request serialization; this browser
 * check proves the real editor entry point exposes the listbox and chip. */
import { expect, test, type TestInfo } from '@playwright/test';

import { apiPost } from './support/api.js';
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
      context,
    }, testInfo: TestInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      // The gallery's current creation menu enters the manual editor. Use the
      // authenticated blank-project API to enter the stable AI editor route
      // directly, keeping mention coverage independent of menu copy.
      const created = await apiPost(context, '/api/projects/blank/');
      expect(created.status()).toBe(201);
      const { id } = (await created.json()) as { id: string };
      await page.goto(`/ai-projects/${id}`);
      await page.getByRole('button', { name: 'Ask AI to improve this scene' }).click();
      const layersTab = page.getByRole('tab', { name: 'Layers' });
      if (await layersTab.isVisible()) await layersTab.click();
      const expandTools = page.getByRole('button', { name: 'Expand Tools panel' });
      if (await expandTools.isVisible()) await expandTools.click();
      await page.getByRole('radio', { name: 'Create' }).click();

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
      await firstAvailable.press('Enter');

      await expect(page.getByTestId(/ai-target-chip-/)).toHaveCount(1);
      await expect(page.getByRole('button', { name: /remove .* target/i })).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`mention-chip-${viewport.width}.png`),
        fullPage: true,
      });
    });
  }
});
