import { expect, test } from '@playwright/test';

const importedProfile = '/users/@cfornesa';
const expectedPieces = [
  'reference-aframe-study',
  'reference-threejs-study',
  'reference-c2-interactive-study',
  'reference-c2-study',
  'reference-p5-study',
  'reference-svg-study',
];

test.describe('Imported reference pieces (#612)', () => {
  test.skip(
    process.env.REFERENCE_IMPORT_E2E !== 'true',
    'Run the disposable reference importer first, then set REFERENCE_IMPORT_E2E=true.',
  );

  test('renders the six imported public cards at desktop and mobile sizes', async ({
    page,
  }, testInfo) => {
    await page.goto(importedProfile);
    await expect(page.getByRole('heading', { name: 'Christopher Fornesa' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Public pieces' })).toBeVisible();

    const cards = page.locator('article');
    await expect(cards).toHaveCount(expectedPieces.length);
    for (const slug of expectedPieces) {
      await expect(page.locator(`a[href="${importedProfile}/pieces/${slug}"]`)).toBeVisible();
    }
    await expect(page.getByRole('img', { name: /No preview available/ })).toHaveCount(
      expectedPieces.length,
    );

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: testInfo.outputPath('reference-profile-1280x900.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({
      path: testInfo.outputPath('reference-profile-375x812.png'),
      fullPage: true,
    });
  });
});
