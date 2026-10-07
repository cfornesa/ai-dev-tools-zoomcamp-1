import { expect, test } from '@playwright/test';

import { apiGet } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const fixtures = requireE2EFixtures();
const starters = [
  { engine: 'canvas2d', label: 'Canvas 2D', preview: '#art-piece-canvas' },
  { engine: 'svg', label: 'SVG', preview: 'svg' },
  { engine: 'p5js', label: 'p5.js', preview: 'canvas' },
  { engine: 'c2js', label: 'C2.js', preview: '#c2-canvas' },
  { engine: 'c2js-interactive', label: 'C2.js Interactive', preview: '#c2-canvas' },
  { engine: 'threejs', label: 'Three.js', preview: '#art-piece-container canvas' },
  { engine: 'aframe', label: 'A-Frame', preview: 'a-scene' },
] as const;

test('blank generated starters render, save, and capture a thumbnail for all seven libraries', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginViaUI(page, fixtures.owner.email, fixtures.password);
  const suffix = Date.now().toString(36);

  for (const { engine, label, preview: previewSelector } of starters) {
    const title = `Starter ${engine} ${suffix}`;
    await page.goto(`/art-pieces?mode=blank&engine=${engine}`);
    await expect(page.getByTestId('art-piece-starter-mode')).toContainText(
      'No AI request is made.',
    );
    await expect(page.getByLabel('Piece title')).toHaveValue(`Untitled ${label} piece`);
    await page.getByLabel('Piece title').fill(title);
    const previewFrame = page.getByTestId('art-piece-preview');
    await expect(previewFrame).toBeVisible();
    await expect(previewFrame.contentFrame().locator(previewSelector)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId('art-piece-crashed')).toHaveCount(0);
    await expect(page.getByTestId('art-piece-save')).toBeVisible({ timeout: 30_000 });
    await previewFrame.scrollIntoViewIfNeeded();
    await previewFrame
      .contentFrame()
      .locator('body')
      .evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
    const desktopScreenshot = await page.screenshot({
      path: testInfo.outputPath(`blank-${engine}-1280x900.png`),
    });
    await testInfo.attach(`blank-${engine}-1280x900`, {
      body: desktopScreenshot,
      contentType: 'image/png',
    });

    await page.getByTestId('art-piece-save').click();
    await expect(page.getByText(`Saved as ${title} (draft).`)).toBeVisible();

    await expect
      .poll(
        async () => {
          const response = await apiGet(context, '/api/art-pieces/');
          if (!response.ok()) return false;
          const pieces = (await response.json()) as Array<{
            title: string;
            engine: string;
            current_version: { thumbnail_is_fallback: boolean } | null;
          }>;
          const saved = pieces.find((piece) => piece.title === title);
          return saved?.engine === engine && saved.current_version?.thumbnail_is_fallback === false;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  }

  await page.setViewportSize({ width: 375, height: 812 });
  for (const { engine, preview: previewSelector } of starters) {
    await page.goto(`/art-pieces?mode=blank&engine=${engine}`);
    const previewFrame = page.getByTestId('art-piece-preview');
    await expect(previewFrame.contentFrame().locator(previewSelector)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId('art-piece-crashed')).toHaveCount(0);
    await expect(page.getByTestId('art-piece-save')).toBeVisible({ timeout: 30_000 });
    await previewFrame.scrollIntoViewIfNeeded();
    await previewFrame
      .contentFrame()
      .locator('body')
      .evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
    const mobileScreenshot = await page.screenshot({
      path: testInfo.outputPath(`blank-${engine}-375x812.png`),
    });
    await testInfo.attach(`blank-${engine}-375x812`, {
      body: mobileScreenshot,
      contentType: 'image/png',
    });
  }
});
