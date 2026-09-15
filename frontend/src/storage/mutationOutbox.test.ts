import 'fake-indexeddb/auto';

import { Blob as NodeBlob } from 'node:buffer';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';

(globalThis as unknown as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob;

import { createProject, openLocalProjectDatabase } from './localProjectRepository';
import {
  acknowledgeMutation,
  claimReadyMutations,
  enqueueMutation,
  listMutationOutbox,
  pauseMutation,
  replayReadyMutations,
  retryMutation,
  resumeMutation,
  discardMutation,
} from './mutationOutbox';

describe('mutation outbox', () => {
  beforeEach(() => {
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  });

  it('persists owner-scoped operations with deterministic sequence and checksum', async () => {
    const db = await openLocalProjectDatabase();
    const project = await createProject(db, { ownerId: 'owner-a', title: 'Project' });
    const first = await enqueueMutation(db, {
      ownerId: 'owner-a',
      projectId: project.id,
      kind: 'scene',
      payload: { z: 1, a: { b: 2, a: 3 } },
    });
    const second = await enqueueMutation(db, {
      ownerId: 'owner-a',
      projectId: project.id,
      kind: 'metadata',
      payload: { a: { a: 3, b: 2 }, z: 1 },
      dependencyOperationIds: [first.operationId],
    });
    expect(first.clientSequence).toBe(1);
    expect(second.clientSequence).toBe(2);
    expect(second.payloadChecksum).toBe(first.payloadChecksum);
    expect((await listMutationOutbox(db, 'owner-a', project.id)).map((row) => row.kind)).toEqual([
      'scene',
      'metadata',
    ]);
    await expect(
      enqueueMutation(db, {
        ownerId: 'owner-b',
        projectId: project.id,
        kind: 'scene',
        payload: {},
      }),
    ).rejects.toThrow();
  });

  it('claims dependency-free operations first and releases dependents after acknowledgement', async () => {
    const db = await openLocalProjectDatabase();
    const project = await createProject(db, { ownerId: 'owner-a', title: 'Project' });
    const first = await enqueueMutation(db, {
      ownerId: 'owner-a',
      projectId: project.id,
      kind: 'scene',
      payload: { step: 1 },
    });
    await enqueueMutation(db, {
      ownerId: 'owner-a',
      projectId: project.id,
      kind: 'metadata',
      payload: { step: 2 },
      dependencyOperationIds: [first.operationId],
    });
    expect(
      (await claimReadyMutations(db, 'owner-a', project.id)).map((row) => row.operationId),
    ).toEqual([first.operationId]);
    expect(await claimReadyMutations(db, 'owner-a', project.id)).toEqual([]);
    await acknowledgeMutation(db, 'owner-a', first.operationId);
    expect(
      (await claimReadyMutations(db, 'owner-a', project.id)).map((row) => row.clientSequence),
    ).toEqual([2]);
  });

  it('uses bounded deterministic exponential retry and terminal failure', async () => {
    const db = await openLocalProjectDatabase();
    const project = await createProject(db, { ownerId: 'owner-a', title: 'Project' });
    const now = new Date('2026-01-01T00:00:00.000Z');
    const operation = await enqueueMutation(db, {
      ownerId: 'owner-a',
      projectId: project.id,
      kind: 'scene',
      payload: {},
      now,
    });
    await claimReadyMutations(db, 'owner-a', project.id, now);
    expect(
      await retryMutation(db, 'owner-a', operation.operationId, 'offline', now, 3, 100),
    ).toMatchObject({
      state: 'pending',
      attemptCount: 1,
      nextAttemptAt: '2026-01-01T00:00:00.100Z',
    });
    await claimReadyMutations(db, 'owner-a', project.id, new Date('2026-01-01T00:00:00.100Z'));
    await retryMutation(
      db,
      'owner-a',
      operation.operationId,
      'offline',
      new Date('2026-01-01T00:00:00.100Z'),
      2,
      100,
    );
    await claimReadyMutations(db, 'owner-a', project.id, new Date('2026-01-01T00:00:00.300Z'));
    expect(
      await retryMutation(
        db,
        'owner-a',
        operation.operationId,
        'offline',
        new Date('2026-01-01T00:00:00.300Z'),
        2,
        100,
      ),
    ).toMatchObject({ state: 'failed', attemptCount: 2 });
  });

  it('replays in order and pauses on a non-retryable result', async () => {
    const db = await openLocalProjectDatabase();
    const project = await createProject(db, { ownerId: 'owner-a', title: 'Project' });
    await enqueueMutation(db, {
      ownerId: 'owner-a',
      projectId: project.id,
      kind: 'scene',
      payload: { step: 1 },
    });
    const calls: string[] = [];
    const results = await replayReadyMutations(db, 'owner-a', project.id, async (operation) => {
      calls.push(operation.kind);
      return { type: 'acknowledged' };
    });
    expect(calls).toEqual(['scene']);
    expect(results[0]?.state).toBe('acknowledged');
    await pauseMutation(db, 'owner-a', results[0]!.operationId, 'conflict');
    expect((await listMutationOutbox(db, 'owner-a', project.id))[0]).toMatchObject({
      state: 'paused',
      lastErrorCode: 'conflict',
    });
  });

  it('does not claim a different sign-in session generation', async () => {
    const db = await openLocalProjectDatabase();
    const project = await createProject(db, { ownerId: 'owner-a', title: 'Project' });
    await enqueueMutation(db, {
      ownerId: 'owner-a',
      sessionGeneration: 'session-a',
      projectId: project.id,
      kind: 'scene',
      payload: { private: true },
    });

    expect(
      await claimReadyMutations(db, 'owner-a', project.id, new Date(), 10, 'session-b'),
    ).toEqual([]);
    expect(
      (await claimReadyMutations(db, 'owner-a', project.id, new Date(), 10, 'session-a')).map(
        (operation) => operation.sessionGeneration,
      ),
    ).toEqual(['session-a']);
  });

  it('requires an explicit owner decision to resume or discard a paused mutation', async () => {
    const db = await openLocalProjectDatabase();
    const project = await createProject(db, { ownerId: 'owner-a', title: 'Project' });
    const operation = await enqueueMutation(db, {
      ownerId: 'owner-a',
      projectId: project.id,
      kind: 'scene',
      payload: { private: true },
    });
    await pauseMutation(db, 'owner-a', operation.operationId, 'authentication-required');
    expect(await claimReadyMutations(db, 'owner-a', project.id)).toEqual([]);
    await resumeMutation(db, 'owner-a', operation.operationId, new Date('2026-09-15T20:00:00Z'));
    expect(await claimReadyMutations(db, 'owner-a', project.id)).toHaveLength(1);
    await pauseMutation(db, 'owner-a', operation.operationId, 'permission-denied');
    expect(await discardMutation(db, 'owner-a', operation.operationId)).toBe(true);
    expect(await listMutationOutbox(db, 'owner-a', project.id)).toEqual([]);
  });
});
