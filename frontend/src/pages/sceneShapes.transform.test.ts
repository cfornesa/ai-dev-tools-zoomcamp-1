import { describe, expect, it } from 'vitest';

import {
  applyGroupDrag,
  applyShapeDrag,
  clamp,
  clientToCanvasPoint,
  createShape,
  getCombinedBounds,
  getGroupHandles,
  getShapeRenderTransform,
  getShapeHandles,
  hitTestTopmostShapeAt,
  POSITION_LIMIT,
  renderedPointToShapePoint,
  ROTATION_LIMIT,
  shapeBounds,
  SIZE_LIMIT,
  type Shape,
} from './sceneShapes';

/**
 * Task 26: unit tests for the pointer-manipulation geometry and mutation
 * helpers, independent of the DOM/React wiring in EditorWorkspace.tsx
 * (covered separately in EditorWorkspace.transform.test.tsx).
 */

const CANVAS = { width: 800, height: 600 };

describe('clamp', () => {
  it('passes values already inside the range through unchanged', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to the minimum and maximum', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('treats NaN and +/-Infinity as the minimum rather than letting them through', () => {
    expect(clamp(NaN, 0, 10)).toBe(0);
    expect(clamp(Infinity, 0, 10)).toBe(0);
    expect(clamp(-Infinity, 0, 10)).toBe(0);
  });
});

describe('clientToCanvasPoint', () => {
  it('is the identity conversion when the canvas is rendered at its logical size', () => {
    const rect = { left: 10, top: 20, width: 800, height: 600 };
    expect(clientToCanvasPoint(rect, 410, 320, 800, 600)).toEqual({ x: 400, y: 300 });
  });

  it('scales pointer coordinates up when the canvas is CSS-scaled smaller than its logical size', () => {
    // The canvas is rendered at half its logical 800x600 size (e.g. a
    // narrow viewport triggering `.editor-scene-canvas`'s maxWidth:100%).
    const rect = { left: 0, top: 0, width: 400, height: 300 };
    // A pointer at the rendered box's exact center should map to the
    // logical canvas's center, not a quarter of the way in.
    expect(clientToCanvasPoint(rect, 200, 150, 800, 600)).toEqual({ x: 400, y: 300 });
  });
});

describe('getShapeHandles', () => {
  it('places circle handles relative to its center and radius when unrotated', () => {
    const circle = createShape('circle', 'layer-1', CANVAS); // center (400,300), r=50
    const handles = getShapeHandles(circle);
    expect(handles.move).toEqual({ x: 400, y: 300 });
    expect(handles.resize).toEqual({ x: 450, y: 300 });
    expect(handles.rotate.x).toBeCloseTo(400);
    expect(handles.rotate.y).toBeLessThan(300 - 50); // above the circle
  });

  it('rotates handle positions around the transform origin with the shape', () => {
    const circle = createShape('circle', 'layer-1', CANVAS);
    const rotated: Shape = {
      ...circle,
      transform: { ...circle.transform, rotation: 90 },
    };
    const handles = getShapeHandles(rotated);
    // A +90 degree rotation should move the resize handle from directly
    // right of center to directly below it.
    expect(handles.resize.x).toBeCloseTo(400);
    expect(handles.resize.y).toBeCloseTo(350);
  });

  it('places rect handles at its top-left origin and bottom-right corner when unrotated', () => {
    const rect = createShape('rect', 'layer-1', CANVAS); // top-left (350,260), 100x80
    const handles = getShapeHandles(rect);
    expect(handles.move).toEqual({ x: 350, y: 260 });
    expect(handles.resize).toEqual({ x: 450, y: 340 });
  });

  it('places the line resize handle at its endpoint', () => {
    const line = createShape('line', 'layer-1', CANVAS); // (350,300) -> (450,300)
    const handles = getShapeHandles(line);
    expect(handles.move).toEqual({ x: 350, y: 300 });
    expect(handles.resize).toEqual({ x: 450, y: 300 });
  });

  it('places the path resize handle at the local bounding-box corner', () => {
    const path = createShape('path', 'layer-1', CANVAS);
    if (path.type !== 'path') throw new Error('expected a path');
    const handles = getShapeHandles(path);
    expect(handles.move).toEqual({ x: path.transform.x, y: path.transform.y });
    // The fixture path's points span -50..50 on both axes.
    expect(handles.resize).toEqual({ x: path.transform.x + 50, y: path.transform.y + 50 });
  });
});

describe('render-space geometry (issue #184)', () => {
  it('matches p5 group translation and rotation for bounds and handles', () => {
    const rect = createShape('rect', 'layer-1', CANVAS);
    if (rect.type !== 'rect') throw new Error('expected a rect');
    const grouped: Shape = {
      ...rect,
      transform: { ...rect.transform, rotation: 90 },
    };
    const group = {
      id: 'group-1',
      childIds: [rect.id],
      transform: { x: 100, y: 50, scaleX: 1.5, scaleY: 0.5, rotation: 90, opacity: 1 },
    };

    const localHandles = getShapeHandles(grouped);
    const renderedHandles = getShapeHandles(grouped, [group]);
    const bounds = shapeBounds(grouped, [group]);

    // The group rotates the shape origin (350,260) around the scene origin
    // after applying its scale/translation, exactly as p5's push/translate/
    // rotate/scale stack does.
    expect(renderedHandles.move).not.toEqual(localHandles.move);
    expect(renderedHandles.move.x).toBeCloseTo(-30);
    expect(renderedHandles.move.y).toBeCloseTo(575);
    expect(bounds.minX).toBeLessThan(bounds.maxX);
    expect(bounds.minY).toBeLessThan(bounds.maxY);
  });

  it('uses the rendered group space for hit testing instead of local shape space', () => {
    const circle = createShape('circle', 'layer-1', CANVAS);
    const group = {
      id: 'group-1',
      childIds: [circle.id],
      transform: { x: 200, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    };
    expect(hitTestTopmostShapeAt([circle], 600, 300, [group])?.id).toBe(circle.id);
    expect(hitTestTopmostShapeAt([circle], 400, 300, [group])).toBeNull();
  });

  it('round-trips rendered pointers through the same grouped transform stack', () => {
    const circle = createShape('circle', 'layer-1', CANVAS);
    const group = {
      id: 'group-1',
      childIds: [circle.id],
      transform: { x: 200, y: 40, scaleX: 1.5, scaleY: 0.5, rotation: 30, opacity: 1 },
    };
    const localPoint = { x: 17, y: -9 };
    const rendered = getShapeRenderTransform(circle, [group]);
    const renderedPoint = {
      x: rendered.a * localPoint.x + rendered.c * localPoint.y + rendered.e,
      y: rendered.b * localPoint.x + rendered.d * localPoint.y + rendered.f,
    };
    expect(renderedPointToShapePoint(circle, renderedPoint, [group])).toEqual({
      x: expect.closeTo(circle.transform.x + localPoint.x),
      y: expect.closeTo(circle.transform.y + localPoint.y),
    });
  });
});

describe('applyShapeDrag: move', () => {
  it('translates transform.x/y by the pointer delta', () => {
    const circle = createShape('circle', 'layer-1', CANVAS);
    const updated = applyShapeDrag('move', circle, { x: 400, y: 300 }, { x: 420, y: 260 });
    expect(updated.transform.x).toBe(420);
    expect(updated.transform.y).toBe(260);
  });

  it('clamps position to the schema range even mid-drag', () => {
    const circle = createShape('circle', 'layer-1', CANVAS);
    const updated = applyShapeDrag(
      'move',
      circle,
      { x: 400, y: 300 },
      { x: 1_000_000, y: -1_000_000 },
    );
    expect(updated.transform.x).toBe(POSITION_LIMIT.max);
    expect(updated.transform.y).toBe(POSITION_LIMIT.min);
  });

  it('does not mutate the start shape snapshot', () => {
    const circle = createShape('circle', 'layer-1', CANVAS);
    const originalX = circle.transform.x;
    applyShapeDrag('move', circle, { x: 400, y: 300 }, { x: 420, y: 260 });
    expect(circle.transform.x).toBe(originalX);
  });
});

describe('applyShapeDrag: resize', () => {
  it('sets a circle radius from the pointer distance to its center', () => {
    const circle = createShape('circle', 'layer-1', CANVAS); // center (400,300)
    const updated = applyShapeDrag('resize', circle, { x: 450, y: 300 }, { x: 500, y: 300 });
    if (updated.type !== 'circle') throw new Error('expected a circle');
    expect(updated.radius).toBe(100);
  });

  it('clamps a circle radius at the schema minimum instead of collapsing to zero or negative', () => {
    const circle = createShape('circle', 'layer-1', CANVAS);
    const updated = applyShapeDrag('resize', circle, { x: 450, y: 300 }, { x: 400, y: 300 });
    if (updated.type !== 'circle') throw new Error('expected a circle');
    expect(updated.radius).toBe(SIZE_LIMIT.min);
    expect(updated.radius).toBeGreaterThan(0);
  });

  it('clamps a circle radius at the schema maximum', () => {
    const circle = createShape('circle', 'layer-1', CANVAS);
    const updated = applyShapeDrag('resize', circle, { x: 450, y: 300 }, { x: 100_000, y: 300 });
    if (updated.type !== 'circle') throw new Error('expected a circle');
    expect(updated.radius).toBe(SIZE_LIMIT.max);
  });

  it('sets rect width/height from the pointer position relative to its top-left origin', () => {
    const rect = createShape('rect', 'layer-1', CANVAS); // top-left (350,260)
    const updated = applyShapeDrag('resize', rect, { x: 450, y: 340 }, { x: 500, y: 400 });
    if (updated.type !== 'rect') throw new Error('expected a rect');
    expect(updated.width).toBe(150);
    expect(updated.height).toBe(140);
  });

  it('clamps rect width/height at the schema minimum when shrunk past it', () => {
    const rect = createShape('rect', 'layer-1', CANVAS);
    const updated = applyShapeDrag('resize', rect, { x: 450, y: 340 }, { x: -1000, y: -1000 });
    if (updated.type !== 'rect') throw new Error('expected a rect');
    expect(updated.width).toBe(SIZE_LIMIT.min);
    expect(updated.height).toBe(SIZE_LIMIT.min);
  });

  it('unrotates the pointer before computing rect width/height when the shape is rotated', () => {
    const rect = createShape('rect', 'layer-1', CANVAS);
    if (rect.type !== 'rect') throw new Error('expected a rect');
    const rotated: Shape = { ...rect, transform: { ...rect.transform, rotation: 90 } };
    const handles = getShapeHandles(rotated);
    const updated = applyShapeDrag('resize', rotated, handles.resize, handles.resize);
    if (updated.type !== 'rect') throw new Error('expected a rect');
    // Dragging exactly onto the (already-rotated) resize handle's own
    // current position should reproduce the shape's existing size.
    expect(updated.width).toBeCloseTo(rect.width);
    expect(updated.height).toBeCloseTo(rect.height);
  });

  it('sets the line endpoint from the pointer position', () => {
    const line = createShape('line', 'layer-1', CANVAS); // start (350,300)
    const updated = applyShapeDrag('resize', line, { x: 450, y: 300 }, { x: 500, y: 260 });
    if (updated.type !== 'line') throw new Error('expected a line');
    expect(updated.x2).toBe(500);
    expect(updated.y2).toBe(260);
  });

  it('scales a path uniformly around its origin without distorting proportions', () => {
    const path = createShape('path', 'layer-1', CANVAS);
    if (path.type !== 'path') throw new Error('expected a path');
    const handles = getShapeHandles(path);
    // Drag the resize handle to twice its original distance from the
    // shape's origin.
    const dx = handles.resize.x - path.transform.x;
    const dy = handles.resize.y - path.transform.y;
    const pointer = { x: path.transform.x + dx * 2, y: path.transform.y + dy * 2 };
    const updated = applyShapeDrag('resize', path, handles.resize, pointer);
    if (updated.type !== 'path') throw new Error('expected a path');
    updated.points.forEach((p, i) => {
      expect(p.x).toBeCloseTo(path.points[i].x * 2);
      expect(p.y).toBeCloseTo(path.points[i].y * 2);
    });
  });

  it('clamps a path resize at a small positive scale instead of collapsing every point to the origin', () => {
    const path = createShape('path', 'layer-1', CANVAS);
    if (path.type !== 'path') throw new Error('expected a path');
    // Drag the resize handle exactly onto the shape's own origin.
    const updated = applyShapeDrag('resize', path, getShapeHandles(path).resize, {
      x: path.transform.x,
      y: path.transform.y,
    });
    if (updated.type !== 'path') throw new Error('expected a path');
    const allZero = updated.points.every((p) => p.x === 0 && p.y === 0);
    expect(allZero).toBe(false);
  });
});

describe('applyShapeDrag: rotate', () => {
  it('rotates relative to the shape transform origin, in degrees', () => {
    const circle = createShape('circle', 'layer-1', CANVAS); // center (400,300)
    // Start pointer directly above center, drag to directly right of
    // center: a -90 degree change (screen y grows downward).
    const updated = applyShapeDrag('rotate', circle, { x: 400, y: 200 }, { x: 500, y: 300 });
    expect(updated.transform.rotation).toBeCloseTo(90);
  });

  it('clamps rotation at the schema maximum instead of accumulating past it', () => {
    const circle = createShape('circle', 'layer-1', CANVAS);
    const start: Shape = { ...circle, transform: { ...circle.transform, rotation: 350 } };
    const updated = applyShapeDrag(
      'rotate',
      start,
      { x: 400, y: 200 }, // above center: angle 0 relative offset
      { x: 500, y: 300 }, // right of center: +90 degrees of drag
    );
    expect(updated.transform.rotation).toBe(ROTATION_LIMIT.max);
  });

  it('clamps rotation at the schema minimum in the negative direction', () => {
    const circle = createShape('circle', 'layer-1', CANVAS);
    const start: Shape = { ...circle, transform: { ...circle.transform, rotation: -350 } };
    const updated = applyShapeDrag(
      'rotate',
      start,
      { x: 500, y: 300 }, // right of center
      { x: 400, y: 200 }, // above center: -90 degrees of drag
    );
    expect(updated.transform.rotation).toBe(ROTATION_LIMIT.min);
  });

  it('still produces a usable rotation at a boundary starting value (360)', () => {
    const circle = createShape('circle', 'layer-1', CANVAS);
    const start: Shape = { ...circle, transform: { ...circle.transform, rotation: 360 } };
    const updated = applyShapeDrag(
      'rotate',
      start,
      { x: 500, y: 300 },
      { x: 400, y: 200 }, // -90 degrees of drag, back within range
    );
    expect(updated.transform.rotation).toBeCloseTo(270);
  });
});

/**
 * Issue #77: unit tests for the combined bounding-box geometry and
 * multi-shape gesture math, the group analogue of the single-shape tests
 * above. `EditorWorkspace.multiTransform.test.tsx` covers the DOM/gesture
 * wiring (handle visibility, selection-membership fallback, undo
 * grouping); these are pure-function tests independent of that wiring.
 */

function makeCircle(id: string, x: number, y: number, radius = 20, rotation = 0): Shape {
  return {
    id,
    layerId: 'layer-1',
    groupId: null,
    transform: { x, y, scaleX: 1, scaleY: 1, rotation, opacity: 1 },
    style: { fill: '#4f46e5', stroke: null, strokeWidth: 2 },
    type: 'circle',
    radius,
  };
}

function makeRect(id: string, x: number, y: number, width: number, height: number): Shape {
  return {
    id,
    layerId: 'layer-1',
    groupId: null,
    transform: { x, y, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    style: { fill: '#4f46e5', stroke: null, strokeWidth: 2 },
    type: 'rect',
    width,
    height,
    cornerRadius: 0,
  };
}

describe('getCombinedBounds', () => {
  it('returns null for an empty list', () => {
    expect(getCombinedBounds([])).toBeNull();
  });

  it('unions the bounds of every shape', () => {
    const circle = createShape('circle', 'layer-1', CANVAS); // center (400,300), r=50
    const rect = createShape('rect', 'layer-1', CANVAS); // top-left (350,260), 100x80
    const bounds = getCombinedBounds([circle, rect]);
    expect(bounds).toEqual({ minX: 350, minY: 250, maxX: 450, maxY: 350 });
  });
});

describe('getGroupHandles', () => {
  it('places move/resize/rotate at the center, bottom-right corner, and above the top edge', () => {
    const bounds = { minX: 350, minY: 250, maxX: 450, maxY: 350 };
    const handles = getGroupHandles(bounds);
    expect(handles.move).toEqual({ x: 400, y: 300 });
    expect(handles.resize).toEqual({ x: 450, y: 350 });
    expect(handles.rotate.x).toBeCloseTo(400);
    expect(handles.rotate.y).toBeLessThan(bounds.minY);
  });
});

describe('applyGroupDrag: move', () => {
  it('applies the same pointer delta to every shape, preserving relative offsets', () => {
    const shapes = [makeCircle('a', 100, 100), makeCircle('b', 300, 300)];
    const bounds = getCombinedBounds(shapes)!;
    const updated = applyGroupDrag('move', shapes, bounds, { x: 0, y: 0 }, { x: 50, y: 20 });
    expect(updated[0].transform.x).toBe(150);
    expect(updated[0].transform.y).toBe(120);
    expect(updated[1].transform.x).toBe(350);
    expect(updated[1].transform.y).toBe(320);
    // Relative offset between the two shapes is unchanged.
    expect(updated[1].transform.x - updated[0].transform.x).toBe(200);
    expect(updated[1].transform.y - updated[0].transform.y).toBe(200);
  });

  it('does not mutate the start shapes snapshot', () => {
    const shapes = [makeCircle('a', 100, 100)];
    const bounds = getCombinedBounds(shapes)!;
    applyGroupDrag('move', shapes, bounds, { x: 0, y: 0 }, { x: 50, y: 20 });
    expect(shapes[0].transform.x).toBe(100);
  });

  it('clamps one shape at its position limit while the rest of the group keeps moving', () => {
    const shapes = [makeCircle('a', POSITION_LIMIT.max - 10, 0), makeCircle('b', 0, 0)];
    const bounds = getCombinedBounds(shapes)!;
    const updated = applyGroupDrag('move', shapes, bounds, { x: 0, y: 0 }, { x: 1000, y: 0 });
    expect(updated[0].transform.x).toBe(POSITION_LIMIT.max); // clamped, stops here
    expect(updated[1].transform.x).toBe(1000); // unaffected, keeps moving normally
  });
});

describe('applyGroupDrag: resize', () => {
  it('scales the whole group uniformly from the combined box anchored at the opposite corner', () => {
    const rect1 = makeRect('a', 0, 0, 100, 100);
    const rect2 = makeRect('b', 100, 100, 50, 50);
    const shapes = [rect1, rect2];
    const bounds = getCombinedBounds(shapes)!; // {minX:0,minY:0,maxX:150,maxY:150}
    const handles = getGroupHandles(bounds); // resize handle at (150,150)
    // Drag the resize handle to twice its original distance from the
    // opposite (top-left) anchor corner.
    const pointer = { x: handles.resize.x * 2, y: handles.resize.y * 2 };
    const updated = applyGroupDrag('resize', shapes, bounds, handles.resize, pointer);
    const a = updated.find((s) => s.id === 'a');
    const b = updated.find((s) => s.id === 'b');
    if (a?.type !== 'rect' || b?.type !== 'rect') throw new Error('expected rects');
    expect(a.transform.x).toBeCloseTo(0);
    expect(a.transform.y).toBeCloseTo(0);
    expect(a.width).toBeCloseTo(200);
    expect(a.height).toBeCloseTo(200);
    expect(b.transform.x).toBeCloseTo(200);
    expect(b.transform.y).toBeCloseTo(200);
    expect(b.width).toBeCloseTo(100);
    expect(b.height).toBeCloseTo(100);
  });

  it('clamps one shape at its size limit while the rest of the group keeps scaling', () => {
    const big = makeRect('a', 0, 0, 4990, 10);
    const small = makeRect('b', 0, 0, 10, 10);
    const shapes = [big, small];
    const bounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const updated = applyGroupDrag(
      'resize',
      shapes,
      bounds,
      { x: 10, y: 10 },
      { x: 100, y: 100 }, // scale factor 10
    );
    const a = updated.find((s) => s.id === 'a');
    const b = updated.find((s) => s.id === 'b');
    if (a?.type !== 'rect' || b?.type !== 'rect') throw new Error('expected rects');
    expect(a.width).toBe(SIZE_LIMIT.max); // clamped, stops here
    expect(b.width).toBeCloseTo(100); // unaffected, keeps scaling normally
  });
});

describe('applyGroupDrag: rotate', () => {
  it('rotates every shape rigidly around the shared pivot, preserving their arrangement', () => {
    const shapeA = makeCircle('a', 100, 0);
    const shapeB = makeCircle('b', 300, 0);
    const shapes = [shapeA, shapeB];
    const bounds = { minX: 0, minY: -50, maxX: 400, maxY: 50 }; // pivot at (200, 0)
    const updated = applyGroupDrag(
      'rotate',
      shapes,
      bounds,
      { x: 200, y: -100 }, // above the pivot
      { x: 300, y: 0 }, // right of the pivot: +90 degrees
    );
    const a = updated.find((s) => s.id === 'a')!;
    const b = updated.find((s) => s.id === 'b')!;
    expect(a.transform.x).toBeCloseTo(200);
    expect(a.transform.y).toBeCloseTo(-100);
    expect(b.transform.x).toBeCloseTo(200);
    expect(b.transform.y).toBeCloseTo(100);
    expect(a.transform.rotation).toBeCloseTo(90);
    expect(b.transform.rotation).toBeCloseTo(90);
    // The distance between the two shapes (their arrangement) is preserved.
    const distance = Math.hypot(b.transform.x - a.transform.x, b.transform.y - a.transform.y);
    expect(distance).toBeCloseTo(200);
  });

  it('clamps one shape rotation at its limit while the rest of the group keeps rotating', () => {
    const shapeA = makeCircle('a', 100, 0, 20, 350);
    const shapeB = makeCircle('b', 300, 0, 20, 0);
    const shapes = [shapeA, shapeB];
    const bounds = { minX: 0, minY: -50, maxX: 400, maxY: 50 };
    const updated = applyGroupDrag(
      'rotate',
      shapes,
      bounds,
      { x: 200, y: -100 },
      { x: 300, y: 0 }, // +90 degrees
    );
    const a = updated.find((s) => s.id === 'a')!;
    const b = updated.find((s) => s.id === 'b')!;
    expect(a.transform.rotation).toBe(ROTATION_LIMIT.max); // clamped, stops here
    expect(b.transform.rotation).toBeCloseTo(90); // unaffected, keeps rotating normally
    // Position still rotates for both shapes regardless of the rotation
    // field's own clamp — never an all-or-nothing abort.
    expect(a.transform.y).toBeCloseTo(-100);
    expect(b.transform.y).toBeCloseTo(100);
  });
});
