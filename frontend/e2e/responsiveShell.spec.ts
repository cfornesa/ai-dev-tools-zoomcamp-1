import { expect, test, type Locator, type Page } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

const NARROW_VIEWPORT = { width: 375, height: 800 };

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
}

async function expectVisibleAndInViewport(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(NARROW_VIEWPORT.width);
}

test.describe('Responsive app shell', () => {
  test('keeps the signed-out home visible without horizontal overflow at 600px breakpoint', async ({
    page,
  }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await page.goto('/');

    await expectVisibleAndInViewport(
      page.getByRole('heading', { name: 'Creatrweb Animation Studio' }),
    );
    await expectVisibleAndInViewport(page.getByRole('navigation', { name: 'Primary navigation' }));
    await expectVisibleAndInViewport(page.getByRole('radiogroup', { name: 'Reduce motion' }));
    await expectVisibleAndInViewport(page.locator('.content-panel'));
    await expectVisibleAndInViewport(page.getByRole('link', { name: 'Sign in with Google' }));
    await expectNoHorizontalOverflow(page);
  });

  test.describe('signed-in empty gallery', () => {
    let fixtures: Fixtures;

    test.beforeAll(() => {
      fixtures = requireE2EFixtures();
    });

    test('stacks empty-gallery actions and centers its message on narrow screens', async ({
      page,
    }) => {
      await page.setViewportSize(NARROW_VIEWPORT);
      await loginViaUI(page, fixtures.other.email, fixtures.password);

      const panel = page.locator('.gallery-panel');
      const galleryHeader = page.locator('.gallery-header');
      const createButton = page.getByRole('button', { name: 'Create new animation' });
      const templatesLink = page.getByRole('link', { name: 'Browse templates' });
      const emptyState = page.locator('.gallery-empty-state');

      await expectVisibleAndInViewport(panel);
      await expectVisibleAndInViewport(galleryHeader);
      await expectVisibleAndInViewport(createButton);
      await expectVisibleAndInViewport(templatesLink);
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('You have not created any projects.');
      await expect(emptyState).toContainText('Create your first animation to get started.');

      const createBox = await createButton.boundingBox();
      const templatesBox = await templatesLink.boundingBox();
      const emptyBox = await emptyState.boundingBox();
      const panelBox = await panel.boundingBox();
      expect(createBox).not.toBeNull();
      expect(templatesBox).not.toBeNull();
      expect(emptyBox).not.toBeNull();
      expect(panelBox).not.toBeNull();

      // The two actions must occupy separate rows rather than forcing the
      // gallery header wider than the viewport.
      expect(templatesBox!.y).toBeGreaterThan(createBox!.y + createBox!.height);

      // The empty state is centered within the bordered gallery panel.
      const emptyCenter = emptyBox!.x + emptyBox!.width / 2;
      const panelCenter = panelBox!.x + panelBox!.width / 2;
      expect(Math.abs(emptyCenter - panelCenter)).toBeLessThanOrEqual(1);
      await expectNoHorizontalOverflow(page);
    });
  });
});
