/**
 * Issue #331: the published 2D embed route is independently verifiable.
 *
 * This deliberately owns one small create -> publish -> anonymous embed
 * transaction instead of relying on the larger publishing/remix batch. The
 * route must retain the shared stage-local controls while omitting the app
 * shell that would be duplicated inside an embedding site.
 */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { expandAllCollapsibleSections } from './support/expandCollapsibleSections.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function createBlankProject(page: Parameters<typeof loginViaUI>[0]): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'More creation options' }).click();
  await page.getByRole('menuitem', { name: 'Create a new animation' }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  const match = /\/projects\/([^/]+)$/.exec(page.url());
  if (!match) throw new Error(`Could not extract project id from ${page.url()}`);
  await expandAllCollapsibleSections(page);
  return match[1];
}

async function publish(page: Parameters<typeof loginViaUI>[0]): Promise<void> {
  const toolbar = page.locator('.piece-stage-shell [role="toolbar"][aria-label="Piece actions"]');
  const trigger = toolbar.getByRole('button', { name: 'Publication status: Draft' });
  await trigger.click();
  await toolbar
    .getByRole('group', { name: 'Publication status', exact: true })
    .getByRole('button', { name: 'Published', exact: true })
    .click();
  const dialog = page.getByRole('alertdialog', { name: /Publish/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByTestId('visibility-status')).toContainText('Published (public)');
}

test.describe('embedded 2D viewer', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('renders the chrome-less route with functional stage-local controls', async ({
    browser,
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectId = await createBlankProject(page);

    await page.getByRole('button', { name: 'Edit title' }).click();
    const titleForm = page.locator('.editor-title-edit');
    await titleForm.locator('#editor-title-input').fill('Embedded 2D parity fixture');
    await titleForm.getByRole('button', { name: 'Save' }).click();
    await expect(titleForm).toHaveCount(0);
    await page
      .locator('#project-description')
      .fill('A published 2D piece used to verify the chrome-less embed route.');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
    await publish(page);

    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto(`/embed/p/${projectId}`);

    await expect(anonymousPage.getByRole('heading', { level: 2 })).toHaveText(
      'Embedded 2D parity fixture',
    );
    await expect(anonymousPage.locator('.app-shell-header')).toHaveCount(0);
    await expect(anonymousPage.locator('nav')).toHaveCount(0);

    const toolbar = anonymousPage.locator(
      '.piece-stage-shell [role="toolbar"][aria-label="Piece actions"]',
    );
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeVisible();

    const download = toolbar.getByRole('button', { name: 'Open download menu' });
    await download.click();
    await expect(toolbar.getByRole('menuitem', { name: 'Download Full' })).toBeVisible();
    await expect(toolbar.getByRole('menuitem', { name: 'Download Non-Camera' })).toBeVisible();
    await download.click();

    const stage = anonymousPage.locator('.piece-stage-shell');
    const stageBox = await stage.boundingBox();
    const toolbarBox = await toolbar.boundingBox();
    expect(stageBox).not.toBeNull();
    expect(toolbarBox).not.toBeNull();
    expect(toolbarBox!.x).toBeGreaterThanOrEqual(stageBox!.x);
    expect(toolbarBox!.y).toBeGreaterThanOrEqual(stageBox!.y);
    expect(toolbarBox!.x + toolbarBox!.width).toBeLessThanOrEqual(stageBox!.x + stageBox!.width);

    await anonymousContext.close();
  });
});
