import { afterEach, describe, expect, it } from 'vitest';

import {
  bindingForCard,
  graphFragmentForCard,
  type FollowHandCard,
  type PulseCard,
  type ReactToPinchCard,
} from '../pages/behaviorCards';
import { createP5ScenePreview } from '../render/p5Adapter';
import { baseScene, circleShape } from '../render/testSceneFixtures';
import {
  applyRuntimeOutputsToScene,
  BehaviorGraphValidationError,
  createBehaviorRuntime,
  DEFAULT_EVENT_COOLDOWN_MS,
  evaluateAdd,
  evaluateClamp,
  evaluateComparison,
  evaluateCooldown,
  evaluateDelay,
  evaluateIfElseState,
  evaluateInvert,
  evaluateLerp,
  evaluateMapRange,
  evaluateMultiply,
  evaluateOscillator,
  evaluateSmooth,
  evaluateTimer,
  validateBehaviorGraph,
  validateConditionNodeParams,
  validateFlowNodeParams,
  validateInputNodeParams,
  validateTransformNodeParams,
  type CooldownState,
  type DelayState,
  type IfElseState,
  type RuntimeInput,
  type SmoothStepState,
} from './behaviorRuntime';
import type { SceneDocument } from '../api/projects';

// A scene carrying exactly one "Follow hand" card (Task 34): indexTipX ->
// positionX, mapped [0,1] -> [0, canvas width], smoothing 0.3.
function sceneWithFollowHand(overrides: Partial<Parameters<typeof baseScene>[0]> = {}) {
  const card: FollowHandCard = {
    type: 'followHand',
    id: 'card-1',
    source: 'indexTip',
    axis: 'x',
    handTarget: 'primary',
    targetScope: 'shape',
    targetId: 'shape-circle',
  };
  const scene = baseScene({
    canvas: { width: 100, height: 100, backgroundColor: '#000000' },
    shapes: [circleShape({ id: 'shape-circle' })],
    ...overrides,
  });
  const binding = bindingForCard(card, scene);
  const fragment = graphFragmentForCard(card, 0);
  return baseScene({
    ...scene,
    bindings: [binding],
    graph: { nodes: fragment.nodes, connections: fragment.connections },
  });
}

function scenePulse(): { scene: ReturnType<typeof baseScene>; binding: Record<string, unknown> } {
  const card: PulseCard = {
    type: 'pulse',
    id: 'card-pulse',
    trigger: 'pinchStart',
    handTarget: 'primary',
  };
  const scene = baseScene();
  const binding = bindingForCard(card, scene) as Record<string, unknown>;
  const fragment = graphFragmentForCard(card, 0);
  return {
    scene: baseScene({ bindings: [binding], graph: fragment }),
    binding,
  };
}

// A scene carrying two continuous bindings on the same shape: a
// "Follow hand" binding (indexTipX -> positionX, smoothing 0.3) and a
// "React to pinch" binding (pinchStrength -> opacity, smoothing 0.2) —
// used to observe the work-budget degradation path actually dropping the
// lower-priority (later-array-order) binding and skipping smoothing,
// rather than merely flipping a boolean flag.
function sceneWithTwoBindings() {
  const followCard: FollowHandCard = {
    type: 'followHand',
    id: 'card-1',
    source: 'indexTip',
    axis: 'x',
    handTarget: 'primary',
    targetScope: 'shape',
    targetId: 'shape-circle',
  };
  const pinchCard: ReactToPinchCard = {
    type: 'reactToPinch',
    id: 'card-2',
    source: 'pinchStrength',
    handTarget: 'primary',
    targetScope: 'shape',
    targetId: 'shape-circle',
    targetProperty: 'opacity',
  };
  const base = baseScene({
    canvas: { width: 100, height: 100, backgroundColor: '#000000' },
    shapes: [circleShape({ id: 'shape-circle' })],
  });
  const followBinding = bindingForCard(followCard, base);
  const pinchBinding = bindingForCard(pinchCard, base);
  const followFragment = graphFragmentForCard(followCard, 0);
  const pinchFragment = graphFragmentForCard(pinchCard, 1);
  return baseScene({
    ...base,
    bindings: [followBinding, pinchBinding],
    graph: {
      nodes: [...followFragment.nodes, ...pinchFragment.nodes],
      connections: [...followFragment.connections, ...pinchFragment.connections],
    },
  });
}

function input(
  timestamp: number,
  signals: RuntimeInput['signals'],
  events: string[] = [],
): RuntimeInput {
  return { timestamp, signals, events };
}

// --- Task 37 test fixtures: hand-authored transform-chain graphs -------
//
// Builds a scene with N `handSignal` input nodes feeding a single transform
// node, whose `out` port feeds a `shapeProperty` node targeting
// `shape-circle`'s `positionX` — the minimal end-to-end wiring needed to
// exercise `evaluateGraphNodeValue`/`evaluateGraphVisualOutputs` (not just
// the pure per-node math functions) through `createBehaviorRuntime`/`tick`.
function sceneWithTransformChain(
  transformType: string,
  transformParams: Record<string, unknown>,
  inputs: Array<{ signal: string; toPort: string }>,
): SceneDocument {
  const inputNodes = inputs.map((inp, index) => ({
    id: `in-${index}`,
    family: 'input',
    type: 'handSignal',
    params: { signal: inp.signal, handTarget: 'primary' },
    position: { x: 0, y: index * 80 },
  }));
  const transformNode = {
    id: 'xform',
    family: 'transform',
    type: transformType,
    params: transformParams,
    position: { x: 200, y: 0 },
  };
  const outputNode = {
    id: 'out-node',
    family: 'visual',
    type: 'shapeProperty',
    params: { targetId: 'shape-circle', property: 'positionX' },
    position: { x: 400, y: 0 },
  };
  const inputConnections = inputs.map((inp, index) => ({
    id: `conn-in-${index}`,
    fromNodeId: `in-${index}`,
    fromPort: 'value',
    toNodeId: 'xform',
    toPort: inp.toPort,
  }));
  const outputConnection = {
    id: 'conn-out',
    fromNodeId: 'xform',
    fromPort: 'out',
    toNodeId: 'out-node',
    toPort: 'in',
  };
  return baseScene({
    canvas: { width: 100, height: 100, backgroundColor: '#000000' },
    shapes: [circleShape({ id: 'shape-circle' })],
    bindings: [],
    graph: {
      nodes: [...inputNodes, transformNode, outputNode],
      connections: [...inputConnections, outputConnection],
    },
  });
}

function tickPositionX(scene: SceneDocument, tickInput: RuntimeInput): number | undefined {
  const runtime = createBehaviorRuntime(scene);
  const result = runtime.tick(tickInput);
  return result.continuous.find((c) => c.targetProperty === 'positionX')?.value as
    number | undefined;
}

// --- Task 38 test fixture: an arbitrary hand-authored graph ------------
//
// Unlike `sceneWithTransformChain` (fixed shape: N handSignal inputs into
// one transform node into one shapeProperty node), Task 38's tests need
// varied topologies (an ifElse's two output ports feeding two different
// target properties, a bare source node with no upstream at all, etc.), so
// this helper just wraps arbitrary caller-supplied nodes/connections into
// a valid scene shell around `shape-circle`.
function sceneWithGraph(
  nodes: Array<{
    id: string;
    family: string;
    type: string;
    params: Record<string, unknown>;
    position: { x: number; y: number };
  }>,
  connections: Array<{
    id: string;
    fromNodeId: string;
    fromPort: string;
    toNodeId: string;
    toPort: string;
  }>,
): SceneDocument {
  return baseScene({
    canvas: { width: 100, height: 100, backgroundColor: '#000000' },
    shapes: [circleShape({ id: 'shape-circle' })],
    bindings: [],
    graph: { nodes, connections },
  });
}

function shapePropertyNode(id: string, property: string, position = { x: 0, y: 0 }) {
  return {
    id,
    family: 'visual',
    type: 'shapeProperty',
    params: { targetId: 'shape-circle', property },
    position,
  };
}

describe('validateBehaviorGraph', () => {
  it('accepts a scene built from a behavior card', () => {
    const result = validateBehaviorGraph(sceneWithFollowHand());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a graph cycle', () => {
    const scene = sceneWithFollowHand();
    const graph = (scene as Record<string, unknown>).graph as {
      nodes: Array<Record<string, unknown>>;
      connections: Array<Record<string, unknown>>;
    };
    // input-card-1 -> action-card-1 already exists; add action -> input to
    // close a cycle.
    graph.connections.push({
      id: 'conn-back',
      fromNodeId: 'action-card-1',
      fromPort: 'in',
      toNodeId: 'input-card-1',
      toPort: 'value',
    });
    const result = validateBehaviorGraph(scene);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'graphCycle')).toBe(true);
  });

  it('rejects a node with an unsupported family/type', () => {
    const scene = sceneWithFollowHand();
    const graph = (scene as Record<string, unknown>).graph as {
      nodes: Array<Record<string, unknown>>;
    };
    // 'oscillator' is in `_docs/plan.md`'s V1 math/time node list but out
    // of scope for Task 37 (see the module doc comment), so it remains
    // unsupported even though the other 7 transform types now are.
    graph.nodes.push({
      id: 'bad-node',
      family: 'transform',
      type: 'oscillator',
      params: {},
      position: { x: 0, y: 0 },
    });
    const result = validateBehaviorGraph(scene);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'invalidNodeType')).toBe(true);
  });

  it('rejects a connection naming an unsupported port for its node type', () => {
    const scene = sceneWithFollowHand();
    const graph = (scene as Record<string, unknown>).graph as {
      connections: Array<Record<string, unknown>>;
    };
    graph.connections[0].fromPort = 'not-a-real-port';
    const result = validateBehaviorGraph(scene);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'invalidConnection')).toBe(true);
  });

  it('rejects a binding whose target channel is not allowlisted for its scope', () => {
    const scene = sceneWithFollowHand();
    const bindings = (scene as Record<string, unknown>).bindings as Array<Record<string, unknown>>;
    bindings[0].targetProperty = 'emitParticles'; // an interaction-only channel, not shape
    const result = validateBehaviorGraph(scene);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'invalidTargetChannel')).toBe(true);
  });

  it('createBehaviorRuntime throws BehaviorGraphValidationError before any tick runs, for an invalid graph', () => {
    const scene = sceneWithFollowHand();
    const bindings = (scene as Record<string, unknown>).bindings as Array<Record<string, unknown>>;
    bindings[0].targetProperty = 'emitParticles';
    expect(() => createBehaviorRuntime(scene)).toThrow(BehaviorGraphValidationError);
  });
});

describe('createBehaviorRuntime: continuous evaluation', () => {
  it('evaluates from elapsed timestamps: two runs with different tick spacing converge to the same value at the same elapsed time', () => {
    // Run A: a cold-start tick at t=0 (seeds the EMA at 0), then five more
    // 20ms-spaced ticks all reporting the same target signal, covering
    // 100ms total. Run B: the same cold start, then a single tick jumping
    // straight to t=100ms with the same target signal. Time-normalized EMA
    // guarantees these land on the same value: the compounded decay factor
    // over five 20ms steps equals the decay factor of one 100ms step. If
    // evaluation were coupled to tick *count* rather than elapsed time,
    // these would diverge (five smoothing steps vs. one).
    const runtimeA = createBehaviorRuntime(sceneWithFollowHand(), { perfNow: () => 0 });
    const runtimeB = createBehaviorRuntime(sceneWithFollowHand(), { perfNow: () => 0 });

    runtimeA.tick(input(0, { indexTipX: 0 }));
    let lastA;
    for (let t = 20; t <= 100; t += 20) {
      lastA = runtimeA.tick(input(t, { indexTipX: 1 }));
    }

    runtimeB.tick(input(0, { indexTipX: 0 }));
    const lastB = runtimeB.tick(input(100, { indexTipX: 1 }));

    const valueA = lastA!.continuous.find((c) => c.targetProperty === 'positionX')!.value as number;
    const valueB = lastB.continuous.find((c) => c.targetProperty === 'positionX')!.value as number;
    expect(Math.abs(valueA - valueB)).toBeLessThan(0.01);
    // Sanity check: both actually moved partway toward the target rather
    // than trivially both sitting at the cold-start seed or both snapping
    // straight to it.
    expect(valueA).toBeGreaterThan(0);
    expect(valueA).toBeLessThan(100);
  });

  it('clamps output at the target property range boundary', () => {
    const runtime = createBehaviorRuntime(sceneWithFollowHand());
    // indexTipX raw is documented [0,1]; feed an out-of-range raw value —
    // mapping [0,1] -> [0,100] would produce 1000, but positionX's
    // documented range is [-100000, 100000] so this particular mapping
    // never actually needs clamping. Use a scene whose mapping pushes past
    // canvas width instead, by supplying a raw value beyond mapping.inMax.
    const result = runtime.tick(input(0, { indexTipX: 5 }));
    const value = result.continuous.find((c) => c.targetProperty === 'positionX')!.value as number;
    // mapping inMin/inMax = [0,1], outMin/outMax = [0,100]; raw=5 is
    // clamped to inMax=1 by applyMapping before scaling, so value must be
    // exactly the mapped max (100), not 500.
    expect(value).toBe(100);
  });

  it('clamps a mapped output that actually exceeds the target property range to the range boundary', () => {
    // Unlike the mapping-ratio-clamp test above, this drives a *mapped*
    // output (500000) past positionX's actual documented range
    // ([-100000, 100000], NUMERIC_TARGET_RANGES) so clampToTargetRange
    // itself must engage. A hand-authored binding (not bindingForCard,
    // whose canvas-derived mapping.outMax can never exceed the schema's
    // 4096px max canvas width) is used to set an out-of-range mapping
    // directly — schema/scene.schema.json places no bound on mapping
    // values themselves, only on the transform2D fields they eventually
    // clamp into.
    const binding = {
      id: 'card-range',
      signal: 'indexTipX',
      handTarget: 'primary',
      targetScope: 'shape',
      targetId: 'shape-circle',
      targetProperty: 'positionX',
      composition: 'replace',
      mapping: { inMin: 0, inMax: 1, outMin: 0, outMax: 500000 },
      smoothing: 0,
    };
    const scene = baseScene({
      canvas: { width: 100, height: 100, backgroundColor: '#000000' },
      shapes: [circleShape({ id: 'shape-circle' })],
      bindings: [binding],
      graph: { nodes: [], connections: [] },
    });
    const runtime = createBehaviorRuntime(scene);
    const result = runtime.tick(input(0, { indexTipX: 1 }));
    const output = result.continuous.find((c) => c.targetProperty === 'positionX')!;
    // Mapping alone would produce 500000 (0 + 1 * 500000); the target
    // range's documented maximum is 100000, so the clamped output must
    // land exactly at that boundary, not at the raw mapped value.
    expect(output.value).toBe(100000);
  });

  it('applies configured smoothing so the output moves gradually toward the mapped target rather than snapping', () => {
    const runtime = createBehaviorRuntime(sceneWithFollowHand());
    const first = runtime.tick(input(0, { indexTipX: 1 })); // cold start: seeds at mapped value
    const startValue = first.continuous.find((c) => c.targetProperty === 'positionX')!
      .value as number;
    expect(startValue).toBe(100); // seeded directly on first tick, no prior state to blend

    const afterJumpToZero = runtime.tick(input(16.667, { indexTipX: 0 }));
    const value = afterJumpToZero.continuous.find((c) => c.targetProperty === 'positionX')!
      .value as number;
    // With smoothing 0.3 and dt ~= one reference tick, output should move
    // partway from 100 toward 0, not land exactly on 0.
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(100);
  });

  it('drops (does not output) a continuous binding whose signal is absent this tick', () => {
    const runtime = createBehaviorRuntime(sceneWithFollowHand());
    const result = runtime.tick(input(0, {})); // no indexTipX
    expect(result.continuous).toEqual([]);
  });
});

describe('createBehaviorRuntime: event bindings', () => {
  it('fires on the tick an event signal is present', () => {
    const { scene } = scenePulse();
    const runtime = createBehaviorRuntime(scene);
    const result = runtime.tick(input(0, {}, ['event:pinchStart']));
    expect(result.events).toHaveLength(1);
    expect(result.events[0].targetProperty).toBe('triggerPreset');
  });

  it('does not fire twice within the cooldown window', () => {
    const { scene } = scenePulse();
    const runtime = createBehaviorRuntime(scene);
    const first = runtime.tick(input(0, {}, ['event:pinchStart']));
    const second = runtime.tick(input(DEFAULT_EVENT_COOLDOWN_MS - 1, {}, ['event:pinchStart']));
    expect(first.events).toHaveLength(1);
    expect(second.events).toHaveLength(0);
  });

  it('fires again once the cooldown has elapsed', () => {
    const { scene } = scenePulse();
    const runtime = createBehaviorRuntime(scene);
    runtime.tick(input(0, {}, ['event:pinchStart']));
    const afterCooldown = runtime.tick(
      input(DEFAULT_EVENT_COOLDOWN_MS + 1, {}, ['event:pinchStart']),
    );
    expect(afterCooldown.events).toHaveLength(1);
  });

  it('enforces the per-second rate cap even when the cooldown alone would allow more firings', () => {
    const { scene } = scenePulse();
    // A cooldown of 1ms with the default 10/second cap: firing every 1ms
    // for 20ms would produce ~20 firings without a rate cap; the cap must
    // hold it to 10 within any trailing one-second window.
    const runtime = createBehaviorRuntime(scene, { eventCooldownMs: 1 });
    let fired = 0;
    for (let t = 0; t <= 20; t += 1) {
      const result = runtime.tick(input(t, {}, ['event:pinchStart']));
      fired += result.events.length;
    }
    expect(fired).toBeLessThanOrEqual(10);
  });
});

describe('createBehaviorRuntime: work budget and graceful degradation', () => {
  it('emits a non-sensitive diagnostic and degrades the following tick when a tick exceeds the work budget', () => {
    const scene = sceneWithFollowHand();
    // Simulate an over-budget tick via an injected perfNow: first call (tick
    // start) returns 0, second call (tick end) returns far past the
    // default 4ms budget.
    let call = 0;
    const perfNow = () => (call++ % 2 === 0 ? 0 : 50);
    const runtime = createBehaviorRuntime(scene, { perfNow });

    const overBudget = runtime.tick(input(0, { indexTipX: 1 }));
    expect(overBudget.evaluatedMs).toBe(50);
    expect(overBudget.diagnostics).toHaveLength(1);
    expect(overBudget.diagnostics[0].type).toBe('frameBudgetExceeded');
    expect(overBudget.diagnostics[0].message).not.toMatch(/camera|landmark|hand|indexTipX/i);
    expect(overBudget.diagnostics[0].bindingCount).toBe(1);

    const nextTick = runtime.tick(input(16.667, { indexTipX: 0 }));
    expect(nextTick.degraded).toBe(true);
  });

  it('does not degrade a tick following one that stayed under budget', () => {
    const runtime = createBehaviorRuntime(sceneWithFollowHand(), { perfNow: () => 0 });
    runtime.tick(input(0, { indexTipX: 1 }));
    const next = runtime.tick(input(16.667, { indexTipX: 0 }));
    expect(next.degraded).toBe(false);
    expect(next.diagnostics).toEqual([]);
  });

  it('a degraded tick actually drops the lowest-priority binding and actually skips smoothing, not just flips the degraded flag', () => {
    const scene = sceneWithTwoBindings(); // 2 bindings: positionX (index 0), opacity (index 1)

    // perfNow returns 0 for every tick's start call, and 0 for every end
    // call except tick index 1's (the second tick), which returns 50ms —
    // pushing only that one tick over the default 4ms budget so tick
    // index 2 (the third tick) runs degraded.
    let call = 0;
    const perfNow = () => {
      const tickIndex = Math.floor(call / 2);
      const isEndOfTick = call % 2 === 1;
      call += 1;
      return tickIndex === 1 && isEndOfTick ? 50 : 0;
    };
    const runtime = createBehaviorRuntime(scene, { perfNow });

    // Tick 0 (normal): cold-starts both bindings' smoothing state at 0.
    runtime.tick(input(0, { indexTipX: 0, pinchStrength: 0 }));
    // Tick 1 (normal, but this is the one perfNow reports as over budget):
    // smoothing is active here, so positionX only moves partway toward
    // its mapped target (100) rather than snapping straight to it.
    const midTick = runtime.tick(input(16.667, { indexTipX: 1, pinchStrength: 1 }));
    const midPositionX = midTick.continuous.find((c) => c.targetProperty === 'positionX')!
      .value as number;
    expect(midPositionX).toBeGreaterThan(0);
    expect(midPositionX).toBeLessThan(100); // partial smoothing, confirms smoothing was active pre-degradation

    // Tick 2: degraded because tick 1 exceeded the work budget.
    const degradedTick = runtime.tick(input(33.334, { indexTipX: 1, pinchStrength: 1 }));
    expect(degradedTick.degraded).toBe(true);

    // Actually dropped a binding: only the higher-priority (first,
    // positionX) binding is evaluated; the opacity binding is silently
    // skipped this tick, not merely uncounted.
    expect(degradedTick.droppedBindingCount).toBe(1);
    expect(degradedTick.continuous).toHaveLength(1);
    expect(degradedTick.continuous[0].targetProperty).toBe('positionX');
    expect(degradedTick.continuous.some((c) => c.targetProperty === 'opacity')).toBe(false);

    // Actually skipped smoothing: with the mapped target unchanged at 100
    // and smoothing active, the value would only creep further toward 100
    // from `midPositionX` (partial blend); skipped smoothing snaps
    // straight to the full mapped value instead.
    const degradedPositionX = degradedTick.continuous[0].value as number;
    expect(degradedPositionX).toBe(100);
  });
});

describe('determinism', () => {
  it('produces an identical output sequence for the same seeded scene and timestamped input sequence, run twice', () => {
    const sequence: RuntimeInput[] = [
      input(0, { indexTipX: 0.2 }),
      input(16.667, { indexTipX: 0.4 }, ['event:pinchStart']),
      input(33.334, { indexTipX: 0.9 }),
      input(66.667, { indexTipX: 0.1 }),
    ];

    function run(): unknown[] {
      const { scene } = scenePulse();
      const followScene = sceneWithFollowHand();
      const merged = baseScene({
        ...followScene,
        bindings: [
          ...((followScene as Record<string, unknown>).bindings as unknown[]),
          ...((scene as Record<string, unknown>).bindings as unknown[]),
        ],
        graph: {
          nodes: [
            ...((followScene as Record<string, unknown>).graph as { nodes: unknown[] }).nodes,
            ...((scene as Record<string, unknown>).graph as { nodes: unknown[] }).nodes,
          ],
          connections: [
            ...((followScene as Record<string, unknown>).graph as { connections: unknown[] })
              .connections,
            ...((scene as Record<string, unknown>).graph as { connections: unknown[] }).connections,
          ],
        },
      });
      const runtime = createBehaviorRuntime(merged, { perfNow: () => 0 });
      return sequence.map((tickInput) => runtime.tick(tickInput));
    }

    const runA = run();
    const runB = run();
    expect(runA).toEqual(runB);
  });

  it('exposes the scene randomness seed for future seed-dependent node types', () => {
    const scene = baseScene({ randomness: { seed: 483920, enabled: true } });
    const runtime = createBehaviorRuntime(scene);
    expect(runtime.seed).toBe(483920);
  });
});

describe('applyRuntimeOutputsToScene: renderer wiring', () => {
  const previews: Array<ReturnType<typeof createP5ScenePreview>> = [];
  afterEach(() => {
    for (const p of previews.splice(0)) p.destroy();
  });

  it('moves the shape a follow-hand binding targets, visible to buildScenePlan/the p5 preview pipeline', () => {
    const scene = sceneWithFollowHand();
    const runtime = createBehaviorRuntime(scene);
    const tickResult = runtime.tick(input(0, { indexTipX: 0.75 }));

    const patchedScene = applyRuntimeOutputsToScene(scene, tickResult.continuous);
    const shapes = (patchedScene as Record<string, unknown>).shapes as Array<
      Record<string, unknown>
    >;
    const shape = shapes.find((s) => s.id === 'shape-circle')!;
    const transform = shape.transform as Record<string, number>;
    expect(transform.x).toBe(75); // mapped [0,1] -> [0, canvas width 100]

    // Confirm the patched scene is still valid and renderable through the
    // same p5 preview pipeline Task 25 already wires the editor into.
    const container = document.createElement('div');
    document.body.appendChild(container);
    const preview = createP5ScenePreview(container);
    previews.push(preview);
    expect(() => preview.render(patchedScene)).not.toThrow();
  });

  it('leaves the scene untouched when there are no continuous outputs to apply', () => {
    const scene = sceneWithFollowHand();
    const patched = applyRuntimeOutputsToScene(scene, []);
    expect(patched).toBe(scene);
  });
});

// --- Task 37: transform node tests --------------------------------------
//
// Two layers, per the issue's acceptance criteria: (1) table-driven tests
// of the pure per-node math functions directly (minimum, maximum, an
// equality/degenerate case, a negative case, a non-finite case — for every
// one of the 7 node types), and (2) end-to-end `createBehaviorRuntime`/
// `tick` tests proving each node type is actually wired into graph
// execution, not just structurally allowlisted.

describe('Task 37 transform node math: table-driven', () => {
  describe('evaluateMapRange', () => {
    const cases: Array<[string, number | null, Record<string, unknown>, number | null]> = [
      [
        'minimum of input range -> output min',
        0,
        { inMin: 0, inMax: 10, outMin: 0, outMax: 100 },
        0,
      ],
      [
        'maximum of input range -> output max',
        10,
        { inMin: 0, inMax: 10, outMin: 0, outMax: 100 },
        100,
      ],
      [
        'equal input bounds -> documented output-range midpoint, no NaN',
        999,
        { inMin: 5, inMax: 5, outMin: 0, outMax: 100 },
        50,
      ],
      [
        'negative input value maps correctly',
        -5,
        { inMin: -10, inMax: 0, outMin: 0, outMax: 100 },
        50,
      ],
      ['NaN input -> null', NaN, { inMin: 0, inMax: 1, outMin: 0, outMax: 1 }, null],
      ['Infinity input -> null', Infinity, { inMin: 0, inMax: 1, outMin: 0, outMax: 1 }, null],
      ['null (missing) input -> null', null, { inMin: 0, inMax: 1, outMin: 0, outMax: 1 }, null],
    ];
    it.each(cases)('%s', (_label, value, params, expected) => {
      expect(evaluateMapRange(value, params)).toBe(expected);
    });

    it('clampOutput: true (the default) clamps extrapolated results into the output range', () => {
      expect(evaluateMapRange(2, { inMin: 0, inMax: 1, outMin: 0, outMax: 10 })).toBe(10);
    });

    it('clampOutput: false allows extrapolation past the output range', () => {
      expect(
        evaluateMapRange(2, { inMin: 0, inMax: 1, outMin: 0, outMax: 10, clampOutput: false }),
      ).toBe(20);
    });
  });

  describe('evaluateClamp', () => {
    const cases: Array<[string, number | null, Record<string, unknown>, number | null]> = [
      ['value at minimum passes through', 0, { min: 0, max: 10 }, 0],
      ['value above maximum is clamped to maximum', 15, { min: 0, max: 10 }, 10],
      ['min === max collapses to that single point', 5, { min: 3, max: 3 }, 3],
      ['negative value within a negative range', -5, { min: -10, max: -1 }, -5],
      ['NaN input -> null', NaN, { min: 0, max: 1 }, null],
      ['Infinity input -> null', Infinity, { min: 0, max: 1 }, null],
      ['null (missing) input -> null', null, { min: 0, max: 1 }, null],
    ];
    it.each(cases)('%s', (_label, value, params, expected) => {
      expect(evaluateClamp(value, params)).toBe(expected);
    });
  });

  describe('evaluateSmooth', () => {
    const primed: SmoothStepState = { value: 0, lastTimestamp: 0 };

    // (label, prior, raw, params, timestamp, skipSmoothing, expectedValue)
    const cases: Array<
      [
        string,
        SmoothStepState | null,
        number | null,
        Record<string, unknown>,
        number,
        boolean,
        number | null,
      ]
    > = [
      [
        'minimum smoothing (0) holds the prior value with no movement toward raw',
        primed,
        100,
        { smoothing: 0 },
        16.667,
        false,
        0,
      ],
      [
        'maximum smoothing (1) snaps fully to the new raw value once dt > 0',
        primed,
        100,
        { smoothing: 1 },
        16.667,
        false,
        100,
      ],
      [
        'equality: raw equal to the prior value produces no change',
        { value: 50, lastTimestamp: 0 },
        50,
        { smoothing: 0.5 },
        16.667,
        false,
        50,
      ],
      [
        'negative raw value blends fully toward a negative target at smoothing=1',
        primed,
        -100,
        { smoothing: 1 },
        16.667,
        false,
        -100,
      ],
      [
        'NaN raw (non-finite) holds the prior value rather than propagating garbage',
        { value: 7, lastTimestamp: 0 },
        NaN,
        {},
        16.667,
        false,
        7,
      ],
      [
        'Infinity raw (non-finite) holds the prior value',
        { value: 7, lastTimestamp: 0 },
        Infinity,
        {},
        16.667,
        false,
        7,
      ],
      [
        'null (missing) raw with no prior value yet -> null (nothing to hold)',
        null,
        null,
        {},
        0,
        false,
        null,
      ],
      [
        'cold start (no prior state): snaps directly to the first valid raw value',
        null,
        42,
        { smoothing: 0.3 },
        0,
        false,
        42,
      ],
      [
        'a degraded tick (skipSmoothing) snaps directly even with a prior value',
        primed,
        100,
        { smoothing: 0.3 },
        16.667,
        true,
        100,
      ],
    ];
    it.each(cases)('%s', (_label, prior, raw, params, timestamp, skipSmoothing, expectedValue) => {
      expect(evaluateSmooth(prior, raw, params, timestamp, skipSmoothing).value).toBe(
        expectedValue,
      );
    });

    it('persists the returned state for the next step to blend against', () => {
      const first = evaluateSmooth(null, 10, { smoothing: 0.5 }, 0, false);
      expect(first.state).toEqual({ value: 10, lastTimestamp: 0 });
      const second = evaluateSmooth(first.state, 20, { smoothing: 0.5 }, 16.667, false);
      expect(second.value).toBeGreaterThan(10);
      expect(second.value).toBeLessThan(20);
    });

    it('holding on a missing input returns the same state unchanged (nothing to persist differently)', () => {
      const prior: SmoothStepState = { value: 7, lastTimestamp: 0 };
      const held = evaluateSmooth(prior, null, {}, 16.667, false);
      expect(held.value).toBe(7);
      expect(held.state).toBe(prior);
    });
  });

  describe('evaluateInvert', () => {
    const cases: Array<[string, number | null, Record<string, unknown>, number | null]> = [
      ['minimum inverts to maximum', 0, { min: 0, max: 10 }, 10],
      ['maximum inverts to minimum', 10, { min: 0, max: 10 }, 0],
      ['min === max inverts to that single point', 5, { min: 3, max: 3 }, 3],
      ['negative-range value inverts symmetrically', -8, { min: -10, max: -1 }, -3],
      ['NaN input -> null', NaN, { min: 0, max: 1 }, null],
      ['Infinity input -> null', Infinity, { min: 0, max: 1 }, null],
      ['null (missing) input -> null', null, { min: 0, max: 1 }, null],
    ];
    it.each(cases)('%s', (_label, value, params, expected) => {
      expect(evaluateInvert(value, params)).toBe(expected);
    });
  });

  describe('evaluateAdd', () => {
    const cases: Array<[string, number | null, number | null, number | null]> = [
      ['two minimum-ish values', 0, 0, 0],
      ['large values summing within range', 1e6, 1e6, 2e6],
      ['equal operands', 4, 4, 8],
      ['negative operand', -5, 3, -2],
      ['NaN operand -> null (rejected, not propagated)', NaN, 1, null],
      [
        'finite operands whose sum overflows to Infinity -> null',
        Number.MAX_VALUE,
        Number.MAX_VALUE,
        null,
      ],
      ['null operand -> null', null, 1, null],
    ];
    it.each(cases)('%s', (_label, a, b, expected) => {
      expect(evaluateAdd(a, b)).toBe(expected);
    });
  });

  describe('evaluateMultiply', () => {
    const cases: Array<[string, number | null, number | null, number | null]> = [
      ['multiply by zero (minimum-ish)', 0, 5, 0],
      ['two large values', 1e3, 1e3, 1e6],
      ['equal operands', 4, 4, 16],
      ['negative operand', -3, 4, -12],
      ['NaN operand -> null (rejected, not propagated)', NaN, 1, null],
      ['finite operands whose product overflows to Infinity -> null', Number.MAX_VALUE, 2, null],
      ['null operand -> null', null, 1, null],
    ];
    it.each(cases)('%s', (_label, a, b, expected) => {
      expect(evaluateMultiply(a, b)).toBe(expected);
    });
  });

  describe('evaluateLerp', () => {
    const cases: Array<
      [string, number | null, number | null, Record<string, unknown>, number | null]
    > = [
      ['t=0 (minimum) returns a', 0, 10, { t: 0 }, 0],
      ['t=1 (maximum) returns b', 0, 10, { t: 1 }, 10],
      ['a === b returns that value regardless of t', 7, 7, { t: 0.5 }, 7],
      ['negative endpoints', -10, -20, { t: 0.5 }, -15],
      ['NaN endpoint -> null', NaN, 10, { t: 0.5 }, null],
      ['Infinity endpoint -> null', Infinity, 10, { t: 0.5 }, null],
      ['null endpoint -> null', null, 10, { t: 0.5 }, null],
    ];
    it.each(cases)('%s', (_label, a, b, params, expected) => {
      expect(evaluateLerp(a, b, params)).toBe(expected);
    });

    it('t outside [0,1] is clamped rather than extrapolating', () => {
      expect(evaluateLerp(0, 10, { t: 2 })).toBe(10);
      expect(evaluateLerp(0, 10, { t: -1 })).toBe(0);
    });
  });
});

describe('Task 37 transform node param validation (surfaced before execution)', () => {
  it('accepts default (empty) params for every transform node type', () => {
    for (const type of ['mapRange', 'clamp', 'smooth', 'invert', 'add', 'multiply', 'lerp']) {
      expect(validateTransformNodeParams(type, {})).toBeNull();
    }
  });

  it('rejects clamp with min > max', () => {
    expect(validateTransformNodeParams('clamp', { min: 10, max: 0 })).toMatch(/min.*max/);
  });

  it('rejects invert with min > max', () => {
    expect(validateTransformNodeParams('invert', { min: 10, max: 0 })).toMatch(/min.*max/);
  });

  it('rejects a negative smoothing value', () => {
    expect(validateTransformNodeParams('smooth', { smoothing: -0.1 })).toMatch(/smoothing/);
  });

  it('rejects a smoothing value above 1', () => {
    expect(validateTransformNodeParams('smooth', { smoothing: 1.5 })).toMatch(/smoothing/);
  });

  it('rejects a non-finite mapRange bound', () => {
    expect(validateTransformNodeParams('mapRange', { inMin: NaN })).toMatch(/inMin/);
  });

  it('rejects a non-boolean mapRange clampOutput', () => {
    expect(validateTransformNodeParams('mapRange', { clampOutput: 'yes' })).toMatch(/clampOutput/);
  });

  it('rejects a lerp t outside [0,1]', () => {
    expect(validateTransformNodeParams('lerp', { t: 1.2 })).toMatch(/t/);
  });

  it('surfaces an invalid transform node parameter as a validateBehaviorGraph error before any tick runs', () => {
    const scene = sceneWithTransformChain('clamp', { min: 10, max: 0 }, [
      { signal: 'testSignal', toPort: 'in' },
    ]);
    const result = validateBehaviorGraph(scene);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'invalidNodeParams')).toBe(true);
    expect(() => createBehaviorRuntime(scene)).toThrow(BehaviorGraphValidationError);
  });
});

describe('Task 37 transform nodes: end-to-end graph execution', () => {
  it('mapRange: executes a handSignal -> mapRange -> shapeProperty chain', () => {
    const scene = sceneWithTransformChain(
      'mapRange',
      { inMin: 0, inMax: 1, outMin: 0, outMax: 50 },
      [{ signal: 'testSignal', toPort: 'in' }],
    );
    expect(tickPositionX(scene, input(0, { testSignal: 0.5 }))).toBe(25);
  });

  it('clamp: executes end to end and bounds an out-of-range signal', () => {
    const scene = sceneWithTransformChain('clamp', { min: 0, max: 10 }, [
      { signal: 'testSignal', toPort: 'in' },
    ]);
    expect(tickPositionX(scene, input(0, { testSignal: 999 }))).toBe(10);
  });

  it('invert: executes end to end', () => {
    const scene = sceneWithTransformChain('invert', { min: 0, max: 10 }, [
      { signal: 'testSignal', toPort: 'in' },
    ]);
    expect(tickPositionX(scene, input(0, { testSignal: 3 }))).toBe(7);
  });

  it('add: executes end to end with two connected inputs', () => {
    const scene = sceneWithTransformChain('add', {}, [
      { signal: 'signalA', toPort: 'inA' },
      { signal: 'signalB', toPort: 'inB' },
    ]);
    expect(tickPositionX(scene, input(0, { signalA: 3, signalB: 4 }))).toBe(7);
  });

  it('add: an unconnected port defaults to 0 (additive identity), documented missing-input policy', () => {
    const scene = sceneWithTransformChain('add', {}, [{ signal: 'signalA', toPort: 'inA' }]);
    expect(tickPositionX(scene, input(0, { signalA: 3 }))).toBe(3);
  });

  it('multiply: executes end to end with two connected inputs', () => {
    const scene = sceneWithTransformChain('multiply', {}, [
      { signal: 'signalA', toPort: 'inA' },
      { signal: 'signalB', toPort: 'inB' },
    ]);
    expect(tickPositionX(scene, input(0, { signalA: 3, signalB: 4 }))).toBe(12);
  });

  it('multiply: an unconnected port defaults to 1 (multiplicative identity), documented missing-input policy', () => {
    const scene = sceneWithTransformChain('multiply', {}, [{ signal: 'signalA', toPort: 'inA' }]);
    expect(tickPositionX(scene, input(0, { signalA: 3 }))).toBe(3);
  });

  it('smooth: initializes by snapping to the first valid input (cold start), no prior value to blend', () => {
    const scene = sceneWithTransformChain('smooth', { smoothing: 0.3 }, [
      { signal: 'testSignal', toPort: 'in' },
    ]);
    const runtime = createBehaviorRuntime(scene);
    const first = runtime.tick(input(0, { testSignal: 100 }));
    expect(first.continuous.find((c) => c.targetProperty === 'positionX')?.value).toBe(100);
  });

  it('smooth: moves gradually toward a new target on a later tick rather than snapping', () => {
    const scene = sceneWithTransformChain('smooth', { smoothing: 0.3 }, [
      { signal: 'testSignal', toPort: 'in' },
    ]);
    const runtime = createBehaviorRuntime(scene);
    runtime.tick(input(0, { testSignal: 0 }));
    const second = runtime.tick(input(16.667, { testSignal: 100 }));
    const value = second.continuous.find((c) => c.targetProperty === 'positionX')?.value as number;
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(100);
  });

  it('smooth: holds the last computed value when the input signal goes missing', () => {
    const scene = sceneWithTransformChain('smooth', { smoothing: 0.3 }, [
      { signal: 'testSignal', toPort: 'in' },
    ]);
    const runtime = createBehaviorRuntime(scene);
    runtime.tick(input(0, { testSignal: 42 }));
    const missing = runtime.tick(input(16.667, {})); // testSignal absent this tick
    expect(missing.continuous.find((c) => c.targetProperty === 'positionX')?.value).toBe(42);
  });

  it('smooth: produces no output before it has ever received a valid input', () => {
    const scene = sceneWithTransformChain('smooth', { smoothing: 0.3 }, [
      { signal: 'testSignal', toPort: 'in' },
    ]);
    const runtime = createBehaviorRuntime(scene);
    const result = runtime.tick(input(0, {})); // never had a valid input
    expect(result.continuous.find((c) => c.targetProperty === 'positionX')).toBeUndefined();
  });

  it('lerp: initializes once both inputs are present', () => {
    const scene = sceneWithTransformChain('lerp', { t: 0.5 }, [
      { signal: 'signalA', toPort: 'inA' },
      { signal: 'signalB', toPort: 'inB' },
    ]);
    expect(tickPositionX(scene, input(0, { signalA: 0, signalB: 10 }))).toBe(5);
  });

  it('lerp: holds the last computed value when an input goes missing on a later tick', () => {
    const scene = sceneWithTransformChain('lerp', { t: 0.5 }, [
      { signal: 'signalA', toPort: 'inA' },
      { signal: 'signalB', toPort: 'inB' },
    ]);
    const runtime = createBehaviorRuntime(scene);
    runtime.tick(input(0, { signalA: 0, signalB: 10 })); // computes 5, stores it
    const missing = runtime.tick(input(16.667, { signalA: 0 })); // signalB absent
    expect(missing.continuous.find((c) => c.targetProperty === 'positionX')?.value).toBe(5);
  });

  it('lerp: produces no output before it has ever computed a value', () => {
    const scene = sceneWithTransformChain('lerp', { t: 0.5 }, [
      { signal: 'signalA', toPort: 'inA' },
    ]); // inB never connected
    const runtime = createBehaviorRuntime(scene);
    const result = runtime.tick(input(0, { signalA: 0 }));
    expect(result.continuous.find((c) => c.targetProperty === 'positionX')).toBeUndefined();
  });

  it('chains multiple transform nodes: mapRange -> clamp', () => {
    // signal in [0,1] -> mapRange to [-50, 150] -> clamp to [0, 100].
    const inputNode = {
      id: 'in-0',
      family: 'input',
      type: 'handSignal',
      params: { signal: 'testSignal', handTarget: 'primary' },
      position: { x: 0, y: 0 },
    };
    const mapNode = {
      id: 'map',
      family: 'transform',
      type: 'mapRange',
      params: { inMin: 0, inMax: 1, outMin: -50, outMax: 150, clampOutput: false },
      position: { x: 150, y: 0 },
    };
    const clampNode = {
      id: 'clampNode',
      family: 'transform',
      type: 'clamp',
      params: { min: 0, max: 100 },
      position: { x: 300, y: 0 },
    };
    const outputNode = {
      id: 'out-node',
      family: 'visual',
      type: 'shapeProperty',
      params: { targetId: 'shape-circle', property: 'positionX' },
      position: { x: 450, y: 0 },
    };
    const scene = baseScene({
      canvas: { width: 100, height: 100, backgroundColor: '#000000' },
      shapes: [circleShape({ id: 'shape-circle' })],
      bindings: [],
      graph: {
        nodes: [inputNode, mapNode, clampNode, outputNode],
        connections: [
          { id: 'c1', fromNodeId: 'in-0', fromPort: 'value', toNodeId: 'map', toPort: 'in' },
          { id: 'c2', fromNodeId: 'map', fromPort: 'out', toNodeId: 'clampNode', toPort: 'in' },
          {
            id: 'c3',
            fromNodeId: 'clampNode',
            fromPort: 'out',
            toNodeId: 'out-node',
            toPort: 'in',
          },
        ],
      },
    });
    // testSignal=1 -> mapRange yields 150 (unclamped) -> clamp bounds to 100.
    expect(tickPositionX(scene, input(0, { testSignal: 1 }))).toBe(100);
  });

  it('does not double-emit for a Task 34 card graph fragment (card binding already produces the output)', () => {
    const scene = sceneWithFollowHand();
    const runtime = createBehaviorRuntime(scene);
    const result = runtime.tick(input(0, { indexTipX: 0.5 }));
    const positionXOutputs = result.continuous.filter((c) => c.targetProperty === 'positionX');
    expect(positionXOutputs).toHaveLength(1);
  });
});

// =========================================================================
// Task 38: If/Else, Oscillator, Timer, Delay, Cooldown
// =========================================================================

describe('Task 38: evaluateComparison (If/Else pure comparison)', () => {
  const cases: Array<[string, number, Record<string, unknown>, boolean | null]> = [
    [
      'greaterThan: strictly above threshold is true',
      51,
      { comparison: 'greaterThan', threshold: 50 },
      true,
    ],
    [
      'greaterThan: exact threshold equality is false (exclusive)',
      50,
      { comparison: 'greaterThan', threshold: 50 },
      false,
    ],
    [
      'greaterThan: below threshold is false',
      49,
      { comparison: 'greaterThan', threshold: 50 },
      false,
    ],
    [
      'lessThan: strictly below threshold is true',
      49,
      { comparison: 'lessThan', threshold: 50 },
      true,
    ],
    [
      'lessThan: exact threshold equality is false (exclusive)',
      50,
      { comparison: 'lessThan', threshold: 50 },
      false,
    ],
    [
      'between: exact min boundary is true (inclusive)',
      0,
      { comparison: 'between', min: 0, max: 10 },
      true,
    ],
    [
      'between: exact max boundary is true (inclusive)',
      10,
      { comparison: 'between', min: 0, max: 10 },
      true,
    ],
    [
      'between: just outside max is false',
      10.01,
      { comparison: 'between', min: 0, max: 10 },
      false,
    ],
    [
      'approximately: exactly at threshold is true',
      50,
      { comparison: 'approximately', threshold: 50, tolerance: 0.05 },
      true,
    ],
    [
      'approximately: exactly at the tolerance boundary is true (inclusive)',
      50.05,
      { comparison: 'approximately', threshold: 50, tolerance: 0.05 },
      true,
    ],
    [
      'approximately: just past the tolerance boundary is false',
      50.06,
      { comparison: 'approximately', threshold: 50, tolerance: 0.05 },
      false,
    ],
    ['unrecognized comparison returns null', 1, { comparison: 'bogus' }, null],
  ];
  it.each(cases)('%s', (_label, value, params, expected) => {
    expect(evaluateComparison(value, params)).toBe(expected);
  });
});

describe('Task 38: evaluateIfElseState (debounce/hold-time state machine)', () => {
  it('holdTimeMs: 0 commits on the very first tick with a new target', () => {
    const step = evaluateIfElseState(
      null,
      100,
      { comparison: 'greaterThan', threshold: 50, holdTimeMs: 0 },
      0,
    );
    expect(step.state).toBe(true);
  });

  it('a target below holdTimeMs does not commit yet', () => {
    let state: IfElseState | null = null;
    const params = { comparison: 'greaterThan', threshold: 50, holdTimeMs: 100 };
    const first = evaluateIfElseState(state, 100, params, 0);
    expect(first.state).toBeNull(); // not yet committed
    state = first.persist;
    const second = evaluateIfElseState(state, 100, params, 50); // 50ms elapsed, < 100ms
    expect(second.state).toBeNull();
  });

  it('commits exactly at the holdTimeMs boundary (inclusive)', () => {
    const params = { comparison: 'greaterThan', threshold: 50, holdTimeMs: 100 };
    const first = evaluateIfElseState(null, 100, params, 0);
    const second = evaluateIfElseState(first.persist, 100, params, 100); // elapsed === holdTimeMs
    expect(second.state).toBe(true);
  });

  it('a target that flickers back to the committed state resets the candidate timer', () => {
    const params = { comparison: 'greaterThan', threshold: 50, holdTimeMs: 100 };
    let step = evaluateIfElseState(null, 20, params, 0); // committed stays null (never above)
    expect(step.state).toBeNull();
    step = evaluateIfElseState(step.persist, 100, params, 10); // candidate: true, since t=10
    step = evaluateIfElseState(step.persist, 20, params, 60); // flickers back to false/null target
    expect(step.state).toBeNull();
    step = evaluateIfElseState(step.persist, 100, params, 70); // new candidate window starts at t=70
    expect(step.state).toBeNull();
    step = evaluateIfElseState(step.persist, 100, params, 169); // only 99ms since the restart
    expect(step.state).toBeNull();
    step = evaluateIfElseState(step.persist, 100, params, 170); // 100ms since the restart at t=70
    expect(step.state).toBe(true);
  });

  it('missing/non-finite input holds the committed state and does not touch the debounce timer', () => {
    const params = { comparison: 'greaterThan', threshold: 50, holdTimeMs: 0 };
    const committed = evaluateIfElseState(null, 100, params, 0); // commits true immediately
    expect(committed.state).toBe(true);
    const missing = evaluateIfElseState(committed.persist, null, params, 50);
    expect(missing.state).toBe(true);
    expect(missing.persist).toEqual(committed.persist);
  });
});

describe('Task 38: evaluateOscillator (pure function of elapsed time)', () => {
  it('sine: starts at the offset (phase 0)', () => {
    expect(
      evaluateOscillator(0, { shape: 'sine', periodMs: 1000, amplitude: 1, offset: 0 }),
    ).toBeCloseTo(0);
  });

  it('sine: peaks at amplitude a quarter-period in', () => {
    expect(
      evaluateOscillator(250, { shape: 'sine', periodMs: 1000, amplitude: 2, offset: 0 }),
    ).toBeCloseTo(2);
  });

  it('triangle: -1 at phase 0, +1 at the half-period, back to -1 at a full period', () => {
    expect(evaluateOscillator(0, { shape: 'triangle', periodMs: 1000 })).toBeCloseTo(-1);
    expect(evaluateOscillator(500, { shape: 'triangle', periodMs: 1000 })).toBeCloseTo(1);
    expect(evaluateOscillator(1000, { shape: 'triangle', periodMs: 1000 })).toBeCloseTo(-1);
  });

  it('square: high for the first half of the period, low for the second', () => {
    expect(evaluateOscillator(0, { shape: 'square', periodMs: 1000 })).toBe(1);
    expect(evaluateOscillator(499, { shape: 'square', periodMs: 1000 })).toBe(1);
    expect(evaluateOscillator(500, { shape: 'square', periodMs: 1000 })).toBe(-1);
  });

  it('applies offset and amplitude scaling', () => {
    expect(
      evaluateOscillator(250, { shape: 'sine', periodMs: 1000, amplitude: 5, offset: 10 }),
    ).toBeCloseTo(15);
  });

  it('produces the identical value at the same elapsed timestamp regardless of tick history', () => {
    const params = { shape: 'sine', periodMs: 1000, amplitude: 1, offset: 0 };
    // Simulate arriving at timestamp 990 via a 30fps-equivalent cadence
    // versus a 60fps-equivalent cadence: since evaluateOscillator is a
    // pure function of `timestamp` alone (no persisted state), the tick
    // history leading up to 990 cannot affect the value observed at 990.
    // Walk up to (but not through) elapsed 990ms at two different simulated
    // cadences — 30fps-equivalent (~33.33ms/tick) and 60fps-equivalent
    // (~16.67ms/tick) — then both sequences take one final tick landing
    // exactly on elapsed 990ms. Since evaluateOscillator depends only on
    // `timestamp`, not on how many ticks (or how widely spaced) preceded
    // it, the two sequences must agree at that shared elapsed timestamp.
    for (let t = 0; t < 990; t += 1000 / 30) evaluateOscillator(t, params);
    const at30fps = evaluateOscillator(990, params);
    for (let t = 0; t < 990; t += 1000 / 60) evaluateOscillator(t, params);
    const at60fps = evaluateOscillator(990, params);
    expect(at30fps).toBe(at60fps);
  });
});

describe('Task 38: evaluateTimer (pure function of elapsed time)', () => {
  it('elapsed mode: value equals the raw timestamp', () => {
    expect(evaluateTimer(1234, { mode: 'elapsed' })).toBe(1234);
  });

  it('loop mode: wraps back to 0 exactly at the period boundary', () => {
    expect(evaluateTimer(999, { mode: 'loop', periodMs: 1000 })).toBe(999);
    expect(evaluateTimer(1000, { mode: 'loop', periodMs: 1000 })).toBe(0);
    expect(evaluateTimer(2500, { mode: 'loop', periodMs: 1000 })).toBe(500);
  });

  it('countdown mode: counts down to exactly 0 and holds there past completion', () => {
    expect(evaluateTimer(0, { mode: 'countdown', durationMs: 1000 })).toBe(1000);
    expect(evaluateTimer(500, { mode: 'countdown', durationMs: 1000 })).toBe(500);
    expect(evaluateTimer(1000, { mode: 'countdown', durationMs: 1000 })).toBe(0);
    expect(evaluateTimer(1500, { mode: 'countdown', durationMs: 1000 })).toBe(0);
  });
});

describe('Task 38: evaluateDelay (elapsed-timestamp-gated pass-through)', () => {
  it('does not emit before the delay completes', () => {
    const step = evaluateDelay(null, 10, 0, { delayMs: 100 });
    expect(step.value).toBeNull();
  });

  it('a value just short of the delay boundary is still withheld', () => {
    let state: DelayState | null = null;
    let step = evaluateDelay(state, 10, 0, { delayMs: 100 });
    state = step.state;
    step = evaluateDelay(state, 10, 99, { delayMs: 100 });
    expect(step.value).toBeNull();
  });

  it('emits exactly at the delay boundary (inclusive)', () => {
    let state: DelayState | null = null;
    let step = evaluateDelay(state, 10, 0, { delayMs: 100 });
    state = step.state;
    step = evaluateDelay(state, 10, 100, { delayMs: 100 });
    expect(step.value).toBe(10);
  });

  it('a value changing again before the delay completes restarts the delay', () => {
    let state: DelayState | null = null;
    let step = evaluateDelay(state, 10, 0, { delayMs: 100 });
    state = step.state;
    step = evaluateDelay(state, 20, 50, { delayMs: 100 }); // changed before 10 committed
    state = step.state;
    expect(step.value).toBeNull(); // nothing has ever committed yet
    step = evaluateDelay(state, 20, 100, { delayMs: 100 }); // only 50ms since the restart
    expect(step.value).toBeNull();
    state = step.state;
    step = evaluateDelay(state, 20, 150, { delayMs: 100 }); // 100ms since the restart at t=50
    expect(step.value).toBe(20);
  });

  it('missing input holds the last committed value without disturbing the pending timer', () => {
    let state: DelayState | null = null;
    let step = evaluateDelay(state, 10, 0, { delayMs: 100 });
    state = step.state;
    step = evaluateDelay(state, 10, 100, { delayMs: 100 }); // commits 10
    state = step.state;
    step = evaluateDelay(state, null, 150, { delayMs: 100 }); // signal goes missing
    expect(step.value).toBe(10);
  });
});

describe('Task 38: evaluateCooldown (elapsed-timestamp-gated event gate)', () => {
  it('the first trigger attempt always fires', () => {
    const step = evaluateCooldown(null, true, 0, { milliseconds: 500 });
    expect(step.fired).toBe(true);
  });

  it('repeated attempts during the cooldown window are suppressed and do not reset the clock', () => {
    let state: CooldownState | null = null;
    let step = evaluateCooldown(state, true, 0, { milliseconds: 500 });
    expect(step.fired).toBe(true);
    state = step.state;

    step = evaluateCooldown(state, true, 100, { milliseconds: 500 }); // 100ms since the last firing
    expect(step.fired).toBe(false);
    state = step.state; // must NOT have moved lastFiredAt to 100

    step = evaluateCooldown(state, true, 400, { milliseconds: 500 }); // measured from t=0, not t=100
    expect(step.fired).toBe(false);
    state = step.state;

    step = evaluateCooldown(state, true, 500, { milliseconds: 500 }); // exactly 500ms since t=0
    expect(step.fired).toBe(true);
  });

  it('a tick with no trigger attempt never fires and leaves state untouched', () => {
    const primed: CooldownState = { lastFiredAt: 0 };
    const step = evaluateCooldown(primed, false, 1000, { milliseconds: 500 });
    expect(step.fired).toBe(false);
    expect(step.state).toEqual(primed);
  });
});

describe('Task 38: param validation (surfaced before execution)', () => {
  it('rejects an ifElse comparison outside the documented set', () => {
    expect(validateConditionNodeParams('ifElse', { comparison: 'notAThing' })).toMatch(
      /comparison/,
    );
  });
  it('rejects ifElse min > max', () => {
    expect(validateConditionNodeParams('ifElse', { min: 10, max: 0 })).toMatch(/min/);
  });
  it('rejects a negative ifElse tolerance', () => {
    expect(validateConditionNodeParams('ifElse', { tolerance: -1 })).toMatch(/tolerance/);
  });
  it('rejects a negative ifElse holdTimeMs', () => {
    expect(validateConditionNodeParams('ifElse', { holdTimeMs: -1 })).toMatch(/holdTimeMs/);
  });
  it('accepts default (empty) ifElse params', () => {
    expect(validateConditionNodeParams('ifElse', {})).toBeNull();
  });

  it('rejects an oscillator shape outside the documented set', () => {
    expect(validateInputNodeParams('oscillator', { shape: 'sawtooth' })).toMatch(/shape/);
  });
  it('rejects a non-positive oscillator periodMs', () => {
    expect(validateInputNodeParams('oscillator', { periodMs: 0 })).toMatch(/periodMs/);
    expect(validateInputNodeParams('oscillator', { periodMs: -10 })).toMatch(/periodMs/);
  });
  it('rejects a timer mode outside the documented set', () => {
    expect(validateInputNodeParams('timer', { mode: 'bogus' })).toMatch(/mode/);
  });
  it('rejects a non-positive timer durationMs', () => {
    expect(validateInputNodeParams('timer', { durationMs: -1 })).toMatch(/durationMs/);
  });
  it('accepts default (empty) input params for oscillator/timer/handSignal/gestureEvent', () => {
    expect(validateInputNodeParams('oscillator', {})).toBeNull();
    expect(validateInputNodeParams('timer', {})).toBeNull();
    expect(validateInputNodeParams('handSignal', {})).toBeNull();
    expect(validateInputNodeParams('gestureEvent', {})).toBeNull();
  });

  it('rejects a negative delay delayMs (invalid timing value)', () => {
    expect(validateFlowNodeParams('delay', { delayMs: -1 })).toMatch(/delayMs/);
  });
  it('rejects a negative cooldown milliseconds (invalid timing value)', () => {
    expect(validateFlowNodeParams('cooldown', { milliseconds: -1 })).toMatch(/milliseconds/);
  });
  it('accepts default (empty) flow params', () => {
    expect(validateFlowNodeParams('delay', {})).toBeNull();
    expect(validateFlowNodeParams('cooldown', {})).toBeNull();
  });

  it('surfaces an invalid condition/timing node parameter as a validateBehaviorGraph error before any tick runs', () => {
    const scene = sceneWithGraph(
      [
        {
          id: 'osc',
          family: 'input',
          type: 'oscillator',
          params: { periodMs: -1 },
          position: { x: 0, y: 0 },
        },
      ],
      [],
    );
    const result = validateBehaviorGraph(scene);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'invalidNodeParams')).toBe(true);
    expect(() => createBehaviorRuntime(scene)).toThrow(BehaviorGraphValidationError);
  });
});

describe('Task 38: graph-level validation rules', () => {
  it('accepts exactly 3 conditional (ifElse) nodes', () => {
    const nodes = [0, 1, 2].map((i) => ({
      id: `cond-${i}`,
      family: 'condition',
      type: 'ifElse',
      params: {},
      position: { x: i * 100, y: 0 },
    }));
    const scene = sceneWithGraph(nodes, []);
    expect(validateBehaviorGraph(scene).valid).toBe(true);
  });

  it('rejects a 4th conditional (ifElse) node in the same scene', () => {
    const nodes = [0, 1, 2, 3].map((i) => ({
      id: `cond-${i}`,
      family: 'condition',
      type: 'ifElse',
      params: {},
      position: { x: i * 100, y: 0 },
    }));
    const scene = sceneWithGraph(nodes, []);
    const result = validateBehaviorGraph(scene);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('maxConditionalNodes'))).toBe(true);
  });

  it('rejects an ifElse feeding directly into a second ifElse (chained/nested condition trees)', () => {
    const nodes = [
      { id: 'cond-a', family: 'condition', type: 'ifElse', params: {}, position: { x: 0, y: 0 } },
      { id: 'cond-b', family: 'condition', type: 'ifElse', params: {}, position: { x: 200, y: 0 } },
    ];
    const connections = [
      { id: 'c1', fromNodeId: 'cond-a', fromPort: 'true', toNodeId: 'cond-b', toPort: 'in' },
    ];
    const scene = sceneWithGraph(nodes, connections);
    const result = validateBehaviorGraph(scene);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'chainedConditionNode')).toBe(true);
  });

  it('rejects an ifElse feeding indirectly into a second ifElse through an intermediate transform node', () => {
    const nodes = [
      { id: 'cond-a', family: 'condition', type: 'ifElse', params: {}, position: { x: 0, y: 0 } },
      {
        id: 'clampNode',
        family: 'transform',
        type: 'clamp',
        params: {},
        position: { x: 200, y: 0 },
      },
      { id: 'cond-b', family: 'condition', type: 'ifElse', params: {}, position: { x: 400, y: 0 } },
    ];
    const connections = [
      { id: 'c1', fromNodeId: 'cond-a', fromPort: 'true', toNodeId: 'clampNode', toPort: 'in' },
      { id: 'c2', fromNodeId: 'clampNode', fromPort: 'out', toNodeId: 'cond-b', toPort: 'in' },
    ];
    const scene = sceneWithGraph(nodes, connections);
    const result = validateBehaviorGraph(scene);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'chainedConditionNode')).toBe(true);
  });

  it('still rejects a plain cycle involving Task 38 node types (reuses findCycle, not reimplemented)', () => {
    const nodes = [
      { id: 'delayNode', family: 'flow', type: 'delay', params: {}, position: { x: 0, y: 0 } },
      {
        id: 'clampNode',
        family: 'transform',
        type: 'clamp',
        params: {},
        position: { x: 200, y: 0 },
      },
    ];
    const connections = [
      { id: 'c1', fromNodeId: 'delayNode', fromPort: 'out', toNodeId: 'clampNode', toPort: 'in' },
      { id: 'c2', fromNodeId: 'clampNode', fromPort: 'out', toNodeId: 'delayNode', toPort: 'in' },
    ];
    const scene = sceneWithGraph(nodes, connections);
    const result = validateBehaviorGraph(scene);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === 'graphCycle')).toBe(true);
  });
});

describe('Task 38: end-to-end graph execution', () => {
  it('ifElse: the true branch emits a level output only once the condition holds', () => {
    const nodes = [
      {
        id: 'in-0',
        family: 'input',
        type: 'handSignal',
        params: { signal: 'testSignal' },
        position: { x: 0, y: 0 },
      },
      {
        id: 'cond',
        family: 'condition',
        type: 'ifElse',
        params: { comparison: 'greaterThan', threshold: 50, holdTimeMs: 0 },
        position: { x: 200, y: 0 },
      },
      shapePropertyNode('out-node', 'positionX', { x: 400, y: 0 }),
    ];
    const connections = [
      { id: 'c1', fromNodeId: 'in-0', fromPort: 'value', toNodeId: 'cond', toPort: 'in' },
      { id: 'c2', fromNodeId: 'cond', fromPort: 'true', toNodeId: 'out-node', toPort: 'in' },
    ];
    const scene = sceneWithGraph(nodes, connections);
    expect(tickPositionX(scene, input(0, { testSignal: 60 }))).toBe(1);
    // Exact-threshold equality does not satisfy "greaterThan" (exclusive boundary).
    expect(tickPositionX(scene, input(0, { testSignal: 50 }))).toBeUndefined();
  });

  it('ifElse: true and false branches feed different target properties and are mutually exclusive', () => {
    const nodes = [
      {
        id: 'in-0',
        family: 'input',
        type: 'handSignal',
        params: { signal: 'testSignal' },
        position: { x: 0, y: 0 },
      },
      {
        id: 'cond',
        family: 'condition',
        type: 'ifElse',
        params: { comparison: 'greaterThan', threshold: 50, holdTimeMs: 0 },
        position: { x: 200, y: 0 },
      },
      shapePropertyNode('true-node', 'positionX', { x: 400, y: -50 }),
      shapePropertyNode('false-node', 'positionY', { x: 400, y: 50 }),
    ];
    const connections = [
      { id: 'c1', fromNodeId: 'in-0', fromPort: 'value', toNodeId: 'cond', toPort: 'in' },
      { id: 'c2', fromNodeId: 'cond', fromPort: 'true', toNodeId: 'true-node', toPort: 'in' },
      { id: 'c3', fromNodeId: 'cond', fromPort: 'false', toNodeId: 'false-node', toPort: 'in' },
    ];
    const scene = sceneWithGraph(nodes, connections);
    const runtime = createBehaviorRuntime(scene);
    const below = runtime.tick(input(0, { testSignal: 10 }));
    expect(below.continuous.find((c) => c.targetProperty === 'positionX')).toBeUndefined();
    expect(below.continuous.find((c) => c.targetProperty === 'positionY')?.value).toBe(1);

    const above = runtime.tick(input(16.667, { testSignal: 90 }));
    expect(above.continuous.find((c) => c.targetProperty === 'positionX')?.value).toBe(1);
    expect(above.continuous.find((c) => c.targetProperty === 'positionY')).toBeUndefined();
  });

  it('ifElse: debounced by holdTimeMs end to end (a boundary-flickering signal does not flip the output)', () => {
    const nodes = [
      {
        id: 'in-0',
        family: 'input',
        type: 'handSignal',
        params: { signal: 'testSignal' },
        position: { x: 0, y: 0 },
      },
      {
        id: 'cond',
        family: 'condition',
        type: 'ifElse',
        params: { comparison: 'greaterThan', threshold: 50, holdTimeMs: 100 },
        position: { x: 200, y: 0 },
      },
      shapePropertyNode('out-node', 'positionX', { x: 400, y: 0 }),
    ];
    const connections = [
      { id: 'c1', fromNodeId: 'in-0', fromPort: 'value', toNodeId: 'cond', toPort: 'in' },
      { id: 'c2', fromNodeId: 'cond', fromPort: 'true', toNodeId: 'out-node', toPort: 'in' },
    ];
    const scene = sceneWithGraph(nodes, connections);
    const runtime = createBehaviorRuntime(scene);
    expect(
      runtime
        .tick(input(0, { testSignal: 60 }))
        .continuous.find((c) => c.targetProperty === 'positionX'),
    ).toBeUndefined();
    expect(
      runtime
        .tick(input(50, { testSignal: 60 }))
        .continuous.find((c) => c.targetProperty === 'positionX'),
    ).toBeUndefined();
    expect(
      runtime
        .tick(input(100, { testSignal: 60 }))
        .continuous.find((c) => c.targetProperty === 'positionX')?.value,
    ).toBe(1);
  });

  it('oscillator: produces the same value at the same elapsed timestamp regardless of simulated frame rate', () => {
    const nodes = [
      {
        id: 'osc',
        family: 'input',
        type: 'oscillator',
        params: { shape: 'sine', periodMs: 1000, amplitude: 10 },
        position: { x: 0, y: 0 },
      },
      shapePropertyNode('out-node', 'positionX', { x: 200, y: 0 }),
    ];
    const connections = [
      { id: 'c1', fromNodeId: 'osc', fromPort: 'value', toNodeId: 'out-node', toPort: 'in' },
    ];

    // As in the pure-function test above: walk each runtime up to (but not
    // through) elapsed 990ms at a different simulated cadence, then take
    // one final tick landing exactly on elapsed 990ms from each, and
    // compare those.
    const scene30 = sceneWithGraph(nodes, connections);
    const runtime30 = createBehaviorRuntime(scene30);
    for (let t = 0; t < 990; t += 1000 / 30) runtime30.tick(input(t, {}));
    const at30fps = runtime30
      .tick(input(990, {}))
      .continuous.find((c) => c.targetProperty === 'positionX')?.value;

    const scene60 = sceneWithGraph(nodes, connections);
    const runtime60 = createBehaviorRuntime(scene60);
    for (let t = 0; t < 990; t += 1000 / 60) runtime60.tick(input(t, {}));
    const at60fps = runtime60
      .tick(input(990, {}))
      .continuous.find((c) => c.targetProperty === 'positionX')?.value;

    expect(at30fps).toBe(at60fps);
  });

  it('timer: loop mode wraps end to end', () => {
    const nodes = [
      {
        id: 'timerNode',
        family: 'input',
        type: 'timer',
        params: { mode: 'loop', periodMs: 1000 },
        position: { x: 0, y: 0 },
      },
      shapePropertyNode('out-node', 'positionX', { x: 200, y: 0 }),
    ];
    const connections = [
      { id: 'c1', fromNodeId: 'timerNode', fromPort: 'value', toNodeId: 'out-node', toPort: 'in' },
    ];
    const scene = sceneWithGraph(nodes, connections);
    expect(tickPositionX(scene, input(999, {}))).toBe(999);
    expect(tickPositionX(scene, input(1000, {}))).toBe(0);
    expect(tickPositionX(scene, input(2500, {}))).toBe(500);
  });

  it('timer: countdown mode completes and holds at 0 end to end', () => {
    const nodes = [
      {
        id: 'timerNode',
        family: 'input',
        type: 'timer',
        params: { mode: 'countdown', durationMs: 1000 },
        position: { x: 0, y: 0 },
      },
      shapePropertyNode('out-node', 'positionX', { x: 200, y: 0 }),
    ];
    const connections = [
      { id: 'c1', fromNodeId: 'timerNode', fromPort: 'value', toNodeId: 'out-node', toPort: 'in' },
    ];
    const scene = sceneWithGraph(nodes, connections);
    expect(tickPositionX(scene, input(1000, {}))).toBe(0);
    expect(tickPositionX(scene, input(1500, {}))).toBe(0);
  });

  it('delay: withholds output until exactly delayMs, then emits; a mid-flight value change restarts the wait', () => {
    const nodes = [
      {
        id: 'in-0',
        family: 'input',
        type: 'handSignal',
        params: { signal: 'testSignal' },
        position: { x: 0, y: 0 },
      },
      {
        id: 'delayNode',
        family: 'flow',
        type: 'delay',
        params: { delayMs: 100 },
        position: { x: 200, y: 0 },
      },
      shapePropertyNode('out-node', 'positionX', { x: 400, y: 0 }),
    ];
    const connections = [
      { id: 'c1', fromNodeId: 'in-0', fromPort: 'value', toNodeId: 'delayNode', toPort: 'in' },
      { id: 'c2', fromNodeId: 'delayNode', fromPort: 'out', toNodeId: 'out-node', toPort: 'in' },
    ];
    const scene = sceneWithGraph(nodes, connections);
    const runtime = createBehaviorRuntime(scene);
    expect(
      runtime
        .tick(input(0, { testSignal: 10 }))
        .continuous.find((c) => c.targetProperty === 'positionX'),
    ).toBeUndefined();
    expect(
      runtime
        .tick(input(99, { testSignal: 10 }))
        .continuous.find((c) => c.targetProperty === 'positionX'),
    ).toBeUndefined();
    expect(
      runtime
        .tick(input(100, { testSignal: 10 }))
        .continuous.find((c) => c.targetProperty === 'positionX')?.value,
    ).toBe(10);
    // Value changes again: restarts the wait, does not immediately re-emit.
    expect(
      runtime
        .tick(input(150, { testSignal: 20 }))
        .continuous.find((c) => c.targetProperty === 'positionX')?.value,
    ).toBe(10);
    expect(
      runtime
        .tick(input(249, { testSignal: 20 }))
        .continuous.find((c) => c.targetProperty === 'positionX')?.value,
    ).toBe(10);
    expect(
      runtime
        .tick(input(250, { testSignal: 20 }))
        .continuous.find((c) => c.targetProperty === 'positionX')?.value,
    ).toBe(20);
  });
});
