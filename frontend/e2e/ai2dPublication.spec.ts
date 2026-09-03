/** Issue #340: AI-assisted 2D publication is stage-local and reversible. */
import { expect, test } from '@playwright/test';

import { apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('AI-assisted 2D publication', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('publishes and returns to Draft from the stage-local control', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create an AI-assisted animation' }).click();
    await page.waitForURL(/\/ai-projects\/[^/]+$/);
    const projectId = /\/ai-projects\/([^/]+)$/.exec(page.url())?.[1];
    expect(projectId).toBeTruthy();
    if (!projectId) return;

    // AI 2D has no Details form of its own. Seed valid metadata through the
    // authenticated setup API, then reload so the real editor state performs
    // the publication validation against that persisted metadata.
    const metadata = await apiPatch(page.context(), `/api/projects/${projectId}/`, {
      title: 'AI 2D publication fixture',
      description: 'A calm animated publication fixture.',
    });
    expect(metadata.ok()).toBe(true);
    await page.reload();

    const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
    await expect(toolbar).toBeVisible();
    // Publication is an editor-only stage action, so the shared toolbar keeps
    // it inside the same hamburger dialog as the other piece controls.
    await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    const stageDialog = toolbar.getByRole('dialog');
    const publicationTrigger = stageDialog.getByRole('button', {
      name: 'Publication status: Draft',
    });
    await expect(publicationTrigger).toBeVisible();
    await expect(page.locator('.editor-workspace-header .editor-publish-control')).toHaveCount(0);

    const publicationGeometry = await publicationTrigger.evaluate((element) => {
      const button = element.getBoundingClientRect();
      const dialog = element.closest('[role="dialog"]')?.getBoundingClientRect();
      return {
        buttonWidth: button.width,
        buttonHeight: button.height,
        contained: Boolean(dialog && button.left >= dialog.left && button.right <= dialog.right),
      };
    });
    expect(publicationGeometry.buttonWidth).toBeGreaterThan(0);
    expect(publicationGeometry.buttonHeight).toBeGreaterThan(0);
    expect(publicationGeometry.contained).toBe(true);

    await publicationTrigger.click();
    const publicationGroup = toolbar.getByRole('group', {
      name: 'Publication status',
      exact: true,
    });
    await expect(publicationGroup).toBeVisible();
    await expect(
      publicationGroup.getByRole('button', { name: 'Draft', exact: true }),
    ).toBeDisabled();
    await publicationGroup.getByRole('button', { name: 'Published', exact: true }).click();

    const confirm = page.getByRole('alertdialog', { name: /Publish/ });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('visibility-status')).toContainText('Published (public)');

    const publishedTrigger = toolbar.locator(
      'button.piece-stage-icon-button[aria-label^="Hide publication status"]',
    );
    await expect(publishedTrigger).toHaveAttribute('aria-expanded', 'true');
    const publishedGroup = toolbar.getByRole('group', {
      name: 'Publication status',
      exact: true,
    });
    await expect(
      publishedGroup.getByRole('button', { name: 'Published', exact: true }),
    ).toBeDisabled();
    await publishedGroup.getByRole('button', { name: 'Draft', exact: true }).click();
    await expect(page.getByTestId('visibility-status')).toContainText('Draft (private)');
  });
});
