import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
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
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new animation' }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);

    const stage = page.locator('.piece-stage-shell');
    await stage.getByRole('button', { name: 'Open piece controls menu' }).click();
    await stage.getByRole('button', { name: 'Edit scene' }).click();

    const fileMenu = stage.getByRole('button', { name: 'File' });
    await fileMenu.click();
    await expect(stage.getByRole('menu', { name: 'File menu' })).toBeVisible();
    await stage.getByRole('menuitem', { name: 'Import media' }).click();
    await stage.locator('input[aria-label="Import media file"]').setInputFiles({
      name: 'sunset.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not-a-real-png-but-a-valid-test-blob'),
    });

    const importDialog = stage.getByRole('dialog', { name: 'Describe this image' });
    await expect(importDialog).toBeVisible();
    await importDialog.getByLabel('Meaningful alt text').fill('A sunset over water');
    await importDialog.getByRole('button', { name: 'Import image' }).click();

    const library = stage.getByRole('region', { name: 'Project media library' });
    await expect(library).toBeVisible();
    const asset = library.getByRole('listitem').filter({ hasText: 'sunset.png' });
    await expect(asset).toContainText('Alt text set');
    await asset.getByRole('button', { name: 'Insert into active scene' }).click();
    await expect(page.getByRole('list', { name: 'Scene outline' })).toContainText('Image 1');
    await expect(asset.getByRole('button', { name: 'Delete asset' })).toBeDisabled();
    await expect(asset).toContainText('Remove scene references before deleting.');
  });
});
