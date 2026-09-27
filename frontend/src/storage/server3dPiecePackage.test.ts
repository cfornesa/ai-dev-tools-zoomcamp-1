import { describe, expect, it } from 'vitest';

import type { Project3D, SceneVersion3D } from '../api/projects3d';
import { parsePiecePackage } from './piecePackage';
import { buildServer3dPiecePackage, server3dPackageFilename } from './server3dPiecePackage';

const scene = (id: string): SceneVersion3D => ({
  id: Number(id),
  sequence: Number(id),
  origin: 'manual',
  scene_json: {
    schemaVersion: 1,
    id,
    documentType: 'scene3d',
    scene: { backgroundColor: '#101018' },
    camera: {
      position: { x: 0, y: 5, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
      near: 0.1,
      far: 1000,
    },
    lights: [],
    renderer: { preferred: 'threejs' },
    objects: [],
    groups: [],
    randomness: { seed: 1, enabled: false },
  },
  created_by: 'owner',
  created_at: '2026-09-27T00:00:00Z',
});

describe('server 3D piece package', () => {
  it('preserves ordered valid scene history and sanitizes its filename', async () => {
    const versions = [scene('2'), scene('1')];
    const project = {
      title: 'Serene 3D Scene',
      visibility: 'private',
      current_version: versions[0],
    } as Project3D;
    expect(server3dPackageFilename(' Serene / 3D Scene ')).toBe('serene-3d-scene-package.zip');
    const result = await buildServer3dPiecePackage(project, versions);
    const parsed = await parsePiecePackage(result.bytes);
    expect(parsed.kind).toBe('3d');
    expect(parsed.records.map((record) => record.data.id)).toEqual(['1', '2']);
    expect(parsed.source).toMatchObject({ currentVersionId: 2 });
    expect(result.missingAssets).toEqual([]);
  });
});
