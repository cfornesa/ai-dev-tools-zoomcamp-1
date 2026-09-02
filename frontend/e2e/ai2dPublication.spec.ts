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
    await expect(toolbar.getByRole('button', { name: 'Publication status: Draft' })).toBeVisible();
    await expect(page.locator('.editor-workspace-header .editor-publish-control')).toHaveCount(0);

    const chrome = await toolbar.evaluate((element) => {
      const toolbarStyle = getComputedStyle(element);
      const button = element.querySelector('.piece-stage-icon-button');
      const buttonStyle = button ? getComputedStyle(button) : null;
      return {
        top: toolbarStyle.top,
        left: toolbarStyle.left,
        buttonWidth: buttonStyle?.width,
        buttonHeight: buttonStyle?.height,
        buttonRadius: buttonStyle?.borderRadius,
      };
    });
    expect(chrome).toMatchObject({
      top: '13.5px',
      left: '13.5px',
      buttonWidth: '49.5px',
      buttonHeight: '49.5px',
      buttonRadius: '13.5px',
    });

    await toolbar.getByRole('button', { name: 'Publication status: Draft' }).click();
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

    const publishedTrigger = toolbar.getByRole('button', {
      name: 'Publication status: Published',
    });
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
