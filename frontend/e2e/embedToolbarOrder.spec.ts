import { expect, test } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const C2_INTERACTIVE =
  "window.sketch = ({ canvas, startFrame }) => { const context = canvas.getContext('2d'); " +
  "startFrame(() => { context.fillStyle = '#1f2937'; context.fillRect(0, 0, canvas.width, canvas.height); }); };";
const THREE =
  'const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.position.z = 4; ' +
  'const renderer = new THREE.WebGLRenderer(); renderer.setSize(320, 240); ' +
  "document.getElementById('art-piece-container').appendChild(renderer.domElement); " +
  'renderer.render(scene, camera);';

// Owner order 2026-09-24 (docs/piece-toolbar-parity-matrix.md): Fullscreen LAST in the icon row.
const EXPECTED = [
  'Take screenshot',
  'Open download menu',
  'View immersive piece',
  'Expand piece to fullscreen',
];

test.describe('Embed toolbar order and placement (#752)', () => {
  const fixtures = requireE2EFixtures();

  test('/embed/art-pieces/:id shows the icon row in matrix order with Fullscreen last', async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(120_000);
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    for (const [engine, source] of [
      ['c2js-interactive', C2_INTERACTIVE],
      ['threejs', THREE],
    ] as const) {
      const created = await apiPost(context, '/api/art-pieces/', {
        title: `Embed order ${engine}`,
        description: 'Embed toolbar order fixture.',
        prompt: `A ${engine} fixture`,
        engine,
        public_slug: `embed-order-${engine}-${Date.now().toString(36)}`,
        capabilities: { screenshot: true, fullscreen: true, download: true, immersive: true },
        source,
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
        await page.goto(`/embed/art-pieces/${piece.public_id}`);
        const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
        await expect(toolbar).toBeVisible();
        const group = toolbar.locator('.piece-stage-toolbar-group');
        const labels = await group.evaluate((element) =>
          Array.from(element.querySelectorAll(':scope > button, :scope > a, :scope > div > button'))
            .filter((node) => !node.closest('[data-piece-stage-download-menu]'))
            .map((node) => node.getAttribute('aria-label') ?? ''),
        );
        expect(labels).toEqual(EXPECTED);

        const boxes = await group.evaluate((element) =>
          Array.from(element.querySelectorAll(':scope > button, :scope > a, :scope > div > button'))
            .filter((node) => !node.closest('[data-piece-stage-download-menu]'))
            .map((node) => {
              const box = node.getBoundingClientRect();
              return { width: box.width, height: box.height, right: box.right };
            }),
        );
        for (const box of boxes) {
          expect(box.width).toBeGreaterThanOrEqual(43);
          expect(box.height).toBeGreaterThanOrEqual(39);
          expect(box.right).toBeLessThanOrEqual(viewport.width);
        }

        if (engine === 'c2js-interactive') {
          const rows = await page.evaluate(() => {
            const names = ['Clear visitor drawing', 'Undo visitor drawing', 'Redo visitor drawing'];
            return names.map((name) => {
              const button = document.querySelector(`[aria-label="${name}"]`)!;
              return Math.round(button.getBoundingClientRect().top);
            });
          });
          if (viewport.width >= 1280) {
            // Clear, Undo and Redo share one row (no orphaned Redo).
            expect(new Set(rows).size).toBe(1);
          }
          await expect(page.locator('.piece-stage-tools-row')).toBeVisible();
        }
        await page.screenshot({
          path: testInfo.outputPath(`embed-${engine}-${viewport.width}.png`),
        });
      }
    }
  });
});
