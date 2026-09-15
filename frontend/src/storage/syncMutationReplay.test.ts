import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createProject, openLocalProjectDatabase } from './localProjectRepository';
import { enqueueMutation, listMutationOutbox } from './mutationOutbox';
import { replaySyncMutations } from './syncMutationReplay';
import { sendSyncMutation } from '../api/syncMutations';

vi.mock('../api/syncMutations', () => ({
  sendSyncMutation: vi.fn(),
}));

describe('replaySyncMutations', () => {
  beforeEach(() => {
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    vi.mocked(sendSyncMutation).mockReset();
  });

  it('sends eligible operations and acknowledges them in IndexedDB', async () => {
    const setupDb = await openLocalProjectDatabase();
    const project = await createProject(setupDb, { ownerId: 'owner-a', title: 'Project' });
    await enqueueMutation(setupDb, {
      ownerId: 'owner-a',
      projectId: project.id,
      kind: 'scene',
      payload: { value: 1 },
    });
    setupDb.close();
    vi.mocked(sendSyncMutation).mockResolvedValue({
      acknowledged: true,
      replayed: false,
      operation_id: 'operation-1',
      server_operation_id: '1',
      client_sequence: 1,
      payload_checksum: 'a'.repeat(64),
      acknowledged_at: '2026-09-15T19:30:00Z',
    });

    const completed = await replaySyncMutations('owner-a', project.id);

    expect(completed).toHaveLength(1);
    expect(completed[0]?.state).toBe('acknowledged');
    expect(sendSyncMutation).toHaveBeenCalledTimes(1);
    const verifyDb = await openLocalProjectDatabase();
    await expect(listMutationOutbox(verifyDb, 'owner-a', project.id)).resolves.toMatchObject([
      { state: 'acknowledged' },
    ]);
    verifyDb.close();
  });
});
