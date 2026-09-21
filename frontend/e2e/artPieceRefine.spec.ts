/** Issue #663: generated art-piece refinement targets, plan, attempts, and saved version. */
import { expect, test, type TestInfo } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('generated art-piece refinement (#663)', () => {
  const fixtures = requireE2EFixtures() as Fixtures;

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`targets parts and saves a bounded refinement at ${viewport.width}px`, async ({
      browser,
    }, testInfo: TestInfo) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const profile = (await (await apiGet(context, '/api/account/profile/')).json()) as {
        handle: string;
      };
      const slug = `e2e-refine-${viewport.width}-${Date.now().toString(36)}`;
      const source =
        '<canvas id="art-piece-canvas" data-augmentr-part="background"></canvas>' +
        '<script>// @augmentr-part particles\n// @augmentr-asset logo.png</script>';
      const created = await apiPost(context, '/api/art-pieces/', {
        title: 'Refinement fixture',
        description: 'A generated refinement fixture.',
        prompt: 'A marked canvas piece',
        engine: 'canvas2d',
        public_slug: slug,
        source,
      });
      expect(created.status()).toBe(201);

      await page.goto(`/users/@${profile.handle}/edit/${slug}`);
      const prompt = page.getByRole('textbox', {
        name: 'Describe the revision you want to generate',
      });
      await prompt.fill('@par');
      const listbox = page.getByRole('listbox', { name: /ai target suggestions/i });
      await expect(listbox).toBeVisible();
      await expect(listbox.getByRole('option')).toHaveText(/particles/);
      await page.screenshot({
        path: testInfo.outputPath(`refine-filtered-${viewport.width}.png`),
        fullPage: true,
      });
      await page.keyboard.press('Enter');
      await prompt.fill('make the particles brighter');
      await page.getByRole('button', { name: 'Refine piece' }).click();
      await expect(page.getByTestId('art-piece-refine-plan')).toBeVisible();
      await expect(page.getByTestId('art-piece-refine-accepted')).toBeVisible();
      await expect(page.getByTestId('art-piece-editor-version-list')).toContainText('Version 2');
      await page.screenshot({
        path: testInfo.outputPath(`refine-plan-${viewport.width}.png`),
        fullPage: true,
      });
      await context.close();
    });
  }
});
