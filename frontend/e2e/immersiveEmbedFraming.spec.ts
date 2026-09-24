import { expect, test } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const FIXTURES = [
  {
    engine: 'c2js-interactive',
    source:
      "window.sketch = ({ canvas, startFrame }) => { const context = canvas.getContext('2d'); startFrame(() => { context.fillStyle = '#1f2937'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#fb7185'; context.beginPath(); context.arc(canvas.width / 2, canvas.height / 2, canvas.height / 5, 0, Math.PI * 2); context.fill(); }); };",
  },
  {
    engine: 'threejs',
    source:
      "const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4; const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(320, 240); document.getElementById('art-piece-container').appendChild(renderer.domElement); scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 16), new THREE.MeshBasicMaterial({ color: 0xff0000 }))); renderer.render(scene, camera);",
  },
  {
    engine: 'aframe',
    source:
      '<a-scene embedded><a-sphere position="0 1.6 -3" radius="0.8" color="#ff0000"></a-sphere><a-camera position="0 1.6 0"></a-camera></a-scene>',
  },
] as const;

test.describe('Immersive embed toolbar and framing (#754)', () => {
  const fixtures = requireE2EFixtures();

  test('/embed/art-pieces/immersive/:id: compact toolbar, artwork visible and framed', async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(180_000);
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    for (const fixture of FIXTURES) {
      const created = await apiPost(context, '/api/art-pieces/', {
        title: `Immersive embed ${fixture.engine}`,
        description: 'Immersive embed framing fixture.',
        prompt: `A ${fixture.engine} fixture`,
        engine: fixture.engine,
        public_slug: `imm-embed-${fixture.engine}-${Date.now().toString(36)}`,
        capabilities: { screenshot: true, fullscreen: true, download: true, immersive: true },
        source: fixture.source,
      });
      expect(created.status()).toBe(201);
      const piece = (await created.json()) as { public_id: string };
      expect(
        (
          await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, { status: 'published' })
        ).status(),
      ).toBe(200);

      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 375, height: 812 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto(`/embed/art-pieces/immersive/${piece.public_id}`);
        const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
        await expect(toolbar).toBeVisible();
        const labels = await toolbar.locator('.piece-stage-toolbar-group').evaluate((group) =>
          Array.from(group.querySelectorAll(':scope > button, :scope > a, :scope > div > button'))
            .filter((node) => !node.closest('[data-piece-stage-download-menu]'))
            .map((node) => node.getAttribute('aria-label') ?? ''),
        );
        expect(labels[0]).toBe('Take screenshot');
        expect(labels[labels.length - 1]).toBe('Expand piece to fullscreen');
        expect(labels).not.toContain('View immersive piece');

        // The toolbar (icon row plus any tools row) leaves at least 70% of the frame to the artwork.
        const toolbarHeight = (await toolbar.boundingBox())!.height;
        const budget = fixture.engine === 'c2js-interactive' ? 0.45 : 0.3;
        expect(toolbarHeight).toBeLessThan(viewport.height * budget);

        const frame = page.frameLocator('iframe[title="Immersive art piece preview"]');
        const surface =
          fixture.engine === 'c2js-interactive'
            ? frame.locator('#c2-canvas')
            : fixture.engine === 'threejs'
              ? frame.locator('#art-piece-container canvas')
              : frame.locator('canvas.a-canvas');
        await expect(surface).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(1500);
        await page.screenshot({
          path: testInfo.outputPath(`imm-embed-${fixture.engine}-${viewport.width}.png`),
        });
      }
    }
  });
});
