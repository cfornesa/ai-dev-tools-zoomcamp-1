import { describe, expect, it } from 'vitest';

import { ART_PIECE_ENGINE_CAPABILITIES } from './artPieces';

describe('art-piece engine capability registry', () => {
  it('keeps stable identifiers separate from display labels', () => {
    expect(Object.keys(ART_PIECE_ENGINE_CAPABILITIES)).toEqual([
      'canvas2d',
      'svg',
      'p5js',
      'c2js',
      'c2js-interactive',
      'threejs',
      'aframe',
    ]);
    expect(ART_PIECE_ENGINE_CAPABILITIES['c2js-interactive'].label).toBe('C2.js Interactive');
  });

  it('claims only regular-view support for newly registered engines', () => {
    for (const engine of ['p5js', 'c2js', 'c2js-interactive'] as const) {
      expect(ART_PIECE_ENGINE_CAPABILITIES[engine]).toMatchObject({
        regular: true,
        immersive: false,
        embed: false,
        download: false,
        generation: true,
      });
    }
  });
});
