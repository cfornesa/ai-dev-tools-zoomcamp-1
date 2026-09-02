/** Issue #325: manual 2D editor controls stay in the stage-local toolbar. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('manual 2D editor stage chrome', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('renders finite stage actions without the legacy page-level publication row', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new animation' }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);

    const stage = page.locator('.piece-stage-shell');
    const canvas = page.getByTestId('scene-canvas');
    const authoringToolbar = canvas.getByRole('toolbar', { name: 'Editor actions' });
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
    await expect(page.locator('.editor-workspace-header .editor-toolbar')).toHaveCount(0);

    const initialShapeCount = await page.getByText(/shape\(s\) in the working copy\./).innerText();
    await authoringToolbar.getByRole('button', { name: 'Add circle' }).click();
    await expect(page.getByText(/1 shape\(s\) in the working copy\./)).toBeVisible();
    await expect(authoringToolbar.getByRole('button', { name: 'Undo' })).toBeEnabled();
    await authoringToolbar.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText(initialShapeCount)).toBeVisible();

    const toolbar = stage.getByRole('toolbar', { name: 'Piece actions' });
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Open download menu' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Publication status: Draft' })).toBeVisible();
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
    const canvasBox = await canvas.boundingBox();
    expect(authoringBox).not.toBeNull();
    expect(canvasBox).not.toBeNull();
    expect(authoringBox!.x).toBeGreaterThanOrEqual(canvasBox!.x);
    expect(authoringBox!.y).toBeGreaterThanOrEqual(canvasBox!.y);
    expect(authoringBox!.x + authoringBox!.width).toBeLessThanOrEqual(
      canvasBox!.x + canvasBox!.width,
    );
    expect(authoringBox!.y + authoringBox!.height).toBeLessThanOrEqual(
      canvasBox!.y + canvasBox!.height,
    );

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
      buttonWidth: '49.5px',
      buttonHeight: '49.5px',
      buttonRadius: '13.5px',
    });

    await toolbar.getByRole('button', { name: 'Publication status: Draft' }).click();
    await expect(
      toolbar.getByRole('group', { name: 'Publication status', exact: true }),
    ).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Draft', exact: true })).toBeDisabled();
    await expect(toolbar.getByRole('button', { name: 'Published', exact: true })).toBeEnabled();
  });
});
