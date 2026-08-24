import p5 from 'p5';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createP5ScenePreview, SceneRenderError } from './p5Adapter';
import {
  baseScene,
  circleShape,
  group,
  layer,
  lineShape,
  particleEmitterShape,
  pathShape,
  rectShape,
  style,
  transform,
} from './testSceneFixtures';

function mount(): { container: HTMLElement; preview: ReturnType<typeof createP5ScenePreview> } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const preview = createP5ScenePreview(container);
  return { container, preview };
}

function pixel(canvas: HTMLCanvasElement, x: number, y: number): [number, number, number, number] {
  const ctx = canvas.getContext('2d')!;
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2], d[3]];
}

const previews: Array<ReturnType<typeof createP5ScenePreview>> = [];
afterEach(() => {
  for (const p of previews.splice(0)) p.destroy();
});

function tracked(): { container: HTMLElement; preview: ReturnType<typeof createP5ScenePreview> } {
  const m = mount();
  previews.push(m.preview);
  return m;
}

describe('p5 scene preview', () => {
  // Acceptance criterion 1
  it('draws a canvas sized canvas.width x canvas.height filled with backgroundColor', () => {
    const { preview } = tracked();
    preview.render(baseScene({ canvas: { width: 50, height: 30, backgroundColor: '#336699' } }));
    const canvas = preview.getCanvasElement()!;
    expect(canvas.width).toBe(50);
    expect(canvas.height).toBe(30);
    expect(pixel(canvas, 25, 15)).toEqual([0x33, 0x66, 0x99, 255]);
    expect(pixel(canvas, 1, 1)).toEqual([0x33, 0x66, 0x99, 255]);
  });

  // Acceptance criterion 2
  it('renders a circle using its radius', () => {
    const { preview } = tracked();
    preview.render(
      baseScene({
        canvas: { width: 40, height: 40, backgroundColor: '#000000' },
        shapes: [
          circleShape({
            transform: transform({ x: 20, y: 20 }),
            radius: 10,
            style: style({ fill: '#ff0000' }),
          }),
        ],
      }),
    );
    const canvas = preview.getCanvasElement()!;
    expect(pixel(canvas, 20, 20)).toEqual([255, 0, 0, 255]); // inside radius
    expect(pixel(canvas, 1, 1)).toEqual([0, 0, 0, 255]); // outside radius: background
  });

  it('renders a rect using width/height/cornerRadius', () => {
    const { preview } = tracked();
    preview.render(
      baseScene({
        canvas: { width: 40, height: 40, backgroundColor: '#000000' },
        shapes: [
          rectShape({
            transform: transform({ x: 5, y: 5 }),
            width: 10,
            height: 6,
            cornerRadius: 0,
            style: style({ fill: '#00ff00' }),
          }),
        ],
      }),
    );
    const canvas = preview.getCanvasElement()!;
    expect(pixel(canvas, 10, 8)).toEqual([0, 255, 0, 255]); // inside the rect
    expect(pixel(canvas, 30, 30)).toEqual([0, 0, 0, 255]); // outside
  });

  it('renders a line from transform.x/y to x2/y2', () => {
    const { preview } = tracked();
    preview.render(
      baseScene({
        canvas: { width: 40, height: 40, backgroundColor: '#000000' },
        shapes: [
          lineShape({
            transform: transform({ x: 5, y: 20 }),
            x2: 35,
            y2: 20,
            style: style({ fill: null, stroke: '#ffffff', strokeWidth: 2 }),
          }),
        ],
      }),
    );
    const canvas = preview.getCanvasElement()!;
    expect(pixel(canvas, 20, 20)).toEqual([255, 255, 255, 255]); // midpoint of the line
    expect(pixel(canvas, 20, 5)).toEqual([0, 0, 0, 255]); // far from the line
  });

  it('renders a closed path using its points', () => {
    const { preview } = tracked();
    preview.render(
      baseScene({
        canvas: { width: 40, height: 40, backgroundColor: '#000000' },
        shapes: [
          pathShape({
            transform: transform({ x: 20, y: 20 }),
            points: [
              { x: -10, y: -10 },
              { x: 10, y: -10 },
              { x: 10, y: 10 },
              { x: -10, y: 10 },
            ],
            closed: true,
            style: style({ fill: '#0000ff', stroke: null, strokeWidth: 0 }),
          }),
        ],
      }),
    );
    const canvas = preview.getCanvasElement()!;
    expect(pixel(canvas, 20, 20)).toEqual([0, 0, 255, 255]); // center of the square path
    expect(pixel(canvas, 1, 1)).toEqual([0, 0, 0, 255]); // outside the path
  });

  it('renders a particleEmitter as a static marker using its position/size/palette', () => {
    const { preview } = tracked();
    preview.render(
      baseScene({
        canvas: { width: 40, height: 40, backgroundColor: '#000000' },
        shapes: [
          particleEmitterShape({
            transform: transform({ x: 20, y: 20 }),
            size: 12,
            palette: ['#ff00ff'],
          }),
        ],
      }),
    );
    const canvas = preview.getCanvasElement()!;
    expect(pixel(canvas, 20, 20)).toEqual([255, 0, 255, 255]);
  });

  // Acceptance criterion 3
  it('applies position, scale, rotation, and opacity from transform2D', () => {
    const { preview } = tracked();
    // scaleX=2 doubles the radius; opacity=0.5 blends 50% with the black
    // background, halving each fill channel.
    preview.render(
      baseScene({
        canvas: { width: 60, height: 60, backgroundColor: '#000000' },
        shapes: [
          circleShape({
            transform: transform({ x: 30, y: 30, scaleX: 2, scaleY: 2, opacity: 0.5 }),
            radius: 5,
            style: style({ fill: '#ff0000' }),
          }),
        ],
      }),
    );
    const canvas = preview.getCanvasElement()!;
    // Radius 5 * scale 2 = 10, so (30, 22) (8px above center) is still inside.
    const [r, g, b] = pixel(canvas, 30, 22);
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(200);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it('composes a shape transform with two ancestor groups', () => {
    const { preview } = tracked();
    preview.render(
      baseScene({
        canvas: { width: 60, height: 60, backgroundColor: '#000000' },
        shapes: [
          circleShape({
            groupId: 'inner',
            transform: transform({ x: 3, y: 0 }),
            radius: 2,
            style: style({ fill: '#ffffff' }),
          }),
        ],
        groups: [
          group({ id: 'outer', childIds: ['inner'], transform: transform({ x: 10, y: 10 }) }),
          group({ id: 'inner', childIds: ['shape-circle'], transform: transform({ x: 5, y: 5 }) }),
        ],
      }),
    );
    const canvas = preview.getCanvasElement()!;
    // Absolute position = outer(10,10) + inner(5,5) + shape(3,0) = (18, 15).
    expect(pixel(canvas, 18, 15)).toEqual([255, 255, 255, 255]);
    expect(pixel(canvas, 1, 1)).toEqual([0, 0, 0, 255]);
  });

  // Acceptance criterion 4
  it('renders fill:null (no fill) and stroke:null (no stroke) independently', () => {
    const { preview } = tracked();
    preview.render(
      baseScene({
        canvas: { width: 60, height: 60, backgroundColor: '#000000' },
        layers: [layer(), layer({ id: 'layer-2' })],
        shapes: [
          // No fill, white stroke: interior stays background, edge is white.
          circleShape({
            id: 'no-fill',
            transform: transform({ x: 15, y: 15 }),
            radius: 10,
            style: style({ fill: null, stroke: '#ffffff', strokeWidth: 4 }),
          }),
          // Red fill, no stroke: interior AND edge are the fill color.
          circleShape({
            id: 'no-stroke',
            layerId: 'layer-2',
            transform: transform({ x: 45, y: 15 }),
            radius: 10,
            style: style({ fill: '#ff0000', stroke: null, strokeWidth: 4 }),
          }),
        ],
      }),
    );
    const canvas = preview.getCanvasElement()!;
    expect(pixel(canvas, 15, 15)).toEqual([0, 0, 0, 255]); // no-fill circle's interior: background
    expect(pixel(canvas, 15, 5)).toEqual([255, 255, 255, 255]); // no-fill circle's edge: stroke
    expect(pixel(canvas, 45, 15)).toEqual([255, 0, 0, 255]); // no-stroke circle's interior: fill
    expect(pixel(canvas, 45, 7)).toEqual([255, 0, 0, 255]); // near no-stroke circle's edge: still fill
  });

  it('renders strokeWidth at 0 and at its maximum (64) differently', () => {
    const thin = tracked();
    thin.preview.render(
      baseScene({
        canvas: { width: 80, height: 80, backgroundColor: '#000000' },
        shapes: [
          circleShape({
            transform: transform({ x: 40, y: 40 }),
            radius: 20,
            style: style({ fill: null, stroke: '#ffffff', strokeWidth: 0 }),
          }),
        ],
      }),
    );
    const thick = tracked();
    thick.preview.render(
      baseScene({
        canvas: { width: 80, height: 80, backgroundColor: '#000000' },
        shapes: [
          circleShape({
            transform: transform({ x: 40, y: 40 }),
            radius: 20,
            style: style({ fill: null, stroke: '#ffffff', strokeWidth: 64 }),
          }),
        ],
      }),
    );
    // 5px inside the circle's top edge (boundary at y=20): a 0-width
    // stroke doesn't reach it, a 64-width stroke (much wider than a
    // hairline) does.
    const thinCanvas = thin.preview.getCanvasElement()!;
    const thickCanvas = thick.preview.getCanvasElement()!;
    expect(pixel(thinCanvas, 40, 25)).toEqual([0, 0, 0, 255]);
    expect(pixel(thickCanvas, 40, 25)).toEqual([255, 255, 255, 255]);
  });

  // Acceptance criterion 5
  it('draws later top-level shapes over earlier ones at the same position (shapes array order)', () => {
    const { preview } = tracked();
    preview.render(
      baseScene({
        canvas: { width: 20, height: 20, backgroundColor: '#000000' },
        layers: [layer(), layer({ id: 'layer-2' })],
        shapes: [
          circleShape({
            id: 'under',
            transform: transform({ x: 10, y: 10 }),
            radius: 8,
            style: style({ fill: '#ff0000' }),
          }),
          circleShape({
            id: 'over',
            layerId: 'layer-2',
            transform: transform({ x: 10, y: 10 }),
            radius: 8,
            style: style({ fill: '#00ff00' }),
          }),
        ],
      }),
    );
    expect(pixel(preview.getCanvasElement()!, 10, 10)).toEqual([0, 255, 0, 255]);
  });

  it('draws top-level groups before top-level shapes within a layer', () => {
    const { preview } = tracked();
    preview.render(
      baseScene({
        canvas: { width: 20, height: 20, backgroundColor: '#000000' },
        layers: [layer(), layer({ id: 'layer-2' })],
        shapes: [
          // Top-level shape (drawn after the group despite coming first in
          // the array, because groups draw before top-level shapes).
          circleShape({
            id: 'top-level',
            transform: transform({ x: 10, y: 10 }),
            radius: 8,
            style: style({ fill: '#00ff00' }),
          }),
          circleShape({
            id: 'grouped',
            layerId: 'layer-2',
            groupId: 'g',
            transform: transform({ x: 10, y: 10 }),
            radius: 8,
            style: style({ fill: '#ff0000' }),
          }),
        ],
        groups: [group({ id: 'g', childIds: ['grouped'] })],
      }),
    );
    expect(pixel(preview.getCanvasElement()!, 10, 10)).toEqual([0, 255, 0, 255]);
  });

  it('draws a group child before a later group child (childIds order)', () => {
    const { preview } = tracked();
    preview.render(
      baseScene({
        canvas: { width: 20, height: 20, backgroundColor: '#000000' },
        layers: [layer(), layer({ id: 'layer-2' })],
        shapes: [
          circleShape({
            id: 'first',
            groupId: 'g',
            transform: transform({ x: 10, y: 10 }),
            radius: 8,
            style: style({ fill: '#ff0000' }),
          }),
          circleShape({
            id: 'second',
            layerId: 'layer-2',
            groupId: 'g',
            transform: transform({ x: 10, y: 10 }),
            radius: 8,
            style: style({ fill: '#00ff00' }),
          }),
        ],
        groups: [group({ id: 'g', childIds: ['first', 'second'] })],
      }),
    );
    expect(pixel(preview.getCanvasElement()!, 10, 10)).toEqual([0, 255, 0, 255]);
  });

  // Acceptance criterion 6
  it('renders none of an invisible layer’s contents; a locked layer renders normally', () => {
    const { preview } = tracked();
    preview.render(
      baseScene({
        canvas: { width: 20, height: 20, backgroundColor: '#000000' },
        layers: [
          layer({ id: 'hidden', order: 0, visible: false }),
          layer({ id: 'locked', order: 1, locked: true }),
        ],
        shapes: [
          circleShape({
            id: 'in-hidden',
            layerId: 'hidden',
            transform: transform({ x: 10, y: 10 }),
            radius: 8,
            style: style({ fill: '#ff0000' }),
          }),
          circleShape({
            id: 'in-locked',
            layerId: 'locked',
            transform: transform({ x: 10, y: 10 }),
            radius: 8,
            style: style({ fill: '#00ff00' }),
          }),
        ],
      }),
    );
    expect(pixel(preview.getCanvasElement()!, 10, 10)).toEqual([0, 255, 0, 255]);
  });

  // Acceptance criterion 7
  it('composes transforms correctly through 6 levels of group nesting', () => {
    const { preview } = tracked();
    const groups = [];
    let childId = 'leaf';
    const perLevel = 2;
    for (let i = 6; i >= 1; i -= 1) {
      const id = `g${i}`;
      groups.push(group({ id, childIds: [childId], transform: transform({ x: perLevel, y: 0 }) }));
      childId = id;
    }
    preview.render(
      baseScene({
        canvas: { width: 60, height: 60, backgroundColor: '#000000' },
        shapes: [
          circleShape({
            id: 'leaf',
            groupId: 'g6',
            transform: transform({ x: 5, y: 5 }),
            radius: 2,
            style: style({ fill: '#ffffff' }),
          }),
        ],
        groups,
      }),
    );
    // Absolute position = 6 groups * (2, 0) + shape's own (5, 5) = (17, 5).
    expect(pixel(preview.getCanvasElement()!, 17, 5)).toEqual([255, 255, 255, 255]);
  });

  // Acceptance criterion 8
  it('seeds the PRNG from randomness.seed when enabled', () => {
    const seedSpy = vi.spyOn(p5.prototype, 'randomSeed');
    const noiseSpy = vi.spyOn(p5.prototype, 'noiseSeed');
    const { preview } = tracked();
    preview.render(baseScene({ randomness: { seed: 12345, enabled: true } }));
    expect(seedSpy).toHaveBeenCalledWith(12345);
    expect(noiseSpy).toHaveBeenCalledWith(12345);
    seedSpy.mockRestore();
    noiseSpy.mockRestore();
  });

  it('does not seed the PRNG when randomness.enabled is false', () => {
    const seedSpy = vi.spyOn(p5.prototype, 'randomSeed');
    const { preview } = tracked();
    preview.render(baseScene({ randomness: { seed: 12345, enabled: false } }));
    expect(seedSpy).not.toHaveBeenCalled();
    seedSpy.mockRestore();
  });

  // Acceptance criterion 9
  it('renders the same seeded, binding/graph-free scene identically across two fresh instances', () => {
    const scene = baseScene({
      canvas: { width: 50, height: 50, backgroundColor: '#123456' },
      randomness: { seed: 999, enabled: true },
      layers: [layer({ id: 'l1', order: 0 }), layer({ id: 'l2', order: 1 })],
      shapes: [
        circleShape({
          id: 'c',
          layerId: 'l1',
          transform: transform({ x: 15, y: 15, rotation: 30, opacity: 0.7 }),
          radius: 9,
          style: style({ fill: '#ff8800', stroke: '#000000', strokeWidth: 3 }),
        }),
        rectShape({
          id: 'r',
          layerId: 'l2',
          groupId: 'g',
          transform: transform({ x: 5, y: 5, scaleX: 1.5, scaleY: 0.5, rotation: 12 }),
          width: 10,
          height: 8,
          cornerRadius: 2,
          style: style({ fill: '#00aacc', stroke: null }),
        }),
      ],
      groups: [
        group({
          id: 'g',
          layerId: 'l2',
          childIds: ['r'],
          transform: transform({ x: 3, y: 3, rotation: 5 }),
        }),
      ],
    });

    const a = tracked();
    const b = tracked();
    a.preview.render(scene);
    b.preview.render(scene);

    const canvasA = a.preview.getCanvasElement()!;
    const canvasB = b.preview.getCanvasElement()!;
    const ctxA = canvasA.getContext('2d')!;
    const ctxB = canvasB.getContext('2d')!;
    const dataA = ctxA.getImageData(0, 0, canvasA.width, canvasA.height).data;
    const dataB = ctxB.getImageData(0, 0, canvasB.width, canvasB.height).data;
    expect(Array.from(dataA)).toEqual(Array.from(dataB));
  });

  // Acceptance criterion 10
  it('throws naming the offending shape before any draw call for an out-of-enum type', () => {
    const { preview } = tracked();
    expect(() =>
      preview.render(baseScene({ shapes: [circleShape({ id: 'weird', type: 'triangle' })] })),
    ).toThrow(SceneRenderError);
    // Zero canvas mutation: no canvas was ever created.
    expect(preview.getCanvasElement()).toBeNull();
  });

  it('throws naming the offending shape before any draw call for a dangling groupId, and leaves a prior render untouched', () => {
    const { preview } = tracked();
    preview.render(baseScene({ canvas: { width: 16, height: 16, backgroundColor: '#ff0000' } }));
    const before = Array.from(
      preview.getCanvasElement()!.getContext('2d')!.getImageData(0, 0, 16, 16).data,
    );

    let thrown: unknown;
    try {
      preview.render(baseScene({ shapes: [circleShape({ id: 'orphan', groupId: 'ghost' })] }));
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(SceneRenderError);
    expect((thrown as Error).message).toContain('orphan');
    expect((thrown as Error).message).toContain('groupId');

    const after = Array.from(
      preview.getCanvasElement()!.getContext('2d')!.getImageData(0, 0, 16, 16).data,
    );
    expect(after).toEqual(before);
  });

  // Acceptance criterion 11
  it('throws before any draw call for a scene that never passed validateScene', () => {
    const { preview } = tracked();
    const invalidScene = { schemaVersion: 1 }; // missing everything else required
    expect(() => preview.render(invalidScene)).toThrow(SceneRenderError);
    expect(preview.getCanvasElement()).toBeNull();
  });

  // Acceptance criterion 12
  it('never uses eval or new Function in the adapter or draw-plan source', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = path.dirname(new URL(import.meta.url).pathname);
    const drawPlanText = fs.readFileSync(path.join(dir, 'sceneDrawPlan.ts'), 'utf-8');
    const adapterText = fs.readFileSync(path.join(dir, 'p5Adapter.ts'), 'utf-8');
    expect(drawPlanText).not.toMatch(/\beval\s*\(/);
    expect(drawPlanText).not.toMatch(/new\s+Function\s*\(/);
    expect(adapterText).not.toMatch(/\beval\s*\(/);
    expect(adapterText).not.toMatch(/new\s+Function\s*\(/);
  });

  // Task 39: particle rendering wired into the same pipeline.
  describe('particle rendering (Task 39)', () => {
    it('draws each live particle as a filled circle at its own position/size/color', () => {
      const { preview } = tracked();
      preview.render(baseScene({ canvas: { width: 40, height: 40, backgroundColor: '#000000' } }), [
        { x: 10, y: 10, size: 6, color: '#00ff00' },
      ]);
      const canvas = preview.getCanvasElement()!;
      expect(pixel(canvas, 10, 10)).toEqual([0, 255, 0, 255]); // inside particle radius
      expect(pixel(canvas, 30, 30)).toEqual([0, 0, 0, 255]); // untouched background
    });

    it('draws particles on top of static scene shapes', () => {
      const { preview } = tracked();
      preview.render(
        baseScene({
          canvas: { width: 40, height: 40, backgroundColor: '#000000' },
          shapes: [
            circleShape({
              transform: transform({ x: 20, y: 20 }),
              radius: 15,
              style: style({ fill: '#ff0000' }),
            }),
          ],
        }),
        [{ x: 20, y: 20, size: 6, color: '#0000ff' }],
      );
      const canvas = preview.getCanvasElement()!;
      expect(pixel(canvas, 20, 20)).toEqual([0, 0, 255, 255]); // particle wins over the shape beneath it
    });

    it('defaults to no particles when the second argument is omitted', () => {
      const { preview } = tracked();
      preview.render(baseScene({ canvas: { width: 20, height: 20, backgroundColor: '#123456' } }));
      const canvas = preview.getCanvasElement()!;
      expect(pixel(canvas, 10, 10)).toEqual([0x12, 0x34, 0x56, 255]);
    });

    it('re-rendering with an empty particle array clears previously drawn particles', () => {
      const { preview } = tracked();
      const scene = baseScene({ canvas: { width: 20, height: 20, backgroundColor: '#000000' } });
      preview.render(scene, [{ x: 10, y: 10, size: 8, color: '#ffffff' }]);
      expect(pixel(preview.getCanvasElement()!, 10, 10)).toEqual([255, 255, 255, 255]);
      preview.render(scene, []);
      expect(pixel(preview.getCanvasElement()!, 10, 10)).toEqual([0, 0, 0, 255]);
    });
  });

  // Task 61: trail rendering wired into the same pipeline.
  describe('trail rendering (Task 61)', () => {
    it('draws a multi-point trail as a polyline', () => {
      const { preview } = tracked();
      preview.render(
        baseScene({ canvas: { width: 40, height: 40, backgroundColor: '#000000' } }),
        [],
        [
          {
            color: '#00ff00',
            points: [
              { x: 5, y: 20 },
              { x: 35, y: 20 },
            ],
          },
        ],
      );
      const canvas = preview.getCanvasElement()!;
      expect(pixel(canvas, 20, 20)).toEqual([0, 255, 0, 255]); // on the line
      expect(pixel(canvas, 20, 5)).toEqual([0, 0, 0, 255]); // off the line
    });

    it('draws a single-sample trail as a small static marker (reduced-motion substitution)', () => {
      const { preview } = tracked();
      preview.render(
        baseScene({ canvas: { width: 40, height: 40, backgroundColor: '#000000' } }),
        [],
        [{ color: '#ff00ff', points: [{ x: 20, y: 20 }] }],
      );
      const canvas = preview.getCanvasElement()!;
      expect(pixel(canvas, 20, 20)).toEqual([255, 0, 255, 255]);
    });

    it('draws nothing for a zero-sample trail', () => {
      const { preview } = tracked();
      preview.render(
        baseScene({ canvas: { width: 20, height: 20, backgroundColor: '#123456' } }),
        [],
        [{ color: '#ffffff', points: [] }],
      );
      const canvas = preview.getCanvasElement()!;
      expect(pixel(canvas, 10, 10)).toEqual([0x12, 0x34, 0x56, 255]);
    });

    it('draws trails beneath static scene shapes and particles', () => {
      const { preview } = tracked();
      preview.render(
        baseScene({
          canvas: { width: 40, height: 40, backgroundColor: '#000000' },
          shapes: [
            circleShape({
              transform: transform({ x: 20, y: 20 }),
              radius: 15,
              style: style({ fill: '#ff0000' }),
            }),
          ],
        }),
        [],
        [
          {
            color: '#00ff00',
            points: [
              { x: 20, y: 20 },
              { x: 21, y: 20 },
            ],
          },
        ],
      );
      const canvas = preview.getCanvasElement()!;
      // The shape on top wins at its own center, even though a trail
      // sample sits at the same point.
      expect(pixel(canvas, 20, 20)).toEqual([255, 0, 0, 255]);
    });

    it('defaults to no trails when the third argument is omitted', () => {
      const { preview } = tracked();
      preview.render(baseScene({ canvas: { width: 20, height: 20, backgroundColor: '#123456' } }));
      const canvas = preview.getCanvasElement()!;
      expect(pixel(canvas, 10, 10)).toEqual([0x12, 0x34, 0x56, 255]);
    });
  });

  describe('transparentBackground (Task 110, issue #141)', () => {
    // Live-verified regression: without this option, the camera overlay
    // `<video>` EditorWorkspace.tsx stacks behind this canvas was
    // completely invisible in a real browser, no matter its own CSS
    // opacity -- an opaque `sk.background()` fill (painted every frame)
    // hides anything behind the canvas regardless of z-index ordering.

    it('defaults to false: paints the configured opaque background, unaffected by this task', () => {
      const { preview } = tracked();
      preview.render(baseScene({ canvas: { width: 20, height: 20, backgroundColor: '#123456' } }));
      const canvas = preview.getCanvasElement()!;
      expect(pixel(canvas, 10, 10)).toEqual([0x12, 0x34, 0x56, 255]);
    });

    it('true: clears to fully transparent instead of painting the background color', () => {
      const { preview } = tracked();
      preview.render(
        baseScene({ canvas: { width: 20, height: 20, backgroundColor: '#123456' } }),
        [],
        [],
        true,
      );
      const canvas = preview.getCanvasElement()!;
      // Alpha 0 -- a DOM element stacked behind this canvas would show
      // through here, unlike the opaque-background case above.
      expect(pixel(canvas, 10, 10)[3]).toBe(0);
    });

    it('true: a drawn shape still paints normally on top of the transparent background', () => {
      const { preview } = tracked();
      preview.render(
        baseScene({
          canvas: { width: 20, height: 20, backgroundColor: '#123456' },
          shapes: [circleShape({ transform: transform({ x: 10, y: 10 }), radius: 8 })],
        }),
        [],
        [],
        true,
      );
      const canvas = preview.getCanvasElement()!;
      // The shape's own fill (testSceneFixtures.ts's default, #4f46e5)
      // still paints fully opaque at its center...
      expect(pixel(canvas, 10, 10)).toEqual([0x4f, 0x46, 0xe5, 255]);
      // ...while a point outside the shape stays transparent, proving
      // this isn't just an opaque background of a different color.
      expect(pixel(canvas, 1, 1)[3]).toBe(0);
    });
  });
});
