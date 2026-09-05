import fs from 'node:fs';

import { expect, test } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #433: `artPieceSandbox.ts` used to report an SVG piece's
 * screenshot as raw, percent-encoded SVG markup
 * (`data:image/svg+xml;charset=utf-8,<encoded text>`), while the parent
 * (`PieceStageControls.tsx`) unconditionally decodes the screenshot
 * payload with `atob` -- a base64 decoder that throws on percent-encoded
 * text. SVG capture is now rasterized to a real PNG the same way
 * Canvas2D's already was, so this suite verifies the SVG library's
 * downloaded file the same way `artPieces.spec.ts` already verifies
 * Canvas2D's: PNG magic bytes, IHDR width/height, and a real pixel read.
 */
test.describe('Generated public SVG viewer: PNG screenshot capture (#433)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('downloads a decodable 320x240 PNG with the expected red artwork, Unicode markup intact', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    // A Unicode title inside the SVG markup itself (not just the piece's
    // own title field) -- proves percent-encoding/decoding through the
    // rasterization pipeline doesn't mangle non-ASCII text.
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'SVG capture fixture',
      description: 'A published SVG piece used to verify PNG screenshot capture.',
      prompt: 'red rectangle',
      engine: 'svg',
      capabilities: { screenshot: true, download: true, fullscreen: true },
      source:
        '<svg id="art-piece-svg" viewBox="0 0 320 240" xmlns="http://www.w3.org/2000/svg">' +
        '<title>Piëce rouge 日本語</title>' +
        '<rect width="320" height="240" fill="#dc2626"/>' +
        '</svg>',
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
      await page.goto(`/art-pieces/p/${piece.public_id}`);
      await expect(page.getByRole('heading', { name: 'SVG capture fixture' })).toBeVisible();
      await expect(page.getByTitle('Art piece preview')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
    }

    // First capture: PNG magic bytes, IHDR-declared 320x240 dimensions --
    // a real image, not the raw SVG text the old code sent.
    const firstDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Take screenshot' }).click();
    const first = await firstDownload;
    expect(first.suggestedFilename()).toMatch(/\.png$/);
    expect(first.suggestedFilename()).not.toMatch(/\.svg$/);
    const firstBytes = fs.readFileSync((await first.path())!);
    expect(firstBytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(firstBytes.readUInt32BE(16)).toBe(320);
    expect(firstBytes.readUInt32BE(20)).toBe(240);

    // Repeated capture produces a distinct filename (timestamped) and is
    // independently a real, correctly sized PNG -- not a fluke of the
    // first capture only.
    const secondDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Take screenshot' }).click();
    const second = await secondDownload;
    expect(second.suggestedFilename()).not.toBe(first.suggestedFilename());
    const secondBytes = fs.readFileSync((await second.path())!);
    expect(secondBytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
