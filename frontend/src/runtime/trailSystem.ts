/**
 * Task 61: bounded position-history trails for scene shapes
 * (`schema/scene.schema.json`'s `$defs.trail`, already present on every
 * shape type — `circle`/`rect`/`line`/`path`/`particleEmitter` — since
 * Task 7, and never read by any runtime module before this task).
 *
 * ## Position source (matches Task 39's own convention)
 *
 * Like `runtime/particleSystem.ts`'s `emittersFromScene` (which reads a
 * `particleEmitter` shape's spawn origin straight off `transform.x`/
 * `transform.y`, never resolving parent-group transforms), this module
 * samples a trailed shape's *own* `transform.x`/`transform.y` each tick,
 * not a fully composited world position through ancestor group
 * transforms. This is a deliberate, documented simplification consistent
 * with the one existing precedent in this codebase for "where is this
 * shape" at runtime, not an oversight — a future task that needs
 * world-space trails can compose group transforms then, following
 * `sceneDrawPlan.ts`'s existing group-walk if it does.
 *
 * ## Group nesting (already bounded upstream)
 *
 * `schema/limits.json`'s `maxGroupNestingDepth` (Task 7) is enforced by
 * `validateScene` before a scene reaches any runtime module —
 * `render/sceneDrawPlan.ts`'s `buildScenePlan` calls `validateScene` as a
 * backstop, and the editor never lets an over-limit scene reach a preview
 * at all. This module trusts that invariant rather than re-walking group
 * trees to re-check a limit that's already guaranteed, exactly as
 * `particleSystem.ts` trusts `validateScene`'s `maxParticleEmitters`
 * enforcement rather than re-counting emitters itself.
 *
 * ## Bounds (own documented choices, reusing schema/limits numbers where
 * one already exists)
 *
 * - `MAX_TRAIL_LENGTH_PER_SHAPE` = 100 — `schema/scene.schema.json`'s own
 *   `$defs.trail.length` maximum, reused verbatim as the runtime ring-
 *   buffer capacity ceiling. A scene that passed schema validation already
 *   respects this; clamping again here is defense in depth against a
 *   scene mutated in memory after validation.
 * - `MAX_TRAILED_SHAPES` = `schema/limits.json`'s `maxShapes` (200),
 *   reused — trail sampling can never be asked to track more shapes than
 *   a scene is allowed to contain in the first place, so this cap is a
 *   natural (not arbitrary) ceiling on "affected objects" for trails.
 *   `trailablesFromScene` takes shapes in scene `shapes` array order and
 *   silently stops adding once this many are tracked (a scene at the
 *   schema's own shape cap with every shape trailed hits this exactly,
 *   never over).
 *
 * ## Expiry / cleanup (no unbounded growth)
 *
 * Each tracked shape's samples live in a plain array used as a ring
 * buffer: `tick()` pushes one new sample, then drops the oldest
 * (`shift()`) whenever the array exceeds that shape's own effective
 * length. The buffer can therefore never grow past
 * `MAX_TRAIL_LENGTH_PER_SHAPE` regardless of how long a shape keeps
 * moving. `tick()` also re-derives the current tracked-shape set from the
 * scene passed to it every call and prunes any buffer whose shape id is
 * no longer present — the object-deletion case: delete a shape (or set
 * its `trail.length` to `0`) and its buffer is discarded on the very next
 * tick, not leaked forever.
 *
 * ## Determinism
 *
 * Trail samples are pure position history: `tick(scene, timestamp, ...)`
 * reads whatever `transform.x`/`transform.y` the caller's scene document
 * already has at that timestamp (typically the result of applying this
 * tick's `BehaviorRuntime` continuous outputs — see
 * `applyRuntimeOutputsToScene`) and appends it verbatim. No randomness is
 * involved anywhere in this module. Given the same sequence of
 * (deterministic) scene snapshots and timestamps, two independent
 * `createTrailSystem` instances produce byte-for-byte identical sample
 * sequences — determinism holds trivially from deterministic inputs,
 * exactly as this module's own doc comment above promises, and unlike
 * `particleSystem.ts` this module needs no seeded-RNG utility at all
 * (there is nothing random to seed).
 *
 * ## Reduced motion (`_docs/plan.md`'s "Reduced mode replaces or reduces
 * non-essential motion ... while preserving the interaction's meaning")
 *
 * When the caller passes `reducedMotion: true`, every shape's *effective*
 * trail length is clamped to `REDUCED_MOTION_TRAIL_LENGTH` (1) regardless
 * of its authored `trail.length` — a continuously growing/sliding
 * multi-point trail (continuous motion) collapses to a single point that
 * still tracks the shape's current position (the interaction's meaning —
 * "where is this shape now" — is preserved) but never animates a moving
 * line across the canvas. `render/p5Adapter.ts`'s trail-drawing code
 * renders a 1-sample trail as a small static marker instead of a
 * polyline, matching the issue's suggested reduced-motion substitution
 * ("trail disabled and replaced with a single static marker") exactly.
 *
 * ## Frame-budget / degradation (Task 35's mechanism, reused)
 *
 * When `degraded` is `true` (the same `TickResult.degraded` flag Task 35
 * already produces and Task 39's particle system already consumes),
 * `tick()` skips appending a new sample for every tracked shape this
 * tick — existing samples and their ring-buffer contents are left exactly
 * as they were, and pruning of deleted shapes still runs (cheap, O(tracked
 * shapes), and correctness-critical for the "no leak" guarantee even
 * under overload). This is the same "skip new work, never make the
 * overload worse" policy `particleSystem.ts` uses for skipping emission
 * on a degraded tick, reused rather than reinvented.
 *
 * ## Pause / resume
 *
 * `pause()` freezes `tick()` into a no-op (returns the current snapshot
 * unchanged, including skipping pruning). `resume()` simply un-freezes —
 * unlike `particleSystem.ts`, trail sampling has no elapsed-time-based
 * accumulator to reset on resume (a sample is either taken this tick or
 * not; there is no "catch up on the paused interval" concept for a
 * position-history trail), so `resume()` needs no bookkeeping beyond
 * clearing the paused flag.
 */
import type { SceneDocument } from '../api/projects';
import { LIMITS } from '../validation/scene';

export const MAX_TRAIL_LENGTH_PER_SHAPE = 100; // schema $defs.trail.length max, reused.
export const MAX_TRAILED_SHAPES = LIMITS.maxShapes ?? 200; // schema/limits.json maxShapes, reused.
export const REDUCED_MOTION_TRAIL_LENGTH = 1; // single static current-position marker.

export type TrailableShape = {
  id: string;
  trailLength: number;
  x: number;
  y: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Like `finiteOr`, but a *present, non-numeric-typed* value still falls
 * back to `fallback` while a present `number` value (even a non-finite
 * one, e.g. `NaN`/`Infinity`) passes through unchanged — so a genuinely
 * non-finite *position* (as opposed to a merely missing one) can still be
 * detected and rejected by `tick()`'s own finite check, rather than being
 * silently laundered into a valid `0` here first. */
function numberOrRaw(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

/** Extracts every shape with a non-zero `trail.length` from a scene
 * document, in `shapes` array order, capped at `MAX_TRAILED_SHAPES`. Never
 * throws: malformed/missing fields fall back to permissive defaults (`0`,
 * which then means "no trail" and the shape is skipped) matching
 * `particleSystem.ts`'s `emittersFromScene` convention exactly. */
export function trailablesFromScene(scene: SceneDocument): TrailableShape[] {
  const shapes = (scene as Record<string, unknown>).shapes;
  if (!Array.isArray(shapes)) return [];
  const result: TrailableShape[] = [];
  for (const raw of shapes) {
    if (result.length >= MAX_TRAILED_SHAPES) break;
    const s = asRecord(raw);
    const trail = asRecord(s.trail);
    const length = clampInt(finiteOr(trail.length, 0), 0, MAX_TRAIL_LENGTH_PER_SHAPE);
    if (length <= 0) continue;
    if (typeof s.id !== 'string') continue;
    const transform = asRecord(s.transform);
    result.push({
      id: s.id,
      trailLength: length,
      x: numberOrRaw(transform.x, 0),
      y: numberOrRaw(transform.y, 0),
    });
  }
  return result;
}

export type TrailSample = { x: number; y: number; timestamp: number };

export type TrailSystem = {
  /** Evaluates one tick: re-syncs the tracked-shape set from `scene`
   * (pruning deleted shapes), then — unless paused or `degraded` — appends
   * one sample per tracked shape, applying the reduced-motion effective-
   * length clamp when `reducedMotion` is true. Returns the live trail
   * snapshot *after* this tick's changes, keyed by shape id. */
  tick(
    scene: SceneDocument,
    timestamp: number,
    degraded: boolean,
    reducedMotion: boolean,
  ): Map<string, TrailSample[]>;
  /** The current trail snapshot, without advancing time. */
  getTrails(): Map<string, TrailSample[]>;
  /** Freezes the system: `tick()` becomes a no-op until `resume()`. */
  pause(): void;
  /** Un-freezes the system. No bookkeeping to reset — see the module doc
   * comment's "Pause / resume" section. */
  resume(): void;
  /** Clears every tracked shape's samples. */
  reset(): void;
};

export type TrailSystemOptions = {
  maxTrailLengthPerShape?: number;
};

/** Creates a bounded trail system. Accepts either a pre-extracted
 * `TrailableShape[]` (for direct, scene-free table-driven tests) or a full
 * `SceneDocument` (extracted via `trailablesFromScene`) as the *initial*
 * tracked set — `tick()` always re-derives the tracked set from whatever
 * scene it's given, so the constructor argument only matters for the very
 * first call to `getTrails()`/`pause()` before any `tick()` has run. */
export function createTrailSystem(
  initial: TrailableShape[] | SceneDocument = [],
  options: TrailSystemOptions = {},
): TrailSystem {
  const maxLengthPerShape = options.maxTrailLengthPerShape ?? MAX_TRAIL_LENGTH_PER_SHAPE;

  const buffers = new Map<string, TrailSample[]>();
  const lengthById = new Map<string, number>();
  let paused = false;

  function seed(shapesOrScene: TrailableShape[] | SceneDocument): void {
    const list = Array.isArray(shapesOrScene) ? shapesOrScene : trailablesFromScene(shapesOrScene);
    for (const shape of list) {
      lengthById.set(shape.id, clampInt(shape.trailLength, 0, maxLengthPerShape));
      if (!buffers.has(shape.id)) buffers.set(shape.id, []);
    }
  }
  seed(initial);

  function syncTrackedShapes(scene: SceneDocument): TrailableShape[] {
    const current = trailablesFromScene(scene);
    const currentIds = new Set(current.map((s) => s.id));
    // Prune deleted shapes (or shapes whose trail.length dropped to 0) —
    // the object-deletion / no-leak guarantee.
    for (const id of Array.from(buffers.keys())) {
      if (!currentIds.has(id)) {
        buffers.delete(id);
        lengthById.delete(id);
      }
    }
    for (const shape of current) {
      lengthById.set(shape.id, clampInt(shape.trailLength, 0, maxLengthPerShape));
      if (!buffers.has(shape.id)) buffers.set(shape.id, []);
    }
    return current;
  }

  function snapshot(): Map<string, TrailSample[]> {
    const out = new Map<string, TrailSample[]>();
    for (const [id, samples] of buffers) out.set(id, samples.slice());
    return out;
  }

  function tick(
    scene: SceneDocument,
    timestamp: number,
    degraded: boolean,
    reducedMotion: boolean,
  ): Map<string, TrailSample[]> {
    if (paused) return snapshot();

    const current = syncTrackedShapes(scene);
    if (degraded) return snapshot();

    for (const shape of current) {
      const authoredLength = lengthById.get(shape.id) ?? shape.trailLength;
      const effectiveLength = reducedMotion
        ? Math.min(authoredLength, REDUCED_MOTION_TRAIL_LENGTH)
        : authoredLength;

      const buffer = buffers.get(shape.id) ?? [];
      if (effectiveLength <= 0) {
        // trail.length: 0 (or reduced to 0) — no trail at all, buffer stays empty.
        buffers.set(shape.id, []);
        continue;
      }
      if (!Number.isFinite(shape.x) || !Number.isFinite(shape.y)) {
        // Non-finite input rejection: skip this tick's sample entirely
        // rather than recording a corrupted position or wiping the
        // shape's otherwise-valid trail history.
        buffers.set(shape.id, buffer);
        continue;
      }

      buffer.push({ x: shape.x, y: shape.y, timestamp });
      while (buffer.length > effectiveLength) buffer.shift();
      buffers.set(shape.id, buffer);
    }

    return snapshot();
  }

  function getTrails(): Map<string, TrailSample[]> {
    return snapshot();
  }

  function pause(): void {
    paused = true;
  }

  function resume(): void {
    paused = false;
  }

  function reset(): void {
    buffers.clear();
    lengthById.clear();
    paused = false;
  }

  return { tick, getTrails, pause, resume, reset };
}
