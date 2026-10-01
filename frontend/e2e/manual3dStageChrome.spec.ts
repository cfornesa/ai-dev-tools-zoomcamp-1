/** Issue #341: independently verify manual 3D editor stage chrome.
 *
 * Issue #394 moved the Draft/Published publication disclosure out of this
 * shared stage toolbar and into the editor header
 * (`PublishControl3D.tsx`'s non-`compact` branch) to remove a duplicate
 * publication control; `project3dPublicationDiscoverability.spec.ts` and
 * `manual3dPublicationLifecycle.spec.ts` now own that coverage. This file
 * keeps its remaining, still-current authoring/sound/icon-geometry
 * assertions and only drops the publication-toggle-specific ones. */
import { expect, test, type Locator } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { createServerProject3D } from './support/createProject3d.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function buttonPresentation(button: Locator) {
  return button.evaluate((element) => {
    const node = element as HTMLButtonElement;
    const visible =
      node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
    return {
      visible,
      accessibleName: node.getAttribute('aria-label') ?? node.innerText.trim(),
      text: node.innerText.trim(),
    };
  });
}

test.describe('manual 3D editor stage chrome', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('keeps authoring and publication actions in the shared stage toolbar', async ({
    page,
  }, testInfo) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createServerProject3D(page);

    await expect(page.getByTestId('scene3d-preview-canvas')).toBeVisible();
    const frame = page.getByTestId('scene3d-preview-canvas-frame');
    const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
    const saveScene = page.getByRole('button', { name: 'Save scene', exact: true });
    const projectSettings = page.getByRole('region', { name: 'Project settings' });
    const askAi = projectSettings.getByRole('button', {
      name: 'Ask AI to improve this scene',
      exact: true,
    });
    await expect(toolbar).toBeVisible();
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
      expect(await buttonPresentation(saveScene)).toEqual({
        visible: true,
        accessibleName: 'Save scene',
        text: 'Save scene',
      });
      expect(await buttonPresentation(askAi)).toEqual({
        visible: true,
        accessibleName: 'Ask AI to improve this scene',
        text: 'Ask AI to improve this scene',
      });
      await page.screenshot({
        path: testInfo.outputPath(`control-locations-${viewport.width}.png`),
      });
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
    // The former fullscreen command-card containment/collision checks now
    // cover the inline stage icon row; popover contents are excluded because
    // they intentionally occupy a separate layer above that row.
    const mobileCommandGeometry = await toolbar
      .getByRole('group', { name: 'Preview actions' })
      .locator(
        ':scope > .piece-stage-icon-button, :scope > .piece-stage-download > .piece-stage-icon-button, :scope > .piece-stage-controls > .piece-stage-icon-button',
      )
      .evaluateAll((elements) => {
        const card = elements[0]?.closest('[role="toolbar"]')?.getBoundingClientRect();
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
    // The authoring disclosure is the current responsive surface for these
    // layout checks: it remains a single column and fits without scrolling.
    const mobileCommandLayout = await toolbar
      .locator('.editor-authoring-controls-panel')
      .evaluate((panel) => {
        const group = panel.querySelector('.editor-authoring-command-group');
        const groupStyle = group ? getComputedStyle(group) : null;
        return {
          columns: groupStyle?.gridTemplateColumns ?? '',
          iconSizes: Array.from(
            document.querySelectorAll('.scene3d-preview-actions svg.piece-stage-icon'),
          ).map((icon) => {
            const iconStyle = getComputedStyle(icon);
            return {
              width: Number.parseFloat(iconStyle.width),
              height: Number.parseFloat(iconStyle.height),
            };
          }),
          scrollWidth: panel.scrollWidth,
          clientWidth: panel.clientWidth,
          scrollHeight: panel.scrollHeight,
          clientHeight: panel.clientHeight,
          scrollable:
            (['auto', 'scroll'].includes(getComputedStyle(panel).overflowX) &&
              panel.scrollWidth > panel.clientWidth) ||
            (['auto', 'scroll'].includes(getComputedStyle(panel).overflowY) &&
              panel.scrollHeight > panel.clientHeight),
        };
      });
    expect(mobileCommandLayout.columns.split(' ')).toHaveLength(1);
    expect(mobileCommandLayout.iconSizes.length).toBeGreaterThan(0);
    for (const icon of mobileCommandLayout.iconSizes) {
      expect(icon.width).toBeLessThanOrEqual(20);
      expect(icon.height).toBeLessThanOrEqual(20);
    }
    expect(mobileCommandLayout.scrollWidth).toBe(mobileCommandLayout.clientWidth);
    expect(mobileCommandLayout.scrollHeight).toBe(mobileCommandLayout.clientHeight);
    expect(mobileCommandLayout.scrollable).toBe(false);
    await toolbar.getByRole('button', { name: /close 3d authoring/i }).click();
    await page.setViewportSize({ width: 1280, height: 900 });
    const desktopCommandLayout = await toolbar
      .locator('.editor-authoring-command-group')
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns);
    expect(desktopCommandLayout.split(' ')).toHaveLength(1);
    await expect(toolbar.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Open download menu' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Enable sound' })).toBeVisible();
    await expect(
      toolbar.getByRole('button', { name: 'Piece controls', exact: true }),
    ).toBeVisible();
    await toolbar.getByRole('button', { name: 'Enable sound' }).click();
    await toolbar.getByRole('button', { name: 'Piece controls', exact: true }).click();
    // Inline mode moved steering into the Piece controls disclosure. Keep the
    // original visibility intent attached to its current rendered surface.
    await expect(
      toolbar
        .getByRole('group', { name: 'Piece controls' })
        .getByRole('button', { name: 'Steer the piece' }),
    ).toBeVisible();
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
    await expect(toolbar.getByRole('button', { name: 'Show hand gesture guide' })).toBeVisible();
    // Inline mode exposes immersive navigation as a button that opens the
    // destination in a new tab rather than the menu-mode anchor.
    const immersiveAction = toolbar.getByRole('button', {
      name: 'View immersive piece',
      exact: true,
    });
    const popupPromise = page.waitForEvent('popup');
    await immersiveAction.click();
    const immersivePage = await popupPromise;
    await expect(immersivePage).toHaveURL(/\/immersive\/p3d\/.+/);
    await immersivePage.close();
    await expect(toolbar.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeVisible();
    expect(await buttonPresentation(askAi)).toEqual({
      visible: true,
      accessibleName: 'Ask AI to improve this scene',
      text: 'Ask AI to improve this scene',
    });
    expect(await buttonPresentation(saveScene)).toEqual({
      visible: true,
      accessibleName: 'Save scene',
      text: 'Save scene',
    });
    // Issue #394: no duplicate/competing publication control in this stage
    // toolbar -- the owner-facing Draft/Published disclosure lives only in
    // the editor header now.
    await expect(toolbar.getByRole('button', { name: 'Publication status: Draft' })).toHaveCount(0);
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
      // Inline editor mode uses a full-stage overlay host (inset: 0); the
      // buttons themselves are checked against the stage bounds below.
      top: '0px',
      left: '0px',
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

    // Publish/unpublish round-trip and its containment/geometry are now
    // `manual3dPublicationLifecycle.spec.ts`'s and
    // `project3dPublicationDiscoverability.spec.ts`'s responsibility, since
    // issue #394 moved that control to the editor header, outside this
    // stage toolbar entirely.
  });
});
