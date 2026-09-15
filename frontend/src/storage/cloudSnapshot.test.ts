// See localProjectRepository.test.ts's top-of-file comment: jsdom's `Blob`
// isn't structured-cloneable by Node's native `structuredClone`, which
// fake-indexeddb relies on internally, so this file swaps in Node's own
// `Blob` for its duration -- a test-environment-only workaround.
import { Blob as NodeBlob } from 'node:buffer';
(globalThis as unknown as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob;

import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/client';
import type { CloudBackupStatus } from '../api/cloudBackup';
import * as cloudBackupApi from '../api/cloudBackup';
import { isSnapshotDue, pushCloudSnapshot, saveNowBeforeClearing } from './cloudSnapshot';
import { importMediaAsset, openLocalProjectDatabase } from './localProjectRepository';

vi.mock('../api/cloudBackup', async () => {
  const actual = await vi.importActual<typeof cloudBackupApi>('../api/cloudBackup');
  return {
    ...actual,
    fetchCloudBackup: vi.fn(),
    putCloudBackupManifest: vi.fn(),
    putCloudBackupAsset: vi.fn(),
    putCloudBackupAssetChunk: vi.fn(),
  };
});

const mockedFetchCloudBackup = vi.mocked(cloudBackupApi.fetchCloudBackup);

function baseStatus(overrides: Partial<CloudBackupStatus> = {}): CloudBackupStatus {
  return {
    enabled: true,
    paused: false,
    read_only: false,
    retention_state: 'active',
    retain_until: null,
    revision: 0,
    snapshot_cadence_days: 7,
    snapshot_archive_enabled: false,
    last_snapshot_at: null,
    ...overrides,
  };
}

describe('isSnapshotDue', () => {
  it('is due immediately when no snapshot has ever been taken', () => {
    expect(isSnapshotDue(baseStatus({ last_snapshot_at: null }))).toBe(true);
  });

  it('is not due before the cadence has elapsed', () => {
    const now = new Date('2026-01-08T00:00:00Z');
    const status = baseStatus({
      last_snapshot_at: '2026-01-02T00:00:00Z',
      snapshot_cadence_days: 7,
    });
    expect(isSnapshotDue(status, now)).toBe(false);
  });

  it('is due once the cadence has elapsed', () => {
    const now = new Date('2026-01-09T00:00:01Z');
    const status = baseStatus({
      last_snapshot_at: '2026-01-02T00:00:00Z',
      snapshot_cadence_days: 7,
    });
    expect(isSnapshotDue(status, now)).toBe(true);
  });

  it('is never due while disabled, paused, or read-only', () => {
    expect(isSnapshotDue(baseStatus({ enabled: false }))).toBe(false);
    expect(isSnapshotDue(baseStatus({ paused: true }))).toBe(false);
    expect(isSnapshotDue(baseStatus({ read_only: true }))).toBe(false);
  });
});

describe('pushCloudSnapshot', () => {
  beforeEach(() => {
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    vi.clearAllMocks();
  });

  it('pushes referenced media assets then the manifest, keyed by scene image shapes', async () => {
    const db = await openLocalProjectDatabase();
    const projectId = 'server-project-abc';
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
    const asset = await importMediaAsset(db, {
      projectId,
      blob,
      mimeType: 'image/png',
      filename: 'a.png',
      altText: '',
    });

    const sceneJson = {
      shapes: [
        { type: 'rect', id: 'r1' },
        { type: 'image', id: 'i1', mediaAssetId: asset.id },
      ],
    };

    await pushCloudSnapshot(db, projectId, sceneJson, 0);

    expect(cloudBackupApi.putCloudBackupAsset).toHaveBeenCalledTimes(1);
    const [assetCallProjectId, assetCallId] = vi.mocked(cloudBackupApi.putCloudBackupAsset).mock
      .calls[0];
    expect(assetCallProjectId).toBe(projectId);
    expect(assetCallId).toBe(asset.id);

    expect(cloudBackupApi.putCloudBackupManifest).toHaveBeenCalledTimes(1);
    const [manifestProjectId, manifestFields] = vi.mocked(cloudBackupApi.putCloudBackupManifest)
      .mock.calls[0];
    expect(manifestProjectId).toBe(projectId);
    expect(manifestFields.revision).toBe(0);
    expect(manifestFields.manifest.project_id).toBe(projectId);
    expect(manifestFields.manifest.assets).toEqual([
      { id: asset.id, checksum: asset.checksum, byte_size: asset.byteSize },
    ]);
    expect(manifestFields.manifest.scenes).toEqual([{ id: 'current', scene_json: sceneJson }]);
  });

  it('skips a referenced asset the browser no longer has locally, without failing', async () => {
    const db = await openLocalProjectDatabase();
    const projectId = 'server-project-missing-asset';
    const sceneJson = {
      shapes: [{ type: 'image', id: 'i1', mediaAssetId: 'never-imported' }],
    };

    await pushCloudSnapshot(db, projectId, sceneJson, 0);

    expect(cloudBackupApi.putCloudBackupAsset).not.toHaveBeenCalled();
    expect(cloudBackupApi.putCloudBackupManifest).toHaveBeenCalledTimes(1);
    const [, manifestFields] = vi.mocked(cloudBackupApi.putCloudBackupManifest).mock.calls[0];
    expect(manifestFields.manifest.assets).toEqual([]);
  });

  it('uses the persisted resumable sender when an authenticated owner is available', async () => {
    const db = await openLocalProjectDatabase();
    const projectId = 'server-project-resumable';
    const ownerId = 'owner-a';
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
    const asset = await importMediaAsset(db, {
      projectId,
      blob,
      mimeType: 'image/png',
      filename: 'a.png',
      altText: '',
    });
    vi.mocked(cloudBackupApi.putCloudBackupAssetChunk).mockResolvedValue({
      asset_id: asset.id,
      checksum: asset.checksum,
      byte_size: asset.byteSize,
      complete: true,
      acknowledged_ranges: [{ start: 0, end: asset.byteSize }],
    });

    await pushCloudSnapshot(
      db,
      projectId,
      { shapes: [{ type: 'image', id: 'i1', mediaAssetId: asset.id }] },
      0,
      ownerId,
    );

    expect(cloudBackupApi.putCloudBackupAsset).not.toHaveBeenCalled();
    expect(cloudBackupApi.putCloudBackupAssetChunk).toHaveBeenCalledTimes(1);
    expect(cloudBackupApi.putCloudBackupManifest).toHaveBeenCalledTimes(1);
  });

  it('pushes a manifest with no assets for a scene with no image shapes', async () => {
    const db = await openLocalProjectDatabase();
    const projectId = 'server-project-no-images';
    const sceneJson = { shapes: [{ type: 'rect', id: 'r1' }] };

    await pushCloudSnapshot(db, projectId, sceneJson, 3);

    expect(cloudBackupApi.putCloudBackupAsset).not.toHaveBeenCalled();
    const [, manifestFields] = vi.mocked(cloudBackupApi.putCloudBackupManifest).mock.calls[0];
    expect(manifestFields.revision).toBe(3);
    expect(manifestFields.manifest.assets).toEqual([]);
  });
});

describe('saveNowBeforeClearing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  });

  it('is a no-op (not applicable) for a project never opted into cloud sync', async () => {
    mockedFetchCloudBackup.mockRejectedValue(new ApiError(404, {}));

    const result = await saveNowBeforeClearing('proj-1', { shapes: [] });

    expect(result).toEqual({ applicable: false });
    expect(cloudBackupApi.putCloudBackupManifest).not.toHaveBeenCalled();
  });

  it('is a no-op for a project that is disabled, paused, or read-only', async () => {
    for (const overrides of [{ enabled: false }, { paused: true }, { read_only: true }]) {
      mockedFetchCloudBackup.mockResolvedValue(baseStatus(overrides));
      const result = await saveNowBeforeClearing('proj-1', { shapes: [] });
      expect(result).toEqual({ applicable: false });
    }
  });

  it('succeeds and pushes a checkpoint for an enabled, unpaused, writable project', async () => {
    mockedFetchCloudBackup.mockResolvedValue(baseStatus());
    vi.mocked(cloudBackupApi.putCloudBackupManifest).mockResolvedValue({
      revision: 1,
      checksum: 'x',
      manifest: { project_id: 'proj-1', scenes: [], assets: [] },
    });

    const result = await saveNowBeforeClearing('proj-1', { shapes: [] });

    expect(result).toEqual({ applicable: true, success: true });
    expect(cloudBackupApi.putCloudBackupManifest).toHaveBeenCalledTimes(1);
  });

  it('reports a classified conflict failure without throwing (stale remote revision)', async () => {
    mockedFetchCloudBackup.mockResolvedValue(baseStatus());
    vi.mocked(cloudBackupApi.putCloudBackupManifest).mockRejectedValue(
      new ApiError(409, { error: 'cloud_backup_conflict' }),
    );

    const result = await saveNowBeforeClearing('proj-1', { shapes: [] });

    expect(result.applicable).toBe(true);
    expect(result).toMatchObject({ success: false, failure: { kind: 'conflict' } });
  });

  it('reports an offline failure without throwing (provider/network failure)', async () => {
    mockedFetchCloudBackup.mockResolvedValue(baseStatus());
    vi.mocked(cloudBackupApi.putCloudBackupManifest).mockRejectedValue(
      new TypeError('Failed to fetch'),
    );

    const result = await saveNowBeforeClearing('proj-1', { shapes: [] });

    expect(result).toMatchObject({
      applicable: true,
      success: false,
      failure: { kind: 'offline' },
    });
  });

  it('reports a status-check failure (not a 404) as a real failure, never silently as no-sync', async () => {
    mockedFetchCloudBackup.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await saveNowBeforeClearing('proj-1', { shapes: [] });

    expect(result).toMatchObject({
      applicable: true,
      success: false,
      failure: { kind: 'offline' },
    });
  });
});
