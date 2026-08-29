/**
 * Issue #207: mirrors `canvas2dAdapter.test.ts`'s pixel-level coverage for
 * the SVG adapter -- possible because `getCanvasElement()` delegates to a
 * private `canvas2dAdapter.ts` instance (see `svgAdapter.ts`'s module doc
 * comment), so every existing pixel assertion applies unchanged. This file
 * additionally asserts on the real SVG DOM tree itself (structure, camera
 * `<foreignObject>`, and the no-eval/no-innerHTML security invariant that
 * matters specifically for SVG).
 */
import { afterEach, describe, expect, it } from 'vitest';

import { createSVGScenePreview, SceneRenderError } from './svgAdapter';
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

function mount(): { container: HTMLElement; preview: ReturnType<typeof createSVGScenePreview> } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const preview = createSVGScenePreview(container);
  return { container, preview };
}

function pixel(canvas: HTMLCanvasElement, x: number, y: number): [number, number, number, number] {
  const ctx = canvas.getContext('2d')!;
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2], d[3]];
}

function svgOf(container: HTMLElement): SVGSVGElement {
  return container.querySelector('svg')!;
}

const previews: Array<ReturnType<typeof createSVGScenePreview>> = [];
afterEach(() => {
  for (const p of previews.splice(0)) p.destroy();
});

function tracked(): { container: HTMLElement; preview: ReturnType<typeof createSVGScenePreview> } {
  const m = mount();
  previews.push(m.preview);
  return m;
}

describe('svg scene preview (pixel parity via the mirror canvas)', () => {
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
        renderer: { preferred: 'svg' },
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

  // Acceptance criterion 1
  it('draws a canvas sized canvas.width x canvas.height filled with backgroundColor', () => {
    const { preview } = tracked();
    preview.render(baseScene({ canvas: { width: 50, height: 30, backgroundColor: '#336699' } }));
    const canvas = preview.getCanvasElement()!;
    expect(canvas.width).toBe(50);
    expect(canvas.height).toBe(30);
    expect(pixel(canvas, 25, 15)).toEqual([0x33, 0x66, 0x99, 255]);
  });

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
  });

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

  it('throws naming the offending shape before any draw call for an out-of-enum type', () => {
    const { preview } = tracked();
    expect(() =>
      preview.render(baseScene({ shapes: [circleShape({ id: 'weird', type: 'triangle' })] })),
    ).toThrow(SceneRenderError);
    expect(preview.getCanvasElement()).toBeNull();
  });

  it('throws naming the offending shape before any draw call for a dangling groupId, and leaves a prior render untouched', () => {
    const { preview, container } = tracked();
    preview.render(baseScene({ canvas: { width: 16, height: 16, backgroundColor: '#ff0000' } }));
    const svgBefore = svgOf(container).outerHTML;

    let thrown: unknown;
    try {
      preview.render(baseScene({ shapes: [circleShape({ id: 'orphan', groupId: 'ghost' })] }));
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(SceneRenderError);
    expect((thrown as Error).message).toContain('orphan');

    expect(svgOf(container).outerHTML).toBe(svgBefore);
  });

  it('throws before any draw call for a scene that never passed validateScene', () => {
    const { preview } = tracked();
    const invalidScene = { schemaVersion: 1 };
    expect(() => preview.render(invalidScene)).toThrow(SceneRenderError);
    expect(preview.getCanvasElement()).toBeNull();
  });

  describe('particle rendering (Task 39)', () => {
    it('draws each live particle as a filled circle at its own position/size/color', () => {
      const { preview } = tracked();
      preview.render(baseScene({ canvas: { width: 40, height: 40, backgroundColor: '#000000' } }), [
        { x: 10, y: 10, size: 6, color: '#00ff00' },
      ]);
      const canvas = preview.getCanvasElement()!;
      expect(pixel(canvas, 10, 10)).toEqual([0, 255, 0, 255]);
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
      expect(pixel(preview.getCanvasElement()!, 20, 20)).toEqual([0, 255, 0, 255]);
    });

    it('draws a single-sample trail as a small static marker', () => {
      const { preview } = tracked();
      preview.render(
        baseScene({ canvas: { width: 40, height: 40, backgroundColor: '#000000' } }),
        [],
        [{ color: '#ff00ff', points: [{ x: 20, y: 20 }] }],
      );
      expect(pixel(preview.getCanvasElement()!, 20, 20)).toEqual([255, 0, 255, 255]);
    });
  });

  describe('transparentBackground (Task 110, issue #141)', () => {
    it('true: clears to fully transparent instead of painting the background color', () => {
      const { preview } = tracked();
      preview.render(
        baseScene({ canvas: { width: 20, height: 20, backgroundColor: '#123456' } }),
        [],
        [],
        true,
      );
      expect(pixel(preview.getCanvasElement()!, 10, 10)[3]).toBe(0);
    });
  });

  describe('canvas.opacity (Task 138, issue #170)', () => {
    it('scales the whole composite alpha (background) by canvas.opacity', () => {
      const { preview } = tracked();
      preview.render(
        baseScene({ canvas: { width: 20, height: 20, backgroundColor: '#ff0000', opacity: 0.5 } }),
      );
      const [r, g, b, a] = pixel(preview.getCanvasElement()!, 10, 10);
      expect([r, g, b]).toEqual([0xff, 0x00, 0x00]);
      expect(a).toBeGreaterThanOrEqual(120);
      expect(a).toBeLessThanOrEqual(135);
    });

    it('opacity 0 renders a fully transparent frame', () => {
      const { preview } = tracked();
      preview.render(
        baseScene({ canvas: { width: 20, height: 20, backgroundColor: '#ff0000', opacity: 0 } }),
      );
      expect(pixel(preview.getCanvasElement()!, 10, 10)[3]).toBe(0);
    });
  });
});

describe('svg scene preview: SVG DOM structure and security', () => {
  it('mounts a real <svg> element with the correct size, distinct from the mirror canvas', () => {
    const { preview, container } = tracked();
    preview.render(baseScene({ canvas: { width: 50, height: 30, backgroundColor: '#ffffff' } }));
    const svg = svgOf(container);
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('width')).toBe('50');
    expect(svg.getAttribute('height')).toBe('30');
    // The <svg> lives in the real container; the mirror canvas does not.
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('builds real typed shape elements, not generic nodes', () => {
    const { preview, container } = tracked();
    preview.render(
      baseScene({
        layers: [
          layer({ id: 'layer-1' }),
          layer({ id: 'layer-2' }),
          layer({ id: 'layer-3' }),
          layer({ id: 'layer-4' }),
        ],
        shapes: [
          circleShape({ id: 'c1', layerId: 'layer-1' }),
          rectShape({ id: 'r1', layerId: 'layer-2' }),
          lineShape({ id: 'l1', layerId: 'layer-3' }),
          pathShape({ id: 'p1', layerId: 'layer-4' }),
        ],
      }),
    );
    const svg = svgOf(container);
    expect(svg.querySelectorAll('circle')).toHaveLength(1);
    expect(svg.querySelectorAll('rect')).toHaveLength(2); // background + the rect shape
    expect(svg.querySelectorAll('line')).toHaveLength(1);
    expect(svg.querySelectorAll('path')).toHaveLength(1);
  });

  it('composites the camera overlay via a <foreignObject> containing a <canvas>, not a moved source node', () => {
    const { preview, container } = tracked();
    const cameraSource = document.createElement('canvas');
    cameraSource.width = 10;
    cameraSource.height = 10;
    cameraSource.getContext('2d')!.fillRect(0, 0, 10, 10);
    document.body.appendChild(cameraSource);
    preview.render(
      baseScene({ canvas: { width: 40, height: 40, backgroundColor: '#000000' } }),
      [],
      [],
      false,
      {
        source: cameraSource,
        geometry: { x: 0, y: 0, width: 1, height: 1 },
        opacity: 1,
        mirrored: false,
        layerOrder: 0,
      },
    );
    const foreignObject = svgOf(container).querySelector('foreignObject');
    expect(foreignObject).not.toBeNull();
    const innerCanvas = foreignObject!.querySelector('canvas');
    expect(innerCanvas).not.toBeNull();
    // The original source element was never reparented into the SVG -- the
    // foreignObject's canvas is a distinct element that was drawImage'd
    // into, and the source still lives wherever its owner put it.
    expect(innerCanvas).not.toBe(cameraSource);
    expect(cameraSource.parentElement).toBe(document.body);
    cameraSource.remove();
  });

  it('never uses eval, new Function, or innerHTML/outerHTML assignment in the adapter source', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = path.dirname(new URL(import.meta.url).pathname);
    const adapterText = fs.readFileSync(path.join(dir, 'svgAdapter.ts'), 'utf-8');
    expect(adapterText).not.toMatch(/\beval\s*\(/);
    expect(adapterText).not.toMatch(/new\s+Function\s*\(/);
    expect(adapterText).not.toMatch(/\.innerHTML\s*=/);
    expect(adapterText).not.toMatch(/\.outerHTML\s*=/);
  });
});
