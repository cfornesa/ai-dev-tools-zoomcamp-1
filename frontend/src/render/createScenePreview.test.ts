import { afterEach, describe, expect, it } from 'vitest';

import { createCanvas2DScenePreview } from './canvas2dAdapter';
import { createScenePreview, resolveSceneRendererId } from './createScenePreview';
import { createP5ScenePreview } from './p5Adapter';
import { baseScene } from './testSceneFixtures';

const previews: Array<ReturnType<typeof createScenePreview>> = [];
afterEach(() => {
  for (const p of previews.splice(0)) p.destroy();
});

function container(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('resolveSceneRendererId', () => {
  it('resolves "p5" for a scene with renderer.preferred: "p5"', () => {
    expect(resolveSceneRendererId(baseScene({ renderer: { preferred: 'p5' } }))).toBe('p5');
  });

  it('resolves "canvas2d" for a scene with renderer.preferred: "canvas2d"', () => {
    expect(resolveSceneRendererId(baseScene({ renderer: { preferred: 'canvas2d' } }))).toBe(
      'canvas2d',
    );
  });

  it('defaults to "p5" for a scene missing/malformed renderer, without throwing', () => {
    expect(resolveSceneRendererId({})).toBe('p5');
    expect(resolveSceneRendererId(null)).toBe('p5');
    expect(resolveSceneRendererId(undefined)).toBe('p5');
    expect(resolveSceneRendererId({ renderer: { preferred: 'webgl' } })).toBe('p5');
  });

  it('keeps native scenes on a native renderer instead of claiming Draw.io interoperability', () => {
    const nativeScene = baseScene({ renderer: { preferred: 'canvas2d' } });

    expect(nativeScene.documentType).not.toBe('drawio');
    expect(resolveSceneRendererId(nativeScene)).toBe('canvas2d');
  });
});

describe('createScenePreview', () => {
  it('creates a p5-backed preview for rendererId "p5"', () => {
    const preview = createScenePreview(container(), 'p5');
    previews.push(preview);
    preview.render(baseScene());
    expect(preview.getCanvasElement()).not.toBeNull();
  });

  it('creates a Canvas2D-backed preview for rendererId "canvas2d"', () => {
    const preview = createScenePreview(container(), 'canvas2d');
    previews.push(preview);
    preview.render(baseScene({ renderer: { preferred: 'canvas2d' } }));
    expect(preview.getCanvasElement()).not.toBeNull();
  });

  it('both adapters render the same scene to identical pixels', () => {
    const scene = baseScene({
      canvas: { width: 30, height: 30, backgroundColor: '#123456' },
      shapes: [
        {
          id: 'shape-circle',
          type: 'circle',
          layerId: 'layer-1',
          groupId: null,
          transform: { x: 15, y: 15, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
          style: { fill: '#ff8800', stroke: null, strokeWidth: 0 },
          radius: 8,
        },
      ],
    });
    const p5Preview = createP5ScenePreview(container());
    const canvas2dPreview = createCanvas2DScenePreview(container());
    previews.push(p5Preview, canvas2dPreview);
    p5Preview.render(scene);
    canvas2dPreview.render(scene);

    const a = p5Preview.getCanvasElement()!;
    const b = canvas2dPreview.getCanvasElement()!;
    const dataA = a.getContext('2d')!.getImageData(0, 0, a.width, a.height).data;
    const dataB = b.getContext('2d')!.getImageData(0, 0, b.width, b.height).data;
    expect(Array.from(dataA)).toEqual(Array.from(dataB));
  });
});
