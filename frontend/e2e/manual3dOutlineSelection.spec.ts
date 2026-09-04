/** Issue #396: the 3D manual editor's outline selection must match the 2D
 * editor's usable contract -- a visible selected state on every row kind,
 * and an explicit, repeatable way to clear it. */
import { expect, test } from '@playwright/test';

import { apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

// Fixed boundary from the issue body: camera (always present), one group,
// one sphere in that group, one top-level plane, and lights.
const FIXTURE_SCENE = {
  schemaVersion: 1,
  documentType: 'scene3d',
  id: 'scene3d-outline-selection-e2e',
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
  groups: [
    {
      id: 'grp1',
      name: 'Furniture',
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        opacity: 1,
      },
      visible: true,
      locked: false,
    },
  ],
  objects: [
    {
      id: 'ball',
      type: 'sphere',
      groupId: 'grp1',
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
  randomness: { seed: 7, enabled: true },
};

test.describe('manual 3D outline selection', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('every row kind has a clearable, non-mutating selected state at both required viewports', async ({
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

    const outline = page.getByTestId('outline3d-list');
    await expect(outline).toContainText('Camera');
    await expect(outline).toContainText('Group: Furniture');
    await expect(outline).toContainText('Sphere 1');
    await expect(outline).toContainText('Plane 1');

    const saveButton = page.getByTestId('project3d-save-button');

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);

      for (const { row, testid } of [
        { row: 'Camera', testid: 'camera-summary' },
        { row: 'Group: Furniture', testid: 'group-inspector' },
        { row: 'Sphere 1', testid: 'object-inspector' },
        { row: 'Plane 1', testid: 'object-inspector' },
      ]) {
        const button = outline.getByRole('button', { name: row, exact: true });
        const listItem = button.locator('xpath=ancestor::li[1]');

        // Selecting marks the row and updates the Inspector.
        await button.click();
        await expect(button).toHaveAttribute('aria-pressed', 'true');
        await expect(button).toHaveAttribute('aria-current', 'true');
        await expect(listItem).toHaveAttribute('data-selected', 'true');
        await expect(page.getByTestId(testid)).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Clear selection', exact: true }),
        ).toBeVisible();
        await expect(saveButton).toBeDisabled();

        // A second activation of the same row toggles it back off without
        // mutating the scene (the Save button stays disabled/no dirty state).
        await button.click();
        await expect(button).toHaveAttribute('aria-pressed', 'false');
        await expect(button).not.toHaveAttribute('aria-current');
        await expect(listItem).not.toHaveAttribute('data-selected');
        await expect(page.getByTestId(testid)).not.toBeVisible();
        await expect(
          page.getByText('Select an item from the outline to edit its properties.'),
        ).toBeVisible();
        await expect(saveButton).toBeDisabled();
      }
    }

    // The explicit Clear selection action works from any row kind too.
    await page.setViewportSize({ width: 1280, height: 900 });
    await outline.getByRole('button', { name: 'Sphere 1', exact: true }).click();
    await expect(page.getByTestId('object-inspector')).toBeVisible();
    await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
    await expect(page.getByTestId('object-inspector')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear selection' })).toHaveCount(0);

    // Deleting the selected object never leaves stale Inspector data behind.
    await outline.getByRole('button', { name: 'Sphere 1', exact: true }).click();
    await expect(page.getByTestId('object-inspector')).toBeVisible();
    const toolbar = page
      .getByTestId('scene3d-preview-canvas-frame')
      .getByRole('toolbar', { name: 'Preview actions' });
    await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    await toolbar.getByRole('button', { name: '3D authoring' }).click();
    await toolbar.getByRole('button', { name: 'Delete selected object' }).click();
    await expect(page.getByTestId('object-inspector')).not.toBeVisible();
    await expect(
      page.getByText('Select an item from the outline to edit its properties.'),
    ).toBeVisible();
    await expect(outline).not.toContainText('Sphere 1');
    await toolbar.getByRole('button', { name: /close 3d authoring/i }).click();
    await page.keyboard.press('Escape');

    // Re-select a row so the retained evidence below shows the selected
    // state, not just the empty one.
    await outline.getByRole('button', { name: 'Plane 1', exact: true }).click();
    await expect(page.getByTestId('object-inspector')).toBeVisible();

    // The outline/inspector panel stays contained at both fixed viewports.
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      const panel = page.locator('.outline3d-panel');
      await expect(panel).toBeVisible();
      const geometry = await panel.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return {
          right: box.right,
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
        };
      });
      expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
      await page.screenshot({
        path: test.info().outputPath(`outline-selection-${viewport.width}.png`),
        fullPage: true,
      });
    }
  });
});
