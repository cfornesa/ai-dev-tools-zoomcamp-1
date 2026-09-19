import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const fixtures = [
  {
    engine: 'svg',
    source:
      '<svg id="immersive-reference-svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#172554"/><circle cx="160" cy="120" r="64" fill="#fbbf24"/></svg>',
    selector: '#immersive-reference-svg',
  },
  {
    engine: 'p5js',
    source:
      'window.sketch = (p) => { p.setup = () => { p.createCanvas(320, 240); }; p.draw = () => { p.background(17, 24, 39); p.fill(251, 191, 36); p.circle(160, 120, 120); }; };',
    selector: 'canvas',
  },
  {
    engine: 'c2js',
    source:
      "window.sketch = ({ canvas, startFrame }) => { const context = canvas.getContext('2d'); startFrame(() => { context.fillStyle = '#111827'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#22d3ee'; context.fillRect(120, 80, 80, 80); }); };",
    selector: '#c2-canvas',
  },
  {
    engine: 'c2js-interactive',
    source:
      "window.sketch = ({ canvas, startFrame }) => { canvas.addEventListener('pointermove', (event) => { canvas.dataset.pointerX = String(event.offsetX); }); const context = canvas.getContext('2d'); startFrame(() => { context.fillStyle = '#1f2937'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#fb7185'; context.fillRect(Number(canvas.dataset.pointerX || 160) - 40, 80, 80, 80); }); };",
    selector: '#c2-canvas',
  },
  {
    engine: 'threejs',
    source:
      "const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4; const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(320, 240); document.getElementById('art-piece-container').appendChild(renderer.domElement); scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }))); renderer.render(scene, camera);",
    selector: '#art-piece-container canvas',
  },
  {
    engine: 'aframe',
    source:
      '<a-scene embedded><a-box position="0 1 -4" color="#f472b6"></a-box><a-camera position="0 1.6 0"></a-camera></a-scene>',
    selector: 'a-scene',
  },
] as const;

test.describe('Six-engine immersive canonical viewer (#608)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('renders every engine through the immersive slug route at both fixed viewports', async ({
    page,
    context,
  }) => {
    const runId = Date.now().toString(36);
    const handle = `e2e-immersive-${runId}`;
    await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);
    const profileResponse = await apiGet(context, '/api/account/profile/');
    expect(profileResponse.ok()).toBe(true);
    const profile = (await profileResponse.json()) as Record<string, unknown>;
    const updatedProfile = await apiPatch(context, '/api/account/profile/', {
      ...profile,
      handle,
      display_name: 'Immersive Six Engine Fixture',
      is_public: true,
    });
    expect(updatedProfile.ok()).toBe(true);

    for (const fixture of fixtures) {
      const slug = `${runId}-${fixture.engine}`;
      const response = await apiPost(context, '/api/art-pieces/', {
        title: `Immersive Six Engine ${fixture.engine}`,
        description: `Deterministic immersive ${fixture.engine} fixture.`,
        prompt: `An immersive ${fixture.engine} fixture`,
        engine: fixture.engine,
        public_slug: slug,
        capabilities: { screenshot: true, fullscreen: true, immersive: true },
        source: fixture.source,
      });
      expect(response.status()).toBe(201);
      const piece = (await response.json()) as { public_id: string };
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
        await page.goto(`/users/@${handle}/immersive/${runId}-${fixture.engine}`);
        await expect(
          page.getByRole('heading', { name: `Immersive Six Engine ${fixture.engine}` }),
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Close immersive view' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Back to regular viewer' })).toBeVisible();
        const frame = page.frameLocator('iframe[title="Immersive art piece preview"]');
        await expect(frame.locator(fixture.selector)).toBeVisible({ timeout: 15_000 });
        await page.locator('[aria-label="Immersive stage"]').focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('[aria-label="Immersive stage"]')).toBeVisible();
      }
    }
  });
});
