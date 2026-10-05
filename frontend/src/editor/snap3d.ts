import type { Transform3D, Vec3 } from '../pages/scene3dTypes';

export const SNAP_3D_STEPS = {
  position: 0.5,
  rotation: Math.PI / 12,
  scale: 0.1,
} as const;

function snapValue(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function snapVec3(value: Vec3, step: number): Vec3 {
  return { x: snapValue(value.x, step), y: snapValue(value.y, step), z: snapValue(value.z, step) };
}

export function snap3dTransform(transform: Transform3D): Transform3D {
  return {
    ...transform,
    position: snapVec3(transform.position, SNAP_3D_STEPS.position),
    rotation: snapVec3(transform.rotation, SNAP_3D_STEPS.rotation),
    scale: snapVec3(transform.scale, SNAP_3D_STEPS.scale),
  };
}
