/**
 * Task 61: bounded, allowlisted physics forces for a `particleEmitter`
 * shape's own spawned particles (`runtime/particleSystem.ts`, Task 39).
 *
 * ## Allowlisted force types (V1 boundary — no custom formulas)
 *
 * `schema/scene.schema.json`'s `$defs.physicsForce` already defines the
 * *only* shape field that ever attaches a physics force to anything in a
 * canonical scene — the `particleEmitter` shape case's `physics` property
 * (`$ref: "#/$defs/physicsForce"`). Task 39's engineer explicitly flagged
 * this as "Task 61 territory" (see `particleSystem.ts`'s module doc
 * comment, "Out of scope"). That `$defs.physicsForce` object has exactly
 * four properties, and this module implements precisely those four and no
 * others — nothing here accepts an arbitrary custom force formula:
 *
 * - `gravity` (number, schema range -10..10): a constant downward (+y)
 *   acceleration applied every tick, independent of the object's current
 *   velocity. This is "gravity" in the plan.md sense.
 * - `forceX` / `forceY` (number, schema range -10..10 each): a constant
 *   directional acceleration — this is "wind": a steady push in a fixed
 *   direction, unrelated to the object's position or velocity.
 * - `drag` (unitInterval, schema range 0..1): a per-tick velocity damping
 *   factor — `velocity *= (1 - drag)` scaled by elapsed time — modeling
 *   air resistance / friction.
 *
 * `_docs/plan.md`'s own force-type hint list is "gravity/attraction/drag/
 * wind or similar" — the canonical schema was authored (Task 7) without an
 * attraction/repulsion-toward-a-point force, so this module does not
 * invent one: doing so would mean adding an unsupported force type via a
 * schema extension never asked for, which is exactly the V1 boundary this
 * issue calls out ("unsupported force types are V1 boundaries"). If a
 * future task wants attraction/repulsion, it belongs in `schema/
 * scene.schema.json`'s `$defs.physicsForce` first, matching this
 * codebase's existing pattern of the schema being the single source of
 * truth both validators and the runtime read from.
 *
 * ## Clamped limits (own documented choices, reusing schema numbers where
 * one already exists rather than inventing a second)
 *
 * - `MAX_FORCE_COMPONENT` = 10 — `schema/scene.schema.json`'s own
 *   `gravity`/`forceX`/`forceY` min/max, reused verbatim. A scene that
 *   passes schema validation already respects this; this module clamps
 *   again defensively because physics config can also arrive from a
 *   scene that was mutated in memory (e.g. by a graph node) without
 *   re-running `validateScene`.
 * - `MAX_DRAG` = 1 — the schema's `unitInterval` upper bound, reused.
 * - `MAX_VELOCITY_MAGNITUDE` = 2000 — `schema/scene.schema.json`'s
 *   `particleEmitter.speed` max, reused as the runtime velocity ceiling:
 *   a particle's speed already cannot exceed this at spawn
 *   (`particleSystem.ts`'s `spawnParticle`), so clamping force-integrated
 *   velocity to the same ceiling keeps one consistent "how fast is too
 *   fast" number for the whole particle domain rather than adding an
 *   unrelated second one.
 * - Affected-object count: physics only ever touches particles belonging
 *   to one emitter, so the existing `MAX_LIVE_PARTICLES_PER_EMITTER` /
 *   `MAX_TOTAL_LIVE_PARTICLES` caps (`particleSystem.ts`, Task 39,
 *   reused verbatim, not reinvented) already bound "affected objects" —
 *   this module adds no separate cap because doing so would just be a
 *   second, redundant ceiling under the first.
 * - Group nesting: a physics force only ever attaches to a leaf
 *   `particleEmitter` shape (never a group), and `schema/limits.json`'s
 *   `maxGroupNestingDepth` (Task 7) is already enforced by `validateScene`
 *   before a scene reaches any runtime module (see `sceneDrawPlan.ts`'s
 *   `buildScenePlan`, which calls `validateScene` as a backstop). This
 *   module trusts that upstream invariant rather than re-walking group
 *   trees to re-validate a limit that's already guaranteed — exactly how
 *   `particleSystem.ts` already trusts `validateScene`'s limits rather
 *   than re-checking `maxParticleEmitters` itself.
 *
 * ## Non-finite input rejection (defensive, not merely permissive)
 *
 * `sanitizePhysicsForce` replaces any non-finite (`NaN`/`Infinity`/
 * `-Infinity`) component with `0` (a neutral no-op for that component)
 * rather than clamping it toward a boundary or letting it flow through —
 * `Math.min(Math.max(NaN, -10), 10)` is itself `NaN`, so a naive
 * min/max clamp alone does not reject non-finite input. `integrateVelocity`
 * additionally re-checks its own *output* is finite before returning it;
 * if force integration would somehow produce a non-finite velocity (it
 * cannot given sanitized force input under normal float arithmetic, but
 * this is defense in depth against integration bugs), the object's
 * previous velocity is returned unchanged rather than corrupting its
 * state — the same "reject, don't propagate" policy this module applies
 * to force config itself.
 *
 * ## Frame-budget / degradation (Task 35's mechanism, reused)
 *
 * `integrateVelocity` is a pure per-object function; `particleSystem.ts`
 * is the caller that decides, per tick, whether to call it at all. When
 * `ParticleTickInput.degraded` is `true` (Task 35's `TickResult.degraded`,
 * unchanged since Task 39), `particleSystem.ts`'s `expireAndMove` skips
 * force integration for that tick entirely — particles keep moving at
 * their last-known velocity (cheap, already-computed constant-velocity
 * motion) rather than paying for another round of force math — the same
 * "do the cheapest possible work and never make the overload worse"
 * policy `particleSystem.ts` already uses for skipping new emission on a
 * degraded tick. This module does not duplicate that branch; it only
 * exposes the pure function `particleSystem.ts` conditionally calls.
 *
 * ## Determinism
 *
 * `integrateVelocity` is a deterministic pure function of its inputs
 * (current velocity, force config, elapsed seconds) — no randomness
 * anywhere in force integration. Given the same seed, timestamps, scene,
 * and inputs, two independent runs produce byte-for-byte identical
 * velocity (and therefore position) sequences.
 */
import type { SceneDocument } from '../api/projects';

export const MAX_FORCE_COMPONENT = 10; // schema physicsForce gravity/forceX/forceY min/max, reused.
export const MAX_DRAG = 1; // schema unitInterval max, reused.
export const MAX_VELOCITY_MAGNITUDE = 2000; // schema particleEmitter.speed max, reused.

/** The allowlisted physics-force configuration — exactly
 * `schema/scene.schema.json`'s `$defs.physicsForce` shape, sanitized. */
export type PhysicsForceConfig = {
  gravity: number;
  drag: number;
  forceX: number;
  forceY: number;
};

export const NEUTRAL_PHYSICS_FORCE: PhysicsForceConfig = {
  gravity: 0,
  drag: 0,
  forceX: 0,
  forceY: 0,
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function clampFinite(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** Reads a raw (possibly malformed, possibly non-finite) `physics` field
 * value and returns a sanitized, clamped, always-finite
 * `PhysicsForceConfig`. Missing fields and non-finite values both fall
 * back to `0` (a neutral no-op) — matching this module's documented
 * "reject, don't propagate" policy for non-finite input, and
 * `particleSystem.ts`'s existing convention of permissive `0` fallbacks
 * for missing/malformed scene fields (never throwing). */
export function sanitizePhysicsForce(raw: unknown): PhysicsForceConfig {
  const r = asRecord(raw);
  return {
    gravity: clampFinite(r.gravity, -MAX_FORCE_COMPONENT, MAX_FORCE_COMPONENT, 0),
    drag: clampFinite(r.drag, 0, MAX_DRAG, 0),
    forceX: clampFinite(r.forceX, -MAX_FORCE_COMPONENT, MAX_FORCE_COMPONENT, 0),
    forceY: clampFinite(r.forceY, -MAX_FORCE_COMPONENT, MAX_FORCE_COMPONENT, 0),
  };
}

/** Extracts every `particleEmitter` shape's sanitized `physics` config,
 * keyed by shape id. A `particleEmitter` shape with no `physics` field at
 * all maps to `NEUTRAL_PHYSICS_FORCE` (no force — identical to Task 39's
 * pre-Task-61 constant-velocity behavior), matching the "zero values must
 * not crash / must not change unrelated behavior" convention. */
export function physicsFromScene(scene: SceneDocument): Map<string, PhysicsForceConfig> {
  const shapes = (scene as Record<string, unknown>).shapes;
  const result = new Map<string, PhysicsForceConfig>();
  if (!Array.isArray(shapes)) return result;
  for (const raw of shapes) {
    const s = asRecord(raw);
    if (s.type !== 'particleEmitter' || typeof s.id !== 'string') continue;
    result.set(s.id, sanitizePhysicsForce(s.physics));
  }
  return result;
}

function magnitude(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/** Integrates one tick's worth of force onto a velocity: adds `gravity`
 * (a constant +y acceleration) and `forceX`/`forceY` (a constant
 * directional acceleration, i.e. "wind"), then applies `drag` as
 * multiplicative damping scaled by elapsed time, then clamps the
 * resulting velocity's magnitude to `MAX_VELOCITY_MAGNITUDE`. Returns the
 * *unchanged* input velocity (never a corrupted one) if `dtSeconds` is
 * non-finite/negative, or if the integrated result is somehow non-finite
 * — see the module doc comment's "Non-finite input rejection" section. */
export function integrateVelocity(
  vx: number,
  vy: number,
  force: PhysicsForceConfig,
  dtSeconds: number,
): { vx: number; vy: number } {
  if (!Number.isFinite(vx) || !Number.isFinite(vy)) return { vx: 0, vy: 0 };
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return { vx, vy };

  let nvx = vx + force.forceX * dtSeconds;
  let nvy = vy + force.gravity * dtSeconds + force.forceY * dtSeconds;

  if (force.drag > 0) {
    const damping = Math.min(1, force.drag * dtSeconds);
    nvx *= 1 - damping;
    nvy *= 1 - damping;
  }

  if (!Number.isFinite(nvx) || !Number.isFinite(nvy)) return { vx, vy };

  const mag = magnitude(nvx, nvy);
  if (mag > MAX_VELOCITY_MAGNITUDE && mag > 0) {
    const scale = MAX_VELOCITY_MAGNITUDE / mag;
    nvx *= scale;
    nvy *= scale;
  }

  return { vx: nvx, vy: nvy };
}
