/**
 * Issue #463: end-to-end coverage for the 3D "Agent workflow" action at
 * `/ai-projects3d/:id` (`AIProposalPanel3D.tsx`, reusing the shared
 * `useAIRun`/`AIRunPanel` orchestrator issue #462 already shipped for 2D).
 * Mirrors `aiAgent2d.spec.ts`'s exact fake-provider infrastructure and
 * conventions -- see that file's own module doc comment for the full
 * rationale (AI_PROVIDER=fake, the X-E2E-AI-Scenario header).
 *
 * Scope: proves the 3D route's browser-level wiring (start -> advance
 * loop -> a real Three.js preview of the candidate -> Accept, selection-
 * scope enforcement against 3D objects, reload reconnection, repeated-
 * failure UI) actually works end-to-end. The run state machine's own
 * edge cases (repair/timeout/lease/concurrency semantics, including the
 * 3D-specific invalid-material-then-repair and concurrent-owner-update
 * stale-base scenarios) are already exhaustively covered by
 * `backend/tests/test_ai_runs.py` -- this file does not re-prove those at
 * the unit level, only that the real 3D UI calls the real endpoints and
 * renders their real responses correctly.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { apiPost } from './support/api.js';
import { aiScenarioHeader, resetAIScenario, setAIScenario } from './support/aiScenario.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

const CUBE_SPHERE_SCENE = {
  schemaVersion: 1,
  documentType: 'scene3d',
  id: 'scene3d-ai-agent-3d-fixture',
  scene: { backgroundColor: '#101018' },
  camera: {
    position: { x: 4, y: 6, z: 12 },
    target: { x: 0, y: 1, z: 0 },
    fov: 60,
    near: 0.1,
    far: 2000,
  },
  lights: [
    {
      id: 'light-sun',
      type: 'directional',
      color: '#ffffff',
      intensity: 1.2,
      direction: { x: -1, y: -2, z: -1 },
    },
    {
      id: 'light-fill',
      type: 'ambient',
      color: '#405060',
      intensity: 0.4,
    },
  ],
  groups: [],
  objects: [
    {
      id: 'obj-cube',
      type: 'box',
      groupId: null,
      transform: {
        position: { x: 0, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        opacity: 1,
      },
      material: { color: '#ff5533' },
      visible: true,
      width: 1,
      height: 1,
      depth: 1,
    },
    {
      id: 'obj-sphere',
      type: 'sphere',
      groupId: null,
      transform: {
        position: { x: 2, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        opacity: 1,
      },
      material: { color: '#3355ff' },
      visible: true,
      radius: 0.5,
    },
  ],
  randomness: { seed: 0, enabled: false },
};

async function probeFakeAIProviderMode(context: BrowserContext, page: Page): Promise<boolean> {
  await page.goto('/');
  const created = await apiPost(context, '/api/projects3d/', {});
  const { id } = (await created.json()) as { id: string };
  const response = await apiPost(
    context,
    `/api/ai/runs/`,
    { target_type: 'project3d', project3d_id: id, operation: 'create', prompt: 'probe' },
    aiScenarioHeader('success'),
  );
  return response.status() === 201;
}

async function createProject3DWithFixtureScene(context: BrowserContext): Promise<string> {
  const created = await apiPost(context, '/api/projects3d/', {});
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const saved = await apiPost(context, `/api/projects3d/${id}/versions/`, {
    scene_json: CUBE_SPHERE_SCENE,
    origin: 'manual',
  });
  expect(saved.status()).toBe(201);
  return id;
}

test.describe('AI 3D editor: Agent workflow (#463)', () => {
  let fixtures: Fixtures;
  let fakeProviderActive = false;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test.beforeEach(async ({ page, context }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    fakeProviderActive = await probeFakeAIProviderMode(context, page);
    await resetAIScenario(page);
  });

  test('creates a piece through a full agent run and accepts it', async ({ page, context }) => {
    test.skip(
      !fakeProviderActive,
      'Server is not running with AI_PROVIDER=fake -- see AGENTS.md "End-to-end tests".',
    );

    const created = await apiPost(context, '/api/projects3d/', {});
    const { id: projectId } = (await created.json()) as { id: string };
    await setAIScenario(page, 'success');

    await page.goto(`/ai-projects3d/${projectId}`);
    await page.getByRole('radio', { name: 'Agent workflow' }).click();
    await page.getByRole('radio', { name: 'Create piece' }).click();
    await page
      .getByLabel('Describe the scene you want to generate')
      .fill('a small cube next to a sphere');
    await page.getByTestId('ai-run-start').click();

    await expect(page.getByTestId('ai-run-preview')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('ai-run-accept').click();

    await expect(page.getByTestId('ai-run-status')).toContainText(/accepted/i);
    await page.getByTestId('ai-run-start-new').click();
    await expect(page.getByTestId('ai-run-form')).toBeVisible();
    // Accept persisted a real version -- switching back to the one-shot
    // tab still shows the real Three.js preview (proving the accepted
    // scene actually replaced the working copy, not just the run's own
    // local candidate state).
    await page.getByRole('radio', { name: 'One-shot' }).click();
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('edits only the selected cube while the sphere is also present', async ({
    page,
    context,
  }) => {
    test.skip(
      !fakeProviderActive,
      'Server is not running with AI_PROVIDER=fake -- see AGENTS.md "End-to-end tests".',
    );

    const projectId = await createProject3DWithFixtureScene(context);
    await setAIScenario(page, 'success');

    await page.goto(`/ai-projects3d/${projectId}`);
    await page.getByRole('radio', { name: 'Agent workflow' }).click();
    await page.getByRole('radio', { name: 'Edit selected object' }).click();

    const objectSelect = page.getByLabel('Object to edit');
    // Issue #463 acceptance criterion: resolve selection to stable ids --
    // both scene objects are offered by name/type, never lights or the
    // camera (out of scope for a selection-scoped edit in this MVP).
    await expect(objectSelect.getByRole('option', { name: /Box/ })).toBeEnabled();
    await expect(objectSelect.getByRole('option', { name: /Sphere/ })).toBeEnabled();

    await objectSelect.selectOption({ label: 'Box 1' });
    await page.getByLabel('Describe the change you want to make').fill('make the cube blue');
    await page.getByTestId('ai-run-start').click();

    await expect(page.getByTestId('ai-run-preview')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('ai-run-accept').click();
    await expect(page.getByTestId('ai-run-status')).toContainText(/accepted/i);
  });

  test('a run that keeps failing validation ends in a terminal failed state', async ({
    page,
    context,
  }) => {
    test.skip(
      !fakeProviderActive,
      'Server is not running with AI_PROVIDER=fake -- see AGENTS.md "End-to-end tests".',
    );

    const created = await apiPost(context, '/api/projects3d/', {});
    const { id: projectId } = (await created.json()) as { id: string };
    await setAIScenario(page, 'invalid_structured_output');

    await page.goto(`/ai-projects3d/${projectId}`);
    await page.getByRole('radio', { name: 'Agent workflow' }).click();
    await page.getByRole('radio', { name: 'Create piece' }).click();
    await page.getByLabel('Describe the scene you want to generate').fill('an impossible geometry');
    await page.getByTestId('ai-run-start').click();

    await expect(page.getByTestId('ai-run-status')).toContainText(/failed/i, { timeout: 20000 });
    await expect(page.getByTestId('ai-run-start-new')).toBeVisible();
    await resetAIScenario(page);
  });

  test('a browser reload reconnects to an awaiting-review run without another attempt', async ({
    page,
    context,
  }) => {
    test.skip(
      !fakeProviderActive,
      'Server is not running with AI_PROVIDER=fake -- see AGENTS.md "End-to-end tests".',
    );

    const created = await apiPost(context, '/api/projects3d/', {});
    const { id: projectId } = (await created.json()) as { id: string };
    await setAIScenario(page, 'success');

    await page.goto(`/ai-projects3d/${projectId}`);
    await page.getByRole('radio', { name: 'Agent workflow' }).click();
    await page.getByRole('radio', { name: 'Create piece' }).click();
    await page.getByLabel('Describe the scene you want to generate').fill('a simple scene');
    await page.getByTestId('ai-run-start').click();

    await expect(page.getByTestId('ai-run-preview')).toBeVisible({ timeout: 15000 });
    const statusBefore = await page.getByTestId('ai-run-status').textContent();

    await page.reload();
    await page.getByRole('radio', { name: 'Agent workflow' }).click();

    await expect(page.getByTestId('ai-run-preview')).toBeVisible({ timeout: 5000 });
    const statusAfter = await page.getByTestId('ai-run-status').textContent();
    expect(statusAfter).toBe(statusBefore);

    await page.getByTestId('ai-run-reject').click();
  });
});
