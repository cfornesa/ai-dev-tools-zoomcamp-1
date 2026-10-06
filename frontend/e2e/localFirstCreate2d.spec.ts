import { expect, test, type TestInfo } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { localProjectDb } from './support/localProjectDb.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

function localScene(shapes: unknown[] = []) {
  return {
    schemaVersion: 1,
    id: 'local-render-scene',
    canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
    renderer: { preferred: 'canvas2d' },
    layers: [
      { id: 'layer-rect', name: 'Rectangle', order: 0, visible: true, locked: false },
      { id: 'layer-ellipse', name: 'Ellipse', order: 1, visible: true, locked: false },
    ],
    shapes,
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
  };
}

const RECTANGLE = {
  id: 'local-rectangle',
  type: 'rect',
  layerId: 'layer-rect',
  groupId: null,
  transform: { x: 160, y: 160, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
  style: { fill: '#ff0000', stroke: null, strokeWidth: 0 },
  width: 120,
  height: 100,
  cornerRadius: 0,
};

const ELLIPSE = {
  id: 'local-ellipse',
  type: 'circle',
  layerId: 'layer-ellipse',
  groupId: null,
  transform: { x: 500, y: 320, scaleX: 1.5, scaleY: 0.8, rotation: 0, opacity: 1 },
  style: { fill: '#0000ff', stroke: null, strokeWidth: 0 },
  radius: 40,
};

async function seedLocalScene(
  page: Parameters<typeof localProjectDb>[0],
  ownerId: string,
  title: string,
  sceneJson: Record<string, unknown>,
) {
  return localProjectDb<{ id: string }>(page, {
    kind: 'create-project-with-scene',
    input: { ownerId, title, sceneName: 'Saved shapes', sceneJson },
  });
}

test.describe('Local-first 2D creation (#934)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`creates and reloads a local-only 2D project at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo: TestInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/create');

      const serverCreateRequests: string[] = [];
      page.on('request', (request) => {
        if (
          request.method() === 'POST' &&
          /\/api\/projects(?:\/|$)/.test(new URL(request.url()).pathname)
        ) {
          serverCreateRequests.push(request.url());
        }
      });

      await page.getByRole('button', { name: 'Create a new 2D project', exact: true }).click();
      await page.waitForURL(/\/local-projects\/[^/]+$/);
      await expect(page.getByRole('heading', { name: 'Untitled animation' })).toBeVisible();
      await expect(page.getByLabel('Scene', { exact: true })).toHaveValue(/.+/);
      await expect(page.getByLabel('Scene', { exact: true }).locator('option:checked')).toHaveText(
        'Scene 1',
      );
      expect(serverCreateRequests).toEqual([]);

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Untitled animation' })).toBeVisible();
      await expect(page.getByLabel('Scene', { exact: true }).locator('option:checked')).toHaveText(
        'Scene 1',
      );
      await page.screenshot({ path: testInfo.outputPath('local-first-2d.png'), fullPage: true });
    });
  }

  test('renders and reloads the saved rectangle and ellipse without changing local data (#1288)', async ({
    page,
  }, testInfo: TestInfo) => {
    await page.setViewportSize(VIEWPORTS[0]);
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const { id } = await seedLocalScene(page, fixtures.owner.username, 'Local shapes', {
      ...localScene([RECTANGLE, ELLIPSE]),
    });
    await page.goto(`/local-projects/${id}`);

    const serverWrites: string[] = [];
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (
        ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method()) &&
        pathname.startsWith('/api/projects/')
      ) {
        serverWrites.push(`${request.method()} ${pathname}`);
      }
    });
    const before = await localProjectDb<{
      project: { title: string };
      scenes: Array<{ name: string; sceneJson: Record<string, unknown> }>;
    }>(page, { kind: 'read-project-content', ownerId: fixtures.owner.username, projectId: id });

    const verifyRenderedShapes = async () => {
      await expect(page.getByRole('heading', { name: 'Local shapes' })).toBeVisible();
      await expect(page.getByLabel('Scene', { exact: true }).locator('option:checked')).toHaveText(
        'Saved shapes',
      );
      await expect(page.getByRole('alert')).toHaveCount(0);
      const canvas = page.getByTestId('local-scene-preview').locator('canvas');
      await expect(canvas).toBeVisible();
      const colors = await canvas.evaluate((element) => {
        const context = (element as HTMLCanvasElement).getContext('2d');
        if (!context) throw new Error('Local preview canvas has no 2D context.');
        const colorAt = (x: number, y: number) => Array.from(context.getImageData(x, y, 1, 1).data);
        return { rectangle: colorAt(160, 160), ellipse: colorAt(545, 320) };
      });
      expect(colors.rectangle).toEqual([255, 0, 0, 255]);
      expect(colors.ellipse).toEqual([0, 0, 255, 255]);
      expect(
        await canvas.evaluate((element) => element.getBoundingClientRect().width),
      ).toBeLessThan(await page.evaluate(() => window.innerWidth));
    };

    await verifyRenderedShapes();
    await page.screenshot({
      path: testInfo.outputPath('local-scene-1280x900.png'),
      fullPage: true,
    });
    await page.reload();
    await verifyRenderedShapes();
    const afterDesktop = await localProjectDb<{
      project: { title: string };
      scenes: Array<{ name: string; sceneJson: Record<string, unknown> }>;
    }>(page, { kind: 'read-project-content', ownerId: fixtures.owner.username, projectId: id });
    expect(afterDesktop).toEqual(before);

    await page.setViewportSize(VIEWPORTS[1]);
    await verifyRenderedShapes();
    await page.screenshot({ path: testInfo.outputPath('local-scene-375x812.png'), fullPage: true });
    await page.reload();
    await verifyRenderedShapes();
    const afterMobile = await localProjectDb<{
      project: { title: string };
      scenes: Array<{ name: string; sceneJson: Record<string, unknown> }>;
    }>(page, { kind: 'read-project-content', ownerId: fixtures.owner.username, projectId: id });
    expect(afterMobile).toEqual(before);
    expect(serverWrites).toEqual([]);
  });

  test('keeps an empty scene valid and reports an invalid stored scene without rewriting it (#1288)', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const empty = await seedLocalScene(
      page,
      fixtures.owner.username,
      'Empty local scene',
      localScene(),
    );
    await page.goto(`/local-projects/${empty.id}`);
    await expect(page.getByTestId('local-scene-preview').locator('canvas')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    const invalidScene = {
      ...localScene([RECTANGLE]),
      canvas: { ...localScene().canvas, width: 0 },
    };
    const invalid = await seedLocalScene(
      page,
      fixtures.owner.username,
      'Invalid local scene',
      invalidScene,
    );
    const before = await localProjectDb(page, {
      kind: 'read-project-content',
      ownerId: fixtures.owner.username,
      projectId: invalid.id,
    });
    const serverWrites: string[] = [];
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (
        ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method()) &&
        pathname.startsWith('/api/projects/')
      ) {
        serverWrites.push(`${request.method()} ${pathname}`);
      }
    });
    await page.goto(`/local-projects/${invalid.id}`);
    await expect(page.getByRole('alert')).toContainText(/couldn't render this local scene/i);
    await expect(page.getByTestId('local-scene-preview').locator('canvas')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('alert')).toContainText(/couldn't render this local scene/i);
    const after = await localProjectDb(page, {
      kind: 'read-project-content',
      ownerId: fixtures.owner.username,
      projectId: invalid.id,
    });
    expect(after).toEqual(before);
    expect(serverWrites).toEqual([]);
  });
});
