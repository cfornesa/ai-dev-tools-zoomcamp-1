import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const SOURCE =
  "window.sketch = ({ canvas, startFrame }) => { const context = canvas.getContext('2d'); startFrame(() => { context.fillStyle = '#1f2937'; context.fillRect(0, 0, canvas.width, canvas.height); }); };";

async function iconRow(page: import('@playwright/test').Page): Promise<string[]> {
  const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
  await expect(toolbar).toBeVisible();
  return toolbar.locator('.piece-stage-toolbar-group').evaluate((group) =>
    Array.from(group.querySelectorAll(':scope > button, :scope > a, :scope > div > button'))
      .filter((node) => !node.closest('[data-piece-stage-download-menu]'))
      .map((node) => node.getAttribute('aria-label') ?? ''),
  );
}

test.describe('owner (private) vs public regular view toolbar (#773)', () => {
  const fixtures = requireE2EFixtures();

  test('a draft piece shows the same icon row to its owner as once public', async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(120_000);
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const profile = (await (await apiGet(context, '/api/account/profile/')).json()) as {
      handle: string;
    };
    const slug = `private-toolbar-${Date.now().toString(36)}`;
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Private toolbar piece',
      description: 'Owner draft toolbar fixture.',
      prompt: 'A c2 interactive fixture',
      engine: 'c2js-interactive',
      public_slug: slug,
      capabilities: { screenshot: true, fullscreen: true, download: true, immersive: true },
      source: SOURCE,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };

    const seen: Record<string, string[]> = {};
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      // Draft: only the signed-in owner can open it.
      await page.goto(`/users/@${profile.handle}/pieces/${slug}`);
      await expect(page.getByRole('heading', { name: 'Private toolbar piece' })).toBeVisible();
      seen[`private-${viewport.width}`] = await iconRow(page);
      await page.screenshot({
        path: testInfo.outputPath(`private-${viewport.width}.png`),
      });
    }

    expect(
      (
        await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, { status: 'published' })
      ).status(),
    ).toBe(200);
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`/users/@${profile.handle}/pieces/${slug}`);
      await expect(page.getByRole('heading', { name: 'Private toolbar piece' })).toBeVisible();
      seen[`public-${viewport.width}`] = await iconRow(page);
    }

    const expected = [
      'Take screenshot',
      'Open download menu',
      'View immersive piece',
      'Expand piece to fullscreen',
    ];
    for (const [name, labels] of Object.entries(seen)) {
      expect(labels, name).toEqual(expected);
    }
    expect(seen['private-1280']).toEqual(seen['public-1280']);
    expect(seen['private-375']).toEqual(seen['public-375']);

    // The editor stage never reorders the shared group: its icon row, when present, keeps
    // Screenshot first and Fullscreen last.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/users/@${profile.handle}/edit/${slug}`);
    await expect(page.getByRole('heading', { name: /Edit Private toolbar piece/ })).toBeVisible();
    const editorToolbars = page.getByRole('toolbar', { name: 'Piece actions' });
    if ((await editorToolbars.count()) > 0) {
      const labels = await iconRow(page);
      expect(labels[0]).toBe('Take screenshot');
      expect(labels[labels.length - 1]).toBe('Expand piece to fullscreen');
    }
  });

  test('private structured 3D and 2D editor stages keep Screenshot first and Fullscreen last', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.setViewportSize({ width: 1280, height: 900 });

    for (const [menuItem, screenshotName] of [
      ['Create a new 3D project', 'private-3d-editor-1280.png'],
      ['Create a new 2D project with p5.js', 'private-2d-editor-1280.png'],
    ] as const) {
      await page.goto('/');
      await page.getByRole('button', { name: 'More creation options' }).click();
      await page.getByRole('menuitem', { name: menuItem }).click();
      await page.waitForURL(/\/users\/@[^/]+\/edit\/[^/]+$/);
      // Structured editors keep the compact menu shell (legacy menu mode); open it and read the
      // ordered group. The shared component owns the order, so Fullscreen is last here too.
      const menu = page.getByRole('button', { name: 'Open piece controls menu' }).first();
      await expect(menu).toBeVisible({ timeout: 20_000 });
      await menu.click();
      const dialog = page.getByRole('dialog', { name: /Piece actions|Preview actions/ }).first();
      await expect(dialog).toBeVisible();
      const labels = await dialog
        .locator('[role="group"]')
        .first()
        .evaluate((group) =>
          Array.from(group.querySelectorAll(':scope > button, :scope > a, :scope > div > button'))
            .filter((node) => !node.closest('[data-piece-stage-download-menu]'))
            .map((node) => node.getAttribute('aria-label') ?? ''),
        );
      expect(labels[0]).toBe('Take screenshot');
      expect(labels).toContain('Expand piece to fullscreen');
      expect(labels.indexOf('Expand piece to fullscreen')).toBeGreaterThan(
        labels.indexOf('Open download menu'),
      );
      await page.screenshot({ path: testInfo.outputPath(screenshotName) });
      await page.keyboard.press('Escape');
    }
  });

  test('the owner opens the regular view of their own private structured 3D and 2D pieces (#790)', async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(150_000);
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const profileResponse = await page.request.get('/api/account/profile/');
    const { handle } = (await profileResponse.json()) as { handle: string };
    const urls: Record<string, string> = {};

    for (const [menuItem, kind] of [
      ['Create a new 3D project', '3d'],
      ['Create a new 2D project with p5.js', '2d'],
    ] as const) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/');
      await page.getByRole('button', { name: 'More creation options' }).click();
      await page.getByRole('menuitem', { name: menuItem }).click();
      await page.waitForURL(/\/users\/@[^/]+\/edit\/[^/]+$/);
      const slug = new URL(page.url()).pathname.split('/').pop()!;
      urls[kind] = `/users/@${handle}/pieces/${slug}`;

      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 375, height: 812 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto(urls[kind]!);
        // The stage renders for the owner (not bounced to the gallery), with the shared icon row.
        await expect(page).toHaveURL(new RegExp(`/users/@${handle}/pieces/${slug}$`));
        const stage =
          kind === '3d'
            ? page.getByTestId('scene3d-preview-canvas-frame')
            : page.locator('.piece-stage-shell, [data-testid="scene-canvas-host"], canvas').first();
        await expect(stage).toBeVisible({ timeout: 20_000 });
        await expect(
          page.getByRole('toolbar', { name: /Piece actions|Preview actions/ }).first(),
        ).toBeVisible();
        await page.screenshot({
          path: testInfo.outputPath(`private-${kind}-${viewport.width}.png`),
        });
      }
    }

    // Anonymous visitors still get nothing for a private structured piece.
    const anonymous = await browser.newContext();
    const anonPage = await anonymous.newPage();
    for (const url of Object.values(urls)) {
      await anonPage.goto(url);
      await expect(anonPage).toHaveURL(/\/gallery/);
    }
    await anonymous.close();
  });
});
