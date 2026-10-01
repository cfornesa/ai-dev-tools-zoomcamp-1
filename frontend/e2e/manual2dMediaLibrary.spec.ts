import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { createServerProject2D } from './support/createProject.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('manual 2D media library (#513)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('imports an image, inserts it as a layer, and keeps referenced deletion disabled', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createServerProject2D(page);

    const preview = page.getByRole('region', { name: 'Preview' });
    const fileMenu = preview.getByRole('button', { name: 'File', exact: true });
    await fileMenu.click();
    await expect(preview.getByRole('menu', { name: 'File menu' })).toBeVisible();
    await preview.getByRole('menuitem', { name: 'Import media' }).click();
    await preview.locator('input[aria-label="Import media file"]').setInputFiles({
      name: 'sunset.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not-a-real-png-but-a-valid-test-blob'),
    });

    const importDialog = page.getByRole('dialog', { name: 'Describe this media' });
    await expect(importDialog).toBeVisible();
    await importDialog.getByLabel('Descriptive label').fill('A sunset over water');
    await importDialog.getByRole('button', { name: 'Import media' }).click();

    const library = page.getByRole('region', { name: 'Project media library' });
    await expect(library).toBeVisible();
    const asset = library.getByRole('listitem').filter({ hasText: 'sunset.png' });
    await expect(asset).toContainText('Descriptive label set');
    await asset.getByRole('button', { name: 'Insert into active scene' }).click();
    await expect(page.getByRole('list', { name: 'Scene outline' })).toContainText('Image 1');
    await expect(asset.getByRole('button', { name: 'Delete asset' })).toBeDisabled();
    await expect(asset).toContainText('Remove scene references before deleting.');
  });
});
