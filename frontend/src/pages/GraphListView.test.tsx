import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { baseScene, circleShape } from '../render/testSceneFixtures';
import type { SceneDocument } from '../api/projects';
import { addGraphConnection, addGraphNode } from './graphEditing';
import GraphListView from './GraphListView';
import { useSceneEditor } from './useSceneEditor';

/**
 * Task 36: rendered tests for the keyboard-operable list-view alternative
 * to the drag-and-drop graph canvas. Covers: typed node/connection
 * rendering, add/remove/reconnect/configure all reachable by normal
 * labeled controls (`userEvent` never simulates a drag here — every
 * interaction is select/click/type), a rejected connection surfaced in
 * text without mutating the graph, and that the resulting scene graph
 * matches what an equivalent sequence of direct `graphEditing.ts` calls
 * (what a drag gesture would ultimately invoke) produces.
 */

function sceneWithShape(): SceneDocument {
  return baseScene({ shapes: [circleShape({ id: 'shape-circle' })] });
}

function Harness({ initial }: { initial: SceneDocument }) {
  const [workingCopy, setWorkingCopy] = useState<SceneDocument | null>(initial);
  const sceneEditor = useSceneEditor(workingCopy, setWorkingCopy);
  return (
    <div>
      <GraphListView sceneEditor={sceneEditor} />
      <pre data-testid="scene-json">{JSON.stringify(workingCopy)}</pre>
    </div>
  );
}

function currentScene(): SceneDocument {
  return JSON.parse(screen.getByTestId('scene-json').textContent ?? '{}') as SceneDocument;
}

describe('GraphListView', () => {
  it('renders typed nodes and connections with clear labels', async () => {
    const scene = sceneWithShape();
    const withA = addGraphNode(scene, 'handSignal', { x: 0, y: 0 });
    if (!withA.ok || !withA.nodeId) throw new Error('setup failed');
    const withB = addGraphNode(withA.scene, 'shapeProperty', { x: 200, y: 0 });
    if (!withB.ok || !withB.nodeId) throw new Error('setup failed');
    const connected = addGraphConnection(withB.scene, {
      fromNodeId: withA.nodeId,
      fromPort: 'value',
      toNodeId: withB.nodeId,
      toPort: 'in',
    });
    if (!connected.ok) throw new Error('setup failed');

    render(<Harness initial={connected.scene} />);

    const nodeList = screen.getByRole('list', { name: 'Graph node list' });
    expect(within(nodeList).getByText('Hand signal')).toBeInTheDocument();
    expect(within(nodeList).getByText('Shape property')).toBeInTheDocument();
    expect(within(nodeList).getByText('Input')).toBeInTheDocument();
    expect(within(nodeList).getByText('Visual')).toBeInTheDocument();

    const connectionList = screen.getByRole('list', { name: 'Graph connection list' });
    expect(within(connectionList).getByText(/\[value\].*\[in\]/)).toBeInTheDocument();
  });

  it('adds a node, adds a connection, and updates canonical scene state entirely via keyboard-operable controls', async () => {
    const user = userEvent.setup();
    render(<Harness initial={sceneWithShape()} />);

    // Add a "Hand signal" (input) node.
    await user.selectOptions(
      screen.getByLabelText('Node type'),
      screen.getByRole('option', { name: 'Input: Hand signal' }),
    );
    await user.click(screen.getByRole('button', { name: 'Add node' }));

    // Add a "Shape property" (visual) node.
    await user.selectOptions(
      screen.getByLabelText('Node type'),
      screen.getByRole('option', { name: 'Visual: Shape property' }),
    );
    await user.click(screen.getByRole('button', { name: 'Add node' }));

    let scene = currentScene();
    const graph = scene.graph as {
      nodes: Array<{ id: string; type: string }>;
      connections: unknown[];
    };
    expect(graph.nodes).toHaveLength(2);
    const handSignalNode = graph.nodes.find((n) => n.type === 'handSignal')!;
    const shapePropertyNode = graph.nodes.find((n) => n.type === 'shapeProperty')!;

    // Wire them together via the add-connection form.
    await user.selectOptions(screen.getByLabelText('From node'), handSignalNode.id);
    await user.selectOptions(screen.getByLabelText('Output port'), 'value');
    await user.selectOptions(screen.getByLabelText('To node'), shapePropertyNode.id);
    await user.selectOptions(screen.getByLabelText('Input port'), 'in');
    await user.click(screen.getByRole('button', { name: 'Add connection' }));

    scene = currentScene();
    const nextGraph = scene.graph as {
      connections: Array<{
        fromNodeId: string;
        fromPort: string;
        toNodeId: string;
        toPort: string;
      }>;
    };
    expect(nextGraph.connections).toHaveLength(1);
    expect(nextGraph.connections[0]).toMatchObject({
      fromNodeId: handSignalNode.id,
      fromPort: 'value',
      toNodeId: shapePropertyNode.id,
      toPort: 'in',
    });

    // Remove the connection, then the nodes — all through keyboard-operable buttons.
    await user.click(screen.getByRole('button', { name: 'Remove connection' }));
    scene = currentScene();
    expect((scene.graph as { connections: unknown[] }).connections).toHaveLength(0);

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete node' });
    await user.click(deleteButtons[0]);
    await user.click(screen.getByRole('button', { name: 'Delete node' }));
    scene = currentScene();
    expect((scene.graph as { nodes: unknown[] }).nodes).toHaveLength(0);
  });

  it('configuring a node field updates canonical scene state', async () => {
    const user = userEvent.setup();
    const scene = sceneWithShape();
    const withA = addGraphNode(scene, 'handSignal', { x: 0, y: 0 });
    if (!withA.ok) throw new Error('setup failed');

    render(<Harness initial={withA.scene} />);

    const signalField = screen.getByLabelText('Signal name');
    await user.clear(signalField);
    await user.type(signalField, 'palmY');

    const result = currentScene();
    const graph = result.graph as {
      nodes: Array<{ type: string; params: Record<string, unknown> }>;
    };
    const node = graph.nodes.find((n) => n.type === 'handSignal')!;
    expect(node.params.signal).toBe('palmY');
  });

  it('Task 37: adds a transform node (Map range) via the keyboard-operable node-type select', async () => {
    const user = userEvent.setup();
    render(<Harness initial={sceneWithShape()} />);

    await user.selectOptions(
      screen.getByLabelText('Node type'),
      screen.getByRole('option', { name: 'Transform: Map range' }),
    );
    await user.click(screen.getByRole('button', { name: 'Add node' }));

    const nodeList = screen.getByRole('list', { name: 'Graph node list' });
    expect(within(nodeList).getByText('Map range')).toBeInTheDocument();
    expect(within(nodeList).getByText('Transform')).toBeInTheDocument();

    const scene = currentScene();
    const graph = scene.graph as {
      nodes: Array<{ type: string; params: Record<string, unknown> }>;
    };
    const node = graph.nodes.find((n) => n.type === 'mapRange')!;
    expect(node).toBeDefined();
    // Default params are numbers/booleans, not strings — the schema only
    // accepts number/string/boolean/null leaves, and the runtime's math
    // reads them with `typeof === 'number'`.
    expect(node.params).toEqual({ inMin: 0, inMax: 1, outMin: 0, outMax: 1, clampOutput: true });
  });

  it('Task 37: editing a numeric transform param field updates canonical scene state as a number', async () => {
    const user = userEvent.setup();
    const scene = sceneWithShape();
    const withMapRange = addGraphNode(scene, 'mapRange', { x: 0, y: 0 });
    if (!withMapRange.ok) throw new Error('setup failed');

    render(<Harness initial={withMapRange.scene} />);

    const outMaxField = screen.getByLabelText('Output max');
    await user.clear(outMaxField);
    await user.type(outMaxField, '250');

    const result = currentScene();
    const graph = result.graph as {
      nodes: Array<{ type: string; params: Record<string, unknown> }>;
    };
    const node = graph.nodes.find((n) => n.type === 'mapRange')!;
    expect(node.params.outMax).toBe(250);
    expect(typeof node.params.outMax).toBe('number');
  });

  it('rejects an invalid connection in text and leaves the graph completely unchanged', async () => {
    const user = userEvent.setup();
    const scene = sceneWithShape();
    const withA = addGraphNode(scene, 'handSignal', { x: 0, y: 0 }); // out: value
    if (!withA.ok || !withA.nodeId) throw new Error('setup failed');
    const withB = addGraphNode(withA.scene, 'trigger', { x: 200, y: 0 }); // in: trigger (event)
    if (!withB.ok || !withB.nodeId) throw new Error('setup failed');

    render(<Harness initial={withB.scene} />);
    const before = currentScene();

    await user.selectOptions(screen.getByLabelText('From node'), withA.nodeId);
    await user.selectOptions(screen.getByLabelText('Output port'), 'value');
    await user.selectOptions(screen.getByLabelText('To node'), withB.nodeId);
    await user.selectOptions(screen.getByLabelText('Input port'), 'trigger');
    await user.click(screen.getByRole('button', { name: 'Add connection' }));

    // Rejected with a visible text explanation...
    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((el) => /value|event/i.test(el.textContent ?? ''))).toBe(true);

    // ...and the graph is completely unchanged (all-or-nothing).
    const after = currentScene();
    expect(after.graph).toEqual(before.graph);
  });

  it('produces the same scene graph as an equivalent direct graphEditing sequence (drag equivalent)', async () => {
    const user = userEvent.setup();
    render(<Harness initial={sceneWithShape()} />);

    await user.selectOptions(
      screen.getByLabelText('Node type'),
      screen.getByRole('option', { name: 'Input: Hand signal' }),
    );
    await user.click(screen.getByRole('button', { name: 'Add node' }));
    await user.selectOptions(
      screen.getByLabelText('Node type'),
      screen.getByRole('option', { name: 'Visual: Shape property' }),
    );
    await user.click(screen.getByRole('button', { name: 'Add node' }));

    let scene = currentScene();
    let graph = scene.graph as { nodes: Array<{ id: string; type: string }> };
    const a = graph.nodes.find((n) => n.type === 'handSignal')!;
    const b = graph.nodes.find((n) => n.type === 'shapeProperty')!;

    await user.selectOptions(screen.getByLabelText('From node'), a.id);
    await user.selectOptions(screen.getByLabelText('Output port'), 'value');
    await user.selectOptions(screen.getByLabelText('To node'), b.id);
    await user.selectOptions(screen.getByLabelText('Input port'), 'in');
    await user.click(screen.getByRole('button', { name: 'Add connection' }));

    scene = currentScene();
    graph = scene.graph as { nodes: Array<{ id: string; type: string }> };
    const connections = scene.graph as { connections: Array<{ fromPort: string; toPort: string }> };

    // Equivalent direct-call ("drag") sequence, same starting scene shape.
    const direct1 = addGraphNode(sceneWithShape(), 'handSignal', { x: 0, y: 0 });
    if (!direct1.ok || !direct1.nodeId) throw new Error('setup failed');
    const direct2 = addGraphNode(direct1.scene, 'shapeProperty', { x: 200, y: 0 });
    if (!direct2.ok || !direct2.nodeId) throw new Error('setup failed');
    const direct3 = addGraphConnection(direct2.scene, {
      fromNodeId: direct1.nodeId,
      fromPort: 'value',
      toNodeId: direct2.nodeId,
      toPort: 'in',
    });
    if (!direct3.ok) throw new Error('setup failed');
    const directGraph = direct3.scene.graph as {
      nodes: Array<{ type: string }>;
      connections: Array<{ fromPort: string; toPort: string }>;
    };

    // Same topology (ids are randomly generated per-run, so compare
    // structure: node type multiset and connection port-pairs).
    expect(graph.nodes.map((n) => n.type).sort()).toEqual(
      directGraph.nodes.map((n) => n.type).sort(),
    );
    expect(connections.connections.map((c) => `${c.fromPort}->${c.toPort}`)).toEqual(
      directGraph.connections.map((c) => `${c.fromPort}->${c.toPort}`),
    );
  });
});
