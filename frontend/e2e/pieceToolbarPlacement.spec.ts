import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('regular generated-piece toolbar placement (#706)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('keeps controls above the stage, wraps mobile targets, and overlays only in fullscreen', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(90_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);

    const profileResponse = await apiGet(context, '/api/account/profile/');
    expect(profileResponse.ok()).toBe(true);
    const profile = (await profileResponse.json()) as { handle: string };
    const slug = `toolbar-placement-${Date.now().toString(36)}`;
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Regular toolbar placement fixture',
      description: 'Issue #706 browser fixture.',
      prompt: 'A bright geometric regular-view test piece',
      engine: 'svg',
      public_slug: slug,
      capabilities: {
        screenshot: true,
        download: true,
        immersive: true,
        fullscreen: true,
      },
      source:
        '<svg viewBox="0 0 320 180" role="img" aria-label="Toolbar placement artwork">' +
        '<rect width="320" height="180" fill="#172554"/>' +
        '<circle cx="160" cy="90" r="52" fill="#fbbf24"/>' +
        '</svg>',
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    const canonicalUrl = `/users/@${profile.handle}/pieces/${slug}`;
    for (const viewport of [
      { width: 1440, height: 900, label: 'desktop' },
      { width: 375, height: 812, label: 'mobile' },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(canonicalUrl);
      await expect(
        page.getByRole('heading', { name: 'Regular toolbar placement fixture' }),
      ).toBeVisible();

      const row = page.getByTestId('regular-piece-toolbar-row');
      const stage = page.getByRole('region', { name: 'Art piece stage' });
      const toolbar = row.getByRole('toolbar', { name: 'Piece actions' });
      await expect(toolbar).toBeVisible();
      await expect(page.getByTitle('Art piece preview')).toBeVisible();

      const rowBox = await row.boundingBox();
      const stageBox = await stage.boundingBox();
      expect(rowBox).not.toBeNull();
      expect(stageBox).not.toBeNull();
      expect(rowBox!.y + rowBox!.height).toBeLessThanOrEqual(stageBox!.y + 1);

      const targets = toolbar.locator('button:visible, a:visible');
      const targetCount = await targets.count();
      expect(targetCount).toBe(4);
      for (let index = 0; index < targetCount; index += 1) {
        const box = await targets.nth(index).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(viewport.label === 'mobile' ? 44 : 40);
      }

      if (viewport.label === 'mobile') {
        const toolbarBox = await toolbar.boundingBox();
        expect(toolbarBox).not.toBeNull();
        expect(toolbarBox!.height).toBeGreaterThan(44);
      }

      await page.screenshot({
        path: testInfo.outputPath(`piece-toolbar-${viewport.label}.png`),
        fullPage: true,
      });
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(canonicalUrl);
    const fullscreenButton = page.getByRole('button', { name: 'Expand piece to fullscreen' });
    const fullscreenSupported = await page.evaluate(
      () => document.fullscreenEnabled && typeof document.fullscreenElement === 'object',
    );
    test.skip(!fullscreenSupported, 'Fullscreen API is unavailable in this browser.');
    await fullscreenButton.click();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
    await expect(
      page.getByTestId('regular-piece-fullscreen-toolbar-host').getByRole('toolbar', {
        name: 'Piece actions',
      }),
    ).toBeVisible();
    await expect(page.getByTestId('regular-piece-toolbar-row').getByRole('toolbar')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Art piece stage' })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('piece-toolbar-fullscreen.png'),
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
    await expect(page.getByTestId('regular-piece-toolbar-row').getByRole('toolbar')).toBeVisible();

    await context.close();
  });
});
