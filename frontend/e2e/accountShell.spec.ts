import { expect, test, type TestInfo } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test('allauth pages share site shell navigation and cross-route display preferences (#1126)', async ({
  page,
}, testInfo: TestInfo) => {
  const fixture = requireE2EFixtures();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route('**/api/pages/', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 42, title: 'Our story', slug: 'our-story', nav_label: 'About', sort_order: 1 },
      ]),
    }),
  );
  await page.goto('/accounts/login/');

  await expect(page.getByRole('link', { name: 'Public gallery' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'About' })).toHaveAttribute(
    'href',
    '/pages/our-story',
  );
  const navLayout = await page.locator('.account-nav').evaluate((nav) => ({
    width: nav.getBoundingClientRect().width,
    scrollWidth: nav.scrollWidth,
    links: [...nav.querySelectorAll('a')].map((link) => ({
      width: link.getBoundingClientRect().width,
      left: link.getBoundingClientRect().left,
      right: link.getBoundingClientRect().right,
    })),
    pageWidth: document.documentElement.scrollWidth,
  }));
  expect(navLayout.scrollWidth).toBeLessThanOrEqual(navLayout.width);
  expect(navLayout.links).toHaveLength(2);
  expect(navLayout.pageWidth).toBe(375);
  expect(navLayout.links.every((link) => link.left >= 0 && link.right <= 375)).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByText(/New here\?/)).toBeVisible();
  const mobileBottomControls = await page
    .locator('.shell-display-toggles')
    .evaluate((controls) => ({
      top: controls.getBoundingClientRect().top,
      helperBottom: document.querySelector('.links')?.getBoundingClientRect().bottom ?? 0,
    }));
  expect(mobileBottomControls.top).toBeGreaterThanOrEqual(mobileBottomControls.helperBottom);
  await page.screenshot({
    path: testInfo.outputPath('account-shell-375-light.png'),
    fullPage: true,
  });

  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveClass(/skip-link/);
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.waitForTimeout(200);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('augmentrart:theme-preference:v1')))
    .toBe('dark');
  await page.screenshot({
    path: testInfo.outputPath('account-shell-375-dark.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: testInfo.outputPath('account-shell-1280-dark.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.waitForTimeout(200);
  await page.screenshot({
    path: testInfo.outputPath('account-shell-1280-light.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.getByRole('button', { name: 'Use reduced motion' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('gesture-studio:reduced-motion-override')))
    .toBe('reduced');

  await page.setViewportSize({ width: 1280, height: 900 });
  await loginViaUI(page, fixture.owner.email, fixture.password);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Use full motion' })).toBeVisible();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/gallery(?:\?.*)?$/);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/accounts/login/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  await expect(page.getByRole('link', { name: 'About' })).toBeVisible();
});
