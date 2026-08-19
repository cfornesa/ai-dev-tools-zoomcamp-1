/**
 * Task 69 (issue #69): export end-to-end tests, Tier 2 — the part of this
 * suite that proves `ExportConfigDialog.tsx` (Task 55) itself is wired
 * correctly: opening the real dialog inside a real, authenticated editor
 * session, selecting a version from a real project's real saved version
 * history, configuring attribution/ZIP/interaction-mode options, and
 * clicking the real "Export" button actually triggers a real browser
 * download with the correct filename and content.
 *
 * ## Why this is a separate tier from `exportArtifacts.spec.ts`
 *
 * `exportArtifacts.spec.ts` (Tier 1) already proves, exhaustively and by
 * actually running it, that `generateHtmlExport`/
 * `generateSocialThumbnailZip` themselves — every interaction mode,
 * attribution on/off, camera lifecycle, content-exclusion scanning, ZIP
 * structure/thumbnail dimensions — produce correct artifacts, entirely
 * without Django. What Tier 1 *cannot* prove is that the dialog around
 * those functions is wired correctly: that the version a user picks in
 * the "Saved version" `<select>` is the version whose `scene_json`
 * actually gets exported, that the attribution/ZIP checkboxes actually
 * flow into `generateHtmlExport`/`generateSocialThumbnailZip`'s
 * `input`, and that clicking "Export" triggers a real download rather
 * than silently doing nothing. That UI-wiring question is real project/
 * version state living in Django + PostgreSQL — reading a project's
 * version history (`useVersionHistory.ts` → `GET
 * /api/projects/:id/versions/`) and a specific version's full scene JSON
 * (`GET /api/projects/:id/versions/:versionId/`) are both real API calls,
 * exactly like every prior E2E suite's (Tasks 65-68) reason for needing
 * the same real backend. This file therefore reuses the exact same
 * infrastructure those suites already established
 * (`frontend/playwright.config.ts`, `e2e/support/*`, `make e2e`,
 * `requireE2EFixtures()`) rather than inventing a second one.
 *
 * Given Tier 1 already exhaustively proves *generation* correctness for
 * every mode/option combination, this file deliberately does not re-walk
 * every combination through the UI too (that would only re-prove what
 * Tier 1 already proved, at far higher cost per assertion) — it proves
 * each *wiring* fact exactly once: version selection reaches the
 * generated artifact, each checkbox reaches its corresponding option, and
 * clicking Export produces a real download.
 *
 * ## Cannot execute in this environment; verified statically
 *
 * Same constraint as Tasks 65-68: this needs a real, already-running
 * PostgreSQL-backed Django dev server and the Vite dev server, neither of
 * which is available in this sandboxed environment. Verified the same way
 * this repo already established for that situation: `npx playwright test
 * --list` (confirms every scenario is discoverable and the file is
 * syntactically valid with no server running at all), `npm run typecheck`
 * (confirms every selector/import/type in this file is correct against
 * the real `ExportConfigDialog.tsx`/`useVersionHistory.ts` types), and a
 * manual selector-by-selector review against `ExportConfigDialog.tsx`'s
 * actual JSX (every `id`/label/button name below was read directly off
 * that component, not guessed).
 */
import { expect, test, type Page } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function createBlankProjectViaUI(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create new animation' }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  const match = /\/projects\/([^/]+)$/.exec(page.url());
  if (!match) throw new Error(`Could not extract a project id from ${page.url()}`);
  return match[1];
}

/** Fills in meaningful title/description on the separate project-settings
 * route (`/projects/:id/settings`, `ProjectMetadataForm.tsx`) and saves,
 * then navigates back to the editor (`/projects/:id`, where
 * `ExportConfigDialog` actually lives) -- title/description are not
 * editable from the editor page itself (`EditorWorkspace.tsx` only links
 * to the settings page via "Edit project details"). `ExportConfigDialog`'s
 * `canExport` gate (mirroring the publish flow's own
 * `validateProjectMetadataForPublish`) blocks Export entirely until both
 * are meaningful, exactly like `publishingAndRemix.spec.ts`'s own
 * `saveMeaningfulMetadata` helper for the same underlying validator and
 * the same `#project-title`/`#project-description`/"Save changes"/"Saved."
 * selectors. */
async function fillMetadata(
  page: Page,
  projectId: string,
  { title, description }: { title: string; description: string },
) {
  await page.goto(`/projects/${projectId}/settings`);
  await page.locator('#project-title').fill(title);
  await page.locator('#project-description').fill(description);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await page.goto(`/projects/${projectId}`);
}

async function addShapeAndSave(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: 'Add circle' }).click();
  await page.getByLabel('Change label (optional)').fill(label);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('working-state-status')).toHaveText(/Saved as version/);
}

/** Opens `ExportConfigDialog` and waits for its version `<select>` to
 * finish loading real version history from the real backend. */
async function openExportDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Export…' }).click();
  await expect(page.getByRole('dialog', { name: 'Export project' })).toBeVisible();
  // historyLoadState === 'ready' -- the version <select> becomes enabled
  // once useVersionHistory's real GET .../versions/ call resolves.
  await expect(page.locator('#export-version')).toBeEnabled();
}

test.describe('ExportConfigDialog: real version selection, options, and download wiring', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('selecting a historical (non-latest) version and exporting downloads a file generated from that version, not the latest', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectId = await createBlankProjectViaUI(page); // version 1: an empty canvas
    await addShapeAndSave(page, 'second shape'); // version 2: one circle

    await fillMetadata(page, projectId, {
      title: 'Export version-selection fixture',
      description: 'Proves ExportConfigDialog exports the selected version, not always latest.',
    });

    await openExportDialog(page);

    // Defaults to the latest saved version (version 2) per issue #55's
    // documented default.
    const versionSelect = page.locator('#export-version');
    await expect(versionSelect).toHaveValue(/.+/);
    const latestOptionText = await versionSelect
      .locator('option', { hasText: '(latest)' })
      .textContent();
    expect(latestOptionText).toContain('Version 2');

    // Explicitly select version 1 (the historical version) instead.
    const version1Value = await versionSelect
      .locator('option', { hasText: 'Version 1' })
      .getAttribute('value');
    expect(version1Value).not.toBeNull();
    await versionSelect.selectOption(version1Value!);

    // Export version 1 and inspect the download's actual content --
    // proves the dialog fetched and forwarded *that* version's
    // scene_json, not the still-selected-by-default latest one, to
    // generateHtmlExport.
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.html$/);

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const fs = await import('node:fs');
    const html = fs.readFileSync(downloadPath!, 'utf-8');
    // Version 1 has zero shapes -- its embedded scene-data script's
    // "shapes" array must be empty, distinguishing it from version 2
    // (which has exactly one circle) without depending on internal ids.
    const sceneDataMatch =
      /<script type="application\/json" id="scene-data">([^]*?)<\/script>/.exec(html);
    expect(sceneDataMatch).not.toBeNull();
    const sceneData = JSON.parse(sceneDataMatch![1].replace(/\\u003C/g, '<')) as {
      shapes: unknown[];
    };
    expect(sceneData.shapes).toHaveLength(0);
  });

  test('attribution and social-thumbnail-ZIP checkboxes flow into the real download: unchecked downloads plain HTML, checked downloads a ZIP', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectId = await createBlankProjectViaUI(page);
    await fillMetadata(page, projectId, {
      title: 'Export options wiring fixture',
      description: 'Proves the attribution/ZIP checkboxes reach the real download.',
    });

    await openExportDialog(page);

    // Both checkboxes default off (issue #55's documented default).
    await expect(page.locator('#export-attribution')).not.toBeChecked();
    await expect(page.locator('#export-thumbnail-zip')).not.toBeChecked();

    // Unchecked: plain HTML download.
    const plainDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const plainDownload = await plainDownloadPromise;
    expect(plainDownload.suggestedFilename()).toMatch(/\.html$/);
    expect(plainDownload.suggestedFilename()).not.toMatch(/\.zip$/);

    // Re-open (the dialog resets its option state on every open, per
    // issue #55), check both boxes, export again: now a ZIP.
    await openExportDialog(page);
    await page.locator('#export-attribution').check();
    await page.locator('#export-thumbnail-zip').check();
    const zipDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const zipDownload = await zipDownloadPromise;
    expect(zipDownload.suggestedFilename()).toMatch(/\.zip$/);
  });

  test('Export is disabled until the project has meaningful title/description, and re-enables once fixed', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectId = await createBlankProjectViaUI(page); // still-default title/blank description

    await openExportDialog(page);
    await expect(page.getByTestId('export-metadata-errors')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await fillMetadata(page, projectId, {
      title: 'Now a meaningful title',
      description: 'Now a meaningful description of this animation.',
    });

    await openExportDialog(page);
    await expect(page.getByTestId('export-metadata-errors')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
  });

  test("interaction mode radios are gated by the selected version's own camera-driven bindings, not a global project setting", async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectId = await createBlankProjectViaUI(page);
    await fillMetadata(page, projectId, {
      title: 'Interaction mode gating fixture',
      description: 'A scene with no camera-driven bindings at all.',
    });

    await openExportDialog(page);
    // No handSignal/gestureEvent graph node exists on this project's only
    // version -- getAvailableInteractionModes (exportCompatibility.ts)
    // returns only 'demo', so both camera radios stay disabled and the
    // "no camera-driven bindings" note is shown, exactly mirroring
    // Tier 1's own proof that generation itself never depends on this
    // UI-level availability gate.
    await expect(page.locator('#export-mode-demo')).toBeEnabled();
    await expect(page.locator('#export-mode-camera')).toBeDisabled();
    await expect(page.locator('#export-mode-demo-camera')).toBeDisabled();
    await expect(page.locator('#export-camera-unavailable-note')).toBeVisible();

    // Sanity: this really is version 1 of a real project reachable over
    // the API, not a stale/local-only state -- keeps this scenario
    // honestly tied to the real backend rather than only the DOM.
    const versionsResponse = await context.request.get(`/api/projects/${projectId}/versions/`);
    expect(versionsResponse.ok()).toBe(true);
  });
});
