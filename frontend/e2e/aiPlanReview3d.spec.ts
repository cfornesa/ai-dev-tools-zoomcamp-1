/**
 * Issue #660: browser coverage for the shared plan-review gate on the 3D
 * structured editor route. The shared panel owns the behavior; this verifies
 * the Three.js/A-Frame route exposes it without applying a scene first.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { apiPost } from './support/api.js';
import { createServerProjectAndOpenAIProposalPanel } from './support/aiProposal.js';
import { aiScenarioHeader, resetAIScenario, setAIScenario } from './support/aiScenario.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function probeFakeProviderMode(context: BrowserContext, page: Page): Promise<boolean> {
  await page.goto('/');
  const created = await apiPost(context, '/api/projects3d/', {});
  const { id } = (await created.json()) as { id: string };
  const response = await apiPost(
    context,
    '/api/ai/runs/',
    { target_type: 'project3d', project3d_id: id, operation: 'create', prompt: 'probe' },
    aiScenarioHeader('success'),
  );
  return response.status() === 201;
}

test.describe('AI 3D editor: plan review (#660)', () => {
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

    await setAIScenario(page, 'success');
    const { panel } = await createServerProjectAndOpenAIProposalPanel(page, '3d');
    await panel.getByRole('radio', { name: 'Agent workflow' }).click();
    await panel.getByRole('radio', { name: 'Create piece' }).click();
    await panel.getByLabel('Describe the scene you want to generate').fill('a cube and a sphere');
    await panel.getByTestId('ai-run-start').click();

    await expect(panel.getByTestId('ai-run-plan-review')).toBeVisible();
    await expect(panel.getByTestId('ai-run-approve-plan')).toBeEnabled();
    await expect(panel.getByTestId('ai-run-edit-request')).toBeEnabled();
    await expect(panel.getByTestId('ai-run-attempts')).toHaveCount(0);

    await panel.getByTestId('ai-run-approve-plan').click();
    await expect(panel.getByTestId('ai-run-preview')).toBeVisible({ timeout: 15000 });
    await resetAIScenario(page);
  });
});
