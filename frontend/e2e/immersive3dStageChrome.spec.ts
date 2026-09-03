/**
 * Issue #333: regular immersive 3D surface parity.
 *
 * This is intentionally separate from the project lifecycle and touch-d-pad
 * specs. It closes one route contract: a published project opened at
 * `/immersive/p3d/:id` exposes the regular page chrome plus the compact,
 * stage-local controls documented by the PHP reference implementation.
 */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('regular immersive 3D stage chrome', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('published regular immersive route keeps controls compact and stage-local', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);

    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
    await page.waitForURL(/\/projects3d\/[^/]+$/);
    const match = /\/projects3d\/([^/]+)$/.exec(page.url());
    expect(match).not.toBeNull();
    const projectId = match?.[1];
    if (!projectId) return;

    await expect(page.getByTestId('project3d-save-status')).toBeVisible();
    // The publication setup uses the full desktop contract. The command
    // overlay is intentionally viewport-bound, so make the setup viewport
    // explicit before opening it; the route's responsive assertions follow
    // after the fixture is published.
    await page.setViewportSize({ width: 1280, height: 900 });
    const ownerToolbar = page.getByTestId('scene3d-preview-canvas-frame').getByRole('toolbar', {
      name: 'Preview actions',
    });
    await ownerToolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    await ownerToolbar
      .getByRole('button', { name: 'Publication status: Draft' })
      .scrollIntoViewIfNeeded();
    await ownerToolbar.getByRole('button', { name: 'Publication status: Draft' }).click();
    await page.getByRole('button', { name: 'Published', exact: true }).click();
    const dialog = page.getByRole('alertdialog', { name: /Publish/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');

    await page.goto(`/immersive/p3d/${projectId}`);
    await expect(page.getByTestId('immersive-project3d-viewer')).not.toHaveAttribute(
      'data-immersive-embed-mode',
    );
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(page.getByText(/^By /)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Embed (Custom)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Embed (CMS)' })).toBeVisible();

    const frame = page.getByTestId('scene3d-preview-canvas-frame');
    const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
    await expect(toolbar).toBeVisible();
    await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    await expect(toolbar.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Open download menu' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Enable sound' })).toBeVisible();
    await expect(
      toolbar.getByRole('button', { name: 'Piece controls', exact: true }),
    ).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Steer the piece' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Show hand gesture guide' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeVisible();

    const geometry = await toolbar.evaluate((element) => {
      const style = getComputedStyle(element);
      const button = element.querySelector<HTMLButtonElement>('[aria-label="Take screenshot"]');
      const buttonStyle = button ? getComputedStyle(button) : null;
      return {
        position: style.position,
        top: style.top,
        left: style.left,
        gap: style.gap,
        buttonWidth: buttonStyle?.width,
        buttonHeight: buttonStyle?.height,
        buttonRadius: buttonStyle?.borderRadius,
      };
    });
    expect(geometry).toMatchObject({
      position: 'absolute',
      top: '13.5px',
      left: '13.5px',
      gap: '11.7px',
      buttonHeight: '49.5px',
      buttonRadius: '13.5px',
    });
    expect(Number.parseFloat(geometry.buttonWidth ?? '0')).toBeGreaterThanOrEqual(49.5);

    await toolbar.getByRole('button', { name: 'Piece controls', exact: true }).click();
    await expect(toolbar.getByRole('group', { name: 'Piece controls' })).toBeVisible();
    await toolbar.getByRole('button', { name: 'Open download menu' }).click();
    await expect(toolbar.getByRole('menuitem', { name: 'Download Full ZIP' })).toBeVisible();
    await expect(toolbar.getByRole('menuitem', { name: 'Download Non-Camera ZIP' })).toBeVisible();
  });
});
