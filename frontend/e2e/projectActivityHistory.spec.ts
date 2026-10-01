import { expect, test, type Page } from '@playwright/test';

import { apiPost } from './support/api.js';
import { aiScenarioHeader } from './support/aiScenario.js';
import { loginViaUI } from './support/auth.js';
import { createServerProject2D } from './support/createProject.js';
import { expandAllCollapsibleSections } from './support/expandCollapsibleSections.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const fixtures = requireE2EFixtures();

async function startAndAdvanceRun(
  context: Parameters<typeof apiPost>[0],
  projectId: string,
): Promise<number> {
  const started = await apiPost(
    context,
    '/api/ai/runs/',
    {
      target_type: 'project',
      project_id: projectId,
      operation: 'edit_patch',
      scope: 'whole_scene',
      prompt: 'Create a deterministic activity-history test proposal.',
      vendor: 'mistral',
      start_request_id: crypto.randomUUID(),
    },
    aiScenarioHeader('success'),
  );
  expect(started.ok(), `AI run start failed with HTTP ${started.status()}`).toBe(true);
  let run = (await started.json()) as {
    id: number;
    status: string;
    error_reason?: string;
    validation_summary?: string;
  };

  let status = run.status;
  for (let attempt = 0; attempt < 20 && status === 'running'; attempt += 1) {
    const advanced = await apiPost(
      context,
      `/api/ai/runs/${run.id}/advance/`,
      {},
      aiScenarioHeader('success'),
    );
    expect(advanced.ok(), `AI run advance failed with HTTP ${advanced.status()}`).toBe(true);
    run = (await advanced.json()) as typeof run;
    status = run.status;
  }
  expect(
    status,
    `The deterministic AI provider did not reach review (${run.error_reason ?? 'no error code'}): ${run.validation_summary ?? ''}`,
  ).toBe('awaiting_review');
  return run.id;
}

async function expectHistoryRowsFitViewport(page: Page) {
  const layout = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('.version-history-item'));
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      rows: rows.map((row) => ({
        clientWidth: row.clientWidth,
        scrollWidth: row.scrollWidth,
        right: row.getBoundingClientRect().right,
        controlsRight: Array.from(row.querySelectorAll<HTMLElement>('button')).map(
          (button) => button.getBoundingClientRect().right,
        ),
      })),
    };
  });
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  for (const row of layout.rows) {
    expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1);
    expect(row.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
    for (const controlRight of row.controlsRight) {
      expect(controlRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
    }
  }
}

test.describe('2D project activity history (#1134)', () => {
  test('shows saved, restored, accepted, and discarded activity without changing version controls', async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectId = await createServerProject2D(page);
    await expandAllCollapsibleSections(page);

    // Create the version_saved event through the editor's existing controls.
    await page.getByRole('button', { name: 'Add circle' }).click();
    await page.getByRole('button', { name: 'Save scene' }).click();
    await expect(page.getByTestId('editor-save-status')).toHaveText(/Saved as version 2/);

    const acceptedRunId = await startAndAdvanceRun(context, projectId);
    const accepted = await apiPost(context, `/api/ai/runs/${acceptedRunId}/accept/`, {
      reason: 'Keep the new motion; it matches the brief.',
    });
    expect(accepted.ok(), `AI run accept failed with HTTP ${accepted.status()}`).toBe(true);

    const discardedRunId = await startAndAdvanceRun(context, projectId);
    const discarded = await apiPost(context, `/api/ai/runs/${discardedRunId}/cancel/`, {
      reason: 'Discard the alternate direction.',
    });
    expect(discarded.ok(), `AI run discard failed with HTTP ${discarded.status()}`).toBe(true);

    // Reload so the manual version-history view observes the server's latest
    // accepted version while remaining on its default Versions tab.
    await page.reload();
    await expandAllCollapsibleSections(page);
    const versionsTab = page.getByRole('tab', { name: 'Versions' });
    const activityTab = page.getByRole('tab', { name: 'Activity' });
    await expect(versionsTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Versions' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Version history' })).toBeVisible();

    // Restore a historical row using the unchanged version controls.
    await page.getByRole('button', { name: 'Restore' }).first().click();
    await expect(page.getByTestId('editor-save-status')).toContainText('Saved as version');

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      if (viewport.width < 1024) {
        await page.getByRole('tab', { name: 'Inspector', exact: true }).click();
        await expandAllCollapsibleSections(page);
      }
      await expectHistoryRowsFitViewport(page);
    }

    await activityTab.click();
    await expect(activityTab).toHaveAttribute('aria-selected', 'true');
    const activity = page.getByRole('list', { name: 'Project activity' });
    await expect(activity.getByText('Saved version 2')).toBeVisible();
    await expect(activity.getByText(/Restored version/)).toBeVisible();
    await expect(activity.getByText('Accepted an AI change')).toBeVisible();
    await expect(activity.getByText('Discarded an AI change')).toBeVisible();
    await expect(activity.getByText('Keep the new motion; it matches the brief.')).toBeVisible();
    await expect(activity.getByText('Discard the alternate direction.')).toBeVisible();
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      if (viewport.width < 1024) {
        await page.getByRole('tab', { name: 'Inspector', exact: true }).click();
        await expandAllCollapsibleSections(page);
      }
      await expectHistoryRowsFitViewport(page);
    }
  });
});
