import { Blob as NodeBlob } from 'node:buffer';

(globalThis as unknown as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob;

import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  appendRecoveryDraft,
  getLatestRecoveryDraft,
  listRecoveryDrafts,
  MAX_RECOVERY_DRAFTS_PER_PROJECT,
} from './localRecovery';
import { DB_NAME, openLocalProjectDatabase } from './localProjectRepository';

describe('local recovery drafts', () => {
  const archive = (text: string): Blob =>
    new NodeBlob([text], { type: 'application/zip' }) as unknown as Blob;

  beforeEach(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('database deletion was blocked'));
    });
  });

  it('keeps only the newest bounded recovery archives per project', async () => {
    const db = await openLocalProjectDatabase();
    await appendRecoveryDraft(db, {
      ownerId: 'owner',
      projectId: 'project',
      archive: archive('first'),
      savedAt: '2026-01-01T00:00:00.000Z',
    });
    await appendRecoveryDraft(db, {
      ownerId: 'owner',
      projectId: 'project',
      archive: archive('second'),
      savedAt: '2026-01-02T00:00:00.000Z',
    });
    await appendRecoveryDraft(db, {
      ownerId: 'owner',
      projectId: 'project',
      archive: archive('third'),
      savedAt: '2026-01-03T00:00:00.000Z',
    });

    try {
      const drafts = await listRecoveryDrafts(db, 'owner', 'project');
      expect(drafts).toHaveLength(MAX_RECOVERY_DRAFTS_PER_PROJECT);
      expect(drafts.map((draft) => draft.savedAt)).toEqual([
        '2026-01-03T00:00:00.000Z',
        '2026-01-02T00:00:00.000Z',
      ]);
      expect(await drafts[0]?.archive.text()).toBe('third');
    } finally {
      db.close();
    }
  });

  it("does not expose another owner's recovery draft", async () => {
    const db = await openLocalProjectDatabase();
    await appendRecoveryDraft(db, {
      ownerId: 'owner-a',
      projectId: 'project',
      archive: archive('private'),
      savedAt: '2026-01-01T00:00:00.000Z',
    });

    try {
      expect(await getLatestRecoveryDraft(db, 'owner-b', 'project')).toBeNull();
    } finally {
      db.close();
    }
  });
});
