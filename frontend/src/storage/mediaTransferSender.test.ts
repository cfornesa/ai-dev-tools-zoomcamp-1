import { Blob as NodeBlob } from 'node:buffer';

(globalThis as unknown as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob;

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { putCloudBackupAssetChunk } from '../api/cloudBackup';
import { ApiError } from '../api/client';
import { createMediaTransferRecord } from './mediaTransfer';
import { saveMediaTransfer } from './mediaTransferRepository';
import { sendMediaTransfer } from './mediaTransferSender';

vi.mock('../api/cloudBackup', () => ({
  putCloudBackupAssetChunk: vi.fn(),
}));

vi.mock('./mediaTransferRepository', () => ({
  saveMediaTransfer: vi.fn(async (_db: IDBDatabase, record) => record),
}));

const db = {} as IDBDatabase;

function record() {
  return createMediaTransferRecord({
    transferId: 'transfer-1',
    ownerId: 'owner-a',
    projectId: 'project-a',
    assetId: 'asset-a',
    byteLength: 8,
    checksum: 'a'.repeat(64),
    chunkSize: 4,
  });
}

describe('sendMediaTransfer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uploads persisted blob ranges and commits the completed ledger state', async () => {
    vi.mocked(putCloudBackupAssetChunk)
      .mockResolvedValueOnce({
        asset_id: 'asset-a',
        checksum: 'a'.repeat(64),
        byte_size: 8,
        complete: false,
        acknowledged_ranges: [{ start: 0, end: 4 }],
      })
      .mockResolvedValueOnce({
        asset_id: 'asset-a',
        checksum: 'a'.repeat(64),
        byte_size: 8,
        complete: true,
        acknowledged_ranges: [{ start: 0, end: 8 }],
      });

    const completed = await sendMediaTransfer(db, record(), new Blob(['12345678']));

    expect(completed.state).toBe('complete');
    expect(putCloudBackupAssetChunk).toHaveBeenCalledTimes(2);
    expect(vi.mocked(putCloudBackupAssetChunk).mock.calls[0]?.[3]).toMatchObject({
      start: 0,
      end: 4,
      byteLength: 8,
    });
    expect(vi.mocked(putCloudBackupAssetChunk).mock.calls[1]?.[3]).toMatchObject({
      start: 4,
      end: 8,
      byteLength: 8,
    });
    expect(vi.mocked(saveMediaTransfer).mock.calls.at(-1)?.[1]).toMatchObject({
      state: 'complete',
      acknowledgedRanges: [{ start: 0, end: 8 }],
    });
  });

  it('persists a quota pause without losing the local transfer record', async () => {
    vi.mocked(putCloudBackupAssetChunk).mockRejectedValue(
      new ApiError(413, { error: 'cloud_backup_quota_exceeded' }),
    );

    const paused = await sendMediaTransfer(db, record(), new Blob(['12345678']));

    expect(paused).toMatchObject({ state: 'paused', lastErrorCode: 'quota-exceeded' });
    expect(saveMediaTransfer).toHaveBeenCalled();
  });
});
