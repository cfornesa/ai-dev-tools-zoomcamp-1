import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { apiDelete, apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900, label: 'desktop' },
  { width: 375, height: 812, label: 'mobile' },
] as const;
const MODES = [
  { name: 'light', background: '#f4ead3', accent: '#b8892e' },
  { name: 'dark', background: '#071b2a', accent: '#e4b95c' },
] as const;

type Profile = {
  revision: number;
  style_key: string | null;
  theme_config: Record<string, string>;
  theme_palettes?: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
  presentation?: { font_family?: string };
};

async function readProfile(context: BrowserContext): Promise<Profile> {
  const response = await apiGet(context, '/api/account/profile/');
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as Profile;
}

async function assertInheritedStyle(page: Page, mode: (typeof MODES)[number]) {
  const style = await page
    .locator('.public-profile, .public-collection')
    .first()
    .evaluate((node) => {
      const computed = getComputedStyle(node);
      return {
        background: computed.getPropertyValue('--profile-background').trim(),
        accent: computed.getPropertyValue('--profile-accent').trim(),
        font: computed.getPropertyValue('--profile-font').trim(),
        headingFont: getComputedStyle(node.querySelector('h2, h3') ?? node).fontFamily,
      };
    });
  expect(style.background).toBe(mode.background);
  expect(style.accent).toBe(mode.accent);
  expect(style.font).toContain('Lora');
  expect(style.headingFont).toContain('Pinyon Script');
}

test.describe('profile style inheritance (#672)', () => {
  const fixtures = requireE2EFixtures();

  test('inherits the active site style on profile and collection pages in both modes/viewports', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(120000);
    const adminContext = await browser.newContext();
    const otherContext = await browser.newContext();
    const anonymousContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const otherPage = await otherContext.newPage();
    const anonymousPage = await anonymousContext.newPage();
    await loginViaUI(adminPage, fixtures.admin.email, fixtures.password);
    await loginViaUI(otherPage, fixtures.other.email, fixtures.password);

    const settingsResponse = await apiGet(adminContext, '/api/admin/settings/');
    expect(settingsResponse.ok(), await settingsResponse.text()).toBe(true);
    const settings = (await settingsResponse.json()) as Record<string, unknown> & {
      revision: number;
      style_key: string | null;
    };
    const otherBefore = await readProfile(otherContext);
    const collectionResponse = await apiPost(otherContext, '/api/account/collections/', {
      title: 'Inherited style collection',
      description: 'Collection surface for the style cascade regression.',
    });
    expect(collectionResponse.status()).toBe(201);
    const collection = (await collectionResponse.json()) as { id: string; slug: string };
    const publishResponse = await apiPost(
      otherContext,
      `/api/account/collections/${collection.id}/publish/`,
    );
    expect(publishResponse.ok(), await publishResponse.text()).toBe(true);

    try {
      const siteUpdate = await apiPatch(adminContext, '/api/admin/settings/', {
        site_title: settings.site_title,
        site_description: settings.site_description,
        metadata_tags: settings.metadata_tags,
        cloud_sync_enabled: settings.cloud_sync_enabled,
        theme_config: {},
        style_key: 'celestial',
        revision: settings.revision,
      });
      expect(siteUpdate.ok(), await siteUpdate.text()).toBe(true);

      const otherUpdate = await apiPatch(otherContext, '/api/account/profile/', {
        ...otherBefore,
        style_key: 'default',
        theme_config: {},
        revision: otherBefore.revision,
      });
      expect(otherUpdate.ok(), await otherUpdate.text()).toBe(true);

      const handle = 'e2e_other';
      for (const mode of MODES) {
        for (const viewport of VIEWPORTS) {
          await anonymousPage.setViewportSize(viewport);
          await anonymousPage.emulateMedia({ colorScheme: mode.name, reducedMotion: 'reduce' });
          await anonymousPage.addInitScript(
            (selectedMode) => localStorage.setItem('augmentrart:theme-preference:v1', selectedMode),
            mode.name,
          );

          await anonymousPage.goto(`/users/@${handle}`);
          await expect(anonymousPage.locator('.public-profile')).toBeVisible();
          await expect(anonymousPage.locator('.reduced-motion-status')).toContainText('reduced');
          await assertInheritedStyle(anonymousPage, mode);
          await anonymousPage.screenshot({
            path: testInfo.outputPath(`profile-${viewport.label}-${mode.name}.png`),
            fullPage: true,
          });

          await anonymousPage.goto(`/users/@${handle}/collections/${collection.slug}`);
          await expect(
            anonymousPage.getByRole('heading', { name: 'Inherited style collection' }),
          ).toBeVisible();
          await assertInheritedStyle(anonymousPage, mode);
          await anonymousPage.screenshot({
            path: testInfo.outputPath(`collection-${viewport.label}-${mode.name}.png`),
            fullPage: true,
          });
        }
      }
    } finally {
      const currentSettings = (await (
        await apiGet(adminContext, '/api/admin/settings/')
      ).json()) as {
        revision: number;
      };
      await apiPatch(adminContext, '/api/admin/settings/', {
        site_title: settings.site_title,
        site_description: settings.site_description,
        metadata_tags: settings.metadata_tags,
        cloud_sync_enabled: settings.cloud_sync_enabled,
        theme_config: settings.theme_config,
        style_key: settings.style_key,
        revision: currentSettings.revision,
      });
      const otherCurrent = await readProfile(otherContext);
      await apiPatch(otherContext, '/api/account/profile/', {
        ...otherBefore,
        revision: otherCurrent.revision,
      });
      await apiDelete(otherContext, `/api/account/collections/${collection.id}/`);
    }

    await adminContext.close();
    await otherContext.close();
    await anonymousContext.close();
  });
});
