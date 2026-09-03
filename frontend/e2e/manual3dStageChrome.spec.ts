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
    await toolbar.getByRole('button', { name: '3D authoring' }).click();
    await expect(toolbar.getByRole('group', { name: '3D authoring actions' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Add sphere' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Add plane' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Delete selected object' })).toBeDisabled();
    await expect(toolbar.getByRole('button', { name: 'Duplicate selected object' })).toBeDisabled();
    await expect(toolbar.getByRole('button', { name: 'Add group' })).toBeVisible();
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(toolbar).toBeVisible();
      await expect(toolbar.locator('svg.piece-stage-icon')).toHaveCount(10);
      await expect(
        toolbar.getByRole('button', { name: 'Publication status: Draft' }),
      ).toBeVisible();
      for (const [name, label] of [
        ['Save scene', 'Save scene'],
        ['Ask AI to improve this scene', 'Ask AI to improve this scene'],
      ] as const) {
        const action = toolbar.getByRole('button', { name, exact: true });
        await expect(action).toBeVisible();
        await expect(action.locator('.piece-stage-action-label')).toHaveText(label);
      }
      const canvasMetrics = await frame.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const canvas = element.querySelector('canvas');
        return {
          width: box.width,
          height: box.height,
          canvasWidth: canvas?.width ?? 0,
          canvasHeight: canvas?.height ?? 0,
        };
      });
      expect(canvasMetrics.width / canvasMetrics.height).toBeCloseTo(16 / 9, 1);
      expect(canvasMetrics.canvasWidth / canvasMetrics.canvasHeight).toBeCloseTo(16 / 9, 1);
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
    const mobileCommandLayout = await toolbar
      .getByRole('dialog')
      .locator('.piece-stage-command-card')
      .evaluate((card) => {
        const group = card.querySelector(':scope > [role="group"]');
        const groupStyle = group ? getComputedStyle(group) : null;
        return {
          direction: groupStyle?.flexDirection,
          iconSizes: Array.from(card.querySelectorAll('svg.piece-stage-icon')).map((icon) => {
            const iconStyle = getComputedStyle(icon);
            return {
              width: Number.parseFloat(iconStyle.width),
              height: Number.parseFloat(iconStyle.height),
            };
          }),
          overflow: getComputedStyle(card).overflow,
          scrollWidth: card.scrollWidth,
          clientWidth: card.clientWidth,
          scrollHeight: card.scrollHeight,
          clientHeight: card.clientHeight,
          scrollable: ['auto', 'scroll'].includes(getComputedStyle(card).overflowY),
        };
      });
    expect(mobileCommandLayout.direction).toBe('column');
    expect(mobileCommandLayout.iconSizes.length).toBeGreaterThan(0);
    for (const icon of mobileCommandLayout.iconSizes) {
      expect(icon.width).toBeLessThanOrEqual(20);
      expect(icon.height).toBeLessThanOrEqual(20);
    }
    expect(mobileCommandLayout.overflow).toBe('visible');
    expect(mobileCommandLayout.scrollWidth).toBe(mobileCommandLayout.clientWidth);
    expect(mobileCommandLayout.scrollable).toBe(false);
    await toolbar.getByRole('button', { name: /close 3d authoring/i }).click();
    await page.setViewportSize({ width: 1280, height: 900 });
    const desktopCommandLayout = await toolbar
      .getByRole('dialog')
      .locator('.piece-stage-command-card > [role="group"]')
      .evaluate((element) => getComputedStyle(element).flexDirection);
    expect(desktopCommandLayout).toBe('column');
    await expect(toolbar.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Open download menu' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Enable sound' })).toBeVisible();
    await expect(
      toolbar.getByRole('button', { name: 'Piece controls', exact: true }),
    ).toBeVisible();
    await toolbar.getByRole('button', { name: 'Enable sound' }).click();
    await toolbar.getByRole('button', { name: 'Piece controls', exact: true }).click();
    await expect(toolbar.getByLabel('Ambient instrument')).toHaveValue('synth');
    await expect(toolbar.getByLabel('Movement instrument')).toHaveValue('synth');
    await expect(toolbar.getByLabel('Melodic instrument')).toHaveValue('synth');
    // The nested sound panel is deliberately bounded and scrollable. Firefox
    // does not implicitly scroll a select before selectOption, so use the
    // same scroll-to-control action a pointer/keyboard user would perform.
    await toolbar.getByLabel('Movement instrument').scrollIntoViewIfNeeded();
    await toolbar.getByLabel('Movement instrument').selectOption('fmsynth');
    await expect(toolbar.getByLabel('Movement instrument')).toHaveValue('fmsynth');
    await expect(toolbar.getByLabel('Ambient instrument')).toHaveValue('synth');
    await expect(toolbar.getByLabel('Melodic instrument')).toHaveValue('synth');
    await toolbar.getByRole('button', { name: 'Hide piece controls' }).click();
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
    const publicationPanel = toolbar.locator('.publication-status-controls-panel');
    const publicationPanelBox = await publicationPanel.boundingBox();
    const commandCardBox = await toolbar.locator('.piece-stage-command-card').boundingBox();
    expect(publicationPanelBox).not.toBeNull();
    expect(commandCardBox).not.toBeNull();
    expect(publicationPanelBox!.width).toBeLessThanOrEqual(320);
    expect(publicationPanelBox!.x).toBeGreaterThanOrEqual(commandCardBox!.x);
    expect(publicationPanelBox!.x + publicationPanelBox!.width).toBeLessThanOrEqual(
      commandCardBox!.x + commandCardBox!.width,
    );
    await expect(toolbar.getByRole('button', { name: 'Draft', exact: true })).toBeDisabled();
    await expect(toolbar.getByRole('button', { name: 'Published', exact: true })).toBeEnabled();
  });
});
