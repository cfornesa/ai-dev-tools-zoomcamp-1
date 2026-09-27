/** Issue #921: existing generated-piece region, ink, element, and failure boundaries. */
import { expect, test, type TestInfo } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function profileHandle(context: Parameters<typeof apiGet>[0]) {
  const response = await apiGet(context, '/api/account/profile/');
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { handle: string }).handle;
}

test.describe('existing generated-piece targeting (#921)', () => {
  const fixtures = requireE2EFixtures() as Fixtures;

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`targets one existing region at ${viewport.width}px`, async ({
      browser,
    }, testInfo: TestInfo) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const handle = await profileHandle(context);
      const slug = `e2e-existing-region-${viewport.width}-${Date.now().toString(36)}`;
      const source = [
        '<canvas id="art-piece-canvas" width="320" height="180"></canvas><script>',
        '// @layer Sky',
        "const sky = 'blue';",
        '// @layer Hills',
        "const hills = 'teal';",
        "const canvas = document.getElementById('art-piece-canvas');",
        "const ctx = canvas.getContext('2d'); ctx.fillStyle = sky; ctx.fillRect(0, 0, 320, 90);",
        '</script>',
      ].join('\n');
      const created = await apiPost(context, '/api/art-pieces/', {
        title: 'Existing region fixture',
        description: 'A browser fixture for region targeting.',
        prompt: 'A marked region piece',
        engine: 'canvas2d',
        public_slug: slug,
        source,
      });
      expect(created.status()).toBe(201);
      const piece = (await created.json()) as { public_id: string };

      await page.goto(`/users/@${handle}/edit/${slug}`);
      const editorToolsToggle = page.locator('button.editor-tools-mobile-toggle');
      if (await editorToolsToggle.count()) {
        await editorToolsToggle.click();
        await expect(editorToolsToggle).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('#art-piece-editor-tools-grid')).toHaveAttribute(
          'data-collapsed',
          'false',
        );
      }
      await page.locator('button[aria-label="AI edit"]').click();
      const prompt = page.getByRole('textbox', {
        name: 'Describe the revision you want to generate',
      });
      await prompt.fill('@Hills');
      const listbox = page.getByRole('listbox', { name: /ai target suggestions/i });
      await expect(listbox).toBeVisible();
      await expect(listbox.getByRole('option')).toContainText(['Hills']);
      await page.keyboard.press('Enter');
      await prompt.fill('make the selected hills region warmer');
      await page.screenshot({
        path: testInfo.outputPath(`existing-region-${viewport.width}.png`),
        fullPage: true,
      });
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
      expect(refined).toContain("const hills = '#e76f51';");
      expect(refined).toContain("const sky = 'blue';");
      await context.close();
    });
  }

  test('targets one SVG element and preserves the other element', async ({ page, context }) => {
    const fixtures = requireE2EFixtures() as Fixtures;
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const handle = await profileHandle(context);
    const slug = `e2e-existing-element-${Date.now().toString(36)}`;
    const source = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">',
      '<rect id="target" width="100" height="100" fill="teal"/>',
      '<circle id="other" cx="220" cy="80" r="40" fill="blue"/>',
      '</svg>',
    ].join('\n');
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Existing element fixture',
      description: 'A browser fixture for SVG element targeting.',
      prompt: 'An SVG element fixture',
      engine: 'svg',
      public_slug: slug,
      source,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };

    await page.goto(`/users/@${handle}/edit/${slug}`);
    const editorToolsToggle = page.locator('button.editor-tools-mobile-toggle');
    if (await editorToolsToggle.count()) {
      await editorToolsToggle.click();
      await expect(editorToolsToggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#art-piece-editor-tools-grid')).toHaveAttribute(
        'data-collapsed',
        'false',
      );
    }
    await page.locator('button[aria-label="AI edit"]').click();
    const prompt = page.getByRole('textbox', {
      name: 'Describe the revision you want to generate',
    });
    await prompt.fill('@target');
    const listbox = page.getByRole('listbox', { name: /ai target suggestions/i });
    await expect(listbox).toBeVisible();
    await expect(listbox.getByRole('option')).toContainText(['target']);
    await page.keyboard.press('Enter');
    await prompt.fill('make the selected element warmer');
    await page.getByRole('button', { name: 'Refine piece' }).click();
    await expect(page.getByTestId('art-piece-refine-accepted')).toBeVisible();

    const versionsResponse = await apiGet(context, `/api/art-pieces/${piece.public_id}/versions/`);
    expect(versionsResponse.ok()).toBe(true);
    const versions = (await versionsResponse.json()) as Array<{
      sequence: number;
      source: string;
    }>;
    const refined = versions.find((version) => version.sequence === 2)?.source;
    expect(refined).toContain('id="target"');
    expect(refined).toContain('fill="#e76f51"');
    expect(refined).toContain('id="other"');
    expect(refined).toContain('fill="blue"');
  });

  test('ink target is offered and unresolved mention creates no version', async ({
    page,
    context,
  }) => {
    const fixtures = requireE2EFixtures() as Fixtures;
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const handle = await profileHandle(context);
    const slug = `e2e-existing-ink-${Date.now().toString(36)}`;
    const source =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="blue"/></svg>';
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Existing ink fixture',
      description: 'A browser fixture for ink target resolution.',
      prompt: 'An ink fixture',
      engine: 'svg',
      public_slug: slug,
      source,
      generation_metadata: { ink: { width: 16, height: 16, shapes: [] } },
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    await page.goto(`/users/@${handle}/edit/${slug}`);
    const editorToolsToggle = page.locator('button.editor-tools-mobile-toggle');
    if (await editorToolsToggle.count()) {
      await editorToolsToggle.click();
      await expect(editorToolsToggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#art-piece-editor-tools-grid')).toHaveAttribute(
        'data-collapsed',
        'false',
      );
    }
    await page.locator('button[aria-label="AI edit"]').click();
    const prompt = page.getByRole('textbox', {
      name: 'Describe the revision you want to generate',
    });
    await prompt.fill('@ink');
    const listbox = page.getByRole('listbox', { name: /ai target suggestions/i });
    await expect(listbox).toBeVisible();
    await expect(listbox.getByRole('option')).toContainText(/ink/i);

    const unresolved = await apiPost(context, `/api/art-pieces/${piece.public_id}/refine/`, {
      instruction: 'change a missing target',
      mentions: [{ kind: 'region', id: 'Missing' }],
    });
    expect(unresolved.status()).toBe(422);
    expect(await unresolved.json()).toMatchObject({ error: 'unresolved_mention' });
    const versionsResponse = await apiGet(context, `/api/art-pieces/${piece.public_id}/versions/`);
    expect((await versionsResponse.json()) as unknown[]).toHaveLength(1);
  });
});
