// See localProjectRepository.test.ts's top-of-file comment: jsdom's `Blob`
// isn't structured-cloneable by Node's native `structuredClone`, which
// fake-indexeddb relies on internally, so this file swaps in Node's own
// `Blob` for its duration -- a test-environment-only workaround.
import { Blob as NodeBlob } from 'node:buffer';
(globalThis as unknown as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob;

import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CloudBackupStatus } from '../api/cloudBackup';
import * as cloudBackupApi from '../api/cloudBackup';
import { isSnapshotDue, pushCloudSnapshot } from './cloudSnapshot';
import { importMediaAsset, openLocalProjectDatabase } from './localProjectRepository';

vi.mock('../api/cloudBackup', async () => {
  const actual = await vi.importActual<typeof cloudBackupApi>('../api/cloudBackup');
  return {
    ...actual,
    putCloudBackupManifest: vi.fn(),
    putCloudBackupAsset: vi.fn(),
  };
});

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
