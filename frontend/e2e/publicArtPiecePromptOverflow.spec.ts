import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Public generated-piece prompt overflow (#1084)', () => {
  const fixtures = requireE2EFixtures();

  test('wraps an unbroken prompt without horizontal overflow at 375px', async ({
    page,
  }, testInfo) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const profile = await apiGet(page.context(), '/api/account/profile/');
    expect(profile.ok()).toBe(true);
    const { handle } = (await profile.json()) as { handle: string };
    const slug = `prompt-overflow-${Date.now().toString(36)}`;
    const prompt = `unbroken-prompt-${'x'.repeat(2400)}`;
    const created = await apiPost(page.context(), '/api/art-pieces/', {
      title: 'Long prompt wrapping fixture',
      description: 'Published fixture for version-context wrapping.',
      prompt,
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
    await expect(page.getByRole('heading', { name: 'Current version context' })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

    const promptValue = page
      .locator('.public-piece-version-context dd')
      .filter({ hasText: prompt });
    await expect(promptValue).toBeVisible();
    const promptBox = await promptValue.boundingBox();
    expect(promptBox).not.toBeNull();
    expect(promptBox!.width).toBeLessThanOrEqual(dimensions.clientWidth);
    await page.screenshot({
      path: testInfo.outputPath('public-art-piece-prompt-overflow-375.png'),
      fullPage: true,
    });
  });
});
