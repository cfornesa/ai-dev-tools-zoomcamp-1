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
const SHADOWS = ['none', 'soft', 'offset'] as const;
const THEME_PREFERENCE_KEY = 'augmentrart:theme-preference:v1';

type AdminSettings = {
  site_title: string;
  revision: number;
  palette_key: string;
  palette_overrides: Record<string, unknown>;
  presentation_overrides: Record<string, unknown>;
  presentation: { shadow: string; font_family: string };
};

async function readAdminSettings(context: BrowserContext): Promise<AdminSettings> {
  const response = await apiGet(context, '/api/admin/settings/');
  expect(response.status()).toBe(200);
  return (await response.json()) as AdminSettings;
}

async function updateAdminSettings(context: BrowserContext, changes: Record<string, unknown>) {
  const current = await readAdminSettings(context);
  const response = await apiPatch(context, '/api/admin/settings/', {
    site_title: current.site_title,
    revision: current.revision,
    ...changes,
  });
  expect(response.status()).toBe(200);
}

async function setPalette(context: BrowserContext, paletteKey: string) {
  await updateAdminSettings(context, { palette_key: paletteKey });
}

async function setPresentation(
  context: BrowserContext,
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
) {
  await updateAdminSettings(context, {
    presentation_overrides: { ...base, ...overrides },
  });
}

async function prepareTheme(
  context: BrowserContext,
  page: Page,
  viewport: { width: number; height: number },
  scheme: (typeof SCHEMES)[number],
  route: string,
) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ colorScheme: scheme.os, reducedMotion: 'no-preference' });
  if (page.url() === 'about:blank') await page.goto('/gallery');
  await page.evaluate(({ key, preference }) => localStorage.setItem(key, preference), {
    key: THEME_PREFERENCE_KEY,
    preference: scheme.preference,
  });
  await page.goto(route);
  await expect(page.locator('html')).toHaveAttribute('data-theme', scheme.expected);
  const response = await apiGet(context, '/api/site-theme/');
  expect(response.status()).toBe(200);
  const theme = (await response.json()) as {
    presentation: { shadow: string; font_family: string };
  };
  await expect(page.locator('html')).toHaveAttribute('data-site-shadow', theme.presentation.shadow);
  await expect(page.locator('html')).toHaveAttribute(
    'data-site-font',
    theme.presentation.font_family,
  );
}

async function appReference(page: Page) {
  await page.mouse.move(0, 0);
  const panel = await page
    .locator('.content-panel')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        borderColor: style.borderColor,
        borderStyle: style.borderStyle,
        borderWidth: style.borderWidth,
        radius: style.borderRadius,
        shadow: style.boxShadow,
      };
    });
  const action = await page
    .locator('.shell-action')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        borderColor: style.borderColor,
        borderStyle: style.borderStyle,
        borderWidth: style.borderWidth,
        color: style.color,
        radius: style.borderRadius,
        minHeight: style.minHeight,
        shadow: style.boxShadow,
      };
    });
  const presentation = await page.locator('html').evaluate((root) => {
    const style = getComputedStyle(root);
    const probe = document.createElement('span');
    probe.style.cssText = 'position:fixed;left:-10000px;box-shadow:var(--shadow)';
    root.append(probe);
    const shadowToken = getComputedStyle(probe).boxShadow;
    probe.remove();
    return {
      font: root.getAttribute('data-site-font'),
      shadow: root.getAttribute('data-site-shadow'),
      shadowToken,
      radius: style.getPropertyValue('--site-radius').trim(),
      borderStyle: style.getPropertyValue('--site-border-style').trim(),
    };
  });
  return { panel, action, presentation };
}

async function accountStyles(page: Page) {
  const card = await page.locator('.card').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      borderColor: style.borderColor,
      borderStyle: style.borderStyle,
      borderWidth: style.borderWidth,
      radius: style.borderRadius,
      shadow: style.boxShadow,
    };
  });
  const heading = await page.locator('h1').evaluate((element) => {
    const style = getComputedStyle(element);
    return { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight };
  });
  const primary = await page.locator('.auth-submit').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      color: style.color,
      borderColor: style.borderColor,
      borderStyle: style.borderStyle,
      borderWidth: style.borderWidth,
      radius: style.borderRadius,
      minHeight: style.minHeight,
      shadow: style.boxShadow,
    };
  });
  const providers = await page.locator('.auth-provider').evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        color: style.color,
        borderColor: style.borderColor,
        borderStyle: style.borderStyle,
        borderWidth: style.borderWidth,
        radius: style.borderRadius,
        minHeight: style.minHeight,
        shadow: style.boxShadow,
      };
    }),
  );
  const tokens = await page.locator('html').evaluate((root) => {
    const style = getComputedStyle(root);
    const probe = document.createElement('span');
    probe.style.cssText =
      'position:fixed;left:-10000px;background:var(--code-bg);color:var(--accent-bg);outline:1px solid var(--accent);border:1px solid var(--accent-border);font-family:var(--heading);box-shadow:var(--shadow)';
    root.append(probe);
    const resolved = getComputedStyle(probe);
    const primaryProbe = document.createElement('span');
    primaryProbe.style.cssText = 'position:fixed;left:-10000px;background:var(--accent-primary-bg)';
    root.append(primaryProbe);
    const values = {
      codeBackground: resolved.backgroundColor,
      accentBackground: resolved.color,
      accentPrimaryBackground: getComputedStyle(primaryProbe).backgroundColor,
      accentBorder: resolved.borderColor,
      accent: resolved.outlineColor,
      headingFont: resolved.fontFamily,
      shadow: resolved.boxShadow,
      text: style.color,
      radius: style.getPropertyValue('--site-radius').trim(),
      borderStyle: style.getPropertyValue('--site-border-style').trim(),
    };
    probe.remove();
    primaryProbe.remove();
    return values;
  });
  return { card, heading, primary, providers, tokens };
}

async function assertTokenParity(page: Page, appPage: Page) {
  const reference = await appReference(appPage);
  const account = await accountStyles(page);
  const expectedActionRadius =
    reference.presentation.shadow === 'offset' ? '2px' : account.tokens.radius;
  const expectedActionShadow =
    reference.presentation.shadow === 'offset' ? account.tokens.shadow : reference.action.shadow;
  expect(account.card.radius).toBe(reference.panel.radius);
  expect(account.card.borderStyle).toBe(reference.panel.borderStyle);
  expect(account.card.borderWidth).toBe(reference.panel.borderWidth);
  expect(account.card.shadow).toBe(account.tokens.shadow);
  expect(account.card.background).toBe(account.tokens.codeBackground);
  expect(account.heading.family).toBe(account.tokens.headingFont);
  expect(account.heading.size).toBe('36px');
  expect(account.heading.weight).toBe('500');
  expect(account.primary.radius).toBe(expectedActionRadius);
  expect(account.primary.borderStyle).toBe(reference.action.borderStyle);
  expect(account.primary.borderWidth).toBe(reference.action.borderWidth);
  expect(account.primary.minHeight).toBe(reference.action.minHeight);
  expect(account.primary.background).toBe(account.tokens.accentPrimaryBackground);
  expect(account.primary.color).toBe(account.tokens.text);
  expect(account.primary.borderColor).toBe(account.tokens.accentBorder);
  expect(account.providers.length).toBeGreaterThan(0);
  for (const provider of account.providers) {
    expect(provider.radius).toBe(expectedActionRadius);
    expect(provider.borderStyle).toBe(reference.action.borderStyle);
    expect(provider.borderWidth).toBe(reference.action.borderWidth);
    expect(provider.minHeight).toBe(reference.action.minHeight);
    expect(provider.color).toBe(account.tokens.text);
    expect(provider.borderColor).toBe(account.tokens.accentBorder);
    expect(provider.background).toBe(account.tokens.accentBackground);
    expect(provider.shadow).toBe(expectedActionShadow);
  }
  return { reference, account };
}

async function assertErrorAndDisabledStyles(page: Page) {
  const result = await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#id_login');
    const card = document.querySelector('.card');
    if (!input || !card) throw new Error('login form or card missing');
    input.disabled = true;
    const error = document.createElement('ul');
    error.className = 'errorlist';
    error.textContent = 'Example validation message';
    card.append(error);
    const probe = document.createElement('span');
    probe.style.cssText =
      'position:fixed;left:-10000px;background:var(--accent-bg);color:var(--text-h);border:1px solid var(--accent-border);border-radius:var(--site-radius)';
    document.documentElement.append(probe);
    const inputStyle = getComputedStyle(input);
    const errorStyle = getComputedStyle(error);
    const values = {
      disabledOpacity: inputStyle.opacity,
      disabledCursor: inputStyle.cursor,
      errorBackground: errorStyle.backgroundColor,
      errorColor: errorStyle.color,
      errorBorder: errorStyle.borderColor,
      errorRadius: errorStyle.borderRadius,
      expectedErrorBackground: getComputedStyle(probe).backgroundColor,
      expectedErrorColor: getComputedStyle(probe).color,
      expectedErrorBorder: getComputedStyle(probe).borderColor,
      expectedErrorRadius: getComputedStyle(probe).borderRadius,
    };
    probe.remove();
    error.remove();
    input.disabled = false;
    return values;
  });
  expect(result.disabledOpacity).toBe('0.65');
  expect(result.disabledCursor).toBe('not-allowed');
  expect(result.errorBackground).toBe(result.expectedErrorBackground);
  expect(result.errorColor).toBe(result.expectedErrorColor);
  expect(result.errorBorder).toBe(result.expectedErrorBorder);
  expect(result.errorRadius).toBe(result.expectedErrorRadius);
}

async function assertKeyboardAndPointerStates(
  page: Page,
  providerCapture: { post: string | null },
): Promise<void> {
  await page.route('**/accounts/**', async (route) => {
    if (route.request().method() === 'POST') {
      providerCapture.post = route.request().postData();
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: 'OAuth POST captured locally.',
      });
    } else {
      await route.continue();
    }
  });
  const provider = page.locator('.auth-provider').first();
  let isFocusVisible = false;
  for (let attempt = 0; attempt < 10 && !isFocusVisible; attempt += 1) {
    await page.keyboard.press('Tab');
    isFocusVisible = await provider.evaluate((element) => element.matches(':focus-visible'));
  }
  expect(isFocusVisible).toBe(true);
  const focusRing = await provider.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
  });
  expect(focusRing.style).toBe('solid');
  expect(focusRing.width).toBe('3px');

  const accentBorder = await page.locator('html').evaluate((root) => {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:fixed;left:-10000px;background:var(--accent-border)';
    root.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  const primary = page.locator('.auth-submit');
  await primary.hover();
  await expect
    .poll(() => primary.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe(accentBorder);
  await provider.hover();
  await expect
    .poll(() => provider.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe(accentBorder);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  await expect
    .poll(() =>
      provider.evaluate((element) => {
        const duration = getComputedStyle(element).transitionDuration;
        const value = Number.parseFloat(duration);
        return duration.endsWith('ms') ? value : value * 1000;
      }),
    )
    .toBeLessThanOrEqual(0.01);
  await page.mouse.down();
  await expect
    .poll(() =>
      provider.evaluate((element) => ({
        matches: element.matches(':active'),
        offset: new DOMMatrix(getComputedStyle(element).transform).m42,
      })),
    )
    .toMatchObject({ matches: true });
  await expect
    .poll(() =>
      provider.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m42),
    )
    .toBeGreaterThan(0);
  await page.mouse.up();
}

test('allauth controls match site components across theme, shadow, font, and zoom settings (#1125)', async ({
  browser,
}, testInfo: TestInfo) => {
  test.setTimeout(300000);
  const fixture = requireE2EFixtures();
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginViaUI(adminPage, fixture.admin.email, fixture.password);
  const publicContext = await browser.newContext();
  const page = await publicContext.newPage();
  const original = await readAdminSettings(adminContext);
  const comparisons: Array<Record<string, unknown>> = [];
  const providerCapture = { post: null as string | null };

  try {
    for (const palette of [original.palette_key, 'bauhaus']) {
      await setPalette(adminContext, palette);
      for (const viewport of VIEWPORTS) {
        for (const scheme of SCHEMES) {
          await test.step(`${palette} · ${viewport.width}x${viewport.height} · ${scheme.preference}/${scheme.os}`, async () => {
            await prepareTheme(adminContext, adminPage, viewport, scheme, '/admin/content');
            await expect(adminPage.locator('.content-panel').first()).toBeVisible();
            await prepareTheme(publicContext, page, viewport, scheme, '/accounts/login/');
            await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
            await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
            await expect(page.locator('.auth-submit')).toHaveCount(1);
            await expect(page.locator('.auth-provider')).toHaveCount(
              (await page.locator('form[action^="/accounts/"]').count()) - 1,
            );

            const { reference, account } = await assertTokenParity(page, adminPage);
            expect(
              account.providers.every(
                (provider) => provider.background === account.providers[0].background,
              ),
            ).toBe(true);
            expect(account.primary.minHeight).toBe('44px');
            for (const provider of account.providers) expect(provider.minHeight).toBe('44px');

            if (viewport.width === 375) {
              await page.evaluate(() => document.fonts.ready);
            }

            await page.screenshot({
              path: testInfo.outputPath(
                `${palette}-${viewport.width}x${viewport.height}-${scheme.preference}-${scheme.os}-account-styles.png`,
              ),
              fullPage: true,
            });
            await assertErrorAndDisabledStyles(page);
            if (
              palette === original.palette_key &&
              viewport.width === 1280 &&
              scheme.expected === 'dark'
            ) {
              await assertKeyboardAndPointerStates(page, providerCapture);
            }
            comparisons.push({ palette, viewport, scheme, reference, account });
          });
        }
      }
    }

    await setPalette(adminContext, original.palette_key);
    for (const shadow of ['default', ...SHADOWS] as const) {
      if (shadow === 'default') {
        await setPresentation(adminContext, {}, original.presentation_overrides);
      } else {
        await setPresentation(adminContext, original.presentation_overrides, { shadow });
      }
      for (const viewport of VIEWPORTS) {
        const scheme = SCHEMES[0];
        await test.step(`${shadow} shadow · ${viewport.width}x${viewport.height}`, async () => {
          await prepareTheme(adminContext, adminPage, viewport, scheme, '/admin/content');
          await prepareTheme(publicContext, page, viewport, scheme, '/accounts/login/');
          const { reference, account } = await assertTokenParity(page, adminPage);
          const actualShadow = (await page.locator('html').getAttribute('data-site-shadow')) ?? '';
          if (shadow === 'default') expect(actualShadow).toBe(original.presentation.shadow);
          else expect(actualShadow).toBe(shadow);
          await page.screenshot({
            path: testInfo.outputPath(`${shadow}-shadow-${viewport.width}x${viewport.height}.png`),
            fullPage: true,
          });
          comparisons.push({ shadow, viewport, reference, account });
        });
      }
    }

    await setPresentation(adminContext, original.presentation_overrides, { font_family: 'script' });
    for (const viewport of [VIEWPORTS[1], { width: 188, height: 406 }]) {
      await prepareTheme(adminContext, adminPage, viewport, SCHEMES[3], '/admin/content');
      await prepareTheme(publicContext, page, viewport, SCHEMES[3], '/accounts/login/');
      const { account } = await assertTokenParity(page, adminPage);
      expect(await page.locator('html').getAttribute('data-site-font')).toBe('script');
      const dimensions = await page.evaluate(() => {
        const root = document.documentElement;
        const overflow = Array.from(document.querySelectorAll('body *'))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName,
              className: typeof element.className === 'string' ? element.className : '',
              text: element.textContent?.trim().slice(0, 45) ?? '',
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
            };
          })
          .filter((element) => element.right > window.innerWidth + 1 || element.left < -1);
        return {
          viewport: window.innerWidth,
          client: root.clientWidth,
          scroll: root.scrollWidth,
          overflow,
        };
      });
      expect(dimensions.scroll, JSON.stringify(dimensions)).toBeLessThanOrEqual(
        dimensions.client + 1,
      );
      const clipped = await page.locator('.card *').evaluateAll((elements) =>
        elements
          .filter(
            (element) => element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1,
          )
          .map((element) => ({
            tag: element.tagName,
            text: element.textContent?.trim().slice(0, 60) ?? '',
          })),
      );
      expect(clipped).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`script-font-${viewport.width}x${viewport.height}.png`),
        fullPage: true,
      });
      comparisons.push({ font: 'script', viewport, dimensions, account });
    }

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reducedMotionDuration = await page
      .locator('.auth-provider')
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(reducedMotionDuration).toBe('0s');

    if (!providerCapture.post) await page.locator('.auth-provider').first().click();
    expect(providerCapture.post).toContain('csrfmiddlewaretoken=');

    console.info('ACCOUNT_COMPONENT_STYLE_COMPARISON', JSON.stringify(comparisons[0]));
    await testInfo.attach('account-component-style-comparisons.json', {
      body: Buffer.from(JSON.stringify(comparisons, null, 2)),
      contentType: 'application/json',
    });
  } finally {
    await updateAdminSettings(adminContext, {
      palette_key: original.palette_key,
      palette_overrides: original.palette_overrides,
      presentation_overrides: original.presentation_overrides,
    });
    await publicContext.close();
    await adminContext.close();
  }
});
