import { STORE_META, type LocalRepositoryErrorKind } from './localProjectRepository';

/**
 * The folder bridge is deliberately an optional adapter. IndexedDB remains
 * the active browser-local workspace; this module only reads or writes an
 * explicitly selected ZIP checkpoint.
 */

export const FOLDER_HANDLE_META_KEY = 'folderArchiveHandle';
export const DEFAULT_ARCHIVE_FILENAME = 'local-projects-archive.zip';

type PermissionMode = 'read' | 'readwrite';
type PermissionState = 'granted' | 'denied' | 'prompt';

export type FolderBridgeStatus =
  'unavailable' | 'prompt' | 'granted' | 'denied' | 'revoked' | 'read-only';

export type FolderBridgeErrorKind =
  | Extract<LocalRepositoryErrorKind, 'quota-exceeded' | 'interrupted-write'>
  | 'permission-denied'
  | 'revoked'
  | 'read-only'
  | 'unavailable'
  | 'unsupported-file-type';

export class FolderBridgeException extends Error {
  readonly kind: FolderBridgeErrorKind;

  constructor(kind: FolderBridgeErrorKind, message: string) {
    super(message);
    this.name = 'FolderBridgeException';
    this.kind = kind;
  }
}

type FileSystemWritableFileStreamLike = {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
};

export type FileSystemFileHandleLike = {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(options?: {
    keepExistingData?: boolean;
  }): Promise<FileSystemWritableFileStreamLike>;
};

export type FileSystemDirectoryHandleLike = {
  kind: 'directory';
  name: string;
  queryPermission(options?: { mode?: PermissionMode }): Promise<PermissionState>;
  requestPermission(options?: { mode?: PermissionMode }): Promise<PermissionState>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandleLike>;
  entries(): AsyncIterableIterator<
    [string, FileSystemFileHandleLike | FileSystemDirectoryHandleLike]
  >;
};

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: PermissionMode;
  }) => Promise<FileSystemDirectoryHandleLike>;
};

function supportsDirectoryPicker(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as WindowWithDirectoryPicker).showDirectoryPicker === 'function'
  );
}

function isSafeArchiveFilename(name: string): boolean {
  return (
    name.length > 4 &&
    name.toLowerCase().endsWith('.zip') &&
    name !== '.' &&
    name !== '..' &&
    !name.includes('/') &&
    !name.includes('\\') &&
    !name.includes('\0')
  );
}

function classifyUnknownError(err: unknown): FolderBridgeException {
  const name = err instanceof DOMException ? err.name : undefined;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new FolderBridgeException(
      'permission-denied',
      'Folder access was denied. The browser-local workspace remains available.',
    );
  }
  if (name === 'NotFoundError') {
    return new FolderBridgeException(
      'revoked',
      'The selected folder is no longer available. Choose it again or use a ZIP archive.',
    );
  }
  if (name === 'NoModificationAllowedError') {
    return new FolderBridgeException(
      'read-only',
      'The selected folder is read-only. Export a ZIP archive instead.',
    );
  }
  if (name === 'QuotaExceededError') {
    return new FolderBridgeException(
      'quota-exceeded',
      'The browser or selected storage location rejected the archive because it is full.',
    );
  }
  return new FolderBridgeException(
    'interrupted-write',
    err instanceof Error ? err.message : 'The folder operation was interrupted.',
  );
}

function requestForFolderPicker(): Promise<FileSystemDirectoryHandleLike> {
  if (!supportsDirectoryPicker()) {
    return Promise.reject(
      new FolderBridgeException(
        'unavailable',
        'This browser cannot choose a writable folder. Use ZIP import/export instead.',
      ),
    );
  }
  try {
    return (window as WindowWithDirectoryPicker).showDirectoryPicker!({
      id: 'creatrart-workspace-archive',
      mode: 'readwrite',
    });
  } catch (err) {
    return Promise.reject(classifyUnknownError(err));
  }
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
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

export async function saveFolderHandle(
  db: IDBDatabase,
  handle: FileSystemDirectoryHandleLike,
): Promise<void> {
  try {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({ key: FOLDER_HANDLE_META_KEY, handle });
    await transactionDone(tx);
  } catch (err) {
    throw classifyUnknownError(err);
  }
}

export async function loadFolderHandle(
  db: IDBDatabase,
): Promise<FileSystemDirectoryHandleLike | null> {
  try {
    const tx = db.transaction(STORE_META, 'readonly');
    const record = (await requestValue(tx.objectStore(STORE_META).get(FOLDER_HANDLE_META_KEY))) as
      { handle?: FileSystemDirectoryHandleLike } | undefined;
    return record?.handle ?? null;
  } catch (err) {
    throw classifyUnknownError(err);
  }
}

export async function clearFolderHandle(db: IDBDatabase): Promise<void> {
  try {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).delete(FOLDER_HANDLE_META_KEY);
    await transactionDone(tx);
  } catch (err) {
    throw classifyUnknownError(err);
  }
}

export async function getFolderBridgeStatus(
  db: IDBDatabase,
): Promise<{ status: FolderBridgeStatus; handle: FileSystemDirectoryHandleLike | null }> {
  if (!supportsDirectoryPicker()) return { status: 'unavailable', handle: null };
  const handle = await loadFolderHandle(db);
  if (!handle) return { status: 'prompt', handle: null };
  try {
    const state = await handle.queryPermission({ mode: 'readwrite' });
    if (state === 'granted') return { status: 'granted', handle };
    if (state === 'denied') return { status: 'denied', handle };
    return { status: 'prompt', handle };
  } catch {
    return { status: 'revoked', handle };
  }
}

/** Starts the native picker immediately from the user gesture. Browsers
 * require transient user activation for showDirectoryPicker(). */
export async function pickFolder(): Promise<FileSystemDirectoryHandleLike> {
  const handle = await requestForFolderPicker();
  try {
    const permission = await handle.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      throw new FolderBridgeException(
        'permission-denied',
        'Folder access was not granted. The browser-local workspace remains available.',
      );
    }
    return handle;
  } catch (err) {
    if (err instanceof FolderBridgeException) throw err;
    throw classifyUnknownError(err);
  }
}

export async function chooseFolder(
  db: IDBDatabase,
): Promise<{ status: 'granted'; handle: FileSystemDirectoryHandleLike }> {
  const handle = await pickFolder();
  await saveFolderHandle(db, handle);
  return { status: 'granted', handle };
}

export async function ensureFolderWritePermission(
  handle: FileSystemDirectoryHandleLike,
): Promise<void> {
  try {
    const state = await handle.queryPermission({ mode: 'readwrite' });
    if (state === 'granted') return;
    const requested = await handle.requestPermission({ mode: 'readwrite' });
    if (requested !== 'granted') {
      throw new FolderBridgeException(
        'permission-denied',
        'Write permission was not granted. The previous archive remains unchanged.',
      );
    }
  } catch (err) {
    if (err instanceof FolderBridgeException) throw err;
    throw classifyUnknownError(err);
  }
}

export async function listArchiveFiles(handle: FileSystemDirectoryHandleLike): Promise<string[]> {
  try {
    const permission = await handle.queryPermission({ mode: 'read' });
    if (permission === 'denied') {
      throw new FolderBridgeException(
        'permission-denied',
        'Folder read access was denied. Use ZIP import/export instead.',
      );
    }
    const names: string[] = [];
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === 'file' && isSafeArchiveFilename(name)) names.push(name);
    }
    return names.sort((a, b) => a.localeCompare(b));
  } catch (err) {
    if (err instanceof FolderBridgeException) throw err;
    throw classifyUnknownError(err);
  }
}

export async function readArchiveFile(
  handle: FileSystemDirectoryHandleLike,
  filename: string,
): Promise<Uint8Array> {
  if (!isSafeArchiveFilename(filename)) {
    throw new FolderBridgeException(
      'unsupported-file-type',
      'Only safe ZIP archive names may be opened.',
    );
  }
  try {
    const fileHandle = await handle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch (err) {
    throw err instanceof FolderBridgeException ? err : classifyUnknownError(err);
  }
}

export async function writeArchiveFile(
  handle: FileSystemDirectoryHandleLike,
  filename: string,
  blob: Blob,
): Promise<void> {
  if (!isSafeArchiveFilename(filename)) {
    throw new FolderBridgeException(
      'unsupported-file-type',
      'Only safe ZIP archive names may be written.',
    );
  }
  await ensureFolderWritePermission(handle);
  let writable: FileSystemWritableFileStreamLike | undefined;
  try {
    const fileHandle = await handle.getFileHandle(filename, { create: true });
    writable = await fileHandle.createWritable({ keepExistingData: false });
    await writable.write(blob);
    await writable.close();
  } catch (err) {
    try {
      await writable?.abort?.();
    } catch {
      // The original write error is the actionable result.
    }
    throw err instanceof FolderBridgeException ? err : classifyUnknownError(err);
  }
}
