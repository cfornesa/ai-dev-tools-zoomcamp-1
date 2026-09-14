import { Blob as NodeBlob } from 'node:buffer';

(globalThis as unknown as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob;

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getFolderBridgeStatus,
  listArchiveFiles,
  readArchiveFile,
  writeArchiveFile,
  type FileSystemDirectoryHandleLike,
  type FileSystemFileHandleLike,
} from './folderArchiveBridge';
import { openLocalProjectDatabase } from './localProjectRepository';
import { IDBFactory } from 'fake-indexeddb';

function fileHandle(name: string, content: string): FileSystemFileHandleLike {
  let saved = new Blob([content], { type: 'application/zip' });
  return {
    kind: 'file',
    name,
    async getFile() {
      return saved as File;
    },
    async createWritable() {
      return {
        async write(blob: Blob) {
          saved = blob;
        },
        async close() {},
      };
    },
  };
}

function directoryHandle(
  entries: Array<[string, FileSystemFileHandleLike | FileSystemDirectoryHandleLike]>,
): FileSystemDirectoryHandleLike {
  return {
    kind: 'directory',
    name: 'workspace',
    async queryPermission() {
      return 'granted';
    },
    async requestPermission() {
      return 'granted';
    },
    async getFileHandle(name: string) {
      const existing = entries.find(([entryName]) => entryName === name)?.[1];
      if (!existing || existing.kind !== 'file') throw new DOMException('missing', 'NotFoundError');
      return existing;
    },
    async *entries() {
      yield* entries;
    },
  };
}

describe('folderArchiveBridge', () => {
  beforeEach(() => {
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    vi.stubGlobal('window', {});
  });

  it('reports the optional bridge as unavailable when the picker is absent', async () => {
    const db = await openLocalProjectDatabase();
    await expect(getFolderBridgeStatus(db)).resolves.toEqual({
      status: 'unavailable',
      handle: null,
    });
    db.close();
  });

  it('lists only safe ZIP files and ignores unrelated entries', async () => {
    const handle = directoryHandle([
      ['workspace.zip', fileHandle('workspace.zip', 'zip')],
      ['notes.txt', fileHandle('notes.txt', 'text')],
      ['../escape.zip', fileHandle('../escape.zip', 'bad')],
    ]);
    await expect(listArchiveFiles(handle)).resolves.toEqual(['workspace.zip']);
  });

  it('rejects unsafe archive names before reading or writing', async () => {
    const handle = directoryHandle([]);
    await expect(readArchiveFile(handle, '../escape.zip')).rejects.toMatchObject({
      kind: 'unsupported-file-type',
    });
    await expect(writeArchiveFile(handle, 'notes.txt', new Blob(['text']))).rejects.toMatchObject({
      kind: 'unsupported-file-type',
    });
  });

  it('reads and writes an explicitly selected archive', async () => {
    const archive = fileHandle('workspace.zip', 'before');
    const handle = directoryHandle([['workspace.zip', archive]]);
    await expect(readArchiveFile(handle, 'workspace.zip').then(Array.from)).resolves.toEqual(
      Array.from(new TextEncoder().encode('before')),
    );
    await writeArchiveFile(handle, 'workspace.zip', new Blob(['after']));
    await expect(readArchiveFile(handle, 'workspace.zip').then(Array.from)).resolves.toEqual(
      Array.from(new TextEncoder().encode('after')),
    );
  });

  it('surfaces denied folder access without changing the local workspace', async () => {
    const handle = directoryHandle([]);
    vi.spyOn(handle, 'queryPermission').mockResolvedValue('denied');
    await expect(listArchiveFiles(handle)).rejects.toMatchObject({ kind: 'permission-denied' });
  });
});
