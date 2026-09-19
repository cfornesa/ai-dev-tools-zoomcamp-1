import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const fixtures = [
  {
    engine: 'svg',
    source:
      '<svg id="embed-svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#172554"/><circle cx="160" cy="120" r="64" fill="#fbbf24"/></svg>',
    selector: '#embed-svg',
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
    selector: 'canvas.a-canvas',
  },
] as const;

test.describe('Six-engine chrome-less embeds (#615)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('renders each engine in the shared embed runtime at both viewports', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(90_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);
    const profileResponse = await apiGet(context, '/api/account/profile/');
    expect(profileResponse.ok()).toBe(true);
    const profile = (await profileResponse.json()) as { handle: string };
    const runId = Date.now().toString(36);

    const pieces = new Map<string, string>();
    for (const fixture of fixtures) {
      const created = await apiPost(context, '/api/art-pieces/', {
        title: `Six-engine embed ${fixture.engine}`,
        description: 'Chrome-less embed fixture.',
        prompt: `Embed ${fixture.engine}`,
        engine: fixture.engine,
        public_slug: `embed-${runId}-${fixture.engine}`,
        capabilities: {
          screenshot: true,
          fullscreen: true,
          download: true,
          immersive: true,
        },
        source: fixture.source,
      });
      expect(created.status()).toBe(201);
      const piece = (await created.json()) as { public_id: string };
      const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
        status: 'published',
      });
      expect(published.status()).toBe(200);
      pieces.set(fixture.engine, piece.public_id);
    }

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      for (const fixture of fixtures) {
        await page.goto(`/embed/art-pieces/${pieces.get(fixture.engine)}`);
        await expect(page.getByRole('banner')).toHaveCount(0);
        await expect(page.locator('iframe[title="Art piece preview"]')).toBeVisible();
        const embed = page.frameLocator('iframe[title="Art piece preview"]');
        await expect(embed.locator(fixture.selector)).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole('button', { name: 'Piece controls' })).toBeVisible();
        await page.getByRole('button', { name: 'Piece controls' }).click();
        await expect(page.getByRole('button', { name: 'Fullscreen' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Enable camera view' })).toHaveCount(0);
        if (fixture.engine === 'c2js-interactive') {
          await embed.locator('#c2-canvas').dispatchEvent('pointermove', {
            bubbles: true,
            clientX: 20,
            clientY: 20,
          });
          await expect(embed.locator('#c2-canvas')).toHaveAttribute('data-pointer-x', /\d+/);
        }
      }
      await page.screenshot({
        path: testInfo.outputPath(`embeds-${viewport.width}x${viewport.height}.png`),
      });
    }
    expect(profile.handle).toBeTruthy();
    await context.close();
  });
});
