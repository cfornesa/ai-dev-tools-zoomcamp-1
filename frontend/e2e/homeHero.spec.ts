import { expect, test, type Page } from '@playwright/test';

const SITE_TITLE = 'A Long Home Title That Wraps Without Overflow At Mobile Width';

async function stubHomeContent(page: Page) {
  await page.route('**/api/site-theme/', async (route) =>
    route.fulfill({
      json: {
        site_title: SITE_TITLE,
        site_description: 'A tagline configured in admin settings.',
        presentation: {
          font_family: 'script',
          density: 'comfortable',
          radius: 'soft',
          border_style: 'solid',
          backdrop: 'cosmic',
        },
      },
    }),
  );
  await page.route('**/api/pages/home/', async (route) =>
    route.fulfill({
      json: {
        id: 1,
        title: 'Home',
        slug: 'home',
        description: 'Published home page copy rendered through the CMS surface.',
        nav_label: 'From the studio',
        show_in_nav: true,
        sort_order: 0,
        seo_config: {},
      },
    }),
  );
  await page.route('**/api/public/gallery/**', async (route) =>
    route.fulfill({
      json: { results: [], next_cursor: null, has_more: false, engine_catalog: [] },
    }),
  );
}

test.describe('home hero (#648)', () => {
  test('renders configured hero, CMS content, and keyboard-focusable See More CTA on desktop', async ({
    page,
  }, testInfo) => {
    await stubHomeContent(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    await expect(page.getByText('From the studio')).toBeVisible();
    await expect(page.locator('#home-hero-heading')).toHaveText(SITE_TITLE);
    await expect(page.getByText('A tagline configured in admin settings.')).toBeVisible();
    await expect(
      page.getByText('Published home page copy rendered through the CMS surface.'),
    ).toBeVisible();

    const cta = page.getByRole('link', { name: 'See More' });
    await expect(cta).toHaveAttribute('href', '#public-gallery');
    await cta.focus();
    await expect(cta).toBeFocused();
    await expect(cta).toHaveCSS('outline-style', 'solid');
    await page.screenshot({ path: testInfo.outputPath('home-hero-desktop.png'), fullPage: true });
  });

  test('wraps long configured titles without horizontal overflow on mobile', async ({
    page,
  }, testInfo) => {
    await stubHomeContent(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    await expect(page.locator('#home-hero-heading')).toHaveText(SITE_TITLE);
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 375);
    await page.screenshot({ path: testInfo.outputPath('home-hero-mobile.png'), fullPage: true });
  });
});
