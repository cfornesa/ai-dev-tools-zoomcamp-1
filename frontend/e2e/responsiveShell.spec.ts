import { expect, test, type Locator, type Page } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { expandAllCollapsibleSections } from './support/expandCollapsibleSections.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

/** Mirrors `projectLifecycle.spec.ts`'s/`publishingAndRemix.spec.ts`'s own
 * identically-named helper (each spec file keeps its own copy rather than
 * sharing one, per this suite's existing convention). */
async function createBlankProjectViaUI(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'More creation options' }).click();
  await page.getByRole('menuitem', { name: 'Create a new animation' }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  const match = /\/projects\/([^/]+)$/.exec(page.url());
  if (!match) throw new Error(`Could not extract a project id from ${page.url()}`);
  await expandAllCollapsibleSections(page);
  return match[1];
}

/** Mirrors `publishingAndRemix.spec.ts`'s own `saveMeaningfulMetadata` +
 * `confirmPublish` helpers, condensed to what this file's populated-gallery
 * scenario needs: a project with meaningful title/description, published,
 * so it appears in both the owner's own gallery and the public gallery. */
async function publishProjectViaUI(
  page: Page,
  projectId: string,
  title: string,
  description: string,
): Promise<void> {
  await page.goto(`/projects/${projectId}`);
  await expandAllCollapsibleSections(page);

  await page.getByRole('button', { name: 'Edit title' }).click();
  const titleForm = page.locator('.editor-title-edit');
  await titleForm.locator('#editor-title-input').fill(title);
  await titleForm.getByRole('button', { name: 'Save' }).click();
  await expect(titleForm).toHaveCount(0);

  await page.locator('#project-description').fill(description);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();

  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: /Publish/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByTestId('visibility-status')).toContainText('Public');
}

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
    // Below the mobile-header breakpoint, primary nav lives behind the
    // hamburger toggle (issue #90) rather than being inline, so it must be
    // opened before asserting its contents are visible and in-viewport.
    await page.getByRole('button', { name: 'Open menu' }).click();
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
      page.getByRole('link', { name: 'Home', exact: true }),
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
      page.getByRole('link', { name: 'Home', exact: true }),
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

    // Issue #268: the 4 "Create X" buttons + "Browse templates" link this
    // test used to check for separate-row stacking are gone -- replaced by
    // a single compact split-button ("+" plus an arrow that opens a
    // dropdown), so there is no longer a two-elements-forced-apart layout
    // to assert. This now checks the split-button itself stays visible
    // and in-viewport, and that opening its dropdown doesn't overflow the
    // narrow viewport either.
    test('shows the create split-button and centers the empty message on narrow screens', async ({
      page,
    }) => {
      await page.setViewportSize(NARROW_VIEWPORT);
      await loginViaUI(page, fixtures.empty.email, fixtures.password);

      const panel = page.locator('.gallery-panel');
      const galleryHeader = page.locator('.gallery-header');
      const createSplit = page.locator('.gallery-create-split');
      const emptyState = page.locator('.gallery-empty-state');

      await expectVisibleAndInViewport(panel);
      await expectVisibleAndInViewport(galleryHeader);
      await expectVisibleAndInViewport(createSplit);
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('You have not created any projects.');
      await expect(emptyState).toContainText('Create your first animation to get started.');

      const emptyBox = await emptyState.boundingBox();
      const panelBox = await panel.boundingBox();
      expect(emptyBox).not.toBeNull();
      expect(panelBox).not.toBeNull();

      // The empty state is centered within the bordered gallery panel.
      const emptyCenter = emptyBox!.x + emptyBox!.width / 2;
      const panelCenter = panelBox!.x + panelBox!.width / 2;
      expect(Math.abs(emptyCenter - panelCenter)).toBeLessThanOrEqual(1);
      await expectNoHorizontalOverflow(page);

      await page.getByRole('button', { name: 'More creation options' }).click();
      await expect(page.getByRole('menu', { name: 'Create a new project' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });

    test('keeps the shell title and actions separated at desktop and narrow widths', async ({
      page,
    }) => {
      const title = page.getByRole('heading', { name: 'Creatrweb Animation Studio' });
      const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
      const accountLink = page.getByRole('link', { name: 'Account settings' });
      const logoutButton = page.getByRole('button', { name: 'Logout' });
      const motion = page.getByRole('radiogroup', { name: 'Reduce motion' });

      await page.setViewportSize({ width: 1280, height: 900 });
      await loginViaUI(page, fixtures.other.email, fixtures.password);

      await expectVisibleAndInViewport(title);
      await expectVisibleAndInViewport(navigation);
      await expectVisibleAndInViewport(accountLink);
      await expectVisibleAndInViewport(logoutButton);
      await expectVisibleAndInViewport(motion);
      await expectNoOverlap(title, navigation);
      await expectNoOverlap(title, accountLink);
      await expectNoOverlap(title, logoutButton);
      await expectNoOverlap(title, motion);
      await expectNoHorizontalOverflow(page);

      await page.setViewportSize(NARROW_VIEWPORT);
      // Below the mobile-header breakpoint, primary nav (and the auth
      // actions inside it) live behind the hamburger toggle (issue #90).
      await page.getByRole('button', { name: 'Open menu' }).click();
      await expectVisibleAndInViewport(title);
      await expectVisibleAndInViewport(navigation);
      await expectVisibleAndInViewport(accountLink);
      await expectVisibleAndInViewport(logoutButton);
      await expectVisibleAndInViewport(motion);
      await expectNoOverlap(title, navigation);
      await expectNoOverlap(title, accountLink);
      await expectNoOverlap(title, logoutButton);
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
        page.getByRole('link', { name: 'Home', exact: true }),
        page.getByRole('link', { name: 'Public gallery' }),
        page.getByRole('link', { name: 'Account settings' }),
        page.getByRole('button', { name: 'Logout' }),
        page.getByRole('radio', { name: 'Match system' }),
      ]);
    });
  });

  // Task 128 (issue #160): every scenario above only ever exercises the
  // *empty* Gallery/PublicGallery state at narrow width -- a populated
  // gallery with real project cards (`.project-grid`/`.project-card`,
  // `.public-project-grid`/`.public-project-card`, both newly given real
  // CSS by this task) had never been checked for overflow/cramping at
  // 375px. Uses the `owner` fixture specifically (not `other`, which the
  // "signed-in empty gallery" describe block above depends on staying
  // project-less for its own assertions within this same file/database).
  test.describe('populated gallery at narrow width', () => {
    let fixtures: Fixtures;

    test.beforeAll(() => {
      fixtures = requireE2EFixtures();
    });

    test('renders the signed-in gallery with a real project card, no horizontal overflow, at 375px', async ({
      page,
    }) => {
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await createBlankProjectViaUI(page);

      await page.setViewportSize(NARROW_VIEWPORT);
      await page.goto('/');

      // Issue #239: Gallery.tsx (task 209/#241) can render a second
      // `.project-grid` for "Your 3D projects" once the owner fixture has
      // any Project3D from another spec file's run -- `.project-card` is
      // shared by both `ProjectCard` and `Project3DCard`, so `.first()`
      // (2D's grid renders first in DOM order, unconditionally, whenever
      // `ownProjects` is non-empty) is what actually disambiguates here,
      // not the card class.
      const grid = page.locator('.project-grid').first();
      await expect(grid).toBeVisible();
      const card = grid.locator('.project-card').first();
      await expectVisibleAndInViewport(card);
      await expectNoHorizontalOverflow(page);
    });

    test('renders the public gallery with a real project card, no horizontal overflow, at 375px', async ({
      page,
      browser,
    }) => {
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const projectId = await createBlankProjectViaUI(page);
      await publishProjectViaUI(
        page,
        projectId,
        'Responsive audit gallery card',
        'A published project used only to exercise the populated public gallery layout at narrow width.',
      );

      // A fresh, unauthenticated context -- the public gallery must be
      // reachable and correctly laid out for an anonymous visitor, not
      // just the owner who just published from a signed-in session.
      const anonymousContext = await browser.newContext({ viewport: NARROW_VIEWPORT });
      try {
        const anonymousPage = await anonymousContext.newPage();
        await anonymousPage.goto('/gallery');

        const grid = anonymousPage.locator('.public-project-grid');
        await expect(grid).toBeVisible();
        const card = grid.locator('.public-project-card').first();
        await expectVisibleAndInViewport(card);
        await expectNoHorizontalOverflow(anonymousPage);
      } finally {
        await anonymousContext.close();
      }
    });
  });
});
