/**
 * Task 25: the p5.js rendering adapter. Draws a validated canonical scene
 * document (`../../../schema/scene.schema.json`) into a `<canvas>` using
 * p5.js in instance mode (never global mode, so it can be created and
 * destroyed cleanly as the scene changes without polluting `window`).
 *
 * This file only concerns itself with *how* to draw a `ScenePlan`
 * (`sceneDrawPlan.ts`) with p5's drawing API — position (`translate`),
 * rotation (`rotate`), scale (`scale`), composited opacity (alpha
 * channel), fill/stroke/strokeWeight, and PRNG seeding. It never
 * evaluates a scene field as code (acceptance criterion 12): every value
 * read off a `ScenePlan` node is a number, string, or boolean fed
 * straight into a fixed p5 API call, never into `eval`, `new Function`,
 * or a template that could be interpreted as code.
 *
 * Explicitly out of scope here (see the Task 25 issue's "Out of scope"):
 * evaluating `bindings`/the behavior `graph` (Task 35), and pointer-based
 * manipulation (Task 26, already handled separately by
 * `EditorWorkspace.tsx`'s existing click-to-select hit testing over
 * `sceneShapes.ts`, which this adapter does not touch).
 *
 * A `particleEmitter` shape (part of the static scene tree above) still
 * renders only its configured marker appearance — position, `size`, first
 * `palette` color — never a live simulation; that marker is drawn by
 * `drawShapeGeometry`'s `particleEmitter` case exactly as it was before
 * Task 39. The actual emitted, moving, expiring particles a
 * `particleEmitter` shape produces at runtime (Task 39,
 * `runtime/particleSystem.ts`, with Task 61's physics-force integration)
 * are a *separate*, ephemeral render input — `render`'s optional second
 * argument, `particles` — because they are not part of the scene document
 * at all (nothing about a particle's position, velocity, or remaining
 * lifespan is ever written back to scene JSON).
 * `render(scene, particles, trails)` draws the static tree first, then
 * each live trail (Task 61, `runtime/trailSystem.ts`) beneath the shapes
 * it belongs to would normally already be drawn on top of by virtue of
 * draw order, then each live particle on top of everything — reusing
 * `parseColor`, exactly `drawShapeGeometry`'s `particleEmitter` marker's
 * own fill approach — the same p5 instance and canvas, never a second
 * rendering pipeline.
 *
 * ## Trails (Task 61)
 *
 * A trail with two or more samples draws as an unfilled polyline (oldest
 * to newest sample). A trail with exactly one sample — the reduced-motion
 * substitution `trailSystem.ts` produces (`REDUCED_MOTION_TRAIL_LENGTH`,
 * see that module's doc comment) — draws as a small static filled marker
 * instead of a degenerate zero-length line, directly implementing the
 * issue's suggested reduced-motion substitution ("trail disabled and
 * replaced with a single static marker") while still conveying the
 * shape's current position. A trail with zero samples draws nothing.
 */
import p5 from 'p5';

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
// Issue #206: these three types moved to `scenePreview.ts` so a second
// (Canvas2D) adapter can share them without importing this p5-specific
// module. Re-exported here so every pre-existing `from './p5Adapter'`
// import keeps working unchanged.
export type { RenderableCameraOverlay, RenderableParticle, RenderableTrail } from './scenePreview';

/** Issue #206: `P5ScenePreview` is now an alias of the shared
 * `ScenePreview` interface (`scenePreview.ts`) — kept as its own exported
 * name so no existing `import type { P5ScenePreview } from './p5Adapter'`
 * needs to change. */
export type P5ScenePreview = ScenePreview;

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

function applyTransform(sk: p5, t: Transform2D): void {
  sk.translate(t.x, t.y);
  sk.rotate(sk.radians(t.rotation));
  sk.scale(t.scaleX, t.scaleY);
}

function applyFillAndStroke(sk: p5, shape: AnyShape, opacity: number): void {
  const { style } = shape;
  // Acceptance criterion 4: fill:null and stroke:null are independent —
  // either, both, or neither may be set.
  if (style.fill === null) {
    sk.noFill();
  } else {
    const c = parseColor(style.fill);
    sk.fill(c.r, c.g, c.b, c.a * opacity * 255);
  }
  if (style.stroke === null) {
    sk.noStroke();
  } else {
    const c = parseColor(style.stroke);
    sk.stroke(c.r, c.g, c.b, c.a * opacity * 255);
  }
  sk.strokeWeight(style.strokeWidth);
}

/**
 * Draws one shape's type-specific geometry (acceptance criterion 2) in
 * the shape's *local* coordinate frame — i.e. after `applyTransform` has
 * already translated/rotated/scaled to the shape's `transform`. This
 * matches the position convention documented in `../pages/sceneShapes.ts`:
 * a circle's transform is its center, a rect's transform is its top-left
 * corner, a line runs from the transform to (x2, y2) (so locally, from
 * the origin to (x2 - transform.x, y2 - transform.y)), and a path's
 * points are already relative offsets from the transform.
 */
function drawShapeGeometry(sk: p5, shape: AnyShape): void {
  switch (shape.type) {
    case 'circle':
      sk.circle(0, 0, shape.radius * 2);
      return;
    case 'rect':
      sk.rect(0, 0, shape.width, shape.height, shape.cornerRadius);
      return;
    case 'line':
      sk.line(0, 0, shape.x2 - shape.transform.x, shape.y2 - shape.transform.y);
      return;
    case 'path': {
      sk.beginShape();
      for (const point of shape.points) sk.vertex(point.x, point.y);
      if (shape.closed) sk.endShape(sk.CLOSE);
      else sk.endShape();
      return;
    }
    case 'particleEmitter': {
      // Task 25 renders only the emitter's static configured appearance
      // (position, size, palette) as a marker — no emission/lifespan/
      // speed simulation (Task 39) and no physics (Task 61). The marker
      // uses the emitter's own palette when present, falling back to its
      // style.fill (already applied by applyFillAndStroke) otherwise.
      if (shape.palette.length > 0) {
        const c = parseColor(shape.palette[0]);
        sk.fill(c.r, c.g, c.b);
      }
      sk.circle(0, 0, shape.size);
      return;
    }
  }
}

function drawNode(sk: p5, node: DrawNode, inheritedOpacity: number): void {
  if (node.kind === 'shape') {
    const opacity = inheritedOpacity * node.shape.transform.opacity;
    sk.push();
    applyTransform(sk, node.shape.transform);
    applyFillAndStroke(sk, node.shape, opacity);
    drawShapeGeometry(sk, node.shape);
    sk.pop();
    return;
  }

  // Group. `locked` never affects rendering; `visible: false` hides the
  // entire subtree (acceptance criterion 6, extended consistently to
  // groups — they carry the same visible/locked fields as layers).
  if (!node.group.visible) return;

  const opacity = inheritedOpacity * node.group.transform.opacity;
  sk.push();
  applyTransform(sk, node.group.transform);
  for (const child of node.children) drawNode(sk, child, opacity);
  sk.pop();
}

/**
 * Creates a p5.js preview bound to `container`, in instance mode. Call
 * `render(scene)` whenever the scene changes; call `destroy()` on
 * unmount. A single preview only ever has zero or one p5 instance/canvas
 * at a time — `render` creates the instance lazily on first call and
 * resizes the existing canvas (rather than recreating it) when the
 * scene's `canvas` dimensions change.
 */
function drawParticle(sk: p5, particle: RenderableParticle): void {
  sk.push();
  sk.noStroke();
  const c = parseColor(particle.color);
  sk.fill(c.r, c.g, c.b, c.a * 255);
  sk.circle(particle.x, particle.y, Math.max(0, particle.size));
  sk.pop();
}

/** Draws one trail — see the module doc comment's "Trails" section for
 * the polyline-vs-single-marker rule. Two or more points draw an unfilled
 * polyline; exactly one point draws a small filled marker (the
 * reduced-motion substitution); zero points draws nothing. */
function drawTrail(sk: p5, trail: RenderableTrail): void {
  const points = trail.points;
  if (points.length === 0) return;
  const c = parseColor(trail.color);
  sk.push();
  if (points.length === 1) {
    sk.noStroke();
    sk.fill(c.r, c.g, c.b, c.a * 255);
    sk.circle(points[0].x, points[0].y, 4);
    sk.pop();
    return;
  }
  sk.noFill();
  sk.stroke(c.r, c.g, c.b, c.a * 255);
  sk.strokeWeight(2);
  sk.beginShape();
  for (const point of points) sk.vertex(point.x, point.y);
  sk.endShape();
  sk.pop();
}

function layerOrderForNode(plan: ScenePlan, node: DrawNode): number {
  const layerId = node.kind === 'shape' ? node.shape.layerId : node.group.layerId;
  return plan.layers.find((layer) => layer.id === layerId)?.order ?? Number.POSITIVE_INFINITY;
}

function drawCameraOverlay(sk: p5, overlay: RenderableCameraOverlay): void {
  if (
    overlay.source instanceof HTMLVideoElement &&
    (overlay.source.readyState < 2 ||
      overlay.source.videoWidth <= 0 ||
      overlay.source.videoHeight <= 0)
  ) {
    return;
  }
  const x = overlay.geometry.x * sk.width;
  const y = overlay.geometry.y * sk.height;
  const width = overlay.geometry.width * sk.width;
  const height = overlay.geometry.height * sk.height;
  const context = sk.drawingContext;
  context.save();
  context.globalAlpha = overlay.opacity;
  if (overlay.mirrored) {
    context.translate(x + width, y);
    context.scale(-1, 1);
    context.drawImage(overlay.source, 0, 0, width, height);
  } else {
    context.drawImage(overlay.source, x, y, width, height);
  }
  context.restore();
}

export function createP5ScenePreview(container: HTMLElement): P5ScenePreview {
  let instance: p5 | null = null;
  let currentPlan: ScenePlan | null = null;
  let currentParticles: readonly RenderableParticle[] = [];
  let currentTrails: readonly RenderableTrail[] = [];
  let currentCameraOverlay: RenderableCameraOverlay | undefined;
  let currentTransparentBackground = false;
  // Task 138 (issue #170): an offscreen buffer used only when
  // `canvas.opacity < 1` -- see `sk.draw`'s doc comment below for why
  // compositing happens this way rather than multiplying every draw
  // call's own alpha by `canvasOpacity`.
  let opacityBuffer: p5.Graphics | null = null;

  /** Lazily creates (or resizes, replacing the old one) the offscreen
   * buffer `sk.draw` renders into when `canvas.opacity < 1`. A fresh
   * buffer is transparent by default, which is exactly what's wanted here
   * -- `sk.draw` always paints over it with either `background()` or
   * `clear()` before drawing anything else. */
  function ensureOpacityBuffer(sk: p5, width: number, height: number): p5.Graphics {
    if (opacityBuffer && opacityBuffer.width === width && opacityBuffer.height === height) {
      return opacityBuffer;
    }
    opacityBuffer?.remove();
    opacityBuffer = sk.createGraphics(width, height);
    opacityBuffer.pixelDensity(1);
    opacityBuffer.noSmooth();
    return opacityBuffer;
  }

  function ensureInstance(width: number, height: number): void {
    if (instance) return;
    instance = new p5((sk: p5) => {
      sk.setup = () => {
        const canvasEl = sk.createCanvas(width, height);
        canvasEl.parent(container);
        sk.pixelDensity(1);
        // Hard edges (no anti-aliasing) keep rendering deterministic pixel-
        // for-pixel and testable by direct pixel sampling.
        sk.noSmooth();
        sk.noLoop();
      };
      sk.draw = () => {
        if (!currentPlan) return;

        // Task 138 (issue #170): `canvas.opacity` composites the whole
        // rendered frame (background + trails + shapes + particles) as
        // one flattened layer against whatever sits behind this <canvas>
        // -- not each shape's own alpha scaled individually. Drawing
        // straight to `sk` and multiplying every fill/stroke alpha by
        // `canvasOpacity` was considered and rejected: two overlapping
        // shapes would then each blend translucently with what's *behind
        // them on the canvas* as well as what's behind the canvas itself,
        // visibly darkening/lightening the overlap in a way a single
        // "whole scene at X% opacity" control should not. Instead, at
        // opacity < 1 the frame draws into an offscreen `p5.Graphics`
        // buffer at full internal opacity (so shape-over-shape blending
        // inside the scene is unaffected), then that buffer is drawn onto
        // the real canvas once via `tint(255,255,255, opacity*255)` --
        // exactly one alpha multiply for the entire composite, matching
        // how a single semi-transparent image layer behaves in any
        // compositing tool. At opacity === 1 (the default, and every
        // scene that predates this field) this buffer is never created or
        // used, so existing renders are byte-for-byte unaffected.
        const opacity = currentPlan.canvas.opacity;
        const useBuffer = opacity < 1;
        const target: p5 = useBuffer ? ensureOpacityBuffer(sk, sk.width, sk.height) : sk;

        target.push();
        if (currentPlan.randomness.enabled) {
          // Acceptance criterion 8: seed the PRNG from randomness.seed
          // when enabled, so later seed-dependent renderer work
          // (particle emission, deterministic randomness) plugs into a
          // seeded, reproducible stream. When disabled, no seed is
          // applied — p5's default (unseeded) PRNG state is left alone.
          target.randomSeed(currentPlan.randomness.seed);
          target.noiseSeed(currentPlan.randomness.seed);
        }
        if (currentTransparentBackground) {
          target.clear();
        } else {
          target.background(currentPlan.canvas.backgroundColor);
        }
        // Task 61: trails draw beneath the static scene tree so a shape's
        // own geometry (drawn next) sits on top of its position history —
        // see the module doc comment.
        for (const trail of currentTrails) drawTrail(target, trail);
        // Issue #194: `currentPlan.nodes` is now sorted *descending* by
        // layer `order` (highest first/backmost -- see `sceneDrawPlan.ts`'s
        // "Draw order" doc comment), the reverse of before. The camera's
        // own `layerOrder` contract is unchanged and must stay unchanged:
        // a layer with `order < camera.layerOrder` renders behind the
        // camera, one with `order >= camera.layerOrder` renders in front
        // of it. Under the old ascending traversal that boundary was a
        // single insertion point reached once while walking forward, but
        // under descending traversal the "in front" group (higher order)
        // is now visited *first*, before the "behind" group -- the
        // opposite of the paint order needed. Partition into the two
        // groups (each preserving its own internal relative order, since
        // a filtered subsequence of a sorted array stays sorted the same
        // way) and paint behind-group, then camera, then front-group,
        // rather than trying to find one insertion point in a single
        // forward pass.
        if (currentCameraOverlay) {
          const overlay = currentCameraOverlay;
          const behindNodes: DrawNode[] = [];
          const frontNodes: DrawNode[] = [];
          for (const node of currentPlan.nodes) {
            if (layerOrderForNode(currentPlan, node) >= overlay.layerOrder) {
              frontNodes.push(node);
            } else {
              behindNodes.push(node);
            }
          }
          for (const node of behindNodes) drawNode(target, node, 1);
          drawCameraOverlay(target, overlay);
          for (const node of frontNodes) drawNode(target, node, 1);
        } else {
          for (const node of currentPlan.nodes) drawNode(target, node, 1);
        }
        // Task 39: live particles draw last, on top of everything else —
        // see the module doc comment.
        for (const particle of currentParticles) drawParticle(target, particle);
        target.pop();

        if (useBuffer) {
          sk.clear();
          sk.push();
          sk.tint(255, 255, 255, opacity * 255);
          sk.image(opacityBuffer!, 0, 0);
          sk.pop();
        }
      };
    }, container);
  }

  function render(
    scene: SceneDocument,
    particles: readonly RenderableParticle[] = [],
    trails: readonly RenderableTrail[] = [],
    transparentBackground = false,
    cameraOverlay?: RenderableCameraOverlay,
  ): void {
    // Acceptance criteria 10/11: buildScenePlan throws before this
    // function touches the p5 instance or canvas at all, so an invalid
    // scene (or one with a structurally-broken object) causes zero
    // canvas mutation.
    const plan = buildScenePlan(scene);
    currentPlan = plan;
    currentParticles = particles;
    currentTrails = trails;
    currentTransparentBackground = transparentBackground;
    currentCameraOverlay = cameraOverlay;

    if (!instance) {
      ensureInstance(plan.canvas.width, plan.canvas.height);
      return;
    }

    const sk = instance;
    if (sk.width !== plan.canvas.width || sk.height !== plan.canvas.height) {
      sk.resizeCanvas(plan.canvas.width, plan.canvas.height);
    }
    sk.redraw();
  }

  function destroy(): void {
    instance?.remove();
    instance = null;
    opacityBuffer?.remove();
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
