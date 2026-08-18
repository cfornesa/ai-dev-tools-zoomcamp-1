import { useState } from 'react';

import { FAMILY_LABELS, NODE_TYPE_CATALOG, checkGraphConnection } from './graphEditing';
import NodeParamFields from './NodeParamFields';
import type { SceneEditor } from './useSceneEditor';

/**
 * Task 36: the keyboard-operable list-view alternative to `GraphView.tsx`'s
 * drag-and-drop canvas — `_docs/plan.md`'s "Provide an accessible scene-
 * outline/list view that can fully substitute for canvas drag-and-drop and
 * graph manipulation." Every control here is a normal labeled form
 * control/button reachable by Tab, and every action calls the exact same
 * `sceneEditor` functions `GraphView.tsx` calls
 * (`addGraphNode`/`removeGraphNode`/`addGraphConnection`/
 * `removeGraphConnection`/`updateGraphNodeParams`), so a sequence of
 * list-view actions and an equivalent drag sequence always produce
 * identical scene graphs — see `graphEditing.test.ts` and
 * `GraphListView.test.tsx` for the equivalence checks.
 *
 * Node position/layout (React Flow drag) has no list-view equivalent
 * because `_docs/plan.md`'s schema note on `graphNode.position` is
 * explicit that it's "editor-only graph layout position; has no effect on
 * runtime behavior" — so the list view never needs to expose it to
 * "produce the same valid graph."
 */
function GraphListView({ sceneEditor }: { sceneEditor: SceneEditor }) {
  const [newNodeType, setNewNodeType] = useState<string>(Object.keys(NODE_TYPE_CATALOG)[0] ?? '');
  const [fromNodeId, setFromNodeId] = useState<string>('');
  const [fromPort, setFromPort] = useState<string>('');
  const [toNodeId, setToNodeId] = useState<string>('');
  const [toPort, setToPort] = useState<string>('');
  const [connectionPreviewError, setConnectionPreviewError] = useState<string | null>(null);

  const nodeLabel = (nodeId: string): string => {
    const node = sceneEditor.graphNodes.find((n) => n.id === nodeId);
    if (!node) return nodeId;
    return `${NODE_TYPE_CATALOG[node.type]?.label ?? node.type} (${nodeId.slice(0, 8)})`;
  };

  const sourceCandidates = sceneEditor.graphNodes.filter(
    (n) => (NODE_TYPE_CATALOG[n.type]?.outputs.length ?? 0) > 0,
  );
  const targetCandidates = sceneEditor.graphNodes.filter(
    (n) => (NODE_TYPE_CATALOG[n.type]?.inputs.length ?? 0) > 0,
  );
  const fromNode = sceneEditor.graphNodes.find((n) => n.id === fromNodeId) ?? null;
  const toNode = sceneEditor.graphNodes.find((n) => n.id === toNodeId) ?? null;
  const fromPortOptions = fromNode ? (NODE_TYPE_CATALOG[fromNode.type]?.outputs ?? []) : [];
  const toPortOptions = toNode ? (NODE_TYPE_CATALOG[toNode.type]?.inputs ?? []) : [];

  function handleAddNode() {
    if (!newNodeType) return;
    const offset = sceneEditor.graphNodes.length;
    sceneEditor.addGraphNode(newNodeType, {
      x: (offset % 5) * 180,
      y: Math.floor(offset / 5) * 120,
    });
  }

  function handleAddConnection() {
    if (!fromNodeId || !fromPort || !toNodeId || !toPort) return;
    const check = checkGraphConnection(sceneEditor.graphNodes, sceneEditor.graphConnections, {
      fromNodeId,
      fromPort,
      toNodeId,
      toPort,
    });
    if (!check.valid) {
      setConnectionPreviewError(check.error ?? 'Invalid connection.');
      return;
    }
    setConnectionPreviewError(null);
    sceneEditor.addGraphConnection({ fromNodeId, fromPort, toNodeId, toPort });
  }

  return (
    <div className="graph-list-view">
      <h4>Graph list view</h4>
      <p>
        A fully keyboard-operable alternative to the graph canvas above. Every add, delete,
        reconnect, and configure action here does the same thing dragging in the canvas does.
      </p>

      {sceneEditor.graphError && (
        <p role="alert" aria-live="assertive">
          {sceneEditor.graphError}
        </p>
      )}

      <section aria-label="Add graph node">
        <h5>Add a node</h5>
        <div className="behavior-card-field">
          <label htmlFor="graph-list-new-node-type">Node type</label>
          <select
            id="graph-list-new-node-type"
            value={newNodeType}
            onChange={(event) => setNewNodeType(event.target.value)}
          >
            {Object.entries(NODE_TYPE_CATALOG).map(([type, info]) => (
              <option key={type} value={type}>
                {FAMILY_LABELS[info.family]}: {info.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={handleAddNode} disabled={!newNodeType}>
          Add node
        </button>
      </section>

      <section aria-label="Graph nodes">
        <h5>Nodes in this graph</h5>
        {sceneEditor.graphNodes.length === 0 ? (
          <p>No graph nodes yet.</p>
        ) : (
          <ul aria-label="Graph node list" className="graph-list-node-list">
            {sceneEditor.graphNodes.map((node) => (
              <li key={node.id}>
                <span className="graph-list-node-family">
                  {FAMILY_LABELS[node.family as never] ?? node.family}
                </span>
                <span className="graph-list-node-type">
                  {NODE_TYPE_CATALOG[node.type]?.label ?? node.type}
                </span>
                <span className="graph-list-node-id">id: {node.id}</span>
                <NodeParamFields
                  type={node.type}
                  params={node.params}
                  idPrefix={`graph-list-node-${node.id}`}
                  onChange={(key, value) =>
                    sceneEditor.updateGraphNodeParams(node.id, { [key]: value })
                  }
                />
                <button type="button" onClick={() => sceneEditor.removeGraphNode(node.id)}>
                  Delete node
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Add graph connection">
        <h5>Add a connection</h5>
        <form
          aria-label="Add connection"
          onSubmit={(event) => {
            event.preventDefault();
            handleAddConnection();
          }}
        >
          <div className="behavior-card-field">
            <label htmlFor="graph-list-from-node">From node</label>
            <select
              id="graph-list-from-node"
              value={fromNodeId}
              onChange={(event) => {
                setFromNodeId(event.target.value);
                setFromPort('');
              }}
            >
              <option value="">Select a node</option>
              {sourceCandidates.map((node) => (
                <option key={node.id} value={node.id}>
                  {nodeLabel(node.id)}
                </option>
              ))}
            </select>
          </div>
          <div className="behavior-card-field">
            <label htmlFor="graph-list-from-port">Output port</label>
            <select
              id="graph-list-from-port"
              value={fromPort}
              onChange={(event) => setFromPort(event.target.value)}
              disabled={!fromNode}
            >
              <option value="">Select a port</option>
              {fromPortOptions.map((port) => (
                <option key={port.port} value={port.port}>
                  {port.label} ({port.dataType})
                </option>
              ))}
            </select>
          </div>
          <div className="behavior-card-field">
            <label htmlFor="graph-list-to-node">To node</label>
            <select
              id="graph-list-to-node"
              value={toNodeId}
              onChange={(event) => {
                setToNodeId(event.target.value);
                setToPort('');
              }}
            >
              <option value="">Select a node</option>
              {targetCandidates.map((node) => (
                <option key={node.id} value={node.id}>
                  {nodeLabel(node.id)}
                </option>
              ))}
            </select>
          </div>
          <div className="behavior-card-field">
            <label htmlFor="graph-list-to-port">Input port</label>
            <select
              id="graph-list-to-port"
              value={toPort}
              onChange={(event) => setToPort(event.target.value)}
              disabled={!toNode}
            >
              <option value="">Select a port</option>
              {toPortOptions.map((port) => (
                <option key={port.port} value={port.port}>
                  {port.label} ({port.dataType})
                </option>
              ))}
            </select>
          </div>
          {connectionPreviewError && (
            <p role="alert" aria-live="assertive">
              {connectionPreviewError}
            </p>
          )}
          <button type="submit" disabled={!fromNodeId || !fromPort || !toNodeId || !toPort}>
            Add connection
          </button>
        </form>
      </section>

      <section aria-label="Graph connections">
        <h5>Connections in this graph</h5>
        {sceneEditor.graphConnections.length === 0 ? (
          <p>No connections yet.</p>
        ) : (
          <ul aria-label="Graph connection list" className="graph-list-connection-list">
            {sceneEditor.graphConnections.map((connection) => (
              <li key={connection.id}>
                <span>
                  {nodeLabel(connection.fromNodeId)} [{connection.fromPort}] &rarr;{' '}
                  {nodeLabel(connection.toNodeId)} [{connection.toPort}]
                </span>
                <button
                  type="button"
                  onClick={() => sceneEditor.removeGraphConnection(connection.id)}
                >
                  Remove connection
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default GraphListView;
