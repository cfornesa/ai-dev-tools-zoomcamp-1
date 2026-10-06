import { expect, test } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { expandGeneratedArtEditorTools } from './support/expandCollapsibleSections.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const SOURCES = {
  threejs:
    "const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4; camera.lookAt(0, 0, 0); const renderer = new THREE.WebGLRenderer(); renderer.setSize(320, 240); document.getElementById('art-piece-container').appendChild(renderer.domElement); scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x2a9d8f }))); renderer.render(scene, camera);",
  aframe:
    '<a-scene embedded><a-box position="0 1 -4" rotation="0 30 0" color="#2a9d8f"></a-box><a-camera position="0 1.6 0"></a-camera></a-scene>',
} as const;

test.describe('3D AI editor engine modes (#620)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('preserves authored Three.js and A-Frame editor identity through revision/save', async ({
    browser,
  }, testInfo) => {
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
        const piece = (await created.json()) as { public_id: string };
        await testInfo.attach(`piece-${engine}-${viewport.width}`, {
          body: JSON.stringify({ public_id: piece.public_id, public_slug: slug }, null, 2),
          contentType: 'application/json',
        });

        await page.goto(`/users/@${profile.handle}/edit/${slug}`);
        await expect(page.getByTestId('art-piece-editor-mode')).toHaveText(
          new RegExp(`3D AI editor.*${engine === 'threejs' ? 'Three.js' : 'A-Frame'}`),
        );
        await expect(page.locator('[data-editor-family="3d"]')).toHaveAttribute(
          'data-editor-engine',
          engine,
        );
        await expect(page.getByTestId('art-piece-editor-source-only')).toHaveCount(0);
        await expect(page.getByTestId('art-piece-editor-tool-add-shape')).toBeEnabled();
        await expect(page.getByTestId('art-piece-editor-tool-transform')).toBeEnabled();
        await expect(page.getByTestId('art-piece-editor-tool-ai-edit')).toBeEnabled();
        await expect(page.getByRole('button', { name: 'Export piece package' })).toBeEnabled();
        await page.getByRole('button', { name: 'Toggle thumbnail panel' }).click();
        await expect(page.getByRole('heading', { name: 'Current version' })).toBeVisible();
        await expect(page.getByTestId('art-piece-editor-regenerate-thumbnail')).toBeEnabled();
        await page.getByRole('button', { name: 'Toggle thumbnail panel' }).click();
        await page.getByText('Sound', { exact: true }).click();
        await expect(page.getByRole('button', { name: 'Save sound defaults' })).toBeEnabled();
        await page.getByText('Sound', { exact: true }).click();
        await expect(page.getByRole('group', { name: 'Publication status' })).toBeVisible();
        await page.getByRole('button', { name: 'Published', exact: true }).click();
        const publishDialog = page.getByRole('alertdialog', { name: /Publish/ });
        await expect(publishDialog).toBeVisible();
        await publishDialog.getByRole('button', { name: 'Publish', exact: true }).click();
        await expect(page.getByTestId('art-piece-editor-publication-status')).toContainText(
          'Published (public)',
        );
        await page.getByRole('button', { name: 'Draft', exact: true }).click();
        await expect(page.getByTestId('art-piece-editor-publication-status')).toContainText(
          'Draft (private)',
        );
        await page.screenshot({
          path: testInfo.outputPath(`generated-3d-editor-${engine}-${viewport.width}.png`),
          fullPage: true,
        });
        await page.getByTestId('art-piece-editor-edit-source').click();
        await expect(page.getByTestId('art-piece-editor-code-panel')).toBeVisible();
        await expect(page.getByTestId('art-piece-editor-save-version')).toBeEnabled({
          timeout: 15_000,
        });
        const sourceEdit =
          engine === 'aframe'
            ? `${SOURCES[engine]}\n<!-- manual source parity edit -->`
            : `${SOURCES[engine]}\n// manual source parity edit`;
        await page.getByLabel('Editable source preview').fill(sourceEdit);
        await page.getByTestId('art-piece-editor-save-version').click();
        await expect(page.getByTestId('art-piece-editor-version-list')).toContainText('Version 2');

        await expandGeneratedArtEditorTools(page);
        await page.getByTestId('art-piece-editor-tool-ai-edit').click();
        await page.screenshot({
          path: `test-results/editor-tool-matrix-${engine}-${viewport.width}.png`,
          fullPage: true,
        });
        await page
          .getByLabel('Describe the revision you want to generate')
          .fill('add a second form');
        await page.getByRole('button', { name: 'Refine piece' }).click();
        await expect(page.getByTestId('art-piece-refine-accepted')).toBeVisible({
          timeout: 30_000,
        });
        const preview = page.frameLocator('iframe[title="Art piece revision preview"]');
        // Three.js owns a renderer canvas directly; A-Frame owns the scene
        // element and may create its renderer canvas asynchronously in a
        // headless browser. Assert each engine's stable runtime surface.
        await expect(preview.locator(engine === 'threejs' ? 'canvas' : 'a-scene')).toBeVisible();
        await expect(page.getByTestId('art-piece-editor-version-list')).toContainText('Version 3');
        await context.close();
      }
    }
  });
});
