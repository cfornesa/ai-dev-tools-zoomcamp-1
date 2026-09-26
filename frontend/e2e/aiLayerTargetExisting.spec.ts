/**
 * Issue #920: existing structured 2D group targeting.
 *
 * The fake provider's layer-recolor scenario returns a patch derived from the
 * stable IDs appended by the mention chip. This keeps the browser test on the
 * real target-selection, patch-scope, accept, and version-history paths.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { resetAIScenario, setAIScenario } from './support/aiScenario.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function canvasPixel(page: Page, x: number, y: number): Promise<number[]> {
  return page
    .locator('canvas')
    .first()
    .evaluate(
      (canvas, point) => {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Scene canvas has no 2D context');
        return Array.from(context.getImageData(point.x, point.y, 1, 1).data.slice(0, 3));
      },
      { x, y },
    );
}

const LAYER_TARGET_SCENE = JSON.parse(
  readFileSync(
    new URL('../../schema/fixtures/valid/ai_layer_target_existing.json', import.meta.url),
    'utf8',
  ),
) as Record<string, unknown>;

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
  const prompt = page.locator('textarea#ai-proposal-prompt:visible');
  await prompt.fill(`@${name}`);
  const optionName = name === 'Hills' ? /^Hills group$/ : new RegExp(`^${name}\\s`);
  await page.getByRole('option', { name: optionName }).click();
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
    // At the desktop viewport the Layers panel is a visible region, not an
    // EditorPanelSwitcher tab. The AI action is opened from the Preview
    // toolbar, so target selection belongs to the AI panel's own prompt.
    await page.getByRole('radio', { name: 'One-shot' }).click();
    await page.getByRole('radio', { name: 'Edit' }).click();
    await chooseMention(page, 'Hills');
    await expect(page.locator('canvas').first()).toBeVisible();
    expect(await canvasPixel(page, 200, 100)).toEqual([135, 206, 235]);
    expect(await canvasPixel(page, 100, 500)).toEqual([46, 125, 50]);
    expect(await canvasPixel(page, 700, 500)).toEqual([102, 187, 106]);
    expect(await canvasPixel(page, 650, 120)).toEqual([255, 213, 79]);
    await page.getByLabel('Describe the change you want to make').fill('recolor it blue');
    await page.getByRole('button', { name: 'Propose edit' }).click();
    await expect(page.getByTestId('ai-proposal-success')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/ai-layer-target-before-1280.png', fullPage: true });
    const acceptResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/ai/accept-proposal/') &&
        response.request().method() === 'POST' &&
        response.status() === 201,
    );
    await page.getByRole('button', { name: 'Accept' }).click();
    await acceptResponse;

    const project = (await (await apiGet(context, `/api/projects/${id}/`)).json()) as {
      current_version: number;
    };
    const version = (await (
      await apiGet(context, `/api/projects/${id}/versions/${project.current_version}/`)
    ).json()) as { scene_json: Record<string, unknown> };
    const after = version.scene_json;
    const beforeShapes = before.shapes as Array<Record<string, unknown>>;
    const afterShapes = after.shapes as Array<Record<string, unknown>>;
    const hillsShapeIds = new Set(['shape-hills-left', 'shape-hills-right']);
    expect(afterShapes.filter((shape) => !hillsShapeIds.has(String(shape.id)))).toEqual(
      beforeShapes.filter((shape) => !hillsShapeIds.has(String(shape.id))),
    );
    expect(
      afterShapes
        .filter((shape) => ['shape-hills-left', 'shape-hills-right'].includes(String(shape.id)))
        .every((shape) => (shape.style as Record<string, unknown>).fill === '#3366ff'),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/ai-layer-target-after-1280.png', fullPage: true });

    // A plain-text mention is not a structured target selection. The fake
    // provider therefore returns an empty patch, and the existing scene
    // remains unchanged rather than allowing an unscoped edit.
    await page.getByRole('button', { name: 'Remove Hills target' }).click();
    const plainPrompt = page.getByLabel('Describe the change you want to make');
    await plainPrompt.fill('make the Sun blue');
    await page.getByRole('button', { name: 'Propose edit' }).click();
    await expect(page.getByTestId('ai-error-provider-error')).toBeVisible({ timeout: 15000 });
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

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: 'Ask AI to improve this scene' }).click();
    await page.locator('textarea#ai-proposal-prompt:visible').fill('@Frame');
    await expect(page.getByRole('option', { name: /^Frame\s/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    // Capture the same accepted state at the required phone viewport. The
    // test exercises responsive layout without changing the persisted scene.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: 'test-results/ai-layer-target-after-375.png', fullPage: true });
    await resetAIScenario(page);
  });
});
