// See localProjectRepository.test.ts's top-of-file comment: jsdom's `Blob`
// isn't structured-cloneable by Node's native `structuredClone`, which
// fake-indexeddb relies on internally, so this file swaps in Node's own
// `Blob` for its duration -- a test-environment-only workaround.
import { Blob as NodeBlob } from 'node:buffer';
(globalThis as unknown as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob;

import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createProject,
  createScene,
  importMediaAsset,
  openLocalProjectDatabase,
} from './localProjectRepository';
import { openDraftDatabase, putDraftRecord } from './draftAutosave';
import {
  getAppDatabaseCatalog,
  getLocalStorageDashboardSnapshot,
  isNearQuota,
  listArchivedDatabaseNames,
  recordArchivedDatabaseName,
} from './localStorageDashboard';

function withNavigatorStorage(value: unknown, fn: () => Promise<void>) {
  const original = Object.getOwnPropertyDescriptor(globalThis.navigator, 'storage');
  Object.defineProperty(globalThis.navigator, 'storage', { value, configurable: true });
  return fn().finally(() => {
    if (original) Object.defineProperty(globalThis.navigator, 'storage', original);
  });
}

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('isNearQuota', () => {
  it('is false when unsupported', () => {
    expect(isNearQuota({ supported: false })).toBe(false);
  });

  it('is false comfortably under the threshold', () => {
    expect(isNearQuota({ supported: true, usage: 10, quota: 100 })).toBe(false);
  });

  it('is true at or above 90% usage', () => {
    expect(isNearQuota({ supported: true, usage: 90, quota: 100 })).toBe(true);
    expect(isNearQuota({ supported: true, usage: 95, quota: 100 })).toBe(true);
  });
});

describe('getAppDatabaseCatalog', () => {
  it('always includes the active project database and the legacy recovery database', async () => {
    const catalog = await getAppDatabaseCatalog();
    const kinds = catalog.map((entry) => entry.kind);
    expect(kinds).toContain('active');
    expect(kinds).toContain('legacy_recovery');
  });

  it('includes recorded archived database names', async () => {
    const db = await openLocalProjectDatabase();
    await recordArchivedDatabaseName(db, 'creatrart-local-projects-archive-1');
    db.close();

    const catalog = await getAppDatabaseCatalog();
    const archived = catalog.filter((entry) => entry.kind === 'archived');
    expect(archived.map((entry) => entry.name)).toEqual(['creatrart-local-projects-archive-1']);
  });

  it('never records the same archived name twice', async () => {
    const db = await openLocalProjectDatabase();
    await recordArchivedDatabaseName(db, 'archive-1');
    await recordArchivedDatabaseName(db, 'archive-1');
    const names = await listArchivedDatabaseNames(db);
    db.close();
    expect(names).toEqual(['archive-1']);
  });
});

describe('getLocalStorageDashboardSnapshot', () => {
  afterEach(() => {
    (globalThis as { indexedDB?: IDBFactory }).indexedDB = new IDBFactory();
  });

  it('reports counts, byte totals, and last activity for a populated active database', async () => {
    const ownerId = 'owner-1';
    const db = await openLocalProjectDatabase();
    const projectA = await createProject(db, { ownerId, title: 'Project A' });
    await createScene(db, ownerId, { projectId: projectA.id, name: 'Scene 1', sceneJson: {} });
    await createScene(db, ownerId, { projectId: projectA.id, name: 'Scene 2', sceneJson: {} });
    await importMediaAsset(db, {
      projectId: projectA.id,
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
      mimeType: 'image/png',
      filename: 'a.png',
      altText: '',
    });
    const projectB = await createProject(db, { ownerId, title: 'Project B' });
    await createScene(db, ownerId, { projectId: projectB.id, name: 'Scene 3', sceneJson: {} });
    db.close();

    await withNavigatorStorage(
      { persist: async () => true, estimate: async () => ({ usage: 10, quota: 100 }) },
      async () => {
        const snapshot = await getLocalStorageDashboardSnapshot(ownerId);
        const active = snapshot.databases.find((entry) => entry.kind === 'active');
        expect(active?.opened).toBe(true);
        expect(active?.projectCount).toBe(2);
        expect(active?.sceneCount).toBe(3);
        expect(active?.mediaFileCount).toBe(1);
        expect(active?.byteTotal).toBe(3);
        expect(active?.lastActivity).not.toBeNull();
      },
    );
  });

  it('reports draft-database counts distinct from the active database', async () => {
    const draftDb = await openDraftDatabase();
    await putDraftRecord(draftDb, {
      projectId: 'p1',
      userKey: 'owner-1',
      sessionId: 's1',
      sceneJson: { shapes: [] },
      savedAt: new Date().toISOString(),
      changeSummary: 'edit',
      writeSeq: 1,
    });
    draftDb.close();

    const snapshot = await getLocalStorageDashboardSnapshot('owner-1');
    const drafts = snapshot.databases.find((entry) => entry.kind === 'legacy_recovery');
    expect(drafts?.opened).toBe(true);
    expect(drafts?.sceneCount).toBe(1);
    expect(drafts?.projectCount).toBe(1);
  });

  it('reports an unsupported estimate/persist state without throwing', async () => {
    await withNavigatorStorage(undefined, async () => {
      const snapshot = await getLocalStorageDashboardSnapshot('owner-1');
      expect(snapshot.estimate.supported).toBe(false);
      expect(snapshot.persistentStorage.supported).toBe(false);
    });
  });

  it('reports null browser-reported databases when indexedDB.databases is unsupported', async () => {
    const original = indexedDB.databases;
    Object.defineProperty(indexedDB, 'databases', { value: undefined, configurable: true });
    try {
      const snapshot = await getLocalStorageDashboardSnapshot('owner-1');
      expect(snapshot.browserReportedDatabases).toBeNull();
    } finally {
      Object.defineProperty(indexedDB, 'databases', { value: original, configurable: true });
    }
  });

  it('reports a corrupted/upgrade-blocked active database as unopened rather than throwing', async () => {
    // Pre-create the database at a *higher* version than the module expects,
    // so its own open attempt collides with a real version-mismatch error --
    // the same class of failure a corrupted or upgrade-blocked catalog
    // produces in a real browser.
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('creatrart-local-projects', 999);
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {};
    });

    const snapshot = await getLocalStorageDashboardSnapshot('owner-1');
    const active = snapshot.databases.find((entry) => entry.kind === 'active');
    expect(active?.opened).toBe(false);
    expect(active?.errorKind).toBeTruthy();
  });
});
