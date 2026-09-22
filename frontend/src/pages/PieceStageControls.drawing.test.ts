import { describe, expect, it } from 'vitest';

import { visitorStrokeIntersects, type VisitorStroke } from './visitorDrawing';

const stroke: VisitorStroke = {
  points: [
    { x: 0.1, y: 0.2 },
    { x: 0.9, y: 0.8 },
  ],
  tool: 'brush',
  size: 24,
  color: '#ef4444',
};

describe('visitorStrokeIntersects', () => {
  it('detects a hit on any segment of a visitor stroke', () => {
    expect(visitorStrokeIntersects(stroke, { x: 0.5, y: 0.5 }, 0.01)).toBe(true);
    expect(visitorStrokeIntersects(stroke, { x: 0.5, y: 0.7 }, 0.01)).toBe(false);
  });

  it('detects endpoint hits and leaves distant strokes intact', () => {
    expect(visitorStrokeIntersects(stroke, { x: 0.1, y: 0.2 }, 0.001)).toBe(true);
    expect(visitorStrokeIntersects(stroke, { x: 0.9, y: 0.1 }, 0.01)).toBe(false);
  });
});
