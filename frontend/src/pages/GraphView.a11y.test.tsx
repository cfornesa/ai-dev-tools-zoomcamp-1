import { render } from '@testing-library/react';
import { useState } from 'react';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { baseScene, circleShape } from '../render/testSceneFixtures';
import type { SceneDocument } from '../api/projects';
import { addGraphConnection, addGraphNode } from './graphEditing';
import GraphListView from './GraphListView';
import GraphView from './GraphView';
import { useSceneEditor } from './useSceneEditor';

/**
 * Task 63 (issue #62): automated accessibility checks (axe-core, via
 * `jest-axe`, already wired globally in `setupTests.ts` by Task 64/issue
 * #64) for the graph canvas (`GraphView.tsx`) and its keyboard-operable
 * list-view alternative (`GraphListView.tsx`) — the "graph canvas and list
 * view, node configuration/connections" surfaces named by this issue's
 * audit matrix.
 *
 * `axe` cannot verify that a real pointer drag on the React Flow canvas is
 * operable — canvas drag is inherently pointer-only by design, with
 * `GraphListView` as its documented full keyboard substitute (see that
 * file's own doc comment and `graphEditing.test.ts`'s equivalence tests).
 * What this file checks instead is that every rendered control (add-node
 * form, node param fields, connection list/form, delete/remove buttons, and
 * both live error regions) has valid names/roles/states in realistic
 * non-empty states.
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

function sceneWithGraph(): SceneDocument {
  const scene = baseScene({ shapes: [circleShape({ id: 'shape-circle' })] });
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
  return connected.scene;
}

function GraphViewHarness({ initial }: { initial: SceneDocument }) {
  const [workingCopy, setWorkingCopy] = useState<SceneDocument | null>(initial);
  const sceneEditor = useSceneEditor(workingCopy, setWorkingCopy);
  return <GraphView sceneEditor={sceneEditor} />;
}

function GraphListViewHarness({ initial }: { initial: SceneDocument }) {
  const [workingCopy, setWorkingCopy] = useState<SceneDocument | null>(initial);
  const sceneEditor = useSceneEditor(workingCopy, setWorkingCopy);
  return <GraphListView sceneEditor={sceneEditor} />;
}

describe('GraphView / GraphListView accessibility', () => {
  it('GraphView with nodes and a connection has no axe violations', async () => {
    const { container } = render(<GraphViewHarness initial={sceneWithGraph()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('GraphView with an empty graph has no axe violations', async () => {
    const { container } = render(
      <GraphViewHarness initial={baseScene({ shapes: [circleShape({ id: 'shape-circle' })] })} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('GraphListView with nodes and a connection has no axe violations', async () => {
    const { container } = render(<GraphListViewHarness initial={sceneWithGraph()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('GraphListView with an empty graph has no axe violations', async () => {
    const { container } = render(
      <GraphListViewHarness
        initial={baseScene({ shapes: [circleShape({ id: 'shape-circle' })] })}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
