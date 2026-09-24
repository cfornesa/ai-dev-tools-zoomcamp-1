import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  PLANE_MAX_SIZE,
  flipPlane,
  pickDrawingPlane,
  planeContainsPoint,
  movePlaneByScreenDelta,
  projectPlane,
  resizePlane,
  rotatePlaneAboutView,
  scalePlaneUniform,
  screenAxes,
  setPlanePreset,
  stretchPlane,
} from './planeTransform';
import type { Object3D } from './scene3dTypes';

const plane = (over: Partial<Object3D> = {}): Object3D => ({
  id: 'p',
  type: 'drawingPlane',
  groupId: null,
  transform: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    opacity: 1,
  },
  material: { color: '#ffffff' },
  visible: true,
  width: 4,
  height: 3,
  drawing: { width: 1024, height: 768, background: null, shapes: [] },
  ...over,
});

function camera() {
  const cam = new THREE.PerspectiveCamera(50, 800 / 600, 0.1, 1000);
  cam.position.set(0, 0, 8);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}

const stage = { width: 800, height: 600 };

describe('projectPlane (#782)', () => {
  it('projects a face-on plane to a centred, axis-aligned screen rectangle', () => {
    const p = projectPlane(plane(), null, camera(), stage);
    expect(p.visible).toBe(true);
    expect(p.center.x).toBeCloseTo(400, 3);
    expect(p.center.y).toBeCloseTo(300, 3);
    const [tl, tr, br, bl] = p.corners;
    expect(tl.y).toBeCloseTo(tr.y, 3);
    expect(tl.x).toBeCloseTo(bl.x, 3);
    expect(tr.x).toBeGreaterThan(tl.x);
    expect(bl.y).toBeGreaterThan(tl.y);
    expect(br.x).toBeCloseTo(tr.x, 3);
    // 4:3 plane keeps a 4:3 screen shape when face-on.
    expect((tr.x - tl.x) / (bl.y - tl.y)).toBeCloseTo(4 / 3, 2);
    expect(p.rotate.y).toBeLessThan(p.edges[0].y);
  });

  it('follows the plane when it moves and applies its group transform', () => {
    const moved = projectPlane(
      plane({ transform: { ...plane().transform, position: { x: 2, y: 0, z: 0 } } }),
      null,
      camera(),
      stage,
    );
    expect(moved.center.x).toBeGreaterThan(400);
    const group = {
      id: 'g',
      name: 'g',
      visible: true,
      locked: false,
      transform: { ...plane().transform, position: { x: -2, y: 0, z: 0 } },
    };
    const grouped = projectPlane(plane(), group, camera(), stage);
    expect(grouped.center.x).toBeLessThan(400);
  });

  it('reports a plane behind the camera as not visible', () => {
    const behind = plane({ transform: { ...plane().transform, position: { x: 0, y: 0, z: 20 } } });
    expect(projectPlane(behind, null, camera(), stage).visible).toBe(false);
  });
});

describe('drag maths (#782)', () => {
  it('moves parallel to the view plane by pointer delta', () => {
    const cam = camera();
    const moved = movePlaneByScreenDelta(plane(), { x: 100, y: 0 }, cam, stage);
    expect(moved.transform.position.x).toBeGreaterThan(0.5);
    expect(moved.transform.position.y).toBeCloseTo(0, 5);
    expect(moved.transform.position.z).toBeCloseTo(0, 5);
    const down = movePlaneByScreenDelta(plane(), { x: 0, y: 100 }, cam, stage);
    expect(down.transform.position.y).toBeLessThan(-0.5);
    // The plane follows the pointer: projecting it again lands ~100px to the right.
    const before = projectPlane(plane(), null, cam, stage).center.x;
    const after = projectPlane(moved, null, cam, stage).center.x;
    expect(after - before).toBeCloseTo(100, 0);
  });

  it('keeps proportions by default and only stretches on request', () => {
    const scaled = scalePlaneUniform(plane(), 1.5);
    expect(scaled.width).toBeCloseTo(6, 3);
    expect(scaled.height).toBeCloseTo(4.5, 3);
    const byWidth = resizePlane(plane(), { width: 8 }, true);
    expect(byWidth.width).toBe(8);
    expect(byWidth.height).toBe(6);
    const byHeight = resizePlane(plane(), { height: 6 }, true);
    expect(byHeight.width).toBe(8);
    expect(resizePlane(plane(), { width: 8 }, false).height).toBe(3);
    expect(stretchPlane(plane(), 'height', 2)).toMatchObject({ width: 4, height: 6 });
  });

  it('clamps sizes to the schema limits', () => {
    expect(scalePlaneUniform(plane(), 1e9).width).toBe(PLANE_MAX_SIZE);
    expect(scalePlaneUniform(plane(), 0).width).toBeGreaterThan(0);
  });

  it('rotates about the viewing axis (a face-on plane twists in place)', () => {
    const rotated = rotatePlaneAboutView(plane(), Math.PI / 2, camera());
    // Face-on to a camera on +z looking down -z: a quarter turn is a pure Z rotation of magnitude 90.
    expect(Math.abs(rotated.transform.rotation.z)).toBeCloseTo(90, 1);
    expect(rotated.transform.rotation.x).toBeCloseTo(0, 1);
    expect(rotated.transform.rotation.y).toBeCloseTo(0, 1);
  });

  it('a positive (clockwise on screen) angle turns the plane clockwise as seen by the viewer', () => {
    const cam = camera();
    const rotated = rotatePlaneAboutView(plane(), Math.PI / 2, cam);
    const projected = projectPlane(rotated, null, cam, stage);
    // Clockwise quarter turn: the top edge ends up on the right, the right edge at the bottom.
    expect(projected.edges[0].x - projected.center.x).toBeGreaterThan(50);
    expect(projected.edges[1].y - projected.center.y).toBeGreaterThan(50);
  });

  it('provides horizontal/vertical presets and a flip', () => {
    expect(setPlanePreset(plane(), 'horizontal').transform.rotation).toEqual({
      x: -90,
      y: 0,
      z: 0,
    });
    expect(
      setPlanePreset(setPlanePreset(plane(), 'horizontal'), 'vertical').transform.rotation,
    ).toEqual({ x: 0, y: 0, z: 0 });
    expect(flipPlane(plane()).transform.scale.x).toBe(-1);
    expect(flipPlane(flipPlane(plane())).transform.scale.x).toBe(1);
  });

  it('exposes the screen-space width/height axes for stretch handles', () => {
    const { u, v } = screenAxes(projectPlane(plane(), null, camera(), stage));
    expect(u.x).toBeCloseTo(1, 3);
    expect(v.y).toBeCloseTo(1, 3);
  });
});

describe('picking drawing planes on a stage (#796)', () => {
  it('hits a plane inside its projected quad and misses outside', () => {
    const cam = camera();
    expect(planeContainsPoint(plane(), null, cam, stage, { x: 400, y: 300 })).toBe(true);
    expect(planeContainsPoint(plane(), null, cam, stage, { x: 5, y: 5 })).toBe(false);
  });

  it('picks the nearest of two overlapping planes and ignores hidden ones', () => {
    const cam = camera();
    const back = plane({
      id: 'back',
      transform: { ...plane().transform, position: { x: 0, y: 0, z: -2 } },
    });
    const front = plane({
      id: 'front',
      transform: { ...plane().transform, position: { x: 0, y: 0, z: 1 } },
    });
    expect(pickDrawingPlane([back, front], [], cam, stage, { x: 400, y: 300 })).toBe('front');
    expect(
      pickDrawingPlane([back, { ...front, visible: false }], [], cam, stage, { x: 400, y: 300 }),
    ).toBe('back');
    expect(pickDrawingPlane([back, front], [], cam, stage, { x: 3, y: 3 })).toBeNull();
  });
});
