import { expect, test } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #447: the "CMS" embed variant reuses the exact same
 * `embed/art-pieces/immersive/:id` route and runtime #446 built --
 * there is no separate CMS-specific server route or component ("one
 * shared immersive runtime" is this issue's own requirement). What's
 * new is a second copy-snippet option that wraps the same iframe in a
 * responsive, aspect-ratio-locked container instead of a fixed pixel
 * box, matching how a CMS block/oEmbed typically needs to embed
 * third-party content, plus verification that resizing that wrapper
 * (a CMS theme's column width changing) never reloads the iframe or
 * loses the piece's running state.
 */

const THREEJS_STEERABLE_CUBE = `
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 0, 5);
camera.lookAt(0, 0, 0);
var renderer = new THREE.WebGLRenderer();
var container = document.getElementById('art-piece-container');
renderer.setSize(container.clientWidth || 320, container.clientHeight || 240);
container.appendChild(renderer.domElement);
var geometry = new THREE.BoxGeometry(1, 1, 1);
var material = new THREE.MeshBasicMaterial({ color: 0x2a9d8f });
var cube = new THREE.Mesh(geometry, material);
scene.add(cube);
window.__registerArtPieceCamera({
  getPose: function () {
    return { x: camera.position.x, y: camera.position.y, z: camera.position.z };
  },
  setPose: function (x, y, z) {
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
  },
  reset: function () {
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
  },
});
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
`;

test.describe('Generated immersive CMS embed: explicit CMS wrapper variant (#447)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('the CMS embed copier emits a responsive wrapper around the same immersive embed URL, distinct from the Custom snippet', async ({
    page,
    context,
    browserName,
  }) => {
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Immersive CMS embed snippet fixture',
      description: 'A published piece used to verify the CMS embed snippet.',
      prompt: 'teal cube',
      engine: 'threejs',
      capabilities: { screenshot: true, camera_view: true, hand_steering: true, sound: true },
      source: THREEJS_STEERABLE_CUBE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, { status: 'published' });

    await page.goto(`/art-pieces/immersive/${piece.public_id}`);
    await expect(
      page.getByRole('heading', { name: 'Immersive CMS embed snippet fixture' }),
    ).toBeVisible();

    // The Custom snippet: a fixed-size iframe only.
    await page.getByTestId('toggle-immersive-embed-snippet').click();
    const customValue = await page
      .locator('#immersive-art-piece-embed-snippet-textarea')
      .inputValue();
    expect(customValue).toMatch(/^<iframe /);
    expect(customValue).toContain(`/embed/art-pieces/immersive/${piece.public_id}`);
    await page.getByTestId('toggle-immersive-embed-snippet').click();

    // The CMS snippet: a responsive aspect-ratio wrapper around the
    // *same* embed URL -- one shared runtime, a different host-facing
    // shape.
    await page.getByTestId('toggle-immersive-cms-embed-snippet').click();
    const cmsValue = await page.locator('#immersive-art-piece-embed-snippet-textarea').inputValue();
    expect(cmsValue).toMatch(/^<div /);
    expect(cmsValue).toContain('padding-bottom');
    expect(cmsValue).toContain(`/embed/art-pieces/immersive/${piece.public_id}`);
    expect(cmsValue).not.toBe(customValue);
    // Only one snippet panel is ever shown at a time -- no duplicated
    // wrapper controls.
    await expect(page.getByTestId('immersive-embed-snippet-panel')).toHaveCount(0);
    await expect(page.getByTestId('immersive-cms-embed-snippet-panel')).toBeVisible();

    await page.getByRole('button', { name: 'Copy' }).click();
    await expect(page.getByText('Copied!')).toBeVisible();
    if (browserName === 'chromium') {
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toBe(cmsValue);
    }
  });

  test('the embed survives a host-wrapper resize with no reload: pose, active sound and navigation all persist, at both viewports', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Immersive CMS resize fixture',
      description: 'A published piece used to verify state survives a CMS wrapper resize.',
      prompt: 'teal cube',
      engine: 'threejs',
      capabilities: { sound: true },
      source: THREEJS_STEERABLE_CUBE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, { status: 'published' });

    const anonContext = await context.browser()!.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.setViewportSize({ width: 1280, height: 900 });
    await anonPage.goto(`/embed/art-pieces/immersive/${piece.public_id}`);
    await anonPage
      .frameLocator('iframe[title="Immersive art piece preview"]')
      .locator('#art-piece-container canvas')
      .waitFor({ state: 'attached' });

    // Establish real running state: travel away from the default pose,
    // then turn sound on.
    const stage = anonPage.getByLabel('Immersive stage');
    await stage.click();
    await anonPage.keyboard.press('ArrowUp');
    await expect(anonPage.getByTestId('navigation-pose')).toBeVisible();
    const poseBeforeResize = await anonPage.getByTestId('navigation-pose').textContent();

    await anonPage.getByRole('button', { name: 'Piece controls' }).click();
    await anonPage.getByRole('button', { name: 'Unmute sound' }).click();
    await expect(anonPage.getByRole('button', { name: 'Mute sound' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Simulate a CMS theme's responsive column resize (never a
    // navigation/reload -- the iframe and its content stay the exact
    // same document throughout).
    await anonPage.setViewportSize({ width: 375, height: 812 });
    await expect(anonPage.getByTestId('navigation-pose')).toHaveText(poseBeforeResize ?? '');
    await expect(anonPage.getByRole('button', { name: 'Mute sound' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // ...and back, still consistent.
    await anonPage.setViewportSize({ width: 1280, height: 900 });
    await expect(anonPage.getByTestId('navigation-pose')).toHaveText(poseBeforeResize ?? '');
    await expect(anonPage.getByRole('button', { name: 'Mute sound' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await anonContext.close();
  });

  test('published/private/unpublished/deleted behavior and the named stage-control states match #434, via the same shared embed route', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);

    const draft = await apiPost(context, '/api/art-pieces/', {
      title: 'Draft immersive CMS fixture',
      description: 'Never published.',
      prompt: 'teal cube',
      engine: 'threejs',
      capabilities: {},
      source: THREEJS_STEERABLE_CUBE,
    });
    expect(draft.status()).toBe(201);
    const draftPiece = (await draft.json()) as { public_id: string };

    const anonContext = await context.browser()!.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`/embed/art-pieces/immersive/${draftPiece.public_id}`);
    await expect(anonPage.getByRole('alert')).toContainText("isn't available");

    const published = await apiPost(context, '/api/art-pieces/', {
      title: 'Published immersive CMS fixture',
      description: 'Verifies the named stage-control contract through the embed route.',
      prompt: 'teal cube',
      engine: 'threejs',
      capabilities: {
        screenshot: true,
        sound: true,
        camera_view: true,
        hand_steering: true,
        fullscreen: true,
      },
      source: THREEJS_STEERABLE_CUBE,
    });
    expect(published.status()).toBe(201);
    const publishedPiece = (await published.json()) as { public_id: string };
    await apiPatch(context, `/api/art-pieces/${publishedPiece.public_id}/`, {
      status: 'published',
    });

    await anonPage.goto(`/embed/art-pieces/immersive/${publishedPiece.public_id}`);
    await anonPage
      .frameLocator('iframe[title="Immersive art piece preview"]')
      .locator('#art-piece-container canvas')
      .waitFor({ state: 'attached' });
    await anonPage.getByRole('button', { name: 'Piece controls' }).click();
    // Named states, same #434 contract: Screenshot, Sound, Camera view,
    // Steer, Guide, Reset, Fullscreen.
    await expect(anonPage.getByTestId('sound-status')).toContainText('Sound is off.');
    await expect(anonPage.getByRole('button', { name: 'Enable camera view' })).toBeVisible();
    await expect(anonPage.getByRole('button', { name: 'Steer the piece' })).toBeVisible();
    await expect(anonPage.getByRole('button', { name: 'Show hand gesture guide' })).toBeVisible();
    await expect(anonPage.getByRole('button', { name: 'Reset view' })).toBeVisible();
    await expect(
      anonPage.getByRole('button', { name: /expand fullscreen|exit fullscreen/i }),
    ).toBeVisible();
    const screenshotDownload = anonPage.waitForEvent('download');
    await anonPage.getByRole('button', { name: 'Take screenshot' }).click();
    const screenshot = await screenshotDownload;
    expect(screenshot.suggestedFilename()).toMatch(/\.png$/);

    await apiPatch(context, `/api/art-pieces/${publishedPiece.public_id}/`, {
      status: 'archived',
    });
    await anonPage.goto(`/embed/art-pieces/immersive/${publishedPiece.public_id}`);
    await expect(anonPage.getByRole('alert')).toContainText("isn't available");

    await anonContext.close();
  });
});
