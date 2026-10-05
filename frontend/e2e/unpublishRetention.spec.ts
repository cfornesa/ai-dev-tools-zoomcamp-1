import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { createServerProject2D } from './support/createProject.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Unpublish retention: restore within the grace window (#944)', () => {
  const fixtures = requireE2EFixtures();

  test('unpublishing a project starts the retention clock, and republishing restores it', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createServerProject2D(page);

    // Give the server-backed project a meaningful title before publishing.
    await page.getByRole('button', { name: 'Edit title' }).click();
    const titleForm = page.locator('.editor-title-edit');
    await titleForm.locator('#editor-title-input').fill('Retention e2e project');
    await titleForm.getByRole('button', { name: 'Save' }).click();

    await page.getByRole('button', { name: 'Expand Details panel' }).click();
    await page.locator('#project-description').fill('A meaningful retention test project.');
    await page.getByRole('button', { name: 'Save changes' }).click();

    const editorActions = page.getByRole('group', { name: 'Primary editor actions' });
    await editorActions.getByRole('button', { name: 'File', exact: true }).click();
    await editorActions
      .getByRole('group', { name: 'Publication status', exact: true })
      .getByRole('button', { name: 'Published', exact: true })
      .click();
    const publishDialog = page.getByRole('alertdialog', { name: /Publish/ });
    await publishDialog.getByRole('button', { name: 'Publish', exact: true }).click();
    const publicationStatus = editorActions.getByRole('group', {
      name: 'Publication status',
      exact: true,
    });
    await expect(publicationStatus.getByRole('button', { name: 'Published' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await publicationStatus.getByRole('button', { name: 'Draft', exact: true }).click();

    await page.goto('/account/settings/unpublished');
    const retentionRow = page
      .getByRole('list')
      .locator('li')
      .filter({ has: page.getByRole('link', { name: 'Retention e2e project', exact: true }) });
    await expect(retentionRow).toContainText('Retention e2e project');
    await expect(retentionRow).toContainText(/unpublished .*retained until/);

    // Restore by republishing from the piece's own editor.
    await page.getByRole('link', { name: 'Retention e2e project' }).click();
    const reopenedActions = page.getByRole('group', { name: 'Primary editor actions' });
    await reopenedActions.getByRole('button', { name: 'File', exact: true }).click();
    await reopenedActions
      .getByRole('group', { name: 'Publication status', exact: true })
      .getByRole('button', { name: 'Published', exact: true })
      .click();
    const republishDialog = page.getByRole('alertdialog', { name: /Publish/ });
    await republishDialog.getByRole('button', { name: 'Publish', exact: true }).click();

    await page.goto('/account/settings/unpublished');
    await expect(
      page.getByRole('link', { name: 'Retention e2e project', exact: true }),
    ).toHaveCount(0);
  });
});
