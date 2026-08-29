/**
 * Issue #207: the SVG rendering adapter. Draws a validated canonical scene
 * document (`../../../schema/scene.schema.json`) as real SVG DOM elements
 * (`<circle>`/`<rect>`/`<line>`/`<path>`/nested `<g>`) instead of drawing
 * calls against a raster surface, selected when a scene's
 * `renderer.preferred` is `"svg"` (see `createScenePreview.ts`).
 *
 * Like `p5Adapter.ts`/`canvas2dAdapter.ts`, this module never evaluates a
 * scene field as code: every DOM node is built via `document.createElementNS`
 * and `setAttribute` with values that are always numbers, hex/rgba color
 * strings, or a small fixed set of literal enum values -- never `innerHTML`,
 * `outerHTML`, or any other string-interpolated markup. This matters more
 * for SVG than for the other two adapters: unlike Canvas2D, SVG markup
 * genuinely *can* execute embedded `<script>`/event-handler-attribute
 * content if it were ever built from interpolated strings instead of the
 * DOM APIs used throughout this file.
 *
 * ## Why `getCanvasElement()` delegates to a private Canvas2D adapter
 *
 * `ScenePreview.getCanvasElement()` returns an `HTMLCanvasElement | null`
 * and is called synchronously right after `render()` by
 * `captureSocialThumbnail.ts` and every adapter test -- SVG has no native
 * canvas surface to hand back, and an async SVG-serialize-to-`Image`-to-
 * canvas conversion can't satisfy that synchronous contract without
 * widening the shared `ScenePreview` interface (a much larger, riskier
 * change touching every adapter and call site; see issue #207's own
 * grooming comment). Instead, this adapter keeps a private, never-mounted
 * `canvas2dAdapter.ts` instance in sync on every `render()` call purely for
 * capture -- reusing that already-tested engine rather than hand-porting
 * its opacity-buffer/camera-compositing logic a third time. The real SVG
 * DOM (built independently, below) is what's actually visible in the
 * editor and public viewer; the mirror canvas is invisible plumbing.
 *
 * ## Camera overlay: `<foreignObject>` hosting a canvas, not the raw `<video>`
 *
 * The issue's own draft criteria suggested hosting the real `<video>`
 * element inline via `<foreignObject>`. This adapter instead puts a small
 * `<canvas>` inside the `<foreignObject>` and `drawImage`s the camera
 * source into it every frame -- structurally still "compositing within the
 * SVG DOM," but works uniformly for all three `RenderableCameraOverlay`
 * source types (`HTMLVideoElement | HTMLImageElement | HTMLCanvasElement`,
 * only one of which is a `<video>`) without reparenting a DOM node another
 * component owns via a React ref.
 *
 * ## `canvas.opacity`: a native SVG advantage
 *
 * Unlike the raster adapters (which need an offscreen buffer + single
 * `tint`/`globalAlpha` composite to make `canvas.opacity` scale the whole
 * frame as one flattened layer -- see `p5Adapter.ts`'s `sk.draw` doc
 * comment), SVG's own `opacity` attribute on the root `<svg>` element
 * already composites its entire rendered subtree as one unit. No buffer
 * needed here.
 */
import type { SceneDocument } from '../api/projects';
import { createCanvas2DScenePreview } from './canvas2dAdapter';
import {
  buildScenePlan,
  type AnyShape,
  type DrawNode,
  type ScenePlan,
  type Transform2D,
} from './sceneDrawPlan';
import type {
  RenderableCameraOverlay,
  RenderableParticle,
  RenderableTrail,
  ScenePreview,
} from './scenePreview';

export { SceneRenderError } from './sceneDrawPlan';
export type { RenderableCameraOverlay, RenderableParticle, RenderableTrail } from './scenePreview';

export type SVGScenePreview = ScenePreview;

const SVG_NS = 'http://www.w3.org/2000/svg';

function parseColor(hex: string): { r: number; g: number; b: number; a: number } {
  let h = hex.slice(1);
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

function rgba(hex: string): string {
  const c = parseColor(hex);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
}

function transformAttr(t: Transform2D): string {
  return `translate(${t.x} ${t.y}) rotate(${t.rotation}) scale(${t.scaleX} ${t.scaleY})`;
}

function el<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
}

/** Sets fill/stroke/stroke-width attributes for `shape`'s own style, plus
 * `opacity` for `shape.transform.opacity` -- SVG's native nested-opacity
 * compositing handles multiplying that against every ancestor `<g>`'s own
 * `opacity`, so no manual inherited-opacity multiplication is needed here
 * (contrast `canvas2dAdapter.ts`'s `computeDrawState`, which must do this
 * multiplication by hand). */
function applyStyleAttrs(node: SVGElement, shape: AnyShape): void {
  const { style } = shape;
  node.setAttribute('fill', style.fill === null ? 'none' : rgba(style.fill));
  node.setAttribute('stroke', style.stroke === null ? 'none' : rgba(style.stroke));
  node.setAttribute('stroke-width', String(style.strokeWidth));
  node.setAttribute('opacity', String(shape.transform.opacity));
  node.setAttribute('transform', transformAttr(shape.transform));
}

function buildShapeElement(shape: AnyShape): SVGElement {
  switch (shape.type) {
    case 'circle': {
      const node = el('circle');
      node.setAttribute('cx', '0');
      node.setAttribute('cy', '0');
      node.setAttribute('r', String(shape.radius));
      applyStyleAttrs(node, shape);
      return node;
    }
    case 'rect': {
      const node = el('rect');
      node.setAttribute('x', '0');
      node.setAttribute('y', '0');
      node.setAttribute('width', String(shape.width));
      node.setAttribute('height', String(shape.height));
      node.setAttribute('rx', String(shape.cornerRadius));
      node.setAttribute('ry', String(shape.cornerRadius));
      applyStyleAttrs(node, shape);
      return node;
    }
    case 'line': {
      const node = el('line');
      node.setAttribute('x1', '0');
      node.setAttribute('y1', '0');
      node.setAttribute('x2', String(shape.x2 - shape.transform.x));
      node.setAttribute('y2', String(shape.y2 - shape.transform.y));
      // Lines only ever stroke, matching the other adapters' identical
      // convention (see canvas2dAdapter.ts's 'line' case) -- no fill
      // attribute makes sense for a zero-area path.
      const { style } = shape;
      node.setAttribute('stroke', style.stroke === null ? 'none' : rgba(style.stroke));
      node.setAttribute('stroke-width', String(style.strokeWidth));
      node.setAttribute('opacity', String(shape.transform.opacity));
      node.setAttribute('transform', transformAttr(shape.transform));
      return node;
    }
    case 'path': {
      const node = el('path');
      const points = shape.points;
      let d = '';
      if (points.length > 0) {
        d =
          `M ${points[0].x} ${points[0].y} ` +
          points
            .slice(1)
            .map((p) => `L ${p.x} ${p.y}`)
            .join(' ');
        if (shape.closed) d += ' Z';
      }
      node.setAttribute('d', d);
      applyStyleAttrs(node, shape);
      return node;
    }
    case 'particleEmitter': {
      const node = el('circle');
      node.setAttribute('cx', '0');
      node.setAttribute('cy', '0');
      node.setAttribute('r', String(shape.size / 2));
      // Marker uses the emitter's own palette when present, at full
      // opacity -- matching p5Adapter.ts/canvas2dAdapter.ts's identical
      // "the marker's palette color ignores the shape's own opacity
      // multiplier" behavior.
      if (shape.palette.length > 0) {
        node.setAttribute('fill', rgba(shape.palette[0]));
      } else {
        node.setAttribute('fill', shape.style.fill === null ? 'none' : rgba(shape.style.fill));
      }
      node.setAttribute('stroke', shape.style.stroke === null ? 'none' : rgba(shape.style.stroke));
      node.setAttribute('stroke-width', String(shape.style.strokeWidth));
      node.setAttribute('transform', transformAttr(shape.transform));
      return node;
    }
  }
}

function buildNodeElement(node: DrawNode): SVGElement {
  if (node.kind === 'shape') {
    return buildShapeElement(node.shape);
  }
  const group = el('g');
  if (!node.group.visible) {
    group.setAttribute('display', 'none');
    return group;
  }
  group.setAttribute('transform', transformAttr(node.group.transform));
  group.setAttribute('opacity', String(node.group.transform.opacity));
  for (const child of node.children) group.appendChild(buildNodeElement(child));
  return group;
}

function buildTrailElement(trail: RenderableTrail): SVGElement | null {
  const points = trail.points;
  if (points.length === 0) return null;
  const color = rgba(trail.color);
  if (points.length === 1) {
    const node = el('circle');
    node.setAttribute('cx', String(points[0].x));
    node.setAttribute('cy', String(points[0].y));
    node.setAttribute('r', '2');
    node.setAttribute('fill', color);
    node.setAttribute('stroke', 'none');
    return node;
  }
  const node = el('polyline');
  node.setAttribute('points', points.map((p) => `${p.x},${p.y}`).join(' '));
  node.setAttribute('fill', 'none');
  node.setAttribute('stroke', color);
  node.setAttribute('stroke-width', '2');
  return node;
}

function buildParticleElement(particle: RenderableParticle): SVGElement {
  const node = el('circle');
  node.setAttribute('cx', String(particle.x));
  node.setAttribute('cy', String(particle.y));
  node.setAttribute('r', String(Math.max(0, particle.size) / 2));
  node.setAttribute('fill', rgba(particle.color));
  node.setAttribute('stroke', 'none');
  return node;
}

function layerOrderForNode(plan: ScenePlan, node: DrawNode): number {
  const layerId = node.kind === 'shape' ? node.shape.layerId : node.group.layerId;
  return plan.layers.find((layer) => layer.id === layerId)?.order ?? Number.POSITIVE_INFINITY;
}

/** Builds the `<foreignObject>` camera-overlay element -- a small internal
 * `<canvas>` drawn via `drawImage` every frame, positioned/sized exactly
 * like the other two adapters' overlay geometry. See the module doc
 * comment's "Camera overlay" section for why this hosts a canvas rather
 * than the raw source element. */
function buildCameraOverlayElement(
  overlay: RenderableCameraOverlay,
  canvasWidth: number,
  canvasHeight: number,
): SVGElement | null {
  if (
    overlay.source instanceof HTMLVideoElement &&
    (overlay.source.readyState < 2 ||
      overlay.source.videoWidth <= 0 ||
      overlay.source.videoHeight <= 0)
  ) {
    return null;
  }
  const x = overlay.geometry.x * canvasWidth;
  const y = overlay.geometry.y * canvasHeight;
  const width = overlay.geometry.width * canvasWidth;
  const height = overlay.geometry.height * canvasHeight;

  const foreignObject = el('foreignObject');
  foreignObject.setAttribute('x', String(x));
  foreignObject.setAttribute('y', String(y));
  foreignObject.setAttribute('width', String(width));
  foreignObject.setAttribute('height', String(height));
  foreignObject.setAttribute('opacity', String(overlay.opacity));

  const canvas = document.createElementNS(
    'http://www.w3.org/1999/xhtml',
    'canvas',
  ) as HTMLCanvasElement;
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  if (overlay.mirrored) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(overlay.source, 0, 0, canvas.width, canvas.height);

  foreignObject.appendChild(canvas);
  return foreignObject;
}

/**
 * Creates an SVG preview bound to `container`. Call `render(scene)`
 * whenever the scene changes; call `destroy()` on unmount. Every `render()`
 * call rebuilds the SVG's children from scratch (matching the other two
 * adapters' immediate-mode redraw-every-frame model) and re-syncs the
 * private mirror `canvas2dAdapter.ts` instance `getCanvasElement()`
 * delegates to.
 */
export function createSVGScenePreview(container: HTMLElement): SVGScenePreview {
  let svg: SVGSVGElement | null = null;
  // Never mounted into `container` (or anywhere in the visible document) --
  // exists purely so getCanvasElement() has a real, already-tested
  // renderer to delegate to. See the module doc comment.
  const mirrorContainer = document.createElement('div');
  const mirrorPreview = createCanvas2DScenePreview(mirrorContainer);

  function ensureSvg(width: number, height: number): SVGSVGElement {
    if (svg) {
      if (svg.getAttribute('width') !== String(width)) svg.setAttribute('width', String(width));
      if (svg.getAttribute('height') !== String(height)) svg.setAttribute('height', String(height));
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      return svg;
    }
    svg = el('svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    container.appendChild(svg);
    return svg;
  }

  function render(
    scene: SceneDocument,
    particles: readonly RenderableParticle[] = [],
    trails: readonly RenderableTrail[] = [],
    transparentBackground = false,
    cameraOverlay?: RenderableCameraOverlay,
  ): void {
    // Delegates all scene validation to the mirror preview -- it throws
    // SceneRenderError before touching anything (its own canvas included)
    // for an invalid scene, so this adapter's own SVG DOM is guaranteed
    // untouched too whenever this line throws.
    mirrorPreview.render(scene, particles, trails, transparentBackground, cameraOverlay);

    const plan = buildScenePlan(scene);
    const root = ensureSvg(plan.canvas.width, plan.canvas.height);
    root.setAttribute('opacity', String(plan.canvas.opacity));
    while (root.firstChild) root.removeChild(root.firstChild);

    if (!transparentBackground) {
      const bg = el('rect');
      bg.setAttribute('x', '0');
      bg.setAttribute('y', '0');
      bg.setAttribute('width', String(plan.canvas.width));
      bg.setAttribute('height', String(plan.canvas.height));
      bg.setAttribute('fill', plan.canvas.backgroundColor);
      root.appendChild(bg);
    }

    for (const trail of trails) {
      const trailEl = buildTrailElement(trail);
      if (trailEl) root.appendChild(trailEl);
    }

    if (cameraOverlay) {
      const behindNodes: DrawNode[] = [];
      const frontNodes: DrawNode[] = [];
      for (const node of plan.nodes) {
        if (layerOrderForNode(plan, node) >= cameraOverlay.layerOrder) {
          frontNodes.push(node);
        } else {
          behindNodes.push(node);
        }
      }
      for (const node of behindNodes) root.appendChild(buildNodeElement(node));
      const overlayEl = buildCameraOverlayElement(
        cameraOverlay,
        plan.canvas.width,
        plan.canvas.height,
      );
      if (overlayEl) root.appendChild(overlayEl);
      for (const node of frontNodes) root.appendChild(buildNodeElement(node));
    } else {
      for (const node of plan.nodes) root.appendChild(buildNodeElement(node));
    }

    for (const particle of particles) root.appendChild(buildParticleElement(particle));
  }

  function destroy(): void {
    svg?.remove();
    svg = null;
    mirrorPreview.destroy();
  }

  function getCanvasElement(): HTMLCanvasElement | null {
    return mirrorPreview.getCanvasElement();
  }

  return { render, destroy, getCanvasElement };
}
