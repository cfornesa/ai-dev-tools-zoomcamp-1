import fs from 'node:fs';

import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { apiPost } from './support/api.js';
import { aiScenarioHeader, setAIScenario } from './support/aiScenario.js';
import { loginViaUI } from './support/auth.js';
import { expandAllCollapsibleSections } from './support/expandCollapsibleSections.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const fixtures = requireE2EFixtures();
const EVIDENCE_DIR = '/tmp/qa-1135-evidence';

async function startAndAdvanceRun(context: BrowserContext, projectId: string): Promise<number> {
  const started = await apiPost(
    context,
    '/api/ai/runs/',
    {
      target_type: 'project',
      project_id: projectId,
      operation: 'edit_patch',
      scope: 'whole_scene',
      prompt: 'Create a deterministic decision-reason test candidate.',
      vendor: 'mistral',
      start_request_id: crypto.randomUUID(),
    },
    aiScenarioHeader('success'),
  );
  expect(started.status()).toBe(201);
  const initial = (await started.json()) as { id: number; status: string };
  let status = initial.status;
  for (let attempt = 0; attempt < 20 && status === 'running'; attempt += 1) {
    const advanced = await apiPost(
      context,
      `/api/ai/runs/${initial.id}/advance/`,
      {},
      aiScenarioHeader('success'),
    );
    expect(advanced.ok()).toBe(true);
    const run = (await advanced.json()) as { status: string; error_reason?: string };
    status = run.status;
    if (status === 'failed') {
      throw new Error(`Fake provider did not reach review: ${run.error_reason ?? 'no reason'}`);
    }
  }
  expect(status, 'fake-provider AIRun must reach awaiting_review').toBe('awaiting_review');
  return initial.id;
}

async function showAgentCandidate(page: Page, projectId: string, runId: number) {
  await page.evaluate(
    ({ currentProjectId, currentRunId }) => {
      window.localStorage.setItem(
        `gesture-studio:ai-run:${currentProjectId}`,
        String(currentRunId),
      );
    },
    { currentProjectId: projectId, currentRunId: runId },
  );
  await page.reload();
  const inspectorTab = page.getByRole('tab', { name: 'Inspector', exact: true });
  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    await expect(inspectorTab).toBeVisible();
    await inspectorTab.click();
  }
  await expandAllCollapsibleSections(page);
  const assistant = page.getByRole('heading', { name: 'AI assistant' }).locator('..');
  await assistant.getByRole('radio', { name: 'Agent workflow' }).click();
  await expect(assistant.getByTestId('ai-run-preview')).toBeVisible({ timeout: 15000 });
  return assistant;
}

async function enterReasonAndCapture(
  page: Page,
  assistant: Locator,
  reason: string,
  screenshot: string,
) {
  const reasonField = assistant.getByRole('textbox', { name: 'Why? (optional)' });
  await expect(reasonField).toBeVisible();
  await reasonField.fill(reason);

  const candidateSummary = assistant.getByTestId('ai-run-change-summary');
  const decisionButtons = [
    assistant.getByTestId('ai-run-accept'),
    assistant.getByTestId('ai-run-reject'),
  ];
  const layout = await page.evaluate(() => {
    const selectors = [
      '[data-testid="ai-run-change-summary"]',
      '#ai-run-decision-reason',
      '#ai-run-decision-reason-count',
      '[data-testid="ai-run-preview"] .editor-tool-group',
    ];
    const nodes = selectors.map((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing decision-reason layout node: ${selector}`);
      const rect = element.getBoundingClientRect();
      return {
        selector,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    });
    const buttons = ['[data-testid="ai-run-accept"]', '[data-testid="ai-run-reject"]'].map(
      (selector) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing decision button: ${selector}`);
        const rect = element.getBoundingClientRect();
        return { selector, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      },
    );
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      nodes,
      buttons,
    };
  });
  expect(
    layout.documentWidth,
    'decision panel must not cause horizontal page overflow',
  ).toBeLessThanOrEqual(layout.viewportWidth);
  for (const node of layout.nodes) {
    expect(node.left, `${node.selector} left edge`).toBeGreaterThanOrEqual(-1);
    expect(node.right, `${node.selector} right edge`).toBeLessThanOrEqual(layout.viewportWidth + 1);
  }
  for (let index = 0; index < layout.nodes.length - 1; index += 1) {
    expect(
      layout.nodes[index]!.bottom,
      `${layout.nodes[index]!.selector} must not overlap ${layout.nodes[index + 1]!.selector}`,
    ).toBeLessThanOrEqual(layout.nodes[index + 1]!.top + 1);
  }
  const [acceptBounds, rejectBounds] = layout.buttons;
  expect(
    acceptBounds!.right <= rejectBounds!.left + 1 || rejectBounds!.right <= acceptBounds!.left + 1,
    'Accept and Reject buttons must not overlap each other',
  ).toBe(true);
  expect(candidateSummary).toBeVisible();
  for (const button of decisionButtons) await expect(button).toBeVisible();
  await page.screenshot({ path: screenshot, fullPage: true });
}

test.describe('2D Agent decision reasons (#1135)', () => {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`accepts and rejects with distinct reasons visible in Activity at ${viewport.width}px`, async ({
      page,
      context,
    }) => {
      test.setTimeout(120_000);
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const created = await apiPost(context, '/api/projects/blank/');
      expect(created.status()).toBe(201);
      const project = (await created.json()) as { id: string; editor_url: string };
      const projectId = project.id;
      const acceptedReason = `Accepted at ${viewport.width}px: keep the motion.`;
      const rejectedReason = `Rejected at ${viewport.width}px: choose the quieter option.`;
      await setAIScenario(page, 'success');
      await page.goto(project.editor_url);
      const acceptedRunId = await startAndAdvanceRun(context, projectId);
      let assistant = await showAgentCandidate(page, projectId, acceptedRunId);

      await enterReasonAndCapture(
        page,
        assistant,
        acceptedReason,
        `${EVIDENCE_DIR}/candidate-${viewport.width}-accept.png`,
      );
      await assistant.getByTestId('ai-run-accept').click();
      await expect(assistant.getByTestId('ai-run-status')).toContainText(/accepted/i);
      const rejectedRunId = await startAndAdvanceRun(context, projectId);
      assistant = await showAgentCandidate(page, projectId, rejectedRunId);

      await enterReasonAndCapture(
        page,
        assistant,
        rejectedReason,
        `${EVIDENCE_DIR}/candidate-${viewport.width}-reject.png`,
      );
      await assistant.getByTestId('ai-run-reject').click();
      await expect(assistant.getByTestId('ai-run-status')).toContainText(/stopped/i);

      await page.goto(project.editor_url);
      if (viewport.width < 1024) {
        await page.getByRole('tab', { name: 'Inspector', exact: true }).click();
      }
      await expandAllCollapsibleSections(page);
      const activityTab = page.getByRole('tab', { name: 'Activity' });
      await activityTab.click();
      const activity = page.getByRole('list', { name: 'Project activity' });
      await expect(activity.getByText('Accepted an AI change')).toBeVisible();
      await expect(activity.getByText('Discarded an AI change')).toBeVisible();
      await expect(activity.getByText(acceptedReason, { exact: true })).toBeVisible();
      await expect(activity.getByText(rejectedReason, { exact: true })).toBeVisible();
      await page.screenshot({
        path: `${EVIDENCE_DIR}/activity-${viewport.width}.png`,
        fullPage: true,
      });
      const pageWidth = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));
      expect(pageWidth.documentWidth).toBeLessThanOrEqual(pageWidth.viewportWidth);
    });
  }
});
