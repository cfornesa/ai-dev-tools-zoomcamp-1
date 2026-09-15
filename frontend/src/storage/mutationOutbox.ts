import {
  computeChecksum,
  getProject,
  openLocalProjectDatabase,
  STORE_MUTATION_OUTBOX,
} from './localProjectRepository';
import type { MergeConflict, MergeOperationContext } from './conflictMerge';

export const MUTATION_OUTBOX_SCHEMA_VERSION = 1;
export const DEFAULT_MAX_ATTEMPTS = 5;
export const DEFAULT_RETRY_BASE_MS = 1_000;

export type MutationKind = 'scene' | 'metadata' | 'media-reference';
export type MutationState = 'pending' | 'in-flight' | 'acknowledged' | 'failed' | 'paused';

export type StoredSyncConflict = {
  conflicts: MergeConflict[];
  context: MergeOperationContext;
  localSnapshot?: unknown;
  remoteSnapshot?: unknown;
  mergedSnapshot?: unknown;
};

export type MutationOutboxRecord = {
  operationId: string;
  ownerId: string;
  sessionGeneration?: string;
  projectId: string;
  sceneId?: string;
  kind: MutationKind;
  payload: unknown;
  payloadChecksum: string;
  schemaVersion: number;
  clientSequence: number;
  dependencyOperationIds: string[];
  createdAt: string;
  state: MutationState;
  attemptCount: number;
  nextAttemptAt: string;
  lastErrorCode: string | null;
  acknowledgedAt: string | null;
  conflict?: StoredSyncConflict;
};

export type EnqueueMutationInput = {
  ownerId: string;
  sessionGeneration?: string;
  projectId: string;
  sceneId?: string;
  kind: MutationKind;
  payload: unknown;
  dependencyOperationIds?: string[];
  now?: Date;
};

export type MutationReplayResult =
  | { type: 'acknowledged'; serverOperationId?: string }
  | { type: 'retryable'; code: string }
  | { type: 'paused'; code: string; conflict?: StoredSyncConflict };

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`);
  return `{${entries.join(',')}}`;
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function asRecord(value: unknown): MutationOutboxRecord {
  return value as MutationOutboxRecord;
}

function retryAt(now: Date, attemptCount: number, baseMs: number): string {
  return new Date(now.getTime() + baseMs * 2 ** Math.max(0, attemptCount - 1)).toISOString();
}

async function nextSequence(
  db: IDBDatabase,
  ownerId: string,
  projectId: string,
  sessionGeneration?: string,
): Promise<number> {
  const transaction = db.transaction(STORE_MUTATION_OUTBOX, 'readonly');
  const rows = (await requestValue(
    transaction
      .objectStore(STORE_MUTATION_OUTBOX)
      .index('by_owner_project')
      .getAll([ownerId, projectId]),
  )) as unknown[];
  return (
    rows
      .filter(
        (row) =>
          sessionGeneration === undefined || asRecord(row).sessionGeneration === sessionGeneration,
      )
      .reduce<number>((maximum, row) => Math.max(maximum, asRecord(row).clientSequence), 0) + 1
  );
}

export async function enqueueMutation(
  db: IDBDatabase,
  input: EnqueueMutationInput,
): Promise<MutationOutboxRecord> {
  if (!(await getProject(db, input.ownerId, input.projectId))) {
    throw new Error(
      'Cannot queue a mutation for a project owned by another user or not present locally.',
    );
  }
  const now = input.now ?? new Date();
  const serialized = stableJson(input.payload);
  const record: MutationOutboxRecord = {
    operationId: crypto.randomUUID(),
    ownerId: input.ownerId,
    sessionGeneration: input.sessionGeneration,
    projectId: input.projectId,
    sceneId: input.sceneId,
    kind: input.kind,
    payload: JSON.parse(serialized) as unknown,
    payloadChecksum: await computeChecksum(new TextEncoder().encode(serialized)),
    schemaVersion: MUTATION_OUTBOX_SCHEMA_VERSION,
    clientSequence: await nextSequence(db, input.ownerId, input.projectId),
    dependencyOperationIds: [...(input.dependencyOperationIds ?? [])],
    createdAt: now.toISOString(),
    state: 'pending',
    attemptCount: 0,
    nextAttemptAt: now.toISOString(),
    lastErrorCode: null,
    acknowledgedAt: null,
  };
  const transaction = db.transaction(STORE_MUTATION_OUTBOX, 'readwrite');
  transaction.objectStore(STORE_MUTATION_OUTBOX).add(record);
  await transactionDone(transaction);
  return record;
}

export async function listMutationOutbox(
  db: IDBDatabase,
  ownerId: string,
  projectId: string,
): Promise<MutationOutboxRecord[]> {
  const transaction = db.transaction(STORE_MUTATION_OUTBOX, 'readonly');
  const rows = (await requestValue(
    transaction
      .objectStore(STORE_MUTATION_OUTBOX)
      .index('by_owner_project')
      .getAll([ownerId, projectId]),
  )) as unknown[];
  return rows.map(asRecord).sort((left, right) => left.clientSequence - right.clientSequence);
}

function dependenciesAcknowledged(
  operation: MutationOutboxRecord,
  byId: Map<string, MutationOutboxRecord>,
): boolean {
  return operation.dependencyOperationIds.every((id) => byId.get(id)?.state === 'acknowledged');
}

export async function claimReadyMutations(
  db: IDBDatabase,
  ownerId: string,
  projectId: string,
  now = new Date(),
  limit = 10,
  sessionGeneration?: string,
): Promise<MutationOutboxRecord[]> {
  const all = (await listMutationOutbox(db, ownerId, projectId)).filter(
    (operation) =>
      sessionGeneration === undefined || operation.sessionGeneration === sessionGeneration,
  );
  const byId = new Map(all.map((operation) => [operation.operationId, operation]));
  const ready = all
    .filter(
      (operation) =>
        operation.state === 'pending' &&
        new Date(operation.nextAttemptAt).getTime() <= now.getTime() &&
        dependenciesAcknowledged(operation, byId),
    )
    .slice(0, limit);
  if (ready.length === 0) return [];
  const transaction = db.transaction(STORE_MUTATION_OUTBOX, 'readwrite');
  const store = transaction.objectStore(STORE_MUTATION_OUTBOX);
  for (const operation of ready) {
    operation.state = 'in-flight';
    operation.attemptCount += 1;
    store.put(operation);
  }
  await transactionDone(transaction);
  return ready;
}

async function updateOperation(
  db: IDBDatabase,
  ownerId: string,
  operationId: string,
  update: (operation: MutationOutboxRecord) => void,
): Promise<MutationOutboxRecord | null> {
  const transaction = db.transaction(STORE_MUTATION_OUTBOX, 'readwrite');
  const store = transaction.objectStore(STORE_MUTATION_OUTBOX);
  const existing = (await requestValue(store.get(operationId))) as unknown;
  if (!existing || asRecord(existing).ownerId !== ownerId) {
    await transactionDone(transaction);
    return null;
  }
  const operation = asRecord(existing);
  update(operation);
  store.put(operation);
  await transactionDone(transaction);
  return operation;
}

export function acknowledgeMutation(
  db: IDBDatabase,
  ownerId: string,
  operationId: string,
  now = new Date(),
): Promise<MutationOutboxRecord | null> {
  return updateOperation(db, ownerId, operationId, (operation) => {
    operation.state = 'acknowledged';
    operation.acknowledgedAt ??= now.toISOString();
    operation.lastErrorCode = null;
  });
}

export function retryMutation(
  db: IDBDatabase,
  ownerId: string,
  operationId: string,
  code: string,
  now = new Date(),
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  baseMs = DEFAULT_RETRY_BASE_MS,
): Promise<MutationOutboxRecord | null> {
  return updateOperation(db, ownerId, operationId, (operation) => {
    operation.lastErrorCode = code;
    operation.state = operation.attemptCount >= maxAttempts ? 'failed' : 'pending';
    operation.nextAttemptAt = retryAt(now, operation.attemptCount, baseMs);
  });
}

export function pauseMutation(
  db: IDBDatabase,
  ownerId: string,
  operationId: string,
  code: string,
  conflict?: StoredSyncConflict,
): Promise<MutationOutboxRecord | null> {
  return updateOperation(db, ownerId, operationId, (operation) => {
    operation.state = 'paused';
    operation.lastErrorCode = code;
    operation.conflict = conflict;
  });
}

export function resumeMutation(
  db: IDBDatabase,
  ownerId: string,
  operationId: string,
  now = new Date(),
): Promise<MutationOutboxRecord | null> {
  return updateOperation(db, ownerId, operationId, (operation) => {
    operation.state = 'pending';
    operation.lastErrorCode = null;
    operation.nextAttemptAt = now.toISOString();
  });
}

export function discardMutation(
  db: IDBDatabase,
  ownerId: string,
  operationId: string,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_MUTATION_OUTBOX, 'readwrite');
    const store = transaction.objectStore(STORE_MUTATION_OUTBOX);
    const request = store.get(operationId);
    request.onsuccess = () => {
      const operation = request.result as MutationOutboxRecord | undefined;
      if (!operation || operation.ownerId !== ownerId || operation.state !== 'paused') {
        resolve(false);
        return;
      }
      store.delete(operationId);
    };
    transaction.oncomplete = () => resolve(Boolean(request.result));
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function replayReadyMutations(
  db: IDBDatabase,
  ownerId: string,
  projectId: string,
  send: (operation: MutationOutboxRecord) => Promise<MutationReplayResult>,
  now = new Date(),
  sessionGeneration?: string,
): Promise<MutationOutboxRecord[]> {
  const claimed = await claimReadyMutations(db, ownerId, projectId, now, 10, sessionGeneration);
  const completed: MutationOutboxRecord[] = [];
  for (const operation of claimed) {
    const result = await send(operation);
    const updated =
      result.type === 'acknowledged'
        ? await acknowledgeMutation(db, ownerId, operation.operationId, now)
        : result.type === 'retryable'
          ? await retryMutation(db, ownerId, operation.operationId, result.code, now)
          : await pauseMutation(db, ownerId, operation.operationId, result.code, result.conflict);
    if (updated) completed.push(updated);
    if (result.type === 'paused' || result.type === 'retryable') break;
  }
  return completed;
}

export async function openOutboxDatabase(): Promise<IDBDatabase> {
  return openLocalProjectDatabase();
}
