/**
 * Consolidates issues #333/#334/#335: the owner-view immersive 3D route
 * query-param family (regular, ?embed=1 custom, ?embed=1&cms=1 CMS) shares
 * one create -> publish -> navigate -> assert-toolbar script differing
 * only by query string and its mode-specific assertion.
 */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

const TOOLBAR_BUTTONS = [
  'Take screenshot',
  'Open download menu',
  'Enable sound',
  'Piece controls',
  'Steer the piece',
  'Show hand gesture guide',
  'Expand piece to fullscreen',
];

type Case = {
  name: string;
  query: string;
  assertMode: (page: import('@playwright/test').Page) => Promise<void>;
};

const CASES: Case[] = [
  {
    name: 'regular (#333)',
    query: '',
    assertMode: async (page) => {
      await expect(page.getByTestId('immersive-project3d-viewer')).not.toHaveAttribute(
        'data-immersive-embed-mode',
      );
      await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Embed (Custom)' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Embed (CMS)' })).toBeVisible();
    },
  },
  {
    name: 'custom (#334)',
    query: '?embed=1',
    assertMode: async (page) => {
      const viewer = page.getByTestId('immersive-project3d-viewer');
      await expect(viewer).toHaveAttribute('data-immersive-embed-mode', 'custom');
      await expect(viewer.getByRole('heading')).toHaveCount(0);
      await expect(viewer.getByRole('button', { name: 'Embed (Custom)' })).toHaveCount(0);
      await expect(viewer.getByRole('button', { name: 'Embed (CMS)' })).toHaveCount(0);
    },
  },
  {
    name: 'CMS (#335)',
    query: '?embed=1&cms=1',
    assertMode: async (page) => {
      const viewer = page.getByTestId('immersive-project3d-viewer');
      await expect(viewer).toHaveAttribute('data-immersive-embed-mode', 'cms');
      await expect(viewer.getByRole('heading')).toHaveCount(0);
      const padding = await viewer.evaluate((el) => getComputedStyle(el).padding);
      expect(padding).toBe('0px');
    },
  },
];

test.describe('immersive 3D route query-param parity (#333/#334/#335)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('regular, custom, and CMS immersive routes each keep the correct chrome', async ({
    page,
  }) => {
    for (const [index, testCase] of CASES.entries()) {
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

      await page.goto(`/immersive/p3d/${projectId}${testCase.query}`);
      await testCase.assertMode(page);

      const frame = page.getByTestId('scene3d-preview-canvas-frame');
      await expect(frame).toBeVisible();
      const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
      await expect(toolbar).toBeVisible();
      await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
      for (const label of TOOLBAR_BUTTONS) {
        await expect(
          toolbar.getByRole('button', { name: label, exact: label === 'Piece controls' }),
        ).toBeVisible();
      }
      await toolbar.getByRole('button', { name: 'Open download menu' }).click();
      await expect(toolbar.getByRole('menuitem', { name: 'Download Full ZIP' })).toBeVisible();
      await expect(
        toolbar.getByRole('menuitem', { name: 'Download Non-Camera ZIP' }),
      ).toBeVisible();
    }
  });
});
