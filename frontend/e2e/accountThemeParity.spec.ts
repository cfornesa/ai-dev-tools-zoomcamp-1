import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';

import { apiGet, apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];
const SCHEMES = [
  { preference: 'light', os: 'light', expected: 'light' },
  { preference: 'dark', os: 'light', expected: 'dark' },
  { preference: 'system', os: 'light', expected: 'light' },
  { preference: 'system', os: 'dark', expected: 'dark' },
] as const;

async function adminSettings(context: BrowserContext) {
  const response = await apiGet(context, '/api/admin/settings/');
  expect(response.status()).toBe(200);
  return (await response.json()) as { site_title: string; revision: number; palette_key: string };
}

async function setPalette(context: BrowserContext, paletteKey: string) {
  const current = await adminSettings(context);
  const response = await apiPatch(context, '/api/admin/settings/', {
    site_title: current.site_title,
    revision: current.revision,
    palette_key: paletteKey,
  });
  expect(response.status()).toBe(200);
}

async function computedTheme(page: Page) {
  return page.locator('html').evaluate((root) => {
    const style = getComputedStyle(root);
    return {
      bg: style.getPropertyValue('--bg').trim(),
      accent: style.getPropertyValue('--accent').trim(),
      codeBg: style.getPropertyValue('--code-bg').trim(),
      text: style.getPropertyValue('--text').trim(),
      textH: style.getPropertyValue('--text-h').trim(),
      siteFont: root.getAttribute('data-site-font'),
      siteShadow: root.getAttribute('data-site-shadow'),
      siteBackdrop: root.getAttribute('data-site-backdrop'),
      density: style.getPropertyValue('--site-density').trim(),
      radius: style.getPropertyValue('--site-radius').trim(),
      borderStyle: style.getPropertyValue('--site-border-style').trim(),
      mode: root.getAttribute('data-theme'),
      preference: root.getAttribute('data-theme-preference'),
      colorScheme: style.colorScheme,
    };
  });
}

async function assertContrast(page: Page) {
  const ratios = await page.evaluate(() => {
    const root = document.documentElement;
    const sample = document.createElement('span');
    sample.style.cssText =
      'position:fixed;visibility:hidden;color:var(--text-h);background:var(--bg)';
    root.append(sample);
    const bodyStyle = getComputedStyle(sample);
    const bodyForeground = bodyStyle.color;
    const bodyBackground = bodyStyle.backgroundColor;
    sample.style.color = 'var(--text)';
    sample.style.background = 'var(--code-bg)';
    const mutedStyle = getComputedStyle(sample);
    const mutedForeground = mutedStyle.color;
    const cardBackground = mutedStyle.backgroundColor;
    const buttons = [...document.querySelectorAll('button')];
    if (!buttons.length) throw new Error('Login submit button missing');
    sample.remove();
    const rgb = (color: string) => {
      const srgb = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
      if (srgb) return srgb.slice(1).map(Number);
      return (
        color
          .match(/[\d.]+/g)
          ?.slice(0, 3)
          .map((value) => Number(value) / 255) ?? []
      );
    };
    const luminance = (color: string) => {
      const channels = rgb(color).map((value) => {
        const normalized = value;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const ratio = (foreground: string, background: string) => {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    const buttonRatios = buttons.map((button) => {
      const buttonStyle = getComputedStyle(button);
      return ratio(buttonStyle.color, buttonStyle.backgroundColor);
    });
    return {
      body: ratio(bodyForeground, bodyBackground),
      muted: ratio(mutedForeground, cardBackground),
      buttons: buttonRatios,
    };
  });
  expect(ratios.body).toBeGreaterThanOrEqual(4.5);
  expect(ratios.muted).toBeGreaterThanOrEqual(4.5);
  expect(Math.min(...ratios.buttons), JSON.stringify(ratios)).toBeGreaterThanOrEqual(3);
}

test('allauth login matches SPA theme and remains readable across preferences and palettes (#1124)', async ({
  browser,
}, testInfo: TestInfo) => {
  test.setTimeout(180000);
  const fixture = requireE2EFixtures();
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginViaUI(adminPage, fixture.admin.email, fixture.password);
  const context = await browser.newContext();
  const page = await context.newPage();
  const before = await adminSettings(adminContext);

  try {
    for (const palette of [before.palette_key, 'bauhaus']) {
      await setPalette(adminContext, palette);
      for (const viewport of VIEWPORTS) {
        await test.step(`${palette} · ${viewport.width}x${viewport.height}`, async () => {
          await page.setViewportSize(viewport);
          for (const scheme of SCHEMES) {
            await page.emulateMedia({ colorScheme: scheme.os });
            await page.goto('/gallery');
            await page.evaluate((preference) => {
              localStorage.setItem('augmentrart:theme-preference:v1', preference);
            }, scheme.preference);
            await page.reload();
            await expect(page.locator('html')).toHaveAttribute('data-theme', scheme.expected);
            const themeResponse = await apiGet(context, '/api/site-theme/');
            expect(themeResponse.status()).toBe(200);
            const siteTheme = (await themeResponse.json()) as {
              theme_palettes: Record<'light' | 'dark', { background: string }>;
            };
            await expect
              .poll(async () => (await computedTheme(page)).bg)
              .toBe(siteTheme.theme_palettes[scheme.expected].background);
            const spaTheme = await computedTheme(page);
            await page.evaluate(() => document.fonts.ready);
            await page.screenshot({
              path: testInfo.outputPath(
                `${palette}-${viewport.width}x${viewport.height}-${scheme.preference}-${scheme.os}-gallery.png`,
              ),
              fullPage: true,
            });

            const loginResponse = await page.goto('/accounts/login/');
            expect(loginResponse?.status()).toBe(200);
            await expect(page.locator('html')).toHaveAttribute('data-theme', scheme.expected);
            await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
            await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
            await page.evaluate(() => document.fonts.ready);
            const fontEvidence = await page.evaluate(() => ({
              check: document.fonts.check('400 32px "Pinyon Script"'),
              heading: getComputedStyle(document.querySelector('h1')!).fontFamily,
              faces: [...document.fonts].map((face) => ({
                family: face.family,
                status: face.status,
              })),
            }));
            expect(fontEvidence.check, JSON.stringify(fontEvidence)).toBe(true);
            const accountTheme = await computedTheme(page);
            expect(accountTheme).toEqual(spaTheme);
            await assertContrast(page);
            await page.screenshot({
              path: testInfo.outputPath(
                `${palette}-${viewport.width}x${viewport.height}-${scheme.preference}-${scheme.os}-login.png`,
              ),
              fullPage: true,
            });
          }
        });
      }
    }
  } finally {
    await setPalette(adminContext, before.palette_key);
    await context.close();
    await adminContext.close();
  }
});

test('blocked localStorage falls back to system theme on allauth before page scripts can throw (#1124)', async ({
  browser,
}) => {
  const context = await browser.newContext({ colorScheme: 'dark' });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage blocked');
      },
    });
  });
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const response = await page.goto('/accounts/login/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(pageErrors).toEqual([]);
  await context.close();
});
