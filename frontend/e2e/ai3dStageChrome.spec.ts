/** Issue #339: independently verify AI-assisted 3D editor stage chrome. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { createServerProject3D } from './support/createProject3d.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('AI-assisted 3D editor stage chrome', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('keeps AI authoring and publication actions in the shared stage toolbar', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectId = await createServerProject3D(page);
    await page.goto(`/ai-projects3d/${projectId}`);
    await page.waitForURL(/\/users\/@[^/]+\/edit\/[^/]+$/);

    await expect(page.getByTestId('scene3d-preview-canvas')).toBeVisible();
    const frame = page.getByTestId('scene3d-preview-canvas-frame');
    const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
    await expect(toolbar).toBeVisible();
    const actions = toolbar.getByRole('group', { name: 'Preview actions' });
    const settings = page.getByRole('region', { name: 'Project settings' });
    await expect(actions).toBeVisible();
    await expect(actions.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
    await expect(actions.getByRole('button', { name: 'Open download menu' })).toBeVisible();
    await expect(actions.getByRole('button', { name: 'Enable sound' })).toBeVisible();
    const pieceControls = toolbar.getByRole('button', { name: 'Piece controls', exact: true });
    await expect(pieceControls).toBeVisible();
    await pieceControls.click();
    const controls = toolbar.getByRole('group', { name: 'Piece controls' });
    await expect(controls.getByRole('button', { name: 'Steer the piece' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Show hand gesture guide' })).toBeVisible();
    await toolbar.getByRole('button', { name: 'Hide piece controls', exact: true }).click();
    const immersivePopup = page.waitForEvent('popup');
    await actions.getByRole('button', { name: 'View immersive piece' }).click();
    const immersivePage = await immersivePopup;
    await expect(immersivePage).toHaveURL(/\/immersive\/p3d\/.+$/);
    await immersivePage.close();
    await expect(actions.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeVisible();
    await expect(
      settings.getByRole('button', { name: 'Ask AI to improve this scene' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download standalone bundle' })).toHaveCount(0);

    const toolbarBox = await toolbar.boundingBox();
    const frameBox = await frame.boundingBox();
    expect(toolbarBox).not.toBeNull();
    expect(frameBox).not.toBeNull();
    expect(toolbarBox!.x).toBeGreaterThanOrEqual(frameBox!.x);
    expect(toolbarBox!.y).toBeGreaterThanOrEqual(frameBox!.y);
    expect(toolbarBox!.x + toolbarBox!.width).toBeLessThanOrEqual(frameBox!.x + frameBox!.width);

    const publication = page.getByRole('group', { name: 'Publication status', exact: true });
    await expect(publication).toBeVisible();
    await expect(publication.getByRole('button', { name: 'Draft', exact: true })).toBeDisabled();
    await expect(publication.getByRole('button', { name: 'Published', exact: true })).toBeEnabled();
  });
});
