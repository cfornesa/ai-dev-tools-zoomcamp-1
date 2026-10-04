import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchPublicPieceAsset } from './publicPieceAssets';

describe('fetchPublicPieceAsset', () => {
  afterEach(() => vi.restoreAllMocks());

  it('requests the anonymous immutable asset route and returns its blob', async () => {
    // Build the expected blob through the same native Response implementation
    // as the mocked fetch response. CI runs Node 22 while local development can
    // use a newer Node/jsdom combination; passing a jsdom Blob into undici's
    // Response constructor makes its body stream shape version-dependent.
    const response = new Response('asset', {
      headers: { 'Content-Type': 'image/png' },
      status: 200,
    });
    const blob = await response.clone().blob();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    await expect(fetchPublicPieceAsset('2d', 'piece-id', 'asset-id')).resolves.toEqual(blob);
    expect(fetchMock).toHaveBeenCalledWith('/api/pieces/2d/piece-id/assets/asset-id/', {
      credentials: 'include',
    });
  });

  it('soft-falls for assets that are missing or no longer public', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));

    await expect(fetchPublicPieceAsset('3d', 'piece-id', 'asset-id')).resolves.toBeNull();
  });
});
