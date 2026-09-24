import { describe, expect, it } from 'vitest';

import type { DrawingShape } from '../pages/scene3dTypes';
import { moveShape, shapeBounds, shapeHit, thinPoints, topShapeAt } from './inkGeometry';

const rect: DrawingShape = {
  id: 'r',
  type: 'rect',
  x: 10,
  y: 10,
  width: 100,
  height: 60,
  fill: '#f00',
};
const hollow: DrawingShape = {
  id: 'h',
  type: 'rect',
  x: 10,
  y: 10,
  width: 100,
  height: 60,
  fill: null,
  stroke: '#000',
  strokeWidth: 4,
};
const ellipse: DrawingShape = {
  id: 'e',
  type: 'ellipse',
  cx: 200,
  cy: 100,
  rx: 40,
  ry: 20,
  fill: '#0f0',
};
const line: DrawingShape = {
  id: 'l',
  type: 'line',
  x1: 0,
  y1: 0,
  x2: 100,
  y2: 0,
  stroke: '#00f',
  strokeWidth: 6,
};
const path: DrawingShape = {
  id: 'p',
  type: 'path',
  points: [
    { x: 0, y: 200 },
    { x: 50, y: 250 },
    { x: 100, y: 200 },
  ],
  closed: false,
  stroke: '#f0f',
  strokeWidth: 4,
};

describe('shapeHit (#775)', () => {
  it('hits filled rectangles anywhere inside and hollow ones only near the outline', () => {
    expect(shapeHit(rect, { x: 60, y: 40 }, 2)).toBe(true);
    expect(shapeHit(rect, { x: 200, y: 40 }, 2)).toBe(false);
    expect(shapeHit(hollow, { x: 60, y: 40 }, 2)).toBe(false);
    expect(shapeHit(hollow, { x: 12, y: 40 }, 2)).toBe(true);
  });

  it('hits ellipses, lines, and paths within the eraser radius', () => {
    expect(shapeHit(ellipse, { x: 200, y: 100 }, 1)).toBe(true);
    expect(shapeHit(ellipse, { x: 260, y: 100 }, 1)).toBe(false);
    expect(shapeHit(line, { x: 50, y: 4 }, 2)).toBe(true);
    expect(shapeHit(line, { x: 50, y: 20 }, 2)).toBe(false);
    expect(shapeHit(path, { x: 25, y: 225 }, 2)).toBe(true);
    expect(shapeHit(path, { x: 25, y: 260 }, 2)).toBe(false);
  });

  it('picks the topmost shape under a point', () => {
    const overlapping: DrawingShape = { ...rect, id: 'top', x: 20, y: 20 };
    expect(topShapeAt([rect, overlapping], { x: 50, y: 50 }, 1)?.id).toBe('top');
    expect(topShapeAt([rect, overlapping], { x: 500, y: 500 }, 1)).toBeNull();
  });
});

describe('moveShape and shapeBounds (#775)', () => {
  it('translates every shape kind without mutating the original', () => {
    expect(moveShape(rect, 5, -5)).toMatchObject({ x: 15, y: 5 });
    expect(moveShape(ellipse, 1, 2)).toMatchObject({ cx: 201, cy: 102 });
    expect(moveShape(line, 3, 3)).toMatchObject({ x1: 3, y1: 3, x2: 103, y2: 3 });
    expect((moveShape(path, 10, 10) as { points: Array<{ x: number }> }).points[0]!.x).toBe(10);
    expect(rect).toMatchObject({ x: 10, y: 10 });
  });

  it('bounds include half the stroke width', () => {
    expect(shapeBounds(hollow)).toEqual({ x: 8, y: 8, width: 104, height: 64 });
    expect(shapeBounds(path)).toEqual({ x: -2, y: 198, width: 104, height: 54 });
  });
});

describe('thinPoints', () => {
  it('keeps endpoints and drops points nearer than the minimum distance', () => {
    const dense = Array.from({ length: 50 }, (_, i) => ({ x: i * 0.5, y: 0 }));
    const thin = thinPoints(dense, 5);
    expect(thin[0]).toEqual(dense[0]);
    expect(thin[thin.length - 1]).toEqual(dense[dense.length - 1]);
    expect(thin.length).toBeLessThan(dense.length / 4);
  });
});
