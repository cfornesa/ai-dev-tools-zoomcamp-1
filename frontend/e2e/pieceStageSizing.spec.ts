import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Generated regular-piece stage sizing (#703)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('keeps the canonical regular stage responsive, themed, stable, and contained', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);
    const profileResponse = await apiGet(context, '/api/account/profile/');
    expect(profileResponse.ok()).toBe(true);
    const profile = (await profileResponse.json()) as { handle: string };
    const slug = `stage-sizing-${Date.now().toString(36)}`;
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Responsive stage sizing fixture',
      description: 'A published regular-view fixture for stage sizing.',
      prompt: 'A blue rectangle',
      engine: 'canvas2d',
      public_slug: slug,
      capabilities: { screenshot: true, fullscreen: true },
      source:
        '<canvas id="stage-sizing-canvas" width="320" height="180"></canvas>' +
        '<script>const c=document.querySelector("canvas"); const x=c.getContext("2d"); x.fillStyle="#172554"; x.fillRect(0,0,320,180);</script>',
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`/users/@${profile.handle}/pieces/${slug}`);
      const stage = page.locator('.public-art-piece-stage');
      const iframe = page.locator('iframe[title="Art piece preview"]');
      await expect(stage).toBeVisible();
      await expect(iframe).toBeVisible();
      const beforeReady = await stage.boundingBox();
      await expect(iframe.contentFrame().locator('#stage-sizing-canvas')).toBeVisible();
      const afterReady = await stage.boundingBox();
      expect(beforeReady).not.toBeNull();
      expect(afterReady).not.toBeNull();
      expect(afterReady!.x).toBeCloseTo(beforeReady!.x, 1);
      expect(afterReady!.y).toBeCloseTo(beforeReady!.y, 1);
      expect(afterReady!.width).toBeCloseTo(beforeReady!.width, 1);
      expect(afterReady!.height).toBeCloseTo(beforeReady!.height, 1);

      const geometry = await stage.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          aspectRatio: style.aspectRatio,
          backgroundColor: style.backgroundColor,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        };
      });
      expect(geometry.width).toBeGreaterThan(0);
      expect(geometry.height).toBeGreaterThan(0);
      expect(geometry.aspectRatio).toMatch(/16\s*\/\s*9/);
      expect(geometry.height).toBeLessThanOrEqual(viewport.height);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
      expect(geometry.right - geometry.left).toBeCloseTo(geometry.width, 1);
      expect(geometry.backgroundColor).not.toBe('rgb(255, 255, 255)');
    }
    await context.close();
  });
});
