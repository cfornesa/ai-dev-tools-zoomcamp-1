import { expect, test } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const SOURCES = {
  threejs:
    "const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4; camera.lookAt(0, 0, 0); const renderer = new THREE.WebGLRenderer(); renderer.setSize(320, 240); document.getElementById('art-piece-container').appendChild(renderer.domElement); scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }))); renderer.render(scene, camera);",
  aframe:
    '<a-scene embedded><a-box position="0 1 -4" rotation="0 30 0" color="#f472b6"></a-box><a-camera position="0 1.6 0"></a-camera></a-scene>',
} as const;

test.describe('3D AI editor engine modes (#620)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('preserves authored Three.js and A-Frame editor identity through revision/save', async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      for (const engine of ['threejs', 'aframe'] as const) {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.setViewportSize(viewport);
        await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);
        const profileResponse = await apiGet(context, '/api/account/profile/');
        expect(profileResponse.ok()).toBe(true);
        const profile = (await profileResponse.json()) as { handle: string };
        const slug = `e2e-3d-${engine}-${viewport.width}-${Date.now().toString(36)}`;
        const created = await apiPost(context, '/api/art-pieces/', {
          title: `3D ${engine} editor fixture`,
          description: 'Authored camera/input editor contract fixture.',
          prompt: `Create a ${engine} editor fixture`,
          engine,
          public_slug: slug,
          capabilities: { screenshot: true, download: true, immersive: true },
          source: SOURCES[engine],
        });
        expect(created.status()).toBe(201);

        await page.goto(`/users/@${profile.handle}/edit/${slug}`);
        await expect(page.getByTestId('art-piece-editor-mode')).toHaveText(
          new RegExp(`3D AI editor.*${engine === 'threejs' ? 'Three.js' : 'A-Frame'}`),
        );
        await expect(page.locator('[data-editor-family="3d"]')).toHaveAttribute(
          'data-editor-engine',
          engine,
        );
        await expect(page.getByTestId('art-piece-editor-source-only')).toHaveCount(0);
        await page
          .getByLabel('Describe the revision you want to generate')
          .fill('add a second form');
        await page.getByRole('button', { name: 'Refine piece' }).click();
        const preview = page.frameLocator('iframe[title="Art piece revision preview"]');
        // Three.js owns a renderer canvas directly; A-Frame owns the scene
        // element and may create its renderer canvas asynchronously in a
        // headless browser. Assert each engine's stable runtime surface.
        await expect(preview.locator(engine === 'threejs' ? 'canvas' : 'a-scene')).toBeVisible();
        await expect(page.getByTestId('art-piece-refine-accepted')).toBeVisible();
        await expect(page.getByTestId('art-piece-editor-version-list')).toContainText('Version 2');
        await context.close();
      }
    }
  });
});
