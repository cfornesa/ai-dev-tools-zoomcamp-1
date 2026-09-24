/** Issue #342: camera preview is independently presented in Piece controls. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { createBlank3DProjectViaUI } from './support/createProject3d.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('3D independent camera preview', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('opens and stops the camera preview without enabling steering', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createBlank3DProjectViaUI(page);

    const frame = page.getByTestId('scene3d-preview-canvas-frame');
    const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
    // Issue #444: every action in this toolbar (including "Piece
    // controls") is nested behind "Open piece controls menu" -- matches
    // immersive3dRouteParity.spec.ts's own working sequence.
    await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    await toolbar.getByRole('button', { name: 'Piece controls', exact: true }).click();
    await toolbar.getByRole('button', { name: 'Show camera' }).click();
    await expect(toolbar.getByRole('region', { name: 'Camera preview' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Steer the piece' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await toolbar.getByRole('button', { name: 'Hide camera' }).click();
    await expect(toolbar.getByRole('region', { name: 'Camera preview' })).toHaveCount(0);
  });
});
