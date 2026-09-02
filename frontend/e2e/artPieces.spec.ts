import fs from 'node:fs';

import JSZip from 'jszip';
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
        camera_view: true,
        hand_steering: true,
        immersive: true,
      },
      source:
        '<canvas id="art-piece-canvas" width="320" height="240"></canvas><script>var c=document.getElementById("art-piece-canvas"); var x=c.getContext("2d"); x.fillStyle="#2463eb"; x.fillRect(0,0,320,240);</script>',
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
    const screenshotDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Take screenshot' }).click();
    const screenshot = await screenshotDownload;
    expect(screenshot.suggestedFilename()).toMatch(/browser-piece-screenshot-\d+\.png$/);
    const screenshotBytes = fs.readFileSync((await screenshot.path())!);
    expect(screenshotBytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(screenshotBytes.readUInt32BE(16)).toBe(320);
    expect(screenshotBytes.readUInt32BE(20)).toBe(240);
    await page.getByRole('button', { name: 'Open download menu' }).click();
    const bundleDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download full piece' }).click();
    const fullBundle = await bundleDownload;
    expect(fullBundle.suggestedFilename()).toBe('Browser piece-full.zip');
    const fullZip = await JSZip.loadAsync(fs.readFileSync((await fullBundle.path())!));
    const fullHtml = await fullZip.files['index.html'].async('string');
    expect(fullHtml).toContain('data-action="camera"');
    expect(fullHtml).toContain('data-action="hand"');
    expect(fullHtml).not.toContain('Download full piece');
    await page.getByRole('button', { name: 'Piece controls' }).click();
    const nonCameraDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download non-camera piece' }).click();
    const nonCameraBundle = await nonCameraDownload;
    const nonCameraZip = await JSZip.loadAsync(fs.readFileSync((await nonCameraBundle.path())!));
    const nonCameraHtml = await nonCameraZip.files['index.html'].async('string');
    expect(nonCameraHtml).not.toContain('data-action="camera"');
    expect(nonCameraHtml).not.toContain('data-action="hand"');
    await page.getByRole('button', { name: 'Piece controls' }).click();
    await expect(page.getByRole('region', { name: 'Piece controls' })).toBeVisible();
    await page.getByRole('button', { name: 'Show hand gesture guide' }).click();
    await expect(page.getByRole('dialog', { name: 'Hand gesture guide' })).toContainText('Look');
    await page.getByRole('link', { name: 'View immersive piece' }).click();
    await expect(page.getByRole('heading', { name: 'Browser piece' })).toBeVisible();
    await expect(page.getByTitle('Immersive art piece preview')).toBeVisible();
    await page.getByRole('link', { name: 'Back to regular viewer' }).click();
    await expect(page.getByTitle('Art piece preview')).toBeVisible();
  });
});
