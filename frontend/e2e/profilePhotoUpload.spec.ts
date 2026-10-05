import { expect, test } from '@playwright/test';

import { apiGet, apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test.describe('profile photo upload and removal (#824)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`uploads, renders, rejects, and removes a photo at ${viewport.width}x${viewport.height}`, async ({
      browser,
    }, testInfo) => {
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);
      const profile = await apiGet(ownerContext, '/api/account/profile/');
      const currentProfile = (await profile.json()) as {
        handle: string;
        profile_image_url: string;
        revision: number;
      };
      if (currentProfile.profile_image_url) {
        const clearedUrl = await apiPatch(ownerContext, '/api/account/profile/', {
          revision: currentProfile.revision,
          profile_image_url: '',
        });
        if (clearedUrl.status() !== 200) {
          throw new Error(
            `Could not clear the fixture profile image URL (${clearedUrl.status()}).`,
          );
        }
      }
      const handle = currentProfile.handle;

      await ownerPage.setViewportSize(viewport);
      await ownerPage.goto('/account/settings');
      await expect(ownerPage.getByRole('heading', { name: 'Public profile' })).toBeVisible();
      await ownerPage.locator('#profile-image-file').setInputFiles({
        name: 'profile-photo.png',
        mimeType: 'image/png',
        buffer: PNG_BYTES,
      });
      await ownerPage.getByRole('button', { name: 'Upload photo' }).click();
      await expect(ownerPage.getByText('Profile photo uploaded.', { exact: true })).toBeVisible();
      await expect(ownerPage.getByRole('button', { name: 'Remove photo' })).toBeVisible();

      const publicPage = await browser.newPage();
      await publicPage.setViewportSize(viewport);
      await publicPage.goto(`/users/@${handle}`);
      const avatar = publicPage.getByRole('img', { name: /avatar$/ });
      await expect(avatar).toBeVisible();
      await expect(avatar).toHaveAttribute('src', `/api/profile-images/${handle}/`);
      await publicPage.screenshot({
        path: testInfo.outputPath(`profile-photo-uploaded-${viewport.width}.png`),
        fullPage: true,
      });

      await ownerPage.locator('#profile-image-file').setInputFiles({
        name: 'not-an-image.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('not an image'),
      });
      await ownerPage.getByRole('button', { name: 'Upload photo' }).click();
      await expect(
        ownerPage.getByText('Profile photo must be a PNG, JPEG, GIF, or WebP image.', {
          exact: true,
        }),
      ).toBeVisible();
      await expect(ownerPage.getByRole('button', { name: 'Remove photo' })).toBeVisible();

      await ownerPage.getByRole('button', { name: 'Remove photo' }).click();
      await expect(ownerPage.getByText('Profile photo removed.', { exact: true })).toBeVisible();
      await expect(ownerPage.getByRole('button', { name: 'Remove photo' })).toHaveCount(0);
      await publicPage.reload();
      await expect(publicPage.getByRole('img', { name: /avatar$/ })).toHaveCount(0);

      await publicPage.close();
      await ownerContext.close();
    });
  }
});
