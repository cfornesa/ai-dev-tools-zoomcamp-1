import { afterEach, describe, expect, it } from 'vitest';

import {
  bindingForCard,
  graphFragmentForCard,
  type FollowHandCard,
  type PulseCard,
} from '../pages/behaviorCards';
import { createP5ScenePreview } from '../render/p5Adapter';
import { baseScene, circleShape } from '../render/testSceneFixtures';
import {
  applyRuntimeOutputsToScene,
  BehaviorGraphValidationError,
  createBehaviorRuntime,
  DEFAULT_EVENT_COOLDOWN_MS,
  validateBehaviorGraph,
  type RuntimeInput,
} from './behaviorRuntime';

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

function input(
  timestamp: number,
  signals: RuntimeInput['signals'],
  events: string[] = [],
): RuntimeInput {
  return { timestamp, signals, events };
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
    graph.nodes.push({
      id: 'bad-node',
      family: 'transform',
      type: 'mapRange',
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
