import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchPublicPieceAsset } from './publicPieceAssets';

describe('fetchPublicPieceAsset', () => {
  afterEach(() => vi.restoreAllMocks());

  it('requests the anonymous immutable asset route and returns its blob', async () => {
    const blob = new Blob(['asset'], { type: 'image/png' });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(blob, { status: 200 }));

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
