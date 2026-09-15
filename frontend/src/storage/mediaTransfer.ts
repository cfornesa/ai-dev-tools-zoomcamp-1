/** Deterministic resumable media transfer state for offline sync (#546). */

export const DEFAULT_MEDIA_CHUNK_SIZE = 256 * 1024;

export type MediaByteRange = { start: number; end: number };

export type MediaTransferRecord = {
  transferId: string;
  ownerId: string;
  projectId: string;
  assetId: string;
  byteLength: number;
  checksum: string;
  chunkSize: number;
  acknowledgedRanges: MediaByteRange[];
  attemptCount: number;
  state: 'pending' | 'uploading' | 'complete' | 'paused' | 'failed';
  lastErrorCode: string | null;
};

export type MediaTransferFailureCode =
  'checksum-mismatch' | 'quota-exceeded' | 'permission-denied' | 'retry-exhausted' | 'offline';

export function createMediaTransferRecord(input: {
  transferId: string;
  ownerId: string;
  projectId: string;
  assetId: string;
  byteLength: number;
  checksum: string;
  chunkSize?: number;
}): MediaTransferRecord {
  if (!Number.isInteger(input.byteLength) || input.byteLength < 0) {
    throw new Error('Media byteLength must be a non-negative integer.');
  }
  const chunkSize = input.chunkSize ?? DEFAULT_MEDIA_CHUNK_SIZE;
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error('Media chunkSize must be a positive integer.');
  }
  return {
    ...input,
    chunkSize,
    acknowledgedRanges: [],
    attemptCount: 0,
    state: 'pending',
    lastErrorCode: null,
  };
}

function validateRange(record: MediaTransferRecord, range: MediaByteRange): void {
  if (
    !Number.isInteger(range.start) ||
    !Number.isInteger(range.end) ||
    range.start < 0 ||
    range.end <= range.start ||
    range.end > record.byteLength
  ) {
    throw new Error('Media byte range is outside the source blob.');
  }
}

function mergeRanges(ranges: MediaByteRange[]): MediaByteRange[] {
  return ranges
    .slice()
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .reduce<MediaByteRange[]>((merged, range) => {
      const previous = merged.at(-1);
      if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
      else merged.push({ ...range });
      return merged;
    }, []);
}

export function acknowledgeMediaRange(
  record: MediaTransferRecord,
  range: MediaByteRange,
): MediaTransferRecord {
  validateRange(record, range);
  const acknowledgedRanges = mergeRanges([...record.acknowledgedRanges, range]);
  return {
    ...record,
    acknowledgedRanges,
    state: isMediaTransferComplete({ ...record, acknowledgedRanges }) ? 'complete' : 'uploading',
    lastErrorCode: null,
  };
}

export function nextMediaRange(record: MediaTransferRecord): MediaByteRange | null {
  let cursor = 0;
  for (const range of mergeRanges(record.acknowledgedRanges)) {
    if (cursor < range.start) {
      return { start: cursor, end: Math.min(range.start, cursor + record.chunkSize) };
    }
    cursor = Math.max(cursor, range.end);
  }
  return cursor < record.byteLength
    ? { start: cursor, end: Math.min(record.byteLength, cursor + record.chunkSize) }
    : null;
}

export function isMediaTransferComplete(record: MediaTransferRecord): boolean {
  return (
    record.byteLength === 0 ||
    (record.acknowledgedRanges.length === 1 &&
      record.acknowledgedRanges[0]!.start === 0 &&
      record.acknowledgedRanges[0]!.end === record.byteLength)
  );
}

export function verifyRemoteMediaReceipt(
  record: MediaTransferRecord,
  receipt: { byteLength: number; checksum: string },
): MediaTransferRecord {
  if (receipt.byteLength !== record.byteLength || receipt.checksum !== record.checksum) {
    return { ...record, state: 'paused', lastErrorCode: 'checksum-mismatch' };
  }
  return { ...record, state: 'complete', lastErrorCode: null };
}

export function pauseMediaTransfer(
  record: MediaTransferRecord,
  code: MediaTransferFailureCode,
): MediaTransferRecord {
  return { ...record, state: 'paused', lastErrorCode: code };
}
