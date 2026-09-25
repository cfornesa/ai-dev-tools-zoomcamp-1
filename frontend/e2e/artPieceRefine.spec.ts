/** Issue #663: generated art-piece refinement targets, plan, attempts, and saved version. */
import { expect, test, type TestInfo } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('generated art-piece refinement (#663)', () => {
  const fixtures = requireE2EFixtures() as Fixtures;

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`targets parts and saves a bounded refinement at ${viewport.width}px`, async ({
      browser,
    }, testInfo: TestInfo) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const profile = (await (await apiGet(context, '/api/account/profile/')).json()) as {
        handle: string;
      };
      const slug = `e2e-refine-${viewport.width}-${Date.now().toString(36)}`;
      const source =
        '<canvas id="art-piece-canvas" data-augmentr-part="background"></canvas>' +
        '<script>// @augmentr-part particles\n// @augmentr-asset logo.png\n' +
        "const color = 'teal'; const c = document.getElementById('art-piece-canvas'); " +
        'const ctx = c.getContext(\'2d\'); ctx.fillStyle = color; ' +
        'ctx.fillRect(0, 0, 320, 180);</script>';
      const created = await apiPost(context, '/api/art-pieces/', {
        title: 'Refinement fixture',
        description: 'A generated refinement fixture.',
        prompt: 'A marked canvas piece',
        engine: 'canvas2d',
        public_slug: slug,
        source,
      });
      expect(created.status()).toBe(201);

      await page.goto(`/users/@${profile.handle}/edit/${slug}`);
      const prompt = page.getByRole('textbox', {
        name: 'Describe the revision you want to generate',
      });
      await prompt.fill('@par');
      const listbox = page.getByRole('listbox', { name: /ai target suggestions/i });
      await expect(listbox).toBeVisible();
      await expect(listbox.getByRole('option')).toHaveText(/particles/);
      await page.screenshot({
        path: testInfo.outputPath(`refine-filtered-${viewport.width}.png`),
        fullPage: true,
      });
      await page.keyboard.press('Enter');
      await prompt.fill('make the particles brighter');
      await page.getByRole('button', { name: 'Refine piece' }).click();
      await expect(page.getByTestId('art-piece-refine-plan')).toBeVisible();
      await expect(page.getByTestId('art-piece-refine-accepted')).toBeVisible();
      await expect(page.getByTestId('art-piece-editor-version-list')).toContainText('Version 2');
      await page.screenshot({
        path: testInfo.outputPath(`refine-plan-${viewport.width}.png`),
        fullPage: true,
      });
      await context.close();
    });
  }

  test('refines only the selected labelled region with a structured mention', async ({
    page,
    context,
  }) => {
    const fixtures = requireE2EFixtures() as Fixtures;
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const profile = (await (await apiGet(context, '/api/account/profile/')).json()) as {
      handle: string;
    };
    const slug = `e2e-refine-region-${Date.now().toString(36)}`;
    const source = [
      '<canvas id="art-piece-canvas" width="320" height="180"></canvas><script>',
      '// @layer Sky',
      "const sky = 'teal';",
      '// @layer Ground',
      "const ground = 'blue';",
      "const canvas = document.getElementById('art-piece-canvas');",
      "const ctx = canvas.getContext('2d'); ctx.fillStyle = sky; ctx.fillRect(0, 0, 320, 90);",
      '</script>',
    ].join('\n');
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Region refinement fixture',
      description: 'A labelled-region refinement fixture.',
      prompt: 'A region-scoped fixture',
      engine: 'canvas2d',
      public_slug: slug,
      source,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };

    await page.goto(`/users/@${profile.handle}/edit/${slug}`);
    const prompt = page.getByRole('textbox', {
      name: 'Describe the revision you want to generate',
    });
    await prompt.fill('@Sky');
    const listbox = page.getByRole('listbox', { name: /ai target suggestions/i });
    await expect(listbox).toBeVisible();
    await expect(listbox.getByRole('option')).toContainText(['Sky']);
    await page.keyboard.press('Enter');
    await prompt.fill('make the selected region warmer');
    await page.getByRole('button', { name: 'Refine piece' }).click();
    await expect(page.getByTestId('art-piece-refine-accepted')).toBeVisible();

    const versionsResponse = await apiGet(
      context,
      `/api/art-pieces/${piece.public_id}/versions/`,
    );
    expect(versionsResponse.ok()).toBe(true);
    const versions = (await versionsResponse.json()) as Array<{
      sequence: number;
      source: string;
    }>;
    expect(versions).toHaveLength(2);
    const refined = versions.find((version) => version.sequence === 2)?.source;
    expect(refined).toContain("const sky = '#e76f51';");
    expect(refined).toContain("const ground = 'blue';");
  });
});
