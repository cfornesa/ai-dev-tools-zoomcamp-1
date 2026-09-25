import { expect, test } from '@playwright/test';

import { apiGet, apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('profile and personalization parity matrix (#805)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`edits same profile fields and verifies the public profile at ${viewport.width}x${viewport.height}`, async ({
      browser,
    }, testInfo) => {
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);
      const beforeResponse = await apiGet(ownerContext, '/api/account/profile/');
      expect(beforeResponse.ok()).toBe(true);
      const before = (await beforeResponse.json()) as Record<string, unknown> & {
        handle: string;
        revision: number;
        available_styles?: Array<{ key: string }>;
        available_palettes?: Array<{ key: string }>;
      };
      const nextStyle = before.available_styles?.find(
        (style) => style.key !== before.style_key,
      )?.key;
      const nextPalette = before.available_palettes?.find(
        (palette) => palette.key !== (before.palette_key ?? 'original'),
      )?.key;
      const marker = `${viewport.width}-${Date.now().toString(36)}`;
      const displayName = `Parity Artist ${marker}`;
      const bio = `Profile parity bio ${marker}.`;
      const website = `https://example.com/profile/${marker}`;
      const image = `https://example.com/profile-${marker}.svg`;

      try {
        await ownerPage.setViewportSize(viewport);
        await ownerPage.goto('/account/settings');
        await expect(ownerPage.getByRole('heading', { name: 'Public profile' })).toBeVisible();
        await ownerPage.getByLabel('Display name').fill(displayName);
        await ownerPage.getByLabel('Bio').fill(bio);
        await ownerPage.getByLabel('Website URL').fill(website);
        await ownerPage.getByLabel('Profile photo URL').fill(image);
        await ownerPage.getByLabel('Make profile public').check();
        if (nextStyle)
          await ownerPage.getByLabel('Profile style', { exact: true }).selectOption(nextStyle);
        if (nextPalette) await ownerPage.getByLabel('Color palette').selectOption(nextPalette);
        await ownerPage.getByLabel('Font family').selectOption('serif');
        await ownerPage.getByLabel('Density').selectOption('compact');
        await ownerPage.getByLabel('Corners').selectOption('sharp');
        await ownerPage.getByRole('button', { name: 'Save profile' }).click();
        await expect(ownerPage.getByText('Profile saved.', { exact: true })).toBeVisible();

        const publicPage = await browser.newPage();
        await publicPage.route(image, async (route) =>
          route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="48" fill="#dc2626"/></svg>',
          }),
        );
        await publicPage.setViewportSize(viewport);
        await publicPage.goto(`/users/@${before.handle}`);
        await expect(publicPage.getByRole('heading', { name: displayName })).toBeVisible();
        await expect(publicPage.getByText(bio, { exact: true })).toBeVisible();
        await expect(publicPage.getByRole('link', { name: website })).toBeVisible();
        await expect(publicPage.getByRole('img', { name: `${displayName} avatar` })).toBeVisible();
        const profileSurface = publicPage.locator('.public-profile');
        await expect(profileSurface).toHaveCSS('--profile-font', /Georgia/);
        await expect(profileSurface).toHaveCSS('--profile-density', '12px');
        await expect(profileSurface).toHaveCSS('--profile-radius', '2px');
        await publicPage.screenshot({
          path: testInfo.outputPath(`profile-parity-${viewport.width}.png`),
          fullPage: true,
        });
        await publicPage.close();
      } finally {
        const currentResponse = await apiGet(ownerContext, '/api/account/profile/');
        if (currentResponse.ok()) {
          const current = (await currentResponse.json()) as Record<string, unknown> & {
            revision: number;
          };
          await apiPatch(ownerContext, '/api/account/profile/', {
            ...current,
            ...before,
            revision: current.revision,
          });
        }
        await ownerContext.close();
      }
    });
  }
});
