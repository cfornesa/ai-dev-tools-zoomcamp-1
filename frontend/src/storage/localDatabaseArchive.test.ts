// See localProjectRepository.test.ts's top-of-file comment: jsdom's `Blob`
// isn't structured-cloneable by Node's native `structuredClone`, which
// fake-indexeddb relies on internally, so this file swaps in Node's own
// `Blob` for its duration -- a test-environment-only workaround.
import { Blob as NodeBlob } from 'node:buffer';
(globalThis as unknown as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob;

import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  ARCHIVE_FORMAT_VERSION,
  exportDatabaseArchive,
  restoreDatabaseArchive,
} from './localDatabaseArchive';
import {
  LocalRepositoryException,
  createProject,
  createScene,
  importMediaAsset,
  listMediaAssetsForProject,
  listProjectsForOwner,
  listScenesForProject,
  openLocalProjectDatabase,
} from './localProjectRepository';

function pngBytes(fill = 0): Uint8Array {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i + fill) % 256;
  return bytes;
}

beforeEach(() => {
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('exportDatabaseArchive', () => {
  it('exports every project for the owner with real scene/media files at safe paths', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'alice';
    const projectA = await createProject(db, { ownerId, title: 'Project A' });
    await createScene(db, ownerId, {
      projectId: projectA.id,
      name: 'Scene 1',
      sceneJson: { a: 1 },
    });
    await importMediaAsset(db, {
      projectId: projectA.id,
      blob: new Blob([pngBytes() as BlobPart], { type: 'image/png' }),
      mimeType: 'image/png',
      filename: 'pic.png',
      altText: 'a picture',
    });
    const projectB = await createProject(db, { ownerId, title: 'Project B' });
    await createScene(db, ownerId, {
      projectId: projectB.id,
      name: 'Scene 2',
      sceneJson: { b: 2 },
    });

    const result = await exportDatabaseArchive(db, ownerId);

    expect(result.projectCount).toBe(2);
    expect(result.sceneCount).toBe(2);
    expect(result.mediaFileCount).toBe(1);
    expect(result.byteTotal).toBe(16);

    const zipBytes = new Uint8Array(await result.blob.arrayBuffer());
    const entries = unzipSync(zipBytes);
    const paths = Object.keys(entries).sort();
    // `listProjectsForOwner` doesn't guarantee project A's ordering
    // relative to project B, so assert on the *shape* of the paths
    // (safe indices, never a raw filename/title) rather than which
    // project index landed where.
    expect(paths).toHaveLength(4);
    expect(paths).toContain('manifest.json');
    expect(paths.filter((p) => /^projects\/\d+\/scenes\/0\.json$/.test(p))).toHaveLength(2);
    expect(paths.filter((p) => /^projects\/\d+\/media\/0\.png$/.test(p))).toHaveLength(1);
    const manifest = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
    expect(manifest.formatVersion).toBe(ARCHIVE_FORMAT_VERSION);
    expect(manifest.projects).toHaveLength(2);
    const withMedia = manifest.projects.find(
      (p: { mediaAssets: unknown[] }) => p.mediaAssets.length > 0,
    );
    expect(withMedia.title).toBe('Project A');
  });

  it('exports only the selected projects when projectIds is given', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'bob';
    const projectA = await createProject(db, { ownerId, title: 'Keep' });
    const projectB = await createProject(db, { ownerId, title: 'Skip' });

    const result = await exportDatabaseArchive(db, ownerId, { projectIds: [projectA.id] });

    expect(result.projectCount).toBe(1);
    const zipBytes = new Uint8Array(await result.blob.arrayBuffer());
    const manifest = JSON.parse(new TextDecoder().decode(unzipSync(zipBytes)['manifest.json']));
    expect(manifest.projects[0].title).toBe('Keep');
    void projectB;
  });

  it('rejects export of a project id that does not belong to this owner', async () => {
    const db = await openLocalProjectDatabase();
    await expect(
      exportDatabaseArchive(db, 'carol', { projectIds: ['does-not-exist'] }),
    ).rejects.toBeInstanceOf(LocalRepositoryException);
  });
});

describe('restoreDatabaseArchive', () => {
  async function exportedZipBytes(ownerId: string, title = 'Original') {
    const db = await openLocalProjectDatabase();
    const project = await createProject(db, { ownerId, title });
    await createScene(db, ownerId, {
      projectId: project.id,
      name: 'Scene 1',
      sceneJson: { shapes: [] },
    });
    await importMediaAsset(db, {
      projectId: project.id,
      blob: new Blob([pngBytes(1) as BlobPart], { type: 'image/png' }),
      mimeType: 'image/png',
      filename: 'a.png',
      altText: '',
    });
    const result = await exportDatabaseArchive(db, ownerId);
    db.close();
    return new Uint8Array(await result.blob.arrayBuffer());
  }

  it('restores projects/scenes/media with fresh ids into the same database', async () => {
    const zipBytes = await exportedZipBytes('dave');
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    const db = await openLocalProjectDatabase();

    const result = await restoreDatabaseArchive(db, 'dave', zipBytes);

    expect(result.projectCount).toBe(1);
    expect(result.sceneCount).toBe(1);
    expect(result.mediaFileCount).toBe(1);
    const projects = await listProjectsForOwner(db, 'dave');
    expect(projects).toHaveLength(1);
    expect(projects[0].title).toBe('Original');
    expect(projects[0].id).not.toBe('');
    const scenes = await listScenesForProject(db, projects[0].id);
    expect(scenes).toHaveLength(1);
    expect(scenes[0].sceneJson).toEqual({ shapes: [] });
    const assets = await listMediaAssetsForProject(db, projects[0].id);
    expect(assets).toHaveLength(1);
  });

  it('generates a new project id even when restoring into a database with the original data', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'erin';
    const original = await createProject(db, { ownerId, title: 'Mine' });
    await createScene(db, ownerId, {
      projectId: original.id,
      name: 'S1',
      sceneJson: {},
    });
    const exported = await exportDatabaseArchive(db, ownerId);
    const zipBytes = new Uint8Array(await exported.blob.arrayBuffer());

    await restoreDatabaseArchive(db, ownerId, zipBytes);

    const projects = await listProjectsForOwner(db, ownerId);
    expect(projects).toHaveLength(2);
    expect(new Set(projects.map((p) => p.id)).size).toBe(2);
  });

  it('rejects the whole restore atomically when a checksum does not match, creating no project', async () => {
    const zipBytes = await exportedZipBytes('frank');
    const entries = unzipSync(zipBytes);
    entries['projects/0/media/0.png'] = new Uint8Array([9, 9, 9]); // tampered
    const tampered = zipSync(entries, { level: 0 });

    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    const db = await openLocalProjectDatabase();

    await expect(restoreDatabaseArchive(db, 'frank', tampered)).rejects.toBeInstanceOf(
      LocalRepositoryException,
    );
    expect(await listProjectsForOwner(db, 'frank')).toHaveLength(0);
  });

  it('rejects a manifest with an unrecognized format version', async () => {
    const zip = zipSync(
      { 'manifest.json': strToU8(JSON.stringify({ formatVersion: 999, projects: [] })) },
      { level: 0 },
    );
    const db = await openLocalProjectDatabase();
    await expect(restoreDatabaseArchive(db, 'gina', zip)).rejects.toBeInstanceOf(
      LocalRepositoryException,
    );
  });

  it('rejects a ZIP missing manifest.json', async () => {
    const zip = zipSync({ 'not-manifest.txt': strToU8('hi') }, { level: 0 });
    const db = await openLocalProjectDatabase();
    await expect(restoreDatabaseArchive(db, 'henry', zip)).rejects.toBeInstanceOf(
      LocalRepositoryException,
    );
  });

  it('rejects bytes that are not a valid ZIP at all', async () => {
    const db = await openLocalProjectDatabase();
    await expect(
      restoreDatabaseArchive(db, 'iris', new Uint8Array([1, 2, 3, 4])),
    ).rejects.toBeInstanceOf(LocalRepositoryException);
  });

  it('rejects a manifest referencing a scene file that is missing from the archive', async () => {
    const manifest = {
      formatVersion: ARCHIVE_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      databaseName: 'x',
      databaseVersion: 1,
      projects: [
        { index: 0, title: 'P', scenes: [{ index: 0, name: 'S', position: 0 }], mediaAssets: [] },
      ],
    };
    const zip = zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)) }, { level: 0 });
    const db = await openLocalProjectDatabase();
    await expect(restoreDatabaseArchive(db, 'jack', zip)).rejects.toBeInstanceOf(
      LocalRepositoryException,
    );
    expect(await listProjectsForOwner(db, 'jack')).toHaveLength(0);
  });
});
