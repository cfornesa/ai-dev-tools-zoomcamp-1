import { describe, expect, it } from 'vitest';

import { ART_PIECE_ENGINE_CAPABILITIES, type ArtPieceLibrary } from '../api/artPieces';
import { ART_PIECE_IFRAME_SANDBOX, buildArtPieceSandboxDocument } from './artPieceSandbox';
import { ART_PIECE_STARTERS, getArtPieceStarter } from './artPieceStarters';

const libraries = Object.keys(ART_PIECE_ENGINE_CAPABILITIES) as ArtPieceLibrary[];
const visibleMarkers: Record<ArtPieceLibrary, RegExp> = {
  canvas2d: /getContext\('2d'\)/,
  svg: /<circle/,
  p5js: /p\.circle/,
  c2js: /ctx\.arc\(/,
  'c2js-interactive': /ctx\.arc\(/,
  threejs: /SphereGeometry/,
  aframe: /<a-sphere/,
};

describe('art piece library starters', () => {
  it.each(libraries)(
    '%s has a visible starter that uses the existing sandbox contract',
    (library) => {
      const source = getArtPieceStarter(library);
      const document = buildArtPieceSandboxDocument(source, library);

      expect(source.trim().length).toBeGreaterThan(100);
      expect(document).toContain("default-src 'none'");
      expect(ART_PIECE_IFRAME_SANDBOX).toBe('allow-scripts');
      expect(ART_PIECE_STARTERS[library]).toBe(source);
      expect(source).toMatch(visibleMarkers[library]);
    },
  );

  it('keeps C2 starter code on the sandbox fallback renderer contract', () => {
    expect(ART_PIECE_STARTERS.c2js).toContain('window.sketch = function ({ canvas, startFrame })');
    expect(ART_PIECE_STARTERS.c2js).toContain("canvas.getContext('2d')");
    expect(ART_PIECE_STARTERS['c2js-interactive']).toContain('canvas.addEventListener');
  });

  it('uses the pinned sandbox runtime for WebGL starters without adding their own script tags', () => {
    expect(ART_PIECE_STARTERS.threejs).toContain('new THREE.WebGLRenderer');
    expect(ART_PIECE_STARTERS.aframe).toContain('<a-scene');
    expect(ART_PIECE_STARTERS.threejs).not.toContain('<script src=');
    expect(ART_PIECE_STARTERS.aframe).not.toContain('<script src=');
  });
});
