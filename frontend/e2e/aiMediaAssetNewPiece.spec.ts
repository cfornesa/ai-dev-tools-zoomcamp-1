/** Issue #924: a freshly created 2D project can target an imported library
 * image in the agent workflow, review the candidate, and accept one new
 * image layer without sending the local blob to Django. */
import { expect, test, type TestInfo } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { setAIScenario } from './support/aiScenario.js';
import { loginViaUI } from './support/auth.js';
import { openEditScene } from './support/openEditScene.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

// A deterministic visible SVG keeps the resolver/pixel assertion meaningful
// while remaining a deterministic in-repo fixture.
const VISIBLE_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="#f59e0b"/><circle cx="12" cy="12" r="6" fill="#fde68a"/></svg>',
);

type ProjectDetail = {
  current_version: number;
};

type SceneVersion = {
  sequence: number;
  scene_json: {
    shapes?: Array<Record<string, unknown>>;
    layers?: Array<Record<string, unknown>>;
  };
};

test.describe('AI media asset on a new piece (#924)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`imports, previews, and accepts one asset layer at ${viewport.width}px`, async ({
      page,
    }, testInfo: TestInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);

      const created = await apiPost(page.context(), '/api/projects/blank/', {
        renderer: 'canvas2d',
      });
      expect(created.status()).toBe(201);
      const { id: projectId } = (await created.json()) as { id: string };
      expect(projectId).toBeTruthy();

      await page.goto(`/ai-projects/${projectId}`);
      await openEditScene(page);
      const stage = page.locator('.piece-stage-shell');

      await page.getByRole('button', { name: 'File' }).click();
      await page
        .getByRole('menu', { name: 'File menu' })
        .getByRole('menuitem', {
          name: 'Import media',
        })
        .click();
      await page.locator('input[aria-label="Import media file"]').setInputFiles({
        name: 'fixture-sun.svg',
        mimeType: 'image/svg+xml',
        buffer: VISIBLE_SVG,
      });

      const importDialog = page.getByRole('dialog', { name: 'Describe this media' });
      await expect(importDialog).toBeVisible();
      await importDialog.getByLabel('Descriptive label').fill('Fixture sun');
      await importDialog.getByRole('button', { name: 'Import media' }).click();

      const library = page.getByRole('region', { name: 'Project media library' });
      await expect(library).toBeVisible();
      const asset = library.getByRole('listitem').filter({ hasText: 'fixture-sun.svg' });
      await expect(asset).toBeVisible();
      const assetThumbnail = asset.getByRole('img');
      await expect(assetThumbnail).toBeVisible();
      await expect
        .poll(async () =>
          assetThumbnail.evaluate((image) => (image as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      await library.getByRole('button', { name: 'Close media library' }).click();

      await page.getByRole('button', { name: 'Ask AI to improve this scene' }).click();
      const layersTab = page.getByRole('tab', { name: 'Layers' });
      if (await layersTab.isVisible()) await layersTab.click();
      const expandTools = page.getByRole('button', { name: 'Expand Tools panel' });
      if (await expandTools.isVisible()) await expandTools.click();

      const assistant = page.getByRole('heading', { name: 'AI assistant' }).locator('..');
      await assistant.getByRole('radio', { name: 'Agent workflow' }).click();
      await assistant.getByRole('radio', { name: 'Add media asset' }).click();
      await assistant.getByLabel('Media asset').selectOption({ label: 'fixture-sun.svg' });
      await assistant
        .getByLabel('Describe the change you want to make')
        .fill('Add @fixture-sun.svg and do not reference any un-imported asset named missing.png.');
      await setAIScenario(page, 'add-asset-layer');
      await assistant.getByTestId('ai-run-start').click();
      await expect(assistant.getByTestId('ai-run-plan-review')).toBeVisible({ timeout: 20_000 });
      await assistant.getByTestId('ai-run-approve-plan').click();
      await expect(assistant.getByTestId('ai-run-preview')).toBeVisible({ timeout: 20_000 });
      await expect(assistant.getByTestId('ai-run-preview-canvas')).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`new-asset-candidate-${viewport.width}.png`),
        fullPage: true,
      });

      const before = (await (
        await apiGet(page.context(), `/api/projects/${projectId}/`)
      ).json()) as ProjectDetail;
      await assistant.getByTestId('ai-run-accept').click();
      await expect(assistant.getByTestId('ai-run-status')).toHaveText('Accepted.');

      const after = (await (
        await apiGet(page.context(), `/api/projects/${projectId}/`)
      ).json()) as ProjectDetail;
      const saved = (await (
        await apiGet(
          page.context(),
          `/api/projects/${projectId}/versions/${after.current_version}/`,
        )
      ).json()) as SceneVersion;
      const previous = (await (
        await apiGet(
          page.context(),
          `/api/projects/${projectId}/versions/${before.current_version}/`,
        )
      ).json()) as SceneVersion;

      expect(saved.sequence).toBe(2);
      expect(after.current_version).not.toBe(before.current_version);
      const addedImages = (saved.scene_json.shapes ?? []).filter(
        (shape) => shape.type === 'image' && shape.mediaAssetId,
      );
      expect(addedImages).toHaveLength(1);
      expect(addedImages[0]?.mediaAssetId).toBeTruthy();
      expect(addedImages[0]?.mediaAssetId).not.toBe('missing.png');
      expect(saved.scene_json.layers).toHaveLength((previous.scene_json.layers ?? []).length + 1);

      const canvas = stage.locator('canvas').last();
      await expect(canvas).toBeVisible();
      // The renderer resolves the browser-local Blob asynchronously and
      // redraws the canvas from its image cache when decoding completes.
      await page.waitForTimeout(500);
      const imagePixels = await canvas.evaluate((element) => {
        const context = (element as HTMLCanvasElement).getContext('2d');
        if (!context) return 0;
        const { width, height } = element as HTMLCanvasElement;
        const pixels = context.getImageData(0, 0, width, height).data;
        let matches = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index] > 200 && pixels[index + 1] > 100 && pixels[index + 2] < 200) {
            matches += 1;
          }
        }
        return matches;
      });
      expect(imagePixels).toBeGreaterThan(0);
      await page.screenshot({
        path: testInfo.outputPath(`new-asset-accepted-${viewport.width}.png`),
        fullPage: true,
      });
    });
  }
});
