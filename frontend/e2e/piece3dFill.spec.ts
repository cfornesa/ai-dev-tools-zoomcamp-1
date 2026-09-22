import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const fixtures = {
  threejs:
    "const scene = new THREE.Scene(); scene.background = new THREE.Color(0x172554); const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4; window.__pieceCamera = camera; const renderer = new THREE.WebGLRenderer({ antialias: true }); window.__pieceRenderer = renderer; renderer.setSize(320, 240); document.getElementById('art-piece-container').appendChild(renderer.domElement); scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 24), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }))); renderer.render(scene, camera);",
  aframe:
    '<a-scene embedded background="color: #172554"><a-light type="ambient" color="#ffffff"></a-light><a-sphere position="0 0 -4" radius="0.8" color="#f472b6"></a-sphere><a-camera position="0 0 0"></a-camera></a-scene>',
} as const;

test.describe('Generated 3D regular stage fill (#704)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('fills the responsive stage and keeps the rendered sphere round for Three.js and A-Frame', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Generated WebGL runtime coverage is Chromium-only.');
    await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);
    const profileResponse = await apiGet(context, '/api/account/profile/');
    expect(profileResponse.ok()).toBe(true);
    const profile = (await profileResponse.json()) as { handle: string };
    const created: string[] = [];

    for (const engine of ['threejs', 'aframe'] as const) {
      const slug = `issue-704-${engine}-${Date.now().toString(36)}`;
      const response = await apiPost(context, '/api/art-pieces/', {
        title: `Issue 704 ${engine}`,
        description: 'Responsive regular-view runtime fixture.',
        prompt: `A round ${engine} fixture`,
        engine,
        public_slug: slug,
        capabilities: { screenshot: true, fullscreen: true },
        source: fixtures[engine],
      });
      expect(response.status()).toBe(201);
      const piece = (await response.json()) as { public_id: string };
      const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
        status: 'published',
      });
      expect(published.status()).toBe(200);
      created.push(slug);
    }

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      for (const engine of ['threejs', 'aframe'] as const) {
        await page.goto(
          `/users/@${profile.handle}/pieces/${created[engine === 'threejs' ? 0 : 1]}`,
        );
        await expect(page.getByRole('heading', { name: `Issue 704 ${engine}` })).toBeVisible();
        const frame = page.frameLocator('iframe[title="Art piece preview"]');
        const canvas = frame.locator('canvas').first();
        await expect(canvas).toBeVisible({ timeout: 15_000 });

        const metrics = await canvas.evaluate((element) => {
          const canvas = element as HTMLCanvasElement;
          const stage = canvas.closest('#art-piece-container, a-scene');
          if (!stage) throw new Error('The generated renderer canvas has no stage parent.');
          const canvasRect = canvas.getBoundingClientRect();
          const stageRect = stage.getBoundingClientRect();
          const runtime = (stage as HTMLElement & { renderer?: { getPixelRatio?: () => number } })
            .renderer;
          const camera = (window as Window & { __pieceCamera?: { aspect: number } }).__pieceCamera;
          return {
            canvasWidth: canvasRect.width,
            canvasHeight: canvasRect.height,
            stageWidth: stageRect.width,
            stageHeight: stageRect.height,
            backingWidth: canvas.width,
            backingHeight: canvas.height,
            pixelRatio: runtime?.getPixelRatio?.() ?? window.devicePixelRatio,
            cameraAspect:
              camera?.aspect ??
              (stage as HTMLElement & { camera?: { aspect: number } }).camera?.aspect,
          };
        });

        expect(metrics.canvasWidth).toBeCloseTo(metrics.stageWidth, 0);
        expect(metrics.canvasHeight).toBeCloseTo(metrics.stageHeight, 0);
        expect(metrics.backingWidth).toBe(Math.round(metrics.canvasWidth * metrics.pixelRatio));
        expect(metrics.backingHeight).toBe(Math.round(metrics.canvasHeight * metrics.pixelRatio));
        expect(metrics.cameraAspect).toBeCloseTo(metrics.stageWidth / metrics.stageHeight, 2);

        await page.screenshot({
          path: `test-results/issue-704-${engine}-${viewport.width}.png`,
          fullPage: true,
        });
      }
    }
  });
});
