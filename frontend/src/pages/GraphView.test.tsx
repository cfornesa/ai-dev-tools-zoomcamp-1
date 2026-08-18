import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { baseScene, circleShape } from '../render/testSceneFixtures';
import type { SceneDocument } from '../api/projects';
import { addGraphConnection, addGraphNode } from './graphEditing';
import GraphView from './GraphView';
import { useSceneEditor } from './useSceneEditor';

/**
 * Task 36: a light rendered smoke test for the React Flow canvas —
 * confirms typed nodes/handles/labels actually render for allowed node
 * families. Full interaction coverage (add/remove/reconnect/configure,
 * connection validation, all-or-nothing rejection, id stability,
 * equivalence to the list view) lives in `graphEditing.test.ts`,
 * `useSceneEditor.graph.test.ts`, and `GraphListView.test.tsx` — those
 * exercise the exact same `sceneEditor` actions this canvas calls on drag/
 * connect/delete, so they cover this component's behavior without needing
 * to simulate real pointer drags against React Flow's canvas (not
 * meaningfully drivable through jsdom).
 */

// jsdom has no ResizeObserver; React Flow requires one to measure nodes.
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

function sceneWithShape(): SceneDocument {
  return baseScene({ shapes: [circleShape({ id: 'shape-circle' })] });
}

function Harness({ initial }: { initial: SceneDocument }) {
  const [workingCopy, setWorkingCopy] = useState<SceneDocument | null>(initial);
  const sceneEditor = useSceneEditor(workingCopy, setWorkingCopy);
  return <GraphView sceneEditor={sceneEditor} />;
}

describe('GraphView', () => {
  it('renders allowed input/visual/flow nodes with typed handles and clear labels', () => {
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

    expect(screen.getByText('Hand signal')).toBeInTheDocument();
    expect(screen.getByText('Shape property')).toBeInTheDocument();
    expect(screen.getByTestId('graph-editor-canvas')).toBeInTheDocument();

    // React Flow renders each Handle as an element carrying its data type.
    const valueHandles = document.querySelectorAll('[data-datatype="value"]');
    expect(valueHandles.length).toBeGreaterThan(0);
  });

  it('offers every allowed creatable node type in the add-node control', () => {
    render(<Harness initial={sceneWithShape()} />);
    expect(screen.getByRole('option', { name: 'Input: Hand signal' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Visual: Shape property' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Flow: Trigger' })).toBeInTheDocument();
  });
});
