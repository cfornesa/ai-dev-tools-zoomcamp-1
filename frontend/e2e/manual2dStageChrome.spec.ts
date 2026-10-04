/** Issue #977: structured 2D editor control-row placement and responsive tools access. */
import { expect, test, type Page } from '@playwright/test';

import { apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { createServerProject2D } from './support/createProject.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function openServerBackedManualEditor(page: Page) {
  const created = await apiPost(page.context(), '/api/projects/blank/', { renderer: 'p5' });
  if (!created.ok()) {
    throw new Error(`Could not create the server-backed 2D editor fixture: ${created.status()}`);
  }
  const project = (await created.json()) as { editor_url?: string };
  if (!project.editor_url) throw new Error('The 2D editor fixture did not include editor_url.');
  await page.goto(project.editor_url);
  await page.waitForURL(/\/users\/@[^/]+\/edit\/[^/]+$/);
}

async function hasNativeFullscreenSupport(page: Page) {
  return page.evaluate(
    () =>
      document.fullscreenEnabled &&
      typeof Element.prototype.requestFullscreen === 'function' &&
      typeof document.exitFullscreen === 'function',
  );
}

test.describe('manual 2D editor shell', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('keeps primary actions in panel order and reveals tools responsively', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createServerProject2D(page);

    const preview = page.getByRole('region', { name: 'Preview' });
    const controlPanel = page.getByTestId('editor-control-panel');
    const primary = controlPanel.getByRole('group', { name: 'Primary editor actions' });
    const file = primary.getByRole('button', { name: 'File', exact: true });
    const save = primary.getByRole('button', { name: 'Save scene', exact: true });
    const askAi = primary.getByRole('button', {
      name: 'Ask AI to improve this scene',
      exact: true,
    });
    const viewToggle = preview.getByTestId('editor-preview-view-toggle');
    const zoom = preview.getByRole('group', { name: 'Zoom controls' });
    const stage = page.locator('.piece-stage-shell');
    const stageToolbar = stage.getByRole('toolbar', { name: 'Piece actions' });
    const authoringToolbar = controlPanel.getByRole('toolbar', { name: 'Editor actions' });
    const toolsToggle = controlPanel.getByRole('button', { name: 'Editor tools' });

    await expect(primary).toBeVisible();
    await expect(primary.locator('button')).toHaveCount(9);
    expect(
      await primary
        .locator('button')
        .evaluateAll((buttons) =>
          buttons.map(
            (button) =>
              button.getAttribute('aria-label') ?? button.textContent?.trim()?.replace(/^▤\s*/, ''),
          ),
        ),
    ).toEqual([
      'File',
      'Ask AI to improve this scene',
      'Visual',
      'Code',
      'Zoom out',
      'Zoom in',
      'Reset zoom',
      'Fit to viewport',
      'Save scene',
    ]);
    await expect(file).toBeVisible();
    await expect(save).toBeVisible();
    await expect(askAi).toBeVisible();
    await expect(authoringToolbar).toBeVisible();
    await expect(toolsToggle).toBeHidden();
    await expect(stageToolbar.getByRole('button', { name: 'Save scene' })).toHaveCount(0);
    await expect(
      stageToolbar.getByRole('button', { name: 'Ask AI to improve this scene' }),
    ).toHaveCount(0);
    await expect(stageToolbar.getByRole('button', { name: 'File', exact: true })).toHaveCount(0);
    await expect(viewToggle).toBeVisible();
    await expect(zoom).toBeVisible();

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(toolsToggle).toBeVisible();
    await expect(toolsToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(authoringToolbar).toBeHidden();
    await toolsToggle.click();
    await expect(toolsToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(authoringToolbar).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toolsToggle).toBeFocused();
    await expect(toolsToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(authoringToolbar).toBeHidden();
  });

  test('keeps the fullscreen command synchronized after browser Escape', async ({
    page,
    browserName,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await openServerBackedManualEditor(page);

    const stageToolbar = page.locator('.piece-stage-shell').getByRole('toolbar', {
      name: 'Piece actions',
    });
    const fullscreenButton = stageToolbar.getByRole('button', {
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
    const exitFullscreenButton = stageToolbar.getByRole('button', {
      name: 'Exit fullscreen',
      exact: true,
    });
    await expect(exitFullscreenButton).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
    await expect(
      stageToolbar.getByRole('button', {
        name: 'Expand piece to fullscreen',
        exact: true,
      }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});
