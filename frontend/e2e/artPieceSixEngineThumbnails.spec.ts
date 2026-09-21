import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const fixtures = [
  [
    'svg',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#172554"/></svg>',
  ],
  [
    'p5js',
    'window.sketch = (p) => { p.setup = () => p.createCanvas(320, 240); p.draw = () => { p.background(17, 24, 39); p.fill(251, 191, 36); p.circle(160, 120, 120); }; };',
  ],
  [
    'c2js',
    "window.sketch = ({ canvas, startFrame }) => { const context = canvas.getContext('2d'); startFrame(() => { context.fillStyle = '#111827'; context.fillRect(0, 0, canvas.width, canvas.height); }); };",
  ],
  [
    'c2js-interactive',
    "window.sketch = ({ canvas, startFrame }) => { canvas.addEventListener('pointermove', () => {}); const context = canvas.getContext('2d'); startFrame(() => { context.fillStyle = '#1f2937'; context.fillRect(0, 0, canvas.width, canvas.height); }); };",
  ],
  [
    'threejs',
    "const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4; const renderer = new THREE.WebGLRenderer(); renderer.setSize(320, 240); document.getElementById('art-piece-container').appendChild(renderer.domElement); scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }))); renderer.render(scene, camera);",
  ],
  [
    'aframe',
    '<a-scene embedded><a-box position="0 1 -4" color="#f472b6"></a-box><a-camera position="0 1.6 0"></a-camera></a-scene>',
  ],
] as const;

async function thumbnailContainsColor(
  page: import('@playwright/test').Page,
  publicId: string,
  engine: 'threejs' | 'aframe',
) {
  return page.evaluate(
    async ({ url, expectedEngine }) => {
      const response = await fetch(url);
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (!context) return false;
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      for (let index = 0; index < pixels.length; index += 4) {
        const yellow = pixels[index] > 150 && pixels[index + 1] > 80 && pixels[index + 2] < 120;
        const pink = pixels[index] > 150 && pixels[index + 1] < 160 && pixels[index + 2] > 120;
        if ((expectedEngine === 'threejs' && yellow) || (expectedEngine === 'aframe' && pink)) {
          return true;
        }
      }
      return false;
    },
    { url: `/api/public/art-pieces/${publicId}/thumbnail.png`, expectedEngine: engine },
  );
}

test.describe('Six-engine captured thumbnails (#602)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('captures real thumbnails for every engine and renders them on the public profile', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);
    const profileResponse = await apiGet(context, '/api/account/profile/');
    expect(profileResponse.ok()).toBe(true);
    const profile = (await profileResponse.json()) as { handle: string };
    const runId = Date.now().toString(36);
    const pieces: Array<{ title: string; slug: string }> = [];

    for (const [engine, source] of fixtures) {
      const title = `Six-engine thumbnail ${engine}`;
      const slug = `thumbnail-${runId}-${engine}`;
      pieces.push({ title, slug });
      const created = await apiPost(context, '/api/art-pieces/', {
        title,
        description: 'Captured thumbnail fixture.',
        prompt: `Thumbnail ${engine}`,
        engine,
        public_slug: slug,
        capabilities: { screenshot: true, fullscreen: true, download: true, immersive: true },
        source,
      });
      expect(created.status()).toBe(201);
      const piece = (await created.json()) as {
        public_id: string;
        current_version: { id: number };
      };
      const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
        status: 'published',
      });
      expect(published.status()).toBe(200);
      await page.goto(`/art-pieces/${piece.public_id}/edit`);
      await page.getByTestId('art-piece-editor-regenerate-thumbnail').click();
      await expect
        .poll(
          async () => {
            const detail = await apiGet(context, `/api/art-pieces/${piece.public_id}/`);
            const body = (await detail.json()) as {
              current_version: { thumbnail_is_fallback: boolean };
            };
            return body.current_version.thumbnail_is_fallback;
          },
          { timeout: 15_000 },
        )
        .toBe(false);
      if (engine === 'threejs') {
        expect(await thumbnailContainsColor(page, piece.public_id, engine)).toBe(true);
      }
    }

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`/users/@${profile.handle}`);
      for (const piece of pieces) {
        await expect(
          page
            .locator(`a[href="/users/@${profile.handle}/pieces/${piece.slug}"]`)
            .getByRole('img', { name: `Preview of ${piece.title}`, exact: true }),
        ).toBeVisible();
      }
    }
    await context.close();
  });
});
