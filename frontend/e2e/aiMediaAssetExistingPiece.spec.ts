/** Issue #925: an imported local asset can be added to an existing saved
 * piece without mutating its existing layers, and the prior version restores
 * exactly. */
import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';

import { apiGet, apiPost } from './support/api.js';
import { setAIScenario } from './support/aiScenario.js';
import { loginViaUI } from './support/auth.js';
import { openEditScene } from './support/openEditScene.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;
type JsonObject = Record<string, unknown>;

const EXISTING_SCENE = JSON.parse(
  readFileSync(
    new URL('../../schema/fixtures/valid/ai_layer_target_existing.json', import.meta.url),
    'utf8',
  ),
) as JsonObject;

const VISIBLE_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="#f59e0b"/><circle cx="12" cy="12" r="6" fill="#fde68a"/></svg>',
);

async function canvasPixel(page: Page, x: number, y: number): Promise<number[]> {
  return page
    .locator('canvas')
    .first()
    .evaluate(
      (element, point) => {
        const context = (element as HTMLCanvasElement).getContext('2d');
        if (!context) throw new Error('Scene canvas has no 2D context');
        return Array.from(context.getImageData(point.x, point.y, 1, 1).data.slice(0, 3));
      },
      { x, y },
    );
}

async function createExistingPiece(context: BrowserContext): Promise<{
  id: string;
  before: JsonObject;
  beforeVersionId: number;
  beforeSequence: number;
}> {
  const created = await apiPost(context, '/api/projects/blank/', { renderer: 'canvas2d' });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const saved = await apiPost(context, `/api/projects/${id}/versions/`, {
    scene_json: EXISTING_SCENE,
    origin: 'manual',
    change_label: 'AI existing media fixture',
  });
  expect(saved.status()).toBe(201);
  const savedBody = (await saved.json()) as { id: number };
  const project = (await (await apiGet(context, `/api/projects/${id}/`)).json()) as {
    current_version: number;
  };
  const version = (await (
    await apiGet(context, `/api/projects/${id}/versions/${project.current_version}/`)
  ).json()) as { sequence: number; scene_json: JsonObject };
  return {
    id,
    before: version.scene_json,
    beforeVersionId: savedBody.id,
    beforeSequence: version.sequence,
  };
}

test.describe('AI media asset on an existing piece (#925)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`preserves existing layers while adding an asset at ${viewport.width}px`, async ({
      page,
      context,
    }, testInfo: TestInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const { id, before, beforeVersionId, beforeSequence } = await createExistingPiece(context);

      await page.goto(`/ai-projects/${id}`);
      await openEditScene(page);
      const stage = page.locator('.piece-stage-shell');
      await page.getByRole('button', { name: 'File' }).click();
      await page
        .getByRole('menu', { name: 'File menu' })
        .getByRole('menuitem', { name: 'Import media' })
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
      const asset = library.getByRole('listitem').filter({ hasText: 'fixture-sun.svg' });
      await expect(asset.getByRole('img')).toBeVisible();
      await expect
        .poll(async () =>
          asset.getByRole('img').evaluate((image) => (image as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      await library.getByRole('button', { name: 'Close media library' }).click();

      const beforeSky = await canvasPixel(page, 200, 100);
      const beforeHills = await canvasPixel(page, 100, 500);
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
        .fill('Add @fixture-sun.svg without changing @Hills.');
      await setAIScenario(page, 'add-asset-layer');
      await assistant.getByTestId('ai-run-start').click();
      await expect(assistant.getByTestId('ai-run-plan-review')).toBeVisible({ timeout: 20_000 });
      await assistant.getByTestId('ai-run-approve-plan').click();
      await expect(assistant.getByTestId('ai-run-preview')).toBeVisible({ timeout: 20_000 });
      await page.screenshot({
        path: testInfo.outputPath(`existing-asset-candidate-${viewport.width}.png`),
        fullPage: true,
      });
      await assistant.getByTestId('ai-run-accept').click();
      await expect(assistant.getByTestId('ai-run-status')).toHaveText('Accepted.');

      const project = (await (await apiGet(context, `/api/projects/${id}/`)).json()) as {
        current_version: number;
      };
      const current = (await (
        await apiGet(context, `/api/projects/${id}/versions/${project.current_version}/`)
      ).json()) as { sequence: number; scene_json: JsonObject };
      const beforeLayers = (before.layers ?? []) as JsonObject[];
      const currentLayers = (current.scene_json.layers ?? []) as JsonObject[];
      expect(current.sequence).toBe(beforeSequence + 1);
      expect(currentLayers.slice(0, beforeLayers.length)).toEqual(beforeLayers);
      expect(currentLayers).toHaveLength(beforeLayers.length + 1);
      const addedImages = ((current.scene_json.shapes ?? []) as JsonObject[]).filter(
        (shape) => shape.type === 'image' && shape.mediaAssetId,
      );
      expect(addedImages).toHaveLength(1);
      expect(addedImages[0]?.mediaAssetId).not.toBe('missing.png');
      await page.waitForTimeout(500);
      expect(await canvasPixel(page, 200, 100)).toEqual(beforeSky);
      expect(await canvasPixel(page, 100, 500)).toEqual(beforeHills);
      const imagePixels = await stage
        .locator('canvas')
        .last()
        .evaluate((element) => {
          const context = (element as HTMLCanvasElement).getContext('2d');
          if (!context) return 0;
          const canvas = element as HTMLCanvasElement;
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
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
        path: testInfo.outputPath(`existing-asset-accepted-${viewport.width}.png`),
        fullPage: true,
      });

      const restored = await apiPost(
        context,
        `/api/projects/${id}/versions/${beforeVersionId}/restore/`,
        {},
      );
      expect(restored.status()).toBe(201);
      const restoredBody = (await restored.json()) as { scene_json: JsonObject };
      expect(restoredBody.scene_json).toEqual(before);
      await page.screenshot({
        path: testInfo.outputPath(`existing-asset-restored-${viewport.width}.png`),
        fullPage: true,
      });
    });
  }
});
