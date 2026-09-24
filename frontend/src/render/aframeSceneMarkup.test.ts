import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { Scene3DDocument } from '../pages/scene3dTypes';
import { validateScene3D } from '../validation/scene3d';
import { buildAFrameSceneMarkup, eulerXYZToAFrameDegrees } from './aframeSceneMarkup';

const DEG = Math.PI / 180;

function scene(overrides: Partial<Scene3DDocument> = {}): Scene3DDocument {
  return {
    schemaVersion: 1,
    documentType: 'scene3d',
    id: 'scene3d-772',
    scene: { backgroundColor: '#101820' },
    renderer: { preferred: 'aframe' },
    camera: {
      position: { x: 0, y: 2, z: 6 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
      near: 0.1,
      far: 1000,
    },
    lights: [
      { id: 'amb', type: 'ambient', color: '#ffffff', intensity: 0.6 },
      {
        id: 'sun',
        type: 'directional',
        color: '#ffeecc',
        intensity: 1,
        direction: { x: 1, y: -2, z: -1 },
      },
      { id: 'lamp', type: 'point', color: '#ff8800', intensity: 2, position: { x: 3, y: 4, z: 1 } },
    ],
    groups: [
      {
        id: 'grp',
        name: 'Group',
        transform: {
          position: { x: 1, y: 0, z: 0 },
          rotation: { x: 0, y: 30, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          opacity: 1,
        },
        visible: true,
        locked: false,
      },
    ],
    objects: [
      {
        id: 'ball',
        type: 'sphere',
        groupId: null,
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          opacity: 1,
        },
        material: { color: '#ff0000' },
        visible: true,
        radius: 1,
      },
      {
        id: 'crate',
        type: 'box',
        groupId: 'grp',
        transform: {
          position: { x: 0, y: 1, z: 0 },
          rotation: { x: 10, y: 20, z: 30 },
          scale: { x: 1, y: 2, z: 1 },
          opacity: 1,
        },
        material: { color: '#00ff00', opacity: 0.5, emissive: '#003300' },
        visible: false,
        width: 1,
        height: 1,
        depth: 1,
      },
      {
        id: 'cone',
        type: 'cylinder',
        groupId: null,
        transform: {
          position: { x: 2, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          opacity: 1,
        },
        material: { color: '#0000ff' },
        visible: true,
        radiusTop: 0,
        radiusBottom: 1,
        height: 2,
      },
      {
        id: 'floor',
        type: 'plane',
        groupId: null,
        transform: {
          position: { x: 0, y: -1, z: 0 },
          rotation: { x: -90, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          opacity: 1,
        },
        material: { color: '#888888' },
        visible: true,
        width: 10,
        height: 10,
      },
    ],
    randomness: { seed: 0, enabled: false },
    ...overrides,
  };
}

describe('eulerXYZToAFrameDegrees', () => {
  it('produces the same orientation as Three.js XYZ Euler for arbitrary rotations', () => {
    const cases = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 20, z: 30 },
      { x: -90, y: 0, z: 0 },
      { x: 45, y: -60, z: 120 },
      { x: 170, y: 35, z: -75 },
      { x: 30, y: 90, z: 10 },
    ];
    for (const rotation of cases) {
      const expected = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rotation.x * DEG, rotation.y * DEG, rotation.z * DEG, 'XYZ'),
      );
      const yxz = eulerXYZToAFrameDegrees(rotation);
      const actual = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(yxz.x * DEG, yxz.y * DEG, yxz.z * DEG, 'YXZ'),
      );
      // q and -q are the same orientation.
      expect(Math.abs(expected.dot(actual))).toBeCloseTo(1, 6);
    }
  });
});

describe('buildAFrameSceneMarkup (#772)', () => {
  it('renders a valid scene as an embedded a-scene with every primitive, light, and a camera', () => {
    const doc = scene();
    expect(validateScene3D(doc).valid).toBe(true);
    const html = buildAFrameSceneMarkup(doc);
    expect(html.startsWith('<a-scene')).toBe(true);
    expect(html.endsWith('</a-scene>')).toBe(true);
    expect(html).toContain('background="color: #101820"');
    for (const tag of ['<a-sphere', '<a-box', '<a-plane']) expect(html).toContain(tag);
    expect(html).toContain('primitive: cone; radiusTop: 0; radiusBottom: 1; height: 2');
    expect(html).toContain('light="type: ambient');
    expect(html).toContain('light="type: directional');
    expect(html).toContain('light="type: point');
    expect(html).toContain('id="scene3d-camera-rig"');
    // A-Frame's default 1.6m user height must be zeroed or the camera sits above its rig.
    expect(html).toContain(
      '<a-camera user-height="0" position="0 0 0" fov="50" near="0.1" far="1000"',
    );
  });

  it('nests grouped objects in their group entity and keeps visibility and material flags', () => {
    const html = buildAFrameSceneMarkup(scene());
    const group = html.slice(
      html.indexOf('<a-entity id="grp"'),
      html.indexOf('</a-entity>', html.indexOf('<a-entity id="grp"')),
    );
    expect(group).toContain('id="crate"');
    expect(group).toContain('visible="false"');
    expect(group).toContain('opacity: 0.5; transparent: true; emissive: #003300');
    expect(html).not.toMatch(/<a-entity id="grp"[^>]*>(?:(?!<\/a-entity>).)*id="ball"/);
    // Planes are double sided, like the Three.js builder.
    expect(html).toContain('side: double');
  });

  it('places a directional light opposite its direction and aims the camera rig at the target', () => {
    const html = buildAFrameSceneMarkup(scene());
    expect(html).toContain('position="-1 2 1"');
    // Camera at (0,2,6) looking at the origin: yaw 0 (down -Z), pitch atan(-2/6) ~ -18.43 deg.
    expect(html).toMatch(/id="scene3d-camera-rig" position="0 2 6" rotation="-18\.43\d* 0 0"/);
  });

  it('uses the same neutral background as the Three.js builder for an empty scene', () => {
    const empty = scene({ lights: [], groups: [], objects: [] });
    expect(buildAFrameSceneMarkup(empty)).toContain('background="color: #808080"');
  });

  it('escapes hostile attribute values and never emits script or event handlers', () => {
    const doc = scene();
    doc.objects[0]!.id = 'x" onload="alert(1)';
    doc.objects[0]!.material.color = 'red" onclick="alert(1)';
    const html = buildAFrameSceneMarkup(doc);
    expect(html).not.toContain('onload="alert');
    expect(html).not.toMatch(/\son[a-z]+="/i);
    expect(html).not.toContain('<script');
    expect(html).toContain('&quot;');
  });

  it('is deterministic', () => {
    expect(buildAFrameSceneMarkup(scene())).toBe(buildAFrameSceneMarkup(scene()));
  });
});

describe('buildAFrameSceneMarkup: drawing planes (#780)', () => {
  const plane = {
    id: 'draw',
    type: 'drawingPlane' as const,
    groupId: null,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      opacity: 1,
    },
    material: { color: '#336699', opacity: 0.9 },
    visible: true,
    width: 4,
    height: 3,
    drawing: { width: 64, height: 48, shapes: [] },
  };

  it('embeds the rasterised drawing as an asset and maps it with transparency', () => {
    const html = buildAFrameSceneMarkup(scene({ objects: [plane], groups: [] }), {
      rasterize: () => 'data:image/png;base64,iVBORw0KGgo=',
    });
    expect(html).toContain('<a-assets timeout="10000"><img id="drawing-texture-0"');
    expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(html).toContain(
      'material="src: #drawing-texture-0; color: #ffffff; opacity: 0.9; transparent: true',
    );
    expect(html).toContain('side: double');
  });

  it('falls back to the plain material colour when nothing can be rasterised or the URL is unsafe', () => {
    for (const rasterize of [
      () => null,
      () => 'data:text/html;base64,PHNjcmlwdD4=',
      () => 'javascript:alert(1)',
    ]) {
      const html = buildAFrameSceneMarkup(scene({ objects: [plane], groups: [] }), { rasterize });
      expect(html).not.toContain('<a-assets');
      expect(html).not.toContain('javascript:');
      expect(html).toContain('color: #336699');
    }
  });
});
