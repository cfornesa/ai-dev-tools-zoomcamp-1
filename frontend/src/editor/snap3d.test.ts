import { describe, expect, it } from 'vitest';

import { SNAP_3D_STEPS, snap3dTransform } from './snap3d';

describe('snap3dTransform', () => {
  it('snaps position, rotation, and scale independently', () => {
    const result = snap3dTransform({
      position: { x: 0.26, y: -0.26, z: 1.24 },
      rotation: { x: SNAP_3D_STEPS.rotation * 1.4, y: -0.2, z: 0 },
      scale: { x: 1.04, y: 0.96, z: 1.25 },
      opacity: 0.7,
    });
    expect(result.position).toEqual({ x: 0.5, y: -0.5, z: 1 });
    expect(result.rotation.x).toBeCloseTo(SNAP_3D_STEPS.rotation);
    expect(result.rotation.y).toBeCloseTo(-SNAP_3D_STEPS.rotation);
    expect(result.scale).toEqual({ x: 1, y: 1, z: 1.3 });
    expect(result.opacity).toBe(0.7);
  });
});
