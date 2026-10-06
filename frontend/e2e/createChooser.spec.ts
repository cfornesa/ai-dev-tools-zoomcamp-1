import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const fixtures = requireE2EFixtures();
const libraries = [
  'canvas2d',
  'svg',
  'p5js',
  'c2js',
  'c2js-interactive',
  'threejs',
  'aframe',
] as const;

test('the unified chooser routes every kind to its blank or AI entry point', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginViaUI(page, fixtures.owner.email, fixtures.password);
  let generationRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/art-pieces/generate/')) generationRequests += 1;
  });

  await page.goto('/create');
  await expect(page.getByRole('group', { name: 'What do you want to create?' })).toBeVisible();
  const desktopScreenshot = await page.screenshot({
    path: testInfo.outputPath('create-chooser-1280x900.png'),
  });
  await testInfo.attach('create-chooser-1280x900', {
    body: desktopScreenshot,
    contentType: 'image/png',
  });
  await page.setViewportSize({ width: 375, height: 812 });
  const mobileScreenshot = await page.screenshot({
    path: testInfo.outputPath('create-chooser-375x812.png'),
  });
  await testInfo.attach('create-chooser-375x812', {
    body: mobileScreenshot,
    contentType: 'image/png',
  });

  for (const library of libraries) {
    for (const mode of ['blank', 'ai'] as const) {
      await page.goto('/create');
      await page.getByRole('radio', { name: 'Generated art piece' }).check();
      await page.getByLabel('Generated library').selectOption(library);
      await page
        .getByRole('button', { name: mode === 'blank' ? 'Start blank' : 'Start with AI' })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/art-pieces\\?engine=${library}${mode === 'blank' ? '&mode=blank' : ''}$`),
      );
      await expect(page.getByLabel('Library')).toHaveValue(library);
      if (mode === 'blank') {
        await expect(page.getByTestId('art-piece-starter-mode')).toContainText(
          'No AI request is made.',
        );
        await expect(page.getByTestId('art-piece-save')).toBeVisible();
      } else {
        await expect(page.getByLabel('Describe the art piece you want to generate')).toHaveValue(
          '',
        );
      }
    }
  }

  const structuredFlows = [
    { kind: 'Structured 2D scene', mode: 'blank' },
    { kind: 'Structured 2D scene', mode: 'ai' },
    { kind: 'Structured 3D scene', mode: 'blank' },
    { kind: 'Structured 3D scene', mode: 'ai' },
  ] as const;
  for (const { kind, mode } of structuredFlows) {
    await page.goto('/create');
    await page.getByRole('radio', { name: kind }).check();
    await page
      .getByRole('button', { name: mode === 'blank' ? 'Start blank' : 'Start with AI' })
      .click();
    await expect(page).toHaveURL(/\/users\/@[^/]+\/edit\/[^/?]+/);
    const current = new URL(page.url());
    expect(current.searchParams.get('start')).toBe(mode === 'ai' ? 'ai' : null);
    await expect(page.getByRole('button', { name: 'Edit title' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save scene' })).toBeVisible();

    if (kind === 'Structured 2D scene') {
      await expect(page.getByRole('tab', { name: 'Inspector' })).toHaveAttribute(
        'aria-selected',
        mode === 'ai' ? 'true' : 'false',
      );
      if (mode === 'blank') await page.getByRole('tab', { name: 'Inspector' }).click();
      if (mode === 'blank')
        await page.getByRole('button', { name: 'Expand Inspector panel' }).click();
      const aiDisclosure = page.getByRole('button', { name: /AI proposals/ });
      await expect(aiDisclosure).toHaveAttribute('aria-expanded', mode === 'ai' ? 'true' : 'false');
      if (mode === 'ai') await expect(page.getByRole('radio', { name: 'Create' })).toBeChecked();
    } else if (mode === 'ai') {
      await expect(page.getByTestId('project3d-ai-improve-panel')).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Create' })).toBeChecked();
    } else {
      await expect(
        page.getByRole('button', { name: 'Ask AI to improve this scene' }),
      ).toHaveAttribute('aria-expanded', 'false');
    }

    if (kind === 'Structured 2D scene') {
      await page.getByRole('button', { name: 'File' }).click();
      await expect(page.getByRole('group', { name: 'Publication status' })).toBeVisible();
    } else {
      await expect(page.getByTestId('project3d-save-button')).toBeVisible();
      await expect(page.getByRole('group', { name: 'Publication status' })).toBeVisible();
    }
  }

  expect(generationRequests).toBe(0);
});
