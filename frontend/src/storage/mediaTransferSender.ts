/** Authenticated resumable media sender for offline sync (#546). */

import { putCloudBackupAssetChunk } from '../api/cloudBackup';
import { ApiError } from '../api/client';
import {
  acknowledgeMediaRange,
  nextMediaRange,
  pauseMediaTransfer,
  verifyRemoteMediaReceipt,
  type MediaTransferFailureCode,
  type MediaTransferRecord,
} from './mediaTransfer';
import { saveMediaTransfer } from './mediaTransferRepository';

function failureCode(error: unknown): MediaTransferFailureCode {
  if (error instanceof ApiError) {
    const code =
      error.body && typeof error.body === 'object' && 'error' in error.body
        ? String((error.body as { error?: unknown }).error)
        : '';
    if (code === 'checksum_mismatch') return 'checksum-mismatch';
    if (code === 'cloud_backup_quota_exceeded' || error.status === 413) {
      return 'quota-exceeded';
    }
    if (error.status === 401 || error.status === 403 || error.status === 404) {
      return 'permission-denied';
    }
    return error.status >= 500 ? 'offline' : 'retry-exhausted';
  }
  return error instanceof TypeError ? 'offline' : 'retry-exhausted';
}

/**
 * Upload one persisted local blob through the authenticated chunk endpoint.
 * Every acknowledged range is committed to IndexedDB before the next request,
 * so interruption resumes from the last server-confirmed boundary.
 */
export async function sendMediaTransfer(
  db: IDBDatabase,
  record: MediaTransferRecord,
  blob: Blob,
): Promise<MediaTransferRecord> {
  let current: MediaTransferRecord = {
    ...record,
    state: 'uploading',
    attemptCount: record.attemptCount + 1,
    lastErrorCode: null,
  };

  if (blob.size !== current.byteLength) {
    current = pauseMediaTransfer(current, 'checksum-mismatch');
    await saveMediaTransfer(db, current);
    return current;
  }
  await saveMediaTransfer(db, current);

  try {
    while (true) {
      const range = nextMediaRange(current);
      if (!range) {
        current = verifyRemoteMediaReceipt(current, {
          byteLength: current.byteLength,
          checksum: current.checksum,
        });
        await saveMediaTransfer(db, current);
        return current;
      }

      const response = await putCloudBackupAssetChunk(
        current.projectId,
        current.assetId,
        blob.slice(range.start, range.end),
        {
          start: range.start,
          end: range.end,
          byteLength: current.byteLength,
          checksum: current.checksum,
          mimeType: blob.type || 'application/octet-stream',
          idempotencyKey: `${current.transferId}:${range.start}-${range.end}`,
        },
      );

      const acknowledged = response.acknowledged_ranges?.length
        ? response.acknowledged_ranges
        : [range];
      for (const acknowledgedRange of acknowledged) {
        current = acknowledgeMediaRange(current, acknowledgedRange);
      }
      if (response.complete) {
        current = verifyRemoteMediaReceipt(current, {
          byteLength: response.byte_size,
          checksum: response.checksum,
        });
      }
      await saveMediaTransfer(db, current);
      if (current.state === 'complete') return current;
    }
  } catch (error) {
    current = pauseMediaTransfer(current, failureCode(error));
    await saveMediaTransfer(db, current);
    return current;
  }
}
