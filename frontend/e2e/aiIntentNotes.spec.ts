/**
 * Issue #1140: browser-level contract for disclosing a server-backed 2D
 * project's private intent note and allowing the owner to exclude it from a
 * single fake-provider Agent request.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { aiScenarioHeader, resetAIScenario, setAIScenario } from './support/aiScenario.js';
import { loginViaUI } from './support/auth.js';
import { createServerProject2D } from './support/createProject.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function fakeProviderIsAvailable(context: BrowserContext, page: Page): Promise<boolean> {
  await page.goto('/');
  const created = await apiPost(context, '/api/projects/blank/');
  if (!created.ok()) return false;
  const { id } = (await created.json()) as { id: string };
  const response = await apiPost(
    context,
    '/api/ai/runs/',
    { target_type: 'project', project_id: id, operation: 'create', prompt: 'probe' },
    aiScenarioHeader('success'),
  );
  return response.status() === 201;
}

test.describe('2D Agent intent-note disclosure (#1140)', () => {
  let fixtures: Fixtures;
  let fakeProviderActive = false;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test.beforeEach(async ({ page, context }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    fakeProviderActive = await fakeProviderIsAvailable(context, page);
    await resetAIScenario(page);
  });

  test('shows the note count and sends the request-local exclusion', async ({ page, context }) => {
    test.skip(
      !fakeProviderActive,
      'Server is not running with AI_PROVIDER=fake -- see AGENTS.md "End-to-end tests".',
    );

    const projectId = await createServerProject2D(page);
    const savedBrief = await apiPatch(context, `/api/projects/${projectId}/`, {
      brief: 'Keep this composition calm and open.',
    });
    expect(savedBrief.status()).toBe(200);
    await page.reload();
    await setAIScenario(page, 'success');

    await page.getByRole('button', { name: 'Ask AI to improve this scene' }).click();
    await page.getByRole('radio', { name: 'Agent workflow' }).click();
    await expect(page.getByText('Using your intent notes (36 characters)')).toBeVisible();
    await page.getByRole('checkbox', { name: 'Exclude for this request' }).check();
    await page
      .getByLabel('Describe the scene you want to generate')
      .fill('a bright red circle on a white background');

    const startRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/api/ai/runs/') &&
        request.method() === 'POST' &&
        request.postDataJSON()?.operation === 'create',
    );
    await page.getByTestId('ai-run-start').click();
    expect((await startRequest).postDataJSON()?.use_intent_notes).toBe(false);
    await page.getByTestId('ai-run-approve-plan').click();
    await expect(page.getByTestId('ai-run-preview')).toBeVisible({ timeout: 15000 });
  });
});
