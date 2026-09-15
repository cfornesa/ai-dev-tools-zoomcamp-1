import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { putCloudBackupAssetChunk } from './cloudBackup';

const originalFetch = globalThis.fetch;

describe('putCloudBackupAssetChunk', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends an inclusive Content-Range header and transfer identity', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          asset_id: 'asset-1',
          checksum: 'a'.repeat(64),
          byte_size: 8,
          complete: false,
          acknowledged_ranges: [{ start: 0, end: 4 }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await putCloudBackupAssetChunk('project-1', 'asset-1', new Uint8Array([1, 2, 3, 4]), {
      start: 0,
      end: 4,
      byteLength: 8,
      checksum: 'a'.repeat(64),
      mimeType: 'image/png',
      idempotencyKey: 'transfer-1',
    });

    const [, request] = vi.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(request).toMatchObject({ method: 'PUT' });
    const headers = new Headers((request as RequestInit).headers);
    expect(headers.get('Content-Range')).toBe('bytes 0-3/8');
    expect(headers.get('X-Asset-Checksum')).toBe('a'.repeat(64));
    expect(headers.get('X-Idempotency-Key')).toBe('transfer-1');
  });
});
