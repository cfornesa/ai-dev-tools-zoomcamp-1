import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #432: `enable-hand-steering`/`reset-view` used to only reach an
 * unconsumed `art-piece-command` DOM event -- no runtime ever controlled
 * the generated engine's camera. Real camera-based hand-landmark
 * detection (MediaPipe running inside this CSP-locked sandbox) is a
 * separately approved follow-up -- filed as #455 -- since it needs a
 * backend system-prompt change (so generated Three.js/A-Frame snippets
 * register a camera) plus a CDN-loaded vision model inside the sandbox.
 * This suite verifies the real, testable half #432 actually ships: a
 * documented `window.__registerArtPieceCamera({ getPose, setPose, reset
 * })` opt-in hook, activation gating (engine/camera/registration),
 * bounded pose changes driven by a `steer-signal` command (standing in
 * for a future real gesture source, sent from the parent page exactly
 * like a real signal source eventually would -- never self-posted from
 * inside the untrusted sandbox, which the sandbox's own `event.source
 * !== window.parent` hardening now rejects), and Reset -- exercised
 * end-to-end against a real fixture piece that adopts the hook.
 */

/** A deterministic Three.js fixture whose camera sits at [0, 0, 5] and
 * registers itself via the new hook -- the exact fixture shape #432's
 * own issue text specifies ("Three.js cube with camera pose fixed at
 * [0,0,5]"). */
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

/** Mocks a granted camera (steering's own prerequisite, per its
 * activation gate) exactly like `artPieceCameraRuntime.spec.ts`'s own
 * `mockCamera` -- scoped to the sandboxed iframe only, same rationale. */
async function mockGrantedCamera(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    if (window.self === window.top) return;
    Object.defineProperty(window.navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: () => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const context2d = canvas.getContext('2d')!;
        context2d.fillStyle = '#2563eb';
        context2d.fillRect(0, 0, 32, 32);
        const stream = (
          canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }
        ).captureStream(5);
        return Promise.resolve(stream);
      },
    });
  });
}

/** Sends `steer-signal` from the parent page's own context, targeting
 * the sandboxed iframe's `contentWindow` -- exactly the path a real
 * future gesture source (#455) would use via `PieceStageControls.tsx`'s
 * own `command()` helper. Deliberately not sent by evaluating script
 * inside the iframe itself: the sandbox's `event.source !== window.parent`
 * check exists specifically to reject a message that originated from
 * inside the untrusted sandbox impersonating the parent. */
/** Waits for the Three.js snippet to have actually run (its renderer's
 * canvas exists in the sandbox DOM) before sending any command. The CDN
 * `<script>` loads and executes before the listener script that
 * registers the sandbox's own `message` listener (document order is
 * execution order for classic scripts) -- on a slower engine/host, a
 * command sent immediately after `page.goto()` can arrive before that
 * listener exists yet and be silently dropped (postMessage never
 * queues for a listener that isn't registered yet). The canvas only
 * appears once the snippet itself has run, which happens strictly after
 * the listener script in document order, so waiting for it also
 * guarantees the listener is ready. */
async function waitForThreeJsReady(page: Page): Promise<void> {
  await page
    .frameLocator('iframe[title="Art piece preview"]')
    .locator('#art-piece-container canvas')
    .waitFor({ state: 'attached' });
}

async function steer(page: Page, delta: { dx?: number; dy?: number; dz?: number }): Promise<void> {
  await page.evaluate((deltaArg) => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="Art piece preview"]');
    iframe?.contentWindow?.postMessage(
      { source: 'art-piece-parent', version: 1, type: 'steer-signal', ...deltaArg },
      '*',
    );
  }, delta);
}

test.describe('Generated regular viewer: hand-steering ownership and Reset (#432)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('steering is gated on camera and a registered engine camera, then applies bounded pose changes and resets cleanly', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Steering runtime fixture',
      description: 'A published Three.js piece that registers a steerable camera.',
      prompt: 'red cube',
      engine: 'threejs',
      capabilities: {
        screenshot: false,
        download: false,
        fullscreen: false,
        camera_view: true,
        hand_steering: true,
      },
      source: THREEJS_STEERABLE_CUBE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    // Steering requires Camera view first -- attempting it beforehand is
    // rejected with a distinct, actionable reason, never a fake success.
    await page.goto(`/art-pieces/p/${piece.public_id}`);
    await expect(page.getByRole('heading', { name: 'Steering runtime fixture' })).toBeVisible();
    await waitForThreeJsReady(page);
    await page.getByRole('button', { name: 'Piece controls' }).click();
    await expect(page.getByTestId('steering-status')).toContainText('Steering is off.');
    await page.getByRole('button', { name: 'Steer the piece' }).click();
    await expect(page.getByTestId('steering-status')).toContainText(
      'Turn on Camera view before steering.',
    );

    // Enable the camera prerequisite, then steering activates for real.
    await mockGrantedCamera(context);
    await page.goto(`/art-pieces/p/${piece.public_id}`);
    await waitForThreeJsReady(page);
    await page.getByRole('button', { name: 'Piece controls' }).click();
    await page.getByRole('button', { name: 'Enable camera view' }).click();
    await expect(page.getByTestId('camera-status')).toContainText('Camera is active.');
    const steerButton = page.getByRole('button', { name: 'Steer the piece' });
    await steerButton.click();
    const stopButton = page.getByRole('button', { name: 'Stop steering' });
    await expect(stopButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('steering-status')).toContainText('Steering is active.');

    // A self-post from inside the sandbox impersonating the parent must
    // be rejected -- the hardening this issue adds specifically for
    // untrusted generated content.
    const spoofRejected = await page
      .frameLocator('iframe[title="Art piece preview"]')
      .locator('body')
      .evaluate(() => {
        let sawSteeringUpdate = false;
        const listener = (event: MessageEvent) => {
          const data = event.data as { status?: string } | null;
          if (data?.status === 'steering') sawSteeringUpdate = true;
        };
        window.addEventListener('message', listener);
        window.postMessage(
          { source: 'art-piece-parent', version: 1, type: 'steer-signal', dx: 999 },
          '*',
        );
        return new Promise<boolean>((resolve) => {
          setTimeout(() => {
            window.removeEventListener('message', listener);
            resolve(!sawSteeringUpdate);
          }, 300);
        });
      });
    expect(spoofRejected).toBe(true);

    // A real, bounded pose change sent from the parent (the legitimate
    // path): the fixture's own registered getPose() reflects the actual
    // mutation, acknowledged back with the new pose. (0,0,5) + dx=2 is
    // (2,0,5), radius sqrt(29)~=5.385 -- within [1.5, 20], so unclamped.
    await steer(page, { dx: 2 });
    await expect(page.getByTestId('steering-pose')).toContainText('2.00,0.00,5.00');

    // Reset returns the camera to its registered starting pose without
    // touching sound/camera/steering state.
    await page.getByRole('button', { name: 'Reset view' }).click();
    await expect(page.getByTestId('steering-pose')).toContainText('0.00,0.00,5.00');
    await expect(page.getByTestId('camera-status')).toContainText('Camera is active.');
    await expect(stopButton).toHaveAttribute('aria-pressed', 'true');

    await stopButton.click();
    await expect(page.getByTestId('steering-status')).toContainText('Steering is off.');
  });

  // Issue #449 reverses this suite's own prior "unsupported-engine for
  // flat renderers" assertion -- a flat Canvas2D/SVG piece now gets a
  // lazily-built CSS 3D presentation of its own existing artwork and a
  // synthetic registered camera, so steering produces real bounded pose
  // changes for every engine. See frontend/e2e/artPieceFlatSpatial.spec.ts
  // for that dedicated coverage (lazy shell creation, bounded Look/Move/
  // Orbit/Zoom, Reset/dispose semantics, and pointer-interaction
  // suspension/restoration).

  test('hand steering controls are absent when the capability is disabled', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Steering-disabled runtime fixture',
      description: 'A published Three.js piece with hand steering disabled.',
      prompt: 'red cube',
      engine: 'threejs',
      capabilities: {
        screenshot: false,
        download: false,
        fullscreen: false,
        camera_view: false,
        hand_steering: false,
      },
      source: THREEJS_STEERABLE_CUBE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    await page.goto(`/art-pieces/p/${piece.public_id}`);
    await expect(
      page.getByRole('heading', { name: 'Steering-disabled runtime fixture' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /steer/i })).toHaveCount(0);
    await expect(page.getByTestId('steering-status')).toHaveCount(0);
  });
});
