import { Blob as NodeBlob } from 'node:buffer';

(globalThis as unknown as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob;

import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { unzipSync, zipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';

import blank2d from '../../../schema/fixtures/valid/blank.json';
import blank3d from '../../../schema/fixtures3d/valid/renderer_threejs.json';
import { buildPiecePackage } from './piecePackage';
import { importLocalPiecePackage } from './localPiecePackageImport';
import {
  getMediaBlob,
  listMediaAssetsForProject,
  listProjectsForOwner,
  listScenesForProject,
  openLocalProjectDatabase,
} from './localProjectRepository';

describe('importLocalPiecePackage', () => {
  beforeEach(() => {
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  });

  it('imports a validated 2D package with fresh ids and preserved records/media', async () => {
    const db = await openLocalProjectDatabase();
    const bytes = await buildPiecePackage({
      kind: '2d',
      title: 'Portable 2D piece',
      description: 'Description is validated before import.',
      appVersion: 'test',
      records: [
        { schemaVersion: 1, data: blank2d },
        { schemaVersion: 1, data: { ...blank2d, id: 'second-record' } },
      ],
      mediaAssets: [
        {
          filename: 'dot.png',
          altText: 'A dot',
          mimeType: 'image/png',
          bytes: new Uint8Array([1, 2, 3]),
        },
      ],
    });

    const result = await importLocalPiecePackage(db, 'alice', bytes);
    expect(result.project.title).toBe('Portable 2D piece');
    expect(result.project.kind).toBe('2d');
    expect(result.scenes.map((scene) => scene.position)).toEqual([0, 1]);
    expect(result.scenes.map((scene) => scene.name)).toEqual(['Version 1', 'Version 2']);
    expect(result.mediaAssets).toHaveLength(1);
    expect(
      new Uint8Array(await (await getMediaBlob(db, result.mediaAssets[0].id))!.arrayBuffer()),
    ).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.project.id).not.toBe(result.scenes[0].id);

    const projects = await listProjectsForOwner(db, 'alice');
    expect(projects).toHaveLength(1);
    expect(await listScenesForProject(db, result.project.id)).toHaveLength(2);
    expect(await listMediaAssetsForProject(db, result.project.id)).toHaveLength(1);
  });

  it('imports 3D packages with a current scene and fresh version history', async () => {
    const db = await openLocalProjectDatabase();
    const bytes = await buildPiecePackage({
      kind: '3d',
      title: 'Portable 3D package',
      description: '',
      appVersion: 'test',
      records: [
        { schemaVersion: 1, data: blank3d },
        {
          schemaVersion: 1,
          data: { ...blank3d, scene: { ...blank3d.scene, backgroundColor: '#112233' } },
        },
      ],
    });
    const result = await importLocalPiecePackage(db, 'alice', bytes);
    expect(result.project.kind).toBe('3d');
    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0].sceneJson).toEqual({
      ...blank3d,
      scene: { ...blank3d.scene, backgroundColor: '#112233' },
    });
    expect(result.versions.map((version) => version.sequence)).toEqual([1, 2]);
    expect(result.project.currentVersionId).toBe(result.versions[1].id);
    expect((await listProjectsForOwner(db, 'alice')).map((project) => project.kind)).toEqual([
      '3d',
    ]);
  });

  it('imports generated packages as local-only versioned source', async () => {
    const db = await openLocalProjectDatabase();
    const bytes = await buildPiecePackage({
      kind: 'generated',
      title: 'generated package',
      description: '',
      appVersion: 'test',
      records: [{ schemaVersion: 1, data: { source: '<svg/>', engine: 'svg' } }],
      source: { source: '<svg/>', engine: 'svg' },
      capabilities: { screenshot: true },
    });
    const result = await importLocalPiecePackage(db, 'alice', bytes);
    expect(result.project.kind).toBe('generated');
    expect(result.versions).toHaveLength(1);
    expect(result.project.currentVersionId).toBe(result.versions[0].id);
    expect(result.scenes[0].sceneJson).toMatchObject({ source: '<svg/>', engine: 'svg' });
  });

  it('rejects a package containing an unsafe extra file before writing', async () => {
    const db = await openLocalProjectDatabase();
    const safeBytes = await buildPiecePackage({
      kind: '2d',
      title: 'Safe package',
      description: '',
      appVersion: 'test',
      records: [{ schemaVersion: 1, data: blank2d }],
    });
    const entries = unzipSync(safeBytes);
    entries['script.js'] = new Uint8Array([1, 2, 3]);
    const bytes = zipSync(entries, { level: 0 });
    await expect(importLocalPiecePackage(db, 'alice', bytes)).rejects.toMatchObject({
      kind: 'corrupt-data',
    });
    expect(await listProjectsForOwner(db, 'alice')).toEqual([]);
  });
});
