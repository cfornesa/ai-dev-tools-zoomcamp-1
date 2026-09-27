import { expect, test } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test('authored 2D preview controls stay grouped and responsive', async ({
  page,
  context,
}, testInfo) => {
  const fixtures = requireE2EFixtures();
  await loginViaUI(page, fixtures.owner.email, fixtures.password);
  const profile = (await (await apiGet(context, '/api/account/profile/')).json()) as {
    handle: string;
  };
  const slug = `ink-controls-${Date.now().toString(36)}`;
  const created = await apiPost(context, '/api/art-pieces/', {
    title: 'Ink controls layout fixture',
    description: 'Responsive authored preview controls fixture.',
    prompt: 'layout fixture',
    engine: 'svg',
    public_slug: slug,
    capabilities: { screenshot: true, download: true, immersive: true },
    source:
      '<svg id="art-piece-svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#172554" /></svg>',
  });
  expect(created.status()).toBe(201);

  await page.goto(`/users/@${profile.handle}/edit/${slug}`);
  await expect(page.getByTestId('generated-ink-panel')).toBeVisible();
  const controls = page
    .getByTestId('generated-ink-panel')
    .locator('.generated-ink-preview-controls');

  for (const [width, height] of [
    [1280, 900],
    [768, 1024],
    [375, 812],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(controls).toBeVisible();
    await expect(page.getByRole('button', { name: 'Take preview screenshot' })).toBeVisible();
    await expect(page.getByText('Sound', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Ink color')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Draw ink' })).toBeVisible();

    const geometry = await controls.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        childBoxes: Array.from(element.children).map((child) => {
          const childBox = child.getBoundingClientRect();
          return { left: childBox.left, right: childBox.right };
        }),
      };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.childBoxes.every((child) => child.left >= geometry.left - 1)).toBe(true);
    expect(geometry.childBoxes.every((child) => child.right <= geometry.right + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`controls-${width}.png`), fullPage: false });
  }
});
