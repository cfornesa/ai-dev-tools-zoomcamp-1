import { expect, test, type Locator, type Page } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

const NARROW_VIEWPORT = { width: 375, height: 800 };
const TABLET_VIEWPORT = { width: 768, height: 900 };

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
}

async function expectNoOverlap(first: Locator, second: Locator): Promise<void> {
  const boxes = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(boxes[0]).not.toBeNull();
  expect(boxes[1]).not.toBeNull();

  const firstBox = boxes[0]!;
  const secondBox = boxes[1]!;
  const separated =
    firstBox.x + firstBox.width <= secondBox.x ||
    secondBox.x + secondBox.width <= firstBox.x ||
    firstBox.y + firstBox.height <= secondBox.y ||
    secondBox.y + secondBox.height <= firstBox.y;
  expect(separated).toBe(true);
}

async function expectVisibleAndInViewport(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewportWidth = locator.page().viewportSize()?.width;
  const viewportHeight = locator.page().viewportSize()?.height;
  expect(box).not.toBeNull();
  expect(viewportWidth).toBeDefined();
  expect(viewportHeight).toBeDefined();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth!);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight!);
}

async function expectTabOrder(page: Page, controls: Locator[]): Promise<void> {
  for (const control of controls) {
    await page.keyboard.press('Tab');
    await expect(control).toBeFocused();
    await expectVisibleAndInViewport(control);
  }
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

  test('keeps signed-out header controls in a visible tablet tab order', async ({ page }) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Login', exact: true })).toBeVisible();

    await expectTabOrder(page, [
      page.getByRole('link', { name: 'Skip to main content' }),
      page.getByRole('link', { name: 'Public gallery' }),
      page.getByRole('link', { name: 'Login', exact: true }),
      page.getByRole('radio', { name: 'Match system' }),
    ]);
  });

  test('keeps reduced-motion keyboard choices focused and visible at tablet width', async ({
    page,
  }) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await page.goto('/');

    const system = page.getByRole('radio', { name: 'Match system' });
    const reduced = page.getByRole('radio', { name: 'Reduced' });
    const full = page.getByRole('radio', { name: 'Full' });

    await expect(system).toHaveAttribute('aria-checked', 'true');
    await expect(system).toHaveAttribute('tabindex', '0');

    // The group is one tab stop, and focus enters on its checked choice.
    await expectTabOrder(page, [
      page.getByRole('link', { name: 'Skip to main content' }),
      page.getByRole('link', { name: 'Public gallery' }),
      page.getByRole('link', { name: 'Login', exact: true }),
      system,
    ]);

    await page.keyboard.press('ArrowRight');
    await expect(reduced).toBeFocused();
    await expect(reduced).toHaveAttribute('aria-checked', 'true');
    await expect(system).toHaveAttribute('aria-checked', 'false');
    await expectVisibleAndInViewport(reduced);

    await page.keyboard.press('ArrowRight');
    await expect(full).toBeFocused();
    await expect(full).toHaveAttribute('aria-checked', 'true');
    await expect(reduced).toHaveAttribute('aria-checked', 'false');
    await expectVisibleAndInViewport(full);
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

    test('keeps the shell title and actions separated at desktop and narrow widths', async ({
      page,
    }) => {
      const title = page.getByRole('heading', { name: 'Creatrweb Animation Studio' });
      const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
      const authActions = page.locator('.app-shell-auth');
      const motion = page.getByRole('radiogroup', { name: 'Reduce motion' });

      await page.setViewportSize({ width: 1280, height: 900 });
      await loginViaUI(page, fixtures.other.email, fixtures.password);

      await expectVisibleAndInViewport(title);
      await expectVisibleAndInViewport(navigation);
      await expectVisibleAndInViewport(authActions);
      await expectVisibleAndInViewport(motion);
      await expectNoOverlap(title, navigation);
      await expectNoOverlap(title, authActions);
      await expectNoOverlap(title, motion);
      await expectNoHorizontalOverflow(page);

      await page.setViewportSize(NARROW_VIEWPORT);
      await expectVisibleAndInViewport(title);
      await expectVisibleAndInViewport(navigation);
      await expectVisibleAndInViewport(authActions);
      await expectVisibleAndInViewport(motion);
      await expectNoOverlap(title, navigation);
      await expectNoOverlap(title, authActions);
      await expectNoOverlap(title, motion);
      await expectNoHorizontalOverflow(page);
    });

    test('keeps every signed-in header action readable at tablet width', async ({ page }) => {
      await page.setViewportSize(TABLET_VIEWPORT);
      await loginViaUI(page, fixtures.other.email, fixtures.password);

      const title = page.getByRole('heading', { name: 'Creatrweb Animation Studio' });
      const galleryLink = page.getByRole('link', { name: 'Public gallery' });
      const motion = page.getByRole('radiogroup', { name: 'Reduce motion' });
      const accountLink = page.getByRole('link', { name: 'Account settings' });
      const logoutButton = page.getByRole('button', { name: 'Logout' });

      await expectVisibleAndInViewport(title);
      await expectVisibleAndInViewport(galleryLink);
      await expectVisibleAndInViewport(motion);
      await expectVisibleAndInViewport(accountLink);
      await expectVisibleAndInViewport(logoutButton);

      const headerItems = [title, galleryLink, motion, accountLink, logoutButton];
      for (let firstIndex = 0; firstIndex < headerItems.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < headerItems.length; secondIndex += 1) {
          await expectNoOverlap(headerItems[firstIndex], headerItems[secondIndex]);
        }
      }
      await expectNoHorizontalOverflow(page);
    });

    test('keeps signed-in header controls in a visible tablet tab order', async ({ page }) => {
      await page.setViewportSize(TABLET_VIEWPORT);
      await loginViaUI(page, fixtures.other.email, fixtures.password);

      await expectTabOrder(page, [
        page.getByRole('link', { name: 'Skip to main content' }),
        page.getByRole('link', { name: 'Public gallery' }),
        page.getByRole('link', { name: 'Account settings' }),
        page.getByRole('button', { name: 'Logout' }),
        page.getByRole('radio', { name: 'Match system' }),
      ]);
    });
  });
});
