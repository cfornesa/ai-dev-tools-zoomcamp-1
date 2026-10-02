/**
 * Issue #1139: owner editing, responsive layout, and public-route privacy for
 * the server-backed structured 2D project's intent note.
 */
import { expect, test, type Page } from '@playwright/test';

import { apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { createServerProject2D } from './support/createProject.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

const privateNote = 'Keep this composition calm and open (#1139 privacy fixture).';

async function expectDetailsLayout(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  const details = page.getByRole('region', { name: 'Details' });
  const note = details.getByLabel('Intent notes (private)');
  await expect(note).toBeVisible();

  const geometry = await details.evaluate((panel) => {
    const field = panel.querySelector<HTMLTextAreaElement>('#project-brief');
    if (!field) throw new Error('The Details panel has no intent-note field');
    const panelBox = panel.getBoundingClientRect();
    const fieldBox = field.getBoundingClientRect();
    return {
      panelLeft: panelBox.left,
      panelRight: panelBox.right,
      fieldLeft: fieldBox.left,
      fieldRight: fieldBox.right,
      panelContentWidth: panel.scrollWidth,
      panelWidth: panel.clientWidth,
    };
  });

  expect(geometry.fieldLeft).toBeGreaterThanOrEqual(geometry.panelLeft);
  expect(geometry.fieldRight).toBeLessThanOrEqual(geometry.panelRight);
  expect(geometry.panelContentWidth).toBeLessThanOrEqual(geometry.panelWidth);
}

test.describe('private intent note editor (#1139)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('saves accessibly at desktop and mobile sizes and stays off the public canonical route', async ({
    page,
    browser,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.setViewportSize({ width: 1280, height: 900 });
    const projectId = await createServerProject2D(page);

    const detailsTab = page.getByRole('tab', { name: 'Details', exact: true });
    if (await detailsTab.isVisible()) await detailsTab.click();

    const details = page.getByRole('region', { name: 'Details' });
    const note = details.getByLabel('Intent notes (private)');
    await expect(note).toBeVisible();
    await expect(note).toHaveAttribute(
      'aria-describedby',
      'project-brief-help project-brief-count',
    );
    await expect(
      details.getByText(
        'Only you see this. It is added to AI requests for this piece when you choose.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(details.getByText('0 / 1,500 characters', { exact: true })).toBeVisible();

    await note.focus();
    await note.pressSequentially(privateNote);
    await expect(details.getByText(`${privateNote.length} / 1,500 characters`)).toBeVisible();
    await expectDetailsLayout(page, { width: 1280, height: 900 });

    await details.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(details.getByRole('status')).toHaveText('Saved.');
    await page.reload();
    await expect(details.getByLabel('Intent notes (private)')).toHaveValue(privateNote);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    await expectDetailsLayout(page, { width: 375, height: 812 });

    const published = await apiPost(page.context(), `/api/projects/${projectId}/publish/`);
    expect(published.status()).toBe(200);

    const anonymousContext = await browser.newContext();
    try {
      const anonymousPage = await anonymousContext.newPage();
      await anonymousPage.goto(`/p/${projectId}`);
      await anonymousPage.waitForURL(/\/users\/@[^/]+\/pieces\/[^/]+$/);
      await expect(anonymousPage.getByText(privateNote, { exact: true })).toHaveCount(0);
      await expect(anonymousPage.getByLabel('Intent notes (private)')).toHaveCount(0);
      await expect(
        anonymousPage.getByText(
          'Only you see this. It is added to AI requests for this piece when you choose.',
          { exact: true },
        ),
      ).toHaveCount(0);
    } finally {
      await anonymousContext.close();
    }
  });
});
