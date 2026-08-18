import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { baseScene, circleShape } from '../render/testSceneFixtures';
import type { SceneDocument } from '../api/projects';
import { bindingForCard, graphFragmentForCard, type FollowHandCard } from './behaviorCards';
import { useSceneEditor } from './useSceneEditor';

/**
 * Task 36: hook-level tests for `useSceneEditor`'s graph-editing wiring —
 * every graph action commits exactly one undo/redo step (or none, on
 * rejection), `graphError` surfaces rejections without touching scene
 * state, and card sync/cascade works through the hook the same way it
 * does in `graphEditing.test.ts`'s direct pure-logic tests.
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

function renderSceneEditor(initial: SceneDocument) {
  return renderHook(() => {
    const [workingCopy, setWorkingCopy] = useState<SceneDocument | null>(initial);
    const editor = useSceneEditor(workingCopy, setWorkingCopy);
    return { workingCopy, ...editor };
  });
}

describe('useSceneEditor graph editing', () => {
  it('starts with the graph nodes/connections already in the scene', () => {
    const { result } = renderSceneEditor(sceneWithFollowHandCard());
    expect(result.current.graphNodes).toHaveLength(2);
    expect(result.current.graphConnections).toHaveLength(1);
    expect(result.current.graphError).toBeNull();
  });

  it('addGraphNode commits one undoable step and assigns an id', () => {
    const { result } = renderSceneEditor(sceneWithShape());
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.addGraphNode('handSignal', { x: 0, y: 0 }));
    expect(result.current.graphNodes).toHaveLength(1);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.graphNodes).toHaveLength(0);

    act(() => result.current.redo());
    expect(result.current.graphNodes).toHaveLength(1);
  });

  it('addGraphConnection accepts a valid connection and rejects an invalid one without mutating', () => {
    const { result } = renderSceneEditor(sceneWithShape());
    act(() => result.current.addGraphNode('handSignal', { x: 0, y: 0 }));
    const sourceId = result.current.graphNodes[0].id;
    act(() => result.current.addGraphNode('shapeProperty', { x: 200, y: 0 }));
    const targetId = result.current.graphNodes.find((n) => n.id !== sourceId)!.id;

    act(() =>
      result.current.addGraphConnection({
        fromNodeId: sourceId,
        fromPort: 'value',
        toNodeId: targetId,
        toPort: 'in',
      }),
    );
    expect(result.current.graphConnections).toHaveLength(1);
    expect(result.current.graphError).toBeNull();

    const connectionCountBefore = result.current.graphConnections.length;
    const nodeCountBefore = result.current.graphNodes.length;
    act(() =>
      result.current.addGraphConnection({
        fromNodeId: sourceId,
        fromPort: 'value',
        toNodeId: targetId,
        toPort: 'notAPort',
      }),
    );
    expect(result.current.graphError).not.toBeNull();
    // Rejected connection: no partial mutation.
    expect(result.current.graphConnections).toHaveLength(connectionCountBefore);
    expect(result.current.graphNodes).toHaveLength(nodeCountBefore);
  });

  it('removing a card-owned node cascades and removes the behavior card too', () => {
    const { result } = renderSceneEditor(sceneWithFollowHandCard());
    expect(result.current.behaviorCards).toHaveLength(1);

    act(() => result.current.removeGraphNode('input-card-1'));
    expect(result.current.behaviorCards).toHaveLength(0);
    expect(result.current.graphNodes).toHaveLength(0);
    expect(result.current.graphConnections).toHaveLength(0);
  });

  it('updating a card-owned node syncs the underlying behavior card', () => {
    const { result } = renderSceneEditor(sceneWithFollowHandCard());
    expect(result.current.behaviorCards).toHaveLength(1);

    act(() => result.current.updateGraphNodeParams('input-card-1', { handTarget: 'right' }));
    expect(result.current.graphError).toBeNull();
    const binding = (result.current.workingCopy!.bindings as Array<Record<string, unknown>>).find(
      (b) => b.id === 'card-1',
    );
    expect(binding?.handTarget).toBe('right');
  });

  it('moveGraphNode updates position without creating a new node id', () => {
    const { result } = renderSceneEditor(sceneWithShape());
    act(() => result.current.addGraphNode('handSignal', { x: 0, y: 0 }));
    const id = result.current.graphNodes[0].id;

    act(() => result.current.moveGraphNode(id, { x: 50, y: 60 }));
    expect(result.current.graphNodes).toHaveLength(1);
    expect(result.current.graphNodes[0].id).toBe(id);
    expect(result.current.graphNodes[0].position).toEqual({ x: 50, y: 60 });
  });
});
