import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { createServerProject2D } from './support/createProject.js';
import { expandAllCollapsibleSections } from './support/expandCollapsibleSections.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const fixtures = requireE2EFixtures();

test.describe('2D version comparison (#1137)', () => {
  test('compares two saved scenes and keeps long results inside the panel on desktop and mobile', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createServerProject2D(page);
    await expandAllCollapsibleSections(page);

    for (let index = 0; index < 24; index += 1) {
      await page.getByRole('button', { name: 'Add circle' }).click();
    }
    await page.getByRole('button', { name: 'Save scene' }).click();
    await expect(page.getByTestId('editor-save-status')).toHaveText(/Saved as version 2/);

    const versionsTab = page.getByRole('tab', { name: 'Versions' });
    await expect(versionsTab).toHaveAttribute('aria-selected', 'true');
    const history = page.getByRole('list', { name: 'Version history' });
    await expect(history.getByText('Version 1')).toBeVisible();
    await expect(history.getByText('Version 2')).toBeVisible();
    await history
      .locator('.version-history-item')
      .filter({ has: page.getByText('Version 1', { exact: true }) })
      .getByRole('button', { name: 'Compare with…' })
      .click();
    await page.getByLabel('Compare with').selectOption({ label: 'Version 2' });
    const versionMutations: string[] = [];
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (/\/api\/projects\/[^/]+\/versions\/\d+\/$/.test(pathname) && request.method() !== 'GET') {
        versionMutations.push(`${request.method()} ${pathname}`);
      }
    });
    await page.getByRole('button', { name: 'Compare versions' }).click();

    const result = page.getByLabel('Differences between versions 1 and 2');
    await expect(result.getByRole('heading', { name: 'Shapes (24)' })).toBeVisible();
    await expect(result.getByText(/^Added:/).first()).toBeVisible();
    await expect(result.getByRole('heading', { name: 'Layers' })).toBeVisible();
    await expect(result.getByRole('heading', { name: 'Canvas (0)' })).toBeVisible();
    expect(versionMutations).toEqual([]);

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      if (viewport.width < 1024) {
        await page.getByRole('tab', { name: 'Inspector', exact: true }).click();
        await expandAllCollapsibleSections(page);
      }
      await expect(result).toBeVisible();
      const layout = await result.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        pageWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
      expect(layout.pageWidth).toBeLessThanOrEqual(viewport.width);
      expect(layout.scrollHeight).toBeGreaterThan(layout.clientHeight);
    }
  });
});
