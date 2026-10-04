import { describe, expect, it } from 'vitest';

import { normalizeCapabilities, supportsVisitorDrawing } from './artPieceCapabilities';

describe('local generated capability normalization', () => {
  it('keeps allowlisted booleans, fills missing keys, and drops unknown values', () => {
    const normalized = normalizeCapabilities(
      { sound: true, download: 'yes', unknown: true },
      'svg',
    );

    expect(normalized.sound).toBe(true);
    expect(normalized.download).toBe(false);
    expect((normalized as Record<string, unknown>).unknown).toBeUndefined();
    expect(normalized).toHaveProperty('immersive', false);
  });
});

describe('visitor drawing stage capability', () => {
  it('is enabled only for the interactive C2 engine', () => {
    expect(supportsVisitorDrawing('c2js-interactive')).toBe(true);
    expect(supportsVisitorDrawing('c2js')).toBe(false);
    expect(supportsVisitorDrawing('canvas2d')).toBe(false);
    expect(supportsVisitorDrawing('svg')).toBe(false);
    expect(supportsVisitorDrawing('p5js')).toBe(false);
    expect(supportsVisitorDrawing('threejs')).toBe(false);
    expect(supportsVisitorDrawing('aframe')).toBe(false);
  });
});
