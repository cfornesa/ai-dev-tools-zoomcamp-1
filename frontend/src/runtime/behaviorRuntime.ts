/**
 * Task 35: the bounded behavior-graph runtime. Evaluates a validated
 * scene's `bindings` (`schema/scene.schema.json`'s `$defs.binding`) and
 * `graph` (`$defs.graphNode`/`$defs.graphConnection`) — exactly the shapes
 * `frontend/src/pages/behaviorCards.ts`'s four card types (Task 34) write
 * — against a stream of elapsed-timestamped tracking signals, producing
 * clamped, smoothed, rate-limited output values for their target visual
 * channels.
 *
 * ## Scope (issue #35's "Out of scope")
 *
 * Task 37 (numeric transform nodes: Map range, Clamp, Smooth, Invert, Add,
 * Multiply, Lerp — see the "Transform node registry" section below) has
 * landed. `Oscillator` (also listed in `_docs/plan.md`'s V1 node list) and
 * Task 38 (condition/timing nodes: If/Else, Delay, Cooldown, Timer) have
 * not. This runtime evaluates three paths:
 *
 * 1. `scene.bindings` directly (signal -> mapping -> smoothing -> clamp ->
 *    target channel), which is what every behavior card actually produces
 *    and is sufficient to drive the renderer end to end.
 * 2. `scene.graph` nodes/connections structurally — validated (allowlisted
 *    family/type, no cycles, port compatibility, and — as of Task 37 —
 *    per-node-type parameter validity) so a saved graph can never silently
 *    contain something this runtime can't safely run.
 * 3. `scene.graph` transform chains rooted at an `input`-family node and
 *    terminating at a `visual`-family `shapeProperty`/`groupProperty` node,
 *    *executed* (not just validated) into a `ContinuousOutput` each tick —
 *    see "Transform node registry" and `evaluateGraphNodeValue` below. Graph
 *    nodes belonging to a Task 34 behavior card (id prefix `input-`/
 *    `action-`) are skipped here even when reachable, because that exact
 *    output is already produced by path 1 (the card's binding); evaluating
 *    both would double-emit a `ContinuousOutput` for the same target
 *    channel. Hand-authored graph nodes (any other id) have no binding
 *    counterpart, so they are the only ones this path emits for.
 *
 * `ALLOWED_NODE_TYPES_BY_FAMILY` and `NODE_PORTS` are small registries, not
 * a switch statement buried in logic, specifically so a new node type is
 * additive (new map entries plus one evaluator branch) rather than a
 * rewrite — the pattern Task 37 followed to add its 7 node types, and Task
 * 38 can follow for condition/timing nodes.
 *
 * ## Clock model
 *
 * Every timing decision — smoothing, cooldowns, per-second event caps —
 * derives from `RuntimeInput.timestamp`, an elapsed millisecond timestamp
 * supplied by the caller (the same clock domain as
 * `tracking/types.ts`'s `TrackingFrame.timestamp` and, in the browser,
 * `requestAnimationFrame`'s callback argument — see `_docs/plan.md`: "All
 * time calculations use elapsed timestamps ... never frame counts.").
 * Nothing in this module reads `Date.now()`, counts ticks, or otherwise
 * assumes a fixed frame rate; every test in `behaviorRuntime.test.ts`
 * that varies the interval between ticks and asserts identical
 * elapsed-time-based results is the concrete check for this.
 *
 * ## Numeric policy (see also the issue #35 comment thread for citations)
 *
 * `_docs/plan.md`'s "Validation and performance limits" section documents
 * *that* a per-frame work budget, event cooldowns, and per-second caps
 * must exist, but lists them as "suggested initial operational limits, to
 * tune through testing" without exact numbers. The values below are this
 * module's own documented choices, chosen consistently with the numbers
 * the codebase already picked for adjacent concerns
 * (`tracking/handSignals.ts`'s smoothing convention,
 * `tracking/twoHandSignals.ts`'s 150ms hold time):
 *
 * - `DEFAULT_WORK_BUDGET_MS` = 4ms. A 60Hz frame budgets 16.67ms total;
 *   reserving ~25% for behavior evaluation leaves the remainder for
 *   MediaPipe inference and p5 drawing, which run in the same frame.
 * - `DEFAULT_EVENT_COOLDOWN_MS` = 150ms per firing binding, matching
 *   `twoHandSignals.ts`'s `holdTimeMs` default for the same reason it
 *   chose 150ms: long enough to absorb tracking jitter without feeling
 *   laggy for a deliberate gesture.
 * - `DEFAULT_MAX_EVENTS_PER_SECOND` = 10 per firing binding: generous
 *   headroom above the 1-3 gesture events/second a real hand produces,
 *   while still bounding worst-case repeated-trigger cost.
 * - `REFERENCE_TICK_MS` = 1000/60 ≈ 16.667ms, the reference interval a
 *   binding's `smoothing` (`$defs.unitInterval`, e.g. `0.3` from
 *   `bindingForCard`'s "followHand" case) is defined against, so ticks
 *   spaced differently than 60Hz still converge at the same *time-based*
 *   rate (`effectiveAlpha = 1 - (1 - smoothing) ** (dt / REFERENCE_TICK_MS)`).
 *   The EMA formula and "higher = less smoothing / faster response"
 *   direction match `tracking/handSignals.ts`'s existing `smoothingAlpha`
 *   convention exactly, reused here rather than inventing a second one.
 *
 * ## Work-budget degradation
 *
 * Each `tick()` measures its own evaluation wall-clock time (via an
 * injectable `perfNow`, defaulting to `performance.now`). If a tick
 * exceeds `workBudgetMs`, the *next* tick runs degraded: smoothing is
 * skipped (bindings snap straight to their mapped, clamped value — no EMA
 * state to update) and only the first half of bindings (array order —
 * a scene's earlier-authored bindings are the higher priority ones) are
 * evaluated, the rest silently dropped for that tick only. A tick that
 * completes back under budget returns to normal for the tick after it —
 * there is no separate recovery timer, keeping the policy trivial to
 * reason about and deterministic to test. Every tick that itself exceeded
 * budget emits one `RuntimeDiagnostic` naming only the binding count and
 * timings involved — never signal values, hand landmarks, or any other
 * per-user data.
 */
import type { SceneDocument } from '../api/projects';
import { validateScene, type SceneValidationError } from '../validation/scene';

// --- Numeric policy (see module doc comment) --------------------------

export const REFERENCE_TICK_MS = 1000 / 60;
export const DEFAULT_WORK_BUDGET_MS = 4;
export const DEFAULT_EVENT_COOLDOWN_MS = 150;
export const DEFAULT_MAX_EVENTS_PER_SECOND = 10;

// --- Target-channel allowlist and clamping ranges ----------------------

/** `_docs/plan.md`'s "Binding targets and safety" table, expressed as the
 * exact `$defs.binding.targetProperty` values each `targetScope` may use.
 * A binding whose (targetScope, targetProperty) pair isn't listed here is
 * rejected by `validateBehaviorGraph` before any tick ever runs — this is
 * the "allowlisted visual target channels" acceptance criterion. */
export const ALLOWED_TARGET_PROPERTIES_BY_SCOPE: Record<string, ReadonlySet<string>> = {
  shape: new Set([
    'positionX',
    'positionY',
    'scaleX',
    'scaleY',
    'rotation',
    'opacity',
    'fill',
    'stroke',
  ]),
  group: new Set([
    'positionX',
    'positionY',
    'scaleX',
    'scaleY',
    'rotation',
    'opacity',
    'fill',
    'stroke',
  ]),
  scene: new Set(['backgroundColor', 'palette', 'globalForce']),
  interaction: new Set(['triggerPreset', 'toggleLayer', 'emitParticles', 'resetScene']),
};

/** Every target property's documented supported numeric range —
 * `schema/scene.schema.json`'s `$defs.transform2D` (position/scale/
 * rotation/opacity, Task 7). Every continuous output aimed at one of
 * these channels is clamped into this range before it leaves `tick()`
 * (acceptance criterion: "every output is clamped"). `fill`/`stroke`/
 * `backgroundColor` are colors, not numbers — see `COLOR_TARGET_PROPERTIES`
 * below. `palette`/`globalForce` are allowlisted target channels (scene
 * scope) but no card or signal shape today produces a continuous value
 * for them; they are valid to *declare* a binding against (so a scene
 * carrying one still validates) but `tick()` does not yet emit a
 * continuous output for them — a documented extension point, not a bug. */
export const NUMERIC_TARGET_RANGES: Record<string, readonly [number, number]> = {
  positionX: [-100000, 100000],
  positionY: [-100000, 100000],
  scaleX: [0, 100],
  scaleY: [0, 100],
  rotation: [-360, 360],
  opacity: [0, 1],
};

export const COLOR_TARGET_PROPERTIES = new Set(['fill', 'stroke', 'backgroundColor']);
const COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Target properties that carry a one-shot pulse rather than a continuous
 * value — `_docs/plan.md`'s "Interaction" scope row ("Cooldowns and
 * events-per-second caps"). */
export const INTERACTION_TARGET_PROPERTIES = ALLOWED_TARGET_PROPERTIES_BY_SCOPE.interaction;

// --- Graph node registry (see module doc comment's "Scope" section) ----

/** The only (family, type) pairs this runtime accepts today — exactly what
 * `behaviorCards.ts`'s `graphFragmentForCard` writes for its four card
 * types. Adding a Task 37/38 node type is additive: a new entry here, a
 * `NODE_PORTS` entry, and one more evaluator branch — never a rewrite of
 * `validateBehaviorGraph` or `tick`. */
export const ALLOWED_NODE_TYPES_BY_FAMILY: Record<string, ReadonlySet<string>> = {
  input: new Set(['handSignal', 'gestureEvent']),
  transform: new Set(['mapRange', 'clamp', 'smooth', 'invert', 'add', 'multiply', 'lerp']), // Task 37.
  condition: new Set(), // Task 38 — not yet built.
  visual: new Set(['shapeProperty', 'groupProperty', 'particleEmitter']),
  flow: new Set(['trigger']),
  output: new Set(),
};

/** Port vocabulary per node type — `graphFragmentForCard`'s exact
 * `fromPort`/`toPort` strings. A connection whose port name isn't valid
 * for the node it names is rejected as an invalid connection, distinct
 * from (and in addition to) `validateScene`'s dangling-node-id check.
 * Exported so `frontend/src/pages/graphEditing.ts` (Task 36's graph
 * editor) can reuse this exact port vocabulary as its single source of
 * truth for typed handles, rather than maintaining a second copy that
 * could drift from what this runtime actually accepts. */
export const NODE_PORTS: Record<string, { out?: ReadonlySet<string>; in?: ReadonlySet<string> }> = {
  handSignal: { out: new Set(['value']) },
  gestureEvent: { out: new Set(['event']) },
  shapeProperty: { in: new Set(['in']) },
  groupProperty: { in: new Set(['in']) },
  particleEmitter: { in: new Set(['trigger']) },
  trigger: { in: new Set(['trigger']) },
  // Task 37 transform nodes: every one carries a single numeric "value"
  // signal per port (never "event") — see the "Transform node registry"
  // section below for each type's exact semantics.
  mapRange: { in: new Set(['in']), out: new Set(['out']) },
  clamp: { in: new Set(['in']), out: new Set(['out']) },
  smooth: { in: new Set(['in']), out: new Set(['out']) },
  invert: { in: new Set(['in']), out: new Set(['out']) },
  add: { in: new Set(['inA', 'inB']), out: new Set(['out']) },
  multiply: { in: new Set(['inA', 'inB']), out: new Set(['out']) },
  lerp: { in: new Set(['inA', 'inB']), out: new Set(['out']) },
};

// --- Transform node registry (Task 37) ----------------------------------

/**
 * Documented typed inputs/outputs/defaults/ranges for the 7 V1 math/time
 * transform nodes (`_docs/plan.md`'s "Math and time nodes" list, minus
 * `Oscillator`/`Timer`/`Delay`/`Cooldown`, which are out of scope for this
 * task — see the module doc comment). `_docs/plan.md` names these nodes but
 * gives no exact numeric defaults/ranges/edge-case behavior, so every
 * default and edge case below is this module's own documented choice
 * (parallel to the "Numeric policy" section above for Task 35's constants):
 *
 * - **Map range** (`mapRange`): one input port `in`, one output port `out`.
 *   Params `inMin`/`inMax`/`outMin`/`outMax` (finite numbers, default
 *   `0`/`1`/`0`/`1`) and `clampOutput` (boolean, default `true`). Linearly
 *   remaps `in` from `[inMin, inMax]` to `[outMin, outMax]`. **Equal input
 *   bounds** (`inMin === inMax`, which would otherwise divide by zero and
 *   yield `NaN`): documented to return the **midpoint of the output range**,
 *   `(outMin + outMax) / 2`, regardless of the input value — a degenerate
 *   input range carries no ratio information, so the midpoint is the most
 *   neutral defined output. `clampOutput: true` (the default) clamps the
 *   result into `[min(outMin, outMax), max(outMin, outMax)]` after mapping,
 *   satisfying "every output is clamped" (`_docs/plan.md`'s runtime
 *   guardrails) without extra wiring; setting it `false` allows
 *   extrapolation past the output range for callers that want it (e.g. a
 *   later Clamp node explicitly bounding it instead).
 * - **Clamp** (`clamp`): one input `in`, one output `out`. Params
 *   `min`/`max` (finite numbers, default `0`/`1`). Output = `in` bounded to
 *   `[min, max]`. `min > max` is an invalid parameter combination, rejected
 *   by `validateBehaviorGraph` before any tick runs (see
 *   `validateTransformNodeParams`) — never silently swapped or clamped to a
 *   single point.
 * - **Smooth** (`smooth`): one input `in`, one output `out`. Param
 *   `smoothing` (unit interval `[0, 1]`, default `0.3`) — the exact same
 *   time-normalized EMA convention `evaluateContinuous` already uses for a
 *   binding's `smoothing` field (see the "Numeric policy" section), reused
 *   here rather than inventing a second smoothing model. **Initialization**:
 *   the first tick a node ever receives a valid (present, finite) input
 *   value, there is no prior smoothed value to blend against, so the node
 *   snaps directly to that input (no delay on cold start) — identical to
 *   `evaluateContinuous`'s binding-smoothing cold start. **Missing input**
 *   (the upstream value is absent or non-finite this tick): the node holds
 *   its last computed output rather than glitching to `0` or dropping
 *   downstream output; if the node has never yet produced a value, its
 *   output is `null` (nothing to hold).
 * - **Invert** (`invert`): one input `in`, one output `out`. Params
 *   `min`/`max` (finite numbers, default `0`/`1`) — the range to reflect
 *   within. Output = `min + max - clamp(in, min, max)`, i.e. a value at
 *   `min` maps to `max` and vice versa, linearly in between; input outside
 *   `[min, max]` is clamped first. `min > max` is rejected the same way as
 *   Clamp's.
 * - **Add** (`add`): two input ports `inA`/`inB`, one output `out`. No
 *   configurable params. Output = `inA + inB`. An **unconnected port**
 *   defaults to `0` (the additive identity) rather than making the whole
 *   node produce nothing — this is Add's *documented* missing-input policy,
 *   deliberately different from Smooth/Lerp's state-holding policy, chosen
 *   because Add has no meaningful "last value" to hold and `0` is a
 *   mathematically neutral default. If *both* ports are unconnected the
 *   node has no data source at all and produces no output (`null`). A
 *   **non-finite result** (`NaN`/`±Infinity` — reachable from finite inputs
 *   via overflow, e.g. two values near `Number.MAX_VALUE`) is never
 *   silently propagated: the node's output for that tick is rejected
 *   (`null`), the same "reject rather than propagate garbage" policy this
 *   module already uses for `clampToTargetRange`'s non-finite guard.
 * - **Multiply** (`multiply`): two input ports `inA`/`inB`, one output
 *   `out`. No configurable params. Output = `inA * inB`. An unconnected
 *   port defaults to `1` (the multiplicative identity), for the same reason
 *   Add defaults an unconnected port to `0`. Both ports unconnected, or a
 *   non-finite result: `null`, identically to Add.
 * - **Lerp** (`lerp`): two input ports `inA`/`inB`, one output `out`. Param
 *   `t` (unit interval `[0, 1]`, default `0.5`). Output =
 *   `inA + clamp(t, 0, 1) * (inB - inA)`. **Initialization**: with no prior
 *   computed value and either input missing/non-finite, output is `null`
 *   (nothing to hold yet). **Missing input** on a later tick (either `inA`
 *   or `inB` absent or non-finite): the node holds its last computed
 *   output — the same state-holding policy as Smooth, and the opposite of
 *   Add/Multiply's identity-substitution policy, because a lerp between an
 *   absent endpoint and `0`/`1` would be a meaningless discontinuity rather
 *   than a neutral default.
 *
 * Every one of the 7 pure math functions below (`evaluateMapRange`,
 * `evaluateClamp`, `evaluateInvert`, `evaluateAdd`, `evaluateMultiply`,
 * `evaluateLerp`) treats a `null` or non-finite (`NaN`/`Infinity`) input
 * uniformly: return `null` rather than propagating garbage — the "reject
 * non-finite intermediate results" behavior applies to all 7 node types,
 * not only Add/Multiply, since any of them could receive a non-finite
 * upstream value in principle. `evaluateSmooth`/`evaluateLerp`'s
 * *state-holding* behavior (as opposed to outright rejection) is layered on
 * top inside `evaluateGraphNodeValue`, which is the only place that owns
 * per-node state across ticks.
 */
export const MAP_RANGE_DEFAULTS = { inMin: 0, inMax: 1, outMin: 0, outMax: 1, clampOutput: true };
export const CLAMP_DEFAULTS = { min: 0, max: 1 };
export const SMOOTH_DEFAULTS = { smoothing: 0.3 };
export const INVERT_DEFAULTS = { min: 0, max: 1 };
export const LERP_DEFAULTS = { t: 0.5 };

function numberParam(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isFiniteNumberParam(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Validates one transform node's `params` beyond "leaf values only"
 * (already enforced by `scene.schema.json`): finite-number bounds and
 * `min <= max` invariants documented above. Returns a human-readable error
 * string, or `null` when the params are valid. Called from
 * `validateBehaviorGraph` so an invalid parameter is surfaced as text
 * before any tick ever runs — never a second, separate validation path. */
export function validateTransformNodeParams(
  type: string,
  params: Record<string, unknown>,
): string | null {
  switch (type) {
    case 'mapRange': {
      for (const key of ['inMin', 'inMax', 'outMin', 'outMax']) {
        if (params[key] !== undefined && !isFiniteNumberParam(params[key])) {
          return `'${key}' must be a finite number.`;
        }
      }
      if (params.clampOutput !== undefined && typeof params.clampOutput !== 'boolean') {
        return `'clampOutput' must be a boolean.`;
      }
      return null;
    }
    case 'clamp': {
      if (params.min !== undefined && !isFiniteNumberParam(params.min)) {
        return `'min' must be a finite number.`;
      }
      if (params.max !== undefined && !isFiniteNumberParam(params.max)) {
        return `'max' must be a finite number.`;
      }
      const min = numberParam(params, 'min', CLAMP_DEFAULTS.min);
      const max = numberParam(params, 'max', CLAMP_DEFAULTS.max);
      if (min > max) return `'min' (${min}) must not be greater than 'max' (${max}).`;
      return null;
    }
    case 'smooth': {
      if (params.smoothing === undefined) return null;
      if (!isFiniteNumberParam(params.smoothing) || params.smoothing < 0 || params.smoothing > 1) {
        return `'smoothing' must be a number between 0 and 1.`;
      }
      return null;
    }
    case 'invert': {
      if (params.min !== undefined && !isFiniteNumberParam(params.min)) {
        return `'min' must be a finite number.`;
      }
      if (params.max !== undefined && !isFiniteNumberParam(params.max)) {
        return `'max' must be a finite number.`;
      }
      const min = numberParam(params, 'min', INVERT_DEFAULTS.min);
      const max = numberParam(params, 'max', INVERT_DEFAULTS.max);
      if (min > max) return `'min' (${min}) must not be greater than 'max' (${max}).`;
      return null;
    }
    case 'add':
    case 'multiply':
      return null; // No configurable params today.
    case 'lerp': {
      if (params.t === undefined) return null;
      if (!isFiniteNumberParam(params.t) || params.t < 0 || params.t > 1) {
        return `'t' must be a number between 0 and 1.`;
      }
      return null;
    }
    default:
      return null;
  }
}

/** Map range: see the "Transform node registry" doc comment for the exact
 * equal-input-bounds and output-clamping behavior. `value === null` (no
 * upstream value this tick) or non-finite returns `null`. */
export function evaluateMapRange(
  value: number | null,
  params: Record<string, unknown>,
): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const inMin = numberParam(params, 'inMin', MAP_RANGE_DEFAULTS.inMin);
  const inMax = numberParam(params, 'inMax', MAP_RANGE_DEFAULTS.inMax);
  const outMin = numberParam(params, 'outMin', MAP_RANGE_DEFAULTS.outMin);
  const outMax = numberParam(params, 'outMax', MAP_RANGE_DEFAULTS.outMax);
  const clampOutput =
    typeof params.clampOutput === 'boolean' ? params.clampOutput : MAP_RANGE_DEFAULTS.clampOutput;

  let result: number;
  if (inMin === inMax) {
    // Degenerate input range: no ratio is defined, so return the
    // documented midpoint of the output range instead of dividing by zero.
    result = (outMin + outMax) / 2;
  } else {
    const t = (value - inMin) / (inMax - inMin);
    result = outMin + t * (outMax - outMin);
  }
  if (clampOutput) {
    result = clamp(result, Math.min(outMin, outMax), Math.max(outMin, outMax));
  }
  return Number.isFinite(result) ? result : null;
}

/** Clamp: bounds `value` to `[min, max]`. `min > max` is rejected as an
 * invalid parameter before this ever runs (`validateTransformNodeParams`),
 * so this function trusts its params. `null`/non-finite input -> `null`. */
export function evaluateClamp(
  value: number | null,
  params: Record<string, unknown>,
): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const min = numberParam(params, 'min', CLAMP_DEFAULTS.min);
  const max = numberParam(params, 'max', CLAMP_DEFAULTS.max);
  return clamp(value, min, max);
}

/** Invert: reflects `value` within `[min, max]`. `null`/non-finite input ->
 * `null`. */
export function evaluateInvert(
  value: number | null,
  params: Record<string, unknown>,
): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const min = numberParam(params, 'min', INVERT_DEFAULTS.min);
  const max = numberParam(params, 'max', INVERT_DEFAULTS.max);
  return min + max - clamp(value, min, max);
}

/** Add: `a + b`. Either input `null`/non-finite, or a non-finite result,
 * returns `null` — the graph evaluator (`evaluateGraphNodeValue`)
 * substitutes `0` for an unconnected port before calling this, so `null`
 * reaching here means a genuinely non-finite value, not just "unwired". */
export function evaluateAdd(a: number | null, b: number | null): number | null {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  const result = a + b;
  return Number.isFinite(result) ? result : null;
}

/** Multiply: `a * b`. Same non-finite handling as `evaluateAdd`; the graph
 * evaluator substitutes `1` for an unconnected port before calling this. */
export function evaluateMultiply(a: number | null, b: number | null): number | null {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  const result = a * b;
  return Number.isFinite(result) ? result : null;
}

/** Lerp: `a + clamp(t, 0, 1) * (b - a)`. Either input `null`/non-finite
 * returns `null` (the graph evaluator layers state-holding on top of that,
 * per the "Transform node registry" doc comment — this pure function has
 * no state). */
export function evaluateLerp(
  a: number | null,
  b: number | null,
  params: Record<string, unknown>,
): number | null {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  const t = clamp(numberParam(params, 't', LERP_DEFAULTS.t), 0, 1);
  const result = a + t * (b - a);
  return Number.isFinite(result) ? result : null;
}

// --- Public types --------------------------------------------------------

export type RuntimeSignalValue = number | boolean | null;

/** One tick's input: an elapsed timestamp plus the signal values active at
 * that instant. `signals` is keyed by `schema/scene.schema.json`'s
 * `$defs.signal` names (e.g. `indexTipX`, `pinchStrength`, `handDistance`)
 * — the same vocabulary `tracking/handSignals.ts`/`twoHandSignals.ts`
 * produce. `events` lists the `$defs.signal` `event:*` names that fired
 * exactly at this tick (e.g. `event:pinchStart`) — a one-shot occurrence,
 * not a level. */
export type RuntimeInput = {
  timestamp: number;
  signals: Partial<Record<string, RuntimeSignalValue>>;
  events: readonly string[];
};

export type ContinuousOutput = {
  bindingId: string;
  targetScope: string;
  targetId: string | null;
  targetProperty: string;
  value: number | string;
};

export type EventOutput = {
  bindingId: string;
  targetScope: string;
  targetId: string | null;
  targetProperty: string;
  timestamp: number;
};

export type RuntimeDiagnostic = {
  type: 'frameBudgetExceeded';
  /** Human-readable, non-sensitive summary — binding counts and timings
   * only, never signal values, hand landmarks, or user identifiers. */
  message: string;
  bindingCount: number;
  evaluatedMs: number;
  budgetMs: number;
};

export type TickResult = {
  timestamp: number;
  continuous: ContinuousOutput[];
  events: EventOutput[];
  /** True when this tick ran under the degraded (over-budget-recovery)
   * policy: smoothing skipped, lowest-priority bindings dropped. */
  degraded: boolean;
  droppedBindingCount: number;
  evaluatedMs: number;
  diagnostics: RuntimeDiagnostic[];
};

export type BehaviorRuntimeOptions = {
  /** Per-tick evaluation wall-clock budget, in ms. Default
   * `DEFAULT_WORK_BUDGET_MS`. */
  workBudgetMs?: number;
  /** Minimum time between two firings of the same event binding, in ms.
   * Default `DEFAULT_EVENT_COOLDOWN_MS`. */
  eventCooldownMs?: number;
  /** Maximum firings per second for a single event binding. Default
   * `DEFAULT_MAX_EVENTS_PER_SECOND`. */
  maxEventsPerSecond?: number;
  /** Wall-clock source used only to measure each tick's own evaluation
   * cost against `workBudgetMs` — never used for signal timing (that's
   * always `RuntimeInput.timestamp`). Injectable so tests can simulate
   * over-budget ticks deterministically. Defaults to `performance.now`
   * (falling back to `Date.now` where `performance` is unavailable). */
  perfNow?: () => number;
};

export class BehaviorGraphValidationError extends Error {
  errors: SceneValidationError[];
  constructor(errors: SceneValidationError[]) {
    super(
      errors.length > 0
        ? `Invalid behavior graph: ${errors[0].message}`
        : 'Invalid behavior graph.',
    );
    this.name = 'BehaviorGraphValidationError';
    this.errors = errors;
  }
}

export interface BehaviorRuntime {
  /** Evaluates one tick. Throws nothing under normal operation — a scene
   * that fails validation is rejected by `createBehaviorRuntime` itself,
   * before any tick can run (acceptance criterion: rejection happens
   * "before execution", not mid-execution). */
  tick(input: RuntimeInput): TickResult;
  /** The scene's read-only `randomness.seed`, exposed for future
   * seed-dependent node types (none exist yet — see the module doc
   * comment's "Scope" section). Always a finite integer even when the
   * scene has randomness disabled, matching `schema/scene.schema.json`'s
   * `randomness.seed` field, which is always present. */
  readonly seed: number;
}

// --- Validation ------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function sceneBindings(scene: SceneDocument): Array<Record<string, unknown>> {
  const raw = (scene as Record<string, unknown>).bindings;
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

function sceneGraph(scene: SceneDocument): {
  nodes: Array<Record<string, unknown>>;
  connections: Array<Record<string, unknown>>;
} {
  const graph = asRecord((scene as Record<string, unknown>).graph);
  return {
    nodes: Array.isArray(graph.nodes) ? (graph.nodes as Array<Record<string, unknown>>) : [],
    connections: Array.isArray(graph.connections)
      ? (graph.connections as Array<Record<string, unknown>>)
      : [],
  };
}

/** Detects a cycle anywhere in the graph's connection edges using
 * standard three-color DFS. Returns the id of one node participating in a
 * cycle, or `null` if the graph is acyclic. Exported so the Task 36 graph
 * editor can reject a candidate connection that would introduce a cycle
 * *before* ever writing it to scene state (see `graphEditing.ts`'s
 * `checkGraphConnection`), using this exact algorithm rather than a
 * second implementation that could disagree with `validateBehaviorGraph`. */
export function findCycle(
  nodeIds: string[],
  edges: Array<{ from: string; to: string }>,
): string | null {
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) adjacency.set(id, []);
  for (const edge of edges) {
    if (adjacency.has(edge.from)) adjacency.get(edge.from)!.push(edge.to);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(nodeIds.map((id) => [id, WHITE]));
  let cycleNode: string | null = null;

  function visit(id: string): void {
    if (cycleNode !== null) return;
    color.set(id, GRAY);
    for (const next of adjacency.get(id) ?? []) {
      if (cycleNode !== null) return;
      const nextColor = color.get(next);
      if (nextColor === GRAY) {
        cycleNode = next;
        return;
      }
      if (nextColor === WHITE) visit(next);
    }
    color.set(id, BLACK);
  }

  for (const id of nodeIds) {
    if (cycleNode !== null) break;
    if (color.get(id) === WHITE) visit(id);
  }
  return cycleNode;
}

/**
 * Validates a scene's `bindings` and `graph` beyond what `validateScene`
 * already checks (schema shape, complexity limits, dangling-id
 * referential integrity): allowlisted node family/type, port-compatible
 * connections, no connection cycles, and allowlisted target channels per
 * binding scope. Runs `validateScene` first as a backstop — a scene that
 * fails plain schema/limits validation is rejected here too, with those
 * errors surfaced directly, so a caller only ever needs to call this one
 * function before executing a graph.
 */
export function validateBehaviorGraph(scene: SceneDocument): {
  valid: boolean;
  errors: SceneValidationError[];
} {
  const base = validateScene(scene);
  if (!base.valid) return base;

  const errors: SceneValidationError[] = [];
  const { nodes, connections } = sceneGraph(scene);
  const bindings = sceneBindings(scene);

  const nodeById = new Map<string, Record<string, unknown>>();
  nodes.forEach((node, index) => {
    const id = typeof node.id === 'string' ? node.id : `#${index}`;
    nodeById.set(id, node);
    const family = typeof node.family === 'string' ? node.family : '';
    const type = typeof node.type === 'string' ? node.type : '';
    const allowedTypes = ALLOWED_NODE_TYPES_BY_FAMILY[family];
    if (!allowedTypes) {
      errors.push({
        path: `$.graph.nodes[${index}]`,
        rule: 'invalidNodeFamily',
        message: `Graph node '${id}' has unsupported family '${family}'.`,
      });
      return;
    }
    if (!allowedTypes.has(type)) {
      errors.push({
        path: `$.graph.nodes[${index}]`,
        rule: 'invalidNodeType',
        message: `Graph node '${id}' has unsupported type '${type}' for family '${family}'.`,
      });
      return;
    }
    if (family === 'transform') {
      const paramError = validateTransformNodeParams(type, asRecord(node.params));
      if (paramError) {
        errors.push({
          path: `$.graph.nodes[${index}].params`,
          rule: 'invalidNodeParams',
          message: `Graph node '${id}' (${type}): ${paramError}`,
        });
      }
    }
  });

  connections.forEach((connection, index) => {
    const fromNodeId = connection.fromNodeId;
    const toNodeId = connection.toNodeId;
    const fromPort = connection.fromPort;
    const toPort = connection.toPort;
    if (typeof fromNodeId !== 'string' || typeof toNodeId !== 'string') return; // schema already requires these
    const fromNode = nodeById.get(fromNodeId);
    const toNode = nodeById.get(toNodeId);
    // Dangling ids are already reported by validateScene's backstop; only
    // check port compatibility for connections that do resolve.
    if (fromNode) {
      const fromType = typeof fromNode.type === 'string' ? fromNode.type : '';
      const ports = NODE_PORTS[fromType];
      if (ports?.out && (typeof fromPort !== 'string' || !ports.out.has(fromPort))) {
        errors.push({
          path: `$.graph.connections[${index}].fromPort`,
          rule: 'invalidConnection',
          message: `Connection '${String(connection.id)}' names an unsupported output port '${String(fromPort)}' for node type '${fromType}'.`,
        });
      }
    }
    if (toNode) {
      const toType = typeof toNode.type === 'string' ? toNode.type : '';
      const ports = NODE_PORTS[toType];
      if (ports?.in && (typeof toPort !== 'string' || !ports.in.has(toPort))) {
        errors.push({
          path: `$.graph.connections[${index}].toPort`,
          rule: 'invalidConnection',
          message: `Connection '${String(connection.id)}' names an unsupported input port '${String(toPort)}' for node type '${toType}'.`,
        });
      }
    }
  });

  const nodeIds = nodes.map((n) => n.id).filter((id): id is string => typeof id === 'string');
  const edges = connections
    .filter(
      (c): c is Record<string, unknown> & { fromNodeId: string; toNodeId: string } =>
        typeof c.fromNodeId === 'string' && typeof c.toNodeId === 'string',
    )
    .map((c) => ({ from: c.fromNodeId, to: c.toNodeId }));
  const cycleNode = findCycle(nodeIds, edges);
  if (cycleNode !== null) {
    errors.push({
      path: '$.graph.connections',
      rule: 'graphCycle',
      message: `Graph contains a cycle through node '${cycleNode}'.`,
    });
  }

  bindings.forEach((binding, index) => {
    const targetScope = typeof binding.targetScope === 'string' ? binding.targetScope : '';
    const targetProperty = typeof binding.targetProperty === 'string' ? binding.targetProperty : '';
    const allowed = ALLOWED_TARGET_PROPERTIES_BY_SCOPE[targetScope];
    if (!allowed || !allowed.has(targetProperty)) {
      errors.push({
        path: `$.bindings[${index}].targetProperty`,
        rule: 'invalidTargetChannel',
        message: `Binding '${String(binding.id)}' targets an unsupported channel '${targetProperty}' for scope '${targetScope}'.`,
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

// --- Evaluation helpers ------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Clamps `value` to `targetProperty`'s documented supported range.
 * Numeric channels clamp to `NUMERIC_TARGET_RANGES`; color channels pass
 * through only when they're already a well-formed hex color (otherwise
 * `null`, dropping the output rather than writing a malformed value).
 * Channels with no defined range (`palette`, `globalForce`, interaction
 * pulses) pass the value through unchanged — see the module doc comment's
 * note on why those aren't evaluated as continuous outputs today. */
function clampToTargetRange(
  targetProperty: string,
  value: number | string,
): number | string | null {
  const numericRange = NUMERIC_TARGET_RANGES[targetProperty];
  if (numericRange) {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) return null;
    return clamp(numeric, numericRange[0], numericRange[1]);
  }
  if (COLOR_TARGET_PROPERTIES.has(targetProperty)) {
    return typeof value === 'string' && COLOR_PATTERN.test(value) ? value : null;
  }
  return value;
}

function toNumericSignal(value: RuntimeSignalValue | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return null;
}

type Mapping = { inMin: number; inMax: number; outMin: number; outMax: number };

function readMapping(binding: Record<string, unknown>): Mapping | null {
  const m = asRecord(binding.mapping);
  const { inMin, inMax, outMin, outMax } = m;
  if (
    typeof inMin === 'number' &&
    typeof inMax === 'number' &&
    typeof outMin === 'number' &&
    typeof outMax === 'number' &&
    inMax !== inMin
  ) {
    return { inMin, inMax, outMin, outMax };
  }
  return null;
}

function applyMapping(raw: number, mapping: Mapping | null): number {
  if (!mapping) return raw;
  const t = clamp((raw - mapping.inMin) / (mapping.inMax - mapping.inMin), 0, 1);
  return mapping.outMin + t * (mapping.outMax - mapping.outMin);
}

function isEventSignal(signal: unknown): boolean {
  return typeof signal === 'string' && signal.startsWith('event:');
}

type SmoothingState = { value: number; lastTimestamp: number };

type EventState = { lastFiredAt: number | null; firedTimestamps: number[] };

/**
 * Creates a bounded behavior-graph runtime for `scene`. Validates
 * `scene.bindings`/`scene.graph` immediately (via `validateBehaviorGraph`)
 * and throws `BehaviorGraphValidationError` if invalid — a caller must
 * fix the scene and construct a new runtime rather than calling `tick` on
 * an unvalidated one. This is what satisfies "rejected before execution":
 * an invalid graph never gets as far as a single `tick()` call.
 */
export function createBehaviorRuntime(
  scene: SceneDocument,
  options: BehaviorRuntimeOptions = {},
): BehaviorRuntime {
  const validation = validateBehaviorGraph(scene);
  if (!validation.valid) throw new BehaviorGraphValidationError(validation.errors);

  const workBudgetMs = options.workBudgetMs ?? DEFAULT_WORK_BUDGET_MS;
  const eventCooldownMs = options.eventCooldownMs ?? DEFAULT_EVENT_COOLDOWN_MS;
  const maxEventsPerSecond = options.maxEventsPerSecond ?? DEFAULT_MAX_EVENTS_PER_SECOND;
  const perfNow =
    options.perfNow ??
    (typeof performance !== 'undefined' ? () => performance.now() : () => Date.now());

  const randomness = asRecord((scene as Record<string, unknown>).randomness);
  const seed = typeof randomness.seed === 'number' ? randomness.seed : 0;

  const bindings = sceneBindings(scene);
  const smoothingStateByBinding = new Map<string, SmoothingState>();
  const eventStateByBinding = new Map<string, EventState>();

  // --- Task 37: graph transform-chain execution -------------------------
  //
  // Precomputed once per runtime (the graph is immutable for the lifetime
  // of a `BehaviorRuntime` — a caller edits a scene and constructs a new
  // runtime, matching how `bindings` above is captured once too).
  const { nodes: graphNodesRaw, connections: graphConnectionsRaw } = sceneGraph(scene);
  const graphNodeById = new Map<string, Record<string, unknown>>();
  for (const node of graphNodesRaw) {
    if (typeof node.id === 'string') graphNodeById.set(node.id, node);
  }
  function incomingConnection(nodeId: string, toPort: string): Record<string, unknown> | undefined {
    return graphConnectionsRaw.find((c) => c.toNodeId === nodeId && c.toPort === toPort);
  }
  // Per-node persistent state for the two stateful transform types (Smooth,
  // Lerp) — keyed by graph node id, separate from `smoothingStateByBinding`
  // above since a graph `smooth` node and a binding's `smoothing` field are
  // independent features that happen to share an EMA formula.
  const smoothingStateByGraphNode = new Map<string, SmoothingState>();
  const lerpStateByGraphNode = new Map<string, number>();

  /** True for `input-<cardId>`/`action-<cardId>` node ids — the Task 34
   * card-owned graph fragment `graphFragmentForCard` writes alongside its
   * binding. See the module doc comment's "Scope" section (path 3) for why
   * these are excluded from graph-driven continuous evaluation: the
   * binding already produces the exact same output. */
  function isCardOwnedGraphNodeId(nodeId: string): boolean {
    return nodeId.startsWith('input-') || nodeId.startsWith('action-');
  }

  /** Recursively evaluates one graph node's numeric output for this tick,
   * memoized so a node feeding two downstream consumers (e.g. one `add`
   * input reused by two branches) is computed once. `scene.graph` is
   * guaranteed acyclic by `validateBehaviorGraph`'s `findCycle` check
   * (enforced before this runtime could ever be constructed), so this
   * recursion always terminates. See the "Transform node registry" doc
   * comment above `ALLOWED_NODE_TYPES_BY_FAMILY`/`NODE_PORTS` for each node
   * type's exact evaluation semantics. */
  function evaluateGraphNodeValue(
    nodeId: string,
    input: RuntimeInput,
    memo: Map<string, number | null>,
    skipSmoothing: boolean,
  ): number | null {
    const memoized = memo.get(nodeId);
    if (memoized !== undefined) return memoized;

    const node = graphNodeById.get(nodeId);
    if (!node) {
      memo.set(nodeId, null);
      return null;
    }

    const params = asRecord(node.params);
    const upstream = (port: string): number | null => {
      const connection = incomingConnection(nodeId, port);
      if (!connection || typeof connection.fromNodeId !== 'string') return null;
      return evaluateGraphNodeValue(connection.fromNodeId, input, memo, skipSmoothing);
    };

    let result: number | null;
    switch (node.type) {
      case 'handSignal': {
        const signalName = params.signal;
        result = typeof signalName === 'string' ? toNumericSignal(input.signals[signalName]) : null;
        break;
      }
      case 'mapRange':
        result = evaluateMapRange(upstream('in'), params);
        break;
      case 'clamp':
        result = evaluateClamp(upstream('in'), params);
        break;
      case 'invert':
        result = evaluateInvert(upstream('in'), params);
        break;
      case 'smooth': {
        const raw0 = upstream('in');
        const raw = raw0 !== null && Number.isFinite(raw0) ? raw0 : null;
        const smoothing = clamp(numberParam(params, 'smoothing', SMOOTH_DEFAULTS.smoothing), 0, 1);
        const prior = smoothingStateByGraphNode.get(nodeId);
        if (raw === null) {
          // Missing/non-finite input: hold the last computed value rather
          // than glitching downstream consumers to zero.
          result = prior ? prior.value : null;
        } else if (skipSmoothing || !prior) {
          // Cold start (no prior state) or a degraded tick: snap directly.
          result = raw;
          smoothingStateByGraphNode.set(nodeId, { value: result, lastTimestamp: input.timestamp });
        } else {
          const dt = Math.max(0, input.timestamp - prior.lastTimestamp);
          const effectiveAlpha = 1 - Math.pow(1 - smoothing, dt / REFERENCE_TICK_MS);
          result = prior.value + effectiveAlpha * (raw - prior.value);
          smoothingStateByGraphNode.set(nodeId, { value: result, lastTimestamp: input.timestamp });
        }
        break;
      }
      case 'add': {
        const a = upstream('inA');
        const b = upstream('inB');
        // An unconnected port defaults to 0 (additive identity); both
        // unconnected means no data source at all, so no output.
        result = a === null && b === null ? null : evaluateAdd(a ?? 0, b ?? 0);
        break;
      }
      case 'multiply': {
        const a = upstream('inA');
        const b = upstream('inB');
        // An unconnected port defaults to 1 (multiplicative identity).
        result = a === null && b === null ? null : evaluateMultiply(a ?? 1, b ?? 1);
        break;
      }
      case 'lerp': {
        const a = upstream('inA');
        const b = upstream('inB');
        const computed = evaluateLerp(a, b, params);
        if (computed !== null) {
          result = computed;
          lerpStateByGraphNode.set(nodeId, result);
        } else {
          // Missing/non-finite input: hold the last computed value (or
          // `null` if this node has never produced one yet).
          result = lerpStateByGraphNode.get(nodeId) ?? null;
        }
        break;
      }
      default:
        result = null;
    }

    memo.set(nodeId, result);
    return result;
  }

  /** Executes every hand-authored (non-card-owned) `visual`-family
   * `shapeProperty`/`groupProperty` node reachable through the graph's
   * transform chains, producing one `ContinuousOutput` per node with a
   * connected `in` port and a defined value this tick. See the module doc
   * comment's "Scope" section (path 3). */
  function evaluateGraphVisualOutputs(
    input: RuntimeInput,
    skipSmoothing: boolean,
  ): ContinuousOutput[] {
    const memo = new Map<string, number | null>();
    const outputs: ContinuousOutput[] = [];
    for (const node of graphNodesRaw) {
      if (typeof node.id !== 'string' || isCardOwnedGraphNodeId(node.id)) continue;
      if (node.type !== 'shapeProperty' && node.type !== 'groupProperty') continue;
      const connection = incomingConnection(node.id, 'in');
      if (!connection || typeof connection.fromNodeId !== 'string') continue;
      const value = evaluateGraphNodeValue(connection.fromNodeId, input, memo, skipSmoothing);
      if (value === null) continue;
      const params = asRecord(node.params);
      const targetProperty = typeof params.property === 'string' ? params.property : '';
      const clamped = clampToTargetRange(targetProperty, value);
      if (clamped === null) continue;
      outputs.push({
        bindingId: `graph:${node.id}`,
        targetScope: node.type === 'shapeProperty' ? 'shape' : 'group',
        targetId: typeof params.targetId === 'string' ? params.targetId : null,
        targetProperty,
        value: clamped,
      });
    }
    return outputs;
  }

  let lastTickExceededBudget = false;

  function evaluateContinuous(
    binding: Record<string, unknown>,
    input: RuntimeInput,
    skipSmoothing: boolean,
  ): ContinuousOutput | null {
    const signalName = binding.signal as string;
    const raw = toNumericSignal(input.signals[signalName]);
    if (raw === null) return null;

    const mapped = applyMapping(raw, readMapping(binding));

    const smoothing = typeof binding.smoothing === 'number' ? clamp(binding.smoothing, 0, 1) : 0;
    const bindingId = String(binding.id);
    let outputValue = mapped;
    if (smoothing > 0 && !skipSmoothing) {
      const prior = smoothingStateByBinding.get(bindingId);
      if (!prior) {
        outputValue = mapped;
      } else {
        const dt = Math.max(0, input.timestamp - prior.lastTimestamp);
        // Time-normalized EMA: converges at the same *rate per elapsed
        // millisecond* regardless of how far apart ticks land, matching
        // `tracking/handSignals.ts`'s EMA direction (higher `smoothing` =
        // faster response, less smoothing) but corrected for elapsed time
        // instead of assuming one call per animation frame. See the
        // module doc comment's "Numeric policy" section.
        const effectiveAlpha = 1 - Math.pow(1 - smoothing, dt / REFERENCE_TICK_MS);
        outputValue = prior.value + effectiveAlpha * (mapped - prior.value);
      }
      smoothingStateByBinding.set(bindingId, {
        value: outputValue,
        lastTimestamp: input.timestamp,
      });
    } else {
      // Smoothing disabled (0), or skipped this tick under degradation —
      // snap directly and discard any stale smoothing state so a later
      // recovered tick doesn't blend against a now-irrelevant value.
      smoothingStateByBinding.delete(bindingId);
    }

    const clamped = clampToTargetRange(binding.targetProperty as string, outputValue);
    if (clamped === null) return null;

    return {
      bindingId,
      targetScope: String(binding.targetScope),
      targetId: (binding.targetId as string | null) ?? null,
      targetProperty: String(binding.targetProperty),
      value: clamped,
    };
  }

  function evaluateEvent(
    binding: Record<string, unknown>,
    input: RuntimeInput,
  ): EventOutput | null {
    const signalName = binding.signal as string;
    if (!input.events.includes(signalName)) return null;

    const bindingId = String(binding.id);
    const state = eventStateByBinding.get(bindingId) ?? { lastFiredAt: null, firedTimestamps: [] };

    if (state.lastFiredAt !== null && input.timestamp - state.lastFiredAt < eventCooldownMs) {
      return null;
    }

    const windowStart = input.timestamp - 1000;
    const recentFirings = state.firedTimestamps.filter((t) => t > windowStart);
    if (recentFirings.length >= maxEventsPerSecond) {
      eventStateByBinding.set(bindingId, {
        lastFiredAt: state.lastFiredAt,
        firedTimestamps: recentFirings,
      });
      return null;
    }

    recentFirings.push(input.timestamp);
    eventStateByBinding.set(bindingId, {
      lastFiredAt: input.timestamp,
      firedTimestamps: recentFirings,
    });

    return {
      bindingId,
      targetScope: String(binding.targetScope),
      targetId: (binding.targetId as string | null) ?? null,
      targetProperty: String(binding.targetProperty),
      timestamp: input.timestamp,
    };
  }

  function tick(input: RuntimeInput): TickResult {
    const start = perfNow();
    const degraded = lastTickExceededBudget;
    const bindingsToEvaluate = degraded
      ? bindings.slice(0, Math.max(1, Math.ceil(bindings.length / 2)))
      : bindings;
    const droppedBindingCount = bindings.length - bindingsToEvaluate.length;

    const continuous: ContinuousOutput[] = [];
    const events: EventOutput[] = [];

    for (const binding of bindingsToEvaluate) {
      if (isEventSignal(binding.signal)) {
        const fired = evaluateEvent(binding, input);
        if (fired) events.push(fired);
      } else {
        const output = evaluateContinuous(binding, input, degraded);
        if (output) continuous.push(output);
      }
    }

    // Task 37: hand-authored graph transform chains (never a Task 34
    // card's own fragment — see `isCardOwnedGraphNodeId`), evaluated in
    // addition to the bindings above. Not subject to the degraded tick's
    // binding-count drop (that budget policy is about `bindings` priority
    // order specifically), but smoothing is still skipped on a degraded
    // tick, matching `evaluateContinuous`'s own degradation behavior.
    continuous.push(...evaluateGraphVisualOutputs(input, degraded));

    const evaluatedMs = perfNow() - start;
    const exceeded = evaluatedMs > workBudgetMs;
    lastTickExceededBudget = exceeded;

    const diagnostics: RuntimeDiagnostic[] = [];
    if (exceeded) {
      diagnostics.push({
        type: 'frameBudgetExceeded',
        message: `frame budget exceeded: ${bindings.length} bindings, evaluated in ${evaluatedMs.toFixed(2)}ms (budget ${workBudgetMs}ms)`,
        bindingCount: bindings.length,
        evaluatedMs,
        budgetMs: workBudgetMs,
      });
    }

    return {
      timestamp: input.timestamp,
      continuous,
      events,
      degraded,
      droppedBindingCount,
      evaluatedMs,
      diagnostics,
    };
  }

  return { tick, seed };
}

// --- Renderer wiring -----------------------------------------------------

/**
 * Applies one tick's continuous outputs onto a scene document, returning a
 * new `SceneDocument` (the input is never mutated) suitable for handing
 * straight to `render/p5Adapter.ts`'s `createP5ScenePreview().render()` —
 * the same pipeline Task 25 already uses for static scenes. Only
 * `shape`/`group` transform and style channels and the `scene`-scope
 * `backgroundColor` channel are wired to a visible effect today, matching
 * what `NUMERIC_TARGET_RANGES`/`COLOR_TARGET_PROPERTIES` actually clamp;
 * `interaction`-scope pulses (`events` on the `TickResult`) are not scene
 * mutations and are left for the caller to handle (e.g. triggering a
 * particle burst — Task 39).
 */
export function applyRuntimeOutputsToScene(
  scene: SceneDocument,
  continuous: readonly ContinuousOutput[],
): SceneDocument {
  if (continuous.length === 0) return scene;

  const record = scene as Record<string, unknown>;
  const shapes = Array.isArray(record.shapes)
    ? [...(record.shapes as Record<string, unknown>[])]
    : [];
  const groups = Array.isArray(record.groups)
    ? [...(record.groups as Record<string, unknown>[])]
    : [];
  const canvas = { ...asRecord(record.canvas) };
  let canvasChanged = false;

  function patchTransformOrStyle(
    list: Record<string, unknown>[],
    output: ContinuousOutput,
  ): Record<string, unknown>[] {
    const index = list.findIndex((item) => item.id === output.targetId);
    if (index === -1) return list;
    const next = [...list];
    const item = { ...next[index] };
    if (
      COLOR_TARGET_PROPERTIES.has(output.targetProperty) &&
      output.targetProperty !== 'backgroundColor'
    ) {
      item.style = { ...asRecord(item.style), [output.targetProperty]: output.value };
    } else {
      const field =
        output.targetProperty === 'positionX'
          ? 'x'
          : output.targetProperty === 'positionY'
            ? 'y'
            : output.targetProperty;
      item.transform = { ...asRecord(item.transform), [field]: output.value };
    }
    next[index] = item;
    return next;
  }

  let nextShapes = shapes;
  let nextGroups = groups;

  for (const output of continuous) {
    if (output.targetScope === 'shape') {
      nextShapes = patchTransformOrStyle(nextShapes, output);
    } else if (output.targetScope === 'group') {
      nextGroups = patchTransformOrStyle(nextGroups, output);
    } else if (output.targetScope === 'scene' && output.targetProperty === 'backgroundColor') {
      canvas.backgroundColor = output.value;
      canvasChanged = true;
    }
  }

  return {
    ...record,
    shapes: nextShapes,
    groups: nextGroups,
    ...(canvasChanged ? { canvas } : {}),
  } as SceneDocument;
}
