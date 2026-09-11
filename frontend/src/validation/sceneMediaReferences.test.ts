// See localProjectRepository.test.ts's identical header comment: jsdom's
// Blob isn't structured-cloneable by Node's structuredClone, which
// fake-indexeddb relies on -- swap in Node's Blob for this file only.
import { Blob as NodeBlob } from 'node:buffer';
(globalThis as unknown as { Blob: typeof Blob }).Blob = NodeBlob as unknown as typeof Blob;

import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  createProject,
  importMediaAsset,
  openLocalProjectDatabase,
  removeMediaReference,
} from '../storage/localProjectRepository';
import { checkImageMediaReferences } from './scene';

function pngBlob(): Blob {
  return new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
}

function sceneWithImageShape(mediaAssetId: string) {
  return {
    schemaVersion: 1,
    id: 'scene-1',
    canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
    renderer: { preferred: 'canvas2d' },
    layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
    shapes: [
      {
        id: 'shape-1',
        type: 'image',
        layerId: 'layer-1',
        groupId: null,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        style: { fill: null, stroke: null, strokeWidth: 0 },
        mediaAssetId,
        altText: 'A description.',
      },
    ],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
  };
}

/** Issue #508: this suite is the frontend-only companion to
 * `scenes/validation.py`'s schema-level-only image-shape checks -- it
 * asserts the four distinct rejection rules (`missingMediaAsset`,
 * `crossProjectMediaAsset`, `deletedMediaAsset`, `unsupportedMediaAssetType`)
 * `checkImageMediaReferences` reports against #512's real local
 * repository (`fake-indexeddb`), not a mock. */
describe('checkImageMediaReferences', () => {
  beforeEach(() => {
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  });

  it('accepts a scene referencing a real asset in the current project', async () => {
    const db = await openLocalProjectDatabase();
    const project = await createProject(db, { ownerId: 'alice', title: 'P' });
    const asset = await importMediaAsset(db, {
      projectId: project.id,
      blob: pngBlob(),
      mimeType: 'image/png',
      filename: 'a.png',
      altText: 'A photo',
    });

    const errors = await checkImageMediaReferences(sceneWithImageShape(asset.id), {
      db,
      projectId: project.id,
    });
    expect(errors).toEqual([]);
  });

  it('allows one asset to be referenced by two different scenes in the same project', async () => {
    const db = await openLocalProjectDatabase();
    const project = await createProject(db, { ownerId: 'alice', title: 'P' });
    const asset = await importMediaAsset(db, {
      projectId: project.id,
      blob: pngBlob(),
      mimeType: 'image/png',
      filename: 'a.png',
      altText: 'A photo',
    });

    const sceneA = sceneWithImageShape(asset.id);
    const sceneB = { ...sceneWithImageShape(asset.id), id: 'scene-2' };
    const errorsA = await checkImageMediaReferences(sceneA, { db, projectId: project.id });
    const errorsB = await checkImageMediaReferences(sceneB, { db, projectId: project.id });
    expect(errorsA).toEqual([]);
    expect(errorsB).toEqual([]);
  });

  it('rejects a mediaAssetId that has never been imported anywhere as missingMediaAsset', async () => {
    const db = await openLocalProjectDatabase();
    const project = await createProject(db, { ownerId: 'alice', title: 'P' });

    const errors = await checkImageMediaReferences(sceneWithImageShape('nonexistent-asset'), {
      db,
      projectId: project.id,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].rule).toBe('missingMediaAsset');
  });

  it('rejects a mediaAssetId belonging to a different project as crossProjectMediaAsset', async () => {
    const db = await openLocalProjectDatabase();
    const projectA = await createProject(db, { ownerId: 'alice', title: 'A' });
    const projectB = await createProject(db, { ownerId: 'alice', title: 'B' });
    const asset = await importMediaAsset(db, {
      projectId: projectA.id,
      blob: pngBlob(),
      mimeType: 'image/png',
      filename: 'a.png',
      altText: 'A photo',
    });

    const errors = await checkImageMediaReferences(sceneWithImageShape(asset.id), {
      db,
      projectId: projectB.id,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].rule).toBe('crossProjectMediaAsset');
  });

  it('rejects an unsupported mimeType as unsupportedMediaAssetType', async () => {
    const db = await openLocalProjectDatabase();
    const project = await createProject(db, { ownerId: 'alice', title: 'P' });
    const asset = await importMediaAsset(db, {
      projectId: project.id,
      blob: pngBlob(),
      mimeType: 'image/svg+xml',
      filename: 'a.svg',
      altText: 'A vector',
    });

    // Simulate a previously-supported type becoming unsupported by writing
    // an asset row directly with a mimeType outside the allowlist -- more
    // direct than trying to import an actually-disallowed file (importMediaAsset
    // itself already rejects that at import time).
    const tx = db.transaction('mediaAssets', 'readwrite');
    tx.objectStore('mediaAssets').put({ ...asset, mimeType: 'application/pdf' });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    const errors = await checkImageMediaReferences(sceneWithImageShape(asset.id), {
      db,
      projectId: project.id,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].rule).toBe('unsupportedMediaAssetType');
  });

  it('rejects a removed asset as deletedMediaAsset when the caller knows it existed before', async () => {
    const db = await openLocalProjectDatabase();
    const project = await createProject(db, { ownerId: 'alice', title: 'P' });
    const asset = await importMediaAsset(db, {
      projectId: project.id,
      blob: pngBlob(),
      mimeType: 'image/png',
      filename: 'a.png',
      altText: 'A photo',
    });
    await removeMediaReference(db, asset.id); // refCount 1 -> 0: rows deleted

    const errors = await checkImageMediaReferences(sceneWithImageShape(asset.id), {
      db,
      projectId: project.id,
      previouslyKnownAssetIds: new Set([asset.id]),
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].rule).toBe('deletedMediaAsset');
  });

  it('returns no errors for a scene with no image shapes', async () => {
    const db = await openLocalProjectDatabase();
    const project = await createProject(db, { ownerId: 'alice', title: 'P' });
    const scene = sceneWithImageShape('unused');
    scene.shapes = [];
    const errors = await checkImageMediaReferences(scene, { db, projectId: project.id });
    expect(errors).toEqual([]);
  });
});
