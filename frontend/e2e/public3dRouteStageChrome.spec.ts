/**
 * Consolidates issues #387/#388/#389: the anonymous public 3D route family
 * (regular embed, immersive, CMS-wrapped immersive) shares one
 * create -> publish -> anonymous-visit -> assert-toolbar-and-geometry ->
 * revert-to-draft script, differing only in route, expected button set,
 * and a couple of route-specific assertions (CMS embed-mode attribute,
 * camera-request tracking). One parameterized test preserves each
 * variant's distinct regression signal while running as a single
 * Playwright test invocation instead of three.
 */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

const BASE_BUTTONS = ['Take screenshot', 'Open download menu', 'Expand piece to fullscreen'];
const IMMERSIVE_BUTTONS = ['Enable sound', 'Steer the piece', 'Show hand gesture guide'];

type RouteCase = {
  name: string;
  routeSuffix: string;
  trackCamera: boolean;
  expectedButtons: string[];
  extraAssertions?: (page: import('@playwright/test').Page, viewerTestId: string) => Promise<void>;
};

const CASES: RouteCase[] = [
  {
    name: 'embed (#387)',
    routeSuffix: '/embed/p3d',
    trackCamera: false,
    expectedButtons: [...BASE_BUTTONS, 'Piece controls'],
  },
  {
    name: 'immersive (#388)',
    routeSuffix: '/immersive/p3d',
    trackCamera: true,
    expectedButtons: [...BASE_BUTTONS, ...IMMERSIVE_BUTTONS, 'Piece controls'],
  },
  {
    name: 'immersive CMS (#389)',
    routeSuffix: '/immersive/p3d',
    trackCamera: true,
    expectedButtons: [...BASE_BUTTONS, ...IMMERSIVE_BUTTONS, 'Piece controls'],
    extraAssertions: async (page, viewerTestId) => {
      const viewer = page.getByTestId(viewerTestId);
      await expect(viewer).toHaveAttribute('data-immersive-embed-mode', 'cms');
      await expect(viewer.getByRole('heading')).toHaveCount(0);
      await expect(viewer.getByRole('button', { name: 'Embed (Custom)' })).toHaveCount(0);
      await expect(viewer.getByRole('button', { name: 'Embed (CMS)' })).toHaveCount(0);
    },
  },
];

test.describe('anonymous public 3D route stage chrome (#387/#388/#389)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('embed, immersive, and CMS-immersive routes each stay chrome-less with the correct control set', async ({
    page,
    browser,
  }) => {
    for (const [index, routeCase] of CASES.entries()) {
      if (index === 0) {
        await loginViaUI(page, fixtures.owner.email, fixtures.password);
      }
      await page.goto('/');
      await page.getByRole('button', { name: 'More creation options' }).click();
      await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
      await page.waitForURL(/\/projects3d\/[^/]+$/);
      const projectId = /\/projects3d\/([^/]+)$/.exec(page.url())?.[1];
      expect(projectId).toBeTruthy();
      if (!projectId) continue;

      await page.setViewportSize({ width: 1280, height: 900 });
      await page
        .getByRole('group', { name: 'Publication status' })
        .getByRole('button', { name: 'Published', exact: true })
        .click();
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Publish', exact: true })
        .click();
      await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');

      const context = await browser.newContext();
      let cameraRequests = 0;
      if (routeCase.trackCamera) {
        await context.addInitScript(() => {
          const devices = navigator.mediaDevices;
          if (!devices) return;
          const original = devices.getUserMedia.bind(devices);
          Object.defineProperty(devices, 'getUserMedia', {
            configurable: true,
            value: (...args: Parameters<MediaDevices['getUserMedia']>) => {
              window.dispatchEvent(new Event('camera-requested'));
              return original(...args);
            },
          });
        });
      }
      const anonymousPage = await context.newPage();
      try {
        if (routeCase.trackCamera) {
          await anonymousPage.exposeFunction('recordCameraRequest', () => {
            cameraRequests += 1;
          });
          await anonymousPage.addInitScript(() => {
            window.addEventListener('camera-requested', () => {
              void (
                window as unknown as { recordCameraRequest: () => Promise<void> }
              ).recordCameraRequest();
            });
          });
        }
        const suffix =
          routeCase.name === 'immersive CMS (#389)' ? `${projectId}?embed=1&cms=1` : projectId;
        await anonymousPage.goto(`${routeCase.routeSuffix}/${suffix}`);
        const frame = anonymousPage.getByTestId('scene3d-preview-canvas-frame');
        const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
        await expect(frame).toBeVisible();
        await expect(toolbar).toBeVisible();
        await expect(anonymousPage.locator('.app-shell-header')).toHaveCount(0);
        await expect(anonymousPage.getByRole('link', { name: 'Public gallery' })).toHaveCount(0);
        if (routeCase.trackCamera) expect(cameraRequests).toBe(0);
        if (routeCase.extraAssertions) {
          await routeCase.extraAssertions(anonymousPage, 'immersive-project3d-viewer');
        }

        await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
        for (const viewport of [
          { name: 'desktop', width: 1280, height: 900 },
          { name: 'mobile', width: 375, height: 812 },
        ]) {
          await anonymousPage.setViewportSize(viewport);
          const dialog = toolbar.getByRole('dialog', { name: 'Preview actions' });
          await expect(dialog).toBeVisible();
          for (const name of routeCase.expectedButtons) {
            await expect(
              dialog.getByRole('button', { name, exact: name === 'Piece controls' }),
            ).toBeVisible();
          }
          const metrics = await frame.evaluate((element) => {
            const box = element.getBoundingClientRect();
            const canvas = element.querySelector('canvas');
            const card = document.querySelector('.piece-stage-command-card');
            const cardBox = card?.getBoundingClientRect();
            return {
              frameRatio: box.width / box.height,
              canvasRatio: (canvas?.width ?? 0) / (canvas?.height ?? 1),
              documentWidth: document.documentElement.scrollWidth,
              viewportWidth: innerWidth,
              cardInside: Boolean(
                cardBox &&
                cardBox.x >= 0 &&
                cardBox.y >= 0 &&
                cardBox.right <= innerWidth &&
                cardBox.bottom <= innerHeight,
              ),
              cardOverflow: card ? getComputedStyle(card).overflowY : 'missing',
            };
          });
          expect(metrics.frameRatio).toBeCloseTo(16 / 9, 1);
          expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
          expect(metrics.cardInside).toBe(true);
          expect(['auto', 'scroll']).not.toContain(metrics.cardOverflow);
        }
        await anonymousPage.keyboard.press('Escape');
        await expect(toolbar.getByRole('dialog', { name: 'Preview actions' })).toBeHidden();
      } finally {
        await context.close();
      }

      await page.goto(`/projects3d/${projectId}`);
      await page
        .getByRole('group', { name: 'Publication status' })
        .getByRole('button', { name: 'Draft', exact: true })
        .click();
      await expect(page.getByTestId('visibility-status-3d')).toContainText('Private');
    }
  });
});
