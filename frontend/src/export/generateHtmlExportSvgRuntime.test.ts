/**
 * Issue #207: the SVG counterpart of `generateHtmlExportCanvas2DRuntime.test.ts`
 * -- a functional smoke test that actually *runs* the exported HTML's
 * embedded SVG runtime script in a jsdom sandbox. Unlike the Canvas2D
 * export (which draws into a real `CanvasRenderingContext2D` this repo's
 * `canvas` polyfill can rasterize), jsdom has no SVG layout/rasterization
 * engine at all -- there are no pixels to sample. This test instead
 * asserts on the real SVG DOM tree the runtime builds (element type,
 * `fill`/`transform` attributes), which jsdom supports structurally.
 *
 * Uses the same `stubAnimationFrame` deterministic rAF stand-in as the
 * Canvas2D runtime test.
 */
import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { generateHtmlExport } from './generateHtmlExport';

function svgSceneWithFollowHandBinding(): SceneDocument {
  return {
    schemaVersion: 1,
    id: 'scene-1',
    canvas: { width: 40, height: 40, backgroundColor: '#000000' },
    renderer: { preferred: 'svg' },
    layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
    shapes: [
      {
        id: 'shape-1',
        type: 'circle',
        layerId: 'layer-1',
        groupId: null,
        transform: { x: 0, y: 20, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        style: { fill: '#ff0000', stroke: null, strokeWidth: 0 },
        radius: 5,
      },
    ],
    groups: [],
    bindings: [
      {
        id: 'binding-follow-x',
        signal: 'indexTipX',
        handTarget: 'primary',
        targetScope: 'shape',
        targetId: 'shape-1',
        targetProperty: 'positionX',
        composition: 'replace',
        mapping: { inMin: 0, inMax: 1, outMin: 0, outMax: 40 },
      },
    ],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'off' },
    randomness: { seed: 0, enabled: false },
  };
}

function stubAnimationFrame(): { flush: () => void; restore: () => void } {
  const originalRequest = window.requestAnimationFrame;
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  }) as unknown as typeof window.requestAnimationFrame;
  return {
    flush: () => {
      const callbacks = Array.from(pending.values());
      pending.clear();
      for (const cb of callbacks) cb(performance.now());
    },
    restore: () => {
      window.requestAnimationFrame = originalRequest;
    },
  };
}

function loadExportedDocument(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  document.body.innerHTML = '';
  document.title = doc.title;
  Array.from(doc.body.children).forEach((node) => {
    if (node.tagName.toLowerCase() !== 'script') {
      document.body.appendChild(node.cloneNode(true));
    }
  });
  const sceneDataScript = doc.getElementById('scene-data');
  const configScript = doc.getElementById('export-config');
  const sceneScriptEl = document.createElement('script');
  sceneScriptEl.type = 'application/json';
  sceneScriptEl.id = 'scene-data';
  sceneScriptEl.textContent = sceneDataScript?.textContent ?? '';
  document.body.appendChild(sceneScriptEl);
  const configScriptEl = document.createElement('script');
  configScriptEl.type = 'application/json';
  configScriptEl.id = 'export-config';
  configScriptEl.textContent = configScript?.textContent ?? '';
  document.body.appendChild(configScriptEl);

  const runtimeScripts = Array.from(doc.querySelectorAll('script')).filter(
    (s) => !s.id && !s.hasAttribute('src'),
  );
  expect(runtimeScripts).toHaveLength(1);
  return runtimeScripts[0].textContent ?? '';
}

describe('exported SVG runtime script: functional smoke test in a jsdom sandbox', () => {
  it('produces a document with no CDN <script> tag', () => {
    const result = generateHtmlExport({
      scene: svgSceneWithFollowHandBinding(),
      title: 'SVG Export',
      description: 'No CDN dependency.',
      interactionMode: 'demo',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).not.toMatch(/cdn\.jsdelivr\.net/);
  });

  it('builds a real <svg> tree with the background rect and shape element', () => {
    const result = generateHtmlExport({
      scene: svgSceneWithFollowHandBinding(),
      title: 'SVG Runtime Smoke Test',
      description: 'Exercises the embedded SVG runtime end to end.',
      interactionMode: 'demo',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const runtimeSource = loadExportedDocument(result.html);
    const raf = stubAnimationFrame();
    try {
      // eslint-disable-next-line no-eval
      (0, eval)(runtimeSource);
      document.dispatchEvent(new Event('DOMContentLoaded'));
      raf.flush();

      const svg = document.getElementById('scene-canvas-host')?.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg!.getAttribute('width')).toBe('40');
      expect(svg!.getAttribute('height')).toBe('40');

      const rects = svg!.querySelectorAll('rect');
      expect(rects.length).toBeGreaterThanOrEqual(1);
      expect(rects[0].getAttribute('fill')).toBe('#000000');

      const circle = svg!.querySelector('circle');
      expect(circle).not.toBeNull();
      expect(circle!.getAttribute('fill')).toBe('rgba(255, 0, 0, 1)');
      expect(circle!.getAttribute('transform')).toContain('translate(0 20)');
    } finally {
      raf.restore();
    }
  });

  it('evaluates a binding to move the shape element in response to a demo signal', () => {
    const result = generateHtmlExport({
      scene: svgSceneWithFollowHandBinding(),
      title: 'SVG Binding Smoke Test',
      description: 'Exercises binding evaluation end to end.',
      interactionMode: 'demo',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const runtimeSource = loadExportedDocument(result.html);
    const raf = stubAnimationFrame();
    try {
      // eslint-disable-next-line no-eval
      (0, eval)(runtimeSource);
      document.dispatchEvent(new Event('DOMContentLoaded'));
      raf.flush();

      const svg = document.getElementById('scene-canvas-host')?.querySelector('svg');
      // Before the binding fires (no hand present yet), the shape sits at
      // its authored x=0.
      expect(svg!.querySelector('circle')!.getAttribute('transform')).toContain('translate(0 20)');

      const presentButton = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent === 'Hand present',
      );
      expect(presentButton).toBeDefined();
      presentButton?.dispatchEvent(new Event('click', { bubbles: true }));

      const slider = document.getElementById('slider-indexTipX') as HTMLInputElement | null;
      expect(slider).not.toBeNull();
      if (slider) {
        slider.value = '1';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }

      raf.flush();

      // indexTipX = 1 maps to x = 40 (the mapping's outMax).
      expect(svg!.querySelector('circle')!.getAttribute('transform')).toContain('translate(40 20)');
    } finally {
      raf.restore();
    }
  });
});
