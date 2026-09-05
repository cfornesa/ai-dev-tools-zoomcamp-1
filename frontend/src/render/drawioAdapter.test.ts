import { afterEach, describe, expect, it } from 'vitest';

import { createScenePreview, resolveSceneRendererId } from './createScenePreview';
import { baseScene } from './testSceneFixtures';

const previews: ReturnType<typeof createScenePreview>[] = [];

afterEach(() => {
  for (const preview of previews.splice(0)) preview.destroy();
});

function drawioScene() {
  return baseScene({
    documentType: 'drawio',
    drawio: {
      formatVersion: 1,
      layers: [{ id: 'draw-layer', name: 'Shapes', order: 0, visible: true, locked: false }],
      objects: [
        {
          id: 'draw-rect',
          type: 'rect',
          layerId: 'draw-layer',
          parentId: null,
          x: 2,
          y: 3,
          width: 10,
          height: 8,
          fill: '#ff0000',
          stroke: '#000000',
        },
      ],
    },
  });
}

describe('draw.io renderer boundary', () => {
  it('selects draw.io from the document discriminator', () => {
    expect(resolveSceneRendererId(drawioScene())).toBe('drawio');
  });

  it('renders the supported object subset without a live draw.io service', () => {
    const preview = createScenePreview(
      document.body.appendChild(document.createElement('div')),
      'drawio',
    );
    previews.push(preview);
    preview.render(drawioScene());
    expect(preview.getCanvasElement()).not.toBeNull();
    expect(preview.getCanvasElement()?.width).toBeGreaterThan(0);
  });
});
