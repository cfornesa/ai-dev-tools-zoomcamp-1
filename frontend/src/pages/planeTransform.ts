/**
 * Issue #782: the maths behind the on-canvas selection handles for a drawing plane. Everything here is
 * pure (Three.js vectors/matrices only) so it is unit-testable without a renderer: projecting the plane
 * to screen, turning pointer drags into world-space edits, and the size limits the schema enforces.
 *
 * Expansion is PROPORTIONAL by default (the owner's decision): the corner handles and the precise
 * panel keep the width:height ratio; only an explicit stretch (an edge handle, or Shift while dragging a
 * corner) changes the ratio.
 */
import * as THREE from 'three';

import type { Group3D, Object3D, Transform3D } from './scene3dTypes';

/** schema/scene3d.schema.json: a plane's width/height are > 0 and <= 10000. */
export const PLANE_MIN_SIZE = 0.05;
export const PLANE_MAX_SIZE = 10000;

export type Point = { x: number; y: number };
export type StageSize = { width: number; height: number };

const clampSize = (n: number) => Math.min(PLANE_MAX_SIZE, Math.max(PLANE_MIN_SIZE, n));
const round = (n: number, places = 3) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

function composeTransform(transform: Transform3D): THREE.Matrix4 {
  const matrix = new THREE.Matrix4();
  matrix.compose(
    new THREE.Vector3(transform.position.x, transform.position.y, transform.position.z),
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(transform.rotation.x),
        THREE.MathUtils.degToRad(transform.rotation.y),
        THREE.MathUtils.degToRad(transform.rotation.z),
        'XYZ',
      ),
    ),
    new THREE.Vector3(transform.scale.x, transform.scale.y, transform.scale.z),
  );
  return matrix;
}

/** The plane's object-to-world matrix (its own transform inside its group's transform, if any). */
export function planeWorldMatrix(object: Object3D, group?: Group3D | null): THREE.Matrix4 {
  const own = composeTransform(object.transform);
  return group ? composeTransform(group.transform).multiply(own) : own;
}

export type ProjectedPlane = {
  /** Corners in screen pixels: top-left, top-right, bottom-right, bottom-left (in plane space). */
  corners: [Point, Point, Point, Point];
  /** Midpoints of the top, right, bottom, left edges. */
  edges: [Point, Point, Point, Point];
  center: Point;
  /** Where the rotate handle sits: above the top edge, away from the centre. */
  rotate: Point;
  /** False when the plane is behind the camera (nothing sensible to draw). */
  visible: boolean;
};

function project(v: THREE.Vector3, camera: THREE.Camera, stage: StageSize): Point {
  const p = v.clone().project(camera);
  return { x: (p.x * 0.5 + 0.5) * stage.width, y: (-p.y * 0.5 + 0.5) * stage.height };
}

/** Projects a plane (in its `width` x `height` local rectangle) to stage pixels. */
export function projectPlane(
  object: Object3D,
  group: Group3D | null | undefined,
  camera: THREE.PerspectiveCamera,
  stage: StageSize,
): ProjectedPlane {
  camera.updateMatrixWorld();
  const matrix = planeWorldMatrix(object, group);
  const hw = (object.width ?? 1) / 2;
  const hh = (object.height ?? 1) / 2;
  const world = (x: number, y: number) => new THREE.Vector3(x, y, 0).applyMatrix4(matrix);
  const local: Array<[number, number]> = [
    [-hw, hh],
    [hw, hh],
    [hw, -hh],
    [-hw, -hh],
  ];
  const worlds = local.map(([x, y]) => world(x, y));
  const inFront = worlds.every((w) => w.clone().applyMatrix4(camera.matrixWorldInverse).z < 0);
  const corners = worlds.map((w) => project(w, camera, stage)) as ProjectedPlane['corners'];
  const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const edges: ProjectedPlane['edges'] = [
    mid(corners[0], corners[1]),
    mid(corners[1], corners[2]),
    mid(corners[2], corners[3]),
    mid(corners[3], corners[0]),
  ];
  const center = mid(corners[0], corners[2]);
  // Rotate handle: 36px beyond the top edge, along the direction from the centre through it.
  const away = { x: edges[0].x - center.x, y: edges[0].y - center.y };
  const length = Math.hypot(away.x, away.y) || 1;
  const rotate = { x: edges[0].x + (away.x / length) * 36, y: edges[0].y + (away.y / length) * 36 };
  return { corners, edges, center, rotate, visible: inFront };
}

/** World units covered by one screen pixel at `worldPosition`'s depth. */
export function worldUnitsPerPixel(
  camera: THREE.PerspectiveCamera,
  worldPosition: THREE.Vector3,
  stageHeight: number,
): number {
  const distance = Math.max(0.01, camera.position.distanceTo(worldPosition));
  return (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / (stageHeight || 1);
}

/** Moves the plane parallel to the view plane by a screen-pixel delta. */
export function movePlaneByScreenDelta(
  object: Object3D,
  delta: Point,
  camera: THREE.PerspectiveCamera,
  stage: StageSize,
): Object3D {
  camera.updateMatrixWorld();
  const position = new THREE.Vector3(
    object.transform.position.x,
    object.transform.position.y,
    object.transform.position.z,
  );
  const k = worldUnitsPerPixel(camera, position, stage.height);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  const moved = position
    .add(right.multiplyScalar(delta.x * k))
    .add(up.multiplyScalar(-delta.y * k));
  return withTransform(object, {
    position: { x: round(moved.x), y: round(moved.y), z: round(moved.z) },
  });
}

export function withTransform(object: Object3D, patch: Partial<Transform3D>): Object3D {
  return { ...object, transform: { ...object.transform, ...patch } };
}

/** Sets the size, optionally keeping the current aspect ratio (proportional expansion). */
export function resizePlane(
  object: Object3D,
  size: { width?: number; height?: number },
  proportional: boolean,
): Object3D {
  const width0 = object.width ?? 1;
  const height0 = object.height ?? 1;
  let width = size.width ?? width0;
  let height = size.height ?? height0;
  if (proportional) {
    const ratio = width0 / height0;
    if (size.width !== undefined && size.height === undefined) height = width / ratio;
    else if (size.height !== undefined && size.width === undefined) width = height * ratio;
    else if (size.width !== undefined && size.height !== undefined) height = width / ratio;
  }
  return { ...object, width: round(clampSize(width)), height: round(clampSize(height)) };
}

/** Scales width and height by the same factor, keeping the drawing's proportions. */
export function scalePlaneUniform(object: Object3D, factor: number): Object3D {
  return resizePlane(
    object,
    { width: (object.width ?? 1) * factor, height: (object.height ?? 1) * factor },
    false,
  );
}

/** Stretches a single axis (an explicit, non-proportional change). */
export function stretchPlane(object: Object3D, axis: 'width' | 'height', factor: number): Object3D {
  return resizePlane(object, { [axis]: (object[axis] ?? 1) * factor }, false);
}

/**
 * Rotates the plane by `angleRadians` about the camera's viewing axis (what an in-plane "twist" handle
 * means to someone looking at it) and returns the new Euler rotation in degrees.
 */
export function rotatePlaneAboutView(
  object: Object3D,
  angleRadians: number,
  camera: THREE.PerspectiveCamera,
): Object3D {
  camera.updateMatrixWorld();
  const axis = new THREE.Vector3();
  camera.getWorldDirection(axis);
  const current = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(object.transform.rotation.x),
      THREE.MathUtils.degToRad(object.transform.rotation.y),
      THREE.MathUtils.degToRad(object.transform.rotation.z),
      'XYZ',
    ),
  );
  // Screen y grows downward, so a clockwise pointer sweep is a positive screen angle; rotating about the
  // viewing direction by a positive angle turns the plane clockwise as seen from the camera.
  const twist = new THREE.Quaternion().setFromAxisAngle(axis, angleRadians);
  const next = new THREE.Euler().setFromQuaternion(twist.multiply(current), 'XYZ');
  return withTransform(object, {
    rotation: {
      x: round(THREE.MathUtils.radToDeg(next.x), 2),
      y: round(THREE.MathUtils.radToDeg(next.y), 2),
      z: round(THREE.MathUtils.radToDeg(next.z), 2),
    },
  });
}

/** Rotation presets: lying flat (like a floor or table) and standing upright (facing the viewer). */
export const PLANE_HORIZONTAL_ROTATION = { x: -90, y: 0, z: 0 } as const;
export const PLANE_VERTICAL_ROTATION = { x: 0, y: 0, z: 0 } as const;

export function setPlanePreset(object: Object3D, preset: 'horizontal' | 'vertical'): Object3D {
  return withTransform(object, {
    rotation: {
      ...(preset === 'horizontal' ? PLANE_HORIZONTAL_ROTATION : PLANE_VERTICAL_ROTATION),
    },
  });
}

/** Mirrors the drawing left-to-right. */
export function flipPlane(object: Object3D): Object3D {
  const scale = object.transform.scale;
  return withTransform(object, { scale: { ...scale, x: -scale.x || -1 } });
}

/** The pointer's position measured along the plane's screen-space width and height axes. */
export function screenAxes(projected: ProjectedPlane): { u: Point; v: Point } {
  const [tl, tr, , bl] = projected.corners;
  const norm = (p: Point): Point => {
    const l = Math.hypot(p.x, p.y) || 1;
    return { x: p.x / l, y: p.y / l };
  };
  return {
    u: norm({ x: tr.x - tl.x, y: tr.y - tl.y }),
    v: norm({ x: bl.x - tl.x, y: bl.y - tl.y }),
  };
}
