import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Public generated-piece mobile layout (#1083)', () => {
  const fixtures = requireE2EFixtures();

  test('keeps the stage tall and drawing controls outside the iframe at 375px', async ({
    page,
  }, testInfo) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const profile = await apiGet(page.context(), '/api/account/profile/');
    expect(profile.ok()).toBe(true);
    const { handle } = (await profile.json()) as { handle: string };
    const slug = `mobile-stage-${Date.now().toString(36)}`;
    const created = await apiPost(page.context(), '/api/art-pieces/', {
      title: 'Mobile drawing layout fixture',
      description: 'Published fixture for mobile stage geometry.',
      prompt: 'A teal interactive paint canvas',
      engine: 'c2js-interactive',
      public_slug: slug,
      capabilities: { screenshot: true, fullscreen: true },
      source:
        'window.sketch = function (runtime) { runtime.startFrame(function () { ' +
        "runtime.canvas.fillStyle = '#2a9d8f'; runtime.canvas.fillRect(0, 0, 320, 180); }); };",
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(page.context(), `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/users/@${handle}/pieces/${slug}`);
    const iframe = page.locator('iframe[title="Art piece preview"]');
    const drawControls = page.getByRole('group', { name: 'Visitor drawing', exact: true });
    await expect(iframe).toBeVisible();
    await expect(drawControls).toBeVisible();
    await expect(iframe.contentFrame().locator('canvas')).toBeVisible();

    const iframeBox = await iframe.boundingBox();
    const controlsBox = await drawControls.boundingBox();
    expect(iframeBox).not.toBeNull();
    expect(controlsBox).not.toBeNull();
    expect(iframeBox!.height).toBeGreaterThanOrEqual(300);
    const intersects =
      iframeBox!.x < controlsBox!.x + controlsBox!.width &&
      iframeBox!.x + iframeBox!.width > controlsBox!.x &&
      iframeBox!.y < controlsBox!.y + controlsBox!.height &&
      iframeBox!.y + iframeBox!.height > controlsBox!.y;
    expect(intersects).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath('public-art-piece-mobile-layout-375.png'),
      fullPage: true,
    });
  });
});
