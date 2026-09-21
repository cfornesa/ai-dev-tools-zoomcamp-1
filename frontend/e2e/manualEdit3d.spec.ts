import fs from 'node:fs';

import JSZip from 'jszip';
import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const SOURCES = {
  threejs:
    "const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4; camera.lookAt(0, 0, 0); const renderer = new THREE.WebGLRenderer(); renderer.setSize(320, 240); document.getElementById('art-piece-container').appendChild(renderer.domElement); renderer.render(scene, camera);",
  aframe: '<a-scene embedded><a-camera position="0 1.6 0"></a-camera></a-scene>',
} as const;

test.describe('Generated 3D manual editing tools (#668)', () => {
  const fixtures = requireE2EFixtures();

  test('adds, outlines, transforms, saves, and publishes Three.js and A-Frame edits', async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const profileResponse = await apiGet(context, '/api/account/profile/');
    expect(profileResponse.ok()).toBe(true);
    const profile = (await profileResponse.json()) as { handle: string };

    for (const engine of ['threejs', 'aframe'] as const) {
      const slug = `manual-3d-${engine}-${Date.now().toString(36)}`;
      const created = await apiPost(context, '/api/art-pieces/', {
        title: `Manual ${engine} fixture`,
        description: 'Manual 3D fixture.',
        prompt: `A ${engine} manual editing fixture`,
        engine,
        public_slug: slug,
        capabilities: { screenshot: true, download: true, immersive: true },
        source: SOURCES[engine],
      });
      expect(created.status()).toBe(201);
      const piece = (await created.json()) as { public_id: string };

      await page.goto(`/users/@${profile.handle}/edit/${slug}`);
      await expect(
        page.getByRole('heading', { name: `Edit Manual ${engine} fixture` }),
      ).toBeVisible();
      await expect(page.getByTestId('art-piece-editor-3d-manual-tools')).toBeVisible();
      await expect(page.getByTestId('art-piece-editor-add-box')).toBeVisible();
      await expect(page.getByTestId('art-piece-editor-add-sphere')).toBeVisible();
      await expect(page.getByTestId('art-piece-editor-add-plane')).toBeVisible();

      await page
        .getByTestId(
          engine === 'threejs' ? 'art-piece-editor-add-box' : 'art-piece-editor-add-sphere',
        )
        .click();
      await expect(page.getByTestId('art-piece-editor-code-panel')).toContainText(
        'AUGMENTRART_EDITABLE_START',
      );
      await expect(page.locator('#art-piece-editor-code')).toHaveValue(
        new RegExp(engine === 'threejs' ? 'EdgesGeometry' : 'wireframe'),
      );
      const preview = page.frameLocator('iframe[title="Art piece revision preview"]');
      const previewSurface = preview.locator(engine === 'threejs' ? 'canvas' : 'canvas.a-canvas');
      await expect(previewSurface).toBeVisible({
        timeout: 20_000,
      });
      if (engine === 'aframe') {
        await preview.locator('a-scene').evaluate(
          (scene) =>
            new Promise<void>((resolve) => {
              if ((scene as HTMLElement & { hasLoaded?: boolean }).hasLoaded) {
                resolve();
              } else {
                scene.addEventListener('loaded', () => resolve(), { once: true });
              }
            }),
        );
        await page.waitForTimeout(1000);
      }

      await page.locator('#art-piece-editor-3d-x').fill('0.5');
      await page.locator('#art-piece-editor-3d-y').fill(engine === 'aframe' ? '1.6' : '0');
      await page.locator('#art-piece-editor-3d-rotationY').fill('30');
      await page.locator('#art-piece-editor-3d-scaleX').fill('2');
      await page.getByTestId('art-piece-editor-apply-3d-transform').click();
      if (engine === 'aframe') {
        await preview.locator('a-scene').evaluate(
          (scene) =>
            new Promise<void>((resolve) => {
              if ((scene as HTMLElement & { hasLoaded?: boolean }).hasLoaded) {
                resolve();
              } else {
                scene.addEventListener('loaded', () => resolve(), { once: true });
              }
            }),
        );
        await page.waitForTimeout(1000);
      } else {
        await page.waitForTimeout(500);
      }
      await expect(page.locator('#art-piece-editor-code')).toHaveValue(
        new RegExp(engine === 'threejs' ? '0[.]5' : 'position="0.5'),
      );
      const previewPng = await previewSurface.evaluate((canvas) =>
        (canvas as HTMLCanvasElement).toDataURL('image/png'),
      );
      fs.writeFileSync(
        `test-results/manual-3d-${engine}-preview-surface.png`,
        Buffer.from(previewPng.split(',')[1], 'base64'),
      );
      await page.screenshot({
        path: `test-results/manual-3d-${engine}-before-save.png`,
        fullPage: true,
      });

      await page.getByTestId('art-piece-editor-save-version').click();
      await expect(page.getByTestId('art-piece-editor-version-list')).toContainText('Version 2');
      await page.screenshot({
        path: `test-results/manual-3d-${engine}-after-save.png`,
        fullPage: true,
      });

      const versionsResponse = await apiGet(
        context,
        `/api/art-pieces/${piece.public_id}/versions/`,
      );
      expect(versionsResponse.ok()).toBe(true);
      const versions = (await versionsResponse.json()) as Array<{
        sequence: number;
        source: string;
      }>;
      expect(versions).toHaveLength(2);
      expect(versions.find((version) => version.sequence === 2)?.source).toContain(
        engine === 'threejs' ? 'EdgesGeometry' : 'wireframe',
      );

      const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
        status: 'published',
      });
      expect(published.status()).toBe(200);
      await page.goto(`/users/@${profile.handle}/pieces/${slug}`);
      await expect(page.getByRole('heading', { name: `Manual ${engine} fixture` })).toBeVisible();
      const downloadMenu = page.getByRole('button', { name: 'Open download menu' });
      await downloadMenu.click();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: 'Download Full ZIP' }).click();
      const download = await downloadPromise;
      const zip = await JSZip.loadAsync(fs.readFileSync((await download.path())!));
      const bundleText = await Promise.all(
        Object.values(zip.files)
          .filter((entry) => !entry.dir)
          .map((entry) => entry.async('string')),
      );
      expect(bundleText.join('\n')).toContain(engine === 'threejs' ? 'EdgesGeometry' : 'wireframe');
      await page.goto(`/users/@${profile.handle}/immersive/${slug}`);
      await expect(page.getByRole('heading', { name: `Manual ${engine} fixture` })).toBeVisible();
    }
  });
});
