/** Browser acceptance for supported draw.io public/embed/download surfaces (#412). */
import { expect, test } from '@playwright/test';

import { apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

function drawioScene() {
  return {
    schemaVersion: 1,
    id: 'scene-drawio-public',
    documentType: 'drawio',
    canvas: { width: 640, height: 480, backgroundColor: '#ffffff' },
    renderer: { preferred: 'canvas2d' },
    layers: [{ id: 'layer-public', name: 'Public layer', order: 0, visible: true, locked: false }],
    shapes: [],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
    drawio: {
      formatVersion: 1,
      layers: [
        { id: 'layer-public', name: 'Public layer', order: 0, visible: true, locked: false },
      ],
      objects: [
        {
          id: 'public-rect',
          type: 'rect',
          layerId: 'layer-public',
          parentId: null,
          x: 40,
          y: 40,
          width: 180,
          height: 100,
          fill: '#3366cc',
        },
      ],
    },
  };
}

test.describe('draw.io public surfaces', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('published draw.io content renders read-only on public, embed, and download surfaces', async ({
    page,
    browser,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new animation' }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);
    const projectId = /\/projects\/([^/]+)$/.exec(page.url())?.[1];
    expect(projectId).toBeTruthy();
    if (!projectId) return;

    const versionResponse = await apiPost(page.context(), `/api/projects/${projectId}/versions/`, {
      scene_json: drawioScene(),
      origin: 'manual',
      change_label: 'Draw.io public fixture',
    });
    expect(versionResponse.status()).toBe(201);
    const metadataResponse = await apiPatch(page.context(), `/api/projects/${projectId}/`, {
      title: 'Draw.io public surface fixture',
      description: 'A supported draw.io public surface fixture.',
    });
    expect(metadataResponse.ok()).toBe(true);
    await page.reload();

    const ownerToolbar = page.locator(
      '.piece-stage-shell [role="toolbar"][aria-label="Piece actions"]',
    );
    await ownerToolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    await ownerToolbar.getByRole('button', { name: 'Publication status: Draft' }).click();
    await ownerToolbar.getByRole('button', { name: 'Published', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Publish', exact: true })
      .click();
    await expect(page.getByTestId('visibility-status')).toContainText('Published (public)');

    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto(`/p/${projectId}`);
    await expect(anonymousPage.locator('canvas[aria-label="Draw.io scene preview"]')).toBeVisible();
    await expect(anonymousPage.getByRole('button', { name: 'Logout' })).toHaveCount(0);
    await expect(anonymousPage.getByRole('button', { name: /Edit scene/i })).toHaveCount(0);

    const publicToolbar = anonymousPage.locator(
      '.piece-stage-shell [role="toolbar"][aria-label="Piece actions"]',
    );
    await publicToolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    await expect(publicToolbar.getByRole('button', { name: 'Open download menu' })).toBeVisible();
    const download = anonymousPage.waitForEvent('download');
    await publicToolbar.getByRole('button', { name: 'Open download menu' }).click();
    await publicToolbar.getByRole('menuitem', { name: 'Download Full' }).click();
    await download;

    await anonymousPage.goto(`/embed/p/${projectId}`);
    await expect(anonymousPage.locator('canvas[aria-label="Draw.io scene preview"]')).toBeVisible();
    await expect(anonymousPage.getByRole('button', { name: 'Logout' })).toHaveCount(0);
    await anonymousContext.close();

    const thumbnail = await page.request.get(`/api/public/projects/${projectId}/thumbnail.png`);
    expect(thumbnail.status()).toBe(200);
  });
});
