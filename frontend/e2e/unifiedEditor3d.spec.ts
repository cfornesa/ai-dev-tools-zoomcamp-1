/** Issue #665: one canonical 3D workspace replaces the old AI/manual split. */
import { expect, test } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('unified 3D editor (#665)', () => {
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
      const created = await apiPost(context, '/api/projects3d/', {});
      expect(created.status()).toBe(201);
      const project = (await created.json()) as { id: string; editor_url?: string };
      expect(project.editor_url).toMatch(/^\/users\/@[^/]+\/edit\/[^/]+$/);

      await page.goto(`/ai-projects3d/${project.id}`);
      await expect(page).toHaveURL(new RegExp(`${project.editor_url}$`));
      await expect(page.getByRole('region', { name: 'Preview' })).toBeVisible();
      await expect(page.getByTestId('scene3d-preview-canvas-frame')).toBeVisible();
      const toolbar = page
        .getByTestId('scene3d-preview-canvas-frame')
        .getByRole('toolbar', { name: 'Preview actions' });
      await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
      const actions = toolbar.getByRole('dialog', { name: 'Preview actions' });
      await expect(
        actions.getByRole('button', { name: /ask ai to improve this scene/i }),
      ).toBeVisible();
      await actions.getByRole('button', { name: /ask ai to improve this scene/i }).click();
      await expect(page.getByTestId('project3d-ai-improve-panel')).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`unified-3d-${viewport.width}.png`),
        fullPage: true,
      });
    });
  }
});
