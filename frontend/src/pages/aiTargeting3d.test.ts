import { describe, expect, it } from 'vitest';

import type { Scene3DDocument } from './scene3dTypes';
import { build3DAITargetOptions } from './aiTargeting3d';

const SCENE = {
  schemaVersion: 1,
  documentType: 'scene3d',
  id: 'scene-3d',
  scene: { backgroundColor: '#000000' },
  camera: {
    position: { x: 0, y: 0, z: 5 },
    target: { x: 0, y: 0, z: 0 },
    fov: 60,
    near: 0.1,
    far: 100,
  },
  lights: [{ id: 'light-key', name: 'Key light', type: 'point', color: '#fff', intensity: 1 }],
  groups: [
    {
      id: 'group-rig',
      name: 'Rig',
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        opacity: 1,
      },
      visible: true,
      locked: false,
    },
  ],
  objects: [
    {
      id: 'object-cube',
      name: 'Cube',
      type: 'box',
      groupId: 'group-rig',
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        opacity: 1,
      },
      material: { color: '#fff' },
      visible: true,
    },
    {
      id: 'object-cone',
      name: 'Cone',
      type: 'cylinder',
      groupId: null,
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        opacity: 1,
      },
      material: { color: '#fff' },
      visible: true,
    },
  ],
  randomness: { seed: 0, enabled: false },
} as unknown as Scene3DDocument;

describe('3D AI target options', () => {
  it('lists grouped objects, lights, camera, and materials with stable IDs', () => {
    const options = build3DAITargetOptions(SCENE);
    expect(options.find((option) => option.id === 'group-rig')).toMatchObject({
      category: 'Groups',
      descendantIds: ['group-rig', 'object-cube'],
    });
    expect(options.find((option) => option.label === 'Key light')).toMatchObject({ type: 'light' });
    expect(options.find((option) => option.id === 'camera')).toMatchObject({ type: 'camera' });
    expect(options.find((option) => option.id === 'material:object-cube')).toMatchObject({
      type: 'material',
    });
  });

  it('marks locked groups and their objects unavailable', () => {
    const options = build3DAITargetOptions({
      ...SCENE,
      groups: SCENE.groups.map((group) => ({ ...group, locked: true })),
    });
    expect(options.find((option) => option.id === 'group-rig')).toMatchObject({ disabled: true });
    expect(options.find((option) => option.id === 'object-cube')).toMatchObject({ disabled: true });
  });
});
