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
 * Issue #436: the downloaded Full ZIP's `index.html` used to dispatch
 * `art-piece-command` CustomEvents that nothing in the exported bundle
 * ever consumed -- every "runtime control" was decorative. This suite
 * downloads a real Full ZIP (sound/camera/steering/screenshot enabled),
 * extracts it to an isolated temp directory, disables the network, and
 * drives the extracted `index.html` directly -- first from `file://`,
 * then re-served from a disposable localhost static server (a separate
 * evidence boundary the issue's own acceptance criteria calls for,
 * since some browser APIs behave differently under each origin type).
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

/** Mocks a granted camera for the extracted, standalone document (no
 * sandboxed iframe here -- the whole page is the piece), scoped via
 * `context.addInitScript` exactly like the live-preview specs. */
async function mockGrantedCamera(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
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

/** Serves `root` on an ephemeral localhost port -- the "localhost proof
 * recorded separately from file://" the issue's acceptance criteria
 * requires. No extra dependency: Node's built-in `http` module is
 * enough for a handful of static files. */
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

async function verifyExtractedRuntime(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Screenshot' })).toBeVisible();

  // No automatic device grants: no camera/mic prompt/activation on load.
  const cameraCalledOnLoad = await page.evaluate(() => {
    let called = false;
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (...args: Parameters<typeof original>) => {
      called = true;
      return original(...args);
    };
    return called;
  });
  expect(cameraCalledOnLoad).toBe(false);

  // Screenshot: a real, decodable PNG.
  const screenshotDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Screenshot' }).click();
  const screenshot = await screenshotDownload;
  const screenshotBytes = fs.readFileSync((await screenshot.path())!);
  expect(screenshotBytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  // Sound: a real toggle, not a fire-and-forget event.
  const soundButton = page.getByRole('button', { name: 'Unmute sound' });
  await soundButton.click();
  await expect(page.getByRole('button', { name: 'Mute sound' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Camera + steering: the full lifecycle, exactly like the live preview.
  const cameraButton = page.getByRole('button', { name: 'Enable camera view' });
  await cameraButton.click();
  await expect(page.getByRole('button', { name: 'Disable camera view' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#art-piece-camera-overlay')).toHaveCount(1);
  const steerButton = page.getByRole('button', { name: 'Steer the piece' });
  await steerButton.click();
  await expect(page.getByRole('button', { name: 'Stop steering' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Reset does not toggle sound/camera/steering.
  await page.getByRole('button', { name: 'Reset view' }).click();
  await expect(page.getByRole('button', { name: 'Mute sound' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Disable camera view' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Stop steering' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // The runtime error region starts (and stays) hidden -- nothing above
  // threw. It carries role="alert" only once shown; hidden, it never
  // matches an accessible-role query at all.
  await expect(page.locator('#art-piece-runtime-error')).toBeHidden();
}

test.describe('Generated Full ZIP: execute packaged runtime controls after extraction (#436)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('the extracted Full ZIP runs offline with real, acknowledged runtime controls at both viewports', async ({
    page,
    context,
  }) => {
    await mockGrantedCamera(context);
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Full ZIP runtime fixture',
      description: 'A published piece used to verify the extracted Full ZIP runtime.',
      prompt: 'red cube',
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
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    await page.goto(`/art-pieces/p/${piece.public_id}`);
    await expect(page.getByRole('heading', { name: 'Full ZIP runtime fixture' })).toBeVisible();
    await page.getByRole('button', { name: 'Open download menu' }).click();
    const zipDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download full piece' }).click();
    const zipFile = await zipDownload;
    const zip = await JSZip.loadAsync(fs.readFileSync((await zipFile.path())!));

    expect(Object.keys(zip.files)).toContain('index.html');
    expect(Object.keys(zip.files)).toContain('scripts/piece.js');
    expect(Object.keys(zip.files)).toContain('runtime/three.min.js');
    // No recursive Download control -- the packaged runtime has no
    // "download this piece" affordance inside itself.
    const indexHtml = await zip.files['index.html'].async('string');
    expect(indexHtml).not.toContain('data-action="download"');
    expect(indexHtml).not.toMatch(/Download (full|non-camera) piece/i);

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'art-piece-full-zip-e2e-'));
    try {
      for (const [name, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        const target = path.join(root, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, await entry.async('nodebuffer'));
      }

      // Network disabled after download -- the extracted bundle must be
      // fully self-contained (the vendored runtime/three.min.js, no CDN).
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
        await verifyExtractedRuntime(page);
      }

      // localhost proof, recorded separately from file://.
      const server = await serveDirectory(root);
      try {
        await page.goto(server.url);
        await verifyExtractedRuntime(page);
      } finally {
        await server.close();
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
