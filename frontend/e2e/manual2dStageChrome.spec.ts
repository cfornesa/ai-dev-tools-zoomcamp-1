/** Issues #325/#348: manual 2D controls stay in compact stage-local chrome. */
import { expect, test, type Page } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function hasNativeFullscreenSupport(page: Page) {
  return page.evaluate(
    () =>
      document.fullscreenEnabled &&
      typeof Element.prototype.requestFullscreen === 'function' &&
      typeof document.exitFullscreen === 'function',
  );
}

test.describe('manual 2D editor stage chrome', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('renders finite stage actions without the legacy page-level publication row', async ({
    page,
    browserName,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new animation' }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);

    const stage = page.locator('.piece-stage-shell');
    const authoringToolbar = stage.getByRole('toolbar', { name: 'Editor actions' });
    const stageMenu = stage.locator('button.piece-stage-menu-trigger');
    const editSceneButton = stage.getByRole('button', { name: /^(Edit scene|Hide edit scene)$/ });
    await stageMenu.click();
    const stageDialog = stage.getByRole('dialog');
    await expect(editSceneButton).toBeVisible();
    await expect(authoringToolbar).toBeHidden();
    await expect(page.locator('.editor-workspace-header .editor-toolbar')).toHaveCount(0);

    // Verify both real browser input paths for the stage-local command menu,
    // then exercise the shared fullscreen action through the browser API.
    await expect(stageMenu).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(stageDialog).toBeHidden();
    await expect(stageMenu).toHaveAttribute('aria-expanded', 'false');
    await expect(stageMenu).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(stageDialog).toBeVisible();
    await expect(
      stageDialog.getByRole('button', { name: 'Close piece controls menu' }),
    ).toBeFocused();
    const fullscreenButton = stageDialog.getByRole('button', {
      name: 'Expand piece to fullscreen',
      exact: true,
    });
    const nativeFullscreenSupported = await hasNativeFullscreenSupport(page);
    if (!nativeFullscreenSupported) {
      if (browserName === 'chromium') {
        throw new Error(
          'Chromium must expose native fullscreen support for this regression suite.',
        );
      }
      test.info().annotations.push({
        type: 'note',
        description: `Native fullscreen is unavailable in the ${browserName} runner; fullscreen assertions are skipped for this engine.`,
      });
    }
    await expect(fullscreenButton).toBeVisible();
    if (nativeFullscreenSupported) {
      await fullscreenButton.click();
      await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
      await expect(
        stageDialog.getByRole('button', { name: 'Exit fullscreen', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await stageDialog.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
      await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
      await expect(
        stageDialog.getByRole('button', { name: 'Expand piece to fullscreen', exact: true }),
      ).toHaveAttribute('aria-pressed', 'false');
    }

    await editSceneButton.click();
    await expect(authoringToolbar).toBeVisible();
    for (const label of [
      'Add circle',
      'Add rectangle',
      'Add line',
      'Add polygon',
      'Undo',
      'Redo',
      'Duplicate selected shape',
      'Delete selected shape',
      'Add layer',
      'Combine into group',
      'Ungroup selected',
      'Delete selected group',
      'Save',
    ]) {
      await expect(authoringToolbar.getByRole('button', { name: label })).toBeVisible();
    }
    const initialShapeCount = await page.getByText(/shape\(s\) in the working copy\./).innerText();
    await authoringToolbar.getByRole('button', { name: 'Add circle' }).click();
    await expect(page.getByText(/1 shape\(s\) in the working copy\./)).toBeVisible();
    await expect(authoringToolbar.getByRole('button', { name: 'Undo' })).toBeEnabled();
    await authoringToolbar.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText(initialShapeCount)).toBeVisible();

    const toolbar = stage.getByRole('toolbar', { name: 'Piece actions' });
    await expect(toolbar).toBeVisible();
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(editSceneButton).toBeVisible();
      await expect(authoringToolbar).toBeVisible();
      await expect(toolbar).toBeVisible();
      await expect(stageDialog.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
      await expect(
        stageDialog.getByRole('button', { name: 'Publication status: Draft' }),
      ).toBeVisible();
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(stageDialog.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
    await expect(stageDialog.getByRole('button', { name: 'Open download menu' })).toBeVisible();
    await expect(
      stageDialog.getByRole('button', { name: 'Expand piece to fullscreen' }),
    ).toBeVisible();
    await expect(
      stageDialog.getByRole('button', { name: 'Publication status: Draft' }),
    ).toBeVisible();
    await expect(page.locator('.editor-workspace-header .editor-publish-control')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Download standalone bundle' })).toHaveCount(0);

    const toolbarBox = await toolbar.boundingBox();
    const stageBox = await stage.boundingBox();
    expect(toolbarBox).not.toBeNull();
    expect(stageBox).not.toBeNull();
    expect(toolbarBox!.x).toBeGreaterThanOrEqual(stageBox!.x);
    expect(toolbarBox!.y).toBeGreaterThanOrEqual(stageBox!.y);
    expect(toolbarBox!.x + toolbarBox!.width).toBeLessThanOrEqual(stageBox!.x + stageBox!.width);

    const authoringBox = await authoringToolbar.boundingBox();
    const stageBoxForAuthoring = await stage.boundingBox();
    expect(authoringBox).not.toBeNull();
    expect(stageBoxForAuthoring).not.toBeNull();
    expect(authoringBox!.x).toBeGreaterThanOrEqual(stageBoxForAuthoring!.x);
    // Firefox can round the positioned overlay to a few subpixels above the
    // stage edge; keep the containment check strict enough to catch actual
    // clipping without rejecting that browser-specific rasterization.
    expect(authoringBox!.y).toBeGreaterThanOrEqual(stageBoxForAuthoring!.y - 4);
    expect(authoringBox!.x + authoringBox!.width).toBeLessThanOrEqual(
      stageBoxForAuthoring!.x + stageBoxForAuthoring!.width,
    );
    expect(authoringBox!.y + authoringBox!.height).toBeLessThanOrEqual(
      stageBoxForAuthoring!.y + stageBoxForAuthoring!.height,
    );
    expect(authoringBox!.width).toBeLessThanOrEqual(520);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.keyboard.press('Escape');
    await expect(stageDialog).toBeHidden();
    await stageMenu.click();
    await expect(stageDialog).toBeVisible();
    await expect(
      stageDialog.getByRole('button', { name: 'Expand piece to fullscreen', exact: true }),
    ).toBeVisible();
    await editSceneButton.click();
    await expect(authoringToolbar).toBeHidden();
    if (nativeFullscreenSupported) {
      await stageDialog
        .getByRole('button', { name: 'Expand piece to fullscreen', exact: true })
        .click();
      await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
      await expect(
        stageDialog.getByRole('button', { name: 'Exit fullscreen', exact: true }),
      ).toBeVisible();
      await stageDialog.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
      await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
      await expect(stageDialog).toBeVisible();
    }
    await editSceneButton.click();
    await expect(authoringToolbar).toBeVisible();

    const mobileAuthoringBox = await authoringToolbar.boundingBox();
    const mobileStageBox = await stage.boundingBox();
    const mobileAuthoringPanelBox = await stageDialog
      .locator('.editor-authoring-controls-panel')
      .boundingBox();
    expect(mobileAuthoringBox).not.toBeNull();
    expect(mobileStageBox).not.toBeNull();
    expect(mobileAuthoringPanelBox).not.toBeNull();
    expect(mobileAuthoringBox!.x).toBeGreaterThanOrEqual(mobileStageBox!.x);
    expect(mobileAuthoringBox!.x + mobileAuthoringBox!.width).toBeLessThanOrEqual(
      mobileStageBox!.x + mobileStageBox!.width,
    );
    expect(mobileAuthoringBox!.width).toBeLessThanOrEqual(320);
    expect(mobileAuthoringPanelBox!.x).toBeGreaterThanOrEqual(0);
    expect(mobileAuthoringPanelBox!.x + mobileAuthoringPanelBox!.width).toBeLessThanOrEqual(375);

    await page.setViewportSize({ width: 1280, height: 900 });

    const chrome = await toolbar.evaluate((element) => {
      const toolbarStyle = getComputedStyle(element);
      const button = element.querySelector('.piece-stage-toolbar .piece-stage-icon-button');
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

    const runtimeLayout = await stageDialog
      .locator('.piece-stage-command-card > [role="group"]')
      .evaluate((element) => {
        const style = getComputedStyle(element);
        const iconSizes = Array.from(element.querySelectorAll('svg.piece-stage-icon')).map(
          (icon) => {
            const iconStyle = getComputedStyle(icon);
            return {
              width: Number.parseFloat(iconStyle.width),
              height: Number.parseFloat(iconStyle.height),
            };
          },
        );
        return {
          display: style.display,
          flexDirection: style.flexDirection,
          iconSizes,
        };
      });
    expect(runtimeLayout.display).toBe('flex');
    expect(runtimeLayout.flexDirection).toBe('column');
    expect(runtimeLayout.iconSizes.length).toBeGreaterThan(0);
    for (const icon of runtimeLayout.iconSizes) {
      expect(icon.width).toBeLessThanOrEqual(20);
      expect(icon.height).toBeLessThanOrEqual(20);
    }

    await stageDialog.getByRole('button', { name: 'Close edit scene' }).click();
    await expect(authoringToolbar).toBeHidden();

    await stageDialog.getByRole('button', { name: 'Publication status: Draft' }).click();
    await expect(
      stageDialog.getByRole('group', { name: 'Publication status', exact: true }),
    ).toBeVisible();
    const publicationPanel = stageDialog.locator('.publication-status-controls-panel');
    const publicationPanelBox = await publicationPanel.boundingBox();
    const commandCardBox = await stageDialog.locator('.piece-stage-command-card').boundingBox();
    expect(publicationPanelBox).not.toBeNull();
    expect(commandCardBox).not.toBeNull();
    expect(publicationPanelBox!.width).toBeLessThanOrEqual(320);
    expect(publicationPanelBox!.x).toBeGreaterThanOrEqual(commandCardBox!.x);
    expect(publicationPanelBox!.x + publicationPanelBox!.width).toBeLessThanOrEqual(
      commandCardBox!.x + commandCardBox!.width,
    );
    await expect(stageDialog.getByRole('button', { name: 'Draft', exact: true })).toBeDisabled();
    await expect(stageDialog.getByRole('button', { name: 'Published', exact: true })).toBeEnabled();
  });

  test('keeps the fullscreen command synchronized after browser Escape', async ({
    page,
    browserName,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new animation' }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);

    const stage = page.locator('.piece-stage-shell');
    const stageMenu = stage.locator('button.piece-stage-menu-trigger');
    await stageMenu.click();
    const stageDialog = stage.getByRole('dialog');
    const fullscreenButton = stageDialog.getByRole('button', {
      name: 'Expand piece to fullscreen',
      exact: true,
    });
    const nativeFullscreenSupported = await hasNativeFullscreenSupport(page);
    if (!nativeFullscreenSupported) {
      if (browserName === 'chromium') {
        throw new Error(
          'Chromium must expose native fullscreen support for this regression suite.',
        );
      }
      test.skip(
        true,
        `Native fullscreen is unavailable in the ${browserName} runner; browser Escape synchronization is not applicable.`,
      );
    }

    await expect(fullscreenButton).toBeVisible();
    await fullscreenButton.click();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
    await expect(
      stageDialog.getByRole('button', { name: 'Exit fullscreen', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
    // Firefox and WebKit may leave the stage command dialog visible after
    // native fullscreen is exited; close it through its normal control before
    // reopening the menu. Keep Chromium's hidden assertion strict so a
    // Chromium command-state regression cannot be normalized away.
    if (browserName !== 'chromium' && (await stageDialog.isVisible())) {
      await stageDialog.getByRole('button', { name: 'Close piece controls menu' }).click();
    }
    await expect(stageDialog).toBeHidden();
    await stageMenu.click();
    await expect(stageDialog).toBeVisible();
    await expect(
      stageDialog.getByRole('button', { name: 'Expand piece to fullscreen', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});
