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
 * evaluating `bindings`/the behavior `graph` (Task 35), trails and
 * physics forces (Task 61), and pointer-based manipulation (Task 26,
 * already handled separately by `EditorWorkspace.tsx`'s existing
 * click-to-select hit testing over `sceneShapes.ts`, which this adapter
 * does not touch).
 *
 * A `particleEmitter` shape (part of the static scene tree above) still
 * renders only its configured marker appearance — position, `size`, first
 * `palette` color — never a live simulation; that marker is drawn by
 * `drawShapeGeometry`'s `particleEmitter` case exactly as it was before
 * Task 39. The actual emitted, moving, expiring particles a
 * `particleEmitter` shape produces at runtime (Task 39,
 * `runtime/particleSystem.ts`) are a *separate*, ephemeral render input —
 * `render`'s optional second argument, `particles` — because they are not
 * part of the scene document at all (nothing about a particle's position,
 * velocity, or remaining lifespan is ever written back to scene JSON).
 * `render(scene, particles)` draws the static tree first, then each live
 * particle on top as a plain filled circle (reusing `parseColor`, exactly
 * `drawShapeGeometry`'s `particleEmitter` marker's own fill approach) —
 * the same p5 instance and canvas, never a second rendering pipeline.
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

export { SceneRenderError } from './sceneDrawPlan';

/** The minimal shape this adapter needs from a Task 39 particle — see
 * `runtime/particleSystem.ts`'s `Particle` type, which structurally
 * satisfies this (a full `Particle` carries extra runtime-only fields
 * like `vx`/`vy`/`spawnedAt` this adapter never reads). */
export type RenderableParticle = { x: number; y: number; size: number; color: string };

export type P5ScenePreview = {
  /** Validates and draws `scene`, then draws `particles` (Task 39,
   * `runtime/particleSystem.ts`'s live particle snapshot) on top of it —
   * see the module doc comment. `particles` defaults to empty, so every
   * existing call site (no live particle system yet wired up) is
   * unaffected. Throws `SceneRenderError` — before any p5 draw call, and
   * with zero canvas mutation — if `scene` isn't something `validateScene`
   * accepts, or fails the adapter's own structural/referential pre-pass
   * (see `sceneDrawPlan.ts`); a render error is always about `scene`,
   * never about `particles` (which needs no schema validation — it isn't
   * scene JSON). */
  render(scene: SceneDocument, particles?: readonly RenderableParticle[]): void;
  /** Tears down the underlying p5 instance and removes its `<canvas>`. */
  destroy(): void;
  /** The p5-created `<canvas>` element, once one exists (after the first
   * successful `render`), or `null` before that. */
  getCanvasElement(): HTMLCanvasElement | null;
};

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

export function createP5ScenePreview(container: HTMLElement): P5ScenePreview {
  let instance: p5 | null = null;
  let currentPlan: ScenePlan | null = null;
  let currentParticles: readonly RenderableParticle[] = [];

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
        sk.push();
        if (currentPlan.randomness.enabled) {
          // Acceptance criterion 8: seed the PRNG from randomness.seed
          // when enabled, so later seed-dependent renderer work
          // (particle emission, deterministic randomness) plugs into a
          // seeded, reproducible stream. When disabled, no seed is
          // applied — p5's default (unseeded) PRNG state is left alone.
          sk.randomSeed(currentPlan.randomness.seed);
          sk.noiseSeed(currentPlan.randomness.seed);
        }
        sk.background(currentPlan.canvas.backgroundColor);
        for (const node of currentPlan.nodes) drawNode(sk, node, 1);
        // Task 39: live particles draw last, on top of the static scene
        // tree — see the module doc comment.
        for (const particle of currentParticles) drawParticle(sk, particle);
        sk.pop();
      };
    }, container);
  }

  function render(scene: SceneDocument, particles: readonly RenderableParticle[] = []): void {
    // Acceptance criteria 10/11: buildScenePlan throws before this
    // function touches the p5 instance or canvas at all, so an invalid
    // scene (or one with a structurally-broken object) causes zero
    // canvas mutation.
    const plan = buildScenePlan(scene);
    currentPlan = plan;
    currentParticles = particles;

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
    currentPlan = null;
    currentParticles = [];
  }

  function getCanvasElement(): HTMLCanvasElement | null {
    return container.querySelector('canvas');
  }

  return { render, destroy, getCanvasElement };
}
