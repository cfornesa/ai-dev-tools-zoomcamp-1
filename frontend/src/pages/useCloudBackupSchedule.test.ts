import { Blob as NodeBlob } from 'node:buffer';
(globalThis as unknown as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob;

import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CloudBackupStatus } from '../api/cloudBackup';
import * as cloudBackupApi from '../api/cloudBackup';
import { useCloudBackupSchedule } from './useCloudBackupSchedule';

vi.mock('../api/cloudBackup', async () => {
  const actual = await vi.importActual<typeof cloudBackupApi>('../api/cloudBackup');
  return {
    ...actual,
    fetchCloudBackup: vi.fn(),
    putCloudBackupManifest: vi.fn(),
    putCloudBackupAsset: vi.fn(),
  };
});

function status(overrides: Partial<CloudBackupStatus> = {}): CloudBackupStatus {
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

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCloudBackupSchedule', () => {
  it('pushes a snapshot when the fetched status says one is due', async () => {
    vi.mocked(cloudBackupApi.fetchCloudBackup).mockResolvedValue(
      status({ last_snapshot_at: null }),
    );
    const sceneJson = { shapes: [] };

    renderHook(() => useCloudBackupSchedule('proj-1', sceneJson));

    await waitFor(() => expect(cloudBackupApi.putCloudBackupManifest).toHaveBeenCalledTimes(1));
  });

  it('does not push when the status says a snapshot is not yet due', async () => {
    vi.mocked(cloudBackupApi.fetchCloudBackup).mockResolvedValue(
      status({ last_snapshot_at: new Date().toISOString(), snapshot_cadence_days: 7 }),
    );
    const sceneJson = { shapes: [] };

    renderHook(() => useCloudBackupSchedule('proj-1', sceneJson));

    await waitFor(() => expect(cloudBackupApi.fetchCloudBackup).toHaveBeenCalledTimes(1));
    expect(cloudBackupApi.putCloudBackupManifest).not.toHaveBeenCalled();
  });

  it('never throws or surfaces an error when the status fetch fails (e.g. not opted in)', async () => {
    vi.mocked(cloudBackupApi.fetchCloudBackup).mockRejectedValue(new Error('404'));
    const sceneJson = { shapes: [] };

    renderHook(() => useCloudBackupSchedule('proj-1', sceneJson));

    await waitFor(() => expect(cloudBackupApi.fetchCloudBackup).toHaveBeenCalledTimes(1));
    expect(cloudBackupApi.putCloudBackupManifest).not.toHaveBeenCalled();
  });

  it('does nothing while there is no projectId or scene yet', () => {
    renderHook(() => useCloudBackupSchedule(undefined, null));
    expect(cloudBackupApi.fetchCloudBackup).not.toHaveBeenCalled();
  });

  it('only attempts once per project id, even across re-renders', async () => {
    vi.mocked(cloudBackupApi.fetchCloudBackup).mockResolvedValue(
      status({ last_snapshot_at: null }),
    );
    const sceneJson = { shapes: [] };

    const { rerender } = renderHook(
      ({ id }: { id: string }) => useCloudBackupSchedule(id, sceneJson),
      { initialProps: { id: 'proj-1' } },
    );
    await waitFor(() => expect(cloudBackupApi.fetchCloudBackup).toHaveBeenCalledTimes(1));

    rerender({ id: 'proj-1' });
    rerender({ id: 'proj-1' });

    expect(cloudBackupApi.fetchCloudBackup).toHaveBeenCalledTimes(1);
  });
});
