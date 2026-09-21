import { expect, test } from '@playwright/test';

import { apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
] as const;

test.describe('2D AI panel layout (#678)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`keeps fields full width at ${viewport.width}x${viewport.height}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const created = await apiPost(context, '/api/projects/blank/');
      const { id } = (await created.json()) as { id: string };
      await page.goto(`/ai-projects/${id}`);

      const panel = page.locator('.ai-proposal-panel');
      await expect(panel).toBeVisible();
      const prompt = page.getByLabel('Describe the scene you want to generate');
      await expect(prompt).toHaveCSS('resize', 'vertical');
      const promptBox = await prompt.boundingBox();
      const panelBox = await panel.boundingBox();
      expect(promptBox).not.toBeNull();
      expect(panelBox).not.toBeNull();
      expect(promptBox!.width).toBeGreaterThanOrEqual(panelBox!.width - 2);
      expect(promptBox!.height).toBeGreaterThanOrEqual(96);
      const selectWidths = await panel
        .locator('select')
        .evaluateAll((elements) =>
          elements.map((element) => [
            element.getBoundingClientRect().width,
            element.parentElement?.getBoundingClientRect().width ?? 0,
          ]),
        );
      expect(selectWidths.every(([width, parentWidth]) => width >= parentWidth - 2)).toBe(true);
      await expect(panel.getByRole('radiogroup')).toHaveCount(2);
      expect(await panel.locator('button').count()).toBeGreaterThanOrEqual(4);

      const overflowing = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflowing).toBe(false);
      await page.screenshot({
        path: test.info().outputPath(`ai-2d-${viewport.width}.png`),
        fullPage: true,
      });
    });
  }
});
