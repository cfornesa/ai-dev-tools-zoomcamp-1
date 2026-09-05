import { expect, test } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #435: art pieces had no chrome-less embed entry point at all --
 * `App.tsx` registered generated regular and immersive pages, but no
 * `embed/art-pieces/:id` sibling route existed, and `PublicArtPieceViewer.tsx`
 * had no "copy embed code" affordance. This suite verifies the same
 * convention `PublicProjectViewer.tsx`'s `embed/p/:id` already
 * establishes: one component serving both the full-chrome page and its
 * chrome-less embed sibling route, distinguished only by an
 * `isEmbedRoute` check.
 */

const CANVAS_RED_RECTANGLE =
  '<canvas id="art-piece-canvas" width="320" height="240"></canvas>' +
  '<script>var c=document.getElementById("art-piece-canvas");' +
  'var x=c.getContext("2d");x.fillStyle="#dc2626";x.fillRect(0,0,320,240);</script>';

test.describe('Generated regular embed: chrome-less published-piece entry point (#435)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('the regular public page copies a correctly escaped iframe embed snippet', async ({
    page,
    context,
    browserName,
  }) => {
    // Clipboard permission grants are a Chromium-only Playwright/CDP
    // capability -- firefox/webkit have no such API to grant at all.
    // The textarea's own value (verified on every browser below) is the
    // actually-escaped snippet; the real clipboard round-trip is an
    // additional Chromium-only check on top of that, not a replacement
    // for it.
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Embed snippet fixture',
      description: 'A published piece used to verify the embed snippet.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: { screenshot: true },
      source: CANVAS_RED_RECTANGLE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    await page.goto(`/art-pieces/p/${piece.public_id}`);
    await expect(page.getByRole('heading', { name: 'Embed snippet fixture' })).toBeVisible();
    await page.getByTestId('toggle-embed-snippet').click();
    const textarea = page.locator('#art-piece-embed-snippet-textarea');
    const expectedSrc = new RegExp(
      `<iframe src="${new URL(page.url()).origin}/embed/art-pieces/${piece.public_id}" width="800" height="600" frameborder="0" allowfullscreen></iframe>`,
    );
    await expect(textarea).toHaveValue(expectedSrc);

    await page.getByRole('button', { name: 'Copy' }).click();
    await expect(page.getByText('Copied!')).toBeVisible();
    if (browserName === 'chromium') {
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toMatch(expectedSrc);
    }
  });

  test('the embed route renders chrome-less with a functional stage toolbar, at both viewports', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Embed viewer fixture',
      description: 'A published piece used to verify the chrome-less embed route.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: { screenshot: true, download: false, fullscreen: true },
      source: CANVAS_RED_RECTANGLE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    // A fresh, unauthenticated context -- an embed on a third-party site
    // is loaded by an anonymous visitor, not the signed-in owner.
    const anonContext = await context.browser()!.newContext();
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      const anonPage = await anonContext.newPage();
      await anonPage.setViewportSize(viewport);
      await anonPage.goto(`/embed/art-pieces/${piece.public_id}`);

      // No site header, title, description, embed button or back link --
      // just the stage.
      await expect(anonPage.getByRole('heading', { name: 'Embed viewer fixture' })).toHaveCount(0);
      await expect(anonPage.getByText('A published piece used to verify')).toHaveCount(0);
      await expect(anonPage.getByTestId('toggle-embed-snippet')).toHaveCount(0);
      await expect(anonPage.getByRole('link', { name: 'Back to public art pieces' })).toHaveCount(
        0,
      );
      await expect(anonPage.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0);

      // The stage toolbar is still fully present and functional --
      // "no duplicated toolbar" means no *page* chrome, not a missing
      // piece toolbar.
      await expect(anonPage.getByRole('toolbar', { name: 'Piece actions' })).toBeVisible();
      const screenshotDownload = anonPage.waitForEvent('download');
      await anonPage.getByRole('button', { name: 'Take screenshot' }).click();
      const screenshot = await screenshotDownload;
      expect(screenshot.suggestedFilename()).toMatch(/\.png$/);
      await expect(
        anonPage.getByRole('button', { name: /expand fullscreen|exit fullscreen/i }),
      ).toBeVisible();

      // No horizontal overflow -- the stage (including the art-piece
      // iframe itself) stays contained at both viewports. Caught a real
      // bug during verification: browsers apply a default iframe border
      // a few px wide unless reset, which (with the iframe's default
      // content-box sizing) added to its 100%-width box and overflowed
      // the stage by exactly the border's width -- fixed with an
      // explicit `border: 'none'` alongside the existing `width: '100%'`.
      const widths = await anonPage.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth);

      await anonPage.close();
    }
    await anonContext.close();
  });

  test('draft and archived pieces remain unavailable on the embed route', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);

    const draft = await apiPost(context, '/api/art-pieces/', {
      title: 'Draft embed fixture',
      description: 'Never published.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: {},
      source: CANVAS_RED_RECTANGLE,
    });
    expect(draft.status()).toBe(201);
    const draftPiece = (await draft.json()) as { public_id: string };

    const archived = await apiPost(context, '/api/art-pieces/', {
      title: 'Archived embed fixture',
      description: 'Published then archived.',
      prompt: 'red rectangle',
      engine: 'canvas2d',
      capabilities: {},
      source: CANVAS_RED_RECTANGLE,
    });
    expect(archived.status()).toBe(201);
    const archivedPiece = (await archived.json()) as { public_id: string };
    await apiPatch(context, `/api/art-pieces/${archivedPiece.public_id}/`, {
      status: 'published',
    });
    await apiPatch(context, `/api/art-pieces/${archivedPiece.public_id}/`, {
      status: 'archived',
    });

    const anonContext = await context.browser()!.newContext();
    const anonPage = await anonContext.newPage();
    for (const publicId of [draftPiece.public_id, archivedPiece.public_id]) {
      await anonPage.goto(`/embed/art-pieces/${publicId}`);
      await expect(anonPage.getByRole('alert')).toContainText("isn't available");
    }
    await anonContext.close();
  });
});
