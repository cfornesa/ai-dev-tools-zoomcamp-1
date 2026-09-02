/** Issue #306: the live 3D sound control performs an explicit user-gesture flow. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('3D sound engine', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('enables sound, exposes shared volume, and mutes cleanly', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
    await page.waitForURL(/\/projects3d\/[^/]+$/);

    const frame = page.getByTestId('scene3d-preview-canvas-frame');
    const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
    const enable = toolbar.getByRole('button', { name: 'Enable sound' });
    await expect(enable).toHaveAttribute('aria-pressed', 'false');
    await enable.click();

    const mute = toolbar.getByRole('button', { name: 'Mute sound' });
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    await toolbar.getByRole('button', { name: 'Piece controls' }).click();
    const volume = toolbar.getByLabel('Sound volume');
    await expect(volume).toBeVisible();
    await volume.fill('80');
    await expect(volume).toHaveValue('80');

    await mute.click();
    await expect(toolbar.getByRole('button', { name: 'Enable sound' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(toolbar.getByLabel('Sound volume')).toHaveCount(0);
  });
});
