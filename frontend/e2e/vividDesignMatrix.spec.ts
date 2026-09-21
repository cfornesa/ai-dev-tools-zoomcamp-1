import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 375, height: 812, label: 'mobile' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 1280, height: 900, label: 'desktop' },
] as const;
const MODES = ['light', 'dark'] as const;
const STYLES = [
  { key: 'default', label: 'default' },
  { key: 'pareto', label: 'pareto' },
] as const;

type SiteSettings = {
  site_title: string;
  site_description: string;
  metadata_tags: string[];
  cloud_sync_enabled: boolean;
  theme_config: Record<string, string>;
  style_key: string;
  revision: number;
};

test.describe('Vivid design evidence matrix (#683)', () => {
  const fixtures = requireE2EFixtures();

  test('captures header, AI panel, and account settings across styles, modes, and widths', async ({
    browser,
  }, testInfo) => {
    test.setTimeout(240000);
    const adminContext = await browser.newContext();
    const ownerContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const ownerPage = await ownerContext.newPage();
    await loginViaUI(adminPage, fixtures.admin.email, fixtures.password);
    await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);

    const settingsResponse = await apiGet(adminContext, '/api/admin/settings/');
    expect(settingsResponse.ok(), await settingsResponse.text()).toBe(true);
    const settings = (await settingsResponse.json()) as SiteSettings;
    const created = await apiPost(ownerContext, '/api/projects/blank/');
    expect(created.ok(), await created.text()).toBe(true);
    const { id } = (await created.json()) as { id: string };

    try {
      const siteUpdate = await apiPatch(adminContext, '/api/admin/settings/', {
        site_title: settings.site_title,
        site_description: settings.site_description,
        metadata_tags: settings.metadata_tags,
        cloud_sync_enabled: settings.cloud_sync_enabled,
        style_key: 'celestial',
        theme_config: {},
        revision: settings.revision,
      });
      expect(siteUpdate.ok(), await siteUpdate.text()).toBe(true);

      for (const style of STYLES) {
        const currentSettings = (await (
          await apiGet(adminContext, '/api/admin/settings/')
        ).json()) as { revision: number };
        const selected = await apiPatch(adminContext, '/api/admin/settings/', {
          site_title: settings.site_title,
          site_description: settings.site_description,
          metadata_tags: settings.metadata_tags,
          cloud_sync_enabled: settings.cloud_sync_enabled,
          style_key: style.key,
          theme_config: {},
          revision: currentSettings.revision,
        });
        expect(selected.ok(), await selected.text()).toBe(true);

        for (const mode of MODES) {
          for (const viewport of VIEWPORTS) {
            await ownerPage.setViewportSize(viewport);
            await ownerPage.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
            await ownerPage.addInitScript(
              (selectedMode) =>
                localStorage.setItem('augmentrart:theme-preference:v1', selectedMode),
              mode,
            );

            await ownerPage.goto('/studio');
            await expect(
              ownerPage.getByRole('combobox', { name: /Color mode, currently/i }),
            ).toHaveCount(1);
            await expect(ownerPage.getByRole('link', { name: 'Home', exact: true })).toHaveCount(0);
            await expect(
              ownerPage.getByRole('radiogroup', { name: 'Reduce motion' }),
            ).toBeVisible();

            await ownerPage.goto('/ai-projects/' + id);
            const panel = ownerPage.locator('.ai-proposal-panel');
            await expect(panel).toBeVisible();
            const prompt = ownerPage.getByLabel('Describe the scene you want to generate');
            const promptBox = await prompt.boundingBox();
            const panelBox = await panel.boundingBox();
            expect(promptBox).not.toBeNull();
            expect(panelBox).not.toBeNull();
            expect(promptBox!.width).toBeGreaterThanOrEqual(panelBox!.width - 2);
            await expect(panel.getByRole('radiogroup')).toHaveCount(2);

            await ownerPage.goto('/account/settings');
            await expect(
              ownerPage.getByRole('heading', { name: 'Account settings' }),
            ).toBeVisible();
            await expect(ownerPage.getByRole('form', { name: 'Profile settings' })).toBeVisible();
            await expect(
              ownerPage.getByRole('button', { name: 'Reorder Public profile' }),
            ).toBeVisible();

            const evidence = await ownerPage.locator('html').evaluate((element) => ({
              style: element.dataset.siteFont ?? 'default',
              backdrop: element.dataset.siteBackdrop ?? 'plain',
              shadow: element.dataset.siteShadow ?? 'none',
              radius: element.dataset.siteRadius ?? 'soft',
              theme: element.dataset.theme ?? 'unknown',
            }));
            expect(evidence.theme).toBe(mode);
            expect(evidence.shadow).toBe(style.key === 'pareto' ? 'offset' : 'none');
            expect(
              await ownerPage.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
              ),
            ).toBe(true);
            console.log(
              JSON.stringify({
                style: style.label,
                mode,
                viewport: viewport.width + 'x' + viewport.height,
                visibleStyle: evidence,
              }),
            );
            await ownerPage.screenshot({
              path: testInfo.outputPath(
                'vivid-' + style.label + '-' + mode + '-' + viewport.label + '.png',
              ),
              fullPage: true,
            });
          }
        }
      }
    } finally {
      const currentSettings = (await (
        await apiGet(adminContext, '/api/admin/settings/')
      ).json()) as { revision: number };
      await apiPatch(adminContext, '/api/admin/settings/', {
        site_title: settings.site_title,
        site_description: settings.site_description,
        metadata_tags: settings.metadata_tags,
        cloud_sync_enabled: settings.cloud_sync_enabled,
        theme_config: settings.theme_config,
        style_key: settings.style_key,
        revision: currentSettings.revision,
      });
    }

    await adminContext.close();
    await ownerContext.close();
  });
});
