import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';

import { apiGet, apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
] as const;
const THEMES = ['light', 'dark'] as const;
const PRESENTATIONS = ['soft', 'none', 'offset', 'default'] as const;
const THEME_PREFERENCE_KEY = 'augmentrart:theme-preference:v1';

type AdminSettings = {
  site_title: string;
  revision: number;
  presentation_overrides: Record<string, unknown>;
  presentation: { shadow: string };
};

async function readAdminSettings(context: BrowserContext): Promise<AdminSettings> {
  const response = await apiGet(context, '/api/admin/settings/');
  expect(response.status()).toBe(200);
  return (await response.json()) as AdminSettings;
}

async function setPresentation(
  context: BrowserContext,
  presentationOverrides: Record<string, unknown>,
): Promise<void> {
  const current = await readAdminSettings(context);
  const response = await apiPatch(context, '/api/admin/settings/', {
    site_title: current.site_title,
    revision: current.revision,
    presentation_overrides: presentationOverrides,
  });
  expect(response.status()).toBe(200);
}

async function prepareRoute(
  page: Page,
  theme: (typeof THEMES)[number],
  viewport: (typeof VIEWPORTS)[number],
): Promise<void> {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate(({ key, preference }) => localStorage.setItem(key, preference), {
    key: THEME_PREFERENCE_KEY,
    preference: theme,
  });
  await page.goto('/admin/content');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('.content-panel').first()).toBeVisible();
}

test('SPA content panel follows each site shadow presentation (#1146)', async ({
  browser,
}, testInfo: TestInfo) => {
  test.setTimeout(240000);
  const fixture = requireE2EFixtures();
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginViaUI(page, fixture.admin.email, fixture.password);
  const original = await readAdminSettings(context);
  const layout = new Map<
    string,
    {
      geometry: { x: number; y: number; width: number; height: number };
      borderColor: string;
      borderStyle: string;
    }
  >();
  const measurements: Array<Record<string, unknown>> = [];

  try {
    for (const presentation of PRESENTATIONS) {
      const overrides =
        presentation === 'default'
          ? original.presentation_overrides
          : { ...original.presentation_overrides, shadow: presentation };
      await setPresentation(context, overrides);

      for (const theme of THEMES) {
        for (const viewport of VIEWPORTS) {
          await test.step(`${presentation} · ${theme} · ${viewport.width}x${viewport.height}`, async () => {
            await prepareRoute(page, theme, viewport);
            const siteThemeResponse = await apiGet(context, '/api/site-theme/');
            expect(siteThemeResponse.status()).toBe(200);
            const siteTheme = (await siteThemeResponse.json()) as {
              presentation: { shadow: string };
            };
            const expectedPresentation =
              presentation === 'default' ? original.presentation.shadow : presentation;
            expect(siteTheme.presentation.shadow).toBe(expectedPresentation);

            const actual = await page
              .locator('.content-panel')
              .first()
              .evaluate((panel) => {
                const root = document.documentElement;
                const style = getComputedStyle(panel);
                const tokenProbe = document.createElement('span');
                tokenProbe.style.cssText = 'position:fixed;left:-10000px;box-shadow:var(--shadow)';
                root.append(tokenProbe);
                const tokenShadow = getComputedStyle(tokenProbe).boxShadow;
                tokenProbe.remove();
                const rect = panel.getBoundingClientRect();
                return {
                  siteShadow: root.getAttribute('data-site-shadow'),
                  token: getComputedStyle(root).getPropertyValue('--shadow').trim(),
                  tokenShadow,
                  panelShadow: style.boxShadow,
                  border: style.border,
                  borderColor: style.borderColor,
                  borderStyle: style.borderStyle,
                  borderWidth: style.borderWidth,
                  borderRadius: style.borderRadius,
                  radiusToken: getComputedStyle(root).getPropertyValue('--site-radius').trim(),
                  geometry: {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                  },
                  documentWidth: root.scrollWidth,
                  viewportWidth: root.clientWidth,
                };
              });

            expect(actual.siteShadow).toBe(expectedPresentation);
            if (presentation === 'none') {
              expect(actual.panelShadow).toBe('none');
              expect(actual.tokenShadow).toBe('none');
            } else {
              expect(actual.panelShadow).toBe(actual.tokenShadow);
              expect(actual.tokenShadow).not.toBe('none');
            }
            expect(actual.borderStyle).toBe('solid');
            if (presentation === 'offset') {
              expect(actual.panelShadow).toContain('4px 4px 0px 0px');
              expect(actual.borderWidth).toBe('2px');
              expect(actual.borderRadius).toBe('2px');
            } else {
              expect(actual.borderWidth).toBe('1px');
              expect(actual.borderRadius).toBe(actual.radiusToken);
            }
            expect(actual.documentWidth).toBeLessThanOrEqual(actual.viewportWidth + 1);

            const key = `${theme}/${viewport.width}x${viewport.height}`;
            const previousLayout = layout.get(key);
            if (previousLayout) {
              for (const dimension of ['x', 'y', 'width', 'height'] as const) {
                const offsetBorderAllowance =
                  presentation === 'offset' && ['width', 'height'].includes(dimension)
                    ? 2.1
                    : presentation === 'offset' && ['x', 'y'].includes(dimension)
                      ? 1.1
                      : 0.1;
                expect(
                  Math.abs(actual.geometry[dimension] - previousLayout.geometry[dimension]),
                  `${presentation} panel ${dimension} drift at ${key}`,
                ).toBeLessThanOrEqual(offsetBorderAllowance);
              }
              expect(actual.borderColor).toBe(previousLayout.borderColor);
              expect(actual.borderStyle).toBe(previousLayout.borderStyle);
            } else {
              layout.set(key, {
                geometry: actual.geometry,
                borderColor: actual.borderColor,
                borderStyle: actual.borderStyle,
              });
            }

            await page.screenshot({
              path: testInfo.outputPath(
                `${presentation}-${theme}-${viewport.width}x${viewport.height}.png`,
              ),
              fullPage: true,
            });
            measurements.push({ presentation, theme, viewport, ...actual });
          });
        }
      }
    }
  } finally {
    await setPresentation(context, original.presentation_overrides);
    await context.close();
  }

  await testInfo.attach('content-panel-shadow-matrix.json', {
    body: Buffer.from(JSON.stringify(measurements, null, 2)),
    contentType: 'application/json',
  });
});
