/**
 * Issue #784: the 3D AI editor creates and edits drawing planes from natural prompts (fake provider,
 * `AI_PROVIDER=fake`): add a plane, expand it (proportional by default), elongate it (only on explicit
 * request), rotate it horizontally/vertically, and animate it. Each proposal is previewed and accepted or
 * rejected explicitly; an accepted proposal selects the plane so the #782 handles/toolbar are available.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { aiScenarioHeader, resetAIScenario, setAIScenario } from './support/aiScenario.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const PLANE = {
  id: 'drawing-plane-1',
  name: 'Drawing plane 1',
  type: 'drawingPlane',
  groupId: null,
  transform: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    opacity: 1,
  },
  material: { color: '#ffffff' },
  visible: true,
  width: 4,
  height: 3,
  doubleSided: true,
  drawing: {
    width: 1024,
    height: 768,
    background: '#ffffff',
    shapes: [
      {
        id: 'red',
        type: 'rect',
        x: 128,
        y: 96,
        width: 768,
        height: 576,
        fill: '#dc2626',
        stroke: null,
      },
    ],
  },
};

const SCENE = {
  schemaVersion: 1,
  documentType: 'scene3d',
  id: 'scene3d-ai-drawing-plane',
  scene: { backgroundColor: '#101018' },
  camera: {
    position: { x: 0, y: 0, z: 9 },
    target: { x: 0, y: 0, z: 0 },
    fov: 50,
    near: 0.1,
    far: 1000,
  },
  lights: [{ id: 'amb', type: 'ambient', color: '#ffffff', intensity: 1 }],
  groups: [],
  objects: [PLANE],
  randomness: { seed: 0, enabled: false },
};

type Obj = {
  id: string;
  type: string;
  width?: number;
  height?: number;
  transform: { rotation: { x: number } };
  animation?: { kind: string };
};

/**
 * Creates a project through the gallery's creation menu (which gives it the canonical slug route the
 * legacy `/projects3d/:id` redirects need), then saves the fixture scene as its current version and
 * reloads the editor onto it.
 */
async function createProject(page: Page, context: BrowserContext): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'More creation options' }).click();
  const created = page.waitForResponse(
    (res) =>
      res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/projects3d/',
  );
  await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
  const { id } = (await (await created).json()) as { id: string };
  await page.waitForURL(/\/users\/@[^/]+\/edit\//);
  const saved = await apiPost(context, `/api/projects3d/${id}/versions/`, {
    scene_json: SCENE,
    origin: 'manual',
  });
  expect(saved.status()).toBe(201);
  await page.reload();
  await expect(page.getByTestId('scene3d-preview-canvas')).toBeVisible();
  return id;
}

/** Opens the AI panel from the stage's piece-controls menu (the single 3D editor's "Ask AI" entry). */
async function openAiPanel(page: Page) {
  const toolbar = page.getByRole('toolbar', { name: 'Preview actions' });
  await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
  await toolbar.getByRole('button', { name: 'Ask AI to improve this scene' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Ask AI to improve this scene' })).toBeVisible();
}

async function planes(context: BrowserContext, id: string): Promise<Obj[]> {
  const project = (await (await apiGet(context, `/api/projects3d/${id}/`)).json()) as {
    current_version: { scene_json: { objects: Obj[] }; sequence: number };
  };
  return project.current_version.scene_json.objects.filter((o) => o.type === 'drawingPlane');
}

async function sequence(context: BrowserContext, id: string): Promise<number> {
  const project = (await (await apiGet(context, `/api/projects3d/${id}/`)).json()) as {
    current_version: { sequence: number };
  };
  return project.current_version.sequence;
}

async function propose(page: Page, prompt: string) {
  await page.getByRole('radio', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Describe the change you want to make').fill(prompt);
  await page.getByRole('button', { name: 'Propose edit' }).click();
  await expect(page.getByTestId('ai-3d-proposal-success')).toBeVisible({ timeout: 20_000 });
}

test.describe('AI drawing-plane proposals (#784)', () => {
  const fixtures = requireE2EFixtures();
  let fakeProvider = false;

  test.beforeEach(async ({ page, context }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    const probe = await apiPost(context, '/api/projects3d/', {});
    const { id } = (await probe.json()) as { id: string };
    fakeProvider =
      (
        await apiPost(
          context,
          '/api/ai/runs/',
          { target_type: 'project3d', project3d_id: id, operation: 'create', prompt: 'probe' },
          aiScenarioHeader('success'),
        )
      ).status() === 201;
    await resetAIScenario(page);
  });

  test('five phrasings: add, expand (proportional), elongate (stretch), rotate, animate', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(!fakeProvider, 'Server is not running with AI_PROVIDER=fake.');
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const id = await createProject(page, context);
    await setAIScenario(page, 'success');
    const stage = page.getByTestId('scene3d-preview-canvas-frame');
    await stage.screenshot({ path: testInfo.outputPath('before.png') });
    await openAiPanel(page);

    // 1. Add a drawing plane.
    await propose(page, 'Add a drawing plane');
    await page.getByTestId('ai-3d-accept-button').click();
    await expect.poll(async () => (await planes(context, id)).length).toBe(2);

    // 2. Expand: BOTH dimensions grow by the same factor, even though the fake model only proposed a width.
    await propose(page, 'Expand Drawing plane 1');
    await page
      .getByTestId('ai-3d-proposal-preview')
      .screenshot({ path: testInfo.outputPath('proposal-expand.png') });
    await page.getByTestId('ai-3d-accept-button').click();
    await expect
      .poll(async () => (await planes(context, id)).find((p) => p.id === 'drawing-plane-1')?.width)
      .toBeGreaterThan(4);
    const expanded = (await planes(context, id)).find((p) => p.id === 'drawing-plane-1')!;
    expect(expanded.height).toBeGreaterThan(3);
    expect(expanded.width! / expanded.height!).toBeCloseTo(4 / 3, 2);

    // 3. Elongate: only on an explicit request does the ratio change.
    await propose(page, 'Elongate Drawing plane 1');
    await page.getByTestId('ai-3d-accept-button').click();
    await expect
      .poll(async () => {
        const p = (await planes(context, id)).find((o) => o.id === 'drawing-plane-1')!;
        return Math.abs(p.width! / p.height! - 4 / 3) > 0.05;
      })
      .toBe(true);

    // 4. Rotate horizontally, then vertically.
    await propose(page, 'Rotate Drawing plane 1 horizontally');
    await page.getByTestId('ai-3d-accept-button').click();
    await expect
      .poll(
        async () =>
          (await planes(context, id)).find((p) => p.id === 'drawing-plane-1')?.transform.rotation.x,
      )
      .toBe(-90);
    await propose(page, 'Rotate Drawing plane 1 vertically');
    await page.getByTestId('ai-3d-accept-button').click();
    await expect
      .poll(
        async () =>
          (await planes(context, id)).find((p) => p.id === 'drawing-plane-1')?.transform.rotation.x,
      )
      .toBe(0);

    // 5. Animate.
    await propose(page, 'Make Drawing plane 1 spin');
    await page.getByTestId('ai-3d-accept-button').click();
    await expect
      .poll(
        async () =>
          (await planes(context, id)).find((p) => p.id === 'drawing-plane-1')?.animation?.kind,
      )
      .toBe('rotate');
    await stage.scrollIntoViewIfNeeded();
    await stage.screenshot({ path: testInfo.outputPath('after.png') });
  });

  test('Reject leaves the scene untouched; invalid proposals are refused with a message', async ({
    page,
    context,
  }) => {
    test.skip(!fakeProvider, 'Server is not running with AI_PROVIDER=fake.');
    const id = await createProject(page, context);
    await setAIScenario(page, 'success');
    await openAiPanel(page);
    const before = await sequence(context, id);

    await propose(page, 'Expand Drawing plane 1');
    await page.getByTestId('ai-3d-reject-button').click();
    await expect(page.getByTestId('ai-3d-proposal-success')).toHaveCount(0);
    expect(await sequence(context, id)).toBe(before);

    await setAIScenario(page, 'forbidden_patch');
    await page.getByLabel('Describe the change you want to make').fill('Expand Drawing plane 1');
    await page.getByRole('button', { name: 'Propose edit' }).click();
    await expect(page.getByTestId(/ai-3d-error-/)).toBeVisible({ timeout: 20_000 });
    expect(await sequence(context, id)).toBe(before);
    expect((await planes(context, id))[0]!.width).toBe(4);
  });

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`an accepted proposal selects the plane and Undo steps back at ${viewport.width}x${viewport.height}`, async ({
      page,
      context,
    }, testInfo) => {
      test.skip(!fakeProvider, 'Server is not running with AI_PROVIDER=fake.');
      test.setTimeout(150_000);
      await page.setViewportSize(viewport);
      const id = await createProject(page, context);
      await setAIScenario(page, 'success');
      await expect(page.getByTestId('plane-selection-overlay')).toHaveCount(0);
      const toolbar = page.getByRole('toolbar', { name: 'Preview actions' });
      await openAiPanel(page);
      await propose(page, 'Expand Drawing plane 1');
      await page.getByTestId('ai-3d-accept-button').click();

      // The accepted plane is selected: handles + floating toolbar are there for manual follow-up.
      await expect(page.getByTestId('plane-selection-overlay')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('toolbar', { name: /Drawing plane 1 actions/ })).toBeVisible();
      await page.getByTestId('scene3d-preview-canvas-frame').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('accepted-selected.png') });
      expect((await planes(context, id))[0]!.width).toBeGreaterThan(4);

      // Undo returns the working copy to the pre-proposal scene.
      await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
      const undo = toolbar.getByRole('button', { name: 'Undo', exact: true });
      if (!(await undo.isVisible().catch(() => false))) {
        await toolbar.getByRole('button', { name: '3D authoring', exact: true }).click();
      }
      await expect(undo).toBeEnabled();
      await undo.click();
      await page.keyboard.press('Escape');
      await page
        .getByRole('toolbar', { name: /Drawing plane 1 actions/ })
        .getByRole('button', { name: 'Precise values' })
        .click();
      await expect(page.getByLabel('Width', { exact: true })).toHaveValue('4');
    });
  }
});
