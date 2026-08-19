import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { MAX_PATH_POINTS, MIN_PATH_POINTS } from './sceneShapes';
import { useSceneEditor } from './useSceneEditor';

/**
 * Issue #79: hook-level tests for `useSceneEditor`'s per-vertex path-
 * editing mutations — `insertVertexAtPoint`/`deleteVertexAt`/
 * `addVertexNearLast`/`updateVertexPointField`, plus the
 * `toggleVertexEditMode`/`selectVertex`/`exitVertexEditMode` mode state.
 *
 * The `MAX_PATH_POINTS`/`MIN_PATH_POINTS` boundary cases in particular are
 * covered here rather than by mounting the full DOM component tree
 * (`EditorWorkspace.vertexEdit.test.tsx`): a 500-point shape rendered
 * through the real Inspector mounts one keyboard-accessible X/Y field pair
 * per point, which is prohibitively expensive for a DOM-rendered test but
 * cheap here, since this file drives `useSceneEditor` directly.
 */

function pathScene(points: { x: number; y: number }[]): SceneDocument {
  return {
    schemaVersion: 1,
    id: 'scene-1',
    canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
    renderer: { preferred: 'p5' },
    layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
    shapes: [
      {
        id: 'path-1',
        type: 'path',
        layerId: 'layer-1',
        groupId: null,
        transform: { x: 400, y: 300, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        style: { fill: '#4f46e5', stroke: '#1e1b4b', strokeWidth: 2 },
        points,
        closed: true,
      },
    ],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
  } as unknown as SceneDocument;
}

const DEFAULT_POINTS = [
  { x: 0, y: -50 },
  { x: 50, y: 0 },
  { x: 0, y: 50 },
  { x: -50, y: 0 },
];

function renderSceneEditor(initial: SceneDocument) {
  return renderHook(() => {
    const [workingCopy, setWorkingCopy] = useState<SceneDocument | null>(initial);
    const editor = useSceneEditor(workingCopy, setWorkingCopy);
    return { ...editor, workingCopy };
  });
}

describe('useSceneEditor vertex edit mode', () => {
  it('only turns on for a selected path shape, and toggles off unconditionally', () => {
    const { result } = renderSceneEditor(pathScene(DEFAULT_POINTS));
    act(() => result.current.selectShape('path-1'));
    expect(result.current.vertexEditActive).toBe(false);

    act(() => result.current.toggleVertexEditMode());
    expect(result.current.vertexEditActive).toBe(true);

    act(() => result.current.toggleVertexEditMode());
    expect(result.current.vertexEditActive).toBe(false);
  });

  it('exits automatically when the selection changes', () => {
    const scene = pathScene(DEFAULT_POINTS);
    (scene.shapes as unknown[]).push({
      id: 'circle-1',
      type: 'circle',
      layerId: 'layer-1',
      groupId: null,
      transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
      style: { fill: '#4f46e5', stroke: null, strokeWidth: 2 },
      radius: 50,
    });
    const { result } = renderSceneEditor(scene);
    act(() => result.current.selectShape('path-1'));
    act(() => result.current.toggleVertexEditMode());
    expect(result.current.vertexEditActive).toBe(true);

    act(() => result.current.selectShape('circle-1'));
    expect(result.current.vertexEditActive).toBe(false);
  });

  it('selectVertex sets and clears the selected-vertex index independent of shape selection', () => {
    const { result } = renderSceneEditor(pathScene(DEFAULT_POINTS));
    act(() => result.current.selectShape('path-1'));
    act(() => result.current.selectVertex(2));
    expect(result.current.selectedVertexIndex).toBe(2);
    act(() => result.current.selectVertex(null));
    expect(result.current.selectedVertexIndex).toBeNull();
  });
});

describe('useSceneEditor insertVertexAtPoint', () => {
  it('inserts a point on the nearest segment as one undo step', () => {
    const { result } = renderSceneEditor(pathScene(DEFAULT_POINTS));
    act(() => result.current.selectShape('path-1'));
    const before = result.current.canUndo;
    expect(before).toBe(false);

    // Midpoint of segment 0 (points[0]=(0,-50) -> points[1]=(50,0)) in
    // canvas space: transform (400,300) + local (25,-25) = (425,275).
    act(() => result.current.insertVertexAtPoint({ x: 425, y: 275 }));

    expect(result.current.selectedShape?.type).toBe('path');
    const shape = result.current.selectedShape as unknown as { points: { x: number; y: number }[] };
    expect(shape.points).toHaveLength(DEFAULT_POINTS.length + 1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.vertexError).toBeNull();

    act(() => result.current.undo());
    expect((result.current.selectedShape as unknown as { points: unknown[] }).points).toHaveLength(
      DEFAULT_POINTS.length,
    );
  });

  it('is a silent no-op when the point is too far from every segment', () => {
    const { result } = renderSceneEditor(pathScene(DEFAULT_POINTS));
    act(() => result.current.selectShape('path-1'));

    act(() => result.current.insertVertexAtPoint({ x: 0, y: 0 }));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.vertexError).toBeNull();
  });

  it('rejects an insert at MAX_PATH_POINTS with a vertexError message and no mutation', () => {
    const points = Array.from({ length: MAX_PATH_POINTS }, (_, i) => ({
      x: 50 * Math.cos((2 * Math.PI * i) / MAX_PATH_POINTS),
      y: 50 * Math.sin((2 * Math.PI * i) / MAX_PATH_POINTS),
    }));
    const { result } = renderSceneEditor(pathScene(points));
    act(() => result.current.selectShape('path-1'));

    // The very first point of this "circle" of points sits at (450, 300)
    // (angle 0), which is within tolerance of the segments touching it.
    act(() => result.current.insertVertexAtPoint({ x: 450, y: 300 }));

    expect(result.current.vertexError).toMatch(/maximum of 500 points/i);
    expect(result.current.canUndo).toBe(false);
    expect((result.current.selectedShape as unknown as { points: unknown[] }).points).toHaveLength(
      MAX_PATH_POINTS,
    );
  });
});

describe('useSceneEditor addVertexNearLast', () => {
  it('appends a point near the last point as one undo step', () => {
    const { result } = renderSceneEditor(pathScene(DEFAULT_POINTS));
    act(() => result.current.selectShape('path-1'));

    act(() => result.current.addVertexNearLast());

    const shape = result.current.selectedShape as unknown as { points: { x: number; y: number }[] };
    expect(shape.points).toHaveLength(DEFAULT_POINTS.length + 1);
    const last = DEFAULT_POINTS[DEFAULT_POINTS.length - 1];
    expect(shape.points[shape.points.length - 1]).toEqual({ x: last.x + 20, y: last.y + 20 });
    expect(result.current.canUndo).toBe(true);
  });

  it('rejects at MAX_PATH_POINTS with a vertexError message and no mutation', () => {
    const points = Array.from({ length: MAX_PATH_POINTS }, (_, i) => ({ x: i, y: 0 }));
    const { result } = renderSceneEditor(pathScene(points));
    act(() => result.current.selectShape('path-1'));

    act(() => result.current.addVertexNearLast());

    expect(result.current.vertexError).toMatch(/maximum of 500 points/i);
    expect(result.current.canUndo).toBe(false);
  });
});

describe('useSceneEditor deleteVertexAt', () => {
  it('removes the point at the given index as one undo step', () => {
    const { result } = renderSceneEditor(pathScene(DEFAULT_POINTS));
    act(() => result.current.selectShape('path-1'));

    act(() => result.current.deleteVertexAt(1));

    const shape = result.current.selectedShape as unknown as { points: { x: number; y: number }[] };
    expect(shape.points).toHaveLength(DEFAULT_POINTS.length - 1);
    expect(shape.points).not.toContainEqual(DEFAULT_POINTS[1]);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect((result.current.selectedShape as unknown as { points: unknown[] }).points).toHaveLength(
      DEFAULT_POINTS.length,
    );
  });

  it('rejects at MIN_PATH_POINTS with a vertexError message and no mutation', () => {
    const points = [
      { x: 0, y: -50 },
      { x: 50, y: 0 },
    ];
    expect(points).toHaveLength(MIN_PATH_POINTS);
    const { result } = renderSceneEditor(pathScene(points));
    act(() => result.current.selectShape('path-1'));

    act(() => result.current.deleteVertexAt(0));

    expect(result.current.vertexError).toMatch(/at least 2 points/i);
    expect(result.current.canUndo).toBe(false);
    expect((result.current.selectedShape as unknown as { points: unknown[] }).points).toHaveLength(
      MIN_PATH_POINTS,
    );
  });
});

describe('useSceneEditor updateVertexPointField', () => {
  it('parses, clamps, and commits a valid edit to one axis of one point', () => {
    const { result } = renderSceneEditor(pathScene(DEFAULT_POINTS));
    act(() => result.current.selectShape('path-1'));

    let outcome: { ok: true } | { ok: false; error: string } = { ok: false, error: '' };
    act(() => {
      outcome = result.current.updateVertexPointField(0, 'x', '999999');
    });

    expect(outcome).toEqual({ ok: true });
    const shape = result.current.selectedShape as unknown as { points: { x: number; y: number }[] };
    expect(shape.points[0].x).toBe(100000); // clamped to POSITION_LIMIT.max
    expect(shape.points[0].y).toBe(DEFAULT_POINTS[0].y); // untouched
    expect(shape.points[1]).toEqual(DEFAULT_POINTS[1]); // other points untouched
    expect(result.current.canUndo).toBe(true);
  });

  it('rejects non-finite text without touching scene state', () => {
    const { result } = renderSceneEditor(pathScene(DEFAULT_POINTS));
    act(() => result.current.selectShape('path-1'));

    let outcome: { ok: true } | { ok: false; error: string } = { ok: true };
    act(() => {
      outcome = result.current.updateVertexPointField(0, 'y', 'not-a-number');
    });

    expect(outcome.ok).toBe(false);
    expect(result.current.canUndo).toBe(false);
  });
});
