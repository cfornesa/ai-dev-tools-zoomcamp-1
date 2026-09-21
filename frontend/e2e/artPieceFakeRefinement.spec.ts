import { expect, test } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const FIXTURES = {
  canvas2d: {
    source:
      '<canvas id="art-piece-canvas" width="800" height="600"></canvas><script>const c=document.getElementById(\'art-piece-canvas\');const ctx=c.getContext(\'2d\');ctx.fillStyle=\'teal\';ctx.fillRect(0,0,800,600);</script>',
    expected: '#e76f51',
  },
  svg: {
    source:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="teal" /></svg>',
    expected: '#e76f51',
  },
  p5js: {
    source:
      'window.sketch = function (p) { p.setup = function () { p.createCanvas(800, 600); }; p.draw = function () { p.background(42, 157, 143); p.circle(400, 300, 180); }; };',
    expected: '231, 111, 81',
  },
  c2js: {
    source:
      "window.sketch = function (runtime) { var ctx = runtime.canvas.getContext('2d'); runtime.startFrame(function () { ctx.fillStyle = '#2a9d8f'; ctx.fillRect(0, 0, 1280, 720); }); };",
    expected: '#e76f51',
  },
  'c2js-interactive': {
    source:
      "window.sketch = function (runtime) { var ctx = runtime.canvas.getContext('2d'); runtime.canvas.addEventListener('pointermove', function () {}); runtime.startFrame(function () { ctx.fillStyle = '#2a9d8f'; ctx.fillRect(0, 0, 1280, 720); }); };",
    expected: '#e76f51',
  },
  threejs: {
    source:
      "var scene = new THREE.Scene(); var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100); camera.position.set(0, 0, 5); var renderer = new THREE.WebGLRenderer(); var container = document.getElementById('art-piece-container'); renderer.setSize(container.clientWidth || 320, container.clientHeight || 240); container.appendChild(renderer.domElement); var material = new THREE.MeshBasicMaterial({ color: 0x2a9d8f }); var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material); scene.add(mesh); renderer.render(scene, camera);",
    expected: '0xe76f51',
  },
  aframe: {
    source:
      '<a-scene><a-box position="0 1 -3" rotation="0 45 0" color="#2a9d8f"></a-box><a-camera></a-camera></a-scene>',
    expected: '#e76f51',
  },
} as const;

test.describe('fake-provider generated-piece refinement (#698)', () => {
  const fixtures = requireE2EFixtures();

  test('accepts an observable AI refinement for every supported engine', async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const profileResponse = await apiGet(context, '/api/account/profile/');
    expect(profileResponse.ok()).toBe(true);
    const profile = (await profileResponse.json()) as { handle: string };

    for (const [engine, fixture] of Object.entries(FIXTURES)) {
      const slug = `fake-refine-${engine}-${Date.now().toString(36)}`;
      const created = await apiPost(context, '/api/art-pieces/', {
        title: `Fake refinement ${engine}`,
        description: 'Deterministic fake-provider refinement fixture.',
        prompt: `A ${engine} fake-provider fixture`,
        engine,
        public_slug: slug,
        capabilities: { screenshot: true, download: true, immersive: true },
        source: fixture.source,
      });
      expect(created.status()).toBe(201);
      const piece = (await created.json()) as { public_id: string };

      await page.goto(`/users/@${profile.handle}/edit/${slug}`);
      await expect(
        page.getByRole('heading', { name: `Edit Fake refinement ${engine}` }),
      ).toBeVisible();
      await page
        .getByLabel('Describe the revision you want to generate')
        .fill('make the accent warmer');
      await page.getByRole('button', { name: 'Refine piece' }).click();
      await expect(page.getByTestId('art-piece-refine-accepted')).toBeVisible();
      await expect(page.getByTestId('art-piece-editor-version-list')).toContainText('Version 2');
      await expect(page.getByTestId('art-piece-editor-version-list')).toContainText('(current)');
      await expect(page.getByTestId('art-piece-editor-preview')).toBeVisible();
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
        fixture.expected,
      );
    }
  });
});
