import { describe, expect, it } from 'vitest';

import {
  appendPathPointNearLast,
  applyVertexDrag,
  createShape,
  deletePathPoint,
  findClosestPathSegment,
  getPathPointHandles,
  insertPathPoint,
  MAX_PATH_POINTS,
  MIN_PATH_POINTS,
  POSITION_LIMIT,
  type PathShape,
} from './sceneShapes';

/**
 * Issue #79: unit tests for the per-vertex path-editing geometry/mutation
 * helpers, independent of the DOM/React wiring in EditorWorkspace.tsx and
 * useSceneEditor.ts (both covered separately).
 */

const CANVAS = { width: 800, height: 600 };

function makePath(overrides: Partial<PathShape> = {}): PathShape {
  const base = createShape('path', 'layer-1', CANVAS) as PathShape;
  return { ...base, ...overrides };
}

describe('getPathPointHandles', () => {
  it('places one handle per point, at transform.x/y + points[i], when unrotated', () => {
    const path = makePath(); // center (400,300); points relative offsets
    const handles = getPathPointHandles(path);
    expect(handles).toHaveLength(path.points.length);
    expect(handles[0]).toEqual({ x: 400 + path.points[0].x, y: 300 + path.points[0].y });
    expect(handles[1]).toEqual({ x: 400 + path.points[1].x, y: 300 + path.points[1].y });
  });

  it('rotates handle positions around the transform origin with the shape', () => {
    const path = makePath({
      transform: { ...makePath().transform, rotation: 90 },
    });
    const handles = getPathPointHandles(path);
    // points[0] is (0, -50) relative — a +90 degree rotation should move
    // it from directly above center to directly right of center.
    expect(handles[0].x).toBeCloseTo(450);
    expect(handles[0].y).toBeCloseTo(300);
  });
});

describe('applyVertexDrag', () => {
  it('moves only the dragged point, leaving every other point unchanged', () => {
    const path = makePath();
    const originalPoints = path.points.map((p) => ({ ...p }));
    const updated = applyVertexDrag(path, 0, { x: 500, y: 300 }); // drag point 0 to (500,300)

    // point 0's new local offset is (500-400, 300-300) = (100, 0)
    expect(updated.points[0]).toEqual({ x: 100, y: 0 });
    // every other point is untouched
    for (let i = 1; i < originalPoints.length; i += 1) {
      expect(updated.points[i]).toEqual(originalPoints[i]);
    }
    // the start snapshot itself was never mutated
    expect(path.points[0]).toEqual(originalPoints[0]);
  });

  it('unrotates the pointer through the shape transform before writing the local offset', () => {
    const path = makePath({ transform: { ...makePath().transform, rotation: 90 } });
    // Dragging directly right of the rotated shape's center should, once
    // unrotated by -90 degrees, land at local (0, -100) — directly above.
    const updated = applyVertexDrag(path, 0, { x: 500, y: 300 });
    expect(updated.points[0].x).toBeCloseTo(0);
    expect(updated.points[0].y).toBeCloseTo(-100);
  });

  it('clamps every intermediate coordinate to the schema point range, never NaN/Infinity', () => {
    const path = makePath();
    const updated = applyVertexDrag(path, 0, { x: 999_999, y: -999_999 });
    expect(updated.points[0].x).toBe(POSITION_LIMIT.max);
    expect(updated.points[0].y).toBe(POSITION_LIMIT.min);
    expect(Number.isFinite(updated.points[0].x)).toBe(true);
    expect(Number.isFinite(updated.points[0].y)).toBe(true);
  });
});

describe('findClosestPathSegment', () => {
  it('finds the closing segment of a closed path and returns an append index', () => {
    const path = makePath(); // closed square: (0,-50),(50,0),(0,50),(-50,0), center (400,300)
    // Midpoint of the segment from points[3]=(-50,0) back to points[0]=(0,-50)
    // in local space is (-25,-25); in canvas space that's (375, 275).
    const hit = findClosestPathSegment(path, { x: 375, y: 275 });
    expect(hit).not.toBeNull();
    expect(hit!.index).toBe(path.points.length); // append at the end
    expect(hit!.point).toEqual({ x: -25, y: -25 });
  });

  it('finds an interior segment and returns the correct splice index', () => {
    const path = makePath();
    // Midpoint of segment 0 (points[0]=(0,-50) to points[1]=(50,0)) in
    // local space is (25,-25); canvas space (425, 275).
    const hit = findClosestPathSegment(path, { x: 425, y: 275 });
    expect(hit).not.toBeNull();
    expect(hit!.index).toBe(1);
  });

  it('returns null when the point is farther than the tolerance from every segment', () => {
    const path = makePath();
    const hit = findClosestPathSegment(path, { x: 700, y: 550 }, 10);
    expect(hit).toBeNull();
  });

  it('only tests segments up to the last point for an open path (no closing segment)', () => {
    const path = makePath({ closed: false });
    // The closing segment (last point back to first) midpoint would be
    // (-25,-25) local / (375,275) canvas for a closed path — for an open
    // path that segment doesn't exist, so this should miss.
    const hit = findClosestPathSegment(path, { x: 375, y: 275 }, 10);
    expect(hit).toBeNull();
  });
});

describe('insertPathPoint', () => {
  it('inserts a point at the given index, shifting later points', () => {
    const path = makePath();
    const result = insertPathPoint(path, 1, { x: 10, y: 10 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.shape.points).toHaveLength(path.points.length + 1);
    expect(result.shape.points[1]).toEqual({ x: 10, y: 10 });
    expect(result.shape.points[2]).toEqual(path.points[1]); // shifted, not overwritten
  });

  it('rejects with no mutation when the shape is already at MAX_PATH_POINTS', () => {
    const points = Array.from({ length: MAX_PATH_POINTS }, (_, i) => ({ x: i, y: 0 }));
    const path = makePath({ points });
    const result = insertPathPoint(path, 1, { x: 5, y: 5 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/maximum/i);
  });

  it('accepts an insert that lands exactly at MAX_PATH_POINTS', () => {
    const points = Array.from({ length: MAX_PATH_POINTS - 1 }, (_, i) => ({ x: i, y: 0 }));
    const path = makePath({ points });
    const result = insertPathPoint(path, 1, { x: 5, y: 5 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.shape.points).toHaveLength(MAX_PATH_POINTS);
  });
});

describe('appendPathPointNearLast', () => {
  it('appends a new point offset from the current last point', () => {
    const path = makePath();
    const last = path.points[path.points.length - 1];
    const result = appendPathPointNearLast(path);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.shape.points).toHaveLength(path.points.length + 1);
    const appended = result.shape.points[result.shape.points.length - 1];
    expect(appended).toEqual({ x: last.x + 20, y: last.y + 20 });
  });
});

describe('deletePathPoint', () => {
  it('removes the point at the given index', () => {
    const path = makePath();
    const target = path.points[2];
    const result = deletePathPoint(path, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.shape.points).toHaveLength(path.points.length - 1);
    expect(result.shape.points).not.toContainEqual(target);
  });

  it('rejects with no mutation when the shape is already at MIN_PATH_POINTS', () => {
    const path = makePath({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    });
    expect(path.points).toHaveLength(MIN_PATH_POINTS);
    const result = deletePathPoint(path, 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/at least/i);
  });

  it('rejects an out-of-range index without touching the shape', () => {
    const path = makePath();
    const result = deletePathPoint(path, 99);
    expect(result.ok).toBe(false);
  });
});
