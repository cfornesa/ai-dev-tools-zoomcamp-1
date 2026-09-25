import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { expect, test, type TestInfo } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const fixtures = [
  {
    engine: 'svg',
    source: '<svg viewBox="0 0 320 240"><rect width="320" height="240" fill="#172554"/></svg>',
  },
  {
    engine: 'p5js',
    source:
      'window.sketch = (p) => { p.setup = () => p.createCanvas(320, 240); p.draw = () => p.background(23, 37, 84); };',
  },
  {
    engine: 'c2js',
    source:
      "window.sketch = ({ canvas, startFrame }) => { const context = canvas.getContext('2d'); startFrame(() => { context.fillStyle = '#172554'; context.fillRect(0, 0, canvas.width, canvas.height); }); };",
  },
  {
    engine: 'c2js-interactive',
    source:
      "window.sketch = ({ canvas, startFrame }) => { const context = canvas.getContext('2d'); startFrame(() => { context.fillStyle = '#172554'; context.fillRect(0, 0, canvas.width, canvas.height); }); };",
  },
] as const;

const onlineLabels = [
  'Take screenshot',
  'Open download menu',
  'View immersive piece',
  'Unmute sound',
  'Piece controls',
  'Show hand gesture guide',
  'Expand piece to fullscreen',
];

async function extractZip(zip: JSZip): Promise<string> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'piece-template-2d-'));
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, await entry.async('nodebuffer'));
  }
  return root;
}

test.describe('2D runtime template parity (#799)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('asserts online and Full ZIP controls for every 2D engine', async ({
    page,
    context,
  }, testInfo: TestInfo) => {
    test.setTimeout(180_000);
    await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);
    const profileResponse = await apiGet(context, '/api/account/profile/');
    expect(profileResponse.ok()).toBe(true);
    const profile = (await profileResponse.json()) as Record<string, unknown>;
    const handle = `e2e-template-${Date.now().toString(36)}`;
    const updatedProfile = await apiPatch(context, '/api/account/profile/', {
      ...profile,
      handle,
      display_name: '2D Template Fixture',
      is_public: true,
    });
    expect(updatedProfile.ok()).toBe(true);

    await page.setViewportSize({ width: 1280, height: 900 });
    for (const fixture of fixtures) {
      const created = await apiPost(context, '/api/art-pieces/', {
        title: `Template ${fixture.engine}`,
        description: `Template parity ${fixture.engine}.`,
        prompt: `A ${fixture.engine} template fixture`,
        engine: fixture.engine,
        public_slug: `template-${fixture.engine}`,
        capabilities: {
          screenshot: true,
          download: true,
          immersive: true,
          fullscreen: true,
          sound: true,
          keyboard: true,
          microphone: true,
          camera_view: true,
          hand_steering: true,
        },
        generation_metadata: { aspect_ratio: '4:3' },
        source: fixture.source,
      });
      expect(created.status()).toBe(201);
      const piece = (await created.json()) as { public_id: string };
      const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
        status: 'published',
      });
      expect(published.status()).toBe(200);
    }

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      for (const fixture of fixtures) {
        await page.goto(`/users/@${handle}/pieces/template-${fixture.engine}`);
        const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
        await expect(toolbar).toBeVisible();
        await expect(
          page.getByRole('heading', { name: `Template ${fixture.engine}` }),
        ).toBeVisible();
        for (const label of onlineLabels)
          await expect(toolbar.getByRole('button', { name: label })).toBeVisible();
        const labels = await toolbar
          .locator('button:visible, a:visible')
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute('aria-label')).filter(Boolean),
          );
        const expectedOnlineLabels =
          fixture.engine === 'c2js-interactive'
            ? [
                ...onlineLabels,
                'Black',
                'White',
                'Red',
                'Orange',
                'Yellow',
                'Green',
                'Blue',
                'Purple',
                'Draw on piece',
                'Clear visitor drawing',
                'Undo visitor drawing',
                'Redo visitor drawing',
              ]
            : onlineLabels;
        expect(labels).toEqual(expectedOnlineLabels);
        await toolbar.getByRole('button', { name: 'Piece controls' }).click();
        await expect(page.getByRole('group', { name: 'Sound' })).toBeVisible();
        await expect(page.getByRole('group', { name: 'Camera view' })).toBeVisible();
        await expect(page.getByRole('group', { name: 'Hand steering' })).toBeVisible();
        await expect(
          toolbar.getByRole('button', { name: 'Show hand gesture guide' }),
        ).toBeVisible();
        await page.screenshot({
          path: testInfo.outputPath(`template-2d-online-${fixture.engine}-${viewport.width}.png`),
          fullPage: true,
        });
        await toolbar.getByRole('button', { name: 'Piece controls' }).click();
      }
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    for (const fixture of fixtures) {
      const zipPage = await context.newPage();
      await zipPage.setViewportSize({ width: 1280, height: 900 });
      await zipPage.goto(`/users/@${handle}/pieces/template-${fixture.engine}`);
      const downloadPromise = zipPage.waitForEvent('download');
      await zipPage.getByRole('button', { name: 'Open download menu' }).click();
      await zipPage.getByRole('menuitem', { name: 'Download Full ZIP' }).click();
      const download = await downloadPromise;
      const zip = await JSZip.loadAsync(fs.readFileSync((await download.path())!));
      const root = await extractZip(zip);
      try {
        const index = await zip.files['index.html'].async('string');
        expect(index).toContain('id="piece-toolbar"');
        const labels = [...index.matchAll(/aria-label="([^"]+)"/g)].map((match) => match[1]);
        const expected = [
          'Take screenshot',
          'Unmute sound',
          'Piece controls',
          'Show hand gesture guide',
        ];
        if (fixture.engine === 'c2js-interactive') expected.push('Draw on piece');
        expected.push('Reset view', 'Fullscreen');
        expect(labels).toEqual(expect.arrayContaining(expected));
        await zipPage.goto(`file://${path.join(root, 'index.html')}`);
        await expect(zipPage.locator('#piece-toolbar')).toBeVisible();
        await expect(zipPage.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
        await expect(zipPage.getByRole('button', { name: 'Fullscreen' })).toBeVisible();
        await zipPage.screenshot({
          path: testInfo.outputPath(`template-2d-zip-${fixture.engine}-1280.png`),
          fullPage: true,
        });
        await zipPage.setViewportSize({ width: 375, height: 812 });
        await zipPage.screenshot({
          path: testInfo.outputPath(`template-2d-zip-${fixture.engine}-375.png`),
          fullPage: true,
        });
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
        await zipPage.close();
      }
    }
  });
});
