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
 * Multiply, Lerp — see the "Transform node registry" section below) and
 * Task 38 (condition/timing nodes: If/Else, Oscillator, Timer, Delay,
 * Cooldown — see the "Condition and timing node registry" section below)
 * have both landed. This runtime evaluates three paths:
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
 * 38 follows again below for its 5 condition/timing node types.
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
  // `timer`/`oscillator` (Task 38) join `handSignal`/`gestureEvent` here —
  // see the "Condition and timing node registry" doc comment below for why
  // they're `input`-family rather than `transform`: `_docs/plan.md`'s node
  // family list explicitly names "Timer" under Input, and both are
  // self-contained value *sources* (no `in` port) exactly like
  // `handSignal`/`gestureEvent`, not transforms of an upstream value.
  input: new Set(['handSignal', 'gestureEvent', 'timer', 'oscillator']),
  transform: new Set(['mapRange', 'clamp', 'smooth', 'invert', 'add', 'multiply', 'lerp']), // Task 37.
  condition: new Set(['ifElse']), // Task 38.
  visual: new Set(['shapeProperty', 'groupProperty', 'particleEmitter']),
  flow: new Set(['trigger', 'delay', 'cooldown']), // Task 38 adds delay/cooldown.
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
  // Task 38 condition/timing nodes. `timer`/`oscillator` are sources (no
  // `in` port), matching `handSignal`. `ifElse` carries one numeric `in`
  // port and *two* numeric output ports, `true`/`false` — both "value"
  // data type (a level, not an edge event; see the "Condition and timing
  // node registry" doc comment). `delay` is a single-port numeric
  // pass-through like the Task 37 transforms. `cooldown` gates an *event*,
  // matching `trigger`'s existing `in: {trigger}` event-port convention.
  timer: { out: new Set(['value']) },
  oscillator: { out: new Set(['value']) },
  ifElse: { in: new Set(['in']), out: new Set(['true', 'false']) },
  delay: { in: new Set(['in']), out: new Set(['out']) },
  cooldown: { in: new Set(['trigger']), out: new Set(['trigger']) },
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
 * `evaluateLerp`, `evaluateSmooth`) treats a `null` or non-finite
 * (`NaN`/`Infinity`) input uniformly: never propagate it downstream as
 * garbage — the "reject non-finite intermediate results" behavior applies
 * to all 7 node types, not only Add/Multiply, since any of them could
 * receive a non-finite upstream value in principle. `evaluateMapRange`
 * through `evaluateLerp` return `null` outright; `evaluateSmooth`, being
 * inherently stateful (see its own doc comment below), instead *holds*
 * its last computed value on a non-finite input rather than returning
 * `null` unconditionally — its own state-holding *and* Lerp's identical
 * policy (layered on top inside `evaluateGraphNodeValue`, the only place
 * that owns per-node state across ticks) are both documented above under
 * "Smooth"/"Lerp".
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

/** One time-normalized EMA step for a Smooth node's persisted state
 * (`value`/`lastTimestamp` across ticks). */
export type SmoothStepState = { value: number; lastTimestamp: number };

/** Smooth: a single time-normalized-EMA step, matching
 * `evaluateContinuous`'s binding-smoothing formula exactly (see the
 * "Numeric policy" section of the module doc comment). Unlike the other 6
 * transform node functions, Smooth is inherently stateful — it needs the
 * prior tick's `{value, lastTimestamp}` (or `null` on a cold start) to
 * compute a new value — so it returns both the value to emit this tick and
 * the state to persist for the next one; the caller (`evaluateGraphNodeValue`)
 * owns storing that state across ticks, this function has no side effects.
 *
 * - `raw === null` or non-finite (missing/non-finite input): holds the
 *   last computed value (`prior.value`), or `null` if nothing has ever been
 *   computed yet — the documented "missing input" policy from the
 *   "Transform node registry" doc comment.
 * - `prior === null` (cold start) or `skipSmoothing` (a degraded tick):
 *   snaps directly to `raw` with no blending — the documented
 *   "initialization" policy.
 * - Otherwise: blends `prior.value` toward `raw` using
 *   `effectiveAlpha = 1 - (1 - smoothing) ** (dt / REFERENCE_TICK_MS)`,
 *   where `smoothing` (unit interval, default `SMOOTH_DEFAULTS.smoothing`)
 *   follows the same "higher = less smoothing / faster response"
 *   convention as everywhere else in this module: `smoothing = 0` never
 *   moves off the prior value; `smoothing = 1` snaps fully to `raw` every
 *   tick (once `dt > 0`). */
export function evaluateSmooth(
  prior: SmoothStepState | null,
  raw: number | null,
  params: Record<string, unknown>,
  timestamp: number,
  skipSmoothing: boolean,
): { value: number | null; state: SmoothStepState | null } {
  const rawFinite = raw !== null && Number.isFinite(raw) ? raw : null;
  if (rawFinite === null) {
    return { value: prior ? prior.value : null, state: prior };
  }
  if (skipSmoothing || !prior) {
    const state: SmoothStepState = { value: rawFinite, lastTimestamp: timestamp };
    return { value: rawFinite, state };
  }
  const smoothing = clamp(numberParam(params, 'smoothing', SMOOTH_DEFAULTS.smoothing), 0, 1);
  const dt = Math.max(0, timestamp - prior.lastTimestamp);
  const effectiveAlpha = 1 - Math.pow(1 - smoothing, dt / REFERENCE_TICK_MS);
  const value = prior.value + effectiveAlpha * (rawFinite - prior.value);
  return { value, state: { value, lastTimestamp: timestamp } };
}

// --- Condition and timing node registry (Task 38) -----------------------

/**
 * Documented typed inputs/outputs/defaults/edge cases for the 5 V1
 * condition/timing node types (`_docs/plan.md`'s "Conditional logic" and
 * "Math and time nodes" sections): If/Else, Oscillator, Timer, Delay,
 * Cooldown. As with the Transform node registry above, `_docs/plan.md`
 * names these nodes and their qualitative behavior but gives no exact
 * numeric defaults, so every default below is this module's own documented
 * choice, consistent with numbers this codebase already picked for
 * adjacent concerns.
 *
 * ## Family assignment
 *
 * `_docs/plan.md`'s "Node families" list is the source of truth used here:
 * `Input: Hand signal, Gesture event, Timer, Demo control` and
 * `Flow: Trigger, Delay, Cooldown` are explicit. If/Else's family is
 * `condition` — `schema/scene.schema.json`'s own `graphNode.type` doc
 * comment gives `condition/ifElse` as its example, and
 * `schema/fixtures/valid/feature_rich.json` (Task 7's forward-looking
 * fixture) already uses `{ family: 'condition', type: 'ifElse' }`.
 * `Oscillator` is not named in any of plan.md's five family bullets; it is
 * placed in `input` here as this module's own documented choice, by the
 * same reasoning plan.md gives for Timer: like `handSignal`/`gestureEvent`/
 * `timer`, an oscillator has no upstream `in` port — it is a self-contained
 * value *source* driven only by elapsed time, structurally identical to
 * Timer, not a transform of an existing signal.
 *
 * ## Elapsed-timestamp policy (frame-rate independence)
 *
 * Every one of these 5 node types (like the module's "Clock model" section
 * already requires for bindings) derives its output *only* from
 * `RuntimeInput.timestamp` and its own persisted state's timestamps — never
 * from a tick counter, `Date.now()`, or an assumed frame interval. Oscillator
 * and Timer are the strongest case: both are pure functions of
 * `(timestamp, params)` with *no* per-node state at all, so "the same
 * elapsed timestamp produces the same value regardless of how many ticks
 * ran before it, or how far apart they were spaced" is true by
 * construction, not by careful bookkeeping — see `behaviorRuntime.test.ts`'s
 * "frame-rate independence" tests for the explicit 30fps-equivalent vs
 * 60fps-equivalent check the issue calls for.
 *
 * ## If/Else (`ifElse`, family `condition`)
 *
 * One input port `in` (numeric), two output ports `true`/`false` (both
 * numeric "value" ports, a *level* not an edge event: the active branch
 * emits `1` every tick the condition holds post-debounce; the inactive
 * branch emits `null`, i.e. no output that tick — this lets a downstream
 * node display/act on "condition currently true" without maintaining its
 * own extra state). Exactly one condition per node, never chained/nested
 * (enforced by `validateBehaviorGraph`'s "no condition feeds another
 * condition" rule below) — the V1 boundary from issue #38's constraints.
 *
 * Params: `comparison` (one of the four plan.md-documented comparisons:
 * `'greaterThan' | 'lessThan' | 'between' | 'approximately'`, default
 * `'greaterThan'`), `threshold` (finite number, default `0`, used by
 * `greaterThan`/`lessThan`/`approximately`), `min`/`max` (finite numbers,
 * default `0`/`1`, used by `between`; `min <= max` required, same
 * invariant as Task 37's Clamp/Invert), `tolerance` (finite number `>= 0`,
 * default `0.05`, used by `approximately`), `holdTimeMs` (finite number
 * `>= 0`, default `150` — reusing `twoHandSignals.ts`'s exact documented
 * `holdTimeMs` default and rationale: "long enough to absorb a few frames
 * of tracking jitter ... without feeling laggy", the acceptance criterion's
 * "documented debounce or hold-time configuration").
 *
 * **Comparison semantics** (boundary is always exact, no implicit
 * epsilon): `greaterThan`: `value > threshold` (equality is `false`);
 * `lessThan`: `value < threshold` (equality is `false`); `between`:
 * `min <= value <= max` (both boundaries included); `approximately`:
 * `abs(value - threshold) <= tolerance` (boundary included).
 *
 * **Debounce/hold-time model** — identical in spirit to
 * `twoHandSignals.ts`'s hysteresis hold time, adapted to If/Else's single
 * boolean target instead of a three-state close/far/neutral target: each
 * tick computes an instantaneous target state from the comparison above.
 * If the target matches the already-*committed* state, nothing changes. If
 * it differs, it becomes (or remains) a *candidate*; the candidate must be
 * the target on every consecutive valid-input tick for at least
 * `holdTimeMs` before it is promoted to committed (a target that reverts to
 * the current committed state, or changes to a different candidate, resets
 * the hold timer — exactly `twoHandSignals.ts`'s rule). `holdTimeMs: 0`
 * commits immediately. This is what "avoid boundary flicker" means here: a
 * value oscillating around the threshold faster than `holdTimeMs` never
 * flips the committed output.
 *
 * **Missing input** (`in` absent/non-finite this tick): holds the last
 * committed state (or `null`/no-output-on-either-branch if nothing has ever
 * committed) and does not touch the debounce timer — the same
 * "hold rather than glitch" policy `evaluateSmooth` uses.
 *
 * ## Oscillator (`oscillator`, family `input`)
 *
 * No input port; one output port `value`. Params: `shape`
 * (`'sine' | 'triangle' | 'square'`, default `'sine'`), `periodMs` (finite
 * number `> 0`, default `1000`), `amplitude` (finite number, default `1`),
 * `offset` (finite number, default `0`), `phaseOffsetMs` (finite number,
 * default `0`). `phase = ((timestamp + phaseOffsetMs) mod periodMs) /
 * periodMs` (always `[0, 1)`); `value = offset + amplitude * waveform(phase)`
 * where `waveform` is `sin(2*PI*phase)` for `sine`, a piecewise linear ramp
 * from `-1` (phase 0) to `1` (phase 0.5) back to `-1` (phase 1) for
 * `triangle`, and `phase < 0.5 ? 1 : -1` for `square`. Being a pure function
 * of `timestamp` with no persisted state, it is trivially frame-rate
 * independent (see above).
 *
 * ## Timer (`timer`, family `input`)
 *
 * No input port; one output port `value`. Params: `mode`
 * (`'elapsed' | 'loop' | 'countdown'`, default `'elapsed'`), `periodMs`
 * (finite number `> 0`, default `1000`, used by `loop`), `durationMs`
 * (finite number `> 0`, default `5000`, used by `countdown`). A Timer's
 * elapsed time is `RuntimeInput.timestamp` itself — i.e. a Timer node
 * measures time since the runtime's own clock reference (timestamp `0`),
 * matching every other elapsed-timestamp calculation in this module (which
 * never reads a wall clock); this module's own documented choice for "when
 * does a timer start" in the absence of a dedicated start/reset input,
 * which is out of V1's scope.
 * - `'elapsed'`: `value = timestamp` (raw elapsed milliseconds, unbounded).
 * - `'loop'` ("looped phase" from `_docs/plan.md`): `value = timestamp mod
 *   periodMs`, wrapping back toward `0` every `periodMs` — the documented
 *   "timer wrap" behavior the acceptance criteria calls for.
 * - `'countdown'`: `value = max(0, durationMs - timestamp)`, counting down
 *   and then holding exactly at `0` once `timestamp >= durationMs` — the
 *   documented "countdown completion" behavior.
 *
 * ## Delay (`delay`, family `flow`)
 *
 * One input port `in`, one output port `out` (both numeric). Params:
 * `delayMs` (finite number `>= 0`, default `300` — this module's own
 * documented choice, roughly double `DEFAULT_EVENT_COOLDOWN_MS`/
 * `holdTimeMs`'s `150`, since Delay is meant for a deliberate pause rather
 * than jitter absorption). Stateful "gated pass-through": the node tracks a
 * *pending* value and the timestamp it first appeared. Once the pending
 * value has been continuously pending for `delayMs`, it becomes the
 * *committed* output value (emitted from that tick onward until superseded).
 * **A value changing again before the delay completes restarts the delay**
 * from the new value (the documented policy the acceptance criteria calls
 * for) — the node never emits a value that didn't survive the full
 * `delayMs` unchanged. Exact-boundary elapsed time (`elapsed === delayMs`)
 * commits (`>=`), matching If/Else's inclusive-boundary convention. Missing
 * input holds the last committed value (or `null` before any commit),
 * without disturbing the pending timer, matching Smooth/Lerp's
 * missing-input policy.
 *
 * ## Cooldown (`cooldown`, family `flow`)
 *
 * One input port `trigger`, one output port `trigger` (both "event" data
 * type, matching the existing `trigger` node's convention — see
 * `graphEditing.ts`'s `PORT_DATA_TYPES`). Params: `milliseconds` (finite
 * number `>= 0`, default `500`, matching the param name
 * `schema/fixtures/valid/feature_rich.json`'s forward-looking `cooldown`
 * node example already used). An **event gate**: a trigger attempt passes
 * through only if at least `milliseconds` have elapsed since the last
 * attempt that passed through; a suppressed attempt during the cooldown
 * window **does not reset the cooldown clock** — the next attempt is still
 * measured from the last successful firing, not from the suppressed one
 * (the acceptance criteria's "should not double-fire or reset
 * unexpectedly"). Like `trigger`/`particleEmitter`, event-typed graph nodes
 * are validated structurally but not yet executed end to end by `tick()`
 * (see the module doc comment's "Scope" section — triggered particle
 * bursts etc. are Task 39 territory); `evaluateCooldown` below is instead
 * a directly unit-tested pure-plus-state function, exercised the same way
 * `evaluateSmooth`'s table-driven tests exercise it without requiring a
 * full render pipeline.
 */
export const IF_ELSE_DEFAULTS = {
  comparison: 'greaterThan' as const,
  threshold: 0,
  min: 0,
  max: 1,
  tolerance: 0.05,
  holdTimeMs: 150,
};
export const OSCILLATOR_DEFAULTS = {
  shape: 'sine' as const,
  periodMs: 1000,
  amplitude: 1,
  offset: 0,
  phaseOffsetMs: 0,
};
export const TIMER_DEFAULTS = { mode: 'elapsed' as const, periodMs: 1000, durationMs: 5000 };
export const DELAY_DEFAULTS = { delayMs: 300 };
export const COOLDOWN_DEFAULTS = { milliseconds: 500 };

const IF_ELSE_COMPARISONS = new Set(['greaterThan', 'lessThan', 'between', 'approximately']);
const OSCILLATOR_SHAPES = new Set(['sine', 'triangle', 'square']);
const TIMER_MODES = new Set(['elapsed', 'loop', 'countdown']);

/** Validates one `input`-family node's params beyond schema shape:
 * `oscillator`/`timer`'s enum/finite/positive invariants documented above
 * (`handSignal`/`gestureEvent` have no extra invariants to check today).
 * Wired into `validateBehaviorGraph` the same way
 * `validateTransformNodeParams` is for `transform`. */
export function validateInputNodeParams(
  type: string,
  params: Record<string, unknown>,
): string | null {
  switch (type) {
    case 'oscillator': {
      if (
        params.shape !== undefined &&
        (typeof params.shape !== 'string' || !OSCILLATOR_SHAPES.has(params.shape))
      ) {
        return `'shape' must be one of 'sine', 'triangle', 'square'.`;
      }
      for (const key of ['periodMs', 'amplitude', 'offset', 'phaseOffsetMs']) {
        if (params[key] !== undefined && !isFiniteNumberParam(params[key])) {
          return `'${key}' must be a finite number.`;
        }
      }
      const periodMs = numberParam(params, 'periodMs', OSCILLATOR_DEFAULTS.periodMs);
      if (periodMs <= 0) return `'periodMs' (${periodMs}) must be greater than 0.`;
      return null;
    }
    case 'timer': {
      if (
        params.mode !== undefined &&
        (typeof params.mode !== 'string' || !TIMER_MODES.has(params.mode))
      ) {
        return `'mode' must be one of 'elapsed', 'loop', 'countdown'.`;
      }
      for (const key of ['periodMs', 'durationMs']) {
        if (params[key] !== undefined && !isFiniteNumberParam(params[key])) {
          return `'${key}' must be a finite number.`;
        }
      }
      const periodMs = numberParam(params, 'periodMs', TIMER_DEFAULTS.periodMs);
      if (periodMs <= 0) return `'periodMs' (${periodMs}) must be greater than 0.`;
      const durationMs = numberParam(params, 'durationMs', TIMER_DEFAULTS.durationMs);
      if (durationMs <= 0) return `'durationMs' (${durationMs}) must be greater than 0.`;
      return null;
    }
    default:
      return null;
  }
}

/** Validates one `condition`-family node's params: If/Else's
 * comparison/threshold/min/max/tolerance/holdTimeMs invariants documented
 * above. Wired into `validateBehaviorGraph` for `family === 'condition'`. */
export function validateConditionNodeParams(
  type: string,
  params: Record<string, unknown>,
): string | null {
  switch (type) {
    case 'ifElse': {
      if (
        params.comparison !== undefined &&
        (typeof params.comparison !== 'string' || !IF_ELSE_COMPARISONS.has(params.comparison))
      ) {
        return `'comparison' must be one of 'greaterThan', 'lessThan', 'between', 'approximately'.`;
      }
      for (const key of ['threshold', 'min', 'max', 'tolerance', 'holdTimeMs']) {
        if (params[key] !== undefined && !isFiniteNumberParam(params[key])) {
          return `'${key}' must be a finite number.`;
        }
      }
      const min = numberParam(params, 'min', IF_ELSE_DEFAULTS.min);
      const max = numberParam(params, 'max', IF_ELSE_DEFAULTS.max);
      if (min > max) return `'min' (${min}) must not be greater than 'max' (${max}).`;
      const tolerance = numberParam(params, 'tolerance', IF_ELSE_DEFAULTS.tolerance);
      if (tolerance < 0) return `'tolerance' (${tolerance}) must not be negative.`;
      const holdTimeMs = numberParam(params, 'holdTimeMs', IF_ELSE_DEFAULTS.holdTimeMs);
      if (holdTimeMs < 0) return `'holdTimeMs' (${holdTimeMs}) must not be negative.`;
      return null;
    }
    default:
      return null;
  }
}

/** Validates one `flow`-family node's params: Delay's `delayMs` and
 * Cooldown's `milliseconds`, both required non-negative (invalid timing
 * values, e.g. a negative delay/cooldown, are rejected here before any
 * tick runs). `trigger` (Task 34/35) has no configurable params today.
 * Wired into `validateBehaviorGraph` for `family === 'flow'`. */
export function validateFlowNodeParams(
  type: string,
  params: Record<string, unknown>,
): string | null {
  switch (type) {
    case 'delay': {
      if (params.delayMs !== undefined && !isFiniteNumberParam(params.delayMs)) {
        return `'delayMs' must be a finite number.`;
      }
      const delayMs = numberParam(params, 'delayMs', DELAY_DEFAULTS.delayMs);
      if (delayMs < 0) return `'delayMs' (${delayMs}) must not be negative.`;
      return null;
    }
    case 'cooldown': {
      if (params.milliseconds !== undefined && !isFiniteNumberParam(params.milliseconds)) {
        return `'milliseconds' must be a finite number.`;
      }
      const milliseconds = numberParam(params, 'milliseconds', COOLDOWN_DEFAULTS.milliseconds);
      if (milliseconds < 0) return `'milliseconds' (${milliseconds}) must not be negative.`;
      return null;
    }
    default:
      return null; // 'trigger': no configurable params.
  }
}

/** Pure comparison for one If/Else node: see the "If/Else" doc section
 * above for exact per-comparison boundary semantics. Returns `null` only
 * for an unrecognized `comparison` value (never reachable once
 * `validateConditionNodeParams` has passed). */
export function evaluateComparison(value: number, params: Record<string, unknown>): boolean | null {
  const comparison =
    typeof params.comparison === 'string' ? params.comparison : IF_ELSE_DEFAULTS.comparison;
  switch (comparison) {
    case 'greaterThan':
      return value > numberParam(params, 'threshold', IF_ELSE_DEFAULTS.threshold);
    case 'lessThan':
      return value < numberParam(params, 'threshold', IF_ELSE_DEFAULTS.threshold);
    case 'between': {
      const min = numberParam(params, 'min', IF_ELSE_DEFAULTS.min);
      const max = numberParam(params, 'max', IF_ELSE_DEFAULTS.max);
      return value >= min && value <= max;
    }
    case 'approximately': {
      const threshold = numberParam(params, 'threshold', IF_ELSE_DEFAULTS.threshold);
      const tolerance = numberParam(params, 'tolerance', IF_ELSE_DEFAULTS.tolerance);
      return Math.abs(value - threshold) <= tolerance;
    }
    default:
      return null;
  }
}

/** One If/Else node's persisted debounce state — see the "If/Else" doc
 * section's "Debounce/hold-time model" above. */
export type IfElseState = {
  committed: boolean | null;
  candidate: boolean | null;
  candidateSince: number | null;
};

/** If/Else: one hold-time-debounced comparison step. `raw === null` or
 * non-finite (missing input) holds `prior.committed` without touching the
 * debounce timer. Otherwise computes the instantaneous target via
 * `evaluateComparison` and applies the hold-time state machine documented
 * above. Returns the value to emit this tick (`state`, `null` before
 * anything has ever committed) and the state to persist for the next tick
 * (`persist`) — the caller (`evaluateGraphNodeValue`) owns storing it
 * across ticks, matching `evaluateSmooth`'s pattern exactly. */
export function evaluateIfElseState(
  prior: IfElseState | null,
  raw: number | null,
  params: Record<string, unknown>,
  timestamp: number,
): { state: boolean | null; persist: IfElseState } {
  const base: IfElseState = prior ?? { committed: null, candidate: null, candidateSince: null };
  if (raw === null || !Number.isFinite(raw)) {
    return { state: base.committed, persist: base };
  }
  const holdTimeMs = Math.max(0, numberParam(params, 'holdTimeMs', IF_ELSE_DEFAULTS.holdTimeMs));
  const target = evaluateComparison(raw, params);
  if (target === base.committed) {
    return {
      state: base.committed,
      persist: { committed: base.committed, candidate: null, candidateSince: null },
    };
  }
  // A candidate already timing toward this same target keeps its original
  // `candidateSince`; a brand-new (or different) candidate starts timing
  // from *this* tick — checked against `holdTimeMs` in the same tick it's
  // set, so `holdTimeMs: 0` commits immediately (elapsed `0 >= 0`) rather
  // than requiring one extra tick to notice it already qualifies.
  const candidateSince =
    base.candidate === target && base.candidateSince !== null ? base.candidateSince : timestamp;
  const elapsed = timestamp - candidateSince;
  if (elapsed >= holdTimeMs) {
    return { state: target, persist: { committed: target, candidate: null, candidateSince: null } };
  }
  return {
    state: base.committed,
    persist: { committed: base.committed, candidate: target, candidateSince },
  };
}

/** Oscillator: pure function of elapsed time — see the "Oscillator" doc
 * section above for the exact waveform formulas. No persisted state, so
 * frame-rate independence is automatic. */
export function evaluateOscillator(timestamp: number, params: Record<string, unknown>): number {
  const periodMs = numberParam(params, 'periodMs', OSCILLATOR_DEFAULTS.periodMs);
  const amplitude = numberParam(params, 'amplitude', OSCILLATOR_DEFAULTS.amplitude);
  const offset = numberParam(params, 'offset', OSCILLATOR_DEFAULTS.offset);
  const phaseOffsetMs = numberParam(params, 'phaseOffsetMs', OSCILLATOR_DEFAULTS.phaseOffsetMs);
  const shape = typeof params.shape === 'string' ? params.shape : OSCILLATOR_DEFAULTS.shape;

  const shiftedMs = timestamp + phaseOffsetMs;
  const wrappedMs = ((shiftedMs % periodMs) + periodMs) % periodMs;
  const phase = wrappedMs / periodMs;

  let wave: number;
  switch (shape) {
    case 'triangle':
      wave = phase < 0.5 ? -1 + 4 * phase : 3 - 4 * phase;
      break;
    case 'square':
      wave = phase < 0.5 ? 1 : -1;
      break;
    case 'sine':
    default:
      wave = Math.sin(2 * Math.PI * phase);
      break;
  }
  return offset + amplitude * wave;
}

/** Timer: pure function of elapsed time — see the "Timer" doc section
 * above for the exact per-mode formula (`elapsed`/`loop`/`countdown`). No
 * persisted state, so frame-rate independence is automatic. */
export function evaluateTimer(timestamp: number, params: Record<string, unknown>): number {
  const mode = typeof params.mode === 'string' ? params.mode : TIMER_DEFAULTS.mode;
  switch (mode) {
    case 'loop': {
      const periodMs = numberParam(params, 'periodMs', TIMER_DEFAULTS.periodMs);
      return ((timestamp % periodMs) + periodMs) % periodMs;
    }
    case 'countdown': {
      const durationMs = numberParam(params, 'durationMs', TIMER_DEFAULTS.durationMs);
      return Math.max(0, durationMs - timestamp);
    }
    case 'elapsed':
    default:
      return timestamp;
  }
}

/** One Delay node's persisted state — see the "Delay" doc section above. */
export type DelayState = {
  pendingValue: number | null;
  pendingSince: number | null;
  committedValue: number | null;
};

/** Delay: one elapsed-timestamp-gated pass-through step. `raw === null` or
 * non-finite (missing input) holds `prior.committedValue` and leaves the
 * pending timer untouched. A `raw` that differs from the currently pending
 * value (re)starts the pending timer at `timestamp` (documented
 * "value changing again before the delay completes" policy). Once the
 * pending value has been pending for `>= delayMs`, it is committed and
 * emitted. */
export function evaluateDelay(
  prior: DelayState | null,
  raw: number | null,
  timestamp: number,
  params: Record<string, unknown>,
): { value: number | null; state: DelayState } {
  const base: DelayState = prior ?? {
    pendingValue: null,
    pendingSince: null,
    committedValue: null,
  };
  if (raw === null || !Number.isFinite(raw)) {
    return { value: base.committedValue, state: base };
  }
  const delayMs = Math.max(0, numberParam(params, 'delayMs', DELAY_DEFAULTS.delayMs));
  const pendingSince =
    base.pendingValue === raw && base.pendingSince !== null ? base.pendingSince : timestamp;
  const elapsed = timestamp - pendingSince;
  if (elapsed >= delayMs) {
    return {
      value: raw,
      state: { pendingValue: raw, pendingSince, committedValue: raw },
    };
  }
  return {
    value: base.committedValue,
    state: { pendingValue: raw, pendingSince, committedValue: base.committedValue },
  };
}

/** One Cooldown node's persisted state — see the "Cooldown" doc section
 * above. */
export type CooldownState = { lastFiredAt: number | null };

/** Cooldown: one elapsed-timestamp-gated event-gate step. `triggered`
 * (whether a trigger attempt occurred this tick) fires (`fired: true`)
 * only if no prior firing exists, or at least `milliseconds` have elapsed
 * since the last successful firing. A suppressed attempt during the
 * cooldown window does not update `lastFiredAt` — the cooldown clock is
 * never reset by a suppressed attempt, only by a successful firing. */
export function evaluateCooldown(
  prior: CooldownState | null,
  triggered: boolean,
  timestamp: number,
  params: Record<string, unknown>,
): { fired: boolean; state: CooldownState } {
  const base: CooldownState = prior ?? { lastFiredAt: null };
  if (!triggered) return { fired: false, state: base };
  const milliseconds = Math.max(
    0,
    numberParam(params, 'milliseconds', COOLDOWN_DEFAULTS.milliseconds),
  );
  if (base.lastFiredAt === null || timestamp - base.lastFiredAt >= milliseconds) {
    return { fired: true, state: { lastFiredAt: timestamp } };
  }
  return { fired: false, state: base };
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
    // Per-family param validation (Task 37 for `transform`, Task 38 for
    // `input`/`condition`/`flow`) — one dispatcher per family rather than a
    // single giant switch, so each family's validator stays independently
    // readable and each is wired into this one pathway, never a second
    // validation path a caller could bypass.
    let paramError: string | null = null;
    if (family === 'transform') {
      paramError = validateTransformNodeParams(type, asRecord(node.params));
    } else if (family === 'input') {
      paramError = validateInputNodeParams(type, asRecord(node.params));
    } else if (family === 'condition') {
      paramError = validateConditionNodeParams(type, asRecord(node.params));
    } else if (family === 'flow') {
      paramError = validateFlowNodeParams(type, asRecord(node.params));
    }
    if (paramError) {
      errors.push({
        path: `$.graph.nodes[${index}].params`,
        rule: 'invalidNodeParams',
        message: `Graph node '${id}' (${type}): ${paramError}`,
      });
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

  // Task 38: "no nested/chained condition trees" — one If/Else's `in` may
  // never (directly or indirectly, through any number of intermediate
  // nodes) be fed by another If/Else's output. This is a directed
  // *reachability* check distinct from `findCycle` above (the graph is
  // already known acyclic at this point, so a plain forward walk from each
  // condition node always terminates); it reuses the same `nodeIds`/`edges`
  // this function already built for the cycle check rather than
  // reimplementing adjacency a second time.
  if (cycleNode === null) {
    const conditionNodeIds = new Set(
      nodeIds.filter((nodeId) => nodeById.get(nodeId)?.family === 'condition'),
    );
    if (conditionNodeIds.size > 0) {
      const adjacency = new Map<string, string[]>();
      for (const id of nodeIds) adjacency.set(id, []);
      for (const edge of edges) {
        if (adjacency.has(edge.from)) adjacency.get(edge.from)!.push(edge.to);
      }
      for (const conditionId of conditionNodeIds) {
        const seen = new Set<string>();
        const stack = [...(adjacency.get(conditionId) ?? [])];
        let chainsToAnotherCondition = false;
        while (stack.length > 0) {
          const next = stack.pop()!;
          if (seen.has(next)) continue;
          seen.add(next);
          if (conditionNodeIds.has(next)) {
            chainsToAnotherCondition = true;
            break;
          }
          stack.push(...(adjacency.get(next) ?? []));
        }
        if (chainsToAnotherCondition) {
          errors.push({
            path: '$.graph.connections',
            rule: 'chainedConditionNode',
            message: `Graph node '${conditionId}' (condition) feeds into another condition node — chained/nested condition trees are not supported in V1; If/Else supports exactly one condition per node.`,
          });
          break;
        }
      }
    }
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
  // Task 38: per-node persistent state for If/Else's debounce and Delay's
  // pending/committed value — same "keyed by graph node id, owned only by
  // this runtime instance" pattern as the two maps above.
  const ifElseStateByGraphNode = new Map<string, IfElseState>();
  const delayStateByGraphNode = new Map<string, DelayState>();

  /** True for `input-<cardId>`/`action-<cardId>` node ids — the Task 34
   * card-owned graph fragment `graphFragmentForCard` writes alongside its
   * binding. See the module doc comment's "Scope" section (path 3) for why
   * these are excluded from graph-driven continuous evaluation: the
   * binding already produces the exact same output. */
  function isCardOwnedGraphNodeId(nodeId: string): boolean {
    return nodeId.startsWith('input-') || nodeId.startsWith('action-');
  }

  /** Recursively evaluates one graph node output *port*'s numeric value for
   * this tick, memoized (keyed by `nodeId::port`) so a node feeding two
   * downstream consumers (e.g. one `add` input reused by two branches) is
   * computed once. `scene.graph` is guaranteed acyclic by
   * `validateBehaviorGraph`'s `findCycle` check (enforced before this
   * runtime could ever be constructed), so this recursion always
   * terminates. Every node type before Task 38 has exactly one output
   * port, so `port` is irrelevant to them and only distinguishes memo
   * entries; If/Else (Task 38) is the first node with *two* named output
   * ports (`true`/`false`) whose values genuinely differ, which is why
   * `port` is threaded through `upstream`/the recursive call at all. See
   * the "Transform node registry" and "Condition and timing node
   * registry" doc comments above `ALLOWED_NODE_TYPES_BY_FAMILY`/
   * `NODE_PORTS` for each node type's exact evaluation semantics.
   * `ifElseDecisions` caches each If/Else node's *single* per-tick
   * comparison/debounce decision (computed at most once per tick
   * regardless of whether `true`, `false`, or both output ports are
   * queried), keeping its stateful debounce update from double-firing. */
  function evaluateGraphNodeValue(
    nodeId: string,
    port: string,
    input: RuntimeInput,
    memo: Map<string, number | null>,
    skipSmoothing: boolean,
    ifElseDecisions: Map<string, boolean | null>,
  ): number | null {
    const memoKey = `${nodeId}::${port}`;
    const memoized = memo.get(memoKey);
    if (memoized !== undefined) return memoized;

    const node = graphNodeById.get(nodeId);
    if (!node) {
      memo.set(memoKey, null);
      return null;
    }

    const params = asRecord(node.params);
    const upstream = (inPort: string): number | null => {
      const connection = incomingConnection(nodeId, inPort);
      if (!connection || typeof connection.fromNodeId !== 'string') return null;
      const fromPort = typeof connection.fromPort === 'string' ? connection.fromPort : '';
      return evaluateGraphNodeValue(
        connection.fromNodeId,
        fromPort,
        input,
        memo,
        skipSmoothing,
        ifElseDecisions,
      );
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
        const prior = smoothingStateByGraphNode.get(nodeId) ?? null;
        const step = evaluateSmooth(prior, upstream('in'), params, input.timestamp, skipSmoothing);
        result = step.value;
        if (step.state) smoothingStateByGraphNode.set(nodeId, step.state);
        else smoothingStateByGraphNode.delete(nodeId);
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
      // --- Task 38 condition/timing nodes ---------------------------
      case 'oscillator':
        result = evaluateOscillator(input.timestamp, params);
        break;
      case 'timer':
        result = evaluateTimer(input.timestamp, params);
        break;
      case 'delay': {
        const prior = delayStateByGraphNode.get(nodeId) ?? null;
        const step = evaluateDelay(prior, upstream('in'), input.timestamp, params);
        result = step.value;
        delayStateByGraphNode.set(nodeId, step.state);
        break;
      }
      case 'ifElse': {
        let decision = ifElseDecisions.get(nodeId);
        if (decision === undefined) {
          const raw = upstream('in');
          const prior = ifElseStateByGraphNode.get(nodeId) ?? null;
          const step = evaluateIfElseState(prior, raw, params, input.timestamp);
          decision = step.state;
          ifElseDecisions.set(nodeId, decision);
          ifElseStateByGraphNode.set(nodeId, step.persist);
        }
        // Level output: the active branch emits `1`, the inactive branch
        // (and any tick with no committed decision yet) emits `null`.
        result =
          (port === 'true' && decision === true) || (port === 'false' && decision === false)
            ? 1
            : null;
        break;
      }
      default:
        result = null;
    }

    memo.set(memoKey, result);
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
    // Task 38: fresh per tick, so an If/Else node's debounce state updates
    // at most once per tick regardless of how many downstream nodes query
    // its `true`/`false` ports — see `evaluateGraphNodeValue`'s doc comment.
    const ifElseDecisions = new Map<string, boolean | null>();
    const outputs: ContinuousOutput[] = [];
    for (const node of graphNodesRaw) {
      if (typeof node.id !== 'string' || isCardOwnedGraphNodeId(node.id)) continue;
      if (node.type !== 'shapeProperty' && node.type !== 'groupProperty') continue;
      const connection = incomingConnection(node.id, 'in');
      if (!connection || typeof connection.fromNodeId !== 'string') continue;
      const fromPort = typeof connection.fromPort === 'string' ? connection.fromPort : '';
      const value = evaluateGraphNodeValue(
        connection.fromNodeId,
        fromPort,
        input,
        memo,
        skipSmoothing,
        ifElseDecisions,
      );
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
