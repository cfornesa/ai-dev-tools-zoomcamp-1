import { describe, expect, it } from 'vitest';

import {
  acknowledgeMediaRange,
  createMediaTransferRecord,
  isMediaTransferComplete,
  nextMediaRange,
  pauseMediaTransfer,
  verifyRemoteMediaReceipt,
} from './mediaTransfer';

function record() {
  return createMediaTransferRecord({
    transferId: 'transfer-1',
    ownerId: 'owner-a',
    projectId: 'project-a',
    assetId: 'asset-a',
    byteLength: 10,
    checksum: 'a'.repeat(64),
    chunkSize: 4,
  });
}

describe('resumable media transfer state', () => {
  it('resumes from verified ranges without duplicating acknowledged bytes', () => {
    let transfer = record();
    expect(nextMediaRange(transfer)).toEqual({ start: 0, end: 4 });
    transfer = acknowledgeMediaRange(transfer, { start: 0, end: 4 });
    transfer = acknowledgeMediaRange(transfer, { start: 4, end: 8 });
    transfer = acknowledgeMediaRange(transfer, { start: 4, end: 8 });

    expect(transfer.acknowledgedRanges).toEqual([{ start: 0, end: 8 }]);
    expect(nextMediaRange(transfer)).toEqual({ start: 8, end: 10 });
  });

  it('requires every byte before marking a transfer complete', () => {
    let transfer = record();
    transfer = acknowledgeMediaRange(transfer, { start: 0, end: 4 });
    transfer = acknowledgeMediaRange(transfer, { start: 8, end: 10 });
    expect(isMediaTransferComplete(transfer)).toBe(false);
    transfer = acknowledgeMediaRange(transfer, { start: 4, end: 8 });
    expect(isMediaTransferComplete(transfer)).toBe(true);
    expect(transfer.state).toBe('complete');
  });

  it('preserves the transfer for checksum, quota, or permission recovery', () => {
    const transfer = record();
    expect(
      verifyRemoteMediaReceipt(transfer, { byteLength: 10, checksum: 'b'.repeat(64) }),
    ).toMatchObject({
      state: 'paused',
      lastErrorCode: 'checksum-mismatch',
      ownerId: 'owner-a',
      assetId: 'asset-a',
    });
    expect(pauseMediaTransfer(transfer, 'quota-exceeded')).toMatchObject({
      state: 'paused',
      lastErrorCode: 'quota-exceeded',
    });
  });
});
