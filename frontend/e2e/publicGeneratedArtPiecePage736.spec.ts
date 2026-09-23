import { expect, test } from '@playwright/test';

import { apiPatch, apiPost, apiGet } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Canonical generated art-piece page (#736)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('renders public context, actions, and versions at desktop and mobile sizes', async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);
    const profile = await apiGet(context, '/api/account/profile/');
    expect(profile.ok()).toBe(true);
    const { handle } = (await profile.json()) as { handle: string };
    const slug = `generated-page-${Date.now().toString(36)}`;
    const prompt = 'A '.repeat(120);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Generated page fixture',
      description: 'A public generated page fixture.',
      prompt,
      engine: 'svg',
      public_slug: slug,
      source:
        '<svg id="generated-page-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#172554"/></svg>',
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const version = await apiPost(context, `/api/art-pieces/${piece.public_id}/versions/`, {
      source:
        '<svg id="generated-page-svg-v2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><circle cx="160" cy="120" r="80" fill="#0f766e"/></svg>',
      generation_metadata: { model_label: 'E2E model' },
    });
    expect(version.status()).toBe(201);
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`/users/@${handle}/pieces/${slug}`);
      await expect(page.getByText('Generated art')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Generated page fixture' })).toBeVisible();
      await expect(page.getByText('SVG · 2 versions')).toBeVisible();
      await expect(page.getByRole('region', { name: 'Art piece stage' })).toBeVisible();
      await expect(
        page.getByTestId('regular-piece-toolbar-row').getByRole('group', { name: 'Piece actions' }),
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Current version context' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Versions' })).toBeVisible();
      await expect(page.getByText('E2E model')).toBeVisible();
      await expect(page.getByText('CURRENT')).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`public-generated-art-piece-${viewport.width}.png`),
        fullPage: true,
      });
    }
    await context.close();
  });
});
