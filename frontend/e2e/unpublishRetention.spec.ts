import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Unpublish retention: restore within the grace window (#944)', () => {
  const fixtures = requireE2EFixtures();

  test('unpublishing a project starts the retention clock, and republishing restores it', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);

    await page.goto('/create');
    await page.getByRole('button', { name: 'Create a new 2D project', exact: true }).click();
    await page.waitForURL(/\/users\/@[^/]+\/edit\/[^/]+$/);

    // Give the project a meaningful title/description and save a version
    // so it can publish, then publish it.
    await page.getByLabel('Title').fill('Retention e2e project');
    await page.getByRole('button', { name: 'Save now', exact: true }).click();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();

    await page.getByRole('button', { name: 'Unpublish' }).click();

    await page.goto('/account/settings/unpublished');
    await expect(page.getByText('Retention e2e project')).toBeVisible();
    await expect(page.getByText(/unpublished .*retained until/)).toBeVisible();

    // Restore by republishing from the piece's own editor.
    await page.getByRole('link', { name: 'Retention e2e project' }).click();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();

    await page.goto('/account/settings/unpublished');
    await expect(page.getByText('You have no unpublished pieces awaiting purge.')).toBeVisible();
  });
});
