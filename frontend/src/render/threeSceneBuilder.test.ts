import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { Scene3DDocument } from '../pages/scene3dTypes';
import { buildThreeSceneGraph, disposeThreeSceneGraph } from './threeSceneBuilder';

function baseScene(overrides: Partial<Scene3DDocument> = {}): Scene3DDocument {
  return {
    schemaVersion: 1,
    documentType: 'scene3d',
    id: 'scene3d-test',
    scene: { backgroundColor: '#101018' },
    camera: {
      position: { x: 0, y: 0, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
      near: 0.1,
      far: 1000,
    },
    lights: [],
    groups: [],
    objects: [],
    randomness: { seed: 1, enabled: false },
    ...overrides,
  };
}

const identityTransform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  opacity: 1,
};

describe('buildThreeSceneGraph: camera', () => {
  it('places the camera at the document position, aimed at the target, with matching fov/near/far', () => {
    const scene = baseScene({
      camera: {
        position: { x: 5, y: 6, z: 12 },
        target: { x: 1, y: 2, z: 3 },
        fov: 60,
        near: 0.5,
        far: 500,
      },
    });

    const { camera } = buildThreeSceneGraph(scene, 4 / 3);

    expect(camera.position.x).toBeCloseTo(5);
    expect(camera.position.y).toBeCloseTo(6);
    expect(camera.position.z).toBeCloseTo(12);
    expect(camera.fov).toBe(60);
    expect(camera.near).toBe(0.5);
    expect(camera.far).toBe(500);
    expect(camera.aspect).toBeCloseTo(4 / 3);

    // The camera's forward direction should point roughly toward the
    // target, not straight down -Z (its default orientation).
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const toTarget = new THREE.Vector3(1, 2, 3).sub(camera.position).normalize();
    expect(forward.dot(toTarget)).toBeGreaterThan(0.99);
  });
});

describe('buildThreeSceneGraph: background', () => {
  it('sets the scene background to the document backgroundColor', () => {
    const scene = baseScene({ scene: { backgroundColor: '#ff00ff' } });
    const { scene: threeScene } = buildThreeSceneGraph(scene, 1);
    expect((threeScene.background as THREE.Color).getHexString()).toBe('ff00ff');
  });
});

describe('buildThreeSceneGraph: objects', () => {
  it('builds one mesh per object, at the top level when groupId is null', () => {
    const scene = baseScene({
      objects: [
        {
          id: 'obj-1',
          type: 'box',
          groupId: null,
          transform: identityTransform,
          material: { color: '#ff0000' },
          visible: true,
          width: 2,
          height: 3,
          depth: 4,
        },
      ],
    });

    const { scene: threeScene } = buildThreeSceneGraph(scene, 1);
    const mesh = threeScene.getObjectByName('obj-1') as THREE.Mesh;
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect((mesh.geometry as THREE.BoxGeometry).parameters).toMatchObject({
      width: 2,
      height: 3,
      depth: 4,
    });
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(material.color.getHexString()).toBe('ff0000');
  });

  it('maps each schema type to the matching Three.js geometry', () => {
    const scene = baseScene({
      objects: [
        {
          id: 'sphere-1',
          type: 'sphere',
          groupId: null,
          transform: identityTransform,
          material: { color: '#00ff00' },
          visible: true,
          radius: 3,
        },
        {
          id: 'cyl-1',
          type: 'cylinder',
          groupId: null,
          transform: identityTransform,
          material: { color: '#0000ff' },
          visible: true,
          radiusTop: 1,
          radiusBottom: 2,
          height: 5,
        },
        {
          id: 'plane-1',
          type: 'plane',
          groupId: null,
          transform: identityTransform,
          material: { color: '#ffff00' },
          visible: true,
          width: 6,
          height: 7,
        },
      ],
    });

    const { scene: threeScene } = buildThreeSceneGraph(scene, 1);
    expect((threeScene.getObjectByName('sphere-1') as THREE.Mesh).geometry).toBeInstanceOf(
      THREE.SphereGeometry,
    );
    expect((threeScene.getObjectByName('cyl-1') as THREE.Mesh).geometry).toBeInstanceOf(
      THREE.CylinderGeometry,
    );
    expect((threeScene.getObjectByName('plane-1') as THREE.Mesh).geometry).toBeInstanceOf(
      THREE.PlaneGeometry,
    );
  });

  it('applies the object transform (position/rotation/scale) to the mesh', () => {
    const scene = baseScene({
      objects: [
        {
          id: 'obj-1',
          type: 'box',
          groupId: null,
          transform: {
            position: { x: 1, y: 2, z: 3 },
            rotation: { x: 0, y: 90, z: 0 },
            scale: { x: 2, y: 2, z: 2 },
            opacity: 1,
          },
          material: { color: '#ffffff' },
          visible: true,
          width: 1,
          height: 1,
          depth: 1,
        },
      ],
    });

    const { scene: threeScene } = buildThreeSceneGraph(scene, 1);
    const mesh = threeScene.getObjectByName('obj-1') as THREE.Mesh;
    expect(mesh.position.toArray()).toEqual([1, 2, 3]);
    expect(mesh.scale.toArray()).toEqual([2, 2, 2]);
    expect(mesh.rotation.y).toBeCloseTo(Math.PI / 2);
  });

  it('respects visible: false without omitting the mesh entirely', () => {
    const scene = baseScene({
      objects: [
        {
          id: 'obj-1',
          type: 'box',
          groupId: null,
          transform: identityTransform,
          material: { color: '#ffffff' },
          visible: false,
          width: 1,
          height: 1,
          depth: 1,
        },
      ],
    });

    const { scene: threeScene } = buildThreeSceneGraph(scene, 1);
    const mesh = threeScene.getObjectByName('obj-1') as THREE.Mesh;
    expect(mesh.visible).toBe(false);
  });

  it('applies material opacity/emissive', () => {
    const scene = baseScene({
      objects: [
        {
          id: 'obj-1',
          type: 'sphere',
          groupId: null,
          transform: identityTransform,
          material: { color: '#ff3355', opacity: 0.4, emissive: '#440011' },
          visible: true,
          radius: 1,
        },
      ],
    });

    const { scene: threeScene } = buildThreeSceneGraph(scene, 1);
    const material = (threeScene.getObjectByName('obj-1') as THREE.Mesh)
      .material as THREE.MeshStandardMaterial;
    expect(material.opacity).toBeCloseTo(0.4);
    expect(material.transparent).toBe(true);
    expect(material.emissive.getHexString()).toBe('440011');
  });
});

describe('buildThreeSceneGraph: groups', () => {
  it('nests a grouped object under its group node, not the scene root', () => {
    const scene = baseScene({
      groups: [
        {
          id: 'group-1',
          name: 'Furniture',
          transform: {
            position: { x: 10, y: 0, z: 0 },
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
          id: 'obj-1',
          type: 'box',
          groupId: 'group-1',
          transform: identityTransform,
          material: { color: '#ffffff' },
          visible: true,
          width: 1,
          height: 1,
          depth: 1,
        },
      ],
    });

    const { scene: threeScene } = buildThreeSceneGraph(scene, 1);
    const group = threeScene.getObjectByName('group-1') as THREE.Group;
    const mesh = threeScene.getObjectByName('obj-1') as THREE.Mesh;
    expect(group.children).toContain(mesh);
    expect(threeScene.children).not.toContain(mesh);
    // World position reflects both the group's own transform and the
    // object's identity transform composed on top of it.
    const worldPosition = new THREE.Vector3();
    mesh.getWorldPosition(worldPosition);
    expect(worldPosition.x).toBeCloseTo(10);
  });

  it('an invisible group is reflected on the group node itself', () => {
    const scene = baseScene({
      groups: [
        {
          id: 'group-1',
          name: 'Hidden',
          transform: identityTransform,
          visible: false,
          locked: false,
        },
      ],
    });

    const { scene: threeScene } = buildThreeSceneGraph(scene, 1);
    expect((threeScene.getObjectByName('group-1') as THREE.Group).visible).toBe(false);
  });
});

describe('buildThreeSceneGraph: lights', () => {
  it('builds one Three.js light per schema light, matching type/color/intensity', () => {
    const scene = baseScene({
      lights: [
        {
          id: 'sun',
          type: 'directional',
          color: '#ffffff',
          intensity: 1.2,
          direction: { x: -1, y: -2, z: -1 },
        },
        {
          id: 'bulb',
          type: 'point',
          color: '#ffddaa',
          intensity: 3,
          position: { x: 2, y: 3, z: 2 },
        },
        { id: 'fill', type: 'ambient', color: '#405060', intensity: 0.4 },
      ],
    });

    const { scene: threeScene } = buildThreeSceneGraph(scene, 1);
    const lights = threeScene.children.filter(
      (child): child is THREE.Light => child instanceof THREE.Light,
    );
    const directional = lights.find((l) => l instanceof THREE.DirectionalLight);
    const point = lights.find((l) => l instanceof THREE.PointLight);
    const ambient = lights.find((l) => l instanceof THREE.AmbientLight);

    expect(directional?.intensity).toBe(1.2);
    expect(point?.intensity).toBe(3);
    expect(point?.position.toArray()).toEqual([2, 3, 2]);
    expect(ambient?.intensity).toBe(0.4);
    expect(ambient?.color.getHexString()).toBe('405060');
  });
});

describe('disposeThreeSceneGraph', () => {
  it('disposes every mesh geometry/material without throwing', () => {
    const scene = baseScene({
      objects: [
        {
          id: 'obj-1',
          type: 'box',
          groupId: null,
          transform: identityTransform,
          material: { color: '#ffffff' },
          visible: true,
          width: 1,
          height: 1,
          depth: 1,
        },
      ],
    });
    const { scene: threeScene } = buildThreeSceneGraph(scene, 1);
    const mesh = threeScene.getObjectByName('obj-1') as THREE.Mesh;
    const geometryDisposeSpy = vi.spyOn(mesh.geometry, 'dispose');
    const materialDisposeSpy = vi.spyOn(mesh.material as THREE.Material, 'dispose');

    expect(() => disposeThreeSceneGraph(threeScene)).not.toThrow();
    expect(geometryDisposeSpy).toHaveBeenCalled();
    expect(materialDisposeSpy).toHaveBeenCalled();
  });
});
