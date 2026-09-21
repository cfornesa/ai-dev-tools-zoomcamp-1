/** Issue #664: one canonical 2D workspace replaces the old AI/manual split. */
import { expect, test } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('unified 2D editor (#664)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`redirects legacy entry and shows manual plus AI tools at ${viewport.width}px`, async ({
      page,
      context,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await expect((await apiGet(context, '/api/account/profile/')).ok()).toBe(true);
      const created = await apiPost(context, '/api/projects/blank/', {});
      expect(created.status()).toBe(201);
      const project = (await created.json()) as { id: string; editor_url?: string };
      expect(project.editor_url).toMatch(/^\/users\/@[^/]+\/edit\/[^/]+$/);

      await page.goto(`/ai-projects/${project.id}`);
      await expect(page).toHaveURL(new RegExp(`${project.editor_url}$`));
      await expect(page.getByRole('region', { name: 'Tools' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Preview' })).toBeVisible();
      const layersTab = page.getByRole('tab', { name: 'Layers' });
      if (await layersTab.count()) await layersTab.click();
      await expect(
        page.getByRole('button', { name: /ask ai to improve this scene/i }),
      ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`unified-2d-${viewport.width}.png`),
        fullPage: true,
      });
    });
  }
});
