/** Issue #360: public 3D responsive aspect/proportion contract. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('anonymous public 3D proportions', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('keeps the public sphere frame proportional and controls reachable', async ({
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

    await expect(page.getByTestId('project3d-save-status')).toBeVisible();
    await page.getByRole('button', { name: 'Edit title' }).click();
    const titleForm = page.locator('.editor-title-edit');
    await titleForm.locator('#project3d-title-input').fill('Public 3D proportion fixture');
    await titleForm.getByRole('button', { name: 'Save' }).click();
    await expect(titleForm).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 900 });
    const ownerToolbar = page
      .getByTestId('scene3d-preview-canvas-frame')
      .getByRole('toolbar', { name: 'Preview actions' });
    await ownerToolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    await ownerToolbar
      .getByRole('button', { name: 'Publication status: Draft' })
      .scrollIntoViewIfNeeded();
    await ownerToolbar.getByRole('button', { name: 'Publication status: Draft' }).click();
    await ownerToolbar.getByRole('button', { name: 'Published', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Publish', exact: true })
      .click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');

    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto(`/p3d/${projectId}`);
    const frame = anonymousPage.getByTestId('scene3d-preview-canvas-frame');
    const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
    await expect(toolbar.getByRole('button', { name: 'Open piece controls menu' })).toBeVisible();

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await anonymousPage.setViewportSize(viewport);
      const metrics = await frame.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const canvas = element.querySelector('canvas');
        return {
          frameWidth: box.width,
          frameHeight: box.height,
          canvasWidth: canvas?.width ?? 0,
          canvasHeight: canvas?.height ?? 0,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      });
      expect(metrics.frameWidth / metrics.frameHeight).toBeCloseTo(16 / 9, 1);
      expect(metrics.canvasWidth / metrics.canvasHeight).toBeCloseTo(16 / 9, 1);
      expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    }

    await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    await expect(toolbar.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Open download menu' })).toBeVisible();
    await expect(
      toolbar.getByRole('button', { name: 'Piece controls', exact: true }),
    ).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeVisible();
    await anonymousContext.close();
  });
});
