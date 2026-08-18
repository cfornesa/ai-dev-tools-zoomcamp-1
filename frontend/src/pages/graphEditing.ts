/**
 * Task 36: pure graph-editing logic shared by `GraphView.tsx` (the React
 * Flow drag-and-drop editor) and `GraphListView.tsx` (its keyboard-operable
 * list-view alternative). Neither component talks to `scene.graph`
 * directly — both call the functions below, so a drag-and-drop action and
 * its list-view equivalent always produce byte-for-byte the same scene
 * mutation (see `graphEditing.test.ts`'s equivalence tests).
 *
 * ## Single source of truth for connection validity
 *
 * `checkGraphConnection` reuses `frontend/src/runtime/behaviorRuntime.ts`'s
 * exported `ALLOWED_NODE_TYPES_BY_FAMILY`, `NODE_PORTS`, and `findCycle` —
 * the exact allowlist/port-compatibility/cycle-detection rules
 * `validateBehaviorGraph` enforces — instead of re-implementing a second
 * copy that could drift. It adds one purely *additive* restriction on top
 * (matching each port's data type, "value" vs "event") that never accepts
 * a connection `validateBehaviorGraph` would reject, only narrows further,
 * so the UI can never construct something the runtime rejects.
 *
 * Every mutating function here (`addGraphNode`, `removeGraphNode`,
 * `addGraphConnection`, `removeGraphConnection`, `updateGraphNodeParams`,
 * `moveGraphNode`) builds the *entire* candidate next scene and validates
 * it with `validateBehaviorGraph` before returning `{ ok: true, scene }` —
 * an invalid candidate returns `{ ok: false, error }` and the caller never
 * sees (or applies) a partially-mutated scene. This is what satisfies the
 * issue's "do not partially mutate the graph" acceptance criterion.
 *
 * ## Node/connection ids are stable
 *
 * New node ids are `crypto.randomUUID()` (matching every other id in this
 * codebase — see `behaviorCards.ts`, `sceneShapes.ts`). Nothing here ever
 * regenerates an existing node/connection id — `moveGraphNode` and
 * `updateGraphNodeParams` only ever replace the matching array entry in
 * place, keyed by the id the caller already has. This is what satisfies
 * "reloading preserves ... stable node identifiers": the id round-trips
 * through `SceneDocument.graph.nodes[].id` exactly as saved.
 *
 * ## Behavior-card sync
 *
 * Task 34's behavior cards each own a small subgraph tagged
 * `input-<cardId>` / `action-<cardId>` / `conn-<cardId>`
 * (`behaviorCards.ts`'s `graphFragmentForCard`). To keep a card and its
 * graph structure from ever disagreeing:
 *  - Configuring an `input-<cardId>`/`action-<cardId>` node's params also
 *    patches the matching fields on the card's underlying binding (see
 *    `updateGraphNodeParams`), so the card panel and the graph view always
 *    describe the same behavior.
 *  - Deleting an `input-<cardId>`/`action-<cardId>` node, or the
 *    `conn-<cardId>` connection between them, removes the *entire* card
 *    (binding + both nodes + the connection) via `behaviorCards.ts`'s
 *    `removeCardFromScene` rather than leaving an orphaned half-card. This
 *    is a deliberate, documented product decision (not a limitation to
 *    silently work around): a card's graph fragment and its binding are
 *    one unit, so editing the graph can delete a card's structure but
 *    can't leave it inconsistent.
 *  - Freshly graph-authored nodes/connections (anything not matching those
 *    id patterns) are plain graph data with no card counterpart, exactly
 *    like a hand-authored binding `behaviorCards.ts` already tolerates.
 */
import {
  ALLOWED_NODE_TYPES_BY_FAMILY,
  ALLOWED_TARGET_PROPERTIES_BY_SCOPE,
  NODE_PORTS,
  findCycle,
  validateBehaviorGraph,
} from '../runtime/behaviorRuntime';
import type { SceneDocument } from '../api/projects';
import { removeCardFromScene } from './behaviorCards';

export type NodeFamily = 'input' | 'transform' | 'condition' | 'visual' | 'flow' | 'output';

export type PortDataType = 'value' | 'event';

export type PortInfo = { port: string; label: string; dataType: PortDataType };

export type ParamFieldSpec =
  | { key: string; label: string; kind: 'text' }
  | { key: string; label: string; kind: 'number'; min?: number; max?: number; step?: number }
  | { key: string; label: string; kind: 'boolean' }
  | {
      key: string;
      label: string;
      kind: 'select';
      options: Array<{ value: string; label: string }>;
    };

export type GraphNodeData = {
  id: string;
  family: string;
  type: string;
  params: Record<string, unknown>;
  position: { x: number; y: number };
};

export type GraphConnectionData = {
  id: string;
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
};

export const FAMILY_LABELS: Record<NodeFamily, string> = {
  input: 'Input',
  transform: 'Transform',
  condition: 'Condition',
  visual: 'Visual',
  flow: 'Flow',
  output: 'Output',
};

/** Data type each port name carries. Both an output port's produced value
 * and an input port's expected value must agree for a connection to be
 * offered in the UI — see the module doc comment's note on why this is a
 * strict *narrowing* of what `validateBehaviorGraph` already allows. */
const PORT_DATA_TYPES: Record<string, PortDataType> = {
  value: 'value',
  in: 'value',
  event: 'event',
  trigger: 'event',
  // Task 37 transform node ports — all carry numeric "value" data, never
  // "event" (listed explicitly rather than relying on the 'value' fallback
  // below, so the port vocabulary stays self-documenting here too).
  out: 'value',
  inA: 'value',
  inB: 'value',
  // Task 38 condition/timing node ports. `true`/`false` (If/Else) are
  // numeric "value" ports (a level, not an edge event — see
  // `behaviorRuntime.ts`'s "Condition and timing node registry" doc
  // comment). `cooldown`'s `trigger` in/out reuses the existing `trigger`
  // event-port name/type (already mapped above).
  true: 'value',
  false: 'value',
};

function portDataType(port: string): PortDataType {
  return PORT_DATA_TYPES[port] ?? 'value';
}

const SHAPE_GROUP_PROPERTIES = Array.from(ALLOWED_TARGET_PROPERTIES_BY_SCOPE.shape).map(
  (value) => ({
    value,
    label: value,
  }),
);

/** One catalog entry per (family, type) this graph editor can create —
 * exactly the pairs `ALLOWED_NODE_TYPES_BY_FAMILY` (behaviorRuntime.ts)
 * allows today. `output` is a recognized family (the schema's
 * `$defs.graphNode.family` enum, and `_docs/plan.md`'s node vocabulary) but
 * has no allowlisted node *type* yet — no "output"/"Preview target" node
 * type exists (see `behaviorRuntime.ts`'s module doc comment). That family
 * appears in `FAMILY_LABELS` and the family picker for context, but the
 * catalog below has no entries for it, so the graph editor's "add node"
 * affordance naturally offers nothing to create for `output` until a later
 * task adds entries here alongside `ALLOWED_NODE_TYPES_BY_FAMILY`.
 *
 * The 7 Task 37 transform node types' `paramFields`/`defaultParams` mirror
 * `behaviorRuntime.ts`'s `MAP_RANGE_DEFAULTS`/`CLAMP_DEFAULTS`/
 * `SMOOTH_DEFAULTS`/`INVERT_DEFAULTS`/`LERP_DEFAULTS` exactly (Add/Multiply
 * have no configurable params) — see that module's "Transform node
 * registry" doc comment for the exact documented semantics/ranges each
 * field maps to. The 5 Task 38 condition/timing node types
 * (`ifElse`/`oscillator`/`timer`/`delay`/`cooldown`) mirror
 * `behaviorRuntime.ts`'s `IF_ELSE_DEFAULTS`/`OSCILLATOR_DEFAULTS`/
 * `TIMER_DEFAULTS`/`DELAY_DEFAULTS`/`COOLDOWN_DEFAULTS` the same way — see
 * that module's "Condition and timing node registry" doc comment. */
export const NODE_TYPE_CATALOG: Record<
  string,
  {
    family: NodeFamily;
    label: string;
    inputs: PortInfo[];
    outputs: PortInfo[];
    paramFields: ParamFieldSpec[];
    defaultParams: Record<string, unknown>;
  }
> = {
  handSignal: {
    family: 'input',
    label: 'Hand signal',
    inputs: [],
    outputs: [{ port: 'value', label: 'Value', dataType: 'value' }],
    paramFields: [
      { key: 'signal', label: 'Signal name', kind: 'text' },
      {
        key: 'handTarget',
        label: 'Hand target',
        kind: 'select',
        options: [
          { value: 'primary', label: 'Primary hand' },
          { value: 'left', label: 'Left hand' },
          { value: 'right', label: 'Right hand' },
          { value: 'either', label: 'Either hand' },
        ],
      },
    ],
    defaultParams: { signal: 'indexTipX', handTarget: 'primary' },
  },
  gestureEvent: {
    family: 'input',
    label: 'Gesture event',
    inputs: [],
    outputs: [{ port: 'event', label: 'Event', dataType: 'event' }],
    paramFields: [
      { key: 'signal', label: 'Event name', kind: 'text' },
      {
        key: 'handTarget',
        label: 'Hand target',
        kind: 'select',
        options: [
          { value: 'primary', label: 'Primary hand' },
          { value: 'left', label: 'Left hand' },
          { value: 'right', label: 'Right hand' },
          { value: 'either', label: 'Either hand' },
        ],
      },
    ],
    defaultParams: { signal: 'event:pinchStart', handTarget: 'primary' },
  },
  shapeProperty: {
    family: 'visual',
    label: 'Shape property',
    inputs: [{ port: 'in', label: 'Value', dataType: 'value' }],
    outputs: [],
    paramFields: [
      { key: 'targetId', label: 'Target shape id', kind: 'text' },
      { key: 'property', label: 'Property', kind: 'select', options: SHAPE_GROUP_PROPERTIES },
    ],
    defaultParams: { targetId: '', property: 'positionX' },
  },
  groupProperty: {
    family: 'visual',
    label: 'Group property',
    inputs: [{ port: 'in', label: 'Value', dataType: 'value' }],
    outputs: [],
    paramFields: [
      { key: 'targetId', label: 'Target group id', kind: 'text' },
      { key: 'property', label: 'Property', kind: 'select', options: SHAPE_GROUP_PROPERTIES },
    ],
    defaultParams: { targetId: '', property: 'positionX' },
  },
  particleEmitter: {
    family: 'visual',
    label: 'Particle emitter',
    inputs: [{ port: 'trigger', label: 'Trigger', dataType: 'event' }],
    outputs: [],
    paramFields: [],
    defaultParams: {},
  },
  trigger: {
    family: 'flow',
    label: 'Trigger',
    inputs: [{ port: 'trigger', label: 'Trigger', dataType: 'event' }],
    outputs: [],
    paramFields: [{ key: 'preset', label: 'Preset', kind: 'text' }],
    defaultParams: { preset: 'pulse' },
  },
  // --- Task 37 transform nodes -------------------------------------
  mapRange: {
    family: 'transform',
    label: 'Map range',
    inputs: [{ port: 'in', label: 'Value', dataType: 'value' }],
    outputs: [{ port: 'out', label: 'Value', dataType: 'value' }],
    paramFields: [
      { key: 'inMin', label: 'Input min', kind: 'number' },
      { key: 'inMax', label: 'Input max', kind: 'number' },
      { key: 'outMin', label: 'Output min', kind: 'number' },
      { key: 'outMax', label: 'Output max', kind: 'number' },
      { key: 'clampOutput', label: 'Clamp output to range', kind: 'boolean' },
    ],
    defaultParams: { inMin: 0, inMax: 1, outMin: 0, outMax: 1, clampOutput: true },
  },
  clamp: {
    family: 'transform',
    label: 'Clamp',
    inputs: [{ port: 'in', label: 'Value', dataType: 'value' }],
    outputs: [{ port: 'out', label: 'Value', dataType: 'value' }],
    paramFields: [
      { key: 'min', label: 'Min', kind: 'number' },
      { key: 'max', label: 'Max', kind: 'number' },
    ],
    defaultParams: { min: 0, max: 1 },
  },
  smooth: {
    family: 'transform',
    label: 'Smooth',
    inputs: [{ port: 'in', label: 'Value', dataType: 'value' }],
    outputs: [{ port: 'out', label: 'Value', dataType: 'value' }],
    paramFields: [{ key: 'smoothing', label: 'Smoothing (0-1)', kind: 'number', min: 0, max: 1 }],
    defaultParams: { smoothing: 0.3 },
  },
  invert: {
    family: 'transform',
    label: 'Invert',
    inputs: [{ port: 'in', label: 'Value', dataType: 'value' }],
    outputs: [{ port: 'out', label: 'Value', dataType: 'value' }],
    paramFields: [
      { key: 'min', label: 'Min', kind: 'number' },
      { key: 'max', label: 'Max', kind: 'number' },
    ],
    defaultParams: { min: 0, max: 1 },
  },
  add: {
    family: 'transform',
    label: 'Add',
    inputs: [
      { port: 'inA', label: 'A', dataType: 'value' },
      { port: 'inB', label: 'B', dataType: 'value' },
    ],
    outputs: [{ port: 'out', label: 'Value', dataType: 'value' }],
    paramFields: [],
    defaultParams: {},
  },
  multiply: {
    family: 'transform',
    label: 'Multiply',
    inputs: [
      { port: 'inA', label: 'A', dataType: 'value' },
      { port: 'inB', label: 'B', dataType: 'value' },
    ],
    outputs: [{ port: 'out', label: 'Value', dataType: 'value' }],
    paramFields: [],
    defaultParams: {},
  },
  lerp: {
    family: 'transform',
    label: 'Lerp',
    inputs: [
      { port: 'inA', label: 'A', dataType: 'value' },
      { port: 'inB', label: 'B', dataType: 'value' },
    ],
    outputs: [{ port: 'out', label: 'Value', dataType: 'value' }],
    paramFields: [{ key: 't', label: 'T (0-1)', kind: 'number', min: 0, max: 1 }],
    defaultParams: { t: 0.5 },
  },
  // --- Task 38 condition/timing nodes ------------------------------
  ifElse: {
    family: 'condition',
    label: 'If / Else',
    inputs: [{ port: 'in', label: 'Value', dataType: 'value' }],
    outputs: [
      { port: 'true', label: 'True', dataType: 'value' },
      { port: 'false', label: 'False', dataType: 'value' },
    ],
    paramFields: [
      {
        key: 'comparison',
        label: 'Comparison',
        kind: 'select',
        options: [
          { value: 'greaterThan', label: 'Is greater than' },
          { value: 'lessThan', label: 'Is less than' },
          { value: 'between', label: 'Is between' },
          { value: 'approximately', label: 'Is approximately' },
        ],
      },
      { key: 'threshold', label: 'Threshold', kind: 'number' },
      { key: 'min', label: 'Min (between)', kind: 'number' },
      { key: 'max', label: 'Max (between)', kind: 'number' },
      { key: 'tolerance', label: 'Tolerance (approximately)', kind: 'number', min: 0 },
      { key: 'holdTimeMs', label: 'Hold time (ms)', kind: 'number', min: 0 },
    ],
    defaultParams: {
      comparison: 'greaterThan',
      threshold: 0,
      min: 0,
      max: 1,
      tolerance: 0.05,
      holdTimeMs: 150,
    },
  },
  oscillator: {
    family: 'input',
    label: 'Oscillator',
    inputs: [],
    outputs: [{ port: 'value', label: 'Value', dataType: 'value' }],
    paramFields: [
      {
        key: 'shape',
        label: 'Shape',
        kind: 'select',
        options: [
          { value: 'sine', label: 'Sine' },
          { value: 'triangle', label: 'Triangle' },
          { value: 'square', label: 'Square' },
        ],
      },
      { key: 'periodMs', label: 'Period (ms)', kind: 'number', min: 0 },
      { key: 'amplitude', label: 'Amplitude', kind: 'number' },
      { key: 'offset', label: 'Offset', kind: 'number' },
      { key: 'phaseOffsetMs', label: 'Phase offset (ms)', kind: 'number' },
    ],
    defaultParams: { shape: 'sine', periodMs: 1000, amplitude: 1, offset: 0, phaseOffsetMs: 0 },
  },
  timer: {
    family: 'input',
    label: 'Timer',
    inputs: [],
    outputs: [{ port: 'value', label: 'Value', dataType: 'value' }],
    paramFields: [
      {
        key: 'mode',
        label: 'Mode',
        kind: 'select',
        options: [
          { value: 'elapsed', label: 'Elapsed time' },
          { value: 'loop', label: 'Looped phase' },
          { value: 'countdown', label: 'Countdown' },
        ],
      },
      { key: 'periodMs', label: 'Period (ms, loop)', kind: 'number', min: 0 },
      { key: 'durationMs', label: 'Duration (ms, countdown)', kind: 'number', min: 0 },
    ],
    defaultParams: { mode: 'elapsed', periodMs: 1000, durationMs: 5000 },
  },
  delay: {
    family: 'flow',
    label: 'Delay',
    inputs: [{ port: 'in', label: 'Value', dataType: 'value' }],
    outputs: [{ port: 'out', label: 'Value', dataType: 'value' }],
    paramFields: [{ key: 'delayMs', label: 'Delay (ms)', kind: 'number', min: 0 }],
    defaultParams: { delayMs: 300 },
  },
  cooldown: {
    family: 'flow',
    label: 'Cooldown',
    inputs: [{ port: 'trigger', label: 'Trigger', dataType: 'event' }],
    outputs: [{ port: 'trigger', label: 'Trigger', dataType: 'event' }],
    paramFields: [{ key: 'milliseconds', label: 'Cooldown (ms)', kind: 'number', min: 0 }],
    defaultParams: { milliseconds: 500 },
  },
};

export function creatableNodeTypes(): Array<{ family: NodeFamily; type: string; label: string }> {
  return Object.entries(NODE_TYPE_CATALOG).map(([type, info]) => ({
    family: info.family,
    type,
    label: info.label,
  }));
}

export type Outcome = { ok: true; scene: SceneDocument } | { ok: false; error: string };

function rawGraph(scene: SceneDocument): {
  nodes: GraphNodeData[];
  connections: GraphConnectionData[];
} {
  const graph = scene.graph as { nodes?: unknown; connections?: unknown } | undefined;
  return {
    nodes: Array.isArray(graph?.nodes) ? (graph!.nodes as GraphNodeData[]) : [],
    connections: Array.isArray(graph?.connections)
      ? (graph!.connections as GraphConnectionData[])
      : [],
  };
}

function withGraph(
  scene: SceneDocument,
  nodes: GraphNodeData[],
  connections: GraphConnectionData[],
): SceneDocument {
  return { ...scene, graph: { nodes, connections } };
}

function validateOutcome(scene: SceneDocument): string | null {
  const result = validateBehaviorGraph(scene);
  if (result.valid) return null;
  return result.errors[0]?.message ?? 'This change would make the graph invalid.';
}

/** Checks whether `candidate` is a type-compatible, directionally valid,
 * acyclic connection between two existing nodes — the single predicate
 * both `GraphView.tsx`'s React Flow `isValidConnection` and
 * `GraphListView.tsx`'s add-connection form call before ever proposing the
 * mutation to `addGraphConnection`. See the module doc comment for how
 * this relates to `validateBehaviorGraph`. */
export function checkGraphConnection(
  nodes: GraphNodeData[],
  connections: GraphConnectionData[],
  candidate: { fromNodeId: string; fromPort: string; toNodeId: string; toPort: string },
): { valid: boolean; error?: string } {
  if (candidate.fromNodeId === candidate.toNodeId) {
    return { valid: false, error: 'A node cannot connect to itself.' };
  }
  const fromNode = nodes.find((n) => n.id === candidate.fromNodeId);
  const toNode = nodes.find((n) => n.id === candidate.toNodeId);
  if (!fromNode) return { valid: false, error: 'The source node no longer exists.' };
  if (!toNode) return { valid: false, error: 'The target node no longer exists.' };

  const fromAllowed = ALLOWED_NODE_TYPES_BY_FAMILY[fromNode.family]?.has(fromNode.type);
  const toAllowed = ALLOWED_NODE_TYPES_BY_FAMILY[toNode.family]?.has(toNode.type);
  if (!fromAllowed || !toAllowed) {
    return { valid: false, error: 'Both nodes must be an allowed graph node type.' };
  }

  const fromPorts = NODE_PORTS[fromNode.type];
  const toPorts = NODE_PORTS[toNode.type];
  if (!fromPorts?.out?.has(candidate.fromPort)) {
    return {
      valid: false,
      error: `'${fromNode.type}' has no output port named '${candidate.fromPort}'.`,
    };
  }
  if (!toPorts?.in?.has(candidate.toPort)) {
    return {
      valid: false,
      error: `'${toNode.type}' has no input port named '${candidate.toPort}'.`,
    };
  }

  const fromType = portDataType(candidate.fromPort);
  const toType = portDataType(candidate.toPort);
  if (fromType !== toType) {
    return {
      valid: false,
      error: `Cannot connect a '${fromType}' output to a '${toType}' input.`,
    };
  }

  const nodeIds = nodes.map((n) => n.id);
  const edges = [
    ...connections.map((c) => ({ from: c.fromNodeId, to: c.toNodeId })),
    { from: candidate.fromNodeId, to: candidate.toNodeId },
  ];
  if (findCycle(nodeIds, edges) !== null) {
    return { valid: false, error: 'This connection would create a cycle, which is not allowed.' };
  }

  return { valid: true };
}

/** Adds a new node of an allowed (family, type) pair at `position`. Reuses
 * `crypto.randomUUID()` for the new node's id, matching every other id in
 * this codebase. */
export function addGraphNode(
  scene: SceneDocument,
  type: string,
  position: { x: number; y: number },
): Outcome & { nodeId?: string } {
  const info = NODE_TYPE_CATALOG[type];
  if (!info) return { ok: false, error: `Unknown node type '${type}'.` };
  const { nodes, connections } = rawGraph(scene);
  const nodeId = crypto.randomUUID();
  const node: GraphNodeData = {
    id: nodeId,
    family: info.family,
    type,
    params: { ...info.defaultParams },
    position,
  };
  const nextScene = withGraph(scene, [...nodes, node], connections);
  const error = validateOutcome(nextScene);
  if (error) return { ok: false, error };
  return { ok: true, scene: nextScene, nodeId };
}

/** Removes a node. If the node belongs to a Task 34 behavior card
 * (`input-<cardId>`/`action-<cardId>`), removes the whole card instead —
 * see the module doc comment's "Behavior-card sync" section. */
export function removeGraphNode(scene: SceneDocument, nodeId: string): Outcome {
  const cardId = cardIdForNodeId(nodeId);
  if (cardId && sceneHasBindingId(scene, cardId)) {
    return removeCardFromScene(scene, cardId);
  }
  const { nodes, connections } = rawGraph(scene);
  if (!nodes.some((n) => n.id === nodeId)) {
    return { ok: false, error: 'That node no longer exists.' };
  }
  const nextNodes = nodes.filter((n) => n.id !== nodeId);
  const nextConnections = connections.filter(
    (c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId,
  );
  const nextScene = withGraph(scene, nextNodes, nextConnections);
  const error = validateOutcome(nextScene);
  if (error) return { ok: false, error };
  return { ok: true, scene: nextScene };
}

/** Adds a connection after re-checking `checkGraphConnection` and running
 * full `validateBehaviorGraph` on the candidate scene — belt-and-braces so
 * a caller that skipped the UI-level check (e.g. a test, or a future
 * caller) still can never write an invalid connection. */
export function addGraphConnection(
  scene: SceneDocument,
  candidate: { fromNodeId: string; fromPort: string; toNodeId: string; toPort: string },
): Outcome {
  const { nodes, connections } = rawGraph(scene);
  const check = checkGraphConnection(nodes, connections, candidate);
  if (!check.valid) return { ok: false, error: check.error ?? 'Invalid connection.' };
  const connection: GraphConnectionData = { id: crypto.randomUUID(), ...candidate };
  const nextScene = withGraph(scene, nodes, [...connections, connection]);
  const error = validateOutcome(nextScene);
  if (error) return { ok: false, error };
  return { ok: true, scene: nextScene };
}

/** Removes a connection. If it's a Task 34 card's `conn-<cardId>`, removes
 * the whole card instead — see the module doc comment. */
export function removeGraphConnection(scene: SceneDocument, connectionId: string): Outcome {
  const cardId = connectionId.startsWith('conn-') ? connectionId.slice('conn-'.length) : null;
  if (cardId && sceneHasBindingId(scene, cardId)) {
    return removeCardFromScene(scene, cardId);
  }
  const { nodes, connections } = rawGraph(scene);
  if (!connections.some((c) => c.id === connectionId)) {
    return { ok: false, error: 'That connection no longer exists.' };
  }
  const nextConnections = connections.filter((c) => c.id !== connectionId);
  const nextScene = withGraph(scene, nodes, nextConnections);
  const error = validateOutcome(nextScene);
  if (error) return { ok: false, error };
  return { ok: true, scene: nextScene };
}

/** Updates one node's editor-only `position` (drag, or a future keyboard
 * nudge) without touching `params` — never a card-sync concern, since
 * position has no effect on runtime behavior (schema's own doc comment on
 * `graphNode.position`). */
export function moveGraphNode(
  scene: SceneDocument,
  nodeId: string,
  position: { x: number; y: number },
): Outcome {
  const { nodes, connections } = rawGraph(scene);
  const index = nodes.findIndex((n) => n.id === nodeId);
  if (index === -1) return { ok: false, error: 'That node no longer exists.' };
  const nextNodes = nodes.slice();
  nextNodes[index] = { ...nextNodes[index], position };
  const nextScene = withGraph(scene, nextNodes, connections);
  const error = validateOutcome(nextScene);
  if (error) return { ok: false, error };
  return { ok: true, scene: nextScene };
}

function cardIdForNodeId(nodeId: string): string | null {
  if (nodeId.startsWith('input-')) return nodeId.slice('input-'.length);
  if (nodeId.startsWith('action-')) return nodeId.slice('action-'.length);
  return null;
}

function sceneHasBindingId(scene: SceneDocument, bindingId: string): boolean {
  const bindings = scene.bindings;
  return Array.isArray(bindings) && bindings.some((b) => (b as { id?: unknown })?.id === bindingId);
}

/** Field -> binding field mapping used to keep a Task 34 card's binding in
 * sync when its `input-<cardId>`/`action-<cardId>` node's params are
 * edited directly in the graph editor. `input` nodes' `signal`/
 * `handTarget` params map 1:1 onto `binding.signal`/`binding.handTarget`;
 * `shapeProperty`/`groupProperty` nodes' `targetId`/`property` params map
 * onto `binding.targetId`/`binding.targetProperty` (with `targetScope`
 * fixed by the node type). A resulting binding that no longer matches any
 * of the four card patterns simply stops appearing as a card
 * (`behaviorCards.ts`'s own documented policy for un-recognized
 * bindings) — it remains a perfectly valid binding, just not shown as a
 * card until it's edited back into a recognizable shape. */
function patchBindingFromNode(
  binding: Record<string, unknown>,
  node: GraphNodeData,
  params: Record<string, unknown>,
): Record<string, unknown> {
  if (node.type === 'handSignal' || node.type === 'gestureEvent') {
    return {
      ...binding,
      ...(typeof params.signal === 'string' ? { signal: params.signal } : {}),
      ...(typeof params.handTarget === 'string' ? { handTarget: params.handTarget } : {}),
    };
  }
  if (node.type === 'shapeProperty' || node.type === 'groupProperty') {
    return {
      ...binding,
      targetScope: node.type === 'shapeProperty' ? 'shape' : 'group',
      ...(typeof params.targetId === 'string' ? { targetId: params.targetId } : {}),
      ...(typeof params.property === 'string' ? { targetProperty: params.property } : {}),
    };
  }
  return binding;
}

/** Updates one node's `params`, merging into (not replacing) the existing
 * object. When the node belongs to a Task 34 card, also patches the
 * card's binding — see `patchBindingFromNode`. */
export function updateGraphNodeParams(
  scene: SceneDocument,
  nodeId: string,
  params: Record<string, unknown>,
): Outcome {
  const { nodes, connections } = rawGraph(scene);
  const index = nodes.findIndex((n) => n.id === nodeId);
  if (index === -1) return { ok: false, error: 'That node no longer exists.' };
  const nextNodes = nodes.slice();
  const nextNode = { ...nextNodes[index], params: { ...nextNodes[index].params, ...params } };
  nextNodes[index] = nextNode;

  let nextScene = withGraph(scene, nextNodes, connections);

  const cardId = cardIdForNodeId(nodeId);
  if (cardId) {
    const bindings = Array.isArray(scene.bindings)
      ? (scene.bindings as Record<string, unknown>[])
      : [];
    const bindingIndex = bindings.findIndex((b) => b.id === cardId);
    if (bindingIndex !== -1) {
      const nextBindings = bindings.slice();
      nextBindings[bindingIndex] = patchBindingFromNode(
        nextBindings[bindingIndex],
        nextNode,
        params,
      );
      nextScene = { ...nextScene, bindings: nextBindings };
    }
  }

  const error = validateOutcome(nextScene);
  if (error) return { ok: false, error };
  return { ok: true, scene: nextScene };
}
