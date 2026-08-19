import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  type Connection,
  type Edge,
  type FinalConnectionState,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  FAMILY_LABELS,
  NODE_TYPE_CATALOG,
  checkGraphConnection,
  describeRejectedDragConnection,
} from './graphEditing';
import NodeParamFields from './NodeParamFields';
import type { SceneEditor } from './useSceneEditor';

/**
 * Task 36: the drag-and-drop graph view, built on React Flow
 * (`@xyflow/react`). Every mutation (add node, delete node/connection,
 * connect, move, configure) is delegated straight to `sceneEditor`'s Task
 * 36 actions (`graphEditing.ts`'s pure functions under the hood) — this
 * component never writes `workingCopy`/`scene.graph` itself, so it can
 * never disagree with `GraphListView.tsx`'s keyboard-operable alternative
 * about what a given action produces.
 *
 * Node positions are mirrored into local `nodes` state so dragging feels
 * live (React Flow expects to own position during a drag), but the source
 * of truth is always `sceneEditor.graphNodes`: the mirror re-syncs from it
 * whenever the scene's node set/positions change from elsewhere (undo,
 * list-view edit, add/remove), and a completed drag is written back via
 * `sceneEditor.moveGraphNode` — never kept only in local React state. This
 * is what keeps ids and positions stable across a save/reload (the scene
 * is always the actual source of truth) while still feeling responsive.
 */

type TypedNodeData = {
  label: string;
  family: string;
  type: string;
  inputs: Array<{ port: string; label: string; dataType: string }>;
  outputs: Array<{ port: string; label: string; dataType: string }>;
};

function TypedNode({ data, selected }: NodeProps<Node<TypedNodeData>>) {
  return (
    <div
      className={`graph-editor-node${selected ? ' graph-editor-node-selected' : ''}`}
      data-family={data.family}
    >
      <div className="graph-editor-node-family">
        {FAMILY_LABELS[data.family as never] ?? data.family}
      </div>
      <div className="graph-editor-node-label">{data.label}</div>
      {data.inputs.map((input, index) => (
        <Handle
          key={input.port}
          type="target"
          position={Position.Left}
          id={input.port}
          data-datatype={input.dataType}
          style={{ top: 28 + index * 16 }}
          title={`${input.label} (${input.dataType})`}
        />
      ))}
      {data.outputs.map((output, index) => (
        <Handle
          key={output.port}
          type="source"
          position={Position.Right}
          id={output.port}
          data-datatype={output.dataType}
          style={{ top: 28 + index * 16 }}
          title={`${output.label} (${output.dataType})`}
        />
      ))}
    </div>
  );
}

const NODE_TYPES = { typed: TypedNode };

function toFlowNode(node: {
  id: string;
  type: string;
  position: { x: number; y: number };
}): Node<TypedNodeData> {
  const info = NODE_TYPE_CATALOG[node.type];
  return {
    id: node.id,
    type: 'typed',
    position: node.position,
    data: {
      label: info?.label ?? node.type,
      family: info?.family ?? 'input',
      type: node.type,
      inputs: info?.inputs ?? [],
      outputs: info?.outputs ?? [],
    },
  };
}

function GraphViewInner({ sceneEditor }: { sceneEditor: SceneEditor }) {
  const [nodes, setNodes] = useState<Node<TypedNodeData>[]>(() =>
    sceneEditor.graphNodes.map(toFlowNode),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [newNodeType, setNewNodeType] = useState<string>(Object.keys(NODE_TYPE_CATALOG)[0] ?? '');
  // Task 63 (issue #62) audit fix: `isValidConnection` silently blocks an
  // invalid drag-to-connect on the canvas — React Flow gives it only
  // color/cursor styling during the drag, with no text announced to a
  // screen reader and nothing left behind once the drag ends. This mirrors
  // `checkGraphConnection`'s error text (the same message the keyboard
  // list-view alternative already shows via `connectionPreviewError`) into
  // an `aria-live` region whenever a drag ends over a handle but the
  // resulting connection was rejected, so the failure is announced, not
  // just implied by the connection line vanishing.
  const [dragConnectionError, setDragConnectionError] = useState<string | null>(null);

  // Re-sync the local drag-mirror whenever the canonical graph node set or
  // any node's saved position changes from outside a live drag (add,
  // remove, undo/redo, list-view edit, initial load).
  useEffect(() => {
    setNodes(sceneEditor.graphNodes.map(toFlowNode));
  }, [sceneEditor.graphNodes]);

  const edges = useMemo<Edge[]>(
    () =>
      sceneEditor.graphConnections.map((connection) => ({
        id: connection.id,
        source: connection.fromNodeId,
        sourceHandle: connection.fromPort,
        target: connection.toNodeId,
        targetHandle: connection.toPort,
      })),
    [sceneEditor.graphConnections],
  );

  const onNodesChange = useCallback((changes: NodeChange<Node<TypedNodeData>>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node<TypedNodeData>) => {
      sceneEditor.moveGraphNode(node.id, node.position);
    },
    [sceneEditor],
  );

  const isValidConnection = useCallback(
    (connectionOrEdge: Connection | Edge) => {
      const source = 'source' in connectionOrEdge ? connectionOrEdge.source : undefined;
      const target = 'target' in connectionOrEdge ? connectionOrEdge.target : undefined;
      const sourceHandle =
        'sourceHandle' in connectionOrEdge ? connectionOrEdge.sourceHandle : undefined;
      const targetHandle =
        'targetHandle' in connectionOrEdge ? connectionOrEdge.targetHandle : undefined;
      if (!source || !target || !sourceHandle || !targetHandle) return false;
      return checkGraphConnection(sceneEditor.graphNodes, sceneEditor.graphConnections, {
        fromNodeId: source,
        fromPort: sourceHandle,
        toNodeId: target,
        toPort: targetHandle,
      }).valid;
    },
    [sceneEditor.graphNodes, sceneEditor.graphConnections],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.sourceHandle || !connection.targetHandle) return;
      setDragConnectionError(null);
      sceneEditor.addGraphConnection({
        fromNodeId: connection.source,
        fromPort: connection.sourceHandle,
        toNodeId: connection.target,
        toPort: connection.targetHandle,
      });
    },
    [sceneEditor],
  );

  const onConnectEnd = useCallback(
    (_event: unknown, connectionState: FinalConnectionState) => {
      // A drag that never reached a handle (dropped on empty canvas) is a
      // cancelled gesture, not a rejected connection — nothing to announce.
      if (!connectionState.toHandle || !connectionState.fromHandle) return;
      // A successful connection already went through `onConnect` above and
      // cleared this state; only a drag that ended over a handle but was
      // never accepted needs a message.
      if (connectionState.isValid) return;
      setDragConnectionError(
        describeRejectedDragConnection(
          sceneEditor.graphNodes,
          sceneEditor.graphConnections,
          connectionState.fromHandle,
          connectionState.toHandle,
        ),
      );
    },
    [sceneEditor.graphNodes, sceneEditor.graphConnections],
  );

  const selectedNode = sceneEditor.graphNodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="graph-editor">
      <div role="group" aria-label="Add graph node" className="editor-tool-group">
        <label htmlFor="graph-editor-new-node-type">Node type</label>
        <select
          id="graph-editor-new-node-type"
          value={newNodeType}
          onChange={(event) => setNewNodeType(event.target.value)}
        >
          {Object.entries(NODE_TYPE_CATALOG).map(([type, info]) => (
            <option key={type} value={type}>
              {FAMILY_LABELS[info.family]}: {info.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (!newNodeType) return;
            const offset = sceneEditor.graphNodes.length;
            sceneEditor.addGraphNode(newNodeType, {
              x: (offset % 5) * 180,
              y: Math.floor(offset / 5) * 120,
            });
          }}
        >
          Add node to graph
        </button>
      </div>

      {sceneEditor.graphError && (
        <p role="alert" aria-live="assertive">
          {sceneEditor.graphError}
        </p>
      )}

      {dragConnectionError && (
        <p role="alert" aria-live="assertive" data-testid="graph-drag-connection-error">
          {dragConnectionError}
        </p>
      )}

      <div className="graph-editor-canvas" data-testid="graph-editor-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          isValidConnection={isValidConnection}
          onEdgeClick={(_event, edge) => {
            if (window.confirm('Remove this connection?'))
              sceneEditor.removeGraphConnection(edge.id);
          }}
          fitView
        >
          <Background />
        </ReactFlow>
      </div>

      {selectedNode && (
        <div className="graph-editor-node-config" aria-label={`Configure ${selectedNode.type}`}>
          <h5>Configure node</h5>
          <p>
            {NODE_TYPE_CATALOG[selectedNode.type]?.label ?? selectedNode.type} ({selectedNode.id})
          </p>
          <NodeParamFields
            type={selectedNode.type}
            params={selectedNode.params}
            idPrefix={`graph-node-${selectedNode.id}`}
            onChange={(key, value) =>
              sceneEditor.updateGraphNodeParams(selectedNode.id, { [key]: value })
            }
          />
          <button type="button" onClick={() => sceneEditor.removeGraphNode(selectedNode.id)}>
            Delete node
          </button>
        </div>
      )}
    </div>
  );
}

/** Wraps `GraphViewInner` in `ReactFlowProvider`, required by React Flow
 * whenever hooks like `useReactFlow` might be used by children (none are
 * today, but this is the documented-safe default and costs nothing). */
function GraphView({ sceneEditor }: { sceneEditor: SceneEditor }) {
  return (
    <ReactFlowProvider>
      <GraphViewInner sceneEditor={sceneEditor} />
    </ReactFlowProvider>
  );
}

export default GraphView;
