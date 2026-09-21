import { expect, test, type TestInfo } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const SOURCES = {
  canvas2d:
    '<canvas id="art-piece-canvas" width="320" height="240"></canvas><script>var c=document.getElementById("art-piece-canvas");var x=c.getContext("2d");x.fillStyle="#172554";x.fillRect(0,0,320,240);</script>',
  threejs:
    "const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(60, 320/240, 0.1, 100); camera.position.z = 4; const renderer = new THREE.WebGLRenderer(); renderer.setSize(320, 240); document.getElementById('art-piece-container').appendChild(renderer.domElement); renderer.render(scene, camera);",
} as const;

const CANDIDATES = {
  canvas2d: (color: string) =>
    `<canvas id="art-piece-canvas" width="320" height="240"></canvas><script>var c=document.getElementById("art-piece-canvas");var x=c.getContext("2d");x.fillStyle="${color}";x.fillRect(0,0,320,240);</script>`,
  threejs: (color: string) =>
    `const scene = new THREE.Scene(); scene.background = new THREE.Color(0x111827); const camera = new THREE.PerspectiveCamera(60, 320/240, 0.1, 100); camera.position.z = 4; const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true }); renderer.setSize(320, 240); document.getElementById('art-piece-container').appendChild(renderer.domElement); scene.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshBasicMaterial({ color: ${color} }))); renderer.render(scene, camera);`,
} as const;

const INVALID_SOURCE =
  '<canvas id="art-piece-canvas" width="320" height="240"></canvas><script>const broken = ;</script>';

async function renderSignature(
  page: import('@playwright/test').Page,
  engine: keyof typeof SOURCES,
) {
  const preview = page.frameLocator('iframe[title="Art piece revision preview"]');
  return preview.locator('canvas').evaluate((element, expectedEngine) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (expectedEngine === 'canvas2d' && context) {
      const pixel = context.getImageData(
        Math.floor(canvas.width / 2),
        Math.floor(canvas.height / 2),
        1,
        1,
      ).data;
      return `${canvas.toDataURL('image/png')}:${Array.from(pixel.slice(0, 3)).join(',')}`;
    }
    return canvas.toDataURL('image/png');
  }, engine);
}

test.describe('Generated-piece live preview (#669)', () => {
  const fixtures = requireE2EFixtures();

  test('debounces source edits, keeps the latest frame, and preserves the last good frame on errors', async ({
    page,
    context,
  }, testInfo: TestInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const profile = (await (await apiGet(context, '/api/account/profile/')).json()) as {
      handle: string;
    };

    for (const engine of ['canvas2d', 'threejs'] as const) {
      const slug = `live-preview-${engine}-${Date.now().toString(36)}`;
      const created = await apiPost(context, '/api/art-pieces/', {
        title: `Live preview ${engine}`,
        description: 'Live preview fixture.',
        prompt: `Live preview ${engine}`,
        engine,
        public_slug: slug,
        source: SOURCES[engine],
      });
      expect(created.status()).toBe(201);

      await page.goto(`/users/@${profile.handle}/edit/${slug}`);
      await expect(
        page.getByRole('heading', { name: `Edit Live preview ${engine}` }),
      ).toBeVisible();
      await page
        .getByTestId(
          engine === 'canvas2d' ? 'art-piece-editor-tool-add-shape' : 'art-piece-editor-add-box',
        )
        .click();
      await expect(page.getByTestId('art-piece-editor-preview')).toBeVisible();
      await expect(page.locator('#art-piece-editor-code')).toBeVisible();

      const preview = page.frameLocator('iframe[title="Art piece revision preview"]');
      await expect(preview.locator('canvas')).toBeVisible();
      const initialFrame = await renderSignature(page, engine);

      const first = engine === 'canvas2d' ? '#ef4444' : '0xef4444';
      const second = engine === 'canvas2d' ? '#22c55e' : '0x22c55e';
      await page.locator('#art-piece-editor-code').fill(CANDIDATES[engine](first));
      await expect
        .poll(() => renderSignature(page, engine), { timeout: 1_500, intervals: [50] })
        .not.toBe(initialFrame);
      const firstFrame = await renderSignature(page, engine);
      await page.locator('#art-piece-editor-code').fill(CANDIDATES[engine](second));
      await expect
        .poll(() => renderSignature(page, engine), { timeout: 1_500, intervals: [50] })
        .not.toBe(firstFrame);
      const secondFrame = await renderSignature(page, engine);
      if (engine === 'canvas2d') expect(secondFrame).toContain(':34,197,94');
      else expect(secondFrame.length).toBeGreaterThan(1_000);
      const third = engine === 'canvas2d' ? '#3b82f6' : '0x3b82f6';
      await page.locator('#art-piece-editor-code').fill(CANDIDATES[engine](third));
      await expect
        .poll(() => renderSignature(page, engine), { timeout: 1_500, intervals: [50] })
        .not.toBe(secondFrame);

      const startedAt = Date.now();
      await page.locator('#art-piece-editor-code').fill(CANDIDATES[engine](first));
      await page.locator('#art-piece-editor-code').fill(CANDIDATES[engine](second));
      await expect
        .poll(() => renderSignature(page, engine), { timeout: 1_500, intervals: [50] })
        .toBe(secondFrame);
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(300);
      await page.screenshot({
        path: testInfo.outputPath(`live-preview-${engine}-good-frame.png`),
        fullPage: true,
      });

      await page.locator('#art-piece-editor-code').fill(INVALID_SOURCE);
      await expect(page.getByTestId('art-piece-editor-preview-error')).toBeVisible({
        timeout: 1_500,
      });
      await expect.poll(() => renderSignature(page, engine), { timeout: 1_000 }).toBe(secondFrame);
      await page.screenshot({
        path: testInfo.outputPath(`live-preview-${engine}-error-keeps-frame.png`),
        fullPage: true,
      });
    }
  });
});
