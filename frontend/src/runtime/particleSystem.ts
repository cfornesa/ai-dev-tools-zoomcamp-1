/**
 * Task 39: the bounded particle emitter runtime. Emits, updates, expires,
 * and hands off for rendering the particles produced by a scene's
 * `particleEmitter` shapes (`schema/scene.schema.json`'s `$defs.shape`
 * `particleEmitter` case, Task 7 — `rate`/`size`/`lifespan`/`speed`/
 * `palette`, already schema-validated) plus event-triggered bursts
 * (`interaction`-scope `emitParticles` bindings, Task 34's "Emit
 * particles" card).
 *
 * ## Where this plugs into the runtime (Task 35)
 *
 * `frontend/src/runtime/behaviorRuntime.ts`'s own `applyRuntimeOutputsToScene`
 * doc comment already names this integration point: "`interaction`-scope
 * pulses (`events` on the `TickResult`) are not scene mutations and are
 * left for the caller to handle (e.g. triggering a particle burst — Task
 * 39)." This module is that caller-side handler. It does not modify
 * `behaviorRuntime.ts` at all — `BehaviorRuntime.tick()` already produces
 * exactly what's needed every tick without change:
 *
 * - `TickResult.timestamp` — the same elapsed-timestamp clock domain this
 *   module uses for continuous emission and expiry (never frame counts,
 *   matching `behaviorRuntime.ts`'s "Clock model" doc section).
 * - `TickResult.events` — already cooldown-gated and per-second-capped by
 *   `behaviorRuntime.ts`'s `evaluateEvent` (`DEFAULT_EVENT_COOLDOWN_MS`,
 *   `DEFAULT_MAX_EVENTS_PER_SECOND`) for *any* interaction event binding,
 *   `emitParticles` included. This module deliberately does not add a
 *   second, particle-specific cooldown: reusing the runtime's existing
 *   general-purpose event gate is both the "reuse rather than reinvent"
 *   convention this codebase already follows (see Task 37/38's registries
 *   reusing `evaluateSmooth`'s EMA formula) and literally the mechanism
 *   the acceptance criteria call "cooldown prevents event storms from
 *   bypassing emission limits" — spamming `event:pinchStart` faster than
 *   `DEFAULT_EVENT_COOLDOWN_MS` (150ms) never reaches this module as more
 *   than one `burstTriggered: true` tick per cooldown window.
 * - `TickResult.degraded` — Task 35's existing work-budget/quality-
 *   reduction signal. See "Reduced-quality degradation" below.
 *
 * `deriveParticleTickInput` below converts one `TickResult` into this
 * module's `ParticleTickInput`, so a caller's per-frame loop reads:
 *
 * ```ts
 * const result = runtime.tick(input);
 * const scene2 = applyRuntimeOutputsToScene(scene, result.continuous);
 * const particles = particleSystem.tick(deriveParticleTickInput(result));
 * preview.render(scene2, particles);
 * ```
 *
 * ## Numeric policy (own documented choices)
 *
 * `_docs/plan.md`'s "Validation and performance limits" section documents
 * *that* a "fixed maximum particle count and particle emission rate" must
 * exist, but — like Task 35/37/38's constants — leaves exact numbers as
 * "suggested initial operational limits, to tune through testing".
 * `schema/limits.json` (Task 7) already picked two of these at the
 * scene-authoring level: `maxParticleEmitters` (4 emitters per scene) and
 * `maxTotalParticleRate` (800 particles/second, summed across every
 * emitter's `rate` field, enforced by `validation/scene.ts`/
 * `scenes/validation.py` before a scene can even be saved). This module
 * reuses those exact two numbers rather than inventing unrelated ones:
 *
 * - `MAX_TOTAL_LIVE_PARTICLES` = 800 — the same number as
 *   `maxTotalParticleRate`. Reusing it keeps one mental model for "how
 *   many particles is a lot" in this codebase's particle domain, and a
 *   scene that respects the authoring-time rate cap can sustain exactly
 *   this many live particles at a 1-second average lifespan without ever
 *   hitting the runtime cap — a natural, non-arbitrary ceiling.
 * - `MAX_LIVE_PARTICLES_PER_EMITTER` = `MAX_TOTAL_LIVE_PARTICLES /
 *   maxParticleEmitters` = 800 / 4 = 200 — an even split of the total cap
 *   across the schema's maximum emitter count, since neither
 *   `_docs/plan.md` nor `schema/limits.json` allocates the rate cap
 *   per-emitter.
 * - `DEFAULT_MAX_SPAWN_PER_TICK_PER_EMITTER` = 50 — this module's own
 *   choice, guarding a single tick's *compute* cost (not just the live
 *   count) against a large elapsed `dt` (e.g. a backgrounded browser tab
 *   resuming after several seconds) trying to spawn thousands of
 *   particles in one loop. Any fractional emission backlog beyond this
 *   many particles is *not* carried over for the next tick to "catch up"
 *   on either — `tick()` clamps the per-emitter accumulator to this same
 *   number after each tick, so a long gap is lossy (fewer particles than
 *   an idealized continuous rate would produce) rather than a compute or
 *   visual spike once ticking resumes. This is a deliberate trade: V1
 *   prioritizes a bounded frame cost over perfect long-gap accounting.
 * - `DEFAULT_BURST_PARTICLE_COUNT` = 30 — this module's own choice for how
 *   many particles one successful `emitParticles` event adds per live
 *   emitter: roughly one second's worth of a moderate (30/s) emitter
 *   rate, large enough to read as a distinct pulse against continuous
 *   emission, small enough that it can never by itself blow past
 *   `MAX_LIVE_PARTICLES_PER_EMITTER` (200) even from a single burst.
 *
 * ## Continuous emission model (elapsed-time-based, never frame-based)
 *
 * Each emitter accumulates a fractional particle count each tick:
 * `accumulator += (rate * dt) / 1000` where `dt` is the elapsed
 * milliseconds since that emitter's own last tick (tracked per emitter,
 * not globally, so a scene with multiple emitters added at different
 * times never double-counts). Whenever `accumulator >= 1`, one particle
 * spawns and `1` is subtracted, repeated until the accumulator drops
 * below `1` or `DEFAULT_MAX_SPAWN_PER_TICK_PER_EMITTER` is reached for
 * this tick. `rate: 0` never accumulates past `0` (no continuous
 * emission — the documented zero-value behavior), and is not an error.
 *
 * ## Particle-count and rate caps (acceptance criterion: "stop at the
 * cap", not "unlikely to exceed it")
 *
 * `spawnParticle` (the single internal choke point every continuous *and*
 * burst spawn goes through) checks `MAX_TOTAL_LIVE_PARTICLES` and
 * `MAX_LIVE_PARTICLES_PER_EMITTER` (or the caller's override, see
 * `ParticleSystemOptions`) *before* creating a particle and silently
 * declines (no error, no partial state) once either cap is reached — so
 * emission literally stops, verified directly by
 * `particleSystem.test.ts`'s exact-cap and over-cap tests (requesting far
 * more than the cap in one tick still yields exactly the cap, never one
 * more).
 *
 * ## Expiry / cleanup (no unbounded growth)
 *
 * Every `tick()` first filters `particles` down to those whose age
 * (`timestamp - spawnedAt`) is still less than their own `lifespanMs` —
 * an O(n) pass that runs unconditionally, even on a degraded tick (see
 * below), so the live collection can never grow without bound regardless
 * of how long continuous emission runs. `lifespan <= 0` particles are
 * never added to the live collection in the first place (see
 * `spawnParticle`) — they would expire in the same tick they were
 * created, so skipping the add entirely is behaviorally identical and
 * avoids a same-tick add-then-remove no-op.
 *
 * ## Reduced-quality degradation (Task 35's work-budget mechanism)
 *
 * When `ParticleTickInput.degraded` is `true` (i.e.
 * `BehaviorRuntime.tick()`'s own `TickResult.degraded`, set when the
 * *previous* tick exceeded `workBudgetMs` — see `behaviorRuntime.ts`'s
 * "Work-budget degradation" doc section), `tick()` skips *all* new
 * particle creation that tick — no continuous spawning, no burst
 * spawning — while still running the cheap expiry pass. Each emitter's
 * `lastTimestamp` bookkeeping still advances to the current tick's
 * timestamp during a degraded tick (rather than leaving it stale), so the
 * skipped interval's elapsed time is *dropped*, not banked: a degraded
 * tick never causes a compensating catch-up burst of particles once the
 * runtime recovers on a later tick. This is the same "do the cheapest
 * possible work and never make the overload worse" policy
 * `behaviorRuntime.ts` itself uses (dropping bindings and skipping
 * smoothing) — reused here rather than inventing a second degradation
 * strategy.
 *
 * ## Determinism (seeded randomness)
 *
 * No seeded-RNG utility exists elsewhere in this codebase yet (searched
 * `frontend/src/` for "seed" — only `schema/scene.schema.json`'s
 * `randomness.seed` field and `behaviorRuntime.ts`'s pass-through
 * `BehaviorRuntime.seed` getter exist prior to this task; neither
 * generates random numbers). `createSeededRandom` below (a standard
 * mulberry32 PRNG — small, fast, and good enough statistical quality for
 * V1 visual randomness) is this module's own addition, exported so future
 * seed-dependent code (e.g. a later graph "Random" node) can reuse this
 * exact generator rather than adding a second one, matching the issue's
 * "reuse the existing seeded-RNG utility ... rather than adding a second
 * one" instruction now that one exists.
 *
 * `createParticleSystem` seeds one PRNG stream per instance from
 * `scene.randomness.seed`, consumed in a fixed, deterministic order (two
 * draws per spawned particle: emission angle, then palette index) only
 * when `scene.randomness.enabled` is `true` — matching
 * `render/p5Adapter.ts`'s existing convention of only seeding p5's own
 * PRNG when `randomness.enabled` (acceptance criterion 8 there). When
 * `enabled` is `false`, this module falls back to `Math.random()`
 * (non-deterministic, matching "no seed applied" for the renderer's own
 * PRNG in that same case). Given the same seed, the same sequence of tick
 * timestamps, and the same sequence of `burstTriggered` flags, two
 * independent `createParticleSystem` instances produce byte-for-byte
 * identical particle creation sequences (positions, velocities, sizes,
 * colors) — see `particleSystem.test.ts`'s determinism test.
 *
 * ## Pause / resume (no leaked state, no double-emit)
 *
 * `pause()` freezes the system: `tick()` becomes a no-op (returns the
 * current particle snapshot unchanged — no expiry, no emission, no
 * bookkeeping updates) until `resume()` is called. `resume()` clears
 * every emitter's `lastTimestamp` bookkeeping (not the accumulators,
 * particles, or RNG state) so the *next* tick after resuming measures
 * `dt` from that tick's own timestamp (`dt = 0`, contributing no
 * emission) rather than from whatever timestamp was current when
 * `pause()` was called — this is what prevents a long real-world pause
 * from being read as a giant elapsed interval and causing a catch-up
 * emission spike the instant the scene resumes.
 *
 * ## Physics forces (Task 61)
 *
 * As of Task 61, this module *does* read a `particleEmitter` shape's
 * `physics` field (`schema/scene.schema.json`'s `$defs.physicsForce`:
 * `gravity`/`drag`/`forceX`/`forceY`) — see `emittersFromScene`, which now
 * extracts a sanitized, always-finite `PhysicsForceConfig` (see
 * `physicsForces.ts`, `sanitizePhysicsForce`) per emitter, defaulting to
 * `NEUTRAL_PHYSICS_FORCE` (all-zero, a no-op) when the field is absent —
 * so a scene with no `physics` configured behaves exactly as it did
 * before this task: a spawned particle moves in a perfectly straight line
 * at its initial velocity. When `physics` *is* configured,
 * `expireAndMove` calls `physicsForces.ts`'s pure `integrateVelocity`
 * once per live particle, per tick, before applying that tick's positional
 * move — see that module's doc comment for the exact allowlisted force
 * types, clamped limits, and non-finite-input handling. On a degraded
 * tick (see below), force integration is skipped entirely (particles keep
 * their last-known velocity) — the same "skip new work under overload"
 * policy this module already applies to emission.
 */
import type { SceneDocument } from '../api/projects';
import { LIMITS } from '../validation/scene';
import type { TickResult } from './behaviorRuntime';
import {
  integrateVelocity,
  sanitizePhysicsForce,
  NEUTRAL_PHYSICS_FORCE,
  type PhysicsForceConfig,
} from './physicsForces';

// --- Numeric policy (see module doc comment) ----------------------------

export const MAX_TOTAL_LIVE_PARTICLES = 800; // schema/limits.json's maxTotalParticleRate, reused.
export const MAX_LIVE_PARTICLES_PER_EMITTER = Math.floor(
  MAX_TOTAL_LIVE_PARTICLES / (LIMITS.maxParticleEmitters || 4),
); // 200
export const DEFAULT_MAX_SPAWN_PER_TICK_PER_EMITTER = 50;
export const DEFAULT_BURST_PARTICLE_COUNT = 30;

// --- Seeded randomness (see module doc comment's "Determinism" section) -

/** A standard mulberry32 PRNG step, seeded once, called repeatedly.
 * Returns a function producing numbers in `[0, 1)`, deterministic for a
 * given `seed` (a non-negative integer, matching
 * `schema/scene.schema.json`'s `randomness.seed` field). Exported so any
 * future seed-dependent code in this codebase can reuse this exact
 * generator instead of adding a second one. */
export function createSeededRandom(seed: number): () => number {
  let a = (Number.isFinite(seed) ? Math.floor(seed) : 0) >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Emitter configuration ------------------------------------------------

/** One `particleEmitter` shape's configuration, reduced to exactly the
 * fields this module needs — `rate`/`size`/`lifespan`/`speed`/`palette`
 * (`schema/scene.schema.json`'s `particleEmitter` shape case, Task 7) plus
 * its spawn origin (`transform.x`/`transform.y`) and its sanitized
 * `physics` field (Task 61 — see `physicsForces.ts`). Deliberately
 * excludes every other shape field (`style`, `layerId`, `groupId`,
 * `trail`, ...) — this module never reads them. */
export type EmitterConfig = {
  id: string;
  rate: number;
  size: number;
  lifespan: number;
  speed: number;
  palette: string[];
  x: number;
  y: number;
  physics: PhysicsForceConfig;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Extracts every `particleEmitter` shape's `EmitterConfig` from a scene
 * document, in `shapes` array order (so spawn order — and therefore RNG
 * consumption order — is stable for a given scene). Malformed/missing
 * fields fall back to permissive defaults (`0` for numeric fields, `[]`
 * for `palette`) rather than throwing — full structural validation is
 * `validateScene`'s job (already run before a scene reaches this module
 * in the normal editor flow); this function only needs to not crash on a
 * shape missing a field, matching this module's own "zero values must not
 * crash" acceptance criterion. */
export function emittersFromScene(scene: SceneDocument): EmitterConfig[] {
  const shapes = (scene as Record<string, unknown>).shapes;
  if (!Array.isArray(shapes)) return [];
  return shapes
    .filter((s): s is Record<string, unknown> => asRecord(s).type === 'particleEmitter')
    .map((s) => {
      const transform = asRecord(s.transform);
      return {
        id: typeof s.id === 'string' ? s.id : '',
        rate: numberOr(s.rate, 0),
        size: numberOr(s.size, 0),
        lifespan: numberOr(s.lifespan, 0),
        speed: numberOr(s.speed, 0),
        palette: Array.isArray(s.palette) ? s.palette.filter((c) => typeof c === 'string') : [],
        x: numberOr(transform.x, 0),
        y: numberOr(transform.y, 0),
        physics: 'physics' in s ? sanitizePhysicsForce(s.physics) : NEUTRAL_PHYSICS_FORCE,
      };
    });
}

// --- Particles -------------------------------------------------------------

export type Particle = {
  id: string;
  emitterId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  spawnedAt: number;
  lifespanMs: number;
};

/** One tick's input for the particle system — derived from a
 * `BehaviorRuntime` tick's result (`deriveParticleTickInput`) or supplied
 * directly by a test. */
export type ParticleTickInput = {
  /** Elapsed timestamp, same clock domain as `RuntimeInput.timestamp`
   * (`behaviorRuntime.ts`'s "Clock model"). */
  timestamp: number;
  /** True when an `emitParticles` interaction event fired this tick
   * (already cooldown/rate-gated upstream — see the module doc
   * comment). */
  burstTriggered: boolean;
  /** True when the upstream `BehaviorRuntime` tick ran degraded (Task
   * 35's work-budget mechanism). See "Reduced-quality degradation"
   * above. */
  degraded: boolean;
};

/** Converts one `BehaviorRuntime.tick()` result into this module's
 * `ParticleTickInput` — `burstTriggered` is true whenever any fired event
 * this tick targets the `interaction`-scope `emitParticles` channel
 * (`_docs/plan.md`'s "Binding targets and safety" table), regardless of
 * which specific binding fired it (V1 has no per-emitter event routing —
 * see the module doc comment's burst-targeting note below). */
export function deriveParticleTickInput(result: TickResult): ParticleTickInput {
  return {
    timestamp: result.timestamp,
    burstTriggered: result.events.some((e) => e.targetProperty === 'emitParticles'),
    degraded: result.degraded,
  };
}

export type ParticleSystemOptions = {
  maxTotalLiveParticles?: number;
  maxLiveParticlesPerEmitter?: number;
  maxSpawnPerTickPerEmitter?: number;
  burstParticleCount?: number;
};

export type ParticleSystem = {
  /** Evaluates one tick: expires particles past their lifespan, then (if
   * not paused or degraded) emits continuous + burst particles up to the
   * documented caps. Returns the live particle snapshot *after* this
   * tick's changes. */
  tick(input: ParticleTickInput): Particle[];
  /** The current live particle snapshot, without advancing time. */
  getParticles(): Particle[];
  /** Freezes the system — see the module doc comment's "Pause / resume"
   * section. */
  pause(): void;
  /** Un-freezes the system and discards emitter timing bookkeeping so the
   * next tick doesn't treat the paused interval as elapsed time. */
  resume(): void;
  /** Clears every particle, every emitter's accumulator/timing state, and
   * resets the RNG stream back to its initial seed — a full restart,
   * distinct from `pause`/`resume` (which preserve accumulators). */
  reset(): void;
};

/** Creates a bounded particle system driven by `emitters`. Accepts either
 * a pre-extracted `EmitterConfig[]` (convenient for direct, scene-free
 * table-driven tests) or a full `SceneDocument` (extracted via
 * `emittersFromScene` automatically) — the two call shapes cover both
 * this module's own unit tests and the editor's real per-frame usage
 * without asking either caller to do extra work. */
export function createParticleSystem(
  emittersOrScene: EmitterConfig[] | SceneDocument,
  options: ParticleSystemOptions = {},
  randomness: { seed: number; enabled: boolean } = { seed: 0, enabled: false },
): ParticleSystem {
  const emitters: EmitterConfig[] = Array.isArray(emittersOrScene)
    ? emittersOrScene
    : emittersFromScene(emittersOrScene);
  const emittersById = new Map(emitters.map((e) => [e.id, e]));

  const maxTotalLiveParticles = options.maxTotalLiveParticles ?? MAX_TOTAL_LIVE_PARTICLES;
  const maxLiveParticlesPerEmitter =
    options.maxLiveParticlesPerEmitter ?? MAX_LIVE_PARTICLES_PER_EMITTER;
  const maxSpawnPerTickPerEmitter =
    options.maxSpawnPerTickPerEmitter ?? DEFAULT_MAX_SPAWN_PER_TICK_PER_EMITTER;
  const burstParticleCount = options.burstParticleCount ?? DEFAULT_BURST_PARTICLE_COUNT;

  const initialSeed = numberOr(randomness.seed, 0);
  const seededEnabled = randomness.enabled === true;
  let rng = createSeededRandom(initialSeed);

  let particles: Particle[] = [];
  let liveCountByEmitter = new Map<string, number>();
  const accumulatorByEmitter = new Map<string, number>();
  const lastTimestampByEmitter = new Map<string, number>();
  let paused = false;
  // Per-instance (not module-global) so two independently created systems
  // — e.g. determinism tests comparing two instances — never have their
  // particle ids diverge based on unrelated spawn activity elsewhere.
  let particleSequence = 0;

  function nextRandom(): number {
    return seededEnabled ? rng() : Math.random();
  }

  function totalLive(): number {
    return particles.length;
  }

  function liveFor(emitterId: string): number {
    return liveCountByEmitter.get(emitterId) ?? 0;
  }

  /** The single choke point every continuous *and* burst spawn goes
   * through — see the module doc comment's "Particle-count and rate
   * caps" section. Declines silently (no particle added, no error) once
   * either cap is reached, or when `lifespan <= 0` (documented zero-value
   * behavior). */
  function spawnParticle(emitter: EmitterConfig, timestamp: number): void {
    if (emitter.lifespan <= 0) return;
    if (totalLive() >= maxTotalLiveParticles) return;
    if (liveFor(emitter.id) >= maxLiveParticlesPerEmitter) return;

    const angle = nextRandom() * 2 * Math.PI;
    const paletteIndex =
      emitter.palette.length > 0
        ? Math.min(emitter.palette.length - 1, Math.floor(nextRandom() * emitter.palette.length))
        : -1;
    const color = paletteIndex >= 0 ? emitter.palette[paletteIndex] : '#ffffff';

    const speed = Math.max(0, emitter.speed);
    particleSequence += 1;
    particles.push({
      id: `particle-${particleSequence}`,
      emitterId: emitter.id,
      x: emitter.x,
      y: emitter.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.max(0, emitter.size),
      color,
      spawnedAt: timestamp,
      lifespanMs: emitter.lifespan * 1000,
    });
    liveCountByEmitter.set(emitter.id, liveFor(emitter.id) + 1);
  }

  function expireAndMove(
    timestamp: number,
    dtSecondsByEmitter: Map<string, number>,
    applyPhysics: boolean,
  ): void {
    const kept: Particle[] = [];
    const nextCounts = new Map<string, number>();
    for (const particle of particles) {
      const age = timestamp - particle.spawnedAt;
      if (age >= particle.lifespanMs) continue; // expired: drop, no cleanup leak.
      const dtSeconds = dtSecondsByEmitter.get(particle.emitterId) ?? 0;
      let vx = particle.vx;
      let vy = particle.vy;
      // Task 61: integrate this emitter's allowlisted physics forces onto
      // velocity before applying this tick's positional move. Skipped
      // entirely on a degraded tick (applyPhysics: false) — see the module
      // doc comment's "Physics forces" section.
      if (applyPhysics && dtSeconds > 0) {
        const force = emittersById.get(particle.emitterId)?.physics ?? NEUTRAL_PHYSICS_FORCE;
        const integrated = integrateVelocity(vx, vy, force, dtSeconds);
        vx = integrated.vx;
        vy = integrated.vy;
      }
      const moved: Particle =
        dtSeconds > 0
          ? {
              ...particle,
              vx,
              vy,
              x: particle.x + vx * dtSeconds,
              y: particle.y + vy * dtSeconds,
            }
          : particle;
      kept.push(moved);
      nextCounts.set(moved.emitterId, (nextCounts.get(moved.emitterId) ?? 0) + 1);
    }
    particles = kept;
    liveCountByEmitter = nextCounts;
  }

  function tick(input: ParticleTickInput): Particle[] {
    if (paused) return particles.slice();

    // Compute per-emitter dt *before* expiry/movement so existing
    // particles move using this tick's real elapsed interval.
    const dtSecondsByEmitter = new Map<string, number>();
    for (const emitter of emitters) {
      const last = lastTimestampByEmitter.get(emitter.id);
      const dtMs = last === undefined ? 0 : Math.max(0, input.timestamp - last);
      dtSecondsByEmitter.set(emitter.id, dtMs / 1000);
    }

    expireAndMove(input.timestamp, dtSecondsByEmitter, !input.degraded);

    if (input.degraded) {
      // Reduced-quality degradation: skip all new emission this tick, but
      // still advance timing bookkeeping so the skipped interval is
      // dropped, not banked into a later catch-up burst.
      for (const emitter of emitters) lastTimestampByEmitter.set(emitter.id, input.timestamp);
      return particles.slice();
    }

    for (const emitter of emitters) {
      const last = lastTimestampByEmitter.get(emitter.id);
      const dtMs = last === undefined ? 0 : Math.max(0, input.timestamp - last);
      lastTimestampByEmitter.set(emitter.id, input.timestamp);

      if (emitter.rate > 0 && dtMs > 0) {
        let accumulator =
          (accumulatorByEmitter.get(emitter.id) ?? 0) + (emitter.rate * dtMs) / 1000;
        let spawnedThisTick = 0;
        while (accumulator >= 1 && spawnedThisTick < maxSpawnPerTickPerEmitter) {
          spawnParticle(emitter, input.timestamp);
          accumulator -= 1;
          spawnedThisTick += 1;
        }
        // Clamp backlog: a long gap is lossy, never a compensating spike
        // later (see the module doc comment).
        accumulator = Math.min(accumulator, maxSpawnPerTickPerEmitter);
        accumulatorByEmitter.set(emitter.id, accumulator);
      }
    }

    if (input.burstTriggered) {
      for (const emitter of emitters) {
        const count = Math.min(burstParticleCount, maxSpawnPerTickPerEmitter);
        for (let i = 0; i < count; i += 1) {
          spawnParticle(emitter, input.timestamp);
        }
      }
    }

    return particles.slice();
  }

  function getParticles(): Particle[] {
    return particles.slice();
  }

  function pause(): void {
    paused = true;
  }

  function resume(): void {
    paused = false;
    lastTimestampByEmitter.clear();
  }

  function reset(): void {
    particles = [];
    liveCountByEmitter = new Map();
    accumulatorByEmitter.clear();
    lastTimestampByEmitter.clear();
    paused = false;
    particleSequence = 0;
    rng = createSeededRandom(initialSeed);
  }

  return { tick, getParticles, pause, resume, reset };
}
