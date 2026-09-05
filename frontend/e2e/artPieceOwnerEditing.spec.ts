import { expect, test, type Page } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #429: `ArtPieceManagement.tsx` linked every saved piece straight
 * to the public-only viewer, which 404s for anything not Published, and
 * no owner edit route existed at all -- the Studio's own `handleSave`
 * always creates a brand new piece, never a new version on an existing
 * one. This suite drives the real `/art-pieces/manage` -> owner editor
 * flow: card routing by status, edit + revise + version history, thumbnail
 * regeneration, soft-delete with confirmation, and cross-user denial.
 */

const RED_RECTANGLE =
  '<canvas id="art-piece-canvas" width="320" height="240"></canvas>' +
  '<script>var c=document.getElementById("art-piece-canvas");' +
  'var x=c.getContext("2d");x.fillStyle="#dc2626";x.fillRect(0,0,320,240);</script>';

async function generateRevision(page: Page, prompt: string): Promise<void> {
  await page.getByLabel('Describe the revision you want to generate').fill(prompt);
  await page.getByRole('button', { name: 'Generate revision' }).click();
  await expect(page.getByTestId('art-piece-editor-preview')).toBeVisible();
  // #457: the same cross-origin-iframe requestAnimationFrame throttling
  // documented for the Studio's own generate flow applies here too.
  await page.getByTestId('art-piece-editor-preview').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('art-piece-editor-save-version')).toBeVisible();
}

test.describe('Generated owner management: reopen and revise a saved piece (#429)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('Draft and Archived cards open the editor; only Published cards also expose a public link', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);

    async function seed(title: string, status: 'draft' | 'published' | 'archived') {
      const created = await apiPost(context, '/api/art-pieces/', {
        title,
        description: 'Owner editing fixture.',
        prompt: 'red rectangle',
        engine: 'canvas2d',
        capabilities: {},
        source: RED_RECTANGLE,
      });
      expect(created.status()).toBe(201);
      const piece = (await created.json()) as { public_id: string };
      if (status !== 'draft') {
        await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, { status: 'published' });
      }
      if (status === 'archived') {
        await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, { status: 'archived' });
      }
      return piece.public_id;
    }

    const draftId = await seed('Routing draft fixture', 'draft');
    const publishedId = await seed('Routing published fixture', 'published');
    const archivedId = await seed('Routing archived fixture', 'archived');

    await page.goto('/art-pieces/manage');
    await expect(page.getByRole('heading', { name: 'Your art pieces' })).toBeVisible();

    await expect(page.getByRole('link', { name: 'Routing draft fixture' })).toHaveAttribute(
      'href',
      `/art-pieces/${draftId}/edit`,
    );
    await expect(page.getByRole('link', { name: 'Routing archived fixture' })).toHaveAttribute(
      'href',
      `/art-pieces/${archivedId}/edit`,
    );
    await expect(page.getByRole('link', { name: 'Routing published fixture' })).toHaveAttribute(
      'href',
      `/art-pieces/${publishedId}/edit`,
    );

    const draftItem = page.getByRole('link', { name: 'Routing draft fixture' }).locator('..');
    const archivedItem = page.getByRole('link', { name: 'Routing archived fixture' }).locator('..');
    const publishedItem = page
      .getByRole('link', { name: 'Routing published fixture' })
      .locator('..');
    await expect(draftItem.getByRole('link', { name: 'View public page' })).toHaveCount(0);
    await expect(archivedItem.getByRole('link', { name: 'View public page' })).toHaveCount(0);
    await expect(publishedItem.getByRole('link', { name: 'View public page' })).toHaveAttribute(
      'href',
      `/art-pieces/p/${publishedId}`,
    );
  });

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`edit metadata, generate and save a revision, and see it reflected in the version list after reload at ${viewport.width}x${viewport.height}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixture.owner.email, fixture.password);
      const title = `Revision fixture ${viewport.width}`;
      const created = await apiPost(context, '/api/art-pieces/', {
        title,
        description: 'Original description.',
        prompt: 'red rectangle',
        engine: 'canvas2d',
        capabilities: { screenshot: true },
        source: RED_RECTANGLE,
      });
      expect(created.status()).toBe(201);
      const piece = (await created.json()) as { public_id: string };

      await page.goto(`/art-pieces/${piece.public_id}/edit`);
      await expect(page.getByRole('heading', { name: `Edit ${title}` })).toBeVisible();

      // Metadata edit + reload proves persistence, not just component state.
      const revisedTitle = `Revised title ${viewport.width}`;
      await page.getByLabel('Piece title').fill(revisedTitle);
      await page.getByLabel('Piece description').fill('Revised description.');
      await page.getByTestId('art-piece-editor-save-metadata').click();
      await expect(page.getByRole('heading', { name: `Edit ${revisedTitle}` })).toBeVisible();
      await page.goto(`/art-pieces/${piece.public_id}/edit`);
      await expect(page.getByRole('heading', { name: `Edit ${revisedTitle}` })).toBeVisible();
      await expect(page.getByLabel('Piece description')).toHaveValue('Revised description.');

      // One version exists before any revision is saved.
      await expect(
        page.getByTestId('art-piece-editor-version-list').getByRole('listitem'),
      ).toHaveCount(1);

      await generateRevision(page, 'a blue rectangle instead');
      await page.getByTestId('art-piece-editor-capability-download').locator('input').check();
      await page.getByTestId('art-piece-editor-save-version').click();
      await expect(page.getByTestId('art-piece-editor-save-version')).toHaveCount(0);

      const versionItems = page.getByTestId('art-piece-editor-version-list').getByRole('listitem');
      await expect(versionItems).toHaveCount(2);
      await expect(versionItems.first()).toContainText('(current)');
      await expect(versionItems.first()).toContainText('Version 2');
      await expect(versionItems.last()).toContainText('Version 1');
      await expect(versionItems.last()).not.toContainText('(current)');

      // The previous version's source is untouched -- immutable history.
      const versionsResponse = await apiGet(
        context,
        `/api/art-pieces/${piece.public_id}/versions/`,
      );
      const versions = (await versionsResponse.json()) as Array<{
        sequence: number;
        source: string;
        capabilities: Record<string, boolean>;
      }>;
      expect(versions).toHaveLength(2);
      expect(versions.find((v) => v.sequence === 1)!.source).toBe(RED_RECTANGLE);
      expect(versions.find((v) => v.sequence === 2)!.capabilities.download).toBe(true);

      // Reload again after the new version -- the current version persisted.
      await page.goto(`/art-pieces/${piece.public_id}/edit`);
      await expect(
        page.getByTestId('art-piece-editor-version-list').getByRole('listitem').first(),
      ).toContainText('(current)');
    });
  }

  test('a failed metadata save retains the typed input instead of clearing it', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Failure recovery fixture',
      description: 'Original.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: {},
      source: RED_RECTANGLE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };

    await page.goto(`/art-pieces/${piece.public_id}/edit`);
    await page.route(`**/api/art-pieces/${piece.public_id}/`, (route) => {
      if (route.request().method() === 'PATCH') {
        void route.fulfill({ status: 500, body: '{}' });
        return;
      }
      void route.continue();
    });

    await page.getByLabel('Piece title').fill('Typed but not yet saved');
    await page.getByTestId('art-piece-editor-save-metadata').click();
    await expect(page.getByRole('alert')).toContainText('Could not save these changes');
    await expect(page.getByLabel('Piece title')).toHaveValue('Typed but not yet saved');
  });

  test('concurrent version saves on the same piece never overwrite each other', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Concurrency fixture',
      description: 'Original.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: {},
      source: RED_RECTANGLE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };

    const [first, second] = await Promise.all([
      apiPost(context, `/api/art-pieces/${piece.public_id}/versions/`, {
        source: '<canvas id="a"></canvas>',
        capabilities: {},
      }),
      apiPost(context, `/api/art-pieces/${piece.public_id}/versions/`, {
        source: '<canvas id="b"></canvas>',
        capabilities: {},
      }),
    ]);
    expect(first.status()).toBe(201);
    expect(second.status()).toBe(201);
    const firstSequence = ((await first.json()) as { sequence: number }).sequence;
    const secondSequence = ((await second.json()) as { sequence: number }).sequence;
    expect(new Set([firstSequence, secondSequence]).size).toBe(2);

    const versionsResponse = await apiGet(context, `/api/art-pieces/${piece.public_id}/versions/`);
    const versions = (await versionsResponse.json()) as Array<{ sequence: number }>;
    // The original version plus both concurrent saves -- neither
    // clobbered the other or the original.
    expect(versions.map((v) => v.sequence).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  test('owner can regenerate the thumbnail and soft-delete with confirmation; cancelling preserves the piece', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Deletion fixture',
      description: 'Original.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: {},
      source: RED_RECTANGLE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };

    await page.goto(`/art-pieces/${piece.public_id}/edit`);
    const thumbnailBefore = await page.locator('img').getAttribute('src');
    await page.getByTestId('art-piece-editor-regenerate-thumbnail').click();
    await expect.poll(() => page.locator('img').getAttribute('src')).not.toBe(thumbnailBefore);

    // Cancel preserves the piece.
    await page.getByRole('button', { name: 'Delete piece' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    const stillThere = await apiGet(context, `/api/art-pieces/${piece.public_id}/`);
    expect(stillThere.status()).toBe(200);

    // Confirm actually deletes and navigates away.
    await page.getByRole('button', { name: 'Delete piece' }).click();
    await page.getByTestId('art-piece-editor-confirm-delete').click();
    await expect(page).toHaveURL(/\/art-pieces\/manage$/);
    const afterDelete = await apiGet(context, `/api/art-pieces/${piece.public_id}/`);
    expect(afterDelete.status()).toBe(404);
  });

  test("a non-owner cannot read or write another owner's piece through the editor API, without existence leakage", async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Cross-user denial fixture',
      description: 'Owner-only.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: {},
      source: RED_RECTANGLE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };

    const otherContext = await context.browser()!.newContext();
    const otherPage = await otherContext.newPage();
    await loginViaUI(otherPage, fixture.other.email, fixture.password);

    const deniedRead = await apiGet(otherContext, `/api/art-pieces/${piece.public_id}/`);
    expect(deniedRead.status()).toBe(404);
    const deniedVersions = await apiGet(
      otherContext,
      `/api/art-pieces/${piece.public_id}/versions/`,
    );
    expect(deniedVersions.status()).toBe(404);
    const deniedWrite = await apiPost(
      otherContext,
      `/api/art-pieces/${piece.public_id}/versions/`,
      {
        source: '<canvas></canvas>',
        capabilities: {},
      },
    );
    expect(deniedWrite.status()).toBe(404);

    // A non-owner visiting the editor route directly sees the same
    // generic unavailable state a deleted/nonexistent piece would --
    // never a distinguishable "not yours" message.
    await otherPage.goto(`/art-pieces/${piece.public_id}/edit`);
    await expect(otherPage.getByRole('alert')).toContainText("isn't available");

    await otherContext.close();
  });
});
