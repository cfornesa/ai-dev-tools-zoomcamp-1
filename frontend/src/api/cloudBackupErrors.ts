/**
 * Issue #527: a typed classifier over `ApiError`/network failures from the
 * cloud-backup manifest/asset endpoints, so a "Save now before clearing"
 * safeguard can explain *why* a checkpoint failed instead of a bare
 * "something went wrong" -- mirrors `scenes/cloud_backup.py`'s own error
 * codes (`CloudBackupError.code`) one-for-one, plus an `offline` case for
 * when the request never reached the server at all.
 */

import { ApiError } from './client';

export type CloudBackupFailureKind =
  | 'disabled'
  | 'read_only'
  | 'paused'
  | 'conflict'
  | 'checksum_mismatch'
  | 'quota_exceeded'
  | 'offline'
  | 'unknown';

const CODE_TO_KIND: Record<string, CloudBackupFailureKind> = {
  cloud_sync_disabled: 'disabled',
  cloud_backup_read_only: 'read_only',
  cloud_backup_paused: 'paused',
  cloud_backup_conflict: 'conflict',
  checksum_mismatch: 'checksum_mismatch',
  cloud_backup_quota_exceeded: 'quota_exceeded',
};

const KIND_MESSAGES: Record<CloudBackupFailureKind, string> = {
  disabled: 'Cloud sync is currently disabled for this site.',
  read_only: 'This project’s cloud backup is retained read-only and cannot accept new changes.',
  paused: 'Cloud sync is paused for this project.',
  conflict: 'A newer version already exists in the cloud copy; this checkpoint is out of date.',
  checksum_mismatch: 'A media file could not be verified while saving to the cloud.',
  quota_exceeded: 'This account’s cloud storage quota has been reached.',
  offline: 'Could not reach the server. Check your connection and try again.',
  unknown: 'Could not save the latest changes to the cloud.',
};

export type CloudBackupFailure = { kind: CloudBackupFailureKind; message: string };

export function classifyCloudBackupError(err: unknown): CloudBackupFailure {
  if (err instanceof ApiError) {
    const code =
      err.body && typeof err.body === 'object' && 'error' in err.body
        ? String((err.body as { error?: unknown }).error)
        : undefined;
    const kind = (code && CODE_TO_KIND[code]) || 'unknown';
    return { kind, message: KIND_MESSAGES[kind] };
  }
  // fetch() itself throws a plain TypeError for a network failure (DNS,
  // offline, connection refused) -- it never reaches the point of
  // constructing an ApiError at all.
  if (err instanceof TypeError) {
    return { kind: 'offline', message: KIND_MESSAGES.offline };
  }
  return { kind: 'unknown', message: KIND_MESSAGES.unknown };
}
