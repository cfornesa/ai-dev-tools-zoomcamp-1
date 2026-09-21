import { describe, expect, it } from 'vitest';

import {
  appendGenerated3DPrimitive,
  applyGenerated3DTransform,
  listGenerated3DObjects,
} from './generated3dManualTools';

const THREE_SOURCE = `const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();
const renderer = new THREE.WebGLRenderer();
renderer.render(scene,camera);`;
const AFRAME_SOURCE = '<a-scene><a-camera position="0 1.6 0"></a-camera></a-scene>';

describe('generated 3D manual source edits', () => {
  it('appends Three.js primitives, outlines them, and patches numeric transforms', () => {
    const added = appendGenerated3DPrimitive(THREE_SOURCE, 'threejs', 'add-box');
    const second = appendGenerated3DPrimitive(added.source, 'threejs', 'add-sphere');
    expect(second.source).toContain('AUGMENTRART_EDITABLE_START');
    expect(second.source).toContain('EdgesGeometry');
    expect(listGenerated3DObjects(second.source, 'threejs')).toHaveLength(2);
    const transformed = applyGenerated3DTransform(second.source, 'threejs', added.id, {
      x: 1,
      y: 2,
      z: -3,
      rotationX: 10,
      rotationY: 20,
      rotationZ: 30,
      scaleX: 2,
      scaleY: 3,
      scaleZ: 4,
    });
    expect(transformed).toContain('augmentrart_box_1.position.set(1,2,-3)');
    expect(transformed).toContain('augmentrart_box_1.scale.set(2,3,4)');
  });

  it('appends A-Frame primitives and replaces their transform attributes', () => {
    const added = appendGenerated3DPrimitive(AFRAME_SOURCE, 'aframe', 'add-plane');
    expect(added.source).toContain('preserveDrawingBuffer: true');
    expect(added.source).toContain('<!-- AUGMENTRART_EDITABLE_START -->');
    expect(added.source).toContain(`<a-plane id="${added.id}"`);
    expect(listGenerated3DObjects(added.source, 'aframe')).toEqual([
      { id: added.id, label: added.id },
    ]);
    const transformed = applyGenerated3DTransform(added.source, 'aframe', added.id, {
      x: 1,
      y: 2,
      z: -3,
      rotationX: 10,
      rotationY: 20,
      rotationZ: 30,
      scaleX: 2,
      scaleY: 3,
      scaleZ: 4,
    });
    expect(transformed).toContain('position="1 2 -3"');
    expect(transformed).toContain('rotation="10 20 30"');
    expect(transformed).toContain('scale="2 3 4"');
  });
});
