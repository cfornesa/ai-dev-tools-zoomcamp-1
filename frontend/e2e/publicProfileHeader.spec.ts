import { expect, test, type Page } from '@playwright/test';

const BIO = 'A long public bio with a second line.\nIt remains plain text and wraps cleanly.';
const WEBSITE = 'https://example.com/portfolio/a-very-long-profile-url-that-wraps';

async function stubProfile(page: Page) {
  await page.route('**/avatar.png', async (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="48" fill="#dc2626"/></svg>',
    }),
  );
  await page.route('**/api/users/@artist/', async (route) =>
    route.fulfill({
      json: {
        profile: {
          handle: 'artist',
          display_name: 'The Artist',
          bio: BIO,
          website_url: WEBSITE,
          social_links: {
            Mastodon: 'https://social.example/@artist',
            GitHub: 'https://github.com/artist',
          },
          profile_image_url: 'https://example.com/avatar.png',
          is_public: true,
          revision: 1,
          theme_config: {
            background: '#f4efe6',
            surface: '#fffaf0',
            text: '#1f2937',
            muted: '#6b7280',
            accent: '#dc2626',
          },
        },
        pieces: [],
      },
    }),
  );
}

test.describe('public profile header (#649)', () => {
  test('renders ordered profile details and safe external links on desktop', async ({
    page,
  }, testInfo) => {
    await stubProfile(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/users/@artist');

    const header = page.locator('.public-profile-heading');
    await expect(header.getByRole('img', { name: 'The Artist avatar' })).toBeVisible();
    await expect(header.getByRole('heading', { name: 'The Artist' })).toBeVisible();
    await expect(header.getByText('@artist')).toBeVisible();
    await expect(header.getByText(BIO.split('\n')[0])).toBeVisible();
    await expect(header.getByRole('link', { name: WEBSITE })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    await expect(header.getByRole('link', { name: 'Mastodon' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 1280);
    await page.screenshot({
      path: testInfo.outputPath('public-profile-header-desktop.png'),
      fullPage: true,
    });
  });

  test('wraps long bio and website values without overflow on mobile', async ({
    page,
  }, testInfo) => {
    await stubProfile(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/users/@artist');

    await expect(page.getByRole('heading', { name: 'The Artist' })).toBeVisible();
    await expect(page.getByRole('link', { name: WEBSITE })).toBeVisible();
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 375);
    await page.screenshot({
      path: testInfo.outputPath('public-profile-header-mobile.png'),
      fullPage: true,
    });
  });
});
