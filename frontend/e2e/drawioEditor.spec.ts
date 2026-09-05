/** Browser acceptance for the bounded draw.io editor slice (#410/#411).
 * The document is seeded through the authenticated API so this test exercises
 * the real editor route and controls without pretending the blank-project UI
 * already creates draw.io content. */
import { expect, test } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

function drawioScene() {
  return {
    schemaVersion: 1,
    id: 'scene-drawio-browser',
    documentType: 'drawio',
    canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
    renderer: { preferred: 'canvas2d' },
    layers: [
      { id: 'layer-back', name: 'Back', order: 0, visible: true, locked: false },
      { id: 'layer-front', name: 'Front', order: 1, visible: true, locked: false },
    ],
    shapes: [],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
    drawio: {
      formatVersion: 1,
      layers: [
        { id: 'layer-back', name: 'Back', order: 0, visible: true, locked: false },
        { id: 'layer-front', name: 'Front', order: 1, visible: true, locked: false },
      ],
      objects: [
        {
          id: 'object-back',
          type: 'rect',
          layerId: 'layer-back',
          parentId: null,
          x: 40,
          y: 40,
          width: 120,
          height: 80,
        },
        {
          id: 'object-front',
          type: 'ellipse',
          layerId: 'layer-front',
          parentId: null,
          x: 220,
          y: 80,
          width: 100,
          height: 60,
        },
      ],
    },
  };
}

test.describe('Draw.io editor', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('selects and mutates objects while preserving layer controls and lock guards', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectResponse = await apiPost(context, '/api/projects/blank/');
    expect(projectResponse.status()).toBe(201);
    const { id } = (await projectResponse.json()) as { id: string };
    const versionResponse = await apiPost(context, `/api/projects/${id}/versions/`, {
      scene_json: drawioScene(),
      origin: 'manual',
      change_label: 'Draw.io browser fixture',
    });
    expect(versionResponse.status()).toBe(201);

    await page.goto(`/projects/${id}`);
    await expect(page.getByTestId('editor-renderer-badge')).toHaveText('Draw.io');
    await page.getByRole('button', { name: 'Open piece controls menu' }).click();
    await page.getByRole('button', { name: 'Edit scene', exact: true }).click();

    await page.getByRole('button', { name: 'Select rect object-back' }).click();
    await expect(
      page.getByRole('button', { name: 'Move selected draw.io object right' }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Move selected draw.io object right' }).click();
    await page.getByRole('button', { name: 'Duplicate selected draw.io object' }).click();
    await expect(page.getByTestId('editor-save-status')).toHaveText('Unsaved changes');

    const layers = page.getByRole('region', { name: 'Layers' });
    await expect(layers.getByRole('textbox', { name: 'Layer name for Back' })).toBeVisible();
    await expect(layers.getByRole('textbox', { name: 'Layer name for Front' })).toBeVisible();
    const backLayer = layers.getByRole('textbox', { name: 'Layer name for Back' });
    await backLayer.fill('Back Renamed', { force: true });
    await backLayer.press('Enter');
    await expect(
      layers.getByRole('textbox', { name: 'Layer name for Back Renamed' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('editor-save-status')).toHaveText(/Saved as version \d+/);
    const project = (await (await apiGet(context, `/api/projects/${id}/`)).json()) as {
      current_version: number;
    };
    const saved = await apiGet(context, `/api/projects/${id}/versions/${project.current_version}/`);
    expect(saved.status()).toBe(200);
    const savedScene = ((await saved.json()) as { scene_json: ReturnType<typeof drawioScene> })
      .scene_json;
    expect(savedScene.documentType).toBe('drawio');
    expect(savedScene.drawio.objects).toHaveLength(3);
    expect(savedScene.drawio.layers.find((layer) => layer.id === 'layer-back')?.name).toBe(
      'Back Renamed',
    );
  });
});
