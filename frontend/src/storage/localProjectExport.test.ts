// See localProjectRepository.test.ts's top-of-file comment: jsdom's `Blob`
// isn't structured-cloneable by Node's native `structuredClone`, which
// fake-indexeddb relies on internally, so this file swaps in Node's own
// `Blob` for its duration -- a test-environment-only workaround.
import { Blob as NodeBlob } from 'node:buffer';
(globalThis as unknown as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob;

import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  EXPORT_FORMAT_VERSION,
  exportLocalProject,
  importLocalProject,
  type LocalProjectExportPackage,
} from './localProjectExport';
import {
  MAX_PROJECT_FILES,
  computeChecksum,
  createProject,
  createScene,
  getMediaBlob,
  getProject,
  importMediaAsset,
  listMediaAssetsForProject,
  listProjectsForOwner,
  listScenesForProject,
  openLocalProjectDatabase,
  updateScene,
} from './localProjectRepository';

function pngBlob(sizeBytes = 16, fill = 0): Blob {
  const bytes = new Uint8Array(sizeBytes);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i + fill) % 256;
  return new Blob([bytes], { type: 'image/png' });
}

describe('localProjectExport', () => {
  beforeEach(() => {
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  });

  it('exports a project with its scenes (ordered) and media assets base64-encoded', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'alice';
    const project = await createProject(db, { ownerId, title: 'Exportable' });
    const sceneTwo = await createScene(db, ownerId, {
      projectId: project.id,
      name: 'Second',
      sceneJson: { order: 2 },
    });
    const sceneOne = await createScene(db, ownerId, {
      projectId: project.id,
      name: 'First',
      sceneJson: { order: 1 },
    });
    // Force an out-of-creation-order position to prove export sorts by
    // `position`, not insertion order.
    await updateScene(db, sceneOne.id, { position: 0 });
    await updateScene(db, sceneTwo.id, { position: 1 });

    const asset = await importMediaAsset(db, {
      projectId: project.id,
      blob: pngBlob(24, 5),
      mimeType: 'image/png',
      filename: 'pic.png',
      altText: 'A picture',
    });

    const pkg = await exportLocalProject(db, ownerId, project.id);

    expect(pkg.formatVersion).toBe(EXPORT_FORMAT_VERSION);
    expect(pkg.project.title).toBe('Exportable');
    expect(pkg.scenes.map((s) => s.name)).toEqual(['First', 'Second']);
    expect(pkg.mediaAssets).toHaveLength(1);
    expect(pkg.mediaAssets[0].checksum).toBe(asset.checksum);
    expect(pkg.mediaAssets[0].filename).toBe('pic.png');
    expect(pkg.mediaAssets[0].altText).toBe('A picture');
    expect(typeof pkg.mediaAssets[0].dataBase64).toBe('string');
    // Roundtrip sanity: decoding the base64 gives back bytes of the right length.
    const decoded = atob(pkg.mediaAssets[0].dataBase64);
    expect(decoded.length).toBe(24);
  });

  it('imports an exported package into a brand-new project with fresh, collision-safe UUIDs', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'alice';
    const original = await createProject(db, { ownerId, title: 'Original' });
    const scene = await createScene(db, ownerId, {
      projectId: original.id,
      name: 'Only scene',
      sceneJson: { shapes: [] },
    });
    const asset = await importMediaAsset(db, {
      projectId: original.id,
      blob: pngBlob(16),
      mimeType: 'image/png',
      filename: 'shared.png',
      altText: 'shared',
    });

    const pkg = await exportLocalProject(db, ownerId, original.id);
    const result = await importLocalProject(db, ownerId, pkg);

    expect(result.project.id).not.toBe(original.id);
    expect(result.scenes[0].id).not.toBe(scene.id);
    expect(result.mediaAssets[0].id).not.toBe(asset.id);
    expect(result.project.title).toBe('Original');
    expect(result.scenes[0].name).toBe('Only scene');
    expect(result.mediaAssets[0].checksum).toBe(asset.checksum);

    // Both the original and the imported copy now coexist independently.
    const projects = await listProjectsForOwner(db, ownerId);
    expect(projects.map((p) => p.id).sort()).toEqual([original.id, result.project.id].sort());

    const importedScenes = await listScenesForProject(db, result.project.id);
    expect(importedScenes).toHaveLength(1);
    const importedAssets = await listMediaAssetsForProject(db, result.project.id);
    expect(importedAssets).toHaveLength(1);
    const importedBlob = await getMediaBlob(db, result.mediaAssets[0].id);
    expect(importedBlob?.size).toBe(16);

    // Importing twice from the same package produces a second, independent
    // project rather than colliding with the first import.
    const secondImport = await importLocalProject(db, ownerId, pkg);
    expect(secondImport.project.id).not.toBe(result.project.id);
    expect(secondImport.mediaAssets[0].id).not.toBe(result.mediaAssets[0].id);
  });

  it('rejects an unrecognized formatVersion atomically, creating no project', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'alice';
    const badPackage = { formatVersion: 99, project: { title: 'x' }, scenes: [], mediaAssets: [] };

    await expect(importLocalProject(db, ownerId, badPackage)).rejects.toMatchObject({
      kind: 'corrupt-data',
    });
    expect(await listProjectsForOwner(db, ownerId)).toEqual([]);
  });

  it('rejects a package with a tampered checksum atomically, creating no project', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'alice';
    const project = await createProject(db, { ownerId, title: 'Tamper source' });
    await importMediaAsset(db, {
      projectId: project.id,
      blob: pngBlob(16),
      mimeType: 'image/png',
      filename: 'a.png',
      altText: '',
    });
    const pkg = await exportLocalProject(db, ownerId, project.id);
    const tampered: LocalProjectExportPackage = {
      ...pkg,
      mediaAssets: [{ ...pkg.mediaAssets[0], checksum: 'deadbeef'.repeat(8) }],
    };

    await expect(importLocalProject(db, ownerId, tampered)).rejects.toMatchObject({
      kind: 'corrupt-data',
    });

    // Atomic: the whole import (including the project row and any other
    // scenes/assets already committed) never lands -- only the pre-existing
    // "Tamper source" project remains.
    const projects = await listProjectsForOwner(db, ownerId);
    expect(projects.map((p) => p.title)).toEqual(['Tamper source']);
  });

  it('rejects a structurally malformed package (missing scenes array) atomically', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'alice';
    const malformed = { formatVersion: 1, project: { title: 'x' }, mediaAssets: [] };

    await expect(importLocalProject(db, ownerId, malformed)).rejects.toMatchObject({
      kind: 'corrupt-data',
    });
    expect(await listProjectsForOwner(db, ownerId)).toEqual([]);
  });

  it('rejects an import that would exceed the 100-file quota, naming the files limit, atomically', async () => {
    const db = await openLocalProjectDatabase();
    const ownerId = 'alice';
    const overflowPackage: LocalProjectExportPackage = {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      project: { title: 'Too many files' },
      scenes: [],
      mediaAssets: Array.from({ length: MAX_PROJECT_FILES + 1 }, (_, i) => ({
        mimeType: 'image/png',
        byteSize: 1,
        checksum: 'x'.repeat(64),
        filename: `f${i}.png`,
        altText: '',
        dataBase64: btoa('A'),
      })),
    };
    // Fix up checksums so the byteSize/checksum are self-consistent
    // (btoa('A') decodes back to the single byte 'A', matching byteSize: 1).
    const decodedByte = new Uint8Array([atob(btoa('A')).charCodeAt(0)]);
    const realChecksum = await computeChecksum(decodedByte);
    overflowPackage.mediaAssets = overflowPackage.mediaAssets.map((a) => ({
      ...a,
      checksum: realChecksum,
    }));

    await expect(importLocalProject(db, ownerId, overflowPackage)).rejects.toMatchObject({
      kind: 'quota-exceeded',
      limit: 'files',
    });
    expect(await listProjectsForOwner(db, ownerId)).toEqual([]);
  });

  it('rejects importing for a project id belonging to a different owner during export', async () => {
    const db = await openLocalProjectDatabase();
    const project = await createProject(db, { ownerId: 'alice', title: 'Alice project' });

    await expect(exportLocalProject(db, 'bob', project.id)).rejects.toMatchObject({
      kind: 'corrupt-data',
    });
  });

  it('sanity: a project fetched after import is retrievable and scoped to the importing owner', async () => {
    const db = await openLocalProjectDatabase();
    const project = await createProject(db, { ownerId: 'alice', title: 'For import' });
    await createScene(db, 'alice', { projectId: project.id, name: 'S', sceneJson: {} });
    const pkg = await exportLocalProject(db, 'alice', project.id);

    const result = await importLocalProject(db, 'bob', pkg);
    expect(await getProject(db, 'bob', result.project.id)).not.toBeNull();
    expect(await getProject(db, 'alice', result.project.id)).toBeNull();
  });
});
