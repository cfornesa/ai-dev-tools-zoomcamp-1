/** Issue #332: independently verify the published 3D embed route. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('embedded 3D viewer', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('renders the chrome-less route with functional 3D stage controls', async ({
    browser,
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
    await page.waitForURL(/\/projects3d\/[^/]+$/);
    const match = /\/projects3d\/([^/]+)$/.exec(page.url());
    if (!match) throw new Error(`Could not extract project id from ${page.url()}`);
    const projectId = match[1];

    await expect(page.getByTestId('project3d-save-status')).toBeVisible();
    await page.getByRole('button', { name: 'Publication status: Draft' }).click();
    await page.getByRole('button', { name: 'Published', exact: true }).click();
    const dialog = page.getByRole('alertdialog', { name: /Publish/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');

    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto(`/embed/p3d/${projectId}`);

    await expect(anonymousPage.locator('.app-shell-header')).toHaveCount(0);
    await expect(anonymousPage.locator('nav')).toHaveCount(0);
    const frame = anonymousPage.getByTestId('scene3d-preview-canvas-frame');
    const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Enable sound' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Piece controls' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Steer the piece' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Show hand gesture guide' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeVisible();

    await toolbar.getByRole('button', { name: 'Open download menu' }).click();
    await expect(toolbar.getByRole('menuitem', { name: 'Download Full ZIP' })).toBeVisible();
    await expect(toolbar.getByRole('menuitem', { name: 'Download Non-Camera ZIP' })).toBeVisible();
    await anonymousContext.close();
  });
});
