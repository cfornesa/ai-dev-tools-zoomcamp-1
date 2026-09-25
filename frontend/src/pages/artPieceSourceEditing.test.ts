import { describe, expect, it } from 'vitest';

import { supportsGeneratedSourceEditing } from './artPieceSourceEditing';

describe('supportsGeneratedSourceEditing', () => {
  it('includes every registered generated engine', () => {
    expect(supportsGeneratedSourceEditing('canvas2d')).toBe(true);
    expect(supportsGeneratedSourceEditing('svg')).toBe(true);
    expect(supportsGeneratedSourceEditing('p5js')).toBe(true);
    expect(supportsGeneratedSourceEditing('c2js')).toBe(true);
    expect(supportsGeneratedSourceEditing('c2js-interactive')).toBe(true);
    expect(supportsGeneratedSourceEditing('threejs')).toBe(true);
    expect(supportsGeneratedSourceEditing('aframe')).toBe(true);
  });
});
