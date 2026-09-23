/** Issue #728: public 3D camera feeds occupy the complete stage. */
import { chromium, expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('public 3D camera overlay geometry (#728)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('matches the stage at desktop and mobile viewports, keeps chrome above it, and captures evidence', async ({
    page,
  }, testInfo) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
    await page.waitForURL(/\/projects3d\/[^/]+$/);
    const projectId = /\/projects3d\/([^/]+)$/.exec(page.url())?.[1];
    expect(projectId).toBeTruthy();
    if (!projectId) return;

    await page
      .getByRole('group', { name: 'Publication status' })
      .getByRole('button', { name: 'Published', exact: true })
      .click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Publish', exact: true })
      .click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');

    const fakeBrowser = await chromium.launch({
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    });
    try {
      const anonymousContext = await fakeBrowser.newContext({ permissions: ['camera'] });
      const anonymousPage = await anonymousContext.newPage();
      try {
        await anonymousPage.goto(`/immersive/p3d/${projectId}`);
        const frame = anonymousPage.getByTestId('scene3d-preview-canvas-frame');
        const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
        await toolbar.getByRole('button', { name: 'Steer the piece' }).click();
        const video = anonymousPage.getByTestId('scene3d-camera-overlay-video');
        await expect(video).toBeVisible();

        for (const viewport of [
          { name: 'desktop', width: 1440, height: 900 },
          { name: 'mobile', width: 375, height: 812 },
        ]) {
          await anonymousPage.setViewportSize(viewport);
          const geometry = await frame.evaluate((stage) => {
            const stageBox = stage.getBoundingClientRect();
            const video = stage.querySelector<HTMLVideoElement>('.scene3d-camera-overlay-video');
            const videoBox = video?.getBoundingClientRect();
            const toolbar = stage.querySelector<HTMLElement>('.piece-stage-toolbar');
            return {
              stage: {
                x: stageBox.x,
                y: stageBox.y,
                width: stageBox.width,
                height: stageBox.height,
              },
              video: videoBox
                ? { x: videoBox.x, y: videoBox.y, width: videoBox.width, height: videoBox.height }
                : null,
              videoStyle: video
                ? {
                    objectFit: getComputedStyle(video).objectFit,
                    pointerEvents: getComputedStyle(video).pointerEvents,
                  }
                : null,
              toolbarZ: toolbar ? getComputedStyle(toolbar).zIndex : null,
              videoZ: video ? getComputedStyle(video).zIndex : null,
            };
          });
          expect(geometry.video).not.toBeNull();
          expect(geometry.video?.x).toBeCloseTo(geometry.stage.x, 0);
          expect(geometry.video?.y).toBeCloseTo(geometry.stage.y, 0);
          expect(geometry.video?.width).toBeCloseTo(geometry.stage.width, 0);
          expect(geometry.video?.height).toBeCloseTo(geometry.stage.height, 0);
          expect(geometry.videoStyle?.objectFit).toBe('cover');
          expect(geometry.videoStyle?.pointerEvents).toBe('none');
          expect(Number(geometry.videoZ)).toBeLessThan(Number(geometry.toolbarZ));
          await anonymousPage.screenshot({
            path: testInfo.outputPath(`issue-728-${viewport.name}.png`),
            fullPage: false,
          });
        }
      } finally {
        await anonymousContext.close();
      }
    } finally {
      await fakeBrowser.close();
    }
  });
});
