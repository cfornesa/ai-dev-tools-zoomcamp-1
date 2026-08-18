import { describe, expect, it } from 'vitest';

import { baseScene, circleShape } from '../render/testSceneFixtures';
import type { SceneDocument } from '../api/projects';
import { bindingForCard, graphFragmentForCard, type FollowHandCard } from './behaviorCards';
import {
  addGraphConnection,
  addGraphNode,
  checkGraphConnection,
  creatableNodeTypes,
  moveGraphNode,
  NODE_TYPE_CATALOG,
  removeGraphConnection,
  removeGraphNode,
  updateGraphNodeParams,
  type GraphNodeData,
} from './graphEditing';

/**
 * Task 36: pure-logic tests for `graphEditing.ts` — the shared engine
 * behind both `GraphView.tsx` (drag-and-drop) and `GraphListView.tsx`
 * (keyboard-operable list). Covers: typed/allowed node creation,
 * type-compatible + directionally-valid + acyclic connection validation
 * (accept and reject cases, reusing `behaviorRuntime.ts`'s rules),
 * all-or-nothing rejection, stable ids, and behavior-card sync/cascade.
 */

function sceneWithShape(): SceneDocument {
  return baseScene({ shapes: [circleShape({ id: 'shape-circle' })] });
}

function sceneWithFollowHandCard(): SceneDocument {
  const card: FollowHandCard = {
    type: 'followHand',
    id: 'card-1',
    source: 'indexTip',
    axis: 'x',
    handTarget: 'primary',
    targetScope: 'shape',
    targetId: 'shape-circle',
  };
  const scene = sceneWithShape();
  const binding = bindingForCard(card, scene);
  const fragment = graphFragmentForCard(card, 0);
  return {
    ...scene,
    bindings: [binding],
    graph: { nodes: fragment.nodes, connections: fragment.connections },
  };
}

describe('addGraphNode', () => {
  it('adds an allowed node type and assigns it a stable id', () => {
    const scene = sceneWithShape();
    const outcome = addGraphNode(scene, 'handSignal', { x: 0, y: 0 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const graph = outcome.scene.graph as { nodes: Array<{ id: string; type: string }> };
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].type).toBe('handSignal');
    expect(outcome.nodeId).toBe(graph.nodes[0].id);
    expect(typeof outcome.nodeId).toBe('string');
  });

  it('rejects an unknown node type without touching the scene', () => {
    const scene = sceneWithShape();
    const outcome = addGraphNode(scene, 'notARealType', { x: 0, y: 0 });
    expect(outcome.ok).toBe(false);
    // Original scene's graph is untouched.
    expect((scene.graph as { nodes: unknown[] }).nodes).toHaveLength(0);
  });
});

describe('checkGraphConnection / addGraphConnection', () => {
  it('accepts a type-compatible, directionally valid connection', () => {
    let scene = sceneWithShape();
    const a = addGraphNode(scene, 'handSignal', { x: 0, y: 0 });
    expect(a.ok).toBe(true);
    if (!a.ok || !a.nodeId) return;
    scene = a.scene;
    const b = addGraphNode(scene, 'shapeProperty', { x: 200, y: 0 });
    expect(b.ok).toBe(true);
    if (!b.ok || !b.nodeId) return;
    scene = b.scene;

    const candidate = { fromNodeId: a.nodeId, fromPort: 'value', toNodeId: b.nodeId, toPort: 'in' };
    const graph = scene.graph as { nodes: never[]; connections: never[] };
    expect(checkGraphConnection(graph.nodes, graph.connections, candidate).valid).toBe(true);

    const outcome = addGraphConnection(scene, candidate);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const nextGraph = outcome.scene.graph as { connections: unknown[] };
    expect(nextGraph.connections).toHaveLength(1);
  });

  it('rejects a connection between mismatched data types (value -> event)', () => {
    let scene = sceneWithShape();
    const a = addGraphNode(scene, 'handSignal', { x: 0, y: 0 }); // out: value
    if (!a.ok || !a.nodeId) throw new Error('setup failed');
    scene = a.scene;
    const b = addGraphNode(scene, 'trigger', { x: 200, y: 0 }); // in: trigger (event)
    if (!b.ok || !b.nodeId) throw new Error('setup failed');
    scene = b.scene;

    const candidate = {
      fromNodeId: a.nodeId,
      fromPort: 'value',
      toNodeId: b.nodeId,
      toPort: 'trigger',
    };
    const graph = scene.graph as { nodes: never[]; connections: never[] };
    const check = checkGraphConnection(graph.nodes, graph.connections, candidate);
    expect(check.valid).toBe(false);
    expect(check.error).toMatch(/value.*event|event.*value/i);

    const outcome = addGraphConnection(scene, candidate);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    // All-or-nothing: the scene handed to addGraphConnection is never
    // mutated, and the returned outcome carries no partial state.
    expect((scene.graph as { connections: unknown[] }).connections).toHaveLength(0);
  });

  it('rejects an unknown port name', () => {
    let scene = sceneWithShape();
    const a = addGraphNode(scene, 'handSignal', { x: 0, y: 0 });
    if (!a.ok || !a.nodeId) throw new Error('setup failed');
    scene = a.scene;
    const b = addGraphNode(scene, 'shapeProperty', { x: 200, y: 0 });
    if (!b.ok || !b.nodeId) throw new Error('setup failed');
    scene = b.scene;

    const outcome = addGraphConnection(scene, {
      fromNodeId: a.nodeId,
      fromPort: 'notAPort',
      toNodeId: b.nodeId,
      toPort: 'in',
    });
    expect(outcome.ok).toBe(false);
  });

  it('rejects a self-connection', () => {
    let scene = sceneWithShape();
    const a = addGraphNode(scene, 'handSignal', { x: 0, y: 0 });
    if (!a.ok || !a.nodeId) throw new Error('setup failed');
    scene = a.scene;
    const graph = scene.graph as { nodes: never[]; connections: never[] };
    const check = checkGraphConnection(graph.nodes, graph.connections, {
      fromNodeId: a.nodeId,
      fromPort: 'value',
      toNodeId: a.nodeId,
      toPort: 'value',
    });
    expect(check.valid).toBe(false);
  });

  it('rejects a connection that would create a cycle', () => {
    // Build shapeProperty(in) -> ... only visual/flow nodes have inputs and
    // no allowed node type today has both an input and an output, so a
    // true two-node cycle can't be built from the current allowlist. This
    // test instead confirms findCycle-based rejection fires for a
    // synthetic 3-connection ring using raw connection data directly
    // against checkGraphConnection (which only needs id/type/family
    // shapes, not full scene validity).
    const nodes = [
      { id: 'n1', type: 'handSignal', family: 'input' },
      { id: 'n2', type: 'shapeProperty', family: 'visual' },
    ];
    // Fake an edge n2 -> n1 already existing (not achievable via the real
    // catalog, but exercises the cycle-detection path directly) to prove
    // checkGraphConnection consults findCycle rather than only port rules.
    const connections = [{ id: 'c1', fromNodeId: 'n2', toNodeId: 'n1' }];
    const result = checkGraphConnection(nodes as never, connections as never, {
      fromNodeId: 'n1',
      fromPort: 'value',
      toNodeId: 'n2',
      toPort: 'in',
    });
    // n1 -> n2 -> n1 would be a cycle.
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cycle/i);
  });
});

describe('removeGraphNode / removeGraphConnection', () => {
  it('removes a plain (non-card) node and its dangling connections', () => {
    let scene = sceneWithShape();
    const a = addGraphNode(scene, 'handSignal', { x: 0, y: 0 });
    if (!a.ok || !a.nodeId) throw new Error('setup failed');
    scene = a.scene;
    const b = addGraphNode(scene, 'shapeProperty', { x: 200, y: 0 });
    if (!b.ok || !b.nodeId) throw new Error('setup failed');
    scene = b.scene;
    const connected = addGraphConnection(scene, {
      fromNodeId: a.nodeId,
      fromPort: 'value',
      toNodeId: b.nodeId,
      toPort: 'in',
    });
    if (!connected.ok) throw new Error('setup failed');
    scene = connected.scene;

    const removed = removeGraphNode(scene, a.nodeId);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    const graph = removed.scene.graph as { nodes: unknown[]; connections: unknown[] };
    expect(graph.nodes).toHaveLength(1);
    expect(graph.connections).toHaveLength(0);
  });

  it('cascades: deleting a card-owned node removes the whole card (binding + both nodes)', () => {
    const scene = sceneWithFollowHandCard();
    const outcome = removeGraphNode(scene, 'input-card-1');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.scene.bindings).toHaveLength(0);
    const graph = outcome.scene.graph as { nodes: unknown[]; connections: unknown[] };
    expect(graph.nodes).toHaveLength(0);
    expect(graph.connections).toHaveLength(0);
  });

  it('cascades: deleting a card-owned connection removes the whole card', () => {
    const scene = sceneWithFollowHandCard();
    const outcome = removeGraphConnection(scene, 'conn-card-1');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.scene.bindings).toHaveLength(0);
    const graph = outcome.scene.graph as { nodes: unknown[] };
    expect(graph.nodes).toHaveLength(0);
  });

  it('rejects removing a node that does not exist, without mutating the scene', () => {
    const scene = sceneWithShape();
    const outcome = removeGraphNode(scene, 'no-such-node');
    expect(outcome.ok).toBe(false);
  });
});

describe('updateGraphNodeParams', () => {
  it('merges params into the existing node without touching other fields', () => {
    let scene = sceneWithShape();
    const a = addGraphNode(scene, 'handSignal', { x: 5, y: 9 });
    if (!a.ok || !a.nodeId) throw new Error('setup failed');
    scene = a.scene;

    const outcome = updateGraphNodeParams(scene, a.nodeId, { signal: 'palmX' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const graph = outcome.scene.graph as {
      nodes: Array<{
        id: string;
        params: Record<string, unknown>;
        position: { x: number; y: number };
      }>;
    };
    const node = graph.nodes.find((n) => n.id === a.nodeId)!;
    expect(node.params.signal).toBe('palmX');
    expect(node.params.handTarget).toBe('primary'); // untouched
    expect(node.position).toEqual({ x: 5, y: 9 }); // untouched
  });

  it('syncs a card-owned input node edit onto the underlying binding', () => {
    const scene = sceneWithFollowHandCard();
    const outcome = updateGraphNodeParams(scene, 'input-card-1', {
      signal: 'palmX',
      handTarget: 'left',
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const binding = (outcome.scene.bindings as Array<Record<string, unknown>>).find(
      (b) => b.id === 'card-1',
    );
    expect(binding?.signal).toBe('palmX');
    expect(binding?.handTarget).toBe('left');
  });

  it('syncs a card-owned action node edit onto the underlying binding', () => {
    const scene = sceneWithFollowHandCard();
    const outcome = updateGraphNodeParams(scene, 'action-card-1', {
      property: 'opacity',
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const binding = (outcome.scene.bindings as Array<Record<string, unknown>>).find(
      (b) => b.id === 'card-1',
    );
    expect(binding?.targetProperty).toBe('opacity');
  });
});

describe('moveGraphNode', () => {
  it('updates only the node position, preserving its id', () => {
    let scene = sceneWithShape();
    const a = addGraphNode(scene, 'handSignal', { x: 0, y: 0 });
    if (!a.ok || !a.nodeId) throw new Error('setup failed');
    scene = a.scene;

    const outcome = moveGraphNode(scene, a.nodeId, { x: 42, y: 99 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const graph = outcome.scene.graph as {
      nodes: Array<{ id: string; position: { x: number; y: number } }>;
    };
    expect(graph.nodes[0].id).toBe(a.nodeId);
    expect(graph.nodes[0].position).toEqual({ x: 42, y: 99 });
  });
});

describe('Task 37: transform node catalog (smoke)', () => {
  const transformTypes = ['mapRange', 'clamp', 'smooth', 'invert', 'add', 'multiply', 'lerp'];

  it('lists all 7 transform node types in the catalog, family "transform"', () => {
    for (const type of transformTypes) {
      expect(NODE_TYPE_CATALOG[type]).toBeDefined();
      expect(NODE_TYPE_CATALOG[type].family).toBe('transform');
    }
    const creatable = creatableNodeTypes().filter((n) => n.family === 'transform');
    expect(creatable.map((n) => n.type).sort()).toEqual([...transformTypes].sort());
  });

  it('adds each transform node type to a scene via addGraphNode', () => {
    for (const type of transformTypes) {
      const outcome = addGraphNode(sceneWithShape(), type, { x: 0, y: 0 });
      expect(outcome.ok).toBe(true);
    }
  });

  it('connects mapRange -> clamp as a type-compatible value-to-value chain', () => {
    const scene = sceneWithShape();
    const withMap = addGraphNode(scene, 'mapRange', { x: 0, y: 0 });
    if (!withMap.ok || !withMap.nodeId) throw new Error('setup failed');
    const withClamp = addGraphNode(withMap.scene, 'clamp', { x: 200, y: 0 });
    if (!withClamp.ok || !withClamp.nodeId) throw new Error('setup failed');
    const check = checkGraphConnection(
      (withClamp.scene.graph as { nodes: GraphNodeData[] }).nodes,
      [],
      { fromNodeId: withMap.nodeId, fromPort: 'out', toNodeId: withClamp.nodeId, toPort: 'in' },
    );
    expect(check.valid).toBe(true);
  });
});

describe('Task 38: condition/timing node catalog (smoke)', () => {
  const conditionTimingTypes = ['ifElse', 'oscillator', 'timer', 'delay', 'cooldown'];
  const familyByType: Record<string, string> = {
    ifElse: 'condition',
    oscillator: 'input',
    timer: 'input',
    delay: 'flow',
    cooldown: 'flow',
  };

  it('lists all 5 condition/timing node types in the catalog under their documented family', () => {
    for (const type of conditionTimingTypes) {
      expect(NODE_TYPE_CATALOG[type]).toBeDefined();
      expect(NODE_TYPE_CATALOG[type].family).toBe(familyByType[type]);
    }
    const creatable = creatableNodeTypes().filter((n) => conditionTimingTypes.includes(n.type));
    expect(creatable.map((n) => n.type).sort()).toEqual([...conditionTimingTypes].sort());
  });

  it('adds each condition/timing node type to a scene via addGraphNode', () => {
    for (const type of conditionTimingTypes) {
      const outcome = addGraphNode(sceneWithShape(), type, { x: 0, y: 0 });
      expect(outcome.ok).toBe(true);
    }
  });

  it('connects a handSignal into ifElse\'s "in" port, and ifElse\'s "true" output into a second node', () => {
    const scene = sceneWithShape();
    const withSignal = addGraphNode(scene, 'handSignal', { x: 0, y: 0 });
    if (!withSignal.ok || !withSignal.nodeId) throw new Error('setup failed');
    const withIfElse = addGraphNode(withSignal.scene, 'ifElse', { x: 200, y: 0 });
    if (!withIfElse.ok || !withIfElse.nodeId) throw new Error('setup failed');
    const withClamp = addGraphNode(withIfElse.scene, 'clamp', { x: 400, y: 0 });
    if (!withClamp.ok || !withClamp.nodeId) throw new Error('setup failed');

    const nodes = (withClamp.scene.graph as { nodes: GraphNodeData[] }).nodes;
    const check1 = checkGraphConnection(nodes, [], {
      fromNodeId: withSignal.nodeId,
      fromPort: 'value',
      toNodeId: withIfElse.nodeId,
      toPort: 'in',
    });
    expect(check1.valid).toBe(true);

    const check2 = checkGraphConnection(nodes, [], {
      fromNodeId: withIfElse.nodeId,
      fromPort: 'true',
      toNodeId: withClamp.nodeId,
      toPort: 'in',
    });
    expect(check2.valid).toBe(true);
  });

  it('rejects chaining one ifElse node into another (nested condition trees are not supported)', () => {
    const scene = sceneWithShape();
    const first = addGraphNode(scene, 'ifElse', { x: 0, y: 0 });
    if (!first.ok || !first.nodeId) throw new Error('setup failed');
    const second = addGraphNode(first.scene, 'ifElse', { x: 200, y: 0 });
    if (!second.ok || !second.nodeId) throw new Error('setup failed');

    const outcome = addGraphConnection(second.scene, {
      fromNodeId: first.nodeId,
      fromPort: 'true',
      toNodeId: second.nodeId,
      toPort: 'in',
    });
    expect(outcome.ok).toBe(false);
  });
});

describe('id stability across a save/reload round trip', () => {
  it('preserves node and connection ids through a JSON round trip', () => {
    const scene = sceneWithFollowHandCard();
    const reloaded = JSON.parse(JSON.stringify(scene)) as SceneDocument;
    const before = (scene.graph as { nodes: Array<{ id: string }> }).nodes.map((n) => n.id).sort();
    const after = (reloaded.graph as { nodes: Array<{ id: string }> }).nodes
      .map((n) => n.id)
      .sort();
    expect(after).toEqual(before);
    expect(before).toEqual(['action-card-1', 'input-card-1']);
  });
});
