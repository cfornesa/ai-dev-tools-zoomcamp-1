import { describe, expect, it } from 'vitest';

import {
  integrateVelocity,
  physicsFromScene,
  sanitizePhysicsForce,
  MAX_DRAG,
  MAX_FORCE_COMPONENT,
  MAX_VELOCITY_MAGNITUDE,
  NEUTRAL_PHYSICS_FORCE,
  type PhysicsForceConfig,
} from './physicsForces';
import { baseScene, particleEmitterShape } from '../render/testSceneFixtures';

describe('sanitizePhysicsForce', () => {
  it('defaults every field to 0 for missing/malformed input', () => {
    expect(sanitizePhysicsForce(undefined)).toEqual(NEUTRAL_PHYSICS_FORCE);
    expect(sanitizePhysicsForce(null)).toEqual(NEUTRAL_PHYSICS_FORCE);
    expect(sanitizePhysicsForce('nonsense')).toEqual(NEUTRAL_PHYSICS_FORCE);
    expect(sanitizePhysicsForce({})).toEqual(NEUTRAL_PHYSICS_FORCE);
  });

  it('passes through valid in-range values unchanged', () => {
    expect(sanitizePhysicsForce({ gravity: 2, drag: 0.5, forceX: -3, forceY: 4 })).toEqual({
      gravity: 2,
      drag: 0.5,
      forceX: -3,
      forceY: 4,
    });
  });

  it('clamps every component to its documented schema range (max values)', () => {
    expect(sanitizePhysicsForce({ gravity: 999, drag: 999, forceX: -999, forceY: 999 })).toEqual({
      gravity: MAX_FORCE_COMPONENT,
      drag: MAX_DRAG,
      forceX: -MAX_FORCE_COMPONENT,
      forceY: MAX_FORCE_COMPONENT,
    });
  });

  it('rejects non-finite input (NaN/Infinity) by treating it as 0, not propagating it', () => {
    expect(
      sanitizePhysicsForce({
        gravity: NaN,
        drag: Infinity,
        forceX: -Infinity,
        forceY: NaN,
      }),
    ).toEqual(NEUTRAL_PHYSICS_FORCE);
  });
});

describe('physicsFromScene', () => {
  it('extracts a sanitized physics config per particleEmitter shape, keyed by id', () => {
    const scene = baseScene({
      shapes: [
        particleEmitterShape({
          id: 'e1',
          physics: { gravity: 1, drag: 0.2, forceX: 0, forceY: 0 },
        }),
        particleEmitterShape({ id: 'e2' }),
      ],
    });
    const map = physicsFromScene(scene);
    expect(map.get('e1')).toEqual({ gravity: 1, drag: 0.2, forceX: 0, forceY: 0 });
    expect(map.get('e2')).toEqual(NEUTRAL_PHYSICS_FORCE);
  });

  it('ignores non-particleEmitter shapes and never throws on a malformed scene', () => {
    expect(() =>
      physicsFromScene(baseScene({ shapes: [{ id: 'x', type: 'circle' }] })),
    ).not.toThrow();
    expect(physicsFromScene(baseScene({ shapes: [{ id: 'x', type: 'circle' }] })).size).toBe(0);
    expect(physicsFromScene(baseScene({ shapes: undefined as never })).size).toBe(0);
  });
});

describe('integrateVelocity: zero and maximum values', () => {
  it('a neutral (all-zero) force never changes velocity', () => {
    expect(integrateVelocity(5, -3, NEUTRAL_PHYSICS_FORCE, 1)).toEqual({ vx: 5, vy: -3 });
  });

  it('dtSeconds: 0 (or negative) does not change velocity', () => {
    const force: PhysicsForceConfig = { gravity: 5, drag: 0, forceX: 5, forceY: 5 };
    expect(integrateVelocity(1, 1, force, 0)).toEqual({ vx: 1, vy: 1 });
    expect(integrateVelocity(1, 1, force, -1)).toEqual({ vx: 1, vy: 1 });
  });

  it('gravity accelerates +y only; forceX/forceY accelerate their own axis', () => {
    const gravityOnly = integrateVelocity(0, 0, { ...NEUTRAL_PHYSICS_FORCE, gravity: 10 }, 1);
    expect(gravityOnly).toEqual({ vx: 0, vy: 10 });

    const windOnly = integrateVelocity(
      0,
      0,
      { ...NEUTRAL_PHYSICS_FORCE, forceX: 3, forceY: -4 },
      1,
    );
    expect(windOnly).toEqual({ vx: 3, vy: -4 });
  });

  it('drag damps velocity toward 0 without reversing its sign', () => {
    const result = integrateVelocity(100, 0, { ...NEUTRAL_PHYSICS_FORCE, drag: 0.5 }, 1);
    expect(result.vx).toBeGreaterThan(0);
    expect(result.vx).toBeLessThan(100);
  });

  it('clamps resulting velocity magnitude to MAX_VELOCITY_MAGNITUDE at maximum force', () => {
    const result = integrateVelocity(
      0,
      0,
      {
        gravity: MAX_FORCE_COMPONENT,
        drag: 0,
        forceX: MAX_FORCE_COMPONENT,
        forceY: MAX_FORCE_COMPONENT,
      },
      100000, // huge dt to force an over-cap magnitude
    );
    const mag = Math.sqrt(result.vx * result.vx + result.vy * result.vy);
    expect(mag).toBeCloseTo(MAX_VELOCITY_MAGNITUDE, 5);
  });
});

describe('integrateVelocity: non-finite input rejection', () => {
  it('a non-finite input velocity does not propagate — falls back to 0', () => {
    expect(integrateVelocity(NaN, 5, NEUTRAL_PHYSICS_FORCE, 1)).toEqual({ vx: 0, vy: 0 });
    expect(integrateVelocity(5, Infinity, NEUTRAL_PHYSICS_FORCE, 1)).toEqual({ vx: 0, vy: 0 });
  });

  it('a non-finite dtSeconds leaves velocity unchanged rather than corrupting it', () => {
    expect(integrateVelocity(3, 4, { ...NEUTRAL_PHYSICS_FORCE, gravity: 5 }, NaN)).toEqual({
      vx: 3,
      vy: 4,
    });
  });
});

describe('determinism', () => {
  it('integrateVelocity is a pure function: same inputs always produce the same output', () => {
    const force: PhysicsForceConfig = { gravity: 1.5, drag: 0.1, forceX: -2, forceY: 3 };
    const a = integrateVelocity(10, -5, force, 0.016);
    const b = integrateVelocity(10, -5, force, 0.016);
    expect(a).toEqual(b);
  });
});
