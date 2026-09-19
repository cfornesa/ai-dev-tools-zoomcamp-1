import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const fixtures = [
  {
    engine: 'svg',
    source:
      '<svg id="bundle-svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#172554"/><circle cx="160" cy="120" r="64" fill="#fbbf24"/></svg>',
    selector: '#bundle-svg',
    runtime: undefined,
  },
  {
    engine: 'p5js',
    source:
      'window.sketch = (p) => { p.setup = () => { p.createCanvas(320, 240); }; p.draw = () => { p.background(17, 24, 39); p.fill(251, 191, 36); p.circle(160, 120, 120); }; };',
    selector: 'canvas',
    runtime: 'runtime/p5.min.js',
  },
  {
    engine: 'c2js',
    source:
      "window.sketch = ({ canvas, startFrame }) => { const context = canvas.getContext('2d'); startFrame(() => { context.fillStyle = '#111827'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#22d3ee'; context.fillRect(120, 80, 80, 80); }); };",
    selector: '#c2-canvas',
    runtime: undefined,
  },
  {
    engine: 'c2js-interactive',
    source:
      "window.sketch = ({ canvas, startFrame }) => { canvas.addEventListener('pointermove', (event) => { canvas.dataset.pointerX = String(event.offsetX); }); const context = canvas.getContext('2d'); startFrame(() => { context.fillStyle = '#1f2937'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#fb7185'; context.fillRect(Number(canvas.dataset.pointerX || 160) - 40, 80, 80, 80); }); };",
    selector: '#c2-canvas',
    runtime: undefined,
  },
  {
    engine: 'threejs',
    source:
      "const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4; const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(320, 240); document.getElementById('art-piece-container').appendChild(renderer.domElement); scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }))); renderer.render(scene, camera);",
    selector: '#art-piece-container canvas',
    runtime: 'runtime/three.min.js',
  },
  {
    engine: 'aframe',
    source:
      '<a-scene embedded><a-box position="0 1 -4" color="#f472b6"></a-box><a-camera position="0 1.6 0"></a-camera></a-scene>',
    selector: 'canvas.a-canvas',
    runtime: 'runtime/aframe.min.js',
  },
] as const;

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
      response.writeHead(200, {
        'Content-Type': mime[path.extname(filePath)] ?? 'application/octet-stream',
      });
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

async function extract(zip: JSZip): Promise<string> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'art-piece-six-engine-zip-'));
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, await entry.async('nodebuffer'));
  }
  return root;
}

test.describe('Six-engine offline regular and immersive bundles (#609)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('extracts and renders every engine in regular and immersive presentations offline', async ({
    page,
    context,
  }) => {
    const runId = Date.now().toString(36);
    const handle = `e2e-zip-${runId}`;
    await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);
    const profileResponse = await apiGet(context, '/api/account/profile/');
    expect(profileResponse.ok()).toBe(true);
    const profile = (await profileResponse.json()) as Record<string, unknown>;
    const updatedProfile = await apiPatch(context, '/api/account/profile/', {
      ...profile,
      handle,
      display_name: 'Six Engine ZIP Fixture',
      is_public: true,
    });
    expect(updatedProfile.ok()).toBe(true);

    const pieces: Array<{ publicId: string; engine: (typeof fixtures)[number]['engine'] }> = [];
    for (const fixture of fixtures) {
      const response = await apiPost(context, '/api/art-pieces/', {
        title: `Six Engine ZIP ${fixture.engine}`,
        description: `Offline ${fixture.engine} bundle fixture.`,
        prompt: `An offline ${fixture.engine} fixture`,
        engine: fixture.engine,
        public_slug: `${runId}-${fixture.engine}`,
        capabilities: { screenshot: true, fullscreen: true, immersive: true, download: true },
        source: fixture.source,
      });
      expect(response.status()).toBe(201);
      const piece = (await response.json()) as { public_id: string };
      const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
        status: 'published',
      });
      expect(published.status()).toBe(200);
      pieces.push({ publicId: piece.public_id, engine: fixture.engine });
    }

    const extracted: Array<{ root: string; selector: string }> = [];
    for (const presentation of ['regular', 'immersive'] as const) {
      for (const fixture of fixtures) {
        const piece = pieces.find((candidate) => candidate.engine === fixture.engine)!;
        await page.goto(
          presentation === 'regular'
            ? `/art-pieces/p/${piece.publicId}`
            : `/art-pieces/immersive/${piece.publicId}`,
        );
        const menuButton = page.getByRole('button', { name: 'Open download menu' });
        if (presentation === 'regular') {
          await expect(menuButton).toBeVisible();
        } else {
          await page.getByRole('button', { name: 'Piece controls' }).click();
        }
        const downloadPromise = page.waitForEvent('download');
        if (presentation === 'regular') await menuButton.click();
        await page.getByRole('button', { name: 'Download full piece' }).click();
        const download = await downloadPromise;
        const zip = await JSZip.loadAsync(fs.readFileSync((await download.path())!));
        expect(Object.keys(zip.files)).toContain('index.html');
        expect(Object.keys(zip.files)).toContain('styles/piece.css');
        const indexHtml = await zip.files['index.html'].async('string');
        expect(indexHtml).not.toContain('cdn.jsdelivr.net');
        if (fixture.runtime) expect(Object.keys(zip.files)).toContain(fixture.runtime);
        if (fixture.engine === 'c2js' || fixture.engine === 'c2js-interactive') {
          expect(indexHtml).toContain('var c2Fallback = {');
        }
        const root = await extract(zip);
        extracted.push({ root, selector: fixture.selector });
        const served = await serveDirectory(root);
        try {
          await page.goto(served.url);
          await expect(page.locator(fixture.selector)).toBeVisible({ timeout: 15_000 });
          if (presentation === 'immersive') {
            await expect(page.locator('#art-piece-navigation-pose')).toBeVisible();
            await page.locator('[aria-label="Immersive stage"]').focus();
            await page.keyboard.press('ArrowRight');
          }
        } finally {
          await served.close();
        }
      }
    }
    for (const item of extracted) fs.rmSync(item.root, { recursive: true, force: true });
  });
});
