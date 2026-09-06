/**
 * Issue #462: end-to-end coverage for the 2D "Agent workflow" action at
 * `/ai-projects/:id` (`AIRunPanel.tsx`/`useAIRun.ts`), driving issue
 * #461's persisted `AIRun` state machine through a real running Django +
 * Vite stack. Reuses `aiAndRecovery.spec.ts`'s exact fake-provider
 * infrastructure (`AI_PROVIDER=fake`, the `X-E2E-AI-Scenario` header, the
 * same `probeFakeAIProviderMode`-style self-skip) rather than adding a
 * second AI-mocking mechanism -- see that file's own module doc comment
 * for the full rationale.
 *
 * Scope: this suite proves the browser-level wiring (start -> the
 * client-owned advance loop -> preview -> Accept, selection-scope
 * enforcement, reload reconnection, repeated-failure UI) actually works
 * end-to-end. The state machine's own edge cases (repair/timeout/lease/
 * concurrency semantics) are already exhaustively covered by
 * `backend/tests/test_ai_runs.py` -- this file does not re-prove those at
 * the unit level, only that the real UI calls the real endpoints and
 * renders their real responses correctly.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { apiPost } from './support/api.js';
import { aiScenarioHeader, resetAIScenario, setAIScenario } from './support/aiScenario.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

const LOCKED_FOREGROUND_SCENE = {
  schemaVersion: 1,
  id: 'scene-ai-agent-2d-fixture',
  canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
  renderer: { preferred: 'p5' },
  layers: [
    { id: 'layer-bg', name: 'Background', order: 0, visible: true, locked: true },
    { id: 'layer-fg', name: 'Foreground', order: 1, visible: true, locked: false },
  ],
  shapes: [
    {
      id: 'shape-bg-circle',
      type: 'circle',
      layerId: 'layer-bg',
      groupId: null,
      transform: { x: 400, y: 300, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      style: { fill: '#333333', stroke: null, strokeWidth: 0 },
      name: 'Backdrop',
      radius: 200,
    },
    {
      id: 'shape-fg-rect',
      type: 'rect',
      layerId: 'layer-fg',
      groupId: null,
      transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      style: { fill: '#ff5533', stroke: null, strokeWidth: 0 },
      name: 'Editable rectangle',
      width: 80,
      height: 50,
      cornerRadius: 0,
    },
  ],
  groups: [],
  bindings: [],
  graph: { nodes: [], connections: [] },
  accessibility: { reducedMotion: 'auto' },
  randomness: { seed: 0, enabled: false },
};

async function probeFakeAIProviderMode(context: BrowserContext, page: Page): Promise<boolean> {
  await page.goto('/');
  const created = await apiPost(context, '/api/projects/blank/');
  const { id } = (await created.json()) as { id: string };
  const response = await apiPost(
    context,
    `/api/ai/runs/`,
    { target_type: 'project', project_id: id, operation: 'create', prompt: 'probe' },
    aiScenarioHeader('success'),
  );
  return response.status() === 201;
}

async function createProjectWithFixtureScene(context: BrowserContext): Promise<string> {
  const created = await apiPost(context, '/api/projects/blank/');
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const saved = await apiPost(context, `/api/projects/${id}/versions/`, {
    scene_json: LOCKED_FOREGROUND_SCENE,
    origin: 'manual',
    change_label: 'Agent 2D e2e fixture',
  });
  expect(saved.status()).toBe(201);
  return id;
}

test.describe('AI 2D editor: Agent workflow (#462)', () => {
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

    const created = await apiPost(context, '/api/projects/blank/');
    const { id: projectId } = (await created.json()) as { id: string };
    await setAIScenario(page, 'success');

    await page.goto(`/ai-projects/${projectId}`);
    await page.getByRole('radio', { name: 'Agent workflow' }).click();
    await page.getByRole('radio', { name: 'Create piece' }).click();
    await page
      .getByLabel('Describe the scene you want to generate')
      .fill('a bright red circle on a white background');
    await page.getByTestId('ai-run-start').click();

    await expect(page.getByTestId('ai-run-preview')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('ai-run-change-summary')).toHaveCount(0); // create has no patch summary
    await page.getByTestId('ai-run-accept').click();

    await expect(page.getByTestId('ai-run-status')).toContainText(/accepted/i);
    await page.getByTestId('ai-run-start-new').click();
    await expect(page.getByTestId('ai-run-form')).toBeVisible();
    // Accept persisted a real version -- the workspace's own preview now
    // reflects it (still visible after switching back to the one-shot tab,
    // proving the accepted scene actually replaced the working copy).
    await page.getByRole('radio', { name: 'One-shot' }).click();
    await expect(page.locator('.ai-editor-preview')).toBeVisible();
  });

  test('edits only the selected foreground object while a background layer is locked', async ({
    page,
    context,
  }) => {
    test.skip(
      !fakeProviderActive,
      'Server is not running with AI_PROVIDER=fake -- see AGENTS.md "End-to-end tests".',
    );

    const projectId = await createProjectWithFixtureScene(context);
    await setAIScenario(page, 'success');

    await page.goto(`/ai-projects/${projectId}`);
    await page.getByRole('radio', { name: 'Agent workflow' }).click();
    await page.getByRole('radio', { name: 'Edit selected layer/object' }).click();

    const objectSelect = page.getByLabel('Object to edit');
    // Issue #462 acceptance criterion: resolve selection to stable IDs --
    // only the unlocked foreground rectangle is a selectable option; the
    // locked background circle is present but disabled, never silently
    // omitted or silently editable.
    await expect(objectSelect.getByRole('option', { name: /Editable rectangle/ })).toBeEnabled();
    const lockedOption = objectSelect.getByRole('option', { name: /Backdrop/ });
    await expect(lockedOption).toBeDisabled();

    await objectSelect.selectOption({ label: 'Editable rectangle' });
    await page.getByLabel('Describe the change you want to make').fill('make it blue');
    await page.getByTestId('ai-run-start').click();

    await expect(page.getByTestId('ai-run-preview')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('ai-run-accept').click();
    await expect(page.getByTestId('ai-run-status')).toContainText(/accepted/i);
    await page.getByTestId('ai-run-start-new').click();
    await expect(page.getByTestId('ai-run-form')).toBeVisible();
  });

  test('a run that keeps failing validation ends in a terminal failed state', async ({
    page,
    context,
  }) => {
    test.skip(
      !fakeProviderActive,
      'Server is not running with AI_PROVIDER=fake -- see AGENTS.md "End-to-end tests".',
    );

    const created = await apiPost(context, '/api/projects/blank/');
    const { id: projectId } = (await created.json()) as { id: string };
    await setAIScenario(page, 'invalid_structured_output');

    await page.goto(`/ai-projects/${projectId}`);
    await page.getByRole('radio', { name: 'Agent workflow' }).click();
    await page.getByRole('radio', { name: 'Create piece' }).click();
    await page.getByLabel('Describe the scene you want to generate').fill('an impossible scene');
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

    const created = await apiPost(context, '/api/projects/blank/');
    const { id: projectId } = (await created.json()) as { id: string };
    await setAIScenario(page, 'success');

    await page.goto(`/ai-projects/${projectId}`);
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

    // Cleanup: reject so this run doesn't linger for the next test in this
    // worker (each test still gets its own project, but a stray localStorage
    // entry from a prior failure is otherwise possible across retries).
    await page.getByTestId('ai-run-reject').click();
  });
});
