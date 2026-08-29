/**
 * Issue #206: the native Canvas2D rendering adapter. Draws a validated
 * canonical scene document (`../../../schema/scene.schema.json`) into a
 * plain `<canvas>` using the browser's own `CanvasRenderingContext2D` API
 * directly — no third-party library, unlike `p5Adapter.ts`'s p5.js
 * adapter. Selected when a scene's `renderer.preferred` is `"canvas2d"`
 * (see `createScenePreview.ts`).
 *
 * This file mirrors `p5Adapter.ts` line for line wherever the two
 * renderers' drawing conventions must agree (draw order, transform
 * composition, fill/stroke independence, camera-overlay compositing,
 * `canvas.opacity` whole-frame compositing) — see that file's own module
 * doc comment for the full behavioral contract both adapters implement
 * identically. Only the *how* differs: p5's instance-mode API
 * (`sk.translate`/`sk.fill`/`sk.circle`/...) versus direct
 * `CanvasRenderingContext2D` calls (`ctx.translate`/`ctx.fillStyle`/
 * `ctx.arc`/...).
 *
 * Like `p5Adapter.ts`, this module never evaluates a scene field as code:
 * every value read off a `ScenePlan` node is a number, string, or boolean
 * fed straight into a fixed Canvas2D API call, never into `eval`,
 * `new Function`, or a template that could be interpreted as code.
 */
import type { SceneDocument } from '../api/projects';
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

/** `createCanvas2DScenePreview`'s return type is the same shared
 * `ScenePreview` interface `p5Adapter.ts`'s `P5ScenePreview` aliases —
 * exported under its own name so call sites that specifically construct a
 * Canvas2D preview can name its type without reaching into `p5Adapter.ts`
 * for an unrelated renderer's type. */
export type Canvas2DScenePreview = ScenePreview;

type DrawState = { fill: string | null; stroke: string | null; lineWidth: number };

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

function rgba(hex: string, opacity: number): string {
  const c = parseColor(hex);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a * opacity})`;
}

function applyTransform(ctx: CanvasRenderingContext2D, t: Transform2D): void {
  ctx.translate(t.x, t.y);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale(t.scaleX, t.scaleY);
}

/** Mirrors `p5Adapter.ts`'s `applyFillAndStroke` — acceptance criterion 4:
 * fill:null and stroke:null are independent — either, both, or neither may
 * be set. Computed as data (rather than mutating context fill/stroke
 * state the way p5's `noFill`/`noStroke` do) because native Canvas2D has
 * no persistent "current fill/stroke" concept a shape's own draw call
 * consults automatically — each geometry function below applies this
 * state explicitly via `paint`. */
function computeDrawState(shape: AnyShape, opacity: number): DrawState {
  const { style } = shape;
  return {
    fill: style.fill === null ? null : rgba(style.fill, opacity),
    stroke: style.stroke === null ? null : rgba(style.stroke, opacity),
    lineWidth: style.strokeWidth,
  };
}

/** Fills (if `state.fill` is set) then strokes (if `state.stroke` is set)
 * the path already built on `ctx`. */
function paint(ctx: CanvasRenderingContext2D, state: DrawState): void {
  if (state.fill !== null) {
    ctx.fillStyle = state.fill;
    ctx.fill();
  }
  if (state.stroke !== null) {
    ctx.strokeStyle = state.stroke;
    ctx.lineWidth = state.lineWidth;
    ctx.stroke();
  }
}

/**
 * Draws one shape's type-specific geometry (acceptance criterion 2) in the
 * shape's *local* coordinate frame — i.e. after `applyTransform` has
 * already translated/rotated/scaled to the shape's `transform`. Mirrors
 * `p5Adapter.ts`'s `drawShapeGeometry` position conventions exactly: a
 * circle's transform is its center, a rect's transform is its top-left
 * corner, a line runs from the transform to (x2, y2) (so locally, from the
 * origin to (x2 - transform.x, y2 - transform.y)), and a path's points are
 * already relative offsets from the transform.
 */
function drawShapeGeometry(ctx: CanvasRenderingContext2D, shape: AnyShape, state: DrawState): void {
  switch (shape.type) {
    case 'circle': {
      ctx.beginPath();
      ctx.arc(0, 0, shape.radius, 0, Math.PI * 2);
      paint(ctx, state);
      return;
    }
    case 'rect': {
      ctx.beginPath();
      if (shape.cornerRadius > 0) {
        ctx.roundRect(0, 0, shape.width, shape.height, shape.cornerRadius);
      } else {
        ctx.rect(0, 0, shape.width, shape.height);
      }
      paint(ctx, state);
      return;
    }
    case 'line': {
      // p5's line() draws only a stroke, never a fill -- see
      // `p5Adapter.ts`'s identical case. No-op (invisible) when
      // `state.stroke` is null, exactly like p5's `noStroke()`.
      if (state.stroke === null) return;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(shape.x2 - shape.transform.x, shape.y2 - shape.transform.y);
      ctx.strokeStyle = state.stroke;
      ctx.lineWidth = state.lineWidth;
      ctx.stroke();
      return;
    }
    case 'path': {
      const points = shape.points;
      if (points.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
      if (shape.closed) ctx.closePath();
      paint(ctx, state);
      return;
    }
    case 'particleEmitter': {
      // Task 25/#206 parity: renders only the emitter's static configured
      // appearance (position, size, palette) as a marker -- no emission/
      // lifespan/speed simulation (Task 39) and no physics (Task 61). The
      // marker uses the emitter's own palette when present, at full
      // opacity (matching `p5Adapter.ts`'s `sk.fill(c.r,c.g,c.b)`, which
      // likewise omits an alpha argument -- the marker's palette color
      // deliberately ignores the shape's own opacity multiplier), falling
      // back to `state.fill` (already opacity-scaled) otherwise. Stroke,
      // if any, is unaffected either way.
      const fill =
        shape.palette.length > 0
          ? `rgb(${parseColor(shape.palette[0]).r}, ${parseColor(shape.palette[0]).g}, ${parseColor(shape.palette[0]).b})`
          : state.fill;
      ctx.beginPath();
      ctx.arc(0, 0, shape.size / 2, 0, Math.PI * 2);
      paint(ctx, { ...state, fill });
      return;
    }
  }
}

function drawNode(ctx: CanvasRenderingContext2D, node: DrawNode, inheritedOpacity: number): void {
  if (node.kind === 'shape') {
    const opacity = inheritedOpacity * node.shape.transform.opacity;
    ctx.save();
    applyTransform(ctx, node.shape.transform);
    drawShapeGeometry(ctx, node.shape, computeDrawState(node.shape, opacity));
    ctx.restore();
    return;
  }

  // Group. `locked` never affects rendering; `visible: false` hides the
  // entire subtree (acceptance criterion 6, extended consistently to
  // groups -- they carry the same visible/locked fields as layers).
  if (!node.group.visible) return;

  const opacity = inheritedOpacity * node.group.transform.opacity;
  ctx.save();
  applyTransform(ctx, node.group.transform);
  for (const child of node.children) drawNode(ctx, child, opacity);
  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, particle: RenderableParticle): void {
  const c = parseColor(particle.color);
  ctx.save();
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, Math.max(0, particle.size) / 2, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
  ctx.fill();
  ctx.restore();
}

/** Draws one trail — see `p5Adapter.ts`'s module doc comment's "Trails"
 * section for the polyline-vs-single-marker rule. Two or more points draw
 * an unfilled polyline; exactly one point draws a small filled marker (the
 * reduced-motion substitution); zero points draws nothing. */
function drawTrail(ctx: CanvasRenderingContext2D, trail: RenderableTrail): void {
  const points = trail.points;
  if (points.length === 0) return;
  const c = parseColor(trail.color);
  const color = `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
  ctx.save();
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function layerOrderForNode(plan: ScenePlan, node: DrawNode): number {
  const layerId = node.kind === 'shape' ? node.shape.layerId : node.group.layerId;
  return plan.layers.find((layer) => layer.id === layerId)?.order ?? Number.POSITIVE_INFINITY;
}

/** Mirrors `p5Adapter.ts`'s `drawCameraOverlay` nearly verbatim -- that
 * function already dropped to the raw Canvas2D context (`sk.drawingContext`)
 * to composite the camera frame, so this adapter's own native `ctx` needs
 * no adaptation beyond the name. */
function drawCameraOverlay(ctx: CanvasRenderingContext2D, overlay: RenderableCameraOverlay): void {
  if (
    overlay.source instanceof HTMLVideoElement &&
    (overlay.source.readyState < 2 ||
      overlay.source.videoWidth <= 0 ||
      overlay.source.videoHeight <= 0)
  ) {
    return;
  }
  const x = overlay.geometry.x * ctx.canvas.width;
  const y = overlay.geometry.y * ctx.canvas.height;
  const width = overlay.geometry.width * ctx.canvas.width;
  const height = overlay.geometry.height * ctx.canvas.height;
  ctx.save();
  ctx.globalAlpha = overlay.opacity;
  if (overlay.mirrored) {
    ctx.translate(x + width, y);
    ctx.scale(-1, 1);
    ctx.drawImage(overlay.source, 0, 0, width, height);
  } else {
    ctx.drawImage(overlay.source, x, y, width, height);
  }
  ctx.restore();
}

/**
 * Creates a Canvas2D preview bound to `container`. Call `render(scene)`
 * whenever the scene changes; call `destroy()` on unmount. A single
 * preview only ever has zero or one `<canvas>` at a time — `render`
 * creates the canvas lazily on first call and resizes the existing one
 * (rather than recreating it) when the scene's `canvas` dimensions change.
 */
export function createCanvas2DScenePreview(container: HTMLElement): Canvas2DScenePreview {
  let canvas: HTMLCanvasElement | null = null;
  let currentPlan: ScenePlan | null = null;
  let currentParticles: readonly RenderableParticle[] = [];
  let currentTrails: readonly RenderableTrail[] = [];
  let currentCameraOverlay: RenderableCameraOverlay | undefined;
  let currentTransparentBackground = false;
  // Task 138 (issue #170) parity: an offscreen buffer used only when
  // `canvas.opacity < 1` -- see `drawFrame`'s doc comment below and
  // `p5Adapter.ts`'s identical `ensureOpacityBuffer` for why compositing
  // happens this way rather than multiplying every draw call's own alpha
  // by `canvasOpacity`.
  let opacityBuffer: HTMLCanvasElement | null = null;

  function ensureCanvas(width: number, height: number): HTMLCanvasElement {
    if (canvas) return canvas;
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    container.appendChild(canvas);
    return canvas;
  }

  function ensureOpacityBuffer(width: number, height: number): HTMLCanvasElement {
    if (opacityBuffer && opacityBuffer.width === width && opacityBuffer.height === height) {
      return opacityBuffer;
    }
    opacityBuffer = document.createElement('canvas');
    opacityBuffer.width = width;
    opacityBuffer.height = height;
    return opacityBuffer;
  }

  function drawFrame(): void {
    if (!canvas || !currentPlan) return;
    const plan = currentPlan;
    const mainCtx = canvas.getContext('2d')!;
    mainCtx.imageSmoothingEnabled = false;

    // Task 138 (issue #170) parity: see `p5Adapter.ts`'s `sk.draw` doc
    // comment for why the whole frame composites once through an offscreen
    // buffer at `canvas.opacity < 1`, rather than each shape's own alpha
    // being multiplied by `canvasOpacity` individually.
    const opacity = plan.canvas.opacity;
    const useBuffer = opacity < 1;
    const target = useBuffer ? ensureOpacityBuffer(canvas.width, canvas.height) : canvas;
    const ctx = target.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, target.width, target.height);

    ctx.save();
    if (!currentTransparentBackground) {
      ctx.fillStyle = plan.canvas.backgroundColor;
      ctx.fillRect(0, 0, target.width, target.height);
    }
    // Task 61: trails draw beneath the static scene tree so a shape's own
    // geometry (drawn next) sits on top of its position history.
    for (const trail of currentTrails) drawTrail(ctx, trail);
    // Issue #194 parity: `plan.nodes` is sorted descending by layer `order`
    // (highest first/backmost). Partition into behind/front-of-camera
    // groups exactly as `p5Adapter.ts`'s `sk.draw` does, each preserving
    // its own internal relative order.
    if (currentCameraOverlay) {
      const overlay = currentCameraOverlay;
      const behindNodes: DrawNode[] = [];
      const frontNodes: DrawNode[] = [];
      for (const node of plan.nodes) {
        if (layerOrderForNode(plan, node) >= overlay.layerOrder) {
          frontNodes.push(node);
        } else {
          behindNodes.push(node);
        }
      }
      for (const node of behindNodes) drawNode(ctx, node, 1);
      drawCameraOverlay(ctx, overlay);
      for (const node of frontNodes) drawNode(ctx, node, 1);
    } else {
      for (const node of plan.nodes) drawNode(ctx, node, 1);
    }
    // Task 39: live particles draw last, on top of everything else.
    for (const particle of currentParticles) drawParticle(ctx, particle);
    ctx.restore();

    if (useBuffer) {
      mainCtx.setTransform(1, 0, 0, 1, 0, 0);
      mainCtx.clearRect(0, 0, canvas.width, canvas.height);
      mainCtx.save();
      mainCtx.globalAlpha = opacity;
      mainCtx.drawImage(opacityBuffer!, 0, 0);
      mainCtx.restore();
    }
  }

  function render(
    scene: SceneDocument,
    particles: readonly RenderableParticle[] = [],
    trails: readonly RenderableTrail[] = [],
    transparentBackground = false,
    cameraOverlay?: RenderableCameraOverlay,
  ): void {
    // Acceptance criteria 10/11 (Task 25/#206 parity): buildScenePlan
    // throws before this function touches the canvas at all, so an
    // invalid scene causes zero canvas mutation.
    const plan = buildScenePlan(scene);
    currentPlan = plan;
    currentParticles = particles;
    currentTrails = trails;
    currentTransparentBackground = transparentBackground;
    currentCameraOverlay = cameraOverlay;

    if (!canvas) {
      ensureCanvas(plan.canvas.width, plan.canvas.height);
      drawFrame();
      return;
    }
    if (canvas.width !== plan.canvas.width || canvas.height !== plan.canvas.height) {
      canvas.width = plan.canvas.width;
      canvas.height = plan.canvas.height;
    }
    drawFrame();
  }

  function destroy(): void {
    canvas?.remove();
    canvas = null;
    opacityBuffer = null;
    currentPlan = null;
    currentParticles = [];
    currentTrails = [];
    currentCameraOverlay = undefined;
    currentTransparentBackground = false;
  }

  function getCanvasElement(): HTMLCanvasElement | null {
    return container.querySelector('canvas');
  }

  return { render, destroy, getCanvasElement };
}
