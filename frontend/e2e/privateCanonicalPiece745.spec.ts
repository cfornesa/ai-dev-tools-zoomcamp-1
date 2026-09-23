/** Issue #745: owner-private canonical generated pieces and public/private
 * slug collisions stay isolated across regular and immersive routes. */
import { expect, test } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test('owner-private canonical piece routes preserve privacy at desktop and mobile sizes', async ({
  page,
  browser,
}, testInfo) => {
  const fixtures = requireE2EFixtures();
  await loginViaUI(page, fixtures.owner.email, fixtures.password);
  const profile = (await (await page.context().request.get('/api/account/profile/')).json()) as {
    handle: string;
  };
  const slug = `private-canonical-${testInfo.workerIndex}-${Date.now()}`;
  const source = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><circle cx="160" cy="120" r="60" fill="teal" /></svg>';

  const publicCreate = await apiPost(page.context(), '/api/art-pieces/', {
    title: 'Public collision piece',
    description: 'Public collision fixture',
    prompt: 'Public collision fixture',
    engine: 'svg',
    source,
    public_slug: slug,
  });
  expect(publicCreate.status()).toBe(201);
  const publicPiece = (await publicCreate.json()) as { public_id: string };
  const publicUpdate = await apiPatch(page.context(), `/api/art-pieces/${publicPiece.public_id}/`, {
    title: 'Public collision piece',
    description: 'Public collision fixture',
    status: 'published',
    public_slug: slug,
  });
  expect(publicUpdate.status()).toBe(200);

  const privateCreate = await apiPost(page.context(), '/api/art-pieces/', {
    title: 'Private collision piece',
    description: 'Private collision fixture',
    prompt: 'Private collision fixture',
    engine: 'threejs',
    source: 'window.__privateCanonical745 = true;',
    public_slug: slug,
  });
  expect(privateCreate.status()).toBe(201);

  const canonicalPath = `/users/@${profile.handle}/pieces/${slug}`;
  const immersivePath = `/users/@${profile.handle}/immersive/${slug}`;
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(canonicalPath);
    await expect(page.getByRole('heading', { name: 'Private collision piece' })).toBeVisible();
    await expect(page.getByTitle('Art piece preview')).toBeVisible();

    await page.goto(immersivePath);
    await expect(page.getByTitle('Art piece preview')).toBeVisible();
    await expect(page.getByText(/isn’t available|isn't available/i)).toHaveCount(0);
  }

  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  try {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await anonymousPage.setViewportSize(viewport);
      await anonymousPage.goto(canonicalPath);
      await expect(anonymousPage.getByRole('heading', { name: 'Public collision piece' })).toBeVisible();
      await expect(anonymousPage.getByRole('heading', { name: 'Private collision piece' })).toHaveCount(0);
      await expect(anonymousPage.getByTitle('Art piece preview')).toBeVisible();
    }
  } finally {
    await anonymousContext.close();
  }

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  try {
    await loginViaUI(otherPage, fixtures.other.email, fixtures.password);
    await otherPage.goto(canonicalPath);
    await expect(otherPage.getByRole('heading', { name: 'Public collision piece' })).toBeVisible();
    await expect(otherPage.getByRole('heading', { name: 'Private collision piece' })).toHaveCount(0);
  } finally {
    await otherContext.close();
  }
});
