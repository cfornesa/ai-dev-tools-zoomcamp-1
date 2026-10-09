import { expect, test, type Page } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { createServerProject2D } from './support/createProject.js';
import { requireE2EFixtures } from './support/prerequisites.js';

async function openWholeSceneAssistant(page: Page, narrowViewport = false) {
  const aiRequests: string[] = [];
  page.on('request', (request) => {
    if (
      /^(POST|PATCH|PUT)$/i.test(request.method()) &&
      new URL(request.url()).pathname.includes('/api/projects/') &&
      new URL(request.url()).pathname.includes('/ai/')
    ) {
      aiRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });

  await page.getByRole('button', { name: 'Ask AI to improve this scene' }).click();

  if (narrowViewport) {
    const layersTab = page.getByRole('tab', { name: 'Layers', exact: true });
    await expect(layersTab).toHaveAttribute('aria-selected', 'true');
  }
  await expect(page.getByRole('region', { name: 'Layers' })).toBeVisible();
  const disclosure = page.getByRole('button', { name: 'Collapse Layers panel' });
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');

  const assistant = page.getByTestId('editor-ai-layer-panel');
  await expect(assistant).toBeVisible();
  const prompt = assistant.getByLabel(/describe the change/i);
  await expect(prompt).toHaveValue('Improve this scene: ');
  await expect(prompt).toBeFocused();
  await expect(assistant.getByRole('radio', { name: 'Edit' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByTestId('editor-save-status')).toHaveText('Saved as version 1');
  await expect(page.getByRole('button', { name: 'Save scene', exact: true })).toBeDisabled();
  await expect(page.getByText('0 shape(s) in the working copy.')).toBeVisible();
  expect(aiRequests).toEqual([]);
}

test.describe('Whole-scene AI assistant visibility and focus (#1293)', () => {
  test('reveals and focuses the assistant from Tools at 375x812', async ({ page }) => {
    const fixtures = requireE2EFixtures();
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.setViewportSize({ width: 375, height: 812 });
    await createServerProject2D(page);

    const toolsTab = page.getByRole('tab', { name: 'Tools', exact: true });
    await expect(toolsTab).toHaveAttribute('aria-selected', 'true');
    await openWholeSceneAssistant(page, true);
  });

  test('reopens a collapsed Layers disclosure at 1280x900', async ({ page }) => {
    const fixtures = requireE2EFixtures();
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.setViewportSize({ width: 1280, height: 900 });
    await createServerProject2D(page);

    const disclosure = page.getByRole('button', { name: 'Collapse Layers panel' });
    await disclosure.click();
    await expect(page.getByRole('button', { name: 'Expand Layers panel' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await openWholeSceneAssistant(page);
  });
});
