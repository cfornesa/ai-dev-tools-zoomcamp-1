/**
 * Issue #920: existing structured 2D layer targeting.
 *
 * The fake provider's layer-recolor scenario returns a patch derived from the
 * stable IDs appended by the mention chip. This keeps the browser test on the
 * real target-selection, patch-scope, accept, and version-history paths.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { resetAIScenario, setAIScenario } from './support/aiScenario.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

const LAYER_TARGET_SCENE = {
  schemaVersion: 1,
  id: 'layer-target-existing-fixture',
  canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
  renderer: { preferred: 'p5' },
  layers: [
    { id: 'layer-sky', name: 'Sky', order: 0, visible: true, locked: false },
    { id: 'layer-hills', name: 'Hills', order: 1, visible: true, locked: false },
    { id: 'layer-sun', name: 'Sun', order: 2, visible: true, locked: false },
    { id: 'layer-frame', name: 'Frame', order: 3, visible: true, locked: true },
  ],
  shapes: ['sky', 'hills', 'sun', 'frame'].map((name, layerIndex) => ({
    id: `shape-${name}`,
    type: 'rect',
    layerId: `layer-${name}`,
    groupId: null,
    transform: {
      x: layerIndex * 100,
      y: layerIndex * 80,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
    },
    style: { fill: '#99ccff', stroke: null, strokeWidth: 0 },
    name,
    width: 80,
    height: 50,
    cornerRadius: 0,
  })),
  groups: [],
  bindings: [],
  graph: { nodes: [], connections: [] },
  accessibility: { reducedMotion: 'auto' },
  randomness: { seed: 0, enabled: false },
};

async function createExistingPiece(context: BrowserContext): Promise<{
  id: string;
  before: Record<string, unknown>;
  beforeVersionId: number;
}> {
  const created = await apiPost(context, '/api/projects/blank/');
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const saved = await apiPost(context, `/api/projects/${id}/versions/`, {
    scene_json: LAYER_TARGET_SCENE,
    origin: 'manual',
    change_label: 'AI layer target fixture',
  });
  expect(saved.status()).toBe(201);
  const savedBody = (await saved.json()) as { id: number };
  const project = (await (await apiGet(context, `/api/projects/${id}/`)).json()) as {
    current_version: number;
  };
  const version = (await (
    await apiGet(context, `/api/projects/${id}/versions/${project.current_version}/`)
  ).json()) as { scene_json: Record<string, unknown> };
  return { id, before: version.scene_json, beforeVersionId: savedBody.id };
}

async function chooseMention(page: Page, name: string): Promise<void> {
  const prompt = page.getByLabel('Describe the change you want to make');
  await prompt.fill(`@${name}`);
  await page.getByRole('option', { name: new RegExp(`^${name}\\s`) }).click();
}

test.describe('AI layer targeting on an existing structured piece (#920)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('recolors only the mentioned layer and refuses the locked layer', async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const { id, before, beforeVersionId } = await createExistingPiece(context);
    await setAIScenario(page, 'layer-recolor');
    await page.goto(`/ai-projects/${id}`);
    await page.getByRole('button', { name: 'Ask AI to improve this scene' }).click();
    await page.getByRole('tab', { name: 'Layers' }).click();
    await page.getByRole('radio', { name: 'One-shot' }).click();
    await page.getByRole('radio', { name: 'Edit' }).click();
    await chooseMention(page, 'Hills');
    await page.getByLabel('Describe the change you want to make').fill('recolor it blue');
    await page.getByRole('button', { name: 'Propose edit' }).click();
    await expect(page.getByTestId('ai-proposal-success')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/ai-layer-target-before-1280.png', fullPage: true });
    await page.getByRole('button', { name: 'Accept' }).click();

    const project = (await (await apiGet(context, `/api/projects/${id}/`)).json()) as {
      current_version: number;
    };
    const version = (await (
      await apiGet(context, `/api/projects/${id}/versions/${project.current_version}/`)
    ).json()) as { scene_json: Record<string, unknown> };
    const after = version.scene_json;
    const beforeShapes = before.shapes as Array<Record<string, unknown>>;
    const afterShapes = after.shapes as Array<Record<string, unknown>>;
    expect(afterShapes.filter((shape) => shape.layerId !== 'layer-hills')).toEqual(
      beforeShapes.filter((shape) => shape.layerId !== 'layer-hills'),
    );
    expect(
      afterShapes
        .filter((shape) => shape.layerId === 'layer-hills')
        .every((shape) => (shape.style as Record<string, unknown>).fill === '#3366ff'),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/ai-layer-target-after-1280.png', fullPage: true });

    // A plain-text mention is not a structured target selection. The fake
    // provider therefore returns no patch, and the existing scene remains
    // unchanged rather than allowing an unscoped edit.
    await page.getByRole('button', { name: 'Remove Hills target' }).click();
    const plainPrompt = page.getByLabel('Describe the change you want to make');
    await plainPrompt.fill('make the Sun blue');
    await page.getByRole('button', { name: 'Propose edit' }).click();
    await expect(page.getByTestId('ai-error-validation-error')).toBeVisible({ timeout: 15000 });
    const afterPlainAttempt = (await (
      await apiGet(context, `/api/projects/${id}/versions/${project.current_version}/`)
    ).json()) as { scene_json: Record<string, unknown> };
    expect(afterPlainAttempt.scene_json).toEqual(after);

    // Restore the pre-AI version through the same persisted version endpoint
    // used by the Version history panel, then verify the restored scene is an
    // exact copy of the pre-run document rather than a partial inverse patch.
    const restored = await apiPost(
      context,
      `/api/projects/${id}/versions/${beforeVersionId}/restore/`,
      {},
    );
    expect(restored.status()).toBe(201);
    const restoredBody = (await restored.json()) as {
      scene_json: Record<string, unknown>;
    };
    expect(restoredBody.scene_json).toEqual(before);

    // Capture the same accepted state at the required phone viewport. The
    // test exercises responsive layout without changing the persisted scene.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: 'test-results/ai-layer-target-after-375.png', fullPage: true });

    await chooseMention(page, 'Frame');
    await expect(page.getByRole('option', { name: /Frame/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await resetAIScenario(page);
  });
});
