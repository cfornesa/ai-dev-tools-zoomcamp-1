import type { MediaTransferRecord } from './mediaTransfer';
import { STORE_MEDIA_TRANSFERS } from './localProjectRepository';

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

export async function saveMediaTransfer(
  db: IDBDatabase,
  record: MediaTransferRecord,
): Promise<MediaTransferRecord> {
  const transaction = db.transaction(STORE_MEDIA_TRANSFERS, 'readwrite');
  transaction.objectStore(STORE_MEDIA_TRANSFERS).put(record);
  await transactionDone(transaction);
  return record;
}

export async function getMediaTransfer(
  db: IDBDatabase,
  ownerId: string,
  transferId: string,
): Promise<MediaTransferRecord | null> {
  const transaction = db.transaction(STORE_MEDIA_TRANSFERS, 'readonly');
  const value = (await requestValue(
    transaction.objectStore(STORE_MEDIA_TRANSFERS).get(transferId),
  )) as MediaTransferRecord | undefined;
  return value?.ownerId === ownerId ? value : null;
}

export async function listMediaTransfersForProject(
  db: IDBDatabase,
  ownerId: string,
  projectId: string,
): Promise<MediaTransferRecord[]> {
  const transaction = db.transaction(STORE_MEDIA_TRANSFERS, 'readonly');
  const rows = (await requestValue(
    transaction
      .objectStore(STORE_MEDIA_TRANSFERS)
      .index('by_owner_project')
      .getAll([ownerId, projectId]),
  )) as MediaTransferRecord[];
  return rows.sort((left, right) => left.transferId.localeCompare(right.transferId));
}

export async function deleteMediaTransfer(
  db: IDBDatabase,
  ownerId: string,
  transferId: string,
): Promise<boolean> {
  const record = await getMediaTransfer(db, ownerId, transferId);
  if (!record) return false;
  const transaction = db.transaction(STORE_MEDIA_TRANSFERS, 'readwrite');
  transaction.objectStore(STORE_MEDIA_TRANSFERS).delete(transferId);
  await transactionDone(transaction);
  return true;
}
