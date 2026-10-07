import { describe, expect, it, vi } from 'vitest';

import {
  buildLocal2dPiecePackage,
  measureLocalPiecePackage,
  measureLocalPiecePackageContent,
} from './localPiecePackage';

const repository = vi.hoisted(() => ({
  getMediaBlob: vi.fn(),
  getProject: vi.fn(),
  listMediaAssetsForProject: vi.fn(),
  listScenesForProject: vi.fn(),
  listPieceVersions: vi.fn(),
}));

const packageModule = {
  buildPiecePackage: vi.fn(async () => new Uint8Array([1, 2, 3])),
  parsePiecePackage: vi.fn(async () => undefined),
};

vi.mock('./localProjectRepository', () => repository);

const scene = {
  schemaVersion: 1,
  id: 'scene-1',
  canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
  renderer: { preferred: 'p5' },
  layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
  shapes: [],
  groups: [],
  bindings: [],
  graph: { nodes: [], connections: [] },
  accessibility: { reducedMotion: 'auto' },
  randomness: { seed: 0, enabled: false },
};

describe('local piece package export', () => {
  it('loads the bundled package module for a local 2D export', async () => {
    repository.getProject.mockResolvedValue({ id: 'p1', title: 'Bundled package' });
    repository.listScenesForProject.mockResolvedValue([
      { id: 's1', name: 'Scene 1', position: 0, sceneJson: scene },
    ]);
    repository.listMediaAssetsForProject.mockResolvedValue([]);

    const result = await buildLocal2dPiecePackage({} as IDBDatabase, 'alice', 'p1');

    expect(result.bytes[0]).toBe(0x50);
    expect(result.bytes[1]).toBe(0x4b);
    expect(result.missingAssets).toEqual([]);
  });

  it('builds one checksum-verifiable 2D package without changing local records', async () => {
    repository.getProject.mockResolvedValue({ id: 'p1', title: 'My / Piece' });
    repository.listScenesForProject.mockResolvedValue([
      { id: 's1', name: 'Scene 1', position: 0, sceneJson: scene },
    ]);
    repository.listMediaAssetsForProject.mockResolvedValue([
      {
        id: 'asset-1',
        filename: 'dot.png',
        altText: 'Dot',
        mimeType: 'image/png',
      },
    ]);
    repository.getMediaBlob.mockResolvedValue(
      new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
    );

    const result = await buildLocal2dPiecePackage({} as IDBDatabase, 'alice', 'p1', packageModule);

    expect(result.missingAssets).toEqual([]);
    expect(result.pieceBytes).toBe(new TextEncoder().encode(JSON.stringify(scene)).byteLength);
    expect(result.mediaBytes).toBe(3);
    expect(result.mediaFiles).toBe(1);
    expect(packageModule.buildPiecePackage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: '2d', title: 'My / Piece' }),
    );
    expect(packageModule.parsePiecePackage).toHaveBeenCalledWith(result.bytes);
  });

  it('measures UTF-8 record payload bytes and each included media blob once', () => {
    const records = [{ data: { label: '雪' } }, { data: { count: 2 } }];
    const mediaByteSizes = [3, 5];
    const recordBytes = records.reduce(
      (total, record) => total + new TextEncoder().encode(JSON.stringify(record.data)).byteLength,
      0,
    );

    expect(measureLocalPiecePackageContent(records, mediaByteSizes)).toEqual({
      pieceBytes: recordBytes,
      mediaBytes: 8,
      mediaFiles: 2,
    });
    expect(recordBytes).toBeGreaterThan(
      records.reduce((sum, record) => sum + JSON.stringify(record.data).length, 0),
    );
  });

  it('measures local piece content without reading blob bytes or building a ZIP', async () => {
    repository.getProject.mockResolvedValue({ id: 'p1', title: 'Measure only' });
    repository.listScenesForProject.mockResolvedValue([
      { id: 's1', name: 'Scene 1', position: 0, sceneJson: { label: '雪' } },
    ]);
    repository.listMediaAssetsForProject.mockResolvedValue([
      { id: 'asset-1', filename: 'audio.wav', altText: '', mimeType: 'audio/wav' },
    ]);
    const blob = { size: 5, arrayBuffer: vi.fn() } as unknown as Blob;
    repository.getMediaBlob.mockResolvedValue(blob);
    packageModule.buildPiecePackage.mockClear();

    const result = await measureLocalPiecePackage({} as IDBDatabase, 'alice', 'p1');

    expect(result).toEqual({
      pieceBytes: new TextEncoder().encode('{"label":"雪"}').byteLength,
      mediaBytes: 5,
      mediaFiles: 1,
      missingAssets: [],
    });
    expect(blob.arrayBuffer).not.toHaveBeenCalled();
    expect(packageModule.buildPiecePackage).not.toHaveBeenCalled();
  });

  it('reports missing media without mutating or hiding the rest of the package', async () => {
    repository.getProject.mockResolvedValue({ id: 'p1', title: 'Missing media' });
    repository.listScenesForProject.mockResolvedValue([
      { id: 's1', name: 'Scene 1', position: 0, sceneJson: scene },
    ]);
    repository.listMediaAssetsForProject.mockResolvedValue([
      { id: 'asset-1', filename: 'missing.png', altText: '', mimeType: 'image/png' },
    ]);
    repository.getMediaBlob.mockResolvedValue(null);

    const result = await buildLocal2dPiecePackage({} as IDBDatabase, 'alice', 'p1', packageModule);
    expect(result.missingAssets.map((asset) => asset.filename)).toEqual(['missing.png']);
    expect(packageModule.parsePiecePackage).toHaveBeenCalledWith(result.bytes);
  });
});
