/** Issue #340: AI-assisted 2D publication is stage-local and reversible. */
import { expect, test } from '@playwright/test';

import { apiPatch } from './support/api.js';
import { createServerProjectAndOpenAIProposalPanel } from './support/aiProposal.js';
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
    const { projectId } = await createServerProjectAndOpenAIProposalPanel(page, '2d');
    expect(projectId).toBeTruthy();

    // AI 2D has no Details form of its own. Seed valid metadata through the
    // authenticated setup API, then reload so the real editor state performs
    // the publication validation against that persisted metadata.
    const metadata = await apiPatch(page.context(), `/api/projects/${projectId}/`, {
      title: 'AI 2D publication fixture',
      description: 'A calm animated publication fixture.',
    });
    expect(metadata.ok()).toBe(true);
    await page.reload();

    const primaryActions = page.getByRole('group', { name: 'Primary editor actions' });
    await expect(primaryActions).toBeVisible();
    const fileMenu = primaryActions.getByRole('button', { name: 'File', exact: true });
    if ((await fileMenu.getAttribute('aria-expanded')) !== 'true') await fileMenu.click();
    const publicationGroup = primaryActions.getByRole('group', {
      name: 'Publication status',
      exact: true,
    });
    const publishedButton = publicationGroup.getByRole('button', {
      name: 'Published',
      exact: true,
    });
    await expect(publicationGroup).toBeVisible();
    await expect(publishedButton).toBeVisible();
    await expect(page.locator('.editor-workspace-header .editor-publish-control')).toHaveCount(0);

    const publicationGeometry = await publishedButton.evaluate((element) => {
      const button = element.getBoundingClientRect();
      const group = element.closest('[role="group"]')?.getBoundingClientRect();
      return {
        buttonWidth: button.width,
        buttonHeight: button.height,
        contained: Boolean(group && button.left >= group.left && button.right <= group.right),
      };
    });
    expect(publicationGeometry.buttonWidth).toBeGreaterThan(0);
    expect(publicationGeometry.buttonHeight).toBeGreaterThan(0);
    expect(publicationGeometry.contained).toBe(true);

    await expect(
      publicationGroup.getByRole('button', { name: 'Draft', exact: true }),
    ).toBeDisabled();
    await publicationGroup.getByRole('button', { name: 'Published', exact: true }).click();

    const confirm = page.getByRole('alertdialog', { name: /Publish/ });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('visibility-status')).toContainText('Published (public)');

    await expect(publishedButton).toHaveAttribute('aria-pressed', 'true');
    const publishedGroup = publicationGroup;
    await expect(
      publishedGroup.getByRole('button', { name: 'Published', exact: true }),
    ).toBeDisabled();
    await publishedGroup.getByRole('button', { name: 'Draft', exact: true }).click();
    await expect(page.getByTestId('visibility-status')).toContainText('Draft (private)');
  });
});
