import { expect, test, type BrowserContext } from '@playwright/test';

import { apiGet, apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900, label: 'desktop' },
  { width: 375, height: 812, label: 'mobile' },
] as const;
const MODES = ['light', 'dark'] as const;
const ROUTES = [
  { path: '/', label: 'home' },
  { path: '/gallery', label: 'gallery' },
  { path: '/users/@e2e_owner', label: 'pareto-profile' },
  { path: '/users/@e2e_other', label: 'plain-profile' },
] as const;

type Settings = {
  site_title: string;
  site_description: string;
  metadata_tags: string[];
  cloud_sync_enabled: boolean;
  revision: number;
  theme_config: Record<string, string>;
  style_key: string;
};

type Profile = {
  revision: number;
  style_key: string;
  theme_config: Record<string, string>;
  is_public: boolean;
};

async function profile(context: BrowserContext): Promise<Profile> {
  const response = await apiGet(context, '/api/account/profile/');
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as Profile;
}

test.describe('Design-scheme evidence matrix (#655)', () => {
  const fixtures = requireE2EFixtures();

  test('captures Celestial/Pareto routes in both modes and viewports', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(120000);
    const adminContext = await browser.newContext();
    const ownerContext = await browser.newContext();
    const otherContext = await browser.newContext();
    const anonymousContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginViaUI(adminPage, fixtures.admin.email, fixtures.password);

    const ownerPage = await ownerContext.newPage();
    const otherPage = await otherContext.newPage();
    const anonymousPage = await anonymousContext.newPage();
    await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);
    await loginViaUI(otherPage, fixtures.other.email, fixtures.password);

    const settingsResponse = await apiGet(adminContext, '/api/admin/settings/');
    expect(settingsResponse.ok(), await settingsResponse.text()).toBe(true);
    const settings = (await settingsResponse.json()) as Settings;
    const ownerBefore = await profile(ownerContext);
    const otherBefore = await profile(otherContext);

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

      const ownerUpdate = await apiPatch(ownerContext, '/api/account/profile/', {
        ...ownerBefore,
        style_key: 'pareto',
        theme_config: {},
        revision: ownerBefore.revision,
      });
      expect(ownerUpdate.ok(), await ownerUpdate.text()).toBe(true);
      const otherUpdate = await apiPatch(otherContext, '/api/account/profile/', {
        ...otherBefore,
        style_key: 'default',
        theme_config: {},
        revision: otherBefore.revision,
      });
      expect(otherUpdate.ok(), await otherUpdate.text()).toBe(true);

      for (const mode of MODES) {
        for (const viewport of VIEWPORTS) {
          for (const route of ROUTES) {
            const page =
              route.label === 'pareto-profile'
                ? ownerPage
                : route.label === 'plain-profile'
                  ? otherPage
                  : anonymousPage;
            await page.setViewportSize(viewport);
            await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
            await page.addInitScript(
              (selectedMode) =>
                localStorage.setItem('augmentrart:theme-preference:v1', selectedMode),
              mode,
            );
            await page.goto(route.path);
            await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
            await expect(page.locator('.reduced-motion-status')).toContainText('reduced');

            const style = await page.locator('html').evaluate((element) => ({
              font: element.dataset.siteFont ?? 'default',
              backdrop: element.dataset.siteBackdrop ?? 'plain',
              theme: element.dataset.theme ?? 'unknown',
            }));
            if (route.label.endsWith('profile')) {
              await expect(page.locator('.public-profile')).toBeVisible();
            } else {
              await expect(page.getByRole('main').first()).toBeVisible();
            }
            console.log(
              JSON.stringify({
                route: route.label,
                viewport: `${viewport.width}x${viewport.height}`,
                mode,
                visibleStyle: style,
              }),
            );
            await page.screenshot({
              path: testInfo.outputPath(`${route.label}-${viewport.label}-${mode}.png`),
              fullPage: true,
            });
          }
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
      const ownerCurrent = await profile(ownerContext);
      await apiPatch(ownerContext, '/api/account/profile/', {
        ...ownerBefore,
        revision: ownerCurrent.revision,
      });
      const otherCurrent = await profile(otherContext);
      await apiPatch(otherContext, '/api/account/profile/', {
        ...otherBefore,
        revision: otherCurrent.revision,
      });
    }

    await adminContext.close();
    await ownerContext.close();
    await otherContext.close();
    await anonymousContext.close();
  });
});
