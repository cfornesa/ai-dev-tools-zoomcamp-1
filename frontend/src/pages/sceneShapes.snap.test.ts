import { describe, expect, it } from 'vitest';

import {
  applyMoveSnap,
  applyResizeSnap,
  applyShapeDrag,
  createShape,
  findAlignmentGuides,
  GRID_SIZE,
  POSITION_LIMIT,
  SIZE_LIMIT,
  shapeBounds,
  SNAP_TOLERANCE,
  snapValueToGrid,
  type Bounds,
  type Shape,
} from './sceneShapes';

/**
 * Issue #78: unit tests for the pure snap-to-grid / alignment-guide
 * geometry helpers, independent of the DOM/React wiring in
 * EditorWorkspace.tsx (covered separately in EditorWorkspace.snap.test.tsx).
 * Mirrors sceneShapes.transform.test.ts's own structure/conventions.
 */

const CANVAS = { width: 800, height: 600 };

describe('snapValueToGrid', () => {
  it('snaps to the nearest grid line when within tolerance', () => {
    expect(snapValueToGrid(404)).toBe(400); // 4 units off a 20-unit grid line
    expect(snapValueToGrid(396)).toBe(400); // 4 units off, from the other side
    expect(snapValueToGrid(408)).toBe(400); // exactly at the 8-unit tolerance
  });

  it('leaves the value unsnapped once it is farther than the tolerance', () => {
    expect(snapValueToGrid(409)).toBe(409); // 9 units off — just outside tolerance
    expect(snapValueToGrid(410)).toBe(410); // exactly halfway between two grid lines
  });

  it('respects a custom grid size and tolerance', () => {
    expect(snapValueToGrid(53, 50, 5)).toBe(50);
    expect(snapValueToGrid(44, 50, 5)).toBe(44);
  });

  it('treats a non-finite value as a no-op rather than throwing or producing NaN', () => {
    expect(snapValueToGrid(NaN)).toBe(NaN);
    expect(snapValueToGrid(Infinity)).toBe(Infinity);
  });

  it('uses the shared defaults (grid 20, tolerance 8) matching issue #78', () => {
    expect(GRID_SIZE).toBe(20);
    expect(SNAP_TOLERANCE).toBe(8);
  });
});

describe('findAlignmentGuides', () => {
  const dragged: Bounds = { minX: 96, maxX: 146, minY: 100, maxY: 150 }; // center (121, 125)

  it('finds no guides when there are no siblings (single-shape-in-scene case)', () => {
    const guides = findAlignmentGuides(dragged, []);
    expect(guides).toEqual({ x: null, y: null });
  });

  it('aligns the dragged shape edge to a sibling edge within tolerance', () => {
    // Sibling's left edge (100) is 4 units from dragged's left edge (96).
    const sibling: Bounds = { minX: 100, maxX: 200, minY: 300, maxY: 400 };
    const guides = findAlignmentGuides(dragged, [sibling]);
    expect(guides.x).toEqual({ axis: 'x', value: 100 });
  });

  it('finds no guide for an axis once every candidate is outside tolerance', () => {
    const farSibling: Bounds = { minX: 500, maxX: 600, minY: 500, maxY: 600 };
    const guides = findAlignmentGuides(dragged, [farSibling]);
    expect(guides).toEqual({ x: null, y: null });
  });

  it('aligns to a sibling center, not just its edges', () => {
    // Sibling center x = (300+340)/2 = 320. Dragged center x = 121; make
    // dragged's own center close to 320 instead.
    const centeredDragged: Bounds = { minX: 296, maxX: 346, minY: 100, maxY: 150 }; // center 321
    const sibling: Bounds = { minX: 300, maxX: 340, minY: 500, maxY: 540 }; // center 320
    const guides = findAlignmentGuides(centeredDragged, [sibling]);
    expect(guides.x).toEqual({ axis: 'x', value: 320 });
  });

  it('picks the closest candidate when multiple siblings are in tolerance', () => {
    const near: Bounds = { minX: 99, maxX: 199, minY: 0, maxY: 10 }; // 3 units from 96
    const far: Bounds = { minX: 90, maxX: 190, minY: 0, maxY: 10 }; // 6 units from 96
    const guides = findAlignmentGuides(dragged, [far, near]);
    expect(guides.x).toEqual({ axis: 'x', value: 99 });
  });

  it('resolves x and y guides independently against different siblings', () => {
    const xSibling: Bounds = { minX: 100, maxX: 200, minY: 900, maxY: 950 }; // aligns x only
    const ySibling: Bounds = { minX: 900, maxX: 950, minY: 104, maxY: 200 }; // aligns y only
    const guides = findAlignmentGuides(dragged, [xSibling, ySibling]);
    expect(guides.x).toEqual({ axis: 'x', value: 100 });
    // dragged's own maxY (150) is only 2 units from ySibling's center (152)
    // — the closest candidate pair — so that wins over minY (100) vs
    // ySibling.minY (104), which is 4 units off.
    expect(guides.y).toEqual({ axis: 'y', value: 152 });
  });
});

describe('applyMoveSnap', () => {
  function circleAt(x: number, y: number): Shape {
    const base = createShape('circle', 'layer-1', CANVAS);
    return { ...base, transform: { ...base.transform, x, y } };
  }

  it('is a no-op when both grid and guides are disabled', () => {
    const updated = circleAt(404, 296);
    const result = applyMoveSnap(updated, [], { gridEnabled: false, guidesEnabled: false });
    expect(result.shape).toBe(updated);
    expect(result.guides).toEqual({ x: null, y: null });
  });

  it('snaps to the grid when enabled and the position is within tolerance', () => {
    const updated = circleAt(404, 396); // 4 units off (400,400) grid lines... y target is 400
    const result = applyMoveSnap(updated, [], { gridEnabled: true, guidesEnabled: false });
    expect(result.shape.transform.x).toBe(400);
    expect(result.shape.transform.y).toBe(400);
    expect(result.guides).toEqual({ x: null, y: null });
  });

  it('does not snap to the grid once the position is farther than tolerance', () => {
    const updated = circleAt(410, 300); // 410 is exactly between grid lines
    const result = applyMoveSnap(updated, [], { gridEnabled: true, guidesEnabled: false });
    expect(result.shape.transform.x).toBe(410);
    expect(result.shape.transform.y).toBe(300); // already grid-aligned
  });

  it('a lone shape in the scene (no siblings) still grid-snaps even with guides enabled', () => {
    const updated = circleAt(404, 300);
    const result = applyMoveSnap(updated, [], { gridEnabled: true, guidesEnabled: true });
    expect(result.shape.transform.x).toBe(400);
    expect(result.guides).toEqual({ x: null, y: null });
  });

  it('snaps to a sibling alignment guide when guides are enabled', () => {
    // Circle radius 50; place it so its left edge (x-50) is 3 units from a
    // sibling's left edge at 250 -> dragged left edge at 253, so x = 303.
    const updated = circleAt(303, 300);
    const sibling: Bounds = { minX: 250, maxX: 350, minY: 900, maxY: 950 };
    const result = applyMoveSnap(updated, [sibling], {
      gridEnabled: false,
      guidesEnabled: true,
    });
    expect(result.shape.transform.x).toBe(300); // left edge now exactly 250
    expect(result.guides.x).toEqual({ axis: 'x', value: 250 });
    expect(shapeBounds(result.shape).minX).toBe(250);
  });

  it('does not generate a guide against the dragged shape itself', () => {
    // Caller is responsible for excluding the dragged shape from
    // `siblingBounds`; passing the shape's own bounds back in must never
    // "align" it with itself and force dx/dy to 0 as if that were a real
    // guide hit — here it coincidentally already IS a real (harmless) 0/0
    // no-op, so this asserts the *contract*: siblingBounds must exclude
    // self, and when it correctly does (empty here), no guide appears.
    const updated = circleAt(303, 300);
    const result = applyMoveSnap(updated, [], { gridEnabled: false, guidesEnabled: true });
    expect(result.guides).toEqual({ x: null, y: null });
    expect(result.shape).toBe(updated);
  });

  it('alignment guides take precedence over the grid on the same axis when both are in range', () => {
    // x=404 is 4 units from grid line 400. Also place a sibling whose edge
    // is 2 units away (closer, and a different target) to prove the guide
    // — not the grid — wins.
    const updated = circleAt(404, 300);
    const sibling: Bounds = { minX: 452, maxX: 552, minY: 900, maxY: 950 }; // dragged right edge (454) -> 452 is 2 away
    const result = applyMoveSnap(updated, [sibling], {
      gridEnabled: true,
      guidesEnabled: true,
    });
    // Guide wins: right edge (x+50) snaps exactly to 452, i.e. x = 402 —
    // NOT the grid's 400.
    expect(result.shape.transform.x).toBe(402);
    expect(result.guides.x).toEqual({ axis: 'x', value: 452 });
  });

  it('falls back to the grid on an axis with no guide in range, even while a guide wins the other axis', () => {
    const updated = circleAt(404, 396); // x has a guide target nearby; y has only grid nearby
    const sibling: Bounds = { minX: 452, maxX: 552, minY: 900, maxY: 950 }; // x-only guide
    const result = applyMoveSnap(updated, [sibling], {
      gridEnabled: true,
      guidesEnabled: true,
    });
    expect(result.guides.x).toEqual({ axis: 'x', value: 452 });
    expect(result.guides.y).toBeNull();
    expect(result.shape.transform.x).toBe(402); // guide-derived
    expect(result.shape.transform.y).toBe(400); // grid-derived
  });

  it('still clamps a snapped position to POSITION_LIMIT', () => {
    const updated = circleAt(POSITION_LIMIT.max - 3, 300); // near the max, 3 off a grid line beyond it
    const result = applyMoveSnap(updated, [], { gridEnabled: true, guidesEnabled: false });
    expect(result.shape.transform.x).toBeLessThanOrEqual(POSITION_LIMIT.max);
    expect(Number.isFinite(result.shape.transform.x)).toBe(true);
  });
});

describe('applyResizeSnap', () => {
  it('is a no-op when grid snapping is disabled', () => {
    const circle = createShape('circle', 'layer-1', CANVAS); // center (400,300), r=50
    const startPointer = { x: 450, y: 300 };
    const updated = applyShapeDrag('resize', circle, startPointer, { x: 454, y: 300 }); // r=54
    const result = applyResizeSnap(circle, startPointer, updated, { gridEnabled: false });
    expect(result).toBe(updated);
  });

  it('snaps a circle resize handle to the grid, adjusting the radius accordingly', () => {
    const circle = createShape('circle', 'layer-1', CANVAS); // center (400,300), r=50
    const startPointer = { x: 450, y: 300 };
    // Resize handle sits at (x + radius, y) = (454, 300); 454 is 6 units
    // from the grid line 460, well within tolerance.
    const updated = applyShapeDrag('resize', circle, startPointer, { x: 454, y: 300 });
    const result = applyResizeSnap(circle, startPointer, updated, { gridEnabled: true });
    expect(result.type).toBe('circle');
    if (result.type === 'circle') {
      expect(result.radius).toBe(60); // handle now at (460, 300) => radius 60
    }
  });

  it('leaves the resize unsnapped once the handle point is farther than tolerance from any grid line', () => {
    const circle = createShape('circle', 'layer-1', CANVAS);
    const startPointer = { x: 450, y: 300 };
    const updated = applyShapeDrag('resize', circle, startPointer, { x: 470, y: 300 }); // exactly between grid lines
    const result = applyResizeSnap(circle, startPointer, updated, { gridEnabled: true });
    expect(result).toBe(updated);
  });

  it('snaps a rect resize handle (bottom-right corner) to the grid on both axes', () => {
    const rect = createShape('rect', 'layer-1', CANVAS); // top-left (350,260), 100x80
    const startPointer = { x: 450, y: 340 }; // the unrotated resize handle start
    // Drag to (454, 344): corner at (454,344) is 6 units from (460,340) on
    // both axes (14 from (460,340)? recompute: 454->460 diff 6; 344->340
    // diff 4 — both within tolerance of the same grid intersection).
    const updated = applyShapeDrag('resize', rect, startPointer, { x: 454, y: 344 });
    const result = applyResizeSnap(rect, startPointer, updated, { gridEnabled: true });
    expect(result.type).toBe('rect');
    if (result.type === 'rect') {
      // top-left is (350,260); snapped corner (460,340) => width 110, height 80.
      expect(result.width).toBe(110);
      expect(result.height).toBe(80);
    }
  });

  it('still clamps a snapped resize to SIZE_LIMIT', () => {
    const circle = createShape('circle', 'layer-1', CANVAS);
    const startPointer = { x: 450, y: 300 };
    // Shrink almost onto the center; handle point near (400,300) — pick a
    // point 3 units from a grid line very close to the shape's own center,
    // resulting in a tiny/clamped radius rather than NaN/negative.
    const updated = applyShapeDrag('resize', circle, startPointer, { x: 400.5, y: 300 });
    const result = applyResizeSnap(circle, startPointer, updated, { gridEnabled: true });
    expect(result.type).toBe('circle');
    if (result.type === 'circle') {
      expect(result.radius).toBeGreaterThanOrEqual(SIZE_LIMIT.min);
      expect(Number.isFinite(result.radius)).toBe(true);
    }
  });
});
