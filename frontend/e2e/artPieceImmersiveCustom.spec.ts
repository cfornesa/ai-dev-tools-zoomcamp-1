import { expect, test } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #446: `ImmersiveArtPieceViewer.tsx` had no chrome-less embed
 * entry point at all -- no `embed/art-pieces/immersive/:id` sibling
 * route existed, and the full-chrome page had no "copy embed code"
 * affordance, unlike the regular viewer's own `embed/art-pieces/:id`
 * (#435). This suite verifies the same convention `PublicArtPieceViewer.tsx`
 * already establishes: one component serving both the full-chrome page
 * and its chrome-less embed sibling route, distinguished only by an
 * `isEmbedRoute` check, reusing the exact same #430/#431/#432/#433/#434
 * stage/toolbar contract in both places.
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

test.describe('Generated immersive Custom embed: share the immersive runtime without page chrome (#446)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('the full-chrome immersive page copies a correctly escaped iframe embed snippet for the immersive route specifically', async ({
    page,
    context,
    browserName,
  }) => {
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Immersive embed snippet fixture',
      description: 'A published piece used to verify the immersive embed snippet.',
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
      page.getByRole('heading', { name: 'Immersive embed snippet fixture' }),
    ).toBeVisible();
    await page.getByTestId('toggle-immersive-embed-snippet').click();
    const textarea = page.locator('#immersive-art-piece-embed-snippet-textarea');
    const expectedSrc = new RegExp(
      `<iframe src="${new URL(page.url()).origin}/embed/art-pieces/immersive/${piece.public_id}" width="800" height="600" frameborder="0" allowfullscreen></iframe>`,
    );
    await expect(textarea).toHaveValue(expectedSrc);
    // This is the *immersive* embed URL, distinct from the regular
    // viewer's own `embed/art-pieces/:id` (no `/immersive/` segment).
    await expect(textarea).not.toHaveValue(new RegExp(`embed/art-pieces/${piece.public_id}"`));

    await page.getByRole('button', { name: 'Copy' }).click();
    await expect(page.getByText('Copied!')).toBeVisible();
    if (browserName === 'chromium') {
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toMatch(expectedSrc);
    }
  });

  test('the immersive embed route renders chrome-less with the full navigation/stage-toolbar contract, at both viewports', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Immersive embed viewer fixture',
      description: 'A published piece used to verify the chrome-less immersive embed route.',
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
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, { status: 'published' });

    const anonContext = await context.browser()!.newContext();
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      const anonPage = await anonContext.newPage();
      await anonPage.setViewportSize(viewport);
      await anonPage.goto(`/embed/art-pieces/immersive/${piece.public_id}`);
      // The CDN <script> blocks document parsing and delays listener
      // registration relative to earlier interactions -- wait for the
      // Three.js canvas to actually exist before interacting, same as
      // artPieceImmersiveRuntime.spec.ts's own established pattern.
      await anonPage
        .frameLocator('iframe[title="Immersive art piece preview"]')
        .locator('#art-piece-container canvas')
        .waitFor({ state: 'attached' });

      // No site header, title, instructions, embed button, or back link
      // -- just the stage and its one shared toolbar.
      await expect(
        anonPage.getByRole('heading', { name: 'Immersive embed viewer fixture' }),
      ).toHaveCount(0);
      await expect(anonPage.getByTestId('toggle-immersive-embed-snippet')).toHaveCount(0);
      await expect(anonPage.getByRole('link', { name: 'Back to regular viewer' })).toHaveCount(0);
      await expect(anonPage.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0);

      // The stage toolbar (#430/#431/#432/#433's shared contract) is
      // still fully present and functional -- "no page chrome" doesn't
      // mean "no piece toolbar".
      await expect(anonPage.getByRole('toolbar', { name: 'Piece actions' })).toBeVisible();
      const screenshotDownload = anonPage.waitForEvent('download');
      await anonPage.getByRole('button', { name: 'Take screenshot' }).click();
      const screenshot = await screenshotDownload;
      expect(screenshot.suggestedFilename()).toMatch(/\.png$/);
      await expect(
        anonPage.getByRole('button', { name: /expand fullscreen|exit fullscreen/i }),
      ).toBeVisible();

      // No horizontal overflow at either viewport -- the stage (and its
      // iframe) stays contained.
      const widths = await anonPage.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth);

      await anonPage.close();
    }
    await anonContext.close();
  });

  test('draft and archived pieces remain unavailable on the immersive embed route', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);

    const draft = await apiPost(context, '/api/art-pieces/', {
      title: 'Draft immersive embed fixture',
      description: 'Never published.',
      prompt: 'teal cube',
      engine: 'threejs',
      capabilities: {},
      source: THREEJS_STEERABLE_CUBE,
    });
    expect(draft.status()).toBe(201);
    const draftPiece = (await draft.json()) as { public_id: string };

    const archived = await apiPost(context, '/api/art-pieces/', {
      title: 'Archived immersive embed fixture',
      description: 'Published then archived.',
      prompt: 'teal cube',
      engine: 'threejs',
      capabilities: {},
      source: THREEJS_STEERABLE_CUBE,
    });
    expect(archived.status()).toBe(201);
    const archivedPiece = (await archived.json()) as { public_id: string };
    await apiPatch(context, `/api/art-pieces/${archivedPiece.public_id}/`, {
      status: 'published',
    });
    await apiPatch(context, `/api/art-pieces/${archivedPiece.public_id}/`, {
      status: 'archived',
    });

    const anonContext = await context.browser()!.newContext();
    const anonPage = await anonContext.newPage();
    for (const publicId of [draftPiece.public_id, archivedPiece.public_id]) {
      await anonPage.goto(`/embed/art-pieces/immersive/${publicId}`);
      await expect(anonPage.getByRole('alert')).toContainText("isn't available");
    }
    await anonContext.close();
  });

  test('keyboard focus and travel work inside the embed stage, with steering/camera controls acknowledged the same as the full-chrome page', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Immersive embed keyboard fixture',
      description: 'Verifies keyboard focus and acknowledged runtime state in the embed.',
      prompt: 'teal cube',
      engine: 'threejs',
      capabilities: { camera_view: true, hand_steering: true },
      source: THREEJS_STEERABLE_CUBE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, { status: 'published' });

    const anonContext = await context.browser()!.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`/embed/art-pieces/immersive/${piece.public_id}`);
    await anonPage
      .frameLocator('iframe[title="Immersive art piece preview"]')
      .locator('#art-piece-container canvas')
      .waitFor({ state: 'attached' });

    const stage = anonPage.getByLabel('Immersive stage');
    await stage.click();
    await expect(stage).toBeFocused();
    await anonPage.keyboard.press('ArrowUp');
    await expect(anonPage.getByTestId('navigation-pose')).toBeVisible();

    // The same acknowledged-state steering contract as #432/#434's
    // full-chrome page -- steering is gated on camera being active
    // first.
    await anonPage.getByRole('button', { name: 'Piece controls' }).click();
    await anonPage.getByRole('button', { name: 'Steer the piece' }).click();
    await expect(anonPage.getByTestId('steering-status')).toContainText(/camera/i);

    await anonContext.close();
  });
});
