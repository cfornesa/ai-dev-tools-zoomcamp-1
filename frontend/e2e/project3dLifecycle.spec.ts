/**
 * Task 207 (issue #239): closes the "no E2E test exercises 3D project
 * creation" coverage gap discovered while investigating task 206/#238's
 * production incident. `make e2e` (133 passed) and `pytest` (794 passed)
 * were both green immediately before the publish that introduced #238,
 * yet the 3D creation path was still broken live -- because nothing in
 * this suite ever drove it. See AGENTS.md's "End-to-end tests
 * (Playwright)" section for how to run this suite.
 *
 * Mirrors `projectLifecycle.spec.ts`'s conventions (fixtures, self-skip
 * via `requireE2EFixtures()`) but only covers 3D project creation --
 * everything else about the 3D manual/AI-assisted editors (outline,
 * inspector, code tab, AI proposals) is out of scope per the issue.
 */
import fs from 'node:fs/promises';

import JSZip from 'jszip';
import { expect, test, type Page } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function expectThreeDStageChrome(page: Page) {
  const frame = page.getByTestId('scene3d-preview-canvas-frame');
  const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
  await expect(toolbar).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Enable sound' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Piece controls' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Steer the piece' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Show hand gesture guide' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeVisible();

  await toolbar.getByRole('button', { name: 'Piece controls' }).click();
  await expect(toolbar.getByRole('group', { name: 'Piece controls' })).toBeVisible();

  await toolbar.getByRole('button', { name: 'Open download menu' }).click();
  await expect(toolbar.getByRole('menuitem', { name: 'Download Full ZIP' })).toBeVisible();
  await expect(toolbar.getByRole('menuitem', { name: 'Download Non-Camera ZIP' })).toBeVisible();
}

test.describe('3D project creation', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('creating a new 3D project persists it and opens the manual editor', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);

    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
    await page.waitForURL(/\/projects3d\/[^/]+$/);
    const match = /\/projects3d\/([^/]+)$/.exec(page.url());
    expect(match).not.toBeNull();

    // Confirms the manual editor actually loaded the newly-created project
    // (not just that the route matched) -- this testid only renders once
    // Project3DWorkspace.tsx has fetched the project and its current
    // version successfully (Project3DWorkspace.tsx).
    await expect(page.getByTestId('project3d-save-status')).toBeVisible();
    await expectThreeDStageChrome(page);
    await expect(page.getByTestId('project3d-save-button')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Download standalone bundle' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ask AI to improve this scene' })).toBeVisible();

    // Reload to prove the project genuinely persisted server-side, not
    // just in local React state from the create response.
    await page.reload();
    await expect(page.getByTestId('project3d-save-status')).toBeVisible();
  });

  test('creating a new AI-assisted 3D project persists it and opens the AI-assisted editor', async ({
    page,
  }: {
    page: Page;
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);

    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create an AI-assisted 3D project' }).click();
    await page.waitForURL(/\/ai-projects3d\/[^/]+$/);
    const match = /\/ai-projects3d\/([^/]+)$/.exec(page.url());
    expect(match).not.toBeNull();

    // AiProject3DWorkspace.tsx mounts Scene3DPreview.tsx (issue #244) once
    // it has fetched the newly-created project and its current version
    // successfully -- same persistence proof as the manual scenario above,
    // via the AI-assisted route's own load path instead. A real browser
    // (unlike this repo's jsdom-based component tests) has WebGL, so the
    // live canvas -- not the WebGL-unavailable fallback -- is what proves
    // the preview actually mounted and rendered.
    await expect(page.getByTestId('scene3d-preview-canvas')).toBeVisible();
    await expectThreeDStageChrome(page);
    await expect(page.getByRole('button', { name: 'Download standalone bundle' })).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('scene3d-preview-canvas')).toBeVisible();
  });

  test('published 3D projects expose the shared public stage chrome and can return to Draft', async ({
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
    await page.getByRole('button', { name: 'Edit title' }).click();
    const titleForm = page.locator('.editor-title-edit');
    await titleForm.locator('#project3d-title-input').fill('Public 3D parity fixture');
    await titleForm.getByRole('button', { name: 'Save' }).click();
    await expect(titleForm).toHaveCount(0);

    await page.getByRole('button', { name: 'Published' }).click();
    const dialog = page.getByRole('alertdialog', { name: /Publish/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');

    await page.goto(`/p3d/${projectId}`);
    const frame = page.getByTestId('scene3d-preview-canvas-frame');
    const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Enable sound' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Piece controls' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Steer the piece' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Show hand gesture guide' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeVisible();

    await toolbar.getByRole('button', { name: 'Piece controls' }).click();
    await expect(toolbar.getByRole('group', { name: 'Piece controls' })).toBeVisible();
    await toolbar.getByRole('button', { name: 'Open download menu' }).click();
    const fullMenuItem = toolbar.getByRole('menuitem', { name: 'Download Full ZIP' });
    const nonCameraMenuItem = toolbar.getByRole('menuitem', {
      name: 'Download Non-Camera ZIP',
    });
    await expect(fullMenuItem).toBeVisible();
    await expect(nonCameraMenuItem).toBeVisible();

    // The bundle generator fetches the pinned Three.js runtime in the
    // browser. Fulfill that one request locally so this test proves the
    // actual click-to-download path without depending on a CDN.
    await page.route('**/three@0.160.0/build/three.min.js', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '/* browser QA runtime fixture */',
      }),
    );

    const fullDownloadPromise = page.waitForEvent('download');
    await fullMenuItem.click();
    const fullDownload = await fullDownloadPromise;
    const fullPath = await fullDownload.path();
    expect(fullPath).not.toBeNull();
    if (!fullPath) return;
    const fullZip = await JSZip.loadAsync(await fs.readFile(fullPath));
    const fullHtml = await fullZip.file('index.html')?.async('string');
    const fullScript = await fullZip.file('scripts/piece.js')?.async('string');
    expect(fullHtml).toContain('piece-audio-controls');
    expect(fullHtml).toContain('camera-controls-host');
    expect(fullScript).toContain('getUserMedia');
    expect(fullScript).toContain('thereminEnabled');

    await toolbar.getByRole('button', { name: 'Open download menu' }).click();
    const nonCameraDownloadPromise = page.waitForEvent('download');
    await toolbar.getByRole('menuitem', { name: 'Download Non-Camera ZIP' }).click();
    const nonCameraDownload = await nonCameraDownloadPromise;
    const nonCameraPath = await nonCameraDownload.path();
    expect(nonCameraPath).not.toBeNull();
    if (!nonCameraPath) return;
    const nonCameraZip = await JSZip.loadAsync(await fs.readFile(nonCameraPath));
    const nonCameraHtml = await nonCameraZip.file('index.html')?.async('string');
    const nonCameraScript = await nonCameraZip.file('scripts/piece.js')?.async('string');
    expect(nonCameraHtml).not.toContain('camera-controls-host');
    expect(nonCameraHtml).not.toContain('piece-theremin');
    expect(nonCameraScript).not.toContain('getUserMedia');
    expect(nonCameraScript).not.toContain('thereminEnabled');

    await page.goto(`/projects3d/${projectId}`);
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');
    await page.getByRole('button', { name: 'Draft' }).click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Private');
  });
});
