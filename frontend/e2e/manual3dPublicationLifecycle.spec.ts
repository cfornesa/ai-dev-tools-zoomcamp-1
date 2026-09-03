/** Issue #376: the manual 3D publication disclosure is one focused route
 * transaction, separate from the broader project lifecycle/artifact suite. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('manual 3D publication lifecycle', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('publishes and restores the exact editor fixture at both required viewports', async ({
    page,
    browser,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
    await page.waitForURL(/\/projects3d\/[^/]+$/);
    const projectId = /\/projects3d\/([^/]+)$/.exec(page.url())?.[1];
    expect(projectId).toBeTruthy();
    if (!projectId) return;

    const route = page.getByTestId('scene3d-preview-canvas-frame');
    const toolbar = route.getByRole('toolbar', { name: 'Preview actions' });

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(route).toBeVisible();
      await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
      const menu = toolbar.getByRole('dialog', { name: 'Preview actions' });
      await expect(menu).toBeVisible();

      const menuGeometry = await menu.locator('.piece-stage-command-card').evaluate((card) => {
        const box = card.getBoundingClientRect();
        return {
          x: box.x,
          y: box.y,
          right: box.right,
          bottom: box.bottom,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          documentWidth: document.documentElement.scrollWidth,
        };
      });
      expect(menuGeometry.x).toBeGreaterThanOrEqual(0);
      expect(menuGeometry.y).toBeGreaterThanOrEqual(0);
      expect(menuGeometry.right).toBeLessThanOrEqual(menuGeometry.viewportWidth);
      expect(menuGeometry.bottom).toBeLessThanOrEqual(menuGeometry.viewportHeight);
      expect(menuGeometry.documentWidth).toBeLessThanOrEqual(menuGeometry.viewportWidth);

      const status = toolbar.getByRole('button', { name: 'Publication status: Draft' });
      await expect(status).toBeVisible();
      await status.click();
      const panel = toolbar.getByRole('group', {
        name: 'Publication status',
        exact: true,
      });
      await expect(panel).toBeVisible();
      await expect(panel.getByRole('button', { name: 'Draft', exact: true })).toBeDisabled();
      await expect(panel.getByRole('button', { name: 'Published', exact: true })).toBeEnabled();

      await toolbar.getByRole('button', { name: /close publication status: draft/i }).click();
      await menu.locator('.piece-stage-command-close').click();
    }

    await page.setViewportSize({ width: 375, height: 812 });
    await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    await toolbar.getByRole('button', { name: 'Publication status: Draft' }).click();
    await toolbar.getByRole('button', { name: 'Published', exact: true }).click();
    const confirmation = toolbar.getByRole('alertdialog', { name: /Publish/ });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');

    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto(`/p3d/${projectId}`);
    await expect(anonymousPage.getByTestId('scene3d-preview-canvas-frame')).toBeVisible();
    await expect(anonymousPage.getByRole('button', { name: 'Open piece controls menu' })).toBeVisible();
    await expect(anonymousPage.getByRole('button', { name: 'Logout' })).toHaveCount(0);

    const publishedPanel = toolbar.locator(
      '.piece-stage-controls-panel[aria-label="Publication status: Published"]',
    );
    await expect(publishedPanel.getByRole('button', { name: 'Draft', exact: true })).toBeEnabled();
    await publishedPanel.getByRole('button', { name: 'Draft', exact: true }).click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Private');

    await anonymousPage.reload();
    await expect(anonymousPage.getByRole('alert')).toContainText(
      "This project isn't available. It may have been unpublished, deleted, or never existed.",
    );
    await anonymousContext.close();
  });
});
