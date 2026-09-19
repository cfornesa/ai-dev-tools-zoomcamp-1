import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const fixtures = [
  {
    engine: 'svg',
    source:
      '<svg id="reference-svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#172554"/><circle cx="160" cy="120" r="64" fill="#fbbf24"/></svg>',
    selector: '#reference-svg',
    immersive: true,
  },
  {
    engine: 'p5js',
    source:
      'window.sketch = (p) => { p.setup = () => { p.createCanvas(320, 240); }; p.draw = () => { p.background(17, 24, 39); p.fill(251, 191, 36); p.circle(160, 120, 120); }; };',
    selector: 'canvas',
    immersive: false,
  },
  {
    engine: 'c2js',
    source:
      "window.sketch = ({ canvas, startFrame }) => { const context = canvas.getContext('2d'); startFrame(() => { context.fillStyle = '#111827'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#22d3ee'; context.fillRect(120, 80, 80, 80); }); };",
    selector: '#c2-canvas',
    immersive: false,
  },
  {
    engine: 'c2js-interactive',
    source:
      "window.sketch = ({ canvas, startFrame }) => { canvas.addEventListener('pointermove', (event) => { canvas.dataset.pointerX = String(event.offsetX); }); const context = canvas.getContext('2d'); startFrame(() => { context.fillStyle = '#1f2937'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#fb7185'; context.fillRect(Number(canvas.dataset.pointerX || 160) - 40, 80, 80, 80); }); };",
    selector: '#c2-canvas',
    immersive: false,
  },
  {
    engine: 'threejs',
    source:
      "const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4; const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(320, 240); document.getElementById('art-piece-container').appendChild(renderer.domElement); scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }))); renderer.render(scene, camera);",
    selector: '#art-piece-container canvas',
    immersive: true,
  },
  {
    engine: 'aframe',
    source:
      '<a-scene embedded><a-box position="0 1 -4" color="#f472b6"></a-box><a-camera position="0 1.6 0"></a-camera></a-scene>',
    selector: 'a-scene',
    immersive: true,
  },
] as const;

test.describe('Six-engine regular canonical viewer (#607)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('renders every engine through the slug route at both fixed viewports', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);
    const profileResponse = await apiGet(context, '/api/account/profile/');
    expect(profileResponse.ok()).toBe(true);
    const profile = (await profileResponse.json()) as Record<string, unknown>;
    const updatedProfile = await apiPatch(context, '/api/account/profile/', {
      ...profile,
      handle: 'e2e-six-engine',
      display_name: 'Six Engine Fixture',
      is_public: true,
    });
    expect(updatedProfile.ok()).toBe(true);

    const created: Array<{ slug: string; immersive: boolean }> = [];
    for (const fixture of fixtures) {
      const slug = `six-engine-${fixture.engine}`;
      const response = await apiPost(context, '/api/art-pieces/', {
        title: `Six Engine ${fixture.engine}`,
        description: `Published ${fixture.engine} regular-view fixture.`,
        prompt: `A deterministic ${fixture.engine} fixture`,
        engine: fixture.engine,
        public_slug: slug,
        capabilities: {
          screenshot: true,
          fullscreen: true,
          immersive: fixture.immersive,
        },
        source: fixture.source,
      });
      expect(response.status()).toBe(201);
      const piece = (await response.json()) as { public_id: string };
      const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
        status: 'published',
      });
      expect(published.status()).toBe(200);
      created.push({ slug, immersive: fixture.immersive });
    }

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      for (const fixture of fixtures) {
        const slug = `six-engine-${fixture.engine}`;
        await page.goto(`/users/@e2e-six-engine/pieces/${slug}`);
        await expect(
          page.getByRole('heading', { name: `Six Engine ${fixture.engine}` }),
        ).toBeVisible();
        const frame = page.frameLocator('iframe[title="Art piece preview"]');
        await frame.locator(fixture.selector).waitFor({ state: 'attached', timeout: 10_000 });
        await expect(page.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Expand fullscreen' })).toBeVisible();
        if (fixture.immersive) {
          await expect(page.getByRole('link', { name: 'View immersive piece' })).toBeVisible();
        } else {
          await expect(page.getByRole('link', { name: 'View immersive piece' })).toHaveCount(0);
        }
      }
    }

    expect(created).toHaveLength(fixtures.length);
  });
});
