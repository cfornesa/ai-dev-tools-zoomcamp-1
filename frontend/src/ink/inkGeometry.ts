/**
 * Issues #775/#776/#781: pure geometry for the shared ink editor core. Everything works in the drawing's
 * own pixel space (origin top-left, y down) on `DrawingShape` values, so the same tool core edits a 3D
 * drawing plane's drawing today and any other vector drawing tomorrow.
 */
import type { DrawingShape } from '../pages/scene3dTypes';

export type InkPoint = { x: number; y: number };

function distanceToSegment(point: InkPoint, a: InkPoint, b: InkPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function pointInPolygon(point: InkPoint, polygon: InkPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** True when `point` touches `shape` within `radius`: on its outline, or inside a filled area. */
export function shapeHit(shape: DrawingShape, point: InkPoint, radius: number): boolean {
  const filled = Boolean(shape.fill);
  const half = Math.max(0, (shape.strokeWidth ?? 0) / 2);
  const reach = radius + half;
  switch (shape.type) {
    case 'rect': {
      const inside =
        point.x >= shape.x - reach &&
        point.x <= shape.x + shape.width + reach &&
        point.y >= shape.y - reach &&
        point.y <= shape.y + shape.height + reach;
      if (!inside) return false;
      if (filled) return true;
      const innerLeft = shape.x + reach;
      const innerRight = shape.x + shape.width - reach;
      const innerTop = shape.y + reach;
      const innerBottom = shape.y + shape.height - reach;
      return !(
        point.x > innerLeft &&
        point.x < innerRight &&
        point.y > innerTop &&
        point.y < innerBottom
      );
    }
    case 'ellipse': {
      const nx = (point.x - shape.cx) / (shape.rx + reach);
      const ny = (point.y - shape.cy) / (shape.ry + reach);
      const outer = nx * nx + ny * ny <= 1;
      if (!outer) return false;
      if (filled) return true;
      const ix = (point.x - shape.cx) / Math.max(1, shape.rx - reach);
      const iy = (point.y - shape.cy) / Math.max(1, shape.ry - reach);
      return ix * ix + iy * iy >= 1;
    }
    case 'line':
      return (
        distanceToSegment(point, { x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 }) <=
        reach
      );
    case 'path': {
      if (shape.points.length === 1) {
        return Math.hypot(point.x - shape.points[0]!.x, point.y - shape.points[0]!.y) <= reach;
      }
      for (let i = 0; i < shape.points.length - 1; i += 1) {
        if (distanceToSegment(point, shape.points[i]!, shape.points[i + 1]!) <= reach) return true;
      }
      if (shape.closed && shape.points.length > 2) {
        const first = shape.points[0]!;
        const last = shape.points[shape.points.length - 1]!;
        if (distanceToSegment(point, last, first) <= reach) return true;
        if (filled && pointInPolygon(point, shape.points)) return true;
      }
      return false;
    }
  }
}

/** The topmost (last drawn) shape under `point`, or null. */
export function topShapeAt(
  shapes: DrawingShape[],
  point: InkPoint,
  radius: number,
): DrawingShape | null {
  for (let i = shapes.length - 1; i >= 0; i -= 1) {
    if (shapeHit(shapes[i]!, point, radius)) return shapes[i]!;
  }
  return null;
}

/** A copy of `shape` moved by (dx, dy). */
export function moveShape(shape: DrawingShape, dx: number, dy: number): DrawingShape {
  switch (shape.type) {
    case 'rect':
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    case 'ellipse':
      return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy };
    case 'line':
      return {
        ...shape,
        x1: shape.x1 + dx,
        y1: shape.y1 + dy,
        x2: shape.x2 + dx,
        y2: shape.y2 + dy,
      };
    case 'path':
      return { ...shape, points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  }
}

export type Bounds = { x: number; y: number; width: number; height: number };

export function shapeBounds(shape: DrawingShape): Bounds {
  const pad = (shape.strokeWidth ?? 0) / 2;
  let minX: number, minY: number, maxX: number, maxY: number;
  switch (shape.type) {
    case 'rect':
      [minX, minY, maxX, maxY] = [shape.x, shape.y, shape.x + shape.width, shape.y + shape.height];
      break;
    case 'ellipse':
      [minX, minY, maxX, maxY] = [
        shape.cx - shape.rx,
        shape.cy - shape.ry,
        shape.cx + shape.rx,
        shape.cy + shape.ry,
      ];
      break;
    case 'line':
      [minX, minY, maxX, maxY] = [
        Math.min(shape.x1, shape.x2),
        Math.min(shape.y1, shape.y2),
        Math.max(shape.x1, shape.x2),
        Math.max(shape.y1, shape.y2),
      ];
      break;
    case 'path':
      minX = Math.min(...shape.points.map((p) => p.x));
      maxX = Math.max(...shape.points.map((p) => p.x));
      minY = Math.min(...shape.points.map((p) => p.y));
      maxY = Math.max(...shape.points.map((p) => p.y));
      break;
  }
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + 2 * pad,
    height: maxY - minY + 2 * pad,
  };
}

/** Drops points closer than `minDistance` to their predecessor so a slow drag stays compact. */
export function thinPoints(points: InkPoint[], minDistance: number): InkPoint[] {
  if (points.length <= 2) return points;
  const kept: InkPoint[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i += 1) {
    const last = kept[kept.length - 1]!;
    if (Math.hypot(points[i]!.x - last.x, points[i]!.y - last.y) >= minDistance)
      kept.push(points[i]!);
  }
  kept.push(points[points.length - 1]!);
  return kept;
}
