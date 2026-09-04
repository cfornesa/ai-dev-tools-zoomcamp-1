/** Issue #394: publication state and actions must be discoverable outside the
 * stage command disclosure, and the owner card must reflect the same state. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('3D publication discoverability', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('shows and updates visibility in the editor and owner card', async ({ page, browser }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
    await page.waitForURL(/\/projects3d\/[^/]+$/);
    const projectId = /\/projects3d\/([^/]+)$/.exec(page.url())?.[1];
    expect(projectId).toBeTruthy();
    if (!projectId) return;

    const status = page.getByTestId('visibility-status-3d');
    await expect(status).toContainText('Private');
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publication status: Draft' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    const confirmation = page.getByRole('alertdialog', { name: /Publish/ });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(status).toContainText('Public');

    await page.goto('/');
    const card = page
      .locator('article')
      .filter({ has: page.getByRole('link', { name: 'Edit' }) })
      .last();
    await expect(card.getByText('Public', { exact: true })).toBeVisible();

    await page.goto(`/projects3d/${projectId}`);
    await expect(page.getByRole('button', { name: 'Unpublish', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await expect(status).toContainText('Private');

    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto(`/p3d/${projectId}`);
    await expect(anonymousPage.getByRole('alert')).toContainText('not available');
    await anonymousContext.close();
  });
});
