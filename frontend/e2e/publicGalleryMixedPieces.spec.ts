/** Issue #491: the unified public gallery must surface published authored 2D,
 *  authored 3D, and generated art pieces through one anonymous-reachable
 *  listing with a visible type filter. */
import { expect, test } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function publishFrom2D(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'More creation options' }).click();
  await page.getByRole('menuitem', { name: 'Create an AI-assisted animation' }).click();
  await page.waitForURL(/\/ai-projects\/[^/]+$/);
  const projectId = /\/ai-projects\/([^/]+)$/.exec(page.url())?.[1];
  expect(projectId).toBeTruthy();
  if (!projectId) throw new Error('Could not determine the created 2D project id.');

  const metadata = await apiPatch(page.context(), `/api/projects/${projectId}/`, {
    // Issue #392: a per-run-unique title, not a hardcoded one --
    // this spec is exercised across multiple Playwright browser projects
    // (chromium/firefox/webkit) against the same disposable database within
    // one `browser-qa.sh` run, so a fixed title collides with an earlier
    // browser project's still-published fixture and makes every gallery
    // assertion below ambiguous (a strict-mode "resolved to 2 elements"
    // failure), not just flaky.
    title: `Gallery 2D fixture ${projectId}`,
    description: 'A public gallery 2D fixture.',
  });
  expect(metadata.ok()).toBe(true);
  await page.reload();
  const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
  await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
  await toolbar
    .getByRole('dialog')
    .getByRole('button', { name: 'Publication status: Draft' })
    .click();
  await toolbar
    .getByRole('group', { name: 'Publication status', exact: true })
    .getByRole('button', { name: 'Published', exact: true })
    .click();
  const confirmation = page.getByRole('alertdialog', { name: /Publish/ });
  await confirmation.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByTestId('visibility-status')).toContainText('Published (public)');
  return projectId;
}

async function publishFrom3D(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'More creation options' }).click();
  await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
  await page.waitForURL(/\/projects3d\/[^/]+$/);
  const projectId = /\/projects3d\/([^/]+)$/.exec(page.url())?.[1];
  expect(projectId).toBeTruthy();
  if (!projectId) throw new Error('Could not determine the created 3D project id.');

  const metadata = await apiPatch(page.context(), `/api/projects3d/${projectId}/`, {
    // Same per-run-unique-title rationale as `publishFrom2D` above.
    title: `Gallery 3D fixture ${projectId}`,
  });
  expect(metadata.ok()).toBe(true);
  await page.reload();
  // Issue #394 moved the 3D editor's owner-facing publication disclosure and
  // Draft/Published switch out of the stage-local toolbar popover and into
  // the editor header (`PublishControl3D.tsx`'s non-`compact` branch), so
  // this reaches the group directly rather than opening the toolbar's piece
  // controls menu first.
  const status = page.getByRole('group', { name: 'Publication status', exact: true });
  await status.getByRole('button', { name: 'Published', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: /Publish/ });
  await confirmation.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');
  return projectId;
}

async function publishGeneratedArtPiece(
  context: import('@playwright/test').BrowserContext,
  title: string,
): Promise<string> {
  // Issue #491: create and publish a generated art piece via the API so the
  // unified gallery has a generated fixture alongside the authored 2D/3D ones.
  const created = await apiPost(context, '/api/art-pieces/', {
    title,
    description: 'A public gallery generated fixture.',
    prompt: 'blue rectangle',
    engine: 'canvas2d',
    capabilities: {
      screenshot: true,
      download: true,
      fullscreen: true,
    },
    source:
      '<canvas id="art-piece-canvas" width="320" height="240"></canvas><script>var c=document.getElementById("art-piece-canvas"); var x=c.getContext("2d"); x.fillStyle="#2463eb"; x.fillRect(0,0,320,240);</script>',
  });
  expect(created.status()).toBe(201);
  const piece = (await created.json()) as { public_id: string };
  const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
    status: 'published',
  });
  expect(published.status()).toBe(200);
  return piece.public_id;
}

test.describe('mixed public gallery', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('shows published 2D, 3D, and generated cards to anonymous visitors at desktop and mobile widths', async ({
    page,
    browser,
    context,
  }, testInfo) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const project2dId = await publishFrom2D(page);
    const project3dId = await publishFrom3D(page);
    const artPieceId = await publishGeneratedArtPiece(
      context,
      `Gallery generated fixture ${testInfo.project.name}`,
    );

    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    try {
      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 375, height: 812 },
      ]) {
        await anonymousPage.setViewportSize(viewport);
        await anonymousPage.goto('/gallery');
        await expect(anonymousPage.getByRole('heading', { name: 'Public gallery' })).toBeVisible();
        await expect(anonymousPage.getByRole('combobox', { name: 'Gallery type' })).toHaveValue(
          'all',
        );

        // Scoped by stable test ids rather than title text -- see the
        // per-run-unique-title comment in `publishFrom2D` above for why a
        // text-based match is ambiguous within one `browser-qa.sh` run.
        const card2d = anonymousPage.getByTestId(`gallery-card-${project2dId}`);
        const card3d = anonymousPage.getByTestId(`gallery-card-${project3dId}`);
        const cardGenerated = anonymousPage.getByTestId(`gallery-card-${artPieceId}`);
        await expect(card2d).toBeVisible();
        await expect(card3d).toBeVisible();
        await expect(cardGenerated).toBeVisible();

        await expect(card2d.locator('.renderer-badge')).toHaveText('2D');
        await expect(card3d.locator('.renderer-badge')).toHaveText('3D');
        await expect(cardGenerated.locator('.renderer-badge')).toHaveText('Generated');
        await expect(cardGenerated.locator('.engine-label')).toHaveText('canvas2d');

        await expect(
          anonymousPage.getByRole('link', {
            name: new RegExp(`gallery 2d fixture ${project2dId}`, 'i'),
          }),
        ).toHaveAttribute('href', `/p/${project2dId}`);
        await expect(
          anonymousPage.getByRole('link', {
            name: new RegExp(`gallery 3d fixture ${project3dId}`, 'i'),
          }),
        ).toHaveAttribute('href', `/p3d/${project3dId}`);
        await expect(
          anonymousPage.getByRole('link', {
            name: new RegExp(`gallery generated fixture`, 'i'),
          }),
        ).toHaveAttribute('href', `/art-pieces/p/${artPieceId}`);

        // Issue #491: rendered evidence must show the All filter state with
        // all three card kinds visible.
        await anonymousPage.screenshot({
          path: testInfo.outputPath(`gallery-all-${viewport.width}.png`),
          fullPage: true,
        });

        // Issue #491: the Authored filter hides generated pieces; the
        // Generated filter shows only generated pieces.
        await anonymousPage
          .getByRole('combobox', { name: 'Gallery type' })
          .selectOption('authored');
        await expect(card2d).toBeVisible();
        await expect(card3d).toBeVisible();
        await expect(cardGenerated).not.toBeVisible();

        await anonymousPage
          .getByRole('combobox', { name: 'Gallery type' })
          .selectOption('generated');
        await expect(card2d).not.toBeVisible();
        await expect(card3d).not.toBeVisible();
        await expect(cardGenerated).toBeVisible();

        await anonymousPage.screenshot({
          path: testInfo.outputPath(`gallery-generated-${viewport.width}.png`),
          fullPage: true,
        });
      }
    } finally {
      await anonymousContext.close();
    }
  });

  test('legacy /art-pieces/gallery redirects to the generated-filter unified gallery', async ({
    browser,
  }) => {
    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    try {
      await anonymousPage.goto('/art-pieces/gallery');
      await anonymousPage.waitForURL('/gallery?type=generated');
      await expect(anonymousPage.getByRole('heading', { name: 'Public gallery' })).toBeVisible();
      await expect(anonymousPage.getByRole('combobox', { name: 'Gallery type' })).toHaveValue(
        'generated',
      );
    } finally {
      await anonymousContext.close();
    }
  });
});
