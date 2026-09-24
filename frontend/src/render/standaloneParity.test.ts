import { describe, expect, it } from 'vitest';

import type { DrawingDocument, ObjectAnimation } from '../pages/scene3dTypes';
import { DRAWING_PAINTER_SOURCE, paintDrawing } from './drawingRaster';
import { ANIMATION_MATH_SOURCE, computeAnimatedTransform } from './objectAnimation';

describe('standalone Three.js runtime sources match the app renderers (#787)', () => {
  it('the animation maths source agrees with computeAnimatedTransform for every kind', () => {
    const evaluate = new Function(
      `${ANIMATION_MATH_SOURCE}; return scene3dAnimatedTransform;`,
    )() as (b: unknown, a: unknown, t: number) => ReturnType<typeof computeAnimatedTransform>;
    const base = {
      position: { x: 2, y: 1, z: -1 },
      rotation: { x: 10, y: 20, z: 30 },
      scale: { x: 1, y: 2, z: 1 },
    };
    const cases: ObjectAnimation[] = [
      { kind: 'rotate', axis: 'y', speed: 45 },
      { kind: 'rotate', axis: 'x', speed: -30 },
      { kind: 'orbit', axis: 'y', speed: 30, center: { x: 0, y: 0, z: 0 } },
      { kind: 'orbit', axis: 'z', speed: 90 },
      { kind: 'oscillate', axis: 'x', speed: 0.5, amplitude: 1.5 },
      { kind: 'oscillate', speed: 1 },
      { kind: 'pulse', speed: 1, amplitude: 0.2 },
      { kind: 'pulse', speed: 2 },
    ];
    for (const animation of cases) {
      for (const seconds of [0, 0.37, 1.5, 12]) {
        expect(evaluate(base, animation, seconds)).toEqual(
          JSON.parse(JSON.stringify(computeAnimatedTransform(base, animation, seconds))),
        );
      }
    }
  });

  it('the painter source issues the same drawing calls as paintDrawing', () => {
    const drawing: DrawingDocument = {
      width: 200,
      height: 100,
      background: '#112233',
      shapes: [
        {
          id: 'r',
          type: 'rect',
          x: 1,
          y: 2,
          width: 30,
          height: 40,
          fill: '#ff0000',
          stroke: '#00ff00',
          strokeWidth: 3,
          opacity: 0.5,
        },
        { id: 'e', type: 'ellipse', cx: 50, cy: 50, rx: 10, ry: 20, fill: '#0000ff' },
        { id: 'l', type: 'line', x1: 0, y1: 0, x2: 10, y2: 10, stroke: '#ffffff', strokeWidth: 2 },
        {
          id: 'p',
          type: 'path',
          points: [
            { x: 1, y: 1 },
            { x: 5, y: 9 },
            { x: 9, y: 2 },
          ],
          closed: true,
          fill: '#abcdef',
          stroke: 'not-a-colour',
          strokeWidth: 4,
        },
      ],
    };
    const record = () => {
      const log: string[] = [];
      const target: Record<string, unknown> = {};
      const ctx = new Proxy(target, {
        get(_t, key: string) {
          if (key in target) return target[key];
          return (...args: unknown[]) => {
            log.push(`${key}(${args.join(',')})`);
          };
        },
        set(_t, key: string, value) {
          target[key] = value;
          log.push(`${key}=${String(value)}`);
          return true;
        },
      });
      return { ctx, log };
    };
    const app = record();
    paintDrawing(app.ctx as unknown as CanvasRenderingContext2D, drawing);
    const standalone = record();
    const paint = new Function(`${DRAWING_PAINTER_SOURCE}; return scene3dPaintDrawing;`)() as (
      ctx: unknown,
      d: unknown,
    ) => void;
    paint(standalone.ctx, drawing);
    expect(standalone.log).toEqual(app.log);
    expect(app.log.length).toBeGreaterThan(20);
  });
});
