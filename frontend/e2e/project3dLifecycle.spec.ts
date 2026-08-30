/**
 * Task 207 (issue #239): closes the "no E2E test exercises 3D project
 * creation" coverage gap discovered while investigating task 206/#238's
 * production incident. `make e2e` (133 passed) and `pytest` (794 passed)
 * were both green immediately before the publish that introduced #238,
 * yet the 3D creation path was still broken live -- because nothing in
 * this suite ever drove it. See AGENTS.md's "End-to-end tests
 * (Playwright)" section for how to run this suite.
 *
 * Mirrors `projectLifecycle.spec.ts`'s conventions (fixtures, self-skip
 * via `requireE2EFixtures()`) but only covers 3D project creation --
 * everything else about the 3D manual/AI-assisted editors (outline,
 * inspector, code tab, AI proposals) is out of scope per the issue.
 */
import { expect, test, type Page } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('3D project creation', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('creating a new 3D project persists it and opens the manual editor', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);

    await page.goto('/');
    await page.getByRole('button', { name: 'Create new 3D project' }).click();
    await page.waitForURL(/\/projects3d\/[^/]+$/);
    const match = /\/projects3d\/([^/]+)$/.exec(page.url());
    expect(match).not.toBeNull();

    // Confirms the manual editor actually loaded the newly-created project
    // (not just that the route matched) -- this testid only renders once
    // Project3DWorkspace.tsx has fetched the project and its current
    // version successfully (Project3DWorkspace.tsx).
    await expect(page.getByTestId('project3d-save-status')).toBeVisible();

    // Reload to prove the project genuinely persisted server-side, not
    // just in local React state from the create response.
    await page.reload();
    await expect(page.getByTestId('project3d-save-status')).toBeVisible();
  });

  test('creating a new AI-assisted 3D project persists it and opens the AI-assisted editor', async ({
    page,
  }: {
    page: Page;
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);

    await page.goto('/');
    await page.getByRole('button', { name: 'Create AI-assisted 3D project' }).click();
    await page.waitForURL(/\/ai-projects3d\/[^/]+$/);
    const match = /\/ai-projects3d\/([^/]+)$/.exec(page.url());
    expect(match).not.toBeNull();

    // AiProject3DWorkspace.tsx mounts Scene3DPreview.tsx (issue #244) once
    // it has fetched the newly-created project and its current version
    // successfully -- same persistence proof as the manual scenario above,
    // via the AI-assisted route's own load path instead. A real browser
    // (unlike this repo's jsdom-based component tests) has WebGL, so the
    // live canvas -- not the WebGL-unavailable fallback -- is what proves
    // the preview actually mounted and rendered.
    await expect(page.getByTestId('scene3d-preview-canvas')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('scene3d-preview-canvas')).toBeVisible();
  });
});
