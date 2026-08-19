import { describe, expect, it } from 'vitest';

import {
  createTrailSystem,
  trailablesFromScene,
  MAX_TRAIL_LENGTH_PER_SHAPE,
  MAX_TRAILED_SHAPES,
  REDUCED_MOTION_TRAIL_LENGTH,
} from './trailSystem';
import { baseScene, circleShape, transform } from '../render/testSceneFixtures';

function sceneWithTrail(id: string, length: number, x: number, y: number) {
  return baseScene({
    shapes: [circleShape({ id, transform: transform({ x, y }), trail: { length } })],
  });
}

describe('trailablesFromScene', () => {
  it('extracts shapes with a non-zero trail.length and their position', () => {
    const scene = sceneWithTrail('s1', 5, 10, 20);
    expect(trailablesFromScene(scene)).toEqual([{ id: 's1', trailLength: 5, x: 10, y: 20 }]);
  });

  it('ignores shapes with trail.length: 0 or no trail field at all', () => {
    const scene = baseScene({
      shapes: [circleShape({ id: 's1', trail: { length: 0 } }), circleShape({ id: 's2' })],
    });
    expect(trailablesFromScene(scene)).toEqual([]);
  });

  it('never throws on a malformed scene/shape', () => {
    expect(() => trailablesFromScene(baseScene({ shapes: undefined as never }))).not.toThrow();
    expect(trailablesFromScene(baseScene({ shapes: undefined as never }))).toEqual([]);
    expect(() =>
      trailablesFromScene(baseScene({ shapes: [{ id: 's1', trail: { length: 5 } }] })),
    ).not.toThrow();
  });

  it('clamps trail.length to MAX_TRAIL_LENGTH_PER_SHAPE', () => {
    const scene = sceneWithTrail('s1', 99999, 0, 0);
    expect(trailablesFromScene(scene)[0].trailLength).toBe(MAX_TRAIL_LENGTH_PER_SHAPE);
  });

  it('caps the number of tracked shapes at MAX_TRAILED_SHAPES', () => {
    const shapes = Array.from({ length: MAX_TRAILED_SHAPES + 20 }, (_, i) =>
      circleShape({ id: `s${i}`, trail: { length: 1 } }),
    );
    const scene = baseScene({ shapes });
    expect(trailablesFromScene(scene).length).toBe(MAX_TRAILED_SHAPES);
  });
});

describe('zero and maximum values', () => {
  it('trail.length: 0 never accumulates samples and does not crash', () => {
    const system = createTrailSystem();
    const scene = sceneWithTrail('s1', 0, 0, 0);
    const result = system.tick(scene, 0, false, false);
    expect(result.get('s1')).toBeUndefined();
  });

  it("sampling never exceeds the shape's own trail.length (ring-buffer bound)", () => {
    const system = createTrailSystem();
    let scene = sceneWithTrail('s1', 3, 0, 0);
    for (let i = 0; i < 20; i += 1) {
      scene = sceneWithTrail('s1', 3, i, i);
      system.tick(scene, i * 100, false, false);
    }
    const samples = system.getTrails().get('s1') ?? [];
    expect(samples.length).toBe(3);
    // The most recent 3 positions (17, 18, 19) are kept, oldest first.
    expect(samples.map((s) => s.x)).toEqual([17, 18, 19]);
  });

  it('a trail.length at MAX_TRAIL_LENGTH_PER_SHAPE is respected exactly', () => {
    const system = createTrailSystem();
    let scene = sceneWithTrail('s1', MAX_TRAIL_LENGTH_PER_SHAPE, 0, 0);
    for (let i = 0; i < MAX_TRAIL_LENGTH_PER_SHAPE + 10; i += 1) {
      scene = sceneWithTrail('s1', MAX_TRAIL_LENGTH_PER_SHAPE, i, 0);
      system.tick(scene, i, false, false);
    }
    expect(system.getTrails().get('s1')?.length).toBe(MAX_TRAIL_LENGTH_PER_SHAPE);
  });
});

describe('object deletion (no leak)', () => {
  it("removes a shape's trail buffer entirely once it disappears from the scene", () => {
    const system = createTrailSystem();
    system.tick(sceneWithTrail('s1', 5, 0, 0), 0, false, false);
    system.tick(sceneWithTrail('s1', 5, 1, 1), 100, false, false);
    expect(system.getTrails().has('s1')).toBe(true);

    // s1 deleted: scene no longer contains it.
    const emptyScene = baseScene({ shapes: [] });
    const result = system.tick(emptyScene, 200, false, false);
    expect(result.has('s1')).toBe(false);
    expect(system.getTrails().has('s1')).toBe(false);
  });

  it('setting trail.length to 0 stops tracking that shape (same as deletion)', () => {
    const system = createTrailSystem();
    system.tick(sceneWithTrail('s1', 5, 0, 0), 0, false, false);
    system.tick(sceneWithTrail('s1', 5, 1, 1), 100, false, false);
    expect(system.getTrails().get('s1')?.length).toBeGreaterThan(0);

    // trailablesFromScene excludes trail.length: 0 shapes entirely (same
    // as the "zero-value configs" case above), so this is treated
    // identically to the shape having been deleted — the buffer is
    // pruned, not left present-but-empty.
    system.tick(sceneWithTrail('s1', 0, 1, 1), 200, false, false);
    expect(system.getTrails().has('s1')).toBe(false);
  });
});

describe('pause / resume', () => {
  it('freezes sampling while paused; resuming does not fabricate missed samples', () => {
    const system = createTrailSystem();
    system.tick(sceneWithTrail('s1', 5, 0, 0), 0, false, false);
    const beforePause = system.getTrails().get('s1')?.length ?? 0;

    system.pause();
    system.tick(sceneWithTrail('s1', 5, 1, 1), 100, false, false);
    system.tick(sceneWithTrail('s1', 5, 2, 2), 999999, false, false);
    expect(system.getTrails().get('s1')?.length).toBe(beforePause);

    system.resume();
    system.tick(sceneWithTrail('s1', 5, 3, 3), 1000000, false, false);
    expect(system.getTrails().get('s1')?.length).toBe(beforePause + 1);
  });
});

describe('overload degradation', () => {
  it('a degraded tick skips appending a new sample but still prunes deleted shapes', () => {
    const system = createTrailSystem();
    system.tick(sceneWithTrail('s1', 5, 0, 0), 0, false, false);
    const before = system.getTrails().get('s1')?.length ?? 0;

    system.tick(sceneWithTrail('s1', 5, 1, 1), 100, true, false);
    expect(system.getTrails().get('s1')?.length).toBe(before);

    // Pruning of a deleted shape still happens even on a degraded tick.
    system.tick(baseScene({ shapes: [] }), 200, true, false);
    expect(system.getTrails().has('s1')).toBe(false);
  });
});

describe('non-finite input rejection', () => {
  function sceneAt(x: number, y: number) {
    return baseScene({
      shapes: [circleShape({ id: 's1', transform: transform({ x, y }), trail: { length: 5 } })],
    });
  }

  it('a non-finite shape position is never sampled, and does not crash', () => {
    const system = createTrailSystem();
    const result = system.tick(sceneAt(NaN, 0), 0, false, false);
    expect(result.get('s1')).toEqual([]);
    expect(system.tick(sceneAt(1, Infinity), 100, false, false).get('s1')).toEqual([]);
  });

  it('a non-finite sample is skipped without discarding prior valid trail history', () => {
    const system = createTrailSystem();
    system.tick(sceneAt(1, 1), 0, false, false);
    system.tick(sceneAt(2, 2), 100, false, false);
    expect(system.getTrails().get('s1')?.length).toBe(2);

    system.tick(sceneAt(NaN, 3), 200, false, false);
    expect(system.getTrails().get('s1')?.length).toBe(2);

    system.tick(sceneAt(4, 4), 300, false, false);
    expect(system.getTrails().get('s1')?.length).toBe(3);
  });
});

describe('determinism', () => {
  it('the same sequence of scene snapshots and timestamps produces identical trail samples', () => {
    function run() {
      const system = createTrailSystem();
      const out: unknown[] = [];
      for (let i = 0; i < 10; i += 1) {
        const scene = sceneWithTrail('s1', 4, i, i * 2);
        out.push(system.tick(scene, i * 100, false, false).get('s1'));
      }
      return out;
    }
    expect(run()).toEqual(run());
  });
});

describe('reduced motion', () => {
  it('clamps effective trail length to REDUCED_MOTION_TRAIL_LENGTH regardless of authored length', () => {
    const system = createTrailSystem();
    for (let i = 0; i < 10; i += 1) {
      system.tick(sceneWithTrail('s1', 10, i, i), i * 100, false, true);
    }
    expect(system.getTrails().get('s1')?.length).toBe(REDUCED_MOTION_TRAIL_LENGTH);
  });

  it("still tracks the shape's current position under reduced motion (meaning preserved)", () => {
    const system = createTrailSystem();
    system.tick(sceneWithTrail('s1', 10, 5, 5), 0, false, true);
    const result = system.tick(sceneWithTrail('s1', 10, 9, 9), 100, false, true);
    expect(result.get('s1')).toEqual([{ x: 9, y: 9, timestamp: 100 }]);
  });
});
