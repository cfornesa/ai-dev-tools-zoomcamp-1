// jsdom's own `Blob` implementation isn't recognized by Node's native
// `structuredClone` (which fake-indexeddb's `cloneValueForInsertion` uses
// internally to emulate IndexedDB's structured-clone-on-insert semantics),
// so a jsdom `Blob` stored via `put()` comes back as an empty `{}` -- a
// test-environment gap only, not a real-browser one (a real browser's
// native `Blob` clones correctly). Swapping in Node's own `Blob` (which
// *is* structured-cloneable) for the duration of this test file sidesteps
// it; this module's own runtime code never constructs or type-checks
// against `Blob` itself, so the swap is invisible to the code under test.
import { Blob as NodeBlob } from 'node:buffer';
(globalThis as unknown as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob;

import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DB_NAME,
  LocalRepositoryException,
  MAX_PROJECT_BYTES,
  MAX_PROJECT_FILES,
  STORE_META,
  addMediaReference,
  computeChecksum,
  createProject,
  createScene,
  deleteProject,
  deleteScene,
  getMediaBlob,
  getProject,
  getProjectUsage,
  getStorageEstimate,
  importMediaAsset,
  listMediaAssetsForProject,
  listProjectsForOwner,
  listScenesForProject,
  openLocalProjectDatabase,
  recomputeProjectUsage,
  removeMediaReference,
  requestPersistentStorage,
  updateProject,
  updateScene,
} from './localProjectRepository';

function pngBlob(sizeBytes = 16): Blob {
  const bytes = new Uint8Array(sizeBytes);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = i % 256;
  return new Blob([bytes], { type: 'image/png' });
}

describe('localProjectRepository', () => {
  beforeEach(() => {
    // Fresh database per test.
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  });

  afterEach(() => {
    // no-op: each test gets a fresh factory in beforeEach.
  });

  it('opens the database, creating all five object stores with the right schema version', async () => {
    const db = await openLocalProjectDatabase();
    expect(db.name).toBe(DB_NAME);
    expect(Array.from(db.objectStoreNames).sort()).toEqual(
      ['mediaAssets', 'mediaBlobs', 'meta', 'projects', 'scenes'].sort(),
    );
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get('schemaVersion');
    const value = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(value).toEqual({ key: 'schemaVersion', value: 1 });
    db.close();
  });

  it('rejects with an "unavailable" error when indexedDB is missing', async () => {
    const original = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    // @ts-expect-error -- deliberately simulating an environment without IndexedDB
    delete globalThis.indexedDB;
    try {
      await expect(openLocalProjectDatabase()).rejects.toMatchObject({ kind: 'unavailable' });
    } finally {
      (globalThis as { indexedDB: IDBFactory }).indexedDB = original as IDBFactory;
    }
  });

  it('treats a missing object store as corrupt data, not a silent wipe', async () => {
    // Manually build a same-name, same-version database missing one store,
    // to simulate corruption/partial-schema without going through this
    // module's own upgrade path.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('projects', { keyPath: 'id' });
        // Deliberately omit scenes/mediaAssets/mediaBlobs/meta.
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
    await expect(openLocalProjectDatabase()).rejects.toMatchObject({ kind: 'corrupt-data' });
  });

  it('treats a schema version mismatch recorded in meta as corrupt data', async () => {
    const db = await openLocalProjectDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({ key: 'schemaVersion', value: 999 });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    await expect(openLocalProjectDatabase()).rejects.toMatchObject({ kind: 'corrupt-data' });
  });

  it('creates, reads, updates, and lists projects scoped strictly by ownerId', async () => {
    const db = await openLocalProjectDatabase();
    const ownerA = 'alice';
    const ownerB = 'bob';

    const projectA = await createProject(db, { ownerId: ownerA, title: 'A project' });
    const projectB = await createProject(db, { ownerId: ownerB, title: 'B project' });

    expect(await getProject(db, ownerA, projectA.id)).toEqual(projectA);
    // Owner B can never read owner A's project, even by exact id.
    expect(await getProject(db, ownerB, projectA.id)).toBeNull();

    const aProjects = await listProjectsForOwner(db, ownerA);
    expect(aProjects.map((p) => p.id)).toEqual([projectA.id]);
    const bProjects = await listProjectsForOwner(db, ownerB);
    expect(bProjects.map((p) => p.id)).toEqual([projectB.id]);

    const updated = await updateProject(db, ownerA, projectA.id, { title: 'Renamed' });
    expect(updated.title).toBe('Renamed');
    expect(updated.updatedAt).not.toBe(projectA.updatedAt);
  });

  it('creates scenes ordered under a project, and updates them', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'alice';
    const project = await createProject(db, { ownerId, title: 'Multi-scene' });

    const sceneOne = await createScene(db, ownerId, {
      projectId: project.id,
      name: 'Scene 1',
      sceneJson: { hello: 'world' },
    });
    const sceneTwo = await createScene(db, ownerId, {
      projectId: project.id,
      name: 'Scene 2',
      sceneJson: { hello: 'again' },
    });

    expect(sceneOne.position).toBe(0);
    expect(sceneTwo.position).toBe(1);

    const refreshedProject = await getProject(db, ownerId, project.id);
    expect(refreshedProject?.sceneOrder).toEqual([sceneOne.id, sceneTwo.id]);
    expect(refreshedProject?.activeSceneId).toBe(sceneOne.id);

    const scenes = await listScenesForProject(db, project.id);
    expect(scenes.map((s) => s.id).sort()).toEqual([sceneOne.id, sceneTwo.id].sort());

    const updatedScene = await updateScene(db, sceneOne.id, { name: 'Renamed scene' });
    expect(updatedScene.name).toBe('Renamed scene');
  });

  it('deletes a project along with its scenes, media assets, and blobs', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'alice';
    const project = await createProject(db, { ownerId, title: 'To delete' });
    await createScene(db, ownerId, { projectId: project.id, name: 'S1', sceneJson: {} });
    const asset = await importMediaAsset(db, {
      projectId: project.id,
      blob: pngBlob(),
      mimeType: 'image/png',
      filename: 'a.png',
      altText: 'alt',
    });

    await deleteProject(db, ownerId, project.id);

    expect(await getProject(db, ownerId, project.id)).toBeNull();
    expect(await listScenesForProject(db, project.id)).toEqual([]);
    expect(await listMediaAssetsForProject(db, project.id)).toEqual([]);
    expect(await getMediaBlob(db, asset.id)).toBeNull();
  });

  // --- Media assets: import, dedup, refCount, quota -----------------------

  it('imports a media asset recording mime type, size, checksum, filename, alt text, and refCount', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'alice';
    const project = await createProject(db, { ownerId, title: 'Media project' });
    const blob = pngBlob(32);
    const expectedChecksum = await computeChecksum(new Uint8Array(await blob.arrayBuffer()));

    const asset = await importMediaAsset(db, {
      projectId: project.id,
      blob,
      mimeType: 'image/png',
      filename: 'photo.png',
      altText: 'A photo',
    });

    expect(asset.mimeType).toBe('image/png');
    expect(asset.byteSize).toBe(32);
    expect(asset.checksum).toBe(expectedChecksum);
    expect(asset.filename).toBe('photo.png');
    expect(asset.altText).toBe('A photo');
    expect(asset.refCount).toBe(1);
    expect(typeof asset.createdAt).toBe('string');

    const storedBlob = await getMediaBlob(db, asset.id);
    expect(storedBlob).not.toBeNull();
    expect(storedBlob?.size).toBe(32);
  });

  it('rejects an unsupported file type without touching existing project state', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'alice';
    const project = await createProject(db, { ownerId, title: 'Media project' });

    await expect(
      importMediaAsset(db, {
        projectId: project.id,
        blob: new Blob(['not media'], { type: 'application/x-msdownload' }),
        mimeType: 'application/x-msdownload',
        filename: 'virus.exe',
        altText: '',
      }),
    ).rejects.toMatchObject({ kind: 'unsupported-file-type' });

    expect(await listMediaAssetsForProject(db, project.id)).toEqual([]);
  });

  it('deduplicates re-imported assets with the same checksum, bumping refCount without duplicating the blob or the quota cost', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'alice';
    const project = await createProject(db, { ownerId, title: 'Dedup project' });
    const blob = pngBlob(64);

    const first = await importMediaAsset(db, {
      projectId: project.id,
      blob,
      mimeType: 'image/png',
      filename: 'shared.png',
      altText: 'shared image',
    });
    const second = await importMediaAsset(db, {
      projectId: project.id,
      blob: pngBlob(64), // identical bytes -> identical checksum
      mimeType: 'image/png',
      filename: 'shared-again.png',
      altText: 'shared image again',
    });

    expect(second.id).toBe(first.id);
    expect(second.refCount).toBe(2);

    const assets = await listMediaAssetsForProject(db, project.id);
    expect(assets).toHaveLength(1);

    const usage = await getProjectUsage(db, project.id);
    expect(usage.bytesUsed).toBe(64);
    expect(usage.fileCount).toBe(1);
  });

  it('increments and decrements refCount via addMediaReference/removeMediaReference, deleting the blob only at zero', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'alice';
    const project = await createProject(db, { ownerId, title: 'Ref project' });
    const asset = await importMediaAsset(db, {
      projectId: project.id,
      blob: pngBlob(10),
      mimeType: 'image/png',
      filename: 'ref.png',
      altText: '',
    });

    const bumped = await addMediaReference(db, asset.id);
    expect(bumped.refCount).toBe(2);

    await removeMediaReference(db, asset.id);
    expect((await listMediaAssetsForProject(db, project.id))[0]?.refCount).toBe(1);
    expect(await getMediaBlob(db, asset.id)).not.toBeNull();

    await removeMediaReference(db, asset.id);
    expect(await listMediaAssetsForProject(db, project.id)).toEqual([]);
    expect(await getMediaBlob(db, asset.id)).toBeNull();
  });

  it('deleting a scene decrements the refCount of media it referenced', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'alice';
    const project = await createProject(db, { ownerId, title: 'Scene ref project' });
    const scene = await createScene(db, ownerId, {
      projectId: project.id,
      name: 'S1',
      sceneJson: {},
    });
    const asset = await importMediaAsset(db, {
      projectId: project.id,
      blob: pngBlob(10),
      mimeType: 'image/png',
      filename: 'ref.png',
      altText: '',
    });

    await deleteScene(db, ownerId, project.id, scene.id, [asset.id]);

    expect(await listScenesForProject(db, project.id)).toEqual([]);
    // refCount was 1 -> deleting its only reference removes the asset+blob.
    expect(await listMediaAssetsForProject(db, project.id)).toEqual([]);
    expect(await getMediaBlob(db, asset.id)).toBeNull();
  });

  it('rejects an import once the project would exceed the 100-file quota, naming the files limit', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'alice';
    const freshProject = await createProject(db, { ownerId, title: 'File quota project' });

    // Each import gets distinct bytes (hence a distinct checksum) so none
    // of the MAX_PROJECT_FILES imports below dedup against each other.
    for (let i = 0; i < MAX_PROJECT_FILES; i += 1) {
      const bytes = new Uint8Array(4);
      bytes[0] = i % 256;
      bytes[1] = Math.floor(i / 256) % 256;
      await importMediaAsset(db, {
        projectId: freshProject.id,
        blob: new Blob([bytes], { type: 'image/png' }),
        mimeType: 'image/png',
        filename: `f${i}.png`,
        altText: '',
      });
    }

    const usageBefore = await getProjectUsage(db, freshProject.id);
    expect(usageBefore.fileCount).toBe(MAX_PROJECT_FILES);

    const overflowBytes = new Uint8Array(4);
    overflowBytes[0] = 250;
    overflowBytes[1] = 250;
    overflowBytes[2] = 250;
    await expect(
      importMediaAsset(db, {
        projectId: freshProject.id,
        blob: new Blob([overflowBytes], { type: 'image/png' }),
        mimeType: 'image/png',
        filename: 'overflow.png',
        altText: '',
      }),
    ).rejects.toMatchObject({ kind: 'quota-exceeded', limit: 'files' });

    // Last known-good state intact: still exactly MAX_PROJECT_FILES assets.
    expect(await listMediaAssetsForProject(db, freshProject.id)).toHaveLength(MAX_PROJECT_FILES);
  });

  it('rejects an import once the project would exceed the 50MB byte quota, naming the bytes limit', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'alice';
    const project = await createProject(db, { ownerId, title: 'Byte quota project' });

    // Seed the usage cache directly to just under the byte limit, rather
    // than actually writing 50MB of blobs in a unit test.
    const nearLimit = MAX_PROJECT_BYTES - 10;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({
        key: `usage:${project.id}`,
        projectId: project.id,
        bytesUsed: nearLimit,
        fileCount: 1,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await expect(
      importMediaAsset(db, {
        projectId: project.id,
        blob: pngBlob(100), // pushes bytesUsed well past MAX_PROJECT_BYTES
        mimeType: 'image/png',
        filename: 'too-big.png',
        altText: '',
      }),
    ).rejects.toMatchObject({ kind: 'quota-exceeded', limit: 'bytes' });

    // No new asset/blob was written on rejection.
    expect(await listMediaAssetsForProject(db, project.id)).toEqual([]);
  });

  it('recomputes usage from mediaAssets when the meta cache is missing or inconsistent', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'alice';
    const project = await createProject(db, { ownerId, title: 'Recompute project' });
    await importMediaAsset(db, {
      projectId: project.id,
      blob: pngBlob(20),
      mimeType: 'image/png',
      filename: 'a.png',
      altText: '',
    });

    // Corrupt the cache directly.
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).delete(`usage:${project.id}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const recomputed = await recomputeProjectUsage(db, project.id);
    expect(recomputed).toEqual({ bytesUsed: 20, fileCount: 1 });

    const usage = await getProjectUsage(db, project.id);
    expect(usage).toEqual({ bytesUsed: 20, fileCount: 1 });
  });

  // --- Persistent storage / estimate --------------------------------------

  it('reports unsupported (not falsely granted) when navigator.storage.persist is absent', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis.navigator, 'storage');
    Object.defineProperty(globalThis.navigator, 'storage', {
      value: undefined,
      configurable: true,
    });
    try {
      const result = await requestPersistentStorage();
      expect(result).toEqual({ supported: false, persisted: false });
      const estimate = await getStorageEstimate();
      expect(estimate).toEqual({ supported: false });
    } finally {
      if (original) Object.defineProperty(globalThis.navigator, 'storage', original);
    }
  });

  it('reports the real granted/denied state when navigator.storage.persist is present', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis.navigator, 'storage');
    Object.defineProperty(globalThis.navigator, 'storage', {
      value: {
        persist: async () => true,
        estimate: async () => ({ usage: 123, quota: 456 }),
      },
      configurable: true,
    });
    try {
      expect(await requestPersistentStorage()).toEqual({ supported: true, persisted: true });
      expect(await getStorageEstimate()).toEqual({ supported: true, usage: 123, quota: 456 });
    } finally {
      if (original) Object.defineProperty(globalThis.navigator, 'storage', original);
    }
  });

  it('exposes LocalRepositoryException instances with a stable, classified kind', async () => {
    const db = await openLocalProjectDatabase();
    const project = await createProject(db, { ownerId: 'alice', title: 'X' });
    try {
      await importMediaAsset(db, {
        projectId: project.id,
        blob: new Blob(['x'], { type: 'text/plain' }),
        mimeType: 'text/plain',
        filename: 'x.txt',
        altText: '',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LocalRepositoryException);
      expect((err as LocalRepositoryException).kind).toBe('unsupported-file-type');
    }
  });
});
