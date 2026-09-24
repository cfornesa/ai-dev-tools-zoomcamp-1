/**
 * Issue #750: the URL slug is its own field, separate from the title, for 2D, 3D, and generated pieces.
 * Renaming never changes the slug; editing it moves the piece to the new address; the old address stops
 * working (owner decision: no redirects); a taken slug is refused with a clear message.
 */
import { expect, test, type Page } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { createBlankProjectViaUI } from './support/createProject.js';
import { createBlank3DProjectViaUI } from './support/createProject3d.js';
import { expandAllCollapsibleSections } from './support/expandCollapsibleSections.js';
import { requireE2EFixtures } from './support/prerequisites.js';

async function editSlug(page: Page, slug: string) {
  const field = page.getByTestId('piece-slug-field');
  await field.getByLabel('Public URL slug').fill(slug);
  await field.getByRole('button', { name: 'Save slug' }).click();
}

test.describe('independent piece slug (#750)', () => {
  const fixtures = requireE2EFixtures();

  test('structured 2D: rename keeps the slug; a slug edit moves the editor URL; the old URL stops working', async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(120_000);
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const id = await createBlankProjectViaUI(page);
    const oldSlug = new URL(page.url()).pathname.split('/').pop()!;

    // Renaming the title leaves the slug alone.
    expect(
      (await apiPatch(context, `/api/projects/${id}/`, { title: 'Totally Different Title' })).ok(),
    ).toBe(true);
    const renamed = (await (await apiGet(context, `/api/projects/${id}/`)).json()) as {
      public_slug: string;
    };
    expect(renamed.public_slug).toBe(oldSlug);

    await page.reload();
    await expandAllCollapsibleSections(page);
    await expect(page.getByTestId('piece-slug-field')).toBeVisible();
    await page.getByTestId('piece-slug-field').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('2d-slug-field.png') });

    const newSlug = `renamed-${Date.now().toString(36)}`;
    await editSlug(page, newSlug);
    await page.waitForURL(new RegExp(`/users/@[^/]+/edit/${newSlug}$`));
    await expect(page.getByRole('status').filter({ hasText: 'Slug saved.' })).toBeVisible();

    // The old address no longer resolves for the owner.
    const handle = new URL(page.url()).pathname.split('/')[2]!.replace('@', '');
    expect((await apiGet(context, `/api/users/@${handle}/edit/${oldSlug}/`)).status()).toBe(404);
    await page.goto(`/users/@${handle}/edit/${oldSlug}`);
    await expect(
      page
        .getByRole('alert')
        .or(page.getByRole('heading', { name: /gallery/i }))
        .first(),
    ).toBeVisible();

    // A slug already in use is refused with a readable message.
    const other = await createBlankProjectViaUI(page);
    const taken = (await (await apiGet(context, `/api/projects/${id}/`)).json()) as {
      public_slug: string;
    };
    const clash = await apiPatch(context, `/api/projects/${other}/`, {
      public_slug: taken.public_slug,
    });
    expect(clash.status()).toBe(400);
    await page.reload();
    await expandAllCollapsibleSections(page);
    await editSlug(page, taken.public_slug);
    await expect(page.getByTestId('piece-slug-error')).toContainText('already in use');
  });

  test('structured 3D and generated pieces: the same contract', async ({ page, context }) => {
    test.setTimeout(120_000);
    await loginViaUI(page, fixtures.owner.email, fixtures.password);

    // 3D, through the "Web address" disclosure.
    const id3d = await createBlank3DProjectViaUI(page);
    await page.locator('summary', { hasText: 'Web address' }).click();
    const slug3d = `three-d-${Date.now().toString(36)}`;
    await editSlug(page, slug3d);
    await page.waitForURL(new RegExp(`/users/@[^/]+/edit/${slug3d}$`));
    const saved3d = (await (await apiGet(context, `/api/projects3d/${id3d}/`)).json()) as {
      public_slug: string;
    };
    expect(saved3d.public_slug).toBe(slug3d);
    expect(
      (await apiPatch(context, `/api/projects3d/${id3d}/`, { title: 'Another 3D title' })).ok(),
    ).toBe(true);
    expect(
      (
        (await (await apiGet(context, `/api/projects3d/${id3d}/`)).json()) as {
          public_slug: string;
        }
      ).public_slug,
    ).toBe(slug3d);

    // Generated piece.
    const profile = (await (await apiGet(context, '/api/account/profile/')).json()) as {
      handle: string;
    };
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Slug generated',
      description: 'Slug fixture.',
      prompt: 'slug',
      engine: 'svg',
      public_slug: `gen-${Date.now().toString(36)}`,
      source: '<svg id="art-piece-svg" viewBox="0 0 10 10"></svg>',
    });
    const piece = (await created.json()) as { public_slug: string };
    await page.goto(`/users/@${profile.handle}/edit/${piece.public_slug}`);
    const genSlug = `gen-new-${Date.now().toString(36)}`;
    await expect(page.getByTestId('piece-slug-field')).toBeVisible();
    await editSlug(page, genSlug);
    await page.waitForURL(new RegExp(`/users/@[^/]+/edit/${genSlug}$`));
  });
});
