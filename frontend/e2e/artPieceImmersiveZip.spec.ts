import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #448: the downloadable ZIP from `/art-pieces/immersive/:id` used
 * to package the exact same small, regular-preview export as the
 * non-immersive viewer -- `artPieceBundle.ts` had no immersive
 * presentation mode at all, so the walkable arrow-key/drag/wheel
 * navigation `ImmersiveArtPieceViewer.tsx` offers live never survived
 * into the extracted artifact. This suite downloads real Full and
 * Non-Camera ZIPs from the immersive route, extracts them, and executes
 * (not greps) them offline: real navigation deltas move the registered
 * camera, Screenshot/Sound/Camera/Steer/Guide/Fullscreen/Reset all work
 * under the Full contract, and the Non-Camera variant keeps navigation
 * and sound while enforcing the same #437 device-isolation guard.
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

async function mockEveryGetUserMediaGrant(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    Object.defineProperty(window.navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      writable: true,
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

function serveDirectory(root: string): Promise<{ url: string; close: () => Promise<void> }> {
  const MIME: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
  };
  const server = http.createServer((req, res) => {
    const requestPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const filePath = path.join(root, requestPath === '/' ? 'index.html' : requestPath);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath)] ?? 'application/octet-stream',
      });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}/index.html`,
        close: () => new Promise((closeResolve) => server.close(() => closeResolve())),
      });
    });
  });
}

async function extractZip(zip: JSZip): Promise<string> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'art-piece-immersive-zip-e2e-'));
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, await entry.async('nodebuffer'));
  }
  return root;
}

async function verifyExtractedImmersiveFull(page: Page): Promise<void> {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.waitForFunction(() => {
    const canvas = document.querySelector('#art-piece-container canvas');
    return canvas instanceof HTMLCanvasElement && canvas.width > 0;
  });

  // Real navigation: arrow-key travel moves the registered camera pose,
  // reported by the extracted runtime -- not an event/string check.
  const poseText = page.locator('#art-piece-navigation-pose');
  const before = await poseText.textContent();
  const stage = page.locator('#art-piece-container');
  await stage.click();
  await page.keyboard.press('ArrowUp');
  await expect(poseText).not.toHaveText(before ?? '');

  // Reset returns to the pose at registration time.
  await page.getByRole('button', { name: 'Reset view' }).click();
  await expect(poseText).toHaveText(before ?? '');

  // Screenshot: a real, decodable PNG.
  const screenshotDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Screenshot' }).click();
  const screenshot = await screenshotDownload;
  const screenshotBytes = fs.readFileSync((await screenshot.path())!);
  expect(screenshotBytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  // Sound: a real toggle.
  await page.getByRole('button', { name: 'Unmute sound' }).click();
  await expect(page.getByRole('button', { name: 'Mute sound' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Camera + Steer: the full lifecycle.
  await page.getByRole('button', { name: 'Enable camera view' }).click();
  await expect(page.getByRole('button', { name: 'Disable camera view' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Steer the piece' }).click();
  await expect(page.getByRole('button', { name: 'Stop steering' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Guide: opens and closes a real dialog.
  await page.getByRole('button', { name: 'Show hand gesture guide' }).click();
  await expect(page.getByRole('dialog', { name: 'Hand gesture guide' })).toContainText('Look');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog', { name: 'Hand gesture guide' })).toBeHidden();

  // Fullscreen: present and toggle-labeled correctly (headless browsers
  // generally deny the actual Fullscreen API grant, so this checks the
  // control's real presence/labeling, matching this repo's own
  // established convention for fullscreen checks in extracted exports).
  await expect(page.getByRole('button', { name: /^fullscreen$|exit fullscreen/i })).toBeVisible();

  // No recursive download control.
  await expect(page.locator('[data-action="download"]')).toHaveCount(0);
  await expect(page.getByText(/download (full|non-camera) piece/i)).toHaveCount(0);

  expect(pageErrors).toEqual([]);
}

test.describe('Generated immersive ZIP: preserve walkable presentation in extracted artifacts (#448)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('the extracted Full immersive ZIP runs offline with real navigation and the full runtime control contract, at both viewports', async ({
    page,
    context,
  }) => {
    await mockEveryGetUserMediaGrant(context);
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Immersive Full ZIP runtime fixture',
      description: 'A published piece used to verify the extracted immersive Full ZIP.',
      prompt: 'teal cube',
      engine: 'threejs',
      capabilities: {
        screenshot: true,
        sound: true,
        camera_view: true,
        hand_steering: true,
        fullscreen: true,
        download: true,
      },
      source: THREEJS_STEERABLE_CUBE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, { status: 'published' });

    await page.goto(`/art-pieces/immersive/${piece.public_id}`);
    await expect(
      page.getByRole('heading', { name: 'Immersive Full ZIP runtime fixture' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Open download menu' }).click();
    const zipDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download full piece' }).click();
    const zipFile = await zipDownload;
    const zip = await JSZip.loadAsync(fs.readFileSync((await zipFile.path())!));

    expect(Object.keys(zip.files)).toContain('index.html');
    expect(Object.keys(zip.files)).toContain('scripts/piece.js');
    expect(Object.keys(zip.files)).toContain('runtime/three.min.js');
    const indexHtml = await zip.files['index.html'].async('string');
    expect(indexHtml).toContain('art-piece-navigation-pose');

    const root = await extractZip(zip);
    try {
      await context.route('**/*', (route) => {
        if (
          route.request().url().startsWith('file://') ||
          route.request().url().includes('127.0.0.1')
        ) {
          void route.continue();
        } else {
          void route.abort();
        }
      });

      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 375, height: 812 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto(`file://${path.join(root, 'index.html')}`);
        await verifyExtractedImmersiveFull(page);
      }

      const server = await serveDirectory(root);
      try {
        await page.goto(server.url);
        await verifyExtractedImmersiveFull(page);
      } finally {
        await server.close();
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('the extracted Non-Camera immersive ZIP keeps navigation and sound while enforcing device isolation', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Immersive Non-Camera ZIP fixture',
      description: 'A published piece used to verify the extracted immersive Non-Camera ZIP.',
      prompt: 'teal cube',
      engine: 'threejs',
      capabilities: {
        screenshot: true,
        sound: true,
        camera_view: true,
        hand_steering: true,
        fullscreen: true,
        download: true,
      },
      source: THREEJS_STEERABLE_CUBE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, { status: 'published' });

    await page.goto(`/art-pieces/immersive/${piece.public_id}`);
    await expect(
      page.getByRole('heading', { name: 'Immersive Non-Camera ZIP fixture' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Open download menu' }).click();
    const fullDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download full piece' }).click();
    await fullDownload;

    await page.getByRole('button', { name: 'Piece controls' }).click();
    const nonCameraDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download non-camera piece' }).click();
    const nonCameraZipFile = await nonCameraDownload;
    const zip = await JSZip.loadAsync(fs.readFileSync((await nonCameraZipFile.path())!));
    const indexHtml = await zip.files['index.html'].async('string');
    expect(indexHtml).not.toContain('data-action="camera"');
    expect(indexHtml).not.toContain('data-action="hand"');
    expect(indexHtml).toContain('art-piece-navigation-pose');
    expect(indexHtml).toContain('guardedGetUserMedia');

    const root = await extractZip(zip);
    try {
      await context.route('**/*', (route) => {
        if (
          route.request().url().startsWith('file://') ||
          route.request().url().includes('127.0.0.1')
        ) {
          void route.continue();
        } else {
          void route.abort();
        }
      });
      await page.goto(`file://${path.join(root, 'index.html')}`);
      await page.waitForFunction(() => {
        const canvas = document.querySelector('#art-piece-container canvas');
        return canvas instanceof HTMLCanvasElement && canvas.width > 0;
      });

      // Navigation still works in non-camera mode.
      const poseText = page.locator('#art-piece-navigation-pose');
      const before = await poseText.textContent();
      await page.locator('#art-piece-container').click();
      await page.keyboard.press('ArrowUp');
      await expect(poseText).not.toHaveText(before ?? '');

      // Sound still works in non-camera mode.
      await page.getByRole('button', { name: 'Unmute sound' }).click();
      await expect(page.getByRole('button', { name: 'Mute sound' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      // Camera/hand UI is absent, and any direct video access attempt
      // is refused by the device-isolation guard, exactly like #437.
      await expect(page.getByRole('button', { name: 'Enable camera view' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Steer the piece' })).toHaveCount(0);
      const videoAccessResult = await page.evaluate(async () => {
        try {
          await navigator.mediaDevices.getUserMedia({ video: true } as MediaStreamConstraints);
          return 'resolved';
        } catch (err) {
          return 'rejected:' + (err as DOMException).name;
        }
      });
      expect(videoAccessResult).toBe('rejected:NotAllowedError');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
