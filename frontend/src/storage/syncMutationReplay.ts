import { ApiError } from '../api/client';
import { sendSyncMutation } from '../api/syncMutations';
import { openLocalProjectDatabase } from './localProjectRepository';
import type { MutationOutboxRecord } from './mutationOutbox';
import { replayReadyMutations, type MutationReplayResult } from './mutationOutbox';

function classifyTransportFailure(error: unknown): MutationReplayResult {
  if (error instanceof ApiError) {
    if (error.status === 401) return { type: 'paused', code: 'authentication-required' };
    if (error.status === 403 || error.status === 404) {
      return { type: 'paused', code: 'permission-denied' };
    }
    if (error.status === 409) return { type: 'paused', code: 'conflict' };
    if (error.status >= 400 && error.status < 500) {
      return { type: 'paused', code: 'invalid-operation' };
    }
    return { type: 'retryable', code: `server-${error.status}` };
  }
  return { type: 'retryable', code: 'offline' };
}

/** Replay one project's eligible operations on reconnect or page start (#543). */
export async function replaySyncMutations(
  ownerId: string,
  projectId: string,
  now = new Date(),
): Promise<MutationOutboxRecord[]> {
  const db = await openLocalProjectDatabase();
  try {
    return await replayReadyMutations(
      db,
      ownerId,
      projectId,
      async (operation): Promise<MutationReplayResult> => {
        try {
          await sendSyncMutation(operation);
          return { type: 'acknowledged' };
        } catch (error) {
          return classifyTransportFailure(error);
        }
      },
      now,
    );
  } finally {
    db.close();
  }
}
