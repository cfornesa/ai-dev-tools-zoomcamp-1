import { expect, test, type Page, type TestInfo } from '@playwright/test';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];
const PREFERENCES = [
  { preference: 'light', os: 'light', expected: 'light' },
  { preference: 'dark', os: 'light', expected: 'dark' },
  { preference: 'system', os: 'light', expected: 'light' },
  { preference: 'system', os: 'dark', expected: 'dark' },
] as const;
const ACCOUNT_ROUTES = [
  { name: 'login', path: '/accounts/login/' },
  { name: 'signup-closed', path: '/accounts/signup/' },
] as const;
const THEME_KEY = 'augmentrart:theme-preference:v1';

type ThemeSnapshot = {
  theme: string | null;
  font: string | null;
  shadow: string | null;
  backdrop: string | null;
  background: string;
  accent: string;
  radius: string;
};

async function themeSnapshot(page: Page): Promise<ThemeSnapshot> {
  return page.locator('html').evaluate((root) => {
    const style = getComputedStyle(root);
    return {
      theme: root.getAttribute('data-theme'),
      font: root.getAttribute('data-site-font'),
      shadow: root.getAttribute('data-site-shadow'),
      backdrop: root.getAttribute('data-site-backdrop'),
      background: style.getPropertyValue('--bg').trim(),
      accent: style.getPropertyValue('--accent').trim(),
      radius: style.getPropertyValue('--site-radius').trim(),
    };
  });
}

async function assertTextContrast(page: Page) {
  const ratios = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('.card');
    if (!card) throw new Error('Account card is missing');
    const input = document.querySelector<HTMLInputElement>('#id_login');
    const intro = document.querySelector<HTMLElement>('.intro');
    const labels = [...document.querySelectorAll('label')];
    const buttons = [...document.querySelectorAll('.auth-submit, .auth-provider')];
    const providers = [...document.querySelectorAll('.auth-provider')];
    if (!input || !intro || !labels.length || !buttons.length || !providers.length) {
      throw new Error('Login fields, labels, or authentication buttons are missing');
    }
    const error = document.createElement('ul');
    error.className = 'errorlist';
    error.textContent = 'Example validation message';
    card.append(error);
    const cardBackground = getComputedStyle(card).backgroundColor;
    const inputStyle = getComputedStyle(input);
    const placeholderColor = getComputedStyle(input, '::placeholder').color;
    const errorStyle = getComputedStyle(error);
    const errorColor = errorStyle.color;
    const errorBackground = errorStyle.backgroundColor;
    const bodyStyle = getComputedStyle(document.body);
    const introStyle = getComputedStyle(intro);
    const buttonStyles = buttons.map((button) => getComputedStyle(button));
    const providerStyles = providers.map((button) => getComputedStyle(button));
    const tokenProbe = document.createElement('span');
    tokenProbe.style.cssText =
      'position:fixed;left:-10000px;color:var(--text-h);background:var(--accent-bg);border:1px solid var(--accent-border);border-radius:var(--site-radius)';
    document.documentElement.append(tokenProbe);
    const tokenStyle = getComputedStyle(tokenProbe);
    const providerTokens = {
      color: tokenStyle.color,
      background: tokenStyle.backgroundColor,
      border: tokenStyle.borderColor,
      radius:
        document.documentElement.dataset.siteShadow === 'offset' ? '2px' : tokenStyle.borderRadius,
      minHeight: '44px',
    };
    tokenProbe.remove();
    error.remove();

    const channels = (color: string) => {
      const srgb = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
      const rgb = color.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
      const values = srgb ? srgb.slice(1).map(Number) : rgb ? rgb.slice(1).map(Number) : [];
      if (values.length !== 3) throw new Error(`Cannot parse computed color: ${color}`);
      return srgb ? values : values.map((value) => value / 255);
    };
    const luminance = (color: string) => {
      const [red, green, blue] = channels(color).map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const contrast = (foreground: string, background: string) => {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    return {
      body: contrast(bodyStyle.color, cardBackground),
      intro: contrast(introStyle.color, cardBackground),
      labels: labels.map((label) => contrast(getComputedStyle(label).color, cardBackground)),
      placeholder: contrast(placeholderColor, inputStyle.backgroundColor),
      error: contrast(errorColor, errorBackground),
      buttons: buttonStyles.map((style) => contrast(style.color, style.backgroundColor)),
      focusAgainstInput: contrast(inputStyle.outlineColor, inputStyle.backgroundColor),
      focusAgainstCard: contrast(inputStyle.outlineColor, cardBackground),
      focusOutline: { style: inputStyle.outlineStyle, width: inputStyle.outlineWidth },
      providerStyles: providerStyles.map((style) => ({
        color: style.color,
        background: style.backgroundColor,
        border: style.borderColor,
        radius: style.borderRadius,
        minHeight: style.minHeight,
      })),
      providerTokens,
      buttonStyles: buttonStyles.map((style) => ({
        color: style.color,
        background: style.backgroundColor,
        border: style.borderColor,
        radius: style.borderRadius,
        minHeight: style.minHeight,
      })),
    };
  });
  expect(ratios.body, JSON.stringify(ratios)).toBeGreaterThanOrEqual(4.5);
  expect(ratios.intro, JSON.stringify(ratios)).toBeGreaterThanOrEqual(4.5);
  expect(Math.min(...ratios.labels), JSON.stringify(ratios)).toBeGreaterThanOrEqual(4.5);
  expect(ratios.placeholder, JSON.stringify(ratios)).toBeGreaterThanOrEqual(4.5);
  expect(ratios.error, JSON.stringify(ratios)).toBeGreaterThanOrEqual(4.5);
  expect(Math.min(...ratios.buttons), JSON.stringify(ratios)).toBeGreaterThanOrEqual(4.5);
  expect(ratios.focusAgainstInput, JSON.stringify(ratios)).toBeGreaterThanOrEqual(3);
  expect(ratios.focusAgainstCard, JSON.stringify(ratios)).toBeGreaterThanOrEqual(3);
  expect(ratios.focusOutline).toEqual({ style: 'solid', width: '3px' });
  expect(new Set(ratios.providerStyles.map((style) => JSON.stringify(style))).size).toBe(1);
  for (const style of ratios.providerStyles) {
    expect(style.color).toBe(ratios.providerTokens.color);
    expect(style.background).toBe(ratios.providerTokens.background);
    expect(style.border).toBe(ratios.providerTokens.border);
    expect(style.radius).toBe(ratios.providerTokens.radius);
    expect(style.minHeight).toBe(ratios.providerTokens.minHeight);
  }
  return ratios;
}

test('allauth account pages stay in theme parity and accessible across route, viewport and preference matrix', async ({
  page,
}, testInfo: TestInfo) => {
  test.setTimeout(180000);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const scheme of PREFERENCES) {
      await page.emulateMedia({ colorScheme: scheme.os });
      await page.goto('/gallery');
      await page.evaluate(({ key, preference }) => localStorage.setItem(key, preference), {
        key: THEME_KEY,
        preference: scheme.preference,
      });
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme.expected);
      await expect.poll(() => page.locator('html').getAttribute('data-site-font')).not.toBeNull();
      const galleryTheme = await themeSnapshot(page);

      for (const route of ACCOUNT_ROUTES) {
        await test.step(`${route.name} · ${viewport.width}x${viewport.height} · ${scheme.preference}/${scheme.os}`, async () => {
          const response = await page.goto(route.path);
          expect(response?.status()).toBe(200);
          const accountTheme = await themeSnapshot(page);
          expect(accountTheme.theme).toBe(scheme.expected);
          expect(accountTheme.font).toBeTruthy();
          expect(accountTheme.shadow).toBeTruthy();
          expect(accountTheme.backdrop).toBeTruthy();
          expect(accountTheme.background).toBe(galleryTheme.background);
          expect(accountTheme.accent).toBe(galleryTheme.accent);
          expect(accountTheme.radius).toBe(galleryTheme.radius);
          const dimensions = await page.evaluate(() => ({
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
          }));
          expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);

          if (route.name === 'login') {
            await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
            await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
            expect(await page.locator('.auth-submit').count()).toBe(1);
            await page.getByLabel('Email', { exact: true }).focus();
            await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
            await expect(page.getByLabel('Email', { exact: true })).toHaveCSS(
              'outline-style',
              'solid',
            );
            const contrast = await assertTextContrast(page);
            await testInfo.attach(
              `${route.name}-${viewport.width}-${scheme.preference}-${scheme.os}-contrast.json`,
              {
                body: JSON.stringify(contrast, null, 2),
                contentType: 'application/json',
              },
            );
          } else {
            await expect(
              page.getByRole('heading', { name: 'Sign-up is currently unavailable' }),
            ).toBeVisible();
          }
          const screenshotName = `${route.name}-${viewport.width}-${scheme.preference}-${scheme.os}.png`;
          const screenshot = await page.screenshot({
            path: testInfo.outputPath(screenshotName),
            fullPage: true,
          });
          await testInfo.attach(screenshotName, {
            body: screenshot,
            contentType: 'image/png',
          });
        });
      }
    }
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate((key) => localStorage.setItem(key, 'light'), THEME_KEY);
  await page.goto('/accounts/login/');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveClass(/skip-link/);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), THEME_KEY))
    .toBe('dark');
  await page.goto('/gallery');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
