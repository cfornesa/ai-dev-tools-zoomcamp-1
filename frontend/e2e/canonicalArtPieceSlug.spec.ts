import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Canonical generated art-piece slugs (#616)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('canonical regular routes render and UUID viewer shims remain usable', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);
    const profileResponse = await apiGet(context, '/api/account/profile/');
    expect(profileResponse.ok()).toBe(true);
    const profile = (await profileResponse.json()) as { handle: string };
    const slug = `canonical-${Date.now().toString(36)}`;
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Canonical slug browser fixture',
      description: 'Canonical route fixture.',
      prompt: 'A canonical SVG piece',
      engine: 'svg',
      public_slug: slug,
      capabilities: { screenshot: true, fullscreen: true },
      source:
        '<svg id="canonical-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#172554"/></svg>',
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`/users/@${profile.handle}/pieces/${slug}`);
      await expect(
        page.getByRole('heading', { name: 'Canonical slug browser fixture' }),
      ).toBeVisible();
      await expect(page.locator('iframe[title="Art piece preview"]')).toBeVisible();
      await expect(
        page.frameLocator('iframe[title="Art piece preview"]').locator('#canonical-svg'),
      ).toBeVisible();

      await page.goto(`/art-pieces/p/${piece.public_id}`);
      await expect(
        page.getByRole('heading', { name: 'Canonical slug browser fixture' }),
      ).toBeVisible();
      await expect(page.locator('iframe[title="Art piece preview"]')).toBeVisible();
    }
    await context.close();
  });
});
