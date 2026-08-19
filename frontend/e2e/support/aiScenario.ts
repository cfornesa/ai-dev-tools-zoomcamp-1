/**
 * Task 66 (issue #66): selects which deterministic AI outcome the
 * server's fake provider produces for this page's subsequent requests.
 *
 * Only takes effect when the dev server this suite is running against was
 * started with `AI_PROVIDER=fake` in its environment (see
 * `ai_provider/config.py`'s `use_fake_ai_provider` and
 * `ai_provider/e2e_scenario.py`'s `E2EScenarioMiddleware`) -- see
 * AGENTS.md's "End-to-end tests (Playwright)" section for the exact
 * command. Every AI create/edit/recovery scenario in
 * `aiAndRecovery.spec.ts` self-skips with an actionable message (via
 * `requireE2EFixtures`/an explicit provider-mode check) when that flag
 * wasn't set, exactly like every other prerequisite this suite already
 * gates on.
 *
 * `page.setExtraHTTPHeaders` applies the header to every subsequent
 * request this page makes -- harmless for non-AI requests (the header is
 * only ever read by `E2EScenarioMiddleware`, and only when
 * `AI_PROVIDER=fake`), and lets a single test switch scenarios freely
 * between AI actions without needing per-request route interception.
 */
import type { Page } from '@playwright/test';

export type AIScenario =
  'success' | 'invalid_structured_output' | 'forbidden_patch' | 'quota_exceeded' | 'timeout';

export async function setAIScenario(page: Page, scenario: AIScenario): Promise<void> {
  await page.setExtraHTTPHeaders({ 'X-E2E-AI-Scenario': scenario });
}

/** Resets to the default (`success`) scenario -- call after a test's last
 * non-success AI action so any incidental follow-up request (e.g. a
 * reload triggering unrelated fetches) never accidentally lands on a
 * stale failure scenario. */
export async function resetAIScenario(page: Page): Promise<void> {
  await page.setExtraHTTPHeaders({ 'X-E2E-AI-Scenario': 'success' });
}

/** Header object for the raw-HTTP `context.request` calls in
 * `support/api.ts` (`apiPost`/`apiPut`) -- `page.setExtraHTTPHeaders` only
 * affects requests the *page* itself makes (navigations, the app's own
 * `fetch` calls), not a `BrowserContext`'s standalone `request` API
 * client, so concurrency/setup scenarios that call `apiPost` directly
 * need this passed explicitly as `apiPost`'s `extraHeaders` argument. */
export function aiScenarioHeader(scenario: AIScenario): Record<string, string> {
  return { 'X-E2E-AI-Scenario': scenario };
}
