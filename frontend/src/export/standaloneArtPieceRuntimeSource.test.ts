import { describe, expect, it } from 'vitest';

import type { ArtPieceLibrary } from '../api/artPieces';
import { buildStandaloneArtPieceRuntimeScript } from './standaloneArtPieceRuntimeSource';

const LIBRARIES: ArtPieceLibrary[] = [
  'canvas2d',
  'svg',
  'p5js',
  'c2js',
  'c2js-interactive',
  'threejs',
  'aframe',
];

/** A syntax error anywhere in the generated runtime silently disables every export button, so parse it. */
function scriptBody(html: string): string {
  return html.replace(/^\s*<script[^>]*>/, '').replace(/<\/script>\s*$/, '');
}

describe('standalone art-piece runtime source', () => {
  for (const library of LIBRARIES) {
    for (const mode of ['full', 'non-camera'] as const) {
      for (const presentation of ['regular', 'immersive'] as const) {
        it(`${library} ${mode} ${presentation} is syntactically valid JavaScript`, () => {
          const source = buildStandaloneArtPieceRuntimeScript(
            library,
            {
              sound: true,
              keyboard: true,
              microphone: true,
              camera_view: true,
              hand_steering: true,
              fullscreen: true,
              screenshot: true,
              download: true,
              immersive: true,
            },
            mode,
            presentation,
          );
          expect(() => new Function(scriptBody(source))).not.toThrow();
        });
      }
    }
  }

  it('an inked SVG screenshot appends the ink group without a regex over markup', () => {
    const source = buildStandaloneArtPieceRuntimeScript('svg', { screenshot: true }, 'full');
    expect(source).toContain('__artPieceInkSvg');
    expect(source).toContain("lastIndexOf('</svg>')");
  });

  it('#801 includes a shared ready marker and ten-second startup failure path', () => {
    const source = buildStandaloneArtPieceRuntimeScript('svg', { screenshot: true }, 'full');
    expect(source).toContain('The interactive runtime could not be started.');
    expect(source).toContain('}, 10000);');
    expect(source).toContain('art-piece-runtime-ready');
    expect(source).toContain('art-piece-runtime-error');
  });

  it('#842 keeps the full live sound control set in Non-Camera exports while omitting device controls', () => {
    const capabilities = {
      sound: true,
      keyboard: true,
      microphone: true,
      camera_view: true,
      hand_steering: true,
      fullscreen: true,
      screenshot: true,
      download: true,
      immersive: true,
    };
    const full = buildStandaloneArtPieceRuntimeScript('canvas2d', capabilities, 'full');
    const nonCamera = buildStandaloneArtPieceRuntimeScript('canvas2d', capabilities, 'non-camera');
    for (const id of [
      'art-piece-ambient-bpm',
      'art-piece-ambient-volume',
      'art-piece-ambient-muted',
      'art-piece-ambient-scale',
      'art-piece-keyboard-volume',
      'art-piece-keyboard-oscillator',
      'art-piece-keyboard-filter-type',
      'art-piece-keyboard-filter-cutoff',
      'art-piece-keyboard-filter-resonance',
      'art-piece-keyboard-octave',
    ]) {
      expect(full).toContain(id);
      expect(nonCamera).toContain(id);
    }
    expect(full).toContain("['attack', 'decay', 'sustain', 'release']");
    expect(nonCamera).toContain("['attack', 'decay', 'sustain', 'release']");
    expect(full).toContain("byAction('microphone')");
  });
});
