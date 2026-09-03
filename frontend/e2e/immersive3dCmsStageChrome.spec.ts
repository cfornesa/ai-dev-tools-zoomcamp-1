/**
 * Issue #335: CMS immersive 3D route parity.
 *
 * This keeps the `embed=1&cms=1` variant independently closable from the
 * regular immersive route (#333) and custom variant (#334).
 */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('CMS immersive 3D stage chrome', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('published CMS immersive route keeps chrome-less stage controls', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);

    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
    await page.waitForURL(/\/projects3d\/[^/]+$/);
    const match = /\/projects3d\/([^/]+)$/.exec(page.url());
    expect(match).not.toBeNull();
    const projectId = match?.[1];
    if (!projectId) return;

    await expect(page.getByTestId('project3d-save-status')).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    const ownerToolbar = page
      .getByTestId('scene3d-preview-canvas-frame')
      .getByRole('toolbar', { name: 'Preview actions' });
    await ownerToolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    await ownerToolbar
      .getByRole('button', { name: 'Publication status: Draft' })
      .scrollIntoViewIfNeeded();
    await ownerToolbar.getByRole('button', { name: 'Publication status: Draft' }).click();
    await page.getByRole('button', { name: 'Published', exact: true }).click();
    const dialog = page.getByRole('alertdialog', { name: /Publish/ });
    await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');

    await page.goto(`/immersive/p3d/${projectId}?embed=1&cms=1`);
    const viewer = page.getByTestId('immersive-project3d-viewer');
    await expect(viewer).toHaveAttribute('data-immersive-embed-mode', 'cms');
    await expect(viewer.getByRole('heading')).toHaveCount(0);
    await expect(viewer.getByRole('button', { name: 'Embed (Custom)' })).toHaveCount(0);
    await expect(viewer.getByRole('button', { name: 'Embed (CMS)' })).toHaveCount(0);

    const frame = page.getByTestId('scene3d-preview-canvas-frame');
    await expect(frame).toBeVisible();
    await expect(frame.locator('canvas')).toBeVisible();
    const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
    await expect(toolbar).toBeVisible();
    await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    for (const label of [
      'Take screenshot',
      'Open download menu',
      'Enable sound',
      'Piece controls',
      'Steer the piece',
      'Show hand gesture guide',
      'Expand piece to fullscreen',
    ]) {
      await expect(
        toolbar.getByRole('button', { name: label, exact: label === 'Piece controls' }),
      ).toBeVisible();
    }

    const viewerPadding = await viewer.evaluate((element) => getComputedStyle(element).padding);
    expect(viewerPadding).toBe('0px');
    await toolbar.getByRole('button', { name: 'Open download menu' }).click();
    await expect(toolbar.getByRole('menuitem', { name: 'Download Full ZIP' })).toBeVisible();
    await expect(toolbar.getByRole('menuitem', { name: 'Download Non-Camera ZIP' })).toBeVisible();
  });
});
