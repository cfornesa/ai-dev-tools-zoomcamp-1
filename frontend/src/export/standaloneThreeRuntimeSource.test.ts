import { describe, expect, it } from 'vitest';

import { buildStandaloneThreeRuntimeScript } from './standaloneThreeRuntimeSource';

describe('standalone Three.js runtime source (#787)', () => {
  for (const includeCameraFeatures of [true, false]) {
    for (const immersive of [false, true]) {
      it(`is syntactically valid JavaScript (camera features ${includeCameraFeatures}, immersive ${immersive})`, () => {
        const source = buildStandaloneThreeRuntimeScript({ includeCameraFeatures, immersive });
        expect(() => new Function(source)).not.toThrow();
      });
    }
  }

  it('embeds the drawing painter, the animation maths, and a capturable renderer', () => {
    const source = buildStandaloneThreeRuntimeScript();
    expect(source).toContain('function scene3dPaintDrawing');
    expect(source).toContain('function scene3dAnimatedTransform');
    expect(source).toContain('preserveDrawingBuffer: true');
    expect(source).toContain('new THREE.CanvasTexture');
  });

  it('#842 exposes every live sound control and keeps device controls out of Non-Camera ZIPs', () => {
    const full = buildStandaloneThreeRuntimeScript({ includeCameraFeatures: true });
    const nonCamera = buildStandaloneThreeRuntimeScript({ includeCameraFeatures: false });
    for (const id of [
      'piece-volume',
      'piece-ambient-bpm',
      'piece-ambient-volume',
      'piece-ambient-muted',
      'piece-ambient-scale',
      'piece-keyboard-volume',
      'piece-keyboard-oscillator',
      'piece-keyboard-filter-type',
      'piece-keyboard-filter-cutoff',
      'piece-keyboard-filter-resonance',
      'piece-keyboard-octave',
    ]) {
      expect(full).toContain(id);
      expect(nonCamera).toContain(id);
    }
    expect(full).toContain("['attack', 'decay', 'sustain', 'release']");
    expect(nonCamera).toContain("['attack', 'decay', 'sustain', 'release']");
    expect(full).toContain("getElementById('piece-mic')");
    expect(full).toContain("getElementById('piece-theremin')");
    expect(nonCamera).not.toContain("getElementById('piece-mic')");
    expect(nonCamera).not.toContain("getElementById('piece-theremin')");
  });
});
