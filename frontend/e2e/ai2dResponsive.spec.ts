/** Issue #326: the AI-assisted 2D editor must contain its preview on phones. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('AI-assisted 2D responsive editor', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('contains the preview canvas without horizontal page overflow at phone width', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create an AI-assisted animation' }).click();
    await page.waitForURL(/\/ai-projects\/[^/]+$/);

    const workspace = page.locator('.ai-editor-workspace');
    await expect(workspace).toBeVisible();
    const geometry = await page.evaluate(() => {
      const canvas = document.querySelector('.ai-editor-workspace .piece-stage-shell > canvas');
      if (!(canvas instanceof HTMLElement)) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        bodyScrollWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        canvasRight: rect.right,
        canvasWidth: rect.width,
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry?.bodyScrollWidth).toBeLessThanOrEqual(geometry?.viewportWidth ?? 0);
    expect(geometry?.canvasRight).toBeLessThanOrEqual(geometry?.viewportWidth ?? 0);
    expect(geometry?.canvasWidth).toBeLessThan(800);
  });
});
