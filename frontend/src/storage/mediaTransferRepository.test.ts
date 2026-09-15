import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';

import { createMediaTransferRecord } from './mediaTransfer';
import {
  deleteMediaTransfer,
  getMediaTransfer,
  listMediaTransfersForProject,
  saveMediaTransfer,
} from './mediaTransferRepository';
import { createProject, openLocalProjectDatabase } from './localProjectRepository';

describe('media transfer repository', () => {
  beforeEach(() => {
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  });

  it('persists and owner-scopes resumable transfer state', async () => {
    const db = await openLocalProjectDatabase();
    const project = await createProject(db, { ownerId: 'owner-a', title: 'Project' });
    const record = createMediaTransferRecord({
      transferId: 'transfer-1',
      ownerId: 'owner-a',
      projectId: project.id,
      assetId: 'asset-1',
      byteLength: 10,
      checksum: 'a'.repeat(64),
    });
    await saveMediaTransfer(db, record);
    expect(await getMediaTransfer(db, 'owner-b', 'transfer-1')).toBeNull();
    expect(await listMediaTransfersForProject(db, 'owner-a', project.id)).toEqual([record]);
    expect(await deleteMediaTransfer(db, 'owner-a', 'transfer-1')).toBe(true);
    expect(await listMediaTransfersForProject(db, 'owner-a', project.id)).toEqual([]);
  });
});
