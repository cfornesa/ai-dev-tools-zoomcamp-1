import { expect, test } from '@playwright/test';

import { apiPatch, apiPost, apiGet } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Canonical generated art-piece page (#736)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('renders public context, actions, and versions at desktop and mobile sizes', async ({
    browser,
  }, testInfo) => {
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await loginViaUI(ownerPage, e2eFixtures.owner.email, e2eFixtures.password);
    const profile = await apiGet(ownerContext, '/api/account/profile/');
    expect(profile.ok()).toBe(true);
    const { handle } = (await profile.json()) as { handle: string };
    const slug = `generated-page-${Date.now().toString(36)}`;
    const prompt = 'A '.repeat(120);
    const created = await apiPost(ownerContext, '/api/art-pieces/', {
      title: 'Generated page fixture',
      description: 'A public generated page fixture.',
      prompt,
      engine: 'svg',
      public_slug: slug,
      source:
        '<svg id="generated-page-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#172554"/></svg>',
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string; public_slug: string };
    expect(piece.public_slug).toBe(slug);
    const canonicalApiPath = `/api/users/@${handle}/pieces/${slug}/`;
    const canonicalPagePath = `/users/@${handle}/pieces/${slug}`;
    const anonymousContext = await browser.newContext();
    expect((await apiGet(anonymousContext, canonicalApiPath)).status()).toBe(404);

    const version = await apiPost(ownerContext, `/api/art-pieces/${piece.public_id}/versions/`, {
      source:
        '<svg id="generated-page-svg-v2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><circle cx="160" cy="120" r="80" fill="#0f766e"/></svg>',
      generation_metadata: { model_label: 'E2E model' },
    });
    expect(version.status()).toBe(201);
    const published = await apiPatch(ownerContext, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);
    const publicResponse = await apiGet(anonymousContext, canonicalApiPath);
    expect(publicResponse.status()).toBe(200);
    const publicPayload = (await publicResponse.json()) as {
      type: string;
      canonical_url: string;
      piece: { public_id: string; versions: Array<{ model_label: string | null }> };
    };
    expect(publicPayload.type).toBe('generated');
    expect(publicPayload.canonical_url).toBe(canonicalPagePath);
    expect(publicPayload.piece.public_id).toBe(piece.public_id);
    expect(publicPayload.piece.versions).toHaveLength(2);
    expect(publicPayload.piece.versions[0].model_label).toBe('E2E model');
    expect(publicPayload.piece.versions[0]).not.toHaveProperty('source');
    const page = await anonymousContext.newPage();

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(canonicalPagePath);
      await expect(page.getByText('Generated art')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Generated page fixture' })).toBeVisible();
      await expect(page.getByText('SVG · 2 versions')).toBeVisible();
      await expect(page.getByRole('region', { name: 'Art piece stage' })).toBeVisible();
      await expect(
        page.locator('.public-piece-actions[role="group"][aria-label="Piece actions"]'),
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Current version context' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Versions' })).toBeVisible();
      await expect(page.getByText('E2E model', { exact: true })).toBeVisible();
      await expect(page.locator('.public-piece-current')).toHaveText('CURRENT');
      await page.screenshot({
        path: testInfo.outputPath(`public-generated-art-piece-${viewport.width}.png`),
        fullPage: true,
      });
    }
    await anonymousContext.close();
    await ownerContext.close();
  });
});
