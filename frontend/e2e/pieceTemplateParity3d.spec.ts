import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const fixtures = [
  {
    engine: 'threejs',
    source:
      "const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4; const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(320, 240); document.getElementById('art-piece-container').appendChild(renderer.domElement); scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }))); renderer.render(scene, camera);",
  },
  {
    engine: 'aframe',
    source:
      '<a-scene embedded><a-box position="0 1 -4" color="#f472b6"></a-box><a-camera position="0 1.6 0"></a-camera></a-scene>',
  },
] as const;

const onlineLabels = [
  'Take screenshot',
  'Open download menu',
  'View immersive piece',
  'Unmute sound',
  'Piece controls',
  'Show hand gesture guide',
  'Expand piece to fullscreen',
];

async function extractZip(zip: JSZip): Promise<string> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'piece-template-3d-'));
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, await entry.async('nodebuffer'));
  }
  return root;
}

test.describe('3D runtime template parity (#800)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('asserts online and Full ZIP controls for Three.js and A-Frame', async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);
    const profileResponse = await apiGet(context, '/api/account/profile/');
    expect(profileResponse.ok()).toBe(true);
    const profile = (await profileResponse.json()) as Record<string, unknown>;
    const handle = `e2e-template-3d-${Date.now().toString(36)}`;
    const updatedProfile = await apiPatch(context, '/api/account/profile/', {
      ...profile,
      handle,
      display_name: '3D Template Fixture',
      is_public: true,
    });
    expect(updatedProfile.ok()).toBe(true);

    for (const fixture of fixtures) {
      const created = await apiPost(context, '/api/art-pieces/', {
        title: `Template ${fixture.engine}`,
        description: `Template parity ${fixture.engine}.`,
        prompt: `A ${fixture.engine} template fixture`,
        engine: fixture.engine,
        public_slug: `template-${fixture.engine}`,
        capabilities: {
          screenshot: true,
          download: true,
          immersive: true,
          fullscreen: true,
          sound: true,
          keyboard: true,
          microphone: true,
          camera_view: true,
          hand_steering: true,
        },
        generation_metadata: { aspect_ratio: '4:3' },
        source: fixture.source,
      });
      expect(created.status()).toBe(201);
      const piece = (await created.json()) as { public_id: string };
      const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
        status: 'published',
      });
      expect(published.status()).toBe(200);
    }

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      for (const fixture of fixtures) {
        await page.goto(`/users/@${handle}/pieces/template-${fixture.engine}`);
        const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
        await expect(toolbar).toBeVisible();
        for (const label of onlineLabels)
          await expect(toolbar.getByRole('button', { name: label })).toBeVisible();
        const labels = await toolbar
          .locator('button:visible, a:visible')
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute('aria-label')).filter(Boolean),
          );
        expect(labels).toEqual(onlineLabels);
        await toolbar.getByRole('button', { name: 'Piece controls' }).click();
        await expect(page.getByRole('group', { name: 'Camera view' })).toBeVisible();
        await expect(page.getByRole('group', { name: 'Hand steering' })).toBeVisible();
        await page.screenshot({
          path: `test-results/template-3d-online-${fixture.engine}-${viewport.width}.png`,
          fullPage: true,
        });
        await toolbar.getByRole('button', { name: 'Piece controls' }).click();
      }
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    for (const fixture of fixtures) {
      const zipPage = await context.newPage();
      await zipPage.setViewportSize({ width: 1280, height: 900 });
      await zipPage.goto(`/users/@${handle}/pieces/template-${fixture.engine}`);
      const downloadPromise = zipPage.waitForEvent('download');
      await zipPage.getByRole('button', { name: 'Open download menu' }).click();
      await zipPage.getByRole('menuitem', { name: 'Download Full ZIP' }).click();
      const download = await downloadPromise;
      const zip = await JSZip.loadAsync(fs.readFileSync((await download.path())!));
      const root = await extractZip(zip);
      try {
        const index = await zip.files['index.html'].async('string');
        expect(index).toContain('id="piece-toolbar"');
        for (const label of [
          'Take screenshot',
          'Unmute sound',
          'Piece controls',
          'Show hand gesture guide',
          'Reset view',
          'Fullscreen',
        ]) {
          expect(index).toContain(`aria-label="${label}"`);
        }
        await zipPage.goto(`file://${path.join(root, 'index.html')}`);
        await expect(zipPage.locator('#piece-toolbar')).toBeVisible();
        await expect(zipPage.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
        await expect(
          zipPage.getByRole('button', { name: 'Fullscreen', exact: true }),
        ).toBeVisible();
        await zipPage.screenshot({
          path: `test-results/template-3d-zip-${fixture.engine}-1280.png`,
          fullPage: true,
        });
        await zipPage.setViewportSize({ width: 375, height: 812 });
        await zipPage.screenshot({
          path: `test-results/template-3d-zip-${fixture.engine}-375.png`,
          fullPage: true,
        });
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
        await zipPage.close();
      }
    }
  });
});
