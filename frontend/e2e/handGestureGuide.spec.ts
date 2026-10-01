/** Issue #295: the live 3D guide is a five-slide, keyboard-operable dialog. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { createServerProject3D } from './support/createProject3d.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('3D hand gesture guide', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('presents five named slides without requesting camera permission', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectId = await createServerProject3D(page);
    await expect(page).toHaveURL(/\/users\/@[^/]+\/edit\/[^/]+\/?$/);

    await page.getByRole('button', { name: 'Edit title' }).click();
    const titleForm = page.locator('.editor-title-edit');
    await titleForm.locator('#project3d-title-input').fill('Hand gesture guide fixture');
    await titleForm.getByRole('button', { name: 'Save' }).click();
    await expect(titleForm).toHaveCount(0);

    // Issue #394: the owner editor's PublishControl3D renders its
    // "Publication status" group directly (no toggle trigger to open
    // first) -- matches public3dRouteStageChrome.spec.ts's own fix for
    // the same stale assumption.
    await page
      .getByRole('group', { name: 'Publication status' })
      .getByRole('button', { name: 'Published', exact: true })
      .click();
    const publishDialog = page.getByRole('alertdialog', { name: /Publish/ });
    await expect(publishDialog).toBeVisible();
    await publishDialog.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');

    await page.goto(`/p3d/${projectId}`);
    await page.waitForURL(/\/users\/@[^/]+\/pieces\/[^/]+$/);

    const frame = page.getByTestId('scene3d-preview-canvas-frame');
    const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
    // The canonical public piece page renders the toolbar actions inline.
    await expect(toolbar.getByRole('button', { name: 'Show hand gesture guide' })).toBeVisible();
    await expect(page.getByText('Camera permission')).toHaveCount(0);

    await toolbar.getByRole('button', { name: 'Show hand gesture guide' }).click();
    const dialog = page.getByRole('dialog', { name: 'Hand gesture guide' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Look' })).toBeVisible();
    await expect(dialog).toContainText('Step 1 of 5');

    for (const title of ['Move', 'Orbit', 'Zoom', 'Stop safely']) {
      await dialog.getByRole('button', { name: 'Next' }).click();
      await expect(dialog.getByRole('heading', { name: title })).toBeVisible();
      if (title === 'Move') await expect(dialog).toContainText('pinch and hold');
    }
    await expect(dialog.getByRole('button', { name: 'Next' })).toBeDisabled();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
});
