/** Issue #295: the live 3D guide is a five-slide, keyboard-operable dialog. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
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
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
    await page.waitForURL(/\/projects3d\/[^/]+$/);
    const projectId = /\/projects3d\/([^/]+)$/.exec(page.url())?.[1];
    expect(projectId).toBeTruthy();
    if (!projectId) return;

    await page.getByRole('button', { name: 'Edit title' }).click();
    const titleForm = page.locator('.editor-title-edit');
    await titleForm.locator('#project3d-title-input').fill('Hand gesture guide fixture');
    await titleForm.getByRole('button', { name: 'Save' }).click();
    await expect(titleForm).toHaveCount(0);

    const publicationTrigger = page.getByRole('button', {
      name: 'Publication status: Draft',
    });
    await publicationTrigger.click();
    await page.getByRole('button', { name: 'Published' }).click();
    const publishDialog = page.getByRole('alertdialog', { name: /Publish/ });
    await expect(publishDialog).toBeVisible();
    await publishDialog.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');

    await page.goto(`/p3d/${projectId}`);

    const frame = page.getByTestId('scene3d-preview-canvas-frame');
    const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
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
    }
    await expect(dialog.getByRole('button', { name: 'Next' })).toBeDisabled();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
});
