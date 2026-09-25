import { beforeEach, describe, expect, it, vi } from 'vitest';

import { refineArtPiece } from './artPieces';

describe('refineArtPiece mentions', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'accepted' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
  });

  it('sends structured mention kinds and ids in the refine payload', async () => {
    await refineArtPiece(
      'piece-1',
      'make it warmer',
      ['Sky'],
      undefined,
      [
        { kind: 'region', id: 'Sky' },
        { kind: 'ink', id: 'ink' },
      ],
    );
    const request = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      instruction: 'make it warmer',
      target_references: ['Sky'],
      mentions: [
        { kind: 'region', id: 'Sky' },
        { kind: 'ink', id: 'ink' },
      ],
    });
  });
});
