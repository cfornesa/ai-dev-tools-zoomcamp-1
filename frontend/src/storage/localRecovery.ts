import { STORE_RECOVERY_DRAFTS, type LocalRecoveryDraftRecord } from './localProjectRepository';

/** #536 keeps the newest draft and one immediately previous draft. The
 * active project records remain authoritative; these archives are only the
 * bounded recovery trail shown after a reload or a new browser session. */
export const MAX_RECOVERY_DRAFTS_PER_PROJECT = 2;

export type RecoveryDraftSummary = Pick<LocalRecoveryDraftRecord, 'id' | 'savedAt'>;

function request<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function isRecoveryDraft(value: unknown): value is LocalRecoveryDraftRecord {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<LocalRecoveryDraftRecord>;
  return (
    typeof draft.id === 'string' &&
    typeof draft.projectId === 'string' &&
    typeof draft.ownerId === 'string' &&
    typeof draft.savedAt === 'string' &&
    draft.archive instanceof Blob
  );
}

function sortNewestFirst(drafts: LocalRecoveryDraftRecord[]): LocalRecoveryDraftRecord[] {
  return drafts.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Stores one complete archive snapshot and removes older snapshots for the
 * same owner/project in the same IndexedDB transaction. */
export async function appendRecoveryDraft(
  db: IDBDatabase,
  input: { ownerId: string; projectId: string; archive: Blob; savedAt?: string },
): Promise<RecoveryDraftSummary> {
  const record: LocalRecoveryDraftRecord = {
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    projectId: input.projectId,
    archive: input.archive,
    savedAt: input.savedAt ?? new Date().toISOString(),
  };
  const tx = db.transaction(STORE_RECOVERY_DRAFTS, 'readwrite');
  const store = tx.objectStore(STORE_RECOVERY_DRAFTS);
  const existing = (await request(store.getAll())) as unknown[];
  const owned = existing.filter(
    (value): value is LocalRecoveryDraftRecord =>
      isRecoveryDraft(value) &&
      value.ownerId === input.ownerId &&
      value.projectId === input.projectId,
  );
  store.put(record);
  for (const old of sortNewestFirst([...owned, record]).slice(MAX_RECOVERY_DRAFTS_PER_PROJECT)) {
    store.delete(old.id);
  }
  await transactionDone(tx);
  return { id: record.id, savedAt: record.savedAt };
}

/** Returns only well-formed recovery records owned by the signed-in user. A
 * malformed record is ignored and never surfaced as editable content. */
export async function listRecoveryDrafts(
  db: IDBDatabase,
  ownerId: string,
  projectId: string,
): Promise<LocalRecoveryDraftRecord[]> {
  const tx = db.transaction(STORE_RECOVERY_DRAFTS, 'readonly');
  const values = (await request(tx.objectStore(STORE_RECOVERY_DRAFTS).getAll())) as unknown[];
  return sortNewestFirst(
    values.filter(
      (value): value is LocalRecoveryDraftRecord =>
        isRecoveryDraft(value) && value.ownerId === ownerId && value.projectId === projectId,
    ),
  );
}

export async function getLatestRecoveryDraft(
  db: IDBDatabase,
  ownerId: string,
  projectId: string,
): Promise<LocalRecoveryDraftRecord | null> {
  return (await listRecoveryDrafts(db, ownerId, projectId))[0] ?? null;
}
