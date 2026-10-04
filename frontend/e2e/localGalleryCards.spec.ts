import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { localProjectDb } from './support/localProjectDb.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Local project gallery cards (#1087)', () => {
  const fixtures = requireE2EFixtures();

  test('renders local metadata, thumbnails/fallbacks, and responsive cards', async ({
    page,
  }, testInfo) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const thumbnailSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#8b5cf6"/></svg>';
    const { id: withThumbnail } = await localProjectDb<{ id: string }>(page, {
      kind: 'create-project',
      input: {
        ownerId: fixtures.owner.username,
        title: 'Local card with preview',
        description: 'A stored local description.',
        scene: { name: 'Scene', sceneJson: { schema_version: 1, objects: [] } },
        thumbnail: {
          mimeType: 'image/svg+xml',
          bytes: Array.from(new TextEncoder().encode(thumbnailSvg)),
          updatedAt: new Date().toISOString(),
        },
      },
    });
    const { id: withoutThumbnail } = await localProjectDb<{ id: string }>(page, {
      kind: 'create-project',
      input: {
        ownerId: fixtures.owner.username,
        title: 'Local card without preview',
        description: '',
        kind: '3d',
      },
    });
    const { id: generated } = await localProjectDb<{ id: string }>(page, {
      kind: 'create-project',
      input: {
        ownerId: fixtures.owner.username,
        title: 'Local generated route',
        kind: 'generated',
      },
    });
    const ids = { withThumbnail, withoutThumbnail, generated };

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/studio');
      await expect(page.getByRole('heading', { name: 'Local card with preview' })).toBeVisible();
      await expect(page.getByText('A stored local description.')).toBeVisible();
      await expect(
        page.getByRole('img', { name: 'No preview available for Local card without preview' }),
      ).toBeVisible();
      await expect(page.getByText('Last updated')).toHaveCount(3);
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width);
      await page.screenshot({
        path: testInfo.outputPath(`local-gallery-cards-${viewport.width}.png`),
        fullPage: true,
      });
    }

    await page.getByLabel('Renderer').selectOption('3d');
    await expect(page.getByRole('heading', { name: 'Local card without preview' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Local card with preview' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Open local editor' })).toHaveAttribute(
      'href',
      `/local-projects-3d/${ids.withoutThumbnail}`,
    );
    await page.getByLabel('Renderer').selectOption('all');
    const generatedHeading = page.getByRole('heading', { name: 'Local generated route' });
    await expect(generatedHeading).toBeVisible();
    await expect(generatedHeading.locator('..').getByRole('link')).toHaveAttribute(
      'href',
      `/local-generated/${ids.generated}`,
    );
  });
});
