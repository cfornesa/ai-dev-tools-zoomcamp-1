/**
 * Issue #206: mirrors `p5Adapter.test.ts`'s coverage for the native
 * Canvas2D adapter, asserting the exact same pixel-level behavior both
 * renderers must agree on. The PRNG-seeding pair
 * (`p5Adapter.test.ts`'s "seeds the PRNG..."/"does not seed the PRNG...")
 * is p5-specific (spies on `p5.prototype.randomSeed`/`noiseSeed`, an API
 * this adapter has no equivalent of and no need for -- nothing in either
 * adapter's own drawing code consumes `randomness` directly; see the
 * "renders the same seeded... scene identically" test below, which is
 * renderer-agnostic and kept unchanged) and is replaced with a smoke test
 * that `randomness.enabled` doesn't affect rendering or throw either way.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { createCanvas2DScenePreview, SceneRenderError } from './canvas2dAdapter';
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

function mount(): {
  container: HTMLElement;
  preview: ReturnType<typeof createCanvas2DScenePreview>;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const preview = createCanvas2DScenePreview(container);
  return { container, preview };
}

function pixel(canvas: HTMLCanvasElement, x: number, y: number): [number, number, number, number] {
  const ctx = canvas.getContext('2d')!;
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2], d[3]];
}

const previews: Array<ReturnType<typeof createCanvas2DScenePreview>> = [];
afterEach(() => {
  for (const p of previews.splice(0)) p.destroy();
});

function tracked(): {
  container: HTMLElement;
  preview: ReturnType<typeof createCanvas2DScenePreview>;
} {
  const m = mount();
  previews.push(m.preview);
  return m;
}

describe('canvas2d scene preview', () => {
  it('composites the camera between artwork layers according to layerOrder', () => {
    const { preview } = tracked();
    const cameraSource = document.createElement('canvas');
    cameraSource.width = 40;
    cameraSource.height = 40;
    const cameraContext = cameraSource.getContext('2d')!;
    cameraContext.fillStyle = '#00ff00';
    cameraContext.fillRect(0, 0, 40, 40);
    preview.render(
      baseScene({
        canvas: { width: 40, height: 40, backgroundColor: '#000000' },
        renderer: { preferred: 'canvas2d' },
        layers: [layer({ id: 'bottom', order: 0 }), layer({ id: 'top', order: 2 })],
        shapes: [
          rectShape({
            id: 'bottom-shape',
            layerId: 'bottom',
            transform: transform({ x: 0, y: 0 }),
            width: 40,
            height: 40,
            style: style({ fill: '#ff0000' }),
          }),
          rectShape({
            id: 'top-shape',
            layerId: 'top',
            transform: transform({ x: 0, y: 0 }),
            width: 10,
            height: 10,
            style: style({ fill: '#0000ff' }),
          }),
        ],
      }),
      [],
      [],
      false,
      {
        source: cameraSource,
        geometry: { x: 0, y: 0, width: 1, height: 1 },
        opacity: 1,
        mirrored: false,
        layerOrder: 1,
      },
    );
    expect(pixel(preview.getCanvasElement()!, 20, 20)).toEqual([0, 255, 0, 255]);
  });

  it('recomposes the live camera at its new artwork-relative layer after a layer-order change', () => {
    const { preview } = tracked();
    const cameraSource = document.createElement('canvas');
    cameraSource.width = 40;
    cameraSource.height = 40;
    const cameraContext = cameraSource.getContext('2d')!;
    cameraContext.fillStyle = '#00ff00';
    cameraContext.fillRect(0, 0, 40, 40);
    const scene = baseScene({
      canvas: { width: 40, height: 40, backgroundColor: '#000000' },
      renderer: { preferred: 'canvas2d' },
      layers: [layer({ id: 'bottom', order: 0 }), layer({ id: 'top', order: 2 })],
      shapes: [
        rectShape({
          id: 'bottom-shape',
          layerId: 'bottom',
          transform: transform({ x: 0, y: 0 }),
          width: 40,
          height: 40,
          style: style({ fill: '#ff0000' }),
        }),
        rectShape({
          id: 'top-shape',
          layerId: 'top',
          transform: transform({ x: 20, y: 20 }),
          width: 10,
          height: 10,
          style: style({ fill: '#0000ff' }),
        }),
      ],
    });
    const overlay = {
      source: cameraSource,
      geometry: { x: 0, y: 0, width: 1, height: 1 },
      opacity: 1,
      mirrored: false,
      layerOrder: 1,
    };

    preview.render(scene, [], [], false, overlay);
    expect(pixel(preview.getCanvasElement()!, 20, 20)).toEqual([0, 0, 255, 255]);

    preview.render(scene, [], [], false, { ...overlay, layerOrder: 3 });
    expect(pixel(preview.getCanvasElement()!, 5, 5)).toEqual([0, 255, 0, 255]);
    expect(pixel(preview.getCanvasElement()!, 20, 20)).toEqual([0, 255, 0, 255]);
  });

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
    expect(pixel(canvas, 20, 20)).toEqual([255, 0, 0, 255]);
    expect(pixel(canvas, 1, 1)).toEqual([0, 0, 0, 255]);
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
    expect(pixel(canvas, 10, 8)).toEqual([0, 255, 0, 255]);
    expect(pixel(canvas, 30, 30)).toEqual([0, 0, 0, 255]);
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
    expect(pixel(canvas, 20, 20)).toEqual([255, 255, 255, 255]);
    expect(pixel(canvas, 20, 5)).toEqual([0, 0, 0, 255]);
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
    expect(pixel(canvas, 20, 20)).toEqual([0, 0, 255, 255]);
    expect(pixel(canvas, 1, 1)).toEqual([0, 0, 0, 255]);
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
          circleShape({
            id: 'no-fill',
            transform: transform({ x: 15, y: 15 }),
            radius: 10,
            style: style({ fill: null, stroke: '#ffffff', strokeWidth: 4 }),
          }),
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
    expect(pixel(canvas, 15, 15)).toEqual([0, 0, 0, 255]);
    expect(pixel(canvas, 15, 5)).toEqual([255, 255, 255, 255]);
    expect(pixel(canvas, 45, 15)).toEqual([255, 0, 0, 255]);
    expect(pixel(canvas, 45, 7)).toEqual([255, 0, 0, 255]);
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
    expect(pixel(preview.getCanvasElement()!, 17, 5)).toEqual([255, 255, 255, 255]);
  });

  // Acceptance criterion 8 parity: randomness.enabled must not affect
  // rendering (nothing in this adapter's own drawing consumes it) and must
  // never throw either way. See the module doc comment for why this
  // replaces `p5Adapter.test.ts`'s p5-specific PRNG-spy pair.
  it('renders identically regardless of randomness.enabled', () => {
    const on = tracked();
    const off = tracked();
    const scene = (enabled: boolean) =>
      baseScene({
        canvas: { width: 20, height: 20, backgroundColor: '#123456' },
        randomness: { seed: 12345, enabled },
        shapes: [circleShape({ transform: transform({ x: 10, y: 10 }), radius: 5 })],
      });
    expect(() => on.preview.render(scene(true))).not.toThrow();
    expect(() => off.preview.render(scene(false))).not.toThrow();
    const canvasOn = on.preview.getCanvasElement()!;
    const canvasOff = off.preview.getCanvasElement()!;
    const dataOn = canvasOn.getContext('2d')!.getImageData(0, 0, 20, 20).data;
    const dataOff = canvasOff.getContext('2d')!.getImageData(0, 0, 20, 20).data;
    expect(Array.from(dataOn)).toEqual(Array.from(dataOff));
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
    const invalidScene = { schemaVersion: 1 };
    expect(() => preview.render(invalidScene)).toThrow(SceneRenderError);
    expect(preview.getCanvasElement()).toBeNull();
  });

  // Acceptance criterion 12
  it('never uses eval or new Function in the adapter or draw-plan source', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = path.dirname(new URL(import.meta.url).pathname);
    const drawPlanText = fs.readFileSync(path.join(dir, 'sceneDrawPlan.ts'), 'utf-8');
    const adapterText = fs.readFileSync(path.join(dir, 'canvas2dAdapter.ts'), 'utf-8');
    expect(drawPlanText).not.toMatch(/\beval\s*\(/);
    expect(drawPlanText).not.toMatch(/new\s+Function\s*\(/);
    expect(adapterText).not.toMatch(/\beval\s*\(/);
    expect(adapterText).not.toMatch(/new\s+Function\s*\(/);
  });

  describe('particle rendering (Task 39)', () => {
    it('draws each live particle as a filled circle at its own position/size/color', () => {
      const { preview } = tracked();
      preview.render(baseScene({ canvas: { width: 40, height: 40, backgroundColor: '#000000' } }), [
        { x: 10, y: 10, size: 6, color: '#00ff00' },
      ]);
      const canvas = preview.getCanvasElement()!;
      expect(pixel(canvas, 10, 10)).toEqual([0, 255, 0, 255]);
      expect(pixel(canvas, 30, 30)).toEqual([0, 0, 0, 255]);
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
      expect(pixel(canvas, 20, 20)).toEqual([0, 0, 255, 255]);
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
      expect(pixel(canvas, 20, 20)).toEqual([0, 255, 0, 255]);
      expect(pixel(canvas, 20, 5)).toEqual([0, 0, 0, 255]);
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
      expect(pixel(canvas, 10, 10)).toEqual([0x4f, 0x46, 0xe5, 255]);
      expect(pixel(canvas, 1, 1)[3]).toBe(0);
    });
  });

  describe('canvas.opacity (Task 138, issue #170)', () => {
    it('defaults to fully opaque when canvas.opacity is absent, unaffected by this task', () => {
      const { preview } = tracked();
      preview.render(baseScene({ canvas: { width: 20, height: 20, backgroundColor: '#ff0000' } }));
      const canvas = preview.getCanvasElement()!;
      expect(pixel(canvas, 10, 10)).toEqual([0xff, 0x00, 0x00, 255]);
    });

    it('scales the whole composite alpha (background) by canvas.opacity', () => {
      const { preview } = tracked();
      preview.render(
        baseScene({
          canvas: { width: 20, height: 20, backgroundColor: '#ff0000', opacity: 0.5 },
        }),
      );
      const canvas = preview.getCanvasElement()!;
      const [r, g, b, a] = pixel(canvas, 10, 10);
      expect([r, g, b]).toEqual([0xff, 0x00, 0x00]);
      expect(a).toBeGreaterThanOrEqual(120);
      expect(a).toBeLessThanOrEqual(135);
    });

    it('scales a shape drawn on the canvas by the same overall composite opacity', () => {
      const { preview } = tracked();
      preview.render(
        baseScene({
          canvas: { width: 20, height: 20, backgroundColor: '#000000', opacity: 0.5 },
          shapes: [circleShape({ transform: transform({ x: 10, y: 10 }), radius: 8 })],
        }),
      );
      const canvas = preview.getCanvasElement()!;
      const [r, g, b, a] = pixel(canvas, 10, 10);
      expect(Math.abs(r - 0x4f)).toBeLessThanOrEqual(1);
      expect(Math.abs(g - 0x46)).toBeLessThanOrEqual(1);
      expect(Math.abs(b - 0xe5)).toBeLessThanOrEqual(1);
      expect(a).toBeGreaterThanOrEqual(120);
      expect(a).toBeLessThanOrEqual(135);
    });

    it('opacity 0 renders a fully transparent frame', () => {
      const { preview } = tracked();
      preview.render(
        baseScene({
          canvas: { width: 20, height: 20, backgroundColor: '#ff0000', opacity: 0 },
        }),
      );
      const canvas = preview.getCanvasElement()!;
      expect(pixel(canvas, 10, 10)[3]).toBe(0);
    });

    it('re-rendering from opacity < 1 back to opacity 1 restores a fully opaque frame', () => {
      const { preview } = tracked();
      preview.render(
        baseScene({
          canvas: { width: 20, height: 20, backgroundColor: '#ff0000', opacity: 0.5 },
        }),
      );
      preview.render(baseScene({ canvas: { width: 20, height: 20, backgroundColor: '#ff0000' } }));
      const canvas = preview.getCanvasElement()!;
      expect(pixel(canvas, 10, 10)).toEqual([0xff, 0x00, 0x00, 255]);
    });
  });
});
