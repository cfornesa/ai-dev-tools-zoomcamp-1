import { expect, test } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? '';
const publishedMode =
  process.env.PUBLISHED_DESIGN_MATRIX === 'true' &&
  /^https?:\/\//i.test(baseURL) &&
  !/localhost|127\.0\.0\.1/i.test(baseURL);

const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'gallery', path: '/gallery' },
  { name: 'profile', path: '/users/@cfornesa' },
  {
    name: 'reference-threejs-study',
    path: '/users/@cfornesa/pieces/reference-threejs-study',
  },
] as const;

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
] as const;

test.describe('published design matrix (#718)', () => {
  test.skip(
    !publishedMode,
    'Set PUBLISHED_DESIGN_MATRIX=true and E2E_BASE_URL to the published HTTPS origin.',
  );

  for (const route of ROUTES) {
    for (const colorScheme of ['light', 'dark'] as const) {
      for (const viewport of VIEWPORTS) {
        test(`${route.name} — ${colorScheme} — ${viewport.name}`, async ({ page }, testInfo) => {
          await page.emulateMedia({ colorScheme });
          await page.setViewportSize(viewport);
          const response = await page.goto(route.path, { waitUntil: 'networkidle' });
          expect(response?.status(), `${route.path} response`).toBeLessThan(400);
          await expect(page.locator('body')).toBeVisible();

          await expect
            .poll(() => page.locator('html').evaluate((element) => element.scrollWidth))
            .toBeLessThanOrEqual(viewport.width);

          const headerHeight = await page.locator('.app-shell-header').evaluate((element) => {
            return element.getBoundingClientRect().height;
          });
          if (viewport.width <= 375) {
            expect(headerHeight).toBeLessThanOrEqual(viewport.height * 0.25);
          }

          if (route.name === 'profile') {
            const columns = page.locator(
              '.public-profile-heading, .public-profile-section > h3, .public-profile-card-grid',
            );
            if ((await columns.count()) >= 3) {
              const leftEdges = await columns.evaluateAll((elements) =>
                elements.map((element) => element.getBoundingClientRect().left),
              );
              expect(Math.max(...leftEdges) - Math.min(...leftEdges)).toBeLessThanOrEqual(1);
            }
          }

          if (route.name === 'reference-threejs-study') {
            const stage = page.locator('.public-art-piece-stage');
            await expect(stage).toBeVisible();
            const stageMetrics = await stage.evaluate((element) => {
              const stageRect = element.getBoundingClientRect();
              const shellRect = element.parentElement?.getBoundingClientRect();
              const toolbarRect = element.previousElementSibling?.getBoundingClientRect();
              return {
                stageWidth: stageRect.width,
                shellWidth: shellRect?.width ?? 0,
                toolbarBottom: toolbarRect?.bottom ?? 0,
                stageTop: stageRect.top,
              };
            });
            expect(stageMetrics.stageWidth).toBeGreaterThanOrEqual(stageMetrics.shellWidth - 1);
            expect(stageMetrics.toolbarBottom).toBeLessThanOrEqual(stageMetrics.stageTop + 1);
          }

          await page.screenshot({
            path: testInfo.outputPath(
              `published-${route.name}-${colorScheme}-${viewport.width}.png`,
            ),
            fullPage: true,
          });
        });
      }
    }
  }
});
