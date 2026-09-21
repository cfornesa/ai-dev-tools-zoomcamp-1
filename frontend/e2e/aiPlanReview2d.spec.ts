/**
 * Issue #659: browser coverage for the 2D plan-review gate. The focused
 * component tests cover the detailed attempt/criterion rendering; this suite
 * proves the real route does not advance until the visible plan is approved.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { apiPost } from './support/api.js';
import { aiScenarioHeader, resetAIScenario, setAIScenario } from './support/aiScenario.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function probeFakeProviderMode(context: BrowserContext, page: Page): Promise<boolean> {
  await page.goto('/');
  const created = await apiPost(context, '/api/projects/blank/');
  const { id } = (await created.json()) as { id: string };
  const response = await apiPost(
    context,
    '/api/ai/runs/',
    { target_type: 'project', project_id: id, operation: 'create', prompt: 'probe' },
    aiScenarioHeader('success'),
  );
  return response.status() === 201;
}

test.describe('AI 2D editor: plan review (#659)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('shows the plan and waits for explicit approval before implementation', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const fakeProviderActive = await probeFakeProviderMode(context, page);
    test.skip(
      !fakeProviderActive,
      'Server is not running with AI_PROVIDER=fake -- see AGENTS.md end-to-end setup.',
    );

    const created = await apiPost(context, '/api/projects/blank/');
    const { id: projectId } = (await created.json()) as { id: string };
    await setAIScenario(page, 'success');

    await page.goto(`/ai-projects/${projectId}`);
    await page.getByRole('radio', { name: 'Agent workflow' }).click();
    await page.getByRole('radio', { name: 'Create piece' }).click();
    await page.getByLabel('Describe the scene you want to generate').fill('a bright red circle');
    await page.getByTestId('ai-run-start').click();

    await expect(page.getByTestId('ai-run-plan-review')).toBeVisible();
    await expect(page.getByTestId('ai-run-approve-plan')).toBeEnabled();
    await expect(page.getByTestId('ai-run-edit-request')).toBeEnabled();
    await expect(page.getByTestId('ai-run-attempts')).toHaveCount(0);

    await page.getByTestId('ai-run-approve-plan').click();
    await expect(page.getByTestId('ai-run-preview')).toBeVisible({ timeout: 15000 });
    await resetAIScenario(page);
  });
});
