/**
 * Issue #206: the renderer-agnostic preview contract every scene renderer
 * adapter (`p5Adapter.ts`'s p5.js adapter, `canvas2dAdapter.ts`'s native
 * Canvas2D adapter) implements identically, plus the small renderable-input
 * types (`RenderableParticle`/`RenderableTrail`/`RenderableCameraOverlay`)
 * every `render()` call takes. Pulled out of `p5Adapter.ts` (which used to
 * define these itself, back when it was the only adapter) so a second
 * adapter, and every call site that only needs "a scene preview" rather
 * than specifically "a p5 scene preview", can depend on this file instead
 * of the p5-specific module. `p5Adapter.ts` re-exports these same names for
 * backward compatibility with existing imports.
 */
import type { CameraOverlayGeometry } from '../editor/cameraOverlayGeometry';

/** The minimal shape this adapter needs from a Task 39 particle — see
 * `runtime/particleSystem.ts`'s `Particle` type, which structurally
 * satisfies this (a full `Particle` carries extra runtime-only fields
 * like `vx`/`vy`/`spawnedAt` this adapter never reads). */
export type RenderableParticle = { x: number; y: number; size: number; color: string };

/** One shape's live trail (Task 61, `runtime/trailSystem.ts`) reduced to
 * exactly what an adapter needs to draw it: a color (the shape's own
 * `style.stroke` or `style.fill`, resolved by the caller — no adapter
 * re-reads scene styling for a trail) and its ordered sample points,
 * oldest first. */
export type RenderableTrail = {
  color: string;
  points: readonly { x: number; y: number }[];
};

export type RenderableCameraOverlay = {
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
  geometry: CameraOverlayGeometry;
  opacity: number;
  mirrored: boolean;
  layerOrder: number;
};

/** Renderer ids `schema/scene.schema.json`'s `renderer.preferred` enum
 * accepts. Kept in sync with that enum by
 * `createScenePreview.test.ts`'s own registry-completeness assertion. */
export type SceneRendererId = 'p5' | 'canvas2d';

export type ScenePreview = {
  /** Validates and draws `scene`, then draws `trails` (Task 61,
   * `runtime/trailSystem.ts`'s live trail snapshot) beneath the static
   * tree's shapes, then draws `particles` (Task 39,
   * `runtime/particleSystem.ts`'s live particle snapshot) on top of
   * everything. Both default to empty, so every existing call site is
   * unaffected. Throws `SceneRenderError` (`sceneDrawPlan.ts`) — before any
   * draw call, and with zero canvas mutation — if `scene` isn't something
   * `validateScene` accepts, or fails the adapter's own
   * structural/referential pre-pass; a render error is always about
   * `scene`, never about `particles`/`trails` (neither needs schema
   * validation — neither is scene JSON). */
  render(
    scene: import('../api/projects').SceneDocument,
    particles?: readonly RenderableParticle[],
    trails?: readonly RenderableTrail[],
    /** Task 110 (issue #141): when `true`, skips painting the scene's
     * opaque `canvas.backgroundColor` and clears to fully transparent
     * instead, so a DOM element stacked behind this `<canvas>` (the camera
     * overlay `<video>` in `EditorWorkspace.tsx`) shows through wherever
     * the scene doesn't paint over it. Shapes still draw normally on top —
     * only the background fill is skipped. Defaults to `false`. */
    transparentBackground?: boolean,
    cameraOverlay?: RenderableCameraOverlay,
  ): void;
  /** Tears down the underlying renderer instance and removes its
   * `<canvas>`. */
  destroy(): void;
  /** The renderer-created `<canvas>` element, once one exists (after the
   * first successful `render`), or `null` before that. */
  getCanvasElement(): HTMLCanvasElement | null;
};
