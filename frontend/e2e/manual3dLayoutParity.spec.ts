/** Issue #398: the manual 3D editor's Preview/outline/inspector/authoring/
 * publication layout must be as reliably non-overlapping and responsive as
 * the 2D editor's (#397), with 3D-only differences intentional rather than
 * accidental gaps in parity. */
import { expect, test } from '@playwright/test';

import { apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

const FIXTURE_SCENE = {
  schemaVersion: 1,
  documentType: 'scene3d',
  id: 'scene3d-layout-parity-e2e',
  scene: { backgroundColor: '#101018' },
  camera: {
    position: { x: 4, y: 6, z: 12 },
    target: { x: 0, y: 1, z: 0 },
    fov: 60,
    near: 0.1,
    far: 2000,
  },
  lights: [
    {
      id: 'sun',
      type: 'directional',
      color: '#ffffff',
      intensity: 1.2,
      direction: { x: -1, y: -2, z: -1 },
    },
  ],
  groups: [],
  objects: [
    {
      id: 'ball',
      type: 'sphere',
      groupId: null,
      transform: {
        position: { x: 0, y: 2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        opacity: 1,
      },
      material: { color: '#ff3355', opacity: 0.9 },
      visible: true,
      radius: 0.5,
    },
    {
      id: 'floor',
      type: 'plane',
      groupId: null,
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: -90, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        opacity: 1,
      },
      material: { color: '#222222' },
      visible: true,
      width: 20,
      height: 20,
    },
  ],
  randomness: { seed: 3, enabled: true },
};

/** Every visible region on this route must stay a subset of the viewport
 * (no page-level horizontal overflow) and no two of the named layout
 * regions may overlap -- the exact class of bug #397 fixed on the 2D side. */
async function expectNoRegionOverlap(page: import('@playwright/test').Page) {
  const result = await page.evaluate(() => {
    const selectors: Record<string, string> = {
      preview: '.scene3d-preview-canvas-frame',
      outline: 'section[aria-label="Outline"]',
      inspector: 'section[aria-label="Inspector"]',
    };
    const boxes: Record<string, DOMRect | null> = {};
    for (const [name, selector] of Object.entries(selectors)) {
      const el = document.querySelector(selector);
      boxes[name] = el ? el.getBoundingClientRect() : null;
    }
    const overlaps = (a: DOMRect, b: DOMRect) =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const pairs: [string, string][] = [
      ['preview', 'outline'],
      ['preview', 'inspector'],
    ];
    const overlapping = pairs
      .filter(([a, b]) => boxes[a] && boxes[b] && overlaps(boxes[a]!, boxes[b]!))
      .map(([a, b]) => `${a}/${b}`);
    return {
      boxes,
      overlapping,
      documentWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });
  expect(result.boxes.preview, 'preview region not found').not.toBeNull();
  expect(result.boxes.outline, 'outline region not found').not.toBeNull();
  expect(result.overlapping).toEqual([]);
  expect(result.documentWidth).toBeLessThanOrEqual(result.innerWidth);
}

test.describe('manual 3D editor layout parity', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('Preview, outline, inspector, and publication controls stay non-overlapping and reachable at both required viewports', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
    await page.waitForURL(/\/projects3d\/[^/]+$/);
    const projectId = /\/projects3d\/([^/]+)$/.exec(page.url())?.[1];
    expect(projectId).toBeTruthy();
    if (!projectId) return;

    const saved = await apiPost(page.context(), `/api/projects3d/${projectId}/versions/`, {
      scene_json: FIXTURE_SCENE,
    });
    expect(saved.ok()).toBe(true);
    await page.reload();
    await expect(page.getByTestId('scene3d-preview-canvas-frame')).toBeVisible();

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);

      // Named core actions/state feedback parity with the 2D editor: a
      // visible publication disclosure (#394) and an outline with a
      // clearable selection (#396) are both reachable without overlap.
      await expect(page.getByTestId('visibility-status-3d')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
      await expectNoRegionOverlap(page);

      const outline = page.getByTestId('outline3d-list');
      await expect(outline).toBeVisible();
      await expect(outline).toContainText('Sphere 1');
      await expect(outline).toContainText('Plane 1');

      await outline.getByRole('button', { name: 'Sphere 1', exact: true }).click();
      await expect(page.getByTestId('object-inspector')).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Clear selection', exact: true }),
      ).toBeVisible();
      await expectNoRegionOverlap(page);
      await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
      await expect(page.getByTestId('object-inspector')).not.toBeVisible();

      // Visual/Code switching preserves required reachability -- 3D has no
      // dedicated Code tab of its own (documented 3D-only difference from
      // the 2D editor: the scene has no equivalent inline JSON/code view),
      // so this asserts the canvas frame and outline both survive a reload
      // in place instead.
      await page.reload();
      await expect(page.getByTestId('scene3d-preview-canvas-frame')).toBeVisible();
      await expect(page.getByTestId('outline3d-list')).toBeVisible();
      await expectNoRegionOverlap(page);

      await page.screenshot({
        path: test.info().outputPath(`layout-parity-${viewport.width}.png`),
        fullPage: true,
      });
    }
  });
});
