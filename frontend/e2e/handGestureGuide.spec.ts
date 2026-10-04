/** Issue #295: the live 3D guide is a five-slide, keyboard-operable dialog. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { createServerProject3D } from './support/createProject3d.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('3D hand gesture guide', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('presents five named slides without requesting camera permission', async ({
    page,
  }, testInfo) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectId = await createServerProject3D(page);
    await expect(page).toHaveURL(/\/users\/@[^/]+\/edit\/[^/]+\/?$/);

    const editorTrigger = page.getByRole('button', { name: 'Show hand gesture guide' });
    await editorTrigger.click();
    const editorDialog = page.getByRole('dialog', { name: 'Hand gesture guide' });
    await expect(editorDialog).toContainText('Step 1 of 5');
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      const editorBox = await editorDialog.boundingBox();
      expect(editorBox).not.toBeNull();
      if (!editorBox) throw new Error('Editor guide did not have a rendered box');
      expect(editorBox.x).toBeGreaterThanOrEqual(0);
      expect(editorBox.y).toBeGreaterThanOrEqual(0);
      expect(editorBox.x + editorBox.width).toBeLessThanOrEqual(viewport.width);
      expect(editorBox.y + editorBox.height).toBeLessThanOrEqual(viewport.height);
      await page.screenshot({
        path: testInfo.outputPath(`editor-guide-${viewport.width}x${viewport.height}.png`),
      });
    }
    await page.keyboard.press('Escape');
    await expect(editorDialog).toHaveCount(0);
    await expect(editorTrigger).toBeFocused();

    await page.getByRole('button', { name: 'Edit title' }).click();
    const titleForm = page.locator('.editor-title-edit');
    await titleForm.locator('#project3d-title-input').fill('Hand gesture guide fixture');
    await titleForm.getByRole('button', { name: 'Save' }).click();
    await expect(titleForm).toHaveCount(0);

    // Issue #394: the owner editor's PublishControl3D renders its
    // "Publication status" group directly (no toggle trigger to open
    // first) -- matches public3dRouteStageChrome.spec.ts's own fix for
    // the same stale assumption.
    await page
      .getByRole('group', { name: 'Publication status' })
      .getByRole('button', { name: 'Published', exact: true })
      .click();
    const publishDialog = page.getByRole('alertdialog', { name: /Publish/ });
    await expect(publishDialog).toBeVisible();
    await publishDialog.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');

    await page.goto(`/p3d/${projectId}`);
    await page.waitForURL(/\/users\/@[^/]+\/pieces\/[^/]+$/);

    const frame = page.getByTestId('scene3d-preview-canvas-frame');
    const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
    // The canonical public piece page renders the toolbar actions inline.
    await expect(toolbar.getByRole('button', { name: 'Show hand gesture guide' })).toBeVisible();
    await expect(page.getByText('Camera permission')).toHaveCount(0);

    await page.getByRole('button', { name: 'Embed', exact: true }).click();
    const embedPanel = page.getByTestId('embed-snippet-panel');
    await expect(embedPanel.getByRole('button', { name: 'Copy', exact: true })).toBeVisible();
    const shareButton = page.getByRole('button', { name: 'Share', exact: true });
    const embedCopy = embedPanel.getByRole('button', { name: 'Copy', exact: true });
    const versionDetails = page.locator('#versions-heading');

    await toolbar.getByRole('button', { name: 'Show hand gesture guide' }).click();
    const dialog = page.getByRole('dialog', { name: 'Hand gesture guide' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Look' })).toBeVisible();
    await expect(dialog).toContainText('Step 1 of 5');

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(dialog).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewport.width,
      );
      const dialogBox = await dialog.boundingBox();
      expect(dialogBox).not.toBeNull();
      if (!dialogBox) throw new Error('Guide dialog did not have a rendered box');
      const rem = await page.evaluate(() =>
        Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      );
      const maxWidth = 28 * rem;
      const maxHeight = Math.min(viewport.height * 0.6, maxWidth);
      expect(dialogBox.x).toBeGreaterThanOrEqual(0);
      expect(dialogBox.y).toBeGreaterThanOrEqual(0);
      expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(viewport.width);
      expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(viewport.height);
      expect(dialogBox.width).toBeLessThanOrEqual(maxWidth);
      expect(dialogBox.height).toBeLessThanOrEqual(maxHeight + 1);
      await page.screenshot({
        path: testInfo.outputPath(`hand-gesture-guide-${viewport.width}x${viewport.height}.png`),
      });
      for (const [label, target] of [
        ['Share', shareButton],
        ['Embed copy', embedCopy],
        ['Versions', versionDetails],
      ] as const) {
        if (!(await target.count())) continue;
        const targetBox = await target.boundingBox();
        if (!targetBox) continue;
        const intersects =
          dialogBox.x < targetBox.x + targetBox.width &&
          dialogBox.x + dialogBox.width > targetBox.x &&
          dialogBox.y < targetBox.y + targetBox.height &&
          dialogBox.y + dialogBox.height > targetBox.y;
        expect(
          intersects,
          `guide dialog ${JSON.stringify(dialogBox)} intersects ${label} ${JSON.stringify(targetBox)}`,
        ).toBe(false);
      }
      for (const buttonName of ['Previous', 'Next', 'Close']) {
        const button = dialog.getByRole('button', { name: buttonName });
        const buttonBox = await button.boundingBox();
        expect(buttonBox, `${buttonName} has a hit-testable box`).not.toBeNull();
        if (!buttonBox) throw new Error(`${buttonName} did not have a rendered box`);
        expect(
          await page.evaluate(
            ({ x, y }) => {
              const target = document.elementFromPoint(x, y);
              return target?.closest('button')?.getAttribute('aria-label') ?? target?.textContent;
            },
            { x: buttonBox.x + buttonBox.width / 2, y: buttonBox.y + buttonBox.height / 2 },
          ),
        ).toContain(buttonName);
      }
    }

    await page.setViewportSize({ width: 375, height: 500 });
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog.getByRole('heading', { name: 'Move' })).toBeVisible();
    const slideBody = dialog.locator('div[aria-live="polite"]');
    await expect(slideBody).toHaveCSS('overflow', 'auto');
    expect(
      await slideBody.evaluate((element) => element.scrollHeight > element.clientHeight),
      'the long Move slide scrolls inside the bounded guide panel on a short viewport',
    ).toBe(true);
    await page.setViewportSize({ width: 375, height: 812 });
    await dialog.getByRole('button', { name: 'Previous' }).click();

    for (const title of ['Move', 'Orbit', 'Zoom', 'Stop safely']) {
      await dialog.getByRole('button', { name: 'Next' }).click();
      await expect(dialog.getByRole('heading', { name: title })).toBeVisible();
      if (title === 'Move') await expect(dialog).toContainText('pinch and hold');
    }
    await expect(dialog.getByRole('button', { name: 'Next' })).toBeDisabled();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(toolbar.getByRole('button', { name: 'Show hand gesture guide' })).toBeFocused();

    const popupPromise = page.context().waitForEvent('page');
    await page.getByRole('button', { name: 'Open immersive view' }).click();
    const immersivePage = await popupPromise;
    await immersivePage.waitForLoadState('domcontentloaded');
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await immersivePage.setViewportSize(viewport);
      const immersiveTrigger = immersivePage.getByRole('button', {
        name: 'Show hand gesture guide',
      });
      await expect(immersiveTrigger).toBeVisible();
      await immersiveTrigger.click();
      const immersiveDialog = immersivePage.getByRole('dialog', { name: 'Hand gesture guide' });
      await expect(immersiveDialog).toContainText('Step 1 of 5');
      const box = await immersiveDialog.boundingBox();
      expect(box).not.toBeNull();
      if (!box) throw new Error('Immersive guide did not have a rendered box');
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      const rem = await immersivePage.evaluate(() =>
        Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      );
      expect(box.width).toBeLessThanOrEqual(28 * rem);
      expect(box.height).toBeLessThanOrEqual(Math.min(viewport.height * 0.6, 28 * rem) + 1);
      await immersivePage.screenshot({
        path: testInfo.outputPath(`immersive-guide-${viewport.width}x${viewport.height}.png`),
      });
      await immersivePage.keyboard.press('Escape');
      await expect(immersiveDialog).toHaveCount(0);
    }
    await immersivePage.close();
  });
});
