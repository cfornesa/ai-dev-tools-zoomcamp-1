/** Issue #734: canonical immersive 3D keeps the shared camera overlay full-stage. */
import { chromium, expect, test } from '@playwright/test';

import { apiGet, apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test('canonical immersive 3D camera overlay fills and centers the stage at desktop and mobile', async ({
  page,
}, testInfo) => {
  const fixtures: Fixtures = requireE2EFixtures();
  await loginViaUI(page, fixtures.owner.email, fixtures.password);
  await page.goto('/');
  await page.getByRole('button', { name: 'More creation options' }).click();
  const createdResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/projects3d/') && response.request().method() === 'POST',
  );
  await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
  const created = await createdResponse;
  expect(created.status()).toBe(201);
  const { id: projectId } = (await created.json()) as { id: string };
  await page.waitForURL(/\/users\/@[^/]+\/edit\/untitled-3d-scene(?:-\d+)?$/);

  await page
    .getByRole('group', { name: 'Publication status' })
    .getByRole('button', { name: 'Published', exact: true })
    .click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');

  const profileResponse = await apiGet(page.context(), '/api/account/profile/');
  expect(profileResponse.status()).toBe(200);
  const profile = (await profileResponse.json()) as { handle: string };
  const { handle } = profile;
  // An anonymous visitor can only see a piece whose owner's profile is public.
  expect(
    (await apiPatch(page.context(), '/api/account/profile/', { ...profile, is_public: true })).ok(),
  ).toBe(true);
  const publicProfileResponse = await apiGet(page.context(), `/api/users/@${handle}/`);
  expect(publicProfileResponse.status()).toBe(200);
  const publicProfile = (await publicProfileResponse.json()) as {
    pieces: Array<{ id: string; slug: string; type: string }>;
  };
  const piece = publicProfile.pieces.find((candidate) => candidate.id === projectId);
  if (!piece || piece.type !== '3d') throw new Error('Published immersive fixture was not found.');

  const fakeBrowser = await chromium.launch({
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  const anonymousContext = await fakeBrowser.newContext({ permissions: ['camera'] });
  const anonymousPage = await anonymousContext.newPage();
  try {
    await anonymousPage.goto(`/users/@${handle}/immersive/${piece.slug}`);
    const frame = anonymousPage.getByTestId('scene3d-preview-canvas-frame');
    const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
    // A fresh browser process cold-starts the dev server's route chunks, which can take a while.
    await expect(frame).toBeVisible({ timeout: 45_000 });
    // Steer lives inside the Piece controls popover (#767).
    await toolbar.getByRole('button', { name: 'Piece controls', exact: true }).click();
    await toolbar
      .getByRole('group', { name: 'Piece controls' })
      .getByRole('button', { name: 'Steer the piece' })
      .click();
    const video = anonymousPage.getByTestId('scene3d-camera-overlay-video');
    await expect(video).toBeVisible();

    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 375, height: 812 },
    ]) {
      await anonymousPage.setViewportSize(viewport);
      const geometry = await frame.evaluate((frameElement) => {
        const frameBox = frameElement.getBoundingClientRect();
        const availableBox = frameElement.parentElement?.getBoundingClientRect();
        const videoElement = frameElement.querySelector<HTMLVideoElement>(
          '.scene3d-camera-overlay-video',
        );
        const videoBox = videoElement?.getBoundingClientRect();
        const toolbarElement = frameElement.querySelector<HTMLElement>('.piece-stage-toolbar');
        const dpadElement = frameElement.querySelector<HTMLElement>('.scene3d-touch-dpad');
        return {
          frame: { x: frameBox.x, y: frameBox.y, width: frameBox.width, height: frameBox.height },
          video: videoBox
            ? { x: videoBox.x, y: videoBox.y, width: videoBox.width, height: videoBox.height }
            : null,
          videoZ: videoElement ? getComputedStyle(videoElement).zIndex : null,
          toolbarZ: toolbarElement ? getComputedStyle(toolbarElement).zIndex : null,
          dpadZ: dpadElement ? getComputedStyle(dpadElement).zIndex : null,
          viewport: {
            originX: availableBox?.x ?? 0,
            originY: availableBox?.y ?? 0,
            width: availableBox?.width ?? document.documentElement.clientWidth,
            height: availableBox?.height ?? window.innerHeight,
          },
        };
      });
      const expectedWidth = Math.min(geometry.viewport.width, (geometry.viewport.height * 16) / 9);
      const expectedHeight = expectedWidth * (9 / 16);
      const expectedX = (geometry.viewport.width - expectedWidth) / 2;
      const expectedY = (geometry.viewport.height - expectedHeight) / 2;
      expect(geometry.frame.width).toBeCloseTo(expectedWidth, 0);
      expect(geometry.frame.height).toBeCloseTo(expectedHeight, 0);
      const frameXWithinTolerance = geometry.frame.x - (geometry.viewport.originX ?? 0) - expectedX;
      const frameYWithinTolerance = geometry.frame.y - (geometry.viewport.originY ?? 0) - expectedY;
      expect(Math.abs(frameXWithinTolerance)).toBeLessThanOrEqual(1);
      expect(Math.abs(frameYWithinTolerance)).toBeLessThanOrEqual(1);
      expect(geometry.video).not.toBeNull();
      expect(geometry.video?.x).toBeCloseTo(geometry.frame.x, 0);
      expect(geometry.video?.y).toBeCloseTo(geometry.frame.y, 0);
      expect(geometry.video?.width).toBeCloseTo(geometry.frame.width, 0);
      expect(geometry.video?.height).toBeCloseTo(geometry.frame.height, 0);
      expect(Number(geometry.videoZ)).toBeLessThan(Number(geometry.toolbarZ));
      expect(Number(geometry.videoZ)).toBeLessThan(Number(geometry.dpadZ));

      // The popover opened for Steer above stays open ("Hide piece controls") until the first pass
      // closes it below, so only open it when it is not already open.
      if (
        !(await toolbar
          .getByRole('button', { name: 'Hide piece controls' })
          .isVisible()
          .catch(() => false))
      ) {
        await toolbar.getByRole('button', { name: 'Piece controls', exact: true }).click();
      }
      const controls = toolbar.getByRole('group', { name: 'Piece controls' });
      await expect(controls.getByRole('slider', { name: 'Camera opacity' })).toBeVisible();
      await expect(controls.getByRole('checkbox', { name: 'Mirror camera overlay' })).toBeVisible();
      await toolbar.getByRole('button', { name: 'Hide piece controls' }).click();
      await expect(frame.getByRole('button', { name: 'Move forward' })).toBeVisible();
      await expect(frame.getByRole('button', { name: 'Zoom in' })).toBeVisible();
      await frame.getByRole('button', { name: 'Move forward' }).click();
      await frame.getByRole('button', { name: 'Zoom in' }).click();
      await anonymousPage.screenshot({
        path: testInfo.outputPath(`issue-734-${viewport.name}.png`),
        fullPage: false,
      });
    }
  } finally {
    await anonymousContext.close();
    await fakeBrowser.close();
  }
});
