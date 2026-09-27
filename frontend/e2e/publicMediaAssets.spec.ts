import { expect, test } from '@playwright/test';

const PUBLIC_ID = '11111111-1111-4111-8111-111111111111';
const ASSET_ID = '22222222-2222-4222-8222-222222222222';

const scene = {
  schemaVersion: 1,
  id: 'public-media-scene',
  canvas: { width: 320, height: 240, backgroundColor: '#ffffff' },
  renderer: { preferred: 'canvas2d' },
  layers: [{ id: 'layer-1', name: 'Image', order: 0, visible: true, locked: false }],
  groups: [],
  shapes: [
    {
      id: 'shape-1',
      type: 'image',
      layerId: 'layer-1',
      groupId: null,
      transform: { x: 20, y: 20, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      style: { fill: null, stroke: null, strokeWidth: 0 },
      mediaAssetId: ASSET_ID,
      altText: 'Public test image',
      decorative: false,
    },
  ],
  bindings: [],
  graph: { nodes: [], connections: [] },
  accessibility: { reducedMotion: 'auto' },
  randomness: { seed: 1, enabled: false },
};

function publicProject() {
  return {
    id: PUBLIC_ID,
    owner: 'e2e_owner',
    owner_handle: '@e2e_owner',
    title: 'Public media fixture',
    description: 'A published media fixture.',
    thumbnail_url: null,
    viewer_url: `/p/${PUBLIC_ID}`,
    current_version: { id: 1, sequence: 1, origin: 'manual', scene_json: scene },
    versions: [{ sequence: 1, created_at: '2026-09-27T00:00:00Z', is_current: true }],
    version_count: 1,
    created_at: '2026-09-27T00:00:00Z',
    updated_at: '2026-09-27T00:00:00Z',
  };
}

test('anonymous public viewer resolves retained media and keeps private assets denied', async ({ page }) => {
  await page.route(`**/api/public/projects/${PUBLIC_ID}/`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(publicProject()) }),
  );
  await page.route('**/api/pieces/2d/**/assets/**', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, immutable',
        'Access-Control-Allow-Origin': '*',
      },
      body: Buffer.from('not-a-real-png'),
    });
  });
  await page.route('**/api/pieces/2d/foreign/assets/**', (route) => route.fulfill({ status: 404 }));

  await page.goto(`/p/${PUBLIC_ID}`);
  await expect(page.getByRole('heading', { name: 'Public media fixture' })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  const assetResponse = await page.evaluate(async ({ publicId, assetId }) => {
    const response = await fetch(`/api/pieces/2d/${publicId}/assets/${assetId}/`);
    return { status: response.status, nosniff: response.headers.get('x-content-type-options') };
  }, { publicId: PUBLIC_ID, assetId: ASSET_ID });
  expect(assetResponse.status).toBe(200);
  expect(assetResponse.nosniff).toBe('nosniff');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );
});
