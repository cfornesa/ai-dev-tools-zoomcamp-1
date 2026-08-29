/**
 * Issue #206: the Canvas2D counterpart of `generateHtmlExportRuntime.test.ts`
 * -- a functional smoke test that actually *runs* the exported HTML's
 * embedded Canvas2D runtime script in a jsdom sandbox (jsdom + the `canvas`
 * package this repo already depends on for `frontend/src/render/*.test.ts`'s
 * pixel-level assertions gives a real `CanvasRenderingContext2D`, so unlike
 * the p5 runtime test this needs no fake renderer stand-in at all -- the
 * genuine draw calls run and produce real pixels this test reads back).
 *
 * Uses `stubAnimationFrame` (the same deterministic rAF stand-in
 * `generateHtmlExportCameraRuntime.test.ts`/`useCameraOverlayRedrawLoop.test.ts`
 * already use) since this runtime drives its draw loop with
 * `window.requestAnimationFrame`, not p5's `noLoop()`/`redraw()`.
 */
import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { generateHtmlExport } from './generateHtmlExport';

function canvas2DSceneWithFollowHandBinding(): SceneDocument {
  return {
    schemaVersion: 1,
    id: 'scene-1',
    canvas: { width: 40, height: 40, backgroundColor: '#000000' },
    renderer: { preferred: 'canvas2d' },
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

/** Deterministic, manually-driven stand-in for `requestAnimationFrame` --
 * identical pattern to `generateHtmlExportCameraRuntime.test.ts`'s own
 * `stubAnimationFrame`. */
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

function pixel(canvas: HTMLCanvasElement, x: number, y: number): [number, number, number, number] {
  const ctx = canvas.getContext('2d')!;
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2], d[3]];
}

/** Rehydrates a `generateHtmlExport` result into the live jsdom `document`
 * this test runs in and returns the runtime `<script>`'s source text --
 * identical setup to `generateHtmlExportRuntime.test.ts`'s own tests. */
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

describe('exported Canvas2D runtime script: functional smoke test in a jsdom sandbox', () => {
  it('produces a document with no p5 CDN <script> tag', () => {
    const result = generateHtmlExport({
      scene: canvas2DSceneWithFollowHandBinding(),
      title: 'Canvas2D Export',
      description: 'No CDN dependency.',
      interactionMode: 'demo',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).not.toMatch(/cdn\.jsdelivr\.net\/npm\/p5/);
  });

  it('draws the scene into a real <canvas> with the background and shape colors', () => {
    const result = generateHtmlExport({
      scene: canvas2DSceneWithFollowHandBinding(),
      title: 'Canvas2D Runtime Smoke Test',
      description: 'Exercises the embedded Canvas2D runtime end to end.',
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

      const canvas = document.getElementById('scene-canvas-host')?.querySelector('canvas');
      expect(canvas).not.toBeNull();
      const canvasEl = canvas as HTMLCanvasElement;
      expect(canvasEl.width).toBe(40);
      expect(canvasEl.height).toBe(40);
      expect(pixel(canvasEl, 5, 5)).toEqual([0, 0, 0, 255]); // background
      expect(pixel(canvasEl, 0, 20)).toEqual([255, 0, 0, 255]); // shape center
    } finally {
      raf.restore();
    }
  });

  it('evaluates a binding to move the shape in response to a demo signal', () => {
    const result = generateHtmlExport({
      scene: canvas2DSceneWithFollowHandBinding(),
      title: 'Canvas2D Binding Smoke Test',
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

      const canvas = document.getElementById('scene-canvas-host')?.querySelector('canvas');
      const canvasEl = canvas as HTMLCanvasElement;
      // Before the binding fires (no hand present yet), the shape sits at
      // its authored x=0.
      expect(pixel(canvasEl, 0, 20)).toEqual([255, 0, 0, 255]);
      expect(pixel(canvasEl, 38, 20)).toEqual([0, 0, 0, 255]);

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

      // indexTipX = 1 maps to x = 40 (the mapping's outMax), moving the
      // circle to the far right edge -- no longer at x=0.
      expect(pixel(canvasEl, 38, 20)).toEqual([255, 0, 0, 255]);
    } finally {
      raf.restore();
    }
  });
});
