/** Issue #744: public generated-piece surface contract matrix. */
import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';

import { apiDelete, apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const SOURCE =
  '<canvas id="art-piece-canvas" width="320" height="240"></canvas>' +
  '<script>const c=document.getElementById("art-piece-canvas");' +
  'const x=c.getContext("2d");x.fillStyle="#2563eb";x.fillRect(0,0,320,240);</script>';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
] as const;

type Piece = {
  public_id: string;
  public_slug: string;
  title: string;
  engine: string;
  engine_label?: string;
  description: string;
  current_version: {
    sequence: number;
    capabilities: Record<string, boolean>;
  };
};

async function createPublishedPiece(context: BrowserContext): Promise<Piece> {
  const created = await apiPost(context, '/api/art-pieces/', {
    title: `Surface matrix ${Date.now().toString(36)}`,
    description: 'A single current-version fixture shared by every public surface.',
    prompt: 'A blue rectangle for the public surface contract matrix.',
    engine: 'canvas2d',
    capabilities: {
      screenshot: true,
      download: true,
      fullscreen: true,
      sound: false,
      camera_view: false,
      hand_steering: false,
      immersive: true,
    },
    source: SOURCE,
  });
  expect(created.status()).toBe(201);
  const piece = (await created.json()) as Piece;
  const version = await apiPost(context, `/api/art-pieces/${piece.public_id}/versions/`, {
    source: SOURCE.replace('#2563eb', '#0f766e'),
    prompt: 'The saved current version is a teal rectangle.',
    generation_metadata: { model_label: 'Surface matrix model' },
    capabilities: {
      screenshot: true,
      download: true,
      fullscreen: true,
      sound: false,
      camera_view: false,
      hand_steering: false,
      immersive: true,
    },
  });
  expect(version.status()).toBe(201);
  const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
    status: 'published',
  });
  expect(published.status()).toBe(200);
  const detail = await apiGet(context, `/api/art-pieces/${piece.public_id}/`);
  expect(detail.status()).toBe(200);
  return (await detail.json()) as Piece;
}

async function expectUnavailable(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('alert')).toContainText("isn't available");
}

test.describe('public generated-piece surface contract matrix (#744)', () => {
  test('keeps route consumers aligned with one published current version', async ({
    browser,
  }, testInfo: TestInfo) => {
    const fixtures = requireE2EFixtures();
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);

    const profileResponse = await apiGet(ownerContext, '/api/account/profile/');
    expect(profileResponse.status()).toBe(200);
    const { handle } = (await profileResponse.json()) as { handle: string };
    const piece = await createPublishedPiece(ownerContext);
    const canonicalPath = `/users/@${handle}/pieces/${piece.public_slug}`;
    const canonicalImmersivePath = `/users/@${handle}/immersive/${piece.public_slug}`;
    const directPath = `/art-pieces/p/${piece.public_id}`;
    const embedPath = `/embed/art-pieces/${piece.public_id}`;
    const immersiveEmbedPath = `/embed/art-pieces/immersive/${piece.public_id}`;

    // A collection is another public consumer of the same generated piece.
    const collectionResponse = await apiPost(ownerContext, '/api/account/collections/', {
      title: `Surface collection ${piece.public_id}`,
      description: 'Collection consumer for the public surface matrix.',
    });
    expect(collectionResponse.status()).toBe(201);
    const collection = (await collectionResponse.json()) as {
      id: string;
      slug: string;
      title: string;
    };
    const itemResponse = await apiPost(
      ownerContext,
      `/api/account/collections/${collection.id}/items/`,
      { items: [{ kind: 'art_piece', id: piece.public_id }] },
    );
    expect(itemResponse.status()).toBe(200);
    expect(
      (await apiPost(ownerContext, `/api/account/collections/${collection.id}/publish/`)).status(),
    ).toBe(200);
    const collectionPath = `/users/@${handle}/collections/${collection.slug}`;
    const collectionImmersivePath = `${collectionPath}/immersive`;
    const collectionEmbedPath = `/embed/collections/@${handle}/${collection.slug}`;

    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    try {
      const publicPayload = await apiGet(
        publicContext,
        `/api/users/@${handle}/pieces/${piece.public_slug}/`,
      );
      expect(publicPayload.status()).toBe(200);
      const canonicalPayload = (await publicPayload.json()) as {
        canonical_url: string;
        type: string;
        piece: Piece & { versions: Array<{ engine: string; sequence: number }> };
      };
      expect(canonicalPayload.canonical_url).toBe(canonicalPath);
      expect(canonicalPayload.type).toBe('generated');
      expect(canonicalPayload.piece.title).toBe(piece.title);
      expect(canonicalPayload.piece.engine).toBe('canvas2d');
      expect(canonicalPayload.piece.current_version.sequence).toBe(2);
      expect(canonicalPayload.piece.current_version.capabilities).toMatchObject({
        download: true,
        immersive: true,
        camera_view: false,
        sound: false,
      });
      expect(canonicalPayload.piece.versions[0].sequence).toBe(2);

      for (const viewport of VIEWPORTS) {
        await publicPage.setViewportSize(viewport);

        await test.step(`${viewport.name}: canonical regular and direct links`, async () => {
          for (const [label, path] of [
            ['canonical regular', canonicalPath],
            ['direct shared', directPath],
          ] as const) {
            await publicPage.goto(path);
            await expect(publicPage.getByRole('heading', { name: piece.title })).toBeVisible();
            if (label === 'canonical regular') {
              await expect(
                publicPage
                  .getByRole('region', { name: 'Current version context' })
                  .getByRole('definition')
                  .filter({ hasText: 'canvas2d' }),
              ).toBeVisible();
            } else {
              await expect(
                publicPage.getByRole('region', { name: 'Current version context' }),
              ).toHaveCount(0);
            }
            await expect(publicPage.getByRole('region', { name: 'Art piece stage' })).toBeVisible();
            await expect(publicPage.getByRole('toolbar', { name: 'Piece actions' })).toBeVisible();
            await expect(publicPage.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
            await expect(
              publicPage.getByRole('button', { name: 'Open download menu' }),
            ).toBeVisible();
            if (label === 'canonical regular') {
              await expect(
                publicPage.getByRole('button', { name: 'Open immersive view' }),
              ).toBeVisible();
              await expect(publicPage.getByRole('button', { name: 'Share' })).toBeVisible();
              await expect(publicPage.getByRole('button', { name: 'Embed' })).toBeVisible();
            } else {
              await expect(
                publicPage.getByRole('button', { name: 'Open immersive view' }),
              ).toHaveCount(0);
              await expect(publicPage.getByRole('button', { name: 'Share' })).toHaveCount(0);
              await expect(publicPage.getByRole('button', { name: 'Embed' })).toBeVisible();
            }
            if (label === 'canonical regular') {
              await expect(
                publicPage.getByRole('heading', { name: 'Current version context' }),
              ).toBeVisible();
              await expect(
                publicPage
                  .getByRole('region', { name: 'Current version context' })
                  .getByText('A blue rectangle for the public surface contract matrix.'),
              ).toBeVisible();
              await expect(publicPage.getByText('CURRENT', { exact: true })).toBeVisible();
            } else {
              await expect(
                publicPage.getByRole('heading', { name: 'Current version context' }),
              ).toHaveCount(0);
            }
            if (label === 'canonical regular') {
              await publicPage.getByRole('button', { name: 'Embed' }).click();
              await expect(publicPage.getByLabel('Embed this piece on another site')).toHaveValue(
                new RegExp(`/embed/art-pieces/${piece.public_id}`),
              );
            }
            await publicPage.screenshot({
              path: testInfo.outputPath(
                `surface-744-${label.replaceAll(' ', '-')}-${viewport.name}.png`,
              ),
              fullPage: true,
            });
          }
        });

        await test.step(`${viewport.name}: canonical immersive`, async () => {
          await publicPage.goto(canonicalImmersivePath);
          await expect(publicPage.getByRole('heading', { name: piece.title })).toBeVisible();
          await expect(publicPage.getByRole('region', { name: 'Immersive stage' })).toBeVisible();
          await expect(publicPage.getByTestId('toggle-immersive-embed-snippet')).toBeVisible();
          await expect(publicPage.getByRole('button', { name: 'CMS embed' })).toBeVisible();
          await expect(
            publicPage.getByRole('button', { name: 'Open download menu' }),
          ).toBeVisible();
          await expect(publicPage.getByTestId('navigation-unsupported')).toBeVisible();
          await publicPage.screenshot({
            path: testInfo.outputPath(`surface-744-immersive-${viewport.name}.png`),
            fullPage: true,
          });
        });

        await test.step(`${viewport.name}: chrome-less regular and immersive embeds`, async () => {
          for (const [path, stageLabel] of [
            [embedPath, 'Art piece stage'],
            [immersiveEmbedPath, 'Immersive stage'],
          ] as const) {
            await publicPage.goto(path);
            await expect(publicPage.getByRole('heading', { name: piece.title })).toHaveCount(0);
            await expect(
              publicPage.getByRole('navigation', { name: 'Primary navigation' }),
            ).toHaveCount(0);
            await expect(publicPage.getByRole('region', { name: stageLabel })).toBeVisible();
            await expect(publicPage.getByRole('toolbar', { name: 'Piece actions' })).toBeVisible();
          }
        });

        await test.step(`${viewport.name}: gallery, profile, and collection consumers`, async () => {
          await publicPage.goto('/gallery?type=generated');
          const galleryCard = publicPage.getByTestId(`gallery-card-${piece.public_id}`);
          await expect(galleryCard).toBeVisible();
          await expect(galleryCard.getByRole('link', { name: piece.title })).toHaveAttribute(
            'href',
            canonicalPath,
          );

          await publicPage.goto(`/users/@${handle}`);
          const profileCard = publicPage.getByTestId(`profile-piece-${piece.public_id}`);
          await expect(profileCard).toBeVisible();
          await expect(profileCard.getByRole('link', { name: piece.title })).toHaveAttribute(
            'href',
            canonicalPath,
          );

          await publicPage.goto(collectionPath);
          await expect(publicPage.getByRole('heading', { name: collection.title })).toBeVisible();
          await expect(publicPage.getByRole('link', { name: piece.title })).toHaveAttribute(
            'href',
            canonicalPath,
          );
          await publicPage.getByRole('link', { name: 'Open immersive collection' }).click();
          await publicPage.waitForURL(collectionImmersivePath);
          await expect(publicPage.getByRole('heading', { name: collection.title })).toBeVisible();
          await expect(publicPage.getByTitle(piece.title)).toHaveAttribute('src', embedPath);
          await publicPage.goto(collectionEmbedPath);
          await expect(publicPage.getByRole('heading', { name: collection.title })).toHaveCount(0);
          await expect(publicPage.getByRole('button', { name: 'Next' })).toBeVisible();
        });
      }

      await test.step('download consumers preserve the saved current version and boundaries', async () => {
        await publicPage.goto(canonicalPath);
        const menu = publicPage.getByRole('toolbar', { name: 'Piece actions' });
        await menu.getByRole('button', { name: 'Open download menu' }).click();
        await expect(menu.getByRole('menuitem', { name: 'Download Full ZIP' })).toBeVisible();
        await expect(menu.getByRole('menuitem', { name: 'Download Non-Camera ZIP' })).toBeVisible();
        await expect(
          publicPage
            .getByRole('region', { name: 'Current version context' })
            .getByText('A blue rectangle for the public surface contract matrix.'),
        ).toBeVisible();
      });
    } finally {
      await publicContext.close();
      await apiDelete(ownerContext, `/api/account/collections/${collection.id}/`);
      await apiDelete(ownerContext, `/api/art-pieces/${piece.public_id}/`);
      await ownerContext.close();
    }
  });

  test('does not expose draft, archived, deleted, or unauthorized pieces on public surfaces', async ({
    browser,
  }) => {
    const fixtures = requireE2EFixtures();
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);
    const draft = await apiPost(ownerContext, '/api/art-pieces/', {
      title: 'Private surface sentinel',
      description: 'Should never be public.',
      prompt: 'private',
      engine: 'canvas2d',
      capabilities: {},
      source: SOURCE,
    });
    expect(draft.status()).toBe(201);
    const draftPiece = (await draft.json()) as { public_id: string; public_slug: string };
    const archived = await apiPost(ownerContext, '/api/art-pieces/', {
      title: 'Archived surface sentinel',
      description: 'Should never be public.',
      prompt: 'archived',
      engine: 'canvas2d',
      capabilities: {},
      source: SOURCE,
    });
    expect(archived.status()).toBe(201);
    const archivedPiece = (await archived.json()) as { public_id: string; public_slug: string };
    expect(
      (
        await apiPatch(ownerContext, `/api/art-pieces/${archivedPiece.public_id}/`, {
          status: 'published',
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await apiPatch(ownerContext, `/api/art-pieces/${archivedPiece.public_id}/`, {
          status: 'archived',
        })
      ).status(),
    ).toBe(200);

    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    try {
      for (const piece of [draftPiece, archivedPiece]) {
        for (const path of [
          `/art-pieces/p/${piece.public_id}`,
          `/art-pieces/immersive/${piece.public_id}`,
          `/embed/art-pieces/${piece.public_id}`,
          `/embed/art-pieces/immersive/${piece.public_id}`,
        ]) {
          await expectUnavailable(anonymousPage, path);
        }
      }
      await apiDelete(ownerContext, `/api/art-pieces/${archivedPiece.public_id}/`);
      await expectUnavailable(anonymousPage, `/art-pieces/p/${archivedPiece.public_id}`);
    } finally {
      await anonymousContext.close();
      await apiDelete(ownerContext, `/api/art-pieces/${draftPiece.public_id}/`);
      await ownerContext.close();
    }
  });
});
