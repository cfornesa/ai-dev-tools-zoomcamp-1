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
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import JSZip from 'jszip';
import { expect, test, type Page } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function extractBundle(zip: JSZip, prefix: string) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const target = path.join(directory, entry.name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, await entry.async('nodebuffer'));
  }
  return { directory, indexUrl: pathToFileURL(path.join(directory, 'index.html')).href };
}

async function expectThreeDStageChrome(page: Page) {
  const frame = page.getByTestId('scene3d-preview-canvas-frame');
  const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
  await expect(toolbar).toBeVisible();
  // Issue #347: the shared stage command surface is intentionally closed by
  // default. Enter through its hamburger before asserting contextual actions.
  await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
  await expect(toolbar.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Enable sound' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Piece controls', exact: true })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Steer the piece' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Show hand gesture guide' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeVisible();
  const publicationTrigger = toolbar.getByRole('button', {
    name: 'Publication status: Draft',
  });
  await expect(publicationTrigger).toBeVisible();
  await publicationTrigger.click();
  await expect(
    toolbar.getByRole('group', { name: 'Publication status', exact: true }),
  ).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Draft', exact: true })).toBeDisabled();
  await expect(toolbar.getByRole('button', { name: 'Published', exact: true })).toBeEnabled();

  await toolbar.getByRole('button', { name: 'Piece controls', exact: true }).click();
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

    await page
      .getByTestId('scene3d-preview-canvas-frame')
      .getByRole('toolbar', { name: 'Preview actions' })
      .getByRole('button', { name: 'Open piece controls menu' })
      .click();
    const publicationTrigger = page.getByRole('button', {
      name: 'Publication status: Draft',
    });
    await publicationTrigger.click();
    await page.getByRole('button', { name: 'Published' }).click();
    const dialog = page.getByRole('alertdialog', { name: /Publish/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');

    await page.goto(`/p3d/${projectId}`);
    const frame = page.getByTestId('scene3d-preview-canvas-frame');
    const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
    await expect(toolbar).toBeVisible();
    await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    await expect(toolbar.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Enable sound' })).toBeVisible();
    await expect(
      toolbar.getByRole('button', { name: 'Piece controls', exact: true }),
    ).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Steer the piece' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Show hand gesture guide' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeVisible();

    await toolbar.getByRole('button', { name: 'Piece controls', exact: true }).click();
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
    const threeRuntime = await fs.readFile(
      path.resolve(process.cwd(), 'node_modules/three/build/three.min.js'),
      'utf8',
    );
    await page.route('**/three@0.160.0/build/three.min.js', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: threeRuntime,
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

    // Execute both extracted bundles as a user would, from file://, so the
    // acceptance proof covers the packaged runtime behavior and controls,
    // not only source-string markers in the ZIP.
    const artifactPage = await page.context().newPage();
    const fullArtifact = await extractBundle(fullZip, 'creatrweb-full-3d-');
    await artifactPage.goto(fullArtifact.indexUrl);
    await expect(artifactPage.locator('#scene3d-canvas-host canvas')).toHaveCount(1);
    await expect(artifactPage.getByRole('toolbar', { name: 'Piece actions' })).toBeVisible();
    await artifactPage.getByRole('button', { name: 'Open piece controls menu' }).click();
    await expect(artifactPage.getByRole('dialog', { name: 'Piece actions' })).toBeVisible();
    await artifactPage.getByRole('button', { name: 'Piece controls', exact: true }).click();
    await expect(artifactPage.getByRole('group', { name: 'Piece controls' })).toBeVisible();
    const cameraBeforeTravel = await artifactPage.evaluate(() =>
      (window as unknown as { __exportGetCameraState: () => unknown }).__exportGetCameraState(),
    );
    await artifactPage.locator('body').press('ArrowUp');
    await artifactPage.waitForTimeout(100);
    const cameraAfterTravel = await artifactPage.evaluate(() =>
      (window as unknown as { __exportGetCameraState: () => unknown }).__exportGetCameraState(),
    );
    expect(cameraAfterTravel).not.toEqual(cameraBeforeTravel);
    await artifactPage.getByRole('button', { name: 'Reset view' }).click();
    await expect(artifactPage.getByRole('button', { name: 'Enable sound' })).toBeVisible();

    const nonCameraArtifact = await extractBundle(nonCameraZip, 'creatrweb-non-camera-3d-');
    await artifactPage.goto(nonCameraArtifact.indexUrl);
    await expect(artifactPage.locator('#scene3d-canvas-host canvas')).toHaveCount(1);
    await artifactPage.getByRole('button', { name: 'Open piece controls menu' }).click();
    await artifactPage.getByRole('button', { name: 'Piece controls', exact: true }).click();
    await expect(artifactPage.getByRole('group', { name: 'Piece controls' })).toBeVisible();
    await expect(artifactPage.getByRole('button', { name: 'Live mic' })).toHaveCount(0);
    await expect(artifactPage.getByRole('button', { name: 'Camera theremin' })).toHaveCount(0);
    await artifactPage.getByRole('button', { name: 'Reset view' }).click();
    await artifactPage.close();
    await fs.rm(fullArtifact.directory, { recursive: true, force: true });
    await fs.rm(nonCameraArtifact.directory, { recursive: true, force: true });

    await page.goto(`/projects3d/${projectId}`);
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');
    await page
      .getByTestId('scene3d-preview-canvas-frame')
      .getByRole('toolbar', { name: 'Preview actions' })
      .getByRole('button', { name: 'Open piece controls menu' })
      .click();
    await page.getByRole('button', { name: 'Publication status: Published' }).click();
    const unpublishResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/projects3d/${projectId}/unpublish/`) && response.ok(),
    );
    const draftButton = page
      .locator('.piece-stage-controls-panel[aria-label="Publication status: Published"]')
      .getByRole('button', { name: 'Draft', exact: true });
    await expect(draftButton).toBeVisible();
    await expect(draftButton).toBeEnabled();
    await draftButton.click();
    await unpublishResponse;
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Private');
  });

  test('immersive 3D touch d-pad holds and releases the matching travel keys', async ({ page }) => {
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
    await page
      .getByTestId('scene3d-preview-canvas-frame')
      .getByRole('toolbar', { name: 'Preview actions' })
      .getByRole('button', { name: 'Open piece controls menu' })
      .click();
    await page.getByRole('button', { name: 'Publication status: Draft' }).click();
    await page.getByRole('button', { name: 'Published', exact: true }).click();
    const dialog = page.getByRole('alertdialog', { name: /Publish/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');

    await page.goto(`/immersive/p3d/${projectId}`);
    const navigation = page.getByRole('region', { name: 'Immersive touch navigation' });
    await expect(navigation).toBeVisible();
    const directions = [
      ['Move forward', 'ArrowUp'],
      ['Move left', 'ArrowLeft'],
      ['Move backward', 'ArrowDown'],
      ['Move right', 'ArrowRight'],
      ['Zoom in', 'ZoomIn'],
      ['Zoom out', 'ZoomOut'],
    ] as const;
    await expect(navigation.getByRole('button')).toHaveCount(directions.length);

    await page.evaluate(() => {
      (window as unknown as { __touchKeyEvents?: string[] }).__touchKeyEvents = [];
      window.addEventListener('keydown', (event) => {
        (window as unknown as { __touchKeyEvents: string[] }).__touchKeyEvents.push(
          `${event.type}:${event.key}`,
        );
      });
      window.addEventListener('keyup', (event) => {
        (window as unknown as { __touchKeyEvents: string[] }).__touchKeyEvents.push(
          `${event.type}:${event.key}`,
        );
      });
    });

    const keyboardButton = navigation.getByRole('button', { name: 'Move forward' });
    await keyboardButton.focus();
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe(
      'Move forward',
    );
    await page.keyboard.press('Space');
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { __touchKeyEvents: string[] }).__touchKeyEvents),
      )
      .toEqual(['keydown: ', 'keyup: ', 'keydown:ArrowUp', 'keyup:ArrowUp']);

    for (const [label, key] of directions) {
      const button = navigation.getByRole('button', { name: label });
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(40);
      expect(box?.height).toBeGreaterThanOrEqual(40);

      await page.evaluate(() => {
        (window as unknown as { __touchKeyEvents: string[] }).__touchKeyEvents.length = 0;
      });
      await button.dispatchEvent('pointerdown', { pointerType: 'touch', bubbles: true });
      await button.dispatchEvent('pointerup', { pointerType: 'touch', bubbles: true });
      await expect
        .poll(() =>
          page.evaluate(
            () => (window as unknown as { __touchKeyEvents: string[] }).__touchKeyEvents,
          ),
        )
        .toEqual([`keydown:${key}`, `keyup:${key}`]);
    }
  });
});
