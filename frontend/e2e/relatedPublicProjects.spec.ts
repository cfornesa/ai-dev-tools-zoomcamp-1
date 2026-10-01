import { expect, test, type Page } from '@playwright/test';

import { apiGet, apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { createServerProject2D } from './support/createProject.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function publishProject(
  page: Page,
  titlePrefix: string,
): Promise<{ id: string; title: string }> {
  const id = await createServerProject2D(page);
  const title = `${titlePrefix} ${id.slice(0, 8)}`;
  const metadata = await apiPatch(page.context(), `/api/projects/${id}/`, {
    title,
    description: 'A published related-piece fixture.',
    tags: ['related-wave-c-fixture'],
  });
  expect(metadata.ok()).toBe(true);
  await page.reload();

  const preview = page.getByRole('region', { name: 'Preview' });
  await preview.getByRole('button', { name: 'File', exact: true }).click();
  const publication = preview.getByRole('group', { name: 'Publication status' });
  await publication.getByRole('button', { name: 'Published', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByTestId('visibility-status')).toContainText('Published (public)');
  return { id, title };
}

test.describe('canonical related public 2D pieces (#1142)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('shows shared-tag public cards below canonical details, without shifting the stage', async ({
    page,
    browser,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const source = await publishProject(page, 'Related source');
    const firstRelated = await publishProject(page, 'Related candidate one');
    const secondRelated = await publishProject(page, 'Related candidate two');

    const detail = await apiGet(page.context(), `/api/public/projects/${source.id}/`);
    expect(detail.ok()).toBe(true);
    const publicPiece = (await detail.json()) as { viewer_url: string; owner_handle: string };
    expect(publicPiece.viewer_url).toMatch(/^\/users\/@[^/]+\/pieces\//);

    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    let relatedRequestCount = 0;
    anonymousPage.on('request', (request) => {
      if (request.url().includes('/related/')) relatedRequestCount += 1;
    });
    let releaseRelated!: () => void;
    const relatedGate = new Promise<void>((resolve) => {
      releaseRelated = resolve;
    });
    await anonymousPage.route('**/api/public/projects/*/related/', async (route) => {
      await relatedGate;
      await route.continue();
    });

    try {
      await anonymousPage.setViewportSize({ width: 1280, height: 900 });
      await anonymousPage.goto(publicPiece.viewer_url);
      await expect(anonymousPage.getByRole('heading', { name: source.title })).toBeVisible();
      await expect(anonymousPage.locator('.piece-stage-shell')).toBeVisible();
      await expect(anonymousPage.getByRole('heading', { name: 'More like this' })).toHaveCount(0);
      const stageBefore = await anonymousPage.locator('.piece-stage-shell').boundingBox();

      releaseRelated();
      await expect(anonymousPage.getByRole('heading', { name: 'More like this' })).toBeVisible();
      for (const candidate of [firstRelated, secondRelated]) {
        await expect(
          anonymousPage.getByRole('link', { name: new RegExp(candidate.title) }),
        ).toBeVisible();
      }
      const stageAfter = await anonymousPage.locator('.piece-stage-shell').boundingBox();
      expect(stageBefore).not.toBeNull();
      expect(stageAfter).not.toBeNull();
      expect(stageAfter?.x).toBe(stageBefore?.x);
      expect(stageAfter?.y).toBe(stageBefore?.y);
      expect(stageAfter?.width).toBe(stageBefore?.width);
      expect(stageAfter?.height).toBe(stageBefore?.height);
      const detailsBox = await anonymousPage.locator('.public-piece-version-context').boundingBox();
      const relatedBox = await anonymousPage
        .getByRole('heading', { name: 'More like this' })
        .locator('..')
        .boundingBox();
      expect(detailsBox).not.toBeNull();
      expect(relatedBox?.y).toBeGreaterThan((detailsBox?.y ?? 0) + (detailsBox?.height ?? 0));
      const canonicalRelatedRequestCount = relatedRequestCount;
      expect(canonicalRelatedRequestCount).toBeGreaterThan(0);

      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 375, height: 812 },
      ]) {
        await anonymousPage.setViewportSize(viewport);
        await expect(anonymousPage.getByRole('heading', { name: 'More like this' })).toBeVisible();
        const layout = await anonymousPage.evaluate(() => ({
          width: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
        }));
        expect(layout.documentWidth).toBeLessThanOrEqual(layout.width);
      }

      await anonymousPage.goto(`/embed/p/${source.id}`);
      await expect(anonymousPage.locator('.piece-stage-shell')).toBeVisible();
      await expect(anonymousPage.getByRole('heading', { name: 'More like this' })).toHaveCount(0);
      expect(relatedRequestCount).toBe(canonicalRelatedRequestCount);

      const immersiveUrl = publicPiece.viewer_url.replace('/pieces/', '/immersive/');
      await anonymousPage.goto(immersiveUrl);
      await expect(anonymousPage.locator('.public-project-viewer')).toBeVisible();
      await expect(anonymousPage.getByRole('heading', { name: 'More like this' })).toHaveCount(0);
      expect(relatedRequestCount).toBe(canonicalRelatedRequestCount);

      await page.goto(`/projects/${source.id}`);
      await page.waitForURL(/\/users\/@[^/]+\/edit\/[^/]+$/);
      await expect(page.locator('.editor-workspace')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'More like this' })).toHaveCount(0);
    } finally {
      releaseRelated();
      await anonymousContext.close();
    }
  });
});
