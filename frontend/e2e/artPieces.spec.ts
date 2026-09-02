import { expect, test } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Generated art pieces (#315)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('owner management and published regular viewer are usable', async ({ page, context }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Browser piece',
      description: 'A browser-visible piece',
      prompt: 'blue circle',
      engine: 'canvas2d',
      capabilities: {
        screenshot: true,
        download: true,
        fullscreen: true,
      },
      source:
        '<canvas id="art-piece-canvas"></canvas><script>document.body.dataset.ready="yes";</script>',
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);
    await page.goto('/art-pieces/manage');
    await expect(page.getByRole('heading', { name: 'Your art pieces' })).toBeVisible();
    await expect(page.getByText('Browser piece')).toBeVisible();
    await page.goto(`/art-pieces/p/${piece.public_id}`);
    await expect(page.getByRole('heading', { name: 'Browser piece' })).toBeVisible();
    await expect(page.getByTitle('Art piece preview')).toBeVisible();
    await expect(page.getByRole('toolbar', { name: 'Piece actions' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open download menu' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Expand fullscreen' })).toBeVisible();
    await page.getByRole('button', { name: 'Piece controls' }).click();
    await expect(page.getByRole('region', { name: 'Piece controls' })).toBeVisible();
    await page.getByRole('button', { name: 'Show hand gesture guide' }).click();
    await expect(page.getByRole('dialog', { name: 'Hand gesture guide' })).toContainText('Look');
  });
});
