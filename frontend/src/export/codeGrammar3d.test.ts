import { describe, expect, it } from 'vitest';

import type { Scene3DDocument } from '../pages/scene3dTypes';
import { validateScene3D } from '../validation/scene3d';
import {
  generateEditable3dMaterials,
  generateEditable3dTransforms,
  parseEditable3dMaterials,
  parseEditable3dTransforms,
} from './codeGrammar3d';

function baseScene(): Scene3DDocument {
  return {
    schemaVersion: 1,
    documentType: 'scene3d',
    id: 'scene-3d-1',
    scene: { backgroundColor: '#101820' },
    camera: {
      position: { x: 0, y: 2, z: 8 },
      target: { x: 0, y: 0, z: 0 },
      fov: 45,
      near: 0.1,
      far: 1000,
    },
    lights: [
      {
        id: 'key',
        type: 'directional',
        color: '#ffffff',
        intensity: 2,
        direction: { x: 1, y: -1, z: 0 },
      },
    ],
    groups: [],
    objects: [
      {
        id: 'cube',
        name: 'Hero cube',
        type: 'box',
        groupId: null,
        transform: {
          position: { x: 1, y: 2, z: 3 },
          rotation: { x: 10, y: 20, z: 30 },
          scale: { x: 1, y: 2, z: 3 },
          opacity: 1,
        },
        material: { color: '#ff0000', opacity: 0.8, emissive: '#220000' },
        visible: true,
        width: 2,
        height: 2,
        depth: 2,
      },
      {
        id: 'sphere',
        type: 'sphere',
        groupId: null,
        transform: {
          position: { x: -1, y: 0, z: 4 },
          rotation: { x: 0, y: 45, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          opacity: 0.5,
        },
        material: { color: '#00ff00' },
        visible: false,
        radius: 1,
      },
    ],
    randomness: { seed: 42, enabled: true },
  };
}

describe('codeGrammar3d transform slice', () => {
  it('round-trips an unmodified scene with all transform fields', () => {
    const scene = baseScene();
    const result = parseEditable3dTransforms(generateEditable3dTransforms(scene), scene);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scene).toEqual(scene);
    expect(validateScene3D(result.scene).valid).toBe(true);
  });

  it('edits one object transform while preserving materials, lights, and other data', () => {
    const scene = baseScene();
    const text = generateEditable3dTransforms(scene).replace(
      'position = { x: 1, y: 2, z: 3 };',
      'position = { x: 9, y: 8, z: 7 };',
    );
    const result = parseEditable3dTransforms(text, scene);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scene.objects[0].transform.position).toEqual({ x: 9, y: 8, z: 7 });
    expect(result.scene.objects[0].transform.rotation).toEqual(scene.objects[0].transform.rotation);
    expect(result.scene.objects[0].material).toEqual(scene.objects[0].material);
    expect(result.scene.lights).toEqual(scene.lights);
    expect(result.scene.objects[1]).toEqual(scene.objects[1]);
  });

  it('rejects an out-of-grammar line and names the offending line', () => {
    const text = generateEditable3dTransforms(baseScene()).replace(
      '    rotation = { x: 10, y: 20, z: 30 };',
      '    material = { color: "#ffffff" };',
    );
    const result = parseEditable3dTransforms(text, baseScene());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/^Line 5:/);
    expect(result.errors[0]).toContain('rotation transform line');
  });

  it('rejects schema-invalid numeric values without a partial parse', () => {
    const scene = baseScene();
    const text = generateEditable3dTransforms(scene).replace(
      '    scale = { x: 1, y: 2, z: 3 };',
      '    scale = { x: -1, y: 2, z: 3 };',
    );
    const result = parseEditable3dTransforms(text, scene);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain('Line 6:');
    expect(result.errors[0]).toContain('must be >= 0');
  });
});

describe('codeGrammar3d material slice', () => {
  it('round-trips an unmodified scene with schema-allowlisted material fields', () => {
    const scene = baseScene();
    const result = parseEditable3dMaterials(generateEditable3dMaterials(scene), scene);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scene.objects.map(({ material }) => material)).toEqual(
      scene.objects.map(({ material }) => material),
    );
    expect(result.scene).toEqual(scene);
  });

  it('edits one material field while preserving transforms, lights, and other data', () => {
    const scene = baseScene();
    const text = generateEditable3dMaterials(scene).replace(
      '    color = "#ff0000";',
      '    color = "#0000ff";',
    );
    const result = parseEditable3dMaterials(text, scene);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scene.objects[0].material.color).toBe('#0000ff');
    expect(result.scene.objects[0].material.opacity).toBe(scene.objects[0].material.opacity);
    expect(result.scene.objects[0].transform).toEqual(scene.objects[0].transform);
    expect(result.scene.lights).toEqual(scene.lights);
    expect(result.scene.objects[1]).toEqual(scene.objects[1]);
  });

  it('rejects an out-of-grammar material value with a line-specific error', () => {
    const text = generateEditable3dMaterials(baseScene()).replace(
      '    color = "#ff0000";',
      '    color = "red";',
    );
    const result = parseEditable3dMaterials(text, baseScene());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/^Line 4:/);
    expect(result.errors[0]).toContain('color material line');
  });
});
