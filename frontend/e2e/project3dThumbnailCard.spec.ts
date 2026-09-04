/** Issue #393: every owner-facing 3D project card must show a thumbnail
 * derived from its current saved scene when the scene renders, and a safe,
 * recoverable fallback (never a silently-successful gray preview) when it
 * doesn't. */
import { expect, test } from '@playwright/test';

import { apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

// A schema-valid sphere+plane scene -- the fixed boundary this issue's own
// GitHub body specifies -- trimmed from `schema/fixtures3d/valid/feature_rich.json`.
const SPHERE_AND_PLANE_SCENE = {
  schemaVersion: 1,
  documentType: 'scene3d',
  id: 'scene3d-thumbnail-card-e2e',
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
      material: { color: '#ff3355', opacity: 0.9, emissive: '#440011' },
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
  randomness: { seed: 42, enabled: true },
};

// Schema-valid but geometrically degenerate (camera at its own target) --
// the same input `tests/test_thumbnails3d.py`'s
// `test_camera_at_its_own_target_raises_render_error_not_a_crash` uses to
// exercise `Thumbnail3DRenderError` server-side without a malformed
// document a save request would reject outright.
const DEGENERATE_CAMERA_SCENE = {
  ...SPHERE_AND_PLANE_SCENE,
  id: 'scene3d-thumbnail-card-e2e-degenerate',
  camera: {
    position: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    fov: 60,
    near: 0.1,
    far: 2000,
  },
};

async function create3DProjectWithScene(
  page: import('@playwright/test').Page,
  scene: unknown,
): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'More creation options' }).click();
  await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
  await page.waitForURL(/\/projects3d\/[^/]+$/);
  const projectId = /\/projects3d\/([^/]+)$/.exec(page.url())?.[1];
  expect(projectId).toBeTruthy();
  if (!projectId) throw new Error('Could not determine the created 3D project id.');

  const saved = await apiPost(page.context(), `/api/projects3d/${projectId}/versions/`, {
    scene_json: scene,
  });
  expect(saved.ok()).toBe(true);
  return projectId;
}

test.describe('owner 3D project card thumbnails', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('shows real geometry for a renderable scene and a safe retryable fallback for a failing one', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);

    const renderableId = await create3DProjectWithScene(page, SPHERE_AND_PLANE_SCENE);
    const failingId = await create3DProjectWithScene(page, DEGENERATE_CAMERA_SCENE);

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/');

      const renderableCard = page.locator('article', {
        has: page.locator(`#project3d-${renderableId}-title`),
      });
      const renderableImage = renderableCard.getByRole('img', { name: /preview of/i });
      await expect(renderableImage).toBeVisible();
      await expect(renderableImage).toHaveAttribute('src', /\/thumbnail\//);
      // Stable 320x240 card dimensions (`CARD_WIDTH`/`CARD_HEIGHT` in
      // `scenes/thumbnails.py`) -- checked via the naturalWidth/Height the
      // browser decoded from the served PNG, not just the CSS box.
      await expect
        .poll(() => renderableImage.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBe(320);
      await expect
        .poll(() => renderableImage.evaluate((img: HTMLImageElement) => img.naturalHeight))
        .toBe(240);

      const failingCard = page.locator('article', {
        has: page.locator(`#project3d-${failingId}-title`),
      });
      await expect(failingCard.getByText('No preview available')).toBeVisible();
      const retryButton = failingCard.getByRole('button', { name: 'Retry thumbnail' });
      await expect(retryButton).toBeVisible();
      await retryButton.click();
      // The underlying scene is permanently degenerate, so retrying keeps
      // producing a fallback (not a crash, not a silently-adopted "gray
      // preview treated as success") -- the button returns to its idle,
      // re-clickable label rather than being stuck on "Retrying...", and
      // the fallback state/copy is still explicitly shown, never the plain
      // `<img>` branch.
      await expect(retryButton).toHaveText('Retry thumbnail');
      await expect(failingCard.getByText('No preview available')).toBeVisible();
      await expect(failingCard.getByRole('img', { name: /preview of/i })).toHaveCount(0);
    }
  });

  test('regenerates the card thumbnail after the current version changes', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectId = await create3DProjectWithScene(page, SPHERE_AND_PLANE_SCENE);

    const firstDetail = await page.context().request.get(`/api/projects3d/${projectId}/`);
    expect(firstDetail.ok()).toBe(true);
    const firstBody = (await firstDetail.json()) as {
      thumbnail_is_fallback: boolean;
      current_version: { id: string };
    };
    expect(firstBody.thumbnail_is_fallback).toBe(false);

    // Save a second, different-but-still-renderable version -- only the
    // sphere, moved and recolored -- as the "changed current version"
    // this issue's closure checklist requires a fresh, non-stale thumbnail
    // for.
    const secondScene = {
      ...SPHERE_AND_PLANE_SCENE,
      id: 'scene3d-thumbnail-card-e2e-v2',
      objects: [
        {
          ...SPHERE_AND_PLANE_SCENE.objects[0],
          id: 'ball-v2',
          transform: {
            ...SPHERE_AND_PLANE_SCENE.objects[0].transform,
            position: { x: 1, y: 1, z: 0 },
          },
          material: { color: '#33aaff', opacity: 1 },
        },
      ],
    };
    const saved = await apiPost(page.context(), `/api/projects3d/${projectId}/versions/`, {
      scene_json: secondScene,
    });
    expect(saved.ok()).toBe(true);

    const secondDetail = await page.context().request.get(`/api/projects3d/${projectId}/`);
    expect(secondDetail.ok()).toBe(true);
    const secondBody = (await secondDetail.json()) as {
      thumbnail_is_fallback: boolean;
      current_version: { id: string };
    };
    expect(secondBody.thumbnail_is_fallback).toBe(false);
    expect(secondBody.current_version.id).not.toBe(firstBody.current_version.id);

    await page.goto('/');
    const card = page.locator('article', { has: page.locator(`#project3d-${projectId}-title`) });
    await expect(card.getByRole('img', { name: /preview of/i })).toBeVisible();
  });
});
