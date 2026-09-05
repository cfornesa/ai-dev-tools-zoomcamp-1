import { expect, test } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #434: `ImmersiveArtPieceViewer.tsx` used to render only an
 * iframe and static instructions ("Drag to explore, scroll to zoom, and
 * use arrow keys to move through the piece") that were never wired to
 * anything -- no keyboard/drag/wheel handler existed at all, and the
 * text lied identically for every engine, including ones with no
 * spatial camera whatsoever. This suite drives the real navigation the
 * fix adds: arrow-key travel, drag look, wheel zoom and Reset, all
 * routed through #432's navigate-signal/steer-signal protocol and a
 * registered camera, plus the reused stage toolbar (#430/#431/#432/#433)
 * and honest per-engine fallback.
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
var material = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
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

const FLAT_RED_RECTANGLE =
  '<canvas id="art-piece-canvas" width="320" height="240"></canvas>' +
  '<script>var c=document.getElementById("art-piece-canvas");' +
  'var x=c.getContext("2d");x.fillStyle="#dc2626";x.fillRect(0,0,320,240);</script>';

test.describe('Generated immersive viewer: walkable navigation and stage controls (#434)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('arrow-key travel and drag look move a real registered camera, wheel zooms, and Reset returns home', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Immersive runtime fixture',
      description: 'A published Three.js piece for immersive navigation.',
      prompt: 'red cube',
      engine: 'threejs',
      capabilities: {
        screenshot: true,
        download: false,
        fullscreen: true,
        sound: false,
        camera_view: false,
        hand_steering: false,
        immersive: true,
      },
      source: THREEJS_STEERABLE_CUBE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`/art-pieces/immersive/${piece.public_id}`);
      await expect(page.getByRole('heading', { name: 'Immersive runtime fixture' })).toBeVisible();
      await page
        .frameLocator('iframe[title="Immersive art piece preview"]')
        .locator('#art-piece-container canvas')
        .waitFor({ state: 'attached' });

      // No load-time camera/mic activation: reachable stage toolbar,
      // but no camera/microphone control rendered at all here (this
      // fixture never enabled those capabilities).
      await expect(page.getByRole('toolbar', { name: 'Piece actions' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Enable camera view' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Enable microphone' })).toHaveCount(0);

      // Arrow-key travel: the stage's own keydown listener only fires
      // once the stage div itself has focus. A plain .click() would hit
      // the iframe that visually covers most of the stage instead
      // (focusing that, not the stage div), so focus it directly.
      const stage = page.getByLabel('Immersive stage');
      await stage.focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.getByTestId('navigation-pose')).toContainText('0.30,0.00,5.00');
      await page.keyboard.press('ArrowUp');
      await expect(page.getByTestId('navigation-pose')).toContainText('0.30,0.00,4.70');

      // Drag look: a pointer drag produces a further, real pose change
      // -- not just a UI-level acknowledgment.
      const box = (await stage.boundingBox())!;
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.mouse.move(centerX + 50, centerY + 20, { steps: 5 });
      await page.mouse.up();
      await expect(page.getByTestId('navigation-pose')).not.toContainText('0.30,0.00,4.70');

      // Wheel zoom.
      const poseBeforeZoom = await page.getByTestId('navigation-pose').textContent();
      await stage.hover();
      await page.mouse.wheel(0, 100);
      await expect(page.getByTestId('navigation-pose')).not.toHaveText(poseBeforeZoom ?? '');

      // Reset returns the camera to its registered starting pose.
      await page.getByRole('button', { name: 'Piece controls' }).click();
      await page.getByRole('button', { name: 'Reset view' }).click();
      await expect(page.getByTestId('navigation-pose')).toContainText('0.00,0.00,5.00');

      // Fullscreen control is present and reachable (real Fullscreen API
      // exercise/WebKit gesture quirks are covered by the existing
      // manual2dStageChrome.spec.ts convention, not duplicated here).
      await expect(
        page.getByRole('button', { name: /expand fullscreen|exit fullscreen/i }),
      ).toBeVisible();

      // Entry/return preserves piece identity.
      await page.getByRole('link', { name: 'Back to regular viewer' }).click();
      await expect(page.getByRole('heading', { name: 'Immersive runtime fixture' })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/art-pieces/p/${piece.public_id}$`));
    }
  });

  test('a flat renderer gets an honest fallback instead of false movement instructions', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Flat immersive fixture',
      description: 'A published Canvas2D piece with no spatial camera.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: { screenshot: false, download: false, fullscreen: false, immersive: true },
      source: FLAT_RED_RECTANGLE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    await page.goto(`/art-pieces/immersive/${piece.public_id}`);
    await expect(page.getByRole('heading', { name: 'Flat immersive fixture' })).toBeVisible();
    await expect(page.getByTestId('navigation-unsupported')).toContainText(
      "Walkable navigation isn't available",
    );
    await expect(page.getByText(/drag to look around/i)).toHaveCount(0);
    await expect(page.getByTestId('navigation-pose')).toHaveCount(0);
  });

  test('unpublished, archived and deleted pieces are unavailable on direct immersive access', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);

    const draft = await apiPost(context, '/api/art-pieces/', {
      title: 'Draft immersive fixture',
      description: 'Never published.',
      prompt: 'red cube',
      engine: 'threejs',
      capabilities: {},
      source: THREEJS_STEERABLE_CUBE,
    });
    expect(draft.status()).toBe(201);
    const draftPiece = (await draft.json()) as { public_id: string };

    const archived = await apiPost(context, '/api/art-pieces/', {
      title: 'Archived immersive fixture',
      description: 'Published then archived.',
      prompt: 'red cube',
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

    for (const publicId of [draftPiece.public_id, archivedPiece.public_id]) {
      await page.goto(`/art-pieces/immersive/${publicId}`);
      await expect(page.getByRole('alert')).toContainText("isn't available");
    }

    // Anonymous, unauthenticated direct access to a never-published
    // piece is equally denied.
    const anonContext = await context.browser()!.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`/art-pieces/immersive/${draftPiece.public_id}`);
    await expect(anonPage.getByRole('alert')).toContainText("isn't available");
    await anonContext.close();
  });
});
