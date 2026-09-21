import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { expect, test, type Page } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

type Fixture = {
  engine: string;
  source: string;
  manualSource: string;
  manualMarker: string;
  aiMarker: string;
  selector: string;
};

const FIXTURES: Fixture[] = [
  {
    engine: 'canvas2d',
    source:
      '<canvas id="art-piece-canvas" width="800" height="600"></canvas><script>const c=document.getElementById(\'art-piece-canvas\');const ctx=c.getContext(\'2d\');ctx.fillStyle=\'teal\';ctx.fillRect(0,0,800,600);</script>',
    manualSource:
      "<canvas id=\"art-piece-canvas\" width=\"800\" height=\"600\"></canvas><script>const c=document.getElementById('art-piece-canvas');const ctx=c.getContext('2d');ctx.fillStyle='teal';ctx.fillRect(0,0,800,600);ctx.fillStyle='#172554';ctx.fillRect(100,100,160,160);</script>",
    manualMarker: '#172554',
    aiMarker: '#e76f51',
    selector: '#art-piece-canvas',
  },
  {
    engine: 'svg',
    source:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="teal" /></svg>',
    manualSource:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="teal" /><circle cx="400" cy="300" r="120" fill="#172554" /></svg>',
    manualMarker: '#172554',
    aiMarker: '#e76f51',
    selector: 'svg',
  },
  {
    engine: 'p5js',
    source:
      'window.sketch = function (p) { p.setup = function () { p.createCanvas(800, 600); }; p.draw = function () { p.background(42, 157, 143); p.circle(400, 300, 180); }; };',
    manualSource:
      'window.sketch = function (p) { p.setup = function () { p.createCanvas(800, 600); }; p.draw = function () { p.background(42, 157, 143); p.circle(400, 300, 240); p.fill(23, 37, 84); p.rect(100, 100, 160, 160); }; };',
    manualMarker: 'p.rect(100, 100, 160, 160)',
    aiMarker: '231, 111, 81',
    selector: 'canvas',
  },
  {
    engine: 'c2js',
    source:
      "window.sketch = function (runtime) { var ctx = runtime.canvas.getContext('2d'); runtime.startFrame(function () { ctx.fillStyle = '#2a9d8f'; ctx.fillRect(0, 0, 1280, 720); }); };",
    manualSource:
      "window.sketch = function (runtime) { var ctx = runtime.canvas.getContext('2d'); runtime.startFrame(function () { ctx.fillStyle = '#2a9d8f'; ctx.fillRect(0, 0, 1280, 720); ctx.fillStyle = '#172554'; ctx.fillRect(120, 100, 180, 180); }); };",
    manualMarker: '#172554',
    aiMarker: '#e76f51',
    selector: '#c2-canvas',
  },
  {
    engine: 'c2js-interactive',
    source:
      "window.sketch = function (runtime) { var ctx = runtime.canvas.getContext('2d'); runtime.canvas.addEventListener('pointermove', function () {}); runtime.startFrame(function () { ctx.fillStyle = '#2a9d8f'; ctx.fillRect(0, 0, 1280, 720); }); };",
    manualSource:
      "window.sketch = function (runtime) { var ctx = runtime.canvas.getContext('2d'); runtime.canvas.addEventListener('pointermove', function () {}); runtime.startFrame(function () { ctx.fillStyle = '#2a9d8f'; ctx.fillRect(0, 0, 1280, 720); ctx.fillStyle = '#172554'; ctx.fillRect(120, 100, 180, 180); }); };",
    manualMarker: '#172554',
    aiMarker: '#e76f51',
    selector: '#c2-canvas',
  },
  {
    engine: 'threejs',
    source:
      "var scene = new THREE.Scene(); var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100); camera.position.set(0, 0, 5); var renderer = new THREE.WebGLRenderer(); var container = document.getElementById('art-piece-container'); renderer.setSize(container.clientWidth || 320, container.clientHeight || 240); container.appendChild(renderer.domElement); var material = new THREE.MeshBasicMaterial({ color: 0x2a9d8f }); var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material); scene.add(mesh); renderer.render(scene, camera);",
    manualSource:
      "var scene = new THREE.Scene(); var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100); camera.position.set(0, 0, 5); var renderer = new THREE.WebGLRenderer(); var container = document.getElementById('art-piece-container'); renderer.setSize(container.clientWidth || 320, container.clientHeight || 240); container.appendChild(renderer.domElement); var material = new THREE.MeshBasicMaterial({ color: 0x2a9d8f }); var mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), material); scene.add(mesh); var manual = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0x172554 })); scene.add(manual); renderer.render(scene, camera);",
    manualMarker: '0x172554',
    aiMarker: '0xe76f51',
    selector: '#art-piece-container canvas',
  },
  {
    engine: 'aframe',
    source:
      '<a-scene><a-box position="0 1 -3" rotation="0 45 0" color="#2a9d8f"></a-box><a-camera></a-camera></a-scene>',
    manualSource:
      '<a-scene><a-box position="0 1 -3" rotation="0 45 0" color="#2a9d8f" scale="1.5 1.5 1.5"></a-box><a-sphere position="1 1 -3" color="#172554"></a-sphere><a-camera></a-camera></a-scene>',
    manualMarker: '#172554',
    aiMarker: '#e76f51',
    selector: 'canvas.a-canvas',
  },
];

function serveDirectory(root: string): Promise<{ url: string; close: () => Promise<void> }> {
  const mime: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
  };
  const server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent((request.url ?? '/').split('?')[0]);
    const filePath = path.join(root, requestPath === '/' ? 'index.html' : requestPath);
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] ?? 'text/plain' });
      response.end(data);
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edit-output-consistency-'));
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, await entry.async('nodebuffer'));
  }
  return root;
}

async function assertOutputs(
  page: Page,
  fixture: Fixture,
  handle: string,
  slug: string,
  marker: string,
  label: string,
) {
  for (const presentation of ['regular', 'immersive'] as const) {
    const route =
      presentation === 'regular'
        ? `/users/@${handle}/pieces/${slug}`
        : `/users/@${handle}/immersive/${slug}`;
    await page.goto(route);
    await expect(
      page.getByRole('heading', { name: new RegExp(`Edit-output ${fixture.engine}`) }),
    ).toBeVisible();
    const preview = page.frameLocator(
      `iframe[title="${presentation === 'regular' ? 'Art piece preview' : 'Immersive art piece preview'}"]`,
    );
    await expect(preview.locator(fixture.selector)).toBeVisible({ timeout: 20_000 });
    await page.screenshot({
      path: `test-results/edit-output-${fixture.engine}-${label}-${presentation}.png`,
      fullPage: true,
    });

    const menu = page.getByRole('button', { name: 'Open download menu' });
    await expect(menu).toBeVisible();
    await menu.click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Download Full ZIP' }).click();
    const download = await downloadPromise;
    const zip = await JSZip.loadAsync(fs.readFileSync((await download.path())!));
    const bundleText = await Promise.all(
      Object.values(zip.files)
        .filter((entry) => !entry.dir)
        .map((entry) => entry.async('string')),
    );
    expect(bundleText.join('\n')).toContain(marker);
    const root = await extractZip(zip);
    const served = await serveDirectory(root);
    try {
      await page.goto(served.url);
      await expect(page.locator(fixture.selector)).toBeVisible({ timeout: 20_000 });
    } finally {
      await served.close();
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
}

test.describe('edit-to-output consistency (#671)', () => {
  const fixtures = requireE2EFixtures();

  test('manual and fake-provider AI edits reach regular, immersive, and ZIP outputs', async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const profileResponse = await apiGet(context, '/api/account/profile/');
    expect(profileResponse.ok()).toBe(true);
    const profile = (await profileResponse.json()) as { handle: string };
    const runId = Date.now().toString(36);

    for (const fixture of FIXTURES) {
      const slug = `edit-output-${runId}-${fixture.engine}`;
      const created = await apiPost(context, '/api/art-pieces/', {
        title: `Edit-output ${fixture.engine}`,
        description: `Edit-to-output consistency fixture for ${fixture.engine}.`,
        prompt: `A deterministic ${fixture.engine} consistency fixture`,
        engine: fixture.engine,
        public_slug: slug,
        capabilities: { screenshot: true, download: true, immersive: true },
        source: fixture.source,
      });
      expect(created.status()).toBe(201);
      const piece = (await created.json()) as { public_id: string };

      const manual = await apiPost(context, `/api/art-pieces/${piece.public_id}/versions/`, {
        source: fixture.manualSource,
        capabilities: { screenshot: true, download: true, immersive: true },
      });
      expect(manual.status()).toBe(201);
      const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
        status: 'published',
      });
      expect(published.status()).toBe(200);
      await assertOutputs(page, fixture, profile.handle, slug, fixture.manualMarker, 'manual');

      const refined = await apiPost(context, `/api/art-pieces/${piece.public_id}/refine/`, {
        instruction: 'make the accent warmer',
      });
      expect(refined.status()).toBe(200);
      expect((await refined.json()).status).toBe('accepted');
      await assertOutputs(page, fixture, profile.handle, slug, fixture.aiMarker, 'ai');
    }
  });
});
