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
});
