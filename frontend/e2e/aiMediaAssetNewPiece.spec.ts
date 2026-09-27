/** Issue #924: a freshly created 2D project can target an imported library
 * image in the agent workflow, review the candidate, and accept one new
 * image layer without sending the local blob to Django. */
import { expect, test, type TestInfo } from '@playwright/test';

import { apiGet } from './support/api.js';
import { setAIScenario } from './support/aiScenario.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

// A real, tiny PNG keeps the resolver/pixel assertion meaningful while
// remaining a deterministic in-repo fixture (the bytes never leave the
// browser's IndexedDB media store).
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
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

      const created = await page.request.post('/api/projects/blank/', {
        data: { renderer: 'canvas2d' },
      });
      expect(created.status()).toBe(201);
      const { id: projectId } = (await created.json()) as { id: string };
      expect(projectId).toBeTruthy();

      await page.goto(`/ai-projects/${projectId}`);
      const stage = page.locator('.piece-stage-shell');
      await stage.getByRole('button', { name: 'Open piece controls menu' }).click();
      await stage.getByRole('button', { name: 'Edit scene' }).click();

      await stage.getByRole('button', { name: 'File' }).click();
      await stage
        .getByRole('menu', { name: 'File menu' })
        .getByRole('menuitem', {
          name: 'Import media',
        })
        .click();
      await stage.locator('input[aria-label="Import media file"]').setInputFiles({
        name: 'fixture-sun.png',
        mimeType: 'image/png',
        buffer: ONE_PIXEL_PNG,
      });

      const importDialog = stage.getByRole('dialog', { name: 'Describe this media' });
      await expect(importDialog).toBeVisible();
      await importDialog.getByLabel('Descriptive label').fill('Fixture sun');
      await importDialog.getByRole('button', { name: 'Import media' }).click();

      const library = stage.getByRole('region', { name: 'Project media library' });
      await expect(library).toBeVisible();
      const asset = library.getByRole('listitem').filter({ hasText: 'fixture-sun.png' });
      await expect(asset).toBeVisible();

      await stage.getByRole('button', { name: 'Open piece controls menu' }).click();
      await stage.getByRole('button', { name: 'Ask AI to improve this scene' }).click();
      const layersTab = stage.getByRole('tab', { name: 'Layers' });
      if (await layersTab.isVisible()) await layersTab.click();
      const expandTools = stage.getByRole('button', { name: 'Expand Tools panel' });
      if (await expandTools.isVisible()) await expandTools.click();

      const assistant = stage.getByRole('heading', { name: 'AI assistant' }).locator('..');
      await assistant.getByRole('radio', { name: 'Agent workflow' }).click();
      await assistant.getByRole('radio', { name: 'Add media asset' }).click();
      await assistant.getByLabel('Media asset').selectOption({ label: 'fixture-sun.png' });
      await assistant
        .getByLabel('Describe the change you want to make')
        .fill('Add @fixture-sun.png and do not reference any un-imported asset named missing.png.');
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

      const canvas = stage.locator('.piece-stage-shell canvas').last();
      await expect(canvas).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`new-asset-accepted-${viewport.width}.png`),
        fullPage: true,
      });
    });
  }
});
