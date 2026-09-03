/** Issue #341: independently verify manual 3D editor stage chrome. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('manual 3D editor stage chrome', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('keeps authoring and publication actions in the shared stage toolbar', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
    await page.waitForURL(/\/projects3d\/[^/]+$/);

    await expect(page.getByTestId('scene3d-preview-canvas')).toBeVisible();
    const frame = page.getByTestId('scene3d-preview-canvas-frame');
    const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
    await expect(toolbar).toBeVisible();
    await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(toolbar).toBeVisible();
      await expect(toolbar.locator('svg.piece-stage-icon')).toHaveCount(9);
      await expect(
        toolbar.getByRole('button', { name: 'Publication status: Draft' }),
      ).toBeVisible();
    }
    const mobileCommandGeometry = await toolbar
      .locator('.piece-stage-command-card > [role="group"] .piece-stage-icon-button')
      .evaluateAll((elements) => {
        const card = elements[0]?.closest('.piece-stage-command-card')?.getBoundingClientRect();
        const visibleElements = elements.filter(
          (element) => element.getClientRects().length > 0 && !element.closest('[hidden]'),
        );
        return {
          card: card ? { x: card.x, y: card.y, right: card.right, bottom: card.bottom } : null,
          controls: visibleElements.map((element) => {
            const box = element.getBoundingClientRect();
            return { x: box.x, y: box.y, right: box.right, bottom: box.bottom };
          }),
        };
      });
    expect(mobileCommandGeometry.card).not.toBeNull();
    expect(mobileCommandGeometry.controls.length).toBeGreaterThan(0);
    for (const control of mobileCommandGeometry.controls) {
      expect(control.x).toBeGreaterThanOrEqual(mobileCommandGeometry.card!.x);
      expect(control.right).toBeLessThanOrEqual(mobileCommandGeometry.card!.right);
      expect(control.y).toBeGreaterThanOrEqual(mobileCommandGeometry.card!.y);
      expect(control.bottom).toBeLessThanOrEqual(mobileCommandGeometry.card!.bottom);
    }
    for (const [index, control] of mobileCommandGeometry.controls.entries()) {
      for (const other of mobileCommandGeometry.controls.slice(index + 1)) {
        const overlaps =
          control.x < other.right &&
          control.right > other.x &&
          control.y < other.bottom &&
          control.bottom > other.y;
        expect(overlaps).toBe(false);
      }
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(toolbar.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Open download menu' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Enable sound' })).toBeVisible();
    await expect(
      toolbar.getByRole('button', { name: 'Piece controls', exact: true }),
    ).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Steer the piece' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Show hand gesture guide' })).toBeVisible();
    await expect(toolbar.getByRole('link', { name: 'View immersive piece' })).toHaveAttribute(
      'href',
      /\/immersive\/p3d\/.+/,
    );
    await expect(toolbar.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeVisible();
    await expect(
      toolbar.getByRole('button', { name: 'Ask AI to improve this scene' }),
    ).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Save scene' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Publication status: Draft' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download standalone bundle' })).toHaveCount(0);

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
      buttonHeight: '49.5px',
      buttonRadius: '13.5px',
    });
    expect(Number.parseFloat(chrome.buttonWidth ?? '0')).toBeGreaterThanOrEqual(49.5);

    const toolbarBox = await toolbar.boundingBox();
    const frameBox = await frame.boundingBox();
    expect(toolbarBox).not.toBeNull();
    expect(frameBox).not.toBeNull();
    expect(toolbarBox!.x).toBeGreaterThanOrEqual(frameBox!.x);
    expect(toolbarBox!.y).toBeGreaterThanOrEqual(frameBox!.y);
    expect(toolbarBox!.x + toolbarBox!.width).toBeLessThanOrEqual(frameBox!.x + frameBox!.width);

    await toolbar.getByRole('button', { name: 'Publication status: Draft' }).click();
    await expect(
      toolbar.getByRole('group', { name: 'Publication status', exact: true }),
    ).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Draft', exact: true })).toBeDisabled();
    await expect(toolbar.getByRole('button', { name: 'Published', exact: true })).toBeEnabled();
  });
});
