import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DrawingDocument } from '../pages/scene3dTypes';
import { paintDrawing, rasterizeDrawing } from './drawingRaster';

function recordingContext() {
  const calls: Array<[string, ...unknown[]]> = [];
  const state: Record<string, unknown> = {};
  const proxy = new Proxy(
    {},
    {
      get(_target, property: string) {
        if (property === 'calls') return calls;
        if (property === 'state') return state;
        return (...args: unknown[]) => {
          calls.push([property, ...args, JSON.stringify({ ...state })]);
        };
      },
      set(_target, property: string, value) {
        state[property] = value;
        return true;
      },
    },
  );
  return proxy as unknown as CanvasRenderingContext2D & {
    calls: Array<[string, ...unknown[]]>;
    state: Record<string, unknown>;
  };
}

const drawing: DrawingDocument = {
  width: 512,
  height: 384,
  background: '#111827',
  shapes: [
    {
      id: 'r',
      type: 'rect',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      fill: '#ef4444',
      stroke: '#ffffff',
      strokeWidth: 4,
    },
    { id: 'e', type: 'ellipse', cx: 200, cy: 200, rx: 30, ry: 20, fill: '#3b82f6', opacity: 0.5 },
    {
      id: 'l',
      type: 'line',
      x1: 0,
      y1: 0,
      x2: 50,
      y2: 50,
      stroke: '#facc15',
      strokeWidth: 6,
      fill: '#ffffff',
    },
    {
      id: 'p',
      type: 'path',
      points: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5, y: 6 },
      ],
      closed: true,
      fill: '#22c55e',
    },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe('paintDrawing (#779)', () => {
  it('clears, paints the background, then each shape bottom to top', () => {
    const ctx = recordingContext();
    paintDrawing(ctx, drawing);
    const names = ctx.calls.map((call) => call[0]);
    expect(names[0]).toBe('clearRect');
    expect(names[1]).toBe('fillRect');
    expect(names.indexOf('rect')).toBeLessThan(names.indexOf('ellipse'));
    expect(names.indexOf('ellipse')).toBeLessThan(names.indexOf('lineTo'));
    expect(names.filter((name) => name === 'stroke').length).toBe(2); // rect + line
    expect(names.filter((name) => name === 'closePath').length).toBe(1);
  });

  it('draws a line by stroke only and honours per-shape opacity', () => {
    const ctx = recordingContext();
    paintDrawing(ctx, {
      width: 64,
      height: 64,
      shapes: [
        {
          id: 'l',
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 9,
          y2: 9,
          stroke: '#facc15',
          strokeWidth: 3,
          fill: '#ffffff',
        },
      ],
    });
    expect(ctx.calls.some((call) => call[0] === 'fill')).toBe(false);
    expect(ctx.calls.some((call) => call[0] === 'stroke')).toBe(true);
    const ellipseCtx = recordingContext();
    paintDrawing(ellipseCtx, { ...drawing, shapes: [drawing.shapes[1]!] });
    const ellipseCall = ellipseCtx.calls.find((call) => call[0] === 'ellipse')!;
    expect(String(ellipseCall[ellipseCall.length - 1])).toContain('"globalAlpha":0.5');
  });

  it('never applies a colour that is not a hex literal', () => {
    const ctx = recordingContext();
    paintDrawing(ctx, {
      width: 16,
      height: 16,
      background: 'url(javascript:alert(1))',
      shapes: [
        { id: 'r', type: 'rect', x: 0, y: 0, width: 4, height: 4, fill: 'red; x', stroke: null },
      ],
    });
    expect(ctx.calls.some((call) => call[0] === 'fillRect')).toBe(false);
    expect(ctx.calls.some((call) => call[0] === 'fill')).toBe(false);
  });
});

describe('rasterizeDrawing (#779)', () => {
  it('returns a canvas of the drawing size when 2D canvas exists, else null', () => {
    const ctx = recordingContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const canvas = rasterizeDrawing(drawing);
    expect(canvas?.width).toBe(512);
    expect(canvas?.height).toBe(384);
    expect(ctx.calls.length).toBeGreaterThan(4);

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(rasterizeDrawing(drawing)).toBeNull();
  });
});
