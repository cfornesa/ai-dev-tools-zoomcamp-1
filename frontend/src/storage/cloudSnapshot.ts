/**
 * Issue #530: builds and silently pushes a scheduled cloud-backup
 * snapshot for a server-authored project (`scenes.Project`) already
 * opted into cloud sync (#509/#511). The server has no independent copy
 * of the project's media -- an `"image"` shape's `mediaAssetId` only
 * ever resolves against this browser's own local IndexedDB media
 * library (`localProjectRepository.ts`, #508/#512), scoped by the same
 * project id used throughout the editor (`EditorWorkspace.tsx`'s `id`,
 * the server project's `public_id`). So the manifest's `scenes` entry
 * embeds the current scene JSON directly (self-contained, single-scene
 * shape for this project domain, distinct from the local-only multi-
 * scene repository) and its `assets` are resolved from that same local
 * media store.
 *
 * This module never decides *whether* to push automatically -- callers
 * (see `useCloudBackupSchedule.ts`) read `isSnapshotDue` against a
 * `CloudBackupStatus` already fetched from the server and only call
 * `pushCloudSnapshot` when it says so.
 */

import { computeChecksum, getMediaBlob, listMediaAssetsForProject } from './localProjectRepository';
import {
  putCloudBackupAsset,
  putCloudBackupManifest,
  type CloudBackupManifestAsset,
  type CloudBackupStatus,
} from '../api/cloudBackup';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Pure and synchronous so it's trivial to unit test: is a scheduled
 * snapshot due, given the server's already-fetched cadence policy and
 * last-snapshot timestamp? A backup that is disabled, paused, or
 * read-only is never due -- the caller (or, redundantly, the server)
 * enforces those independently; this only judges cadence. */
export function isSnapshotDue(status: CloudBackupStatus, now: Date = new Date()): boolean {
  if (!status.enabled || status.paused || status.read_only) return false;
  if (!status.last_snapshot_at) return true;
  const last = new Date(status.last_snapshot_at).getTime();
  const dueAt = last + status.snapshot_cadence_days * MILLISECONDS_PER_DAY;
  return now.getTime() >= dueAt;
}

function collectReferencedMediaAssetIds(sceneJson: Record<string, unknown>): Set<string> {
  const shapes = Array.isArray(sceneJson.shapes) ? sceneJson.shapes : [];
  const ids = new Set<string>();
  for (const shape of shapes) {
    if (!shape || typeof shape !== 'object') continue;
    const record = shape as Record<string, unknown>;
    if (record.type === 'image' && typeof record.mediaAssetId === 'string') {
      ids.add(record.mediaAssetId);
    }
  }
  return ids;
}

/** Silently pushes one snapshot: every media asset the current scene
 * references (skipping any the browser no longer has locally -- a
 * missing local asset cannot be backed up from here, but it never blocks
 * the rest of the snapshot), then the manifest itself. Idempotency keys
 * are deterministic (asset: id+checksum; manifest: revision+checksum) so
 * a retried push after a partial failure never double-uploads or
 * double-counts against quota.
 */
export async function pushCloudSnapshot(
  db: IDBDatabase,
  projectId: string,
  sceneJson: Record<string, unknown>,
  expectedRevision: number,
): Promise<void> {
  const referencedIds = collectReferencedMediaAssetIds(sceneJson);
  const localAssets = await listMediaAssetsForProject(db, projectId);
  const localAssetsById = new Map(localAssets.map((asset) => [asset.id, asset]));

  const assets: CloudBackupManifestAsset[] = [];
  for (const assetId of referencedIds) {
    const asset = localAssetsById.get(assetId);
    if (!asset) continue; // not locally available -- skip, never block the snapshot
    const blob = await getMediaBlob(db, assetId);
    if (!blob) continue;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await putCloudBackupAsset(projectId, assetId, bytes, {
      checksum: asset.checksum,
      mimeType: asset.mimeType,
      idempotencyKey: `snapshot-asset-${assetId}-${asset.checksum}`,
    });
    assets.push({ id: assetId, checksum: asset.checksum, byte_size: asset.byteSize });
  }

  const manifestChecksum = await computeChecksum(
    new TextEncoder().encode(JSON.stringify(sceneJson)),
  );
  await putCloudBackupManifest(projectId, {
    revision: expectedRevision,
    idempotency_key: `snapshot-manifest-${projectId}-${expectedRevision}-${manifestChecksum}`,
    manifest: {
      project_id: projectId,
      scenes: [{ id: 'current', scene_json: sceneJson }],
      assets,
    },
  });
}
