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
 * Issue #437: the Non-Camera ZIP export's `stripCameraArtifacts` used to
 * blanket-replace the bare word "camera" anywhere in the generated source
 * with the literal text "non-camera" -- corrupting perfectly ordinary
 * Three.js code that (like this suite's own fixture) simply names its
 * own perspective-camera variable `camera`: `var camera = new
 * THREE.PerspectiveCamera()` became `var non-camera = ...`, a
 * `SyntaxError` at parse time. It also tried to neutralize device access
 * via a narrow textual match on `mediaDevices.getUserMedia`, which does
 * nothing against aliased or computed access. This suite drives the real
 * extracted Non-Camera ZIP -- executing it, not grepping its source -- to
 * prove the piece still renders correctly and that camera access is
 * unconditionally refused however the generated code tries to reach it,
 * while audio-only access (the Microphone capability, which this export
 * mode still supports) keeps working.
 */

const THREEJS_CAMERA_IDENTIFIER_FIXTURE = `
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
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

window.__cameraAccessResults = {};
function record(name, promiseFactory) {
  var result;
  try {
    result = promiseFactory();
  } catch (err) {
    window.__cameraAccessResults[name] = 'threw:' + (err && err.message);
    return;
  }
  result.then(
    function () { window.__cameraAccessResults[name] = 'resolved'; },
    function (err) { window.__cameraAccessResults[name] = 'rejected:' + (err && err.name) + ':' + (err && err.message); }
  );
}
record('direct', function () { return navigator.mediaDevices.getUserMedia({ video: true }); });
record('aliasedLocal', function () {
  var aliased = navigator.mediaDevices.getUserMedia;
  return aliased.call(navigator.mediaDevices, { video: true });
});
record('computedProperty', function () {
  return navigator['mediaDevices']['getUserMedia']({ video: true });
});
record('legacyVendorPrefixed', function () {
  return new Promise(function (resolve, reject) {
    navigator.getUserMedia({ video: true }, resolve, reject);
  });
});
record('audioOnly', function () { return navigator.mediaDevices.getUserMedia({ audio: true }); });
`;

/** Fakes every getUserMedia grant (audio and video alike) with a real
 * MediaStream -- the *product's own* guard is what must still refuse a
 * video request; this exists only so an audio-only request that legally
 * passes the guard resolves deterministically instead of hanging on a
 * real permission prompt or a missing physical device. Not scoped to an
 * iframe (unlike the live-preview specs' equivalent helper) -- the
 * extracted export is a single top-level document, not a sandboxed
 * iframe. */
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

async function verifyExtractedNonCameraRuntime(page: Page): Promise<void> {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // Rendered correctly -- a real pixel check, not a source-string check.
  // The cube's teal-ish material color must appear somewhere on the
  // canvas once Three.js has rendered a frame.
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#art-piece-container canvas');
    return canvas instanceof HTMLCanvasElement && canvas.width > 0;
  });
  // Copies the live WebGL canvas onto a fresh 2D canvas (works regardless
  // of whether the renderer used a 'webgl' or 'webgl2' context, and
  // regardless of `preserveDrawingBuffer` -- the scene animates
  // continuously via requestAnimationFrame, so the framebuffer always
  // has fresh content by the time this runs) rather than re-acquiring a
  // WebGL context on a canvas THREE.js already claimed one on -- a
  // second, different-type `getContext` call on the same canvas returns
  // null.
  const pixelColors = await page.evaluate(() => {
    const canvas = document.querySelector('#art-piece-container canvas') as HTMLCanvasElement;
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const ctx2d = copy.getContext('2d')!;
    ctx2d.drawImage(canvas, 0, 0);
    return Array.from(
      ctx2d.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data,
    );
  });
  expect(pixelColors).not.toBeNull();
  // Anything other than the flat white background (255,255,255) proves
  // the cube actually rendered -- no SyntaxError silently left a blank
  // canvas.
  expect(pixelColors).not.toEqual([255, 255, 255, 255]);

  // No SyntaxError or any other uncaught error -- the exact regression
  // class this issue fixes would have thrown at parse/first-execution.
  expect(pageErrors).toEqual([]);

  // Camera/hand UI is genuinely absent, not just hidden.
  await expect(page.getByRole('button', { name: 'Enable camera view' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Steer the piece' })).toHaveCount(0);
  await expect(page.locator('[data-action="camera"]')).toHaveCount(0);
  await expect(page.locator('[data-action="hand"]')).toHaveCount(0);

  // Screenshot, Sound, and Fullscreen remain functional.
  const screenshotDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Screenshot' }).click();
  const screenshot = await screenshotDownload;
  const screenshotBytes = fs.readFileSync((await screenshot.path())!);
  expect(screenshotBytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  const soundButton = page.getByRole('button', { name: 'Unmute sound' });
  await soundButton.click();
  await expect(page.getByRole('button', { name: 'Mute sound' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await expect(page.getByRole('button', { name: /^fullscreen$|exit fullscreen/i })).toBeVisible();

  // No recursive download control inside the export.
  await expect(page.locator('[data-action="download"]')).toHaveCount(0);
  await expect(page.getByText(/download (full|non-camera) piece/i)).toHaveCount(0);

  // The actual behavior this issue exists to guarantee: every access
  // path to a *video* stream is refused, however the generated code
  // tries to reach it -- direct call, a locally aliased reference, a
  // fully computed property lookup, and the legacy vendor-prefixed
  // three-argument form. An audio-only request (Microphone) is
  // unaffected.
  await expect
    .poll(() =>
      page.evaluate(() => (window as { __cameraAccessResults?: object }).__cameraAccessResults),
    )
    .toMatchObject({
      direct: expect.stringMatching(/^rejected:NotAllowedError/),
      aliasedLocal: expect.stringMatching(/^rejected:NotAllowedError/),
      computedProperty: expect.stringMatching(/^rejected:NotAllowedError/),
      legacyVendorPrefixed: expect.stringMatching(/^rejected:NotAllowedError/),
      audioOnly: 'resolved',
    });
}

test.describe('Generated Non-Camera ZIP: preserve artwork while enforcing device isolation (#437)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('the extracted Non-Camera ZIP renders correctly offline and refuses every video access path at both viewports', async ({
    page,
    context,
  }) => {
    await mockEveryGetUserMediaGrant(context);
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Non-Camera ZIP runtime fixture',
      description: 'A published piece used to verify the extracted Non-Camera ZIP.',
      prompt: 'teal cube',
      engine: 'threejs',
      capabilities: {
        screenshot: true,
        sound: true,
        microphone: true,
        camera_view: true,
        hand_steering: true,
        fullscreen: true,
        download: true,
      },
      source: THREEJS_CAMERA_IDENTIFIER_FIXTURE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    await page.goto(`/art-pieces/p/${piece.public_id}`);
    await expect(
      page.getByRole('heading', { name: 'Non-Camera ZIP runtime fixture' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Open download menu' }).click();
    const zipDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download non-camera piece' }).click();
    const zipFile = await zipDownload;
    const zip = await JSZip.loadAsync(fs.readFileSync((await zipFile.path())!));

    expect(Object.keys(zip.files)).toContain('index.html');
    expect(Object.keys(zip.files)).toContain('scripts/piece.js');
    expect(Object.keys(zip.files)).toContain('runtime/three.min.js');

    // The literal regression: the `camera` identifier survives verbatim,
    // and the guard installs before anything else runs.
    const pieceScript = await zip.files['scripts/piece.js'].async('string');
    expect(pieceScript).toContain('var camera = new THREE.PerspectiveCamera');
    expect(pieceScript).not.toContain('non-camera');
    const indexHtml = await zip.files['index.html'].async('string');
    expect(indexHtml).toContain('guardedGetUserMedia');
    expect(indexHtml.indexOf('guardedGetUserMedia')).toBeLessThan(
      indexHtml.indexOf('scripts/piece.js'),
    );

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'art-piece-non-camera-zip-e2e-'));
    try {
      for (const [name, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        const target = path.join(root, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, await entry.async('nodebuffer'));
      }

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
        await verifyExtractedNonCameraRuntime(page);
      }

      const server = await serveDirectory(root);
      try {
        await page.goto(server.url);
        await verifyExtractedNonCameraRuntime(page);
      } finally {
        await server.close();
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('a flat (Canvas2D) engine export never advertises hand-steering, and the guard is absent entirely in Full ZIP mode', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Non-Camera ZIP flat fixture',
      description: 'A published piece used to verify flat-engine non-camera export.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: { screenshot: true, download: true, camera_view: true, hand_steering: true },
      source:
        '<canvas id="art-piece-canvas" width="320" height="240"></canvas>' +
        '<script>var c=document.getElementById("art-piece-canvas");' +
        'var x=c.getContext("2d");x.fillStyle="#dc2626";x.fillRect(0,0,320,240);</script>',
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, { status: 'published' });

    await page.goto(`/art-pieces/p/${piece.public_id}`);
    await expect(page.getByRole('heading', { name: 'Non-Camera ZIP flat fixture' })).toBeVisible();
    await page.getByRole('button', { name: 'Open download menu' }).click();
    const fullDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download full piece' }).click();
    const fullZip = await JSZip.loadAsync(fs.readFileSync((await (await fullDownload).path())!));
    const fullHtml = await fullZip.files['index.html'].async('string');
    expect(fullHtml).not.toContain('guardedGetUserMedia');

    await page.getByRole('button', { name: 'Piece controls' }).click();
    const nonCameraDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download non-camera piece' }).click();
    const nonCameraZip = await JSZip.loadAsync(
      fs.readFileSync((await (await nonCameraDownload).path())!),
    );
    const nonCameraHtml = await nonCameraZip.files['index.html'].async('string');
    expect(nonCameraHtml).not.toContain('data-action="camera"');
    expect(nonCameraHtml).not.toContain('data-action="hand"');
    expect(nonCameraHtml).toContain('guardedGetUserMedia');
  });
});
