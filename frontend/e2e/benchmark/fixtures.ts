/**
 * Task 70 (issue #70): benchmark scene fixtures for the runtime-limits
 * benchmark harness (`runtimeLimits.bench.ts`).
 *
 * Two fixtures, built programmatically (rather than hand-authored JSON) so
 * every documented `schema/limits.json` maximum is reached exactly, and the
 * arithmetic proving that is auditable in this file rather than buried in a
 * static JSON blob:
 *
 * - `maxScene()` — reaches every documented V1 maximum *simultaneously*
 *   while remaining schema-valid: `maxShapes` (200, including
 *   `maxParticleEmitters` (4) with `maxTotalParticleRate` (800) and maxed
 *   physics forces — see `physicsForces.ts`'s `MAX_FORCE_COMPONENT`),
 *   `maxGroups` (50, including one chain reaching `maxGroupNestingDepth`
 *   (6) and one group at `maxGroupChildIds` (100)), `maxGraphNodes` (100)
 *   and `maxGraphConnections` (150) simultaneously (see "Graph layout"
 *   below for the exact accounting), `maxConditionalNodes` (3),
 *   `maxBindings` (100, filling every `interaction`-scope channel plus a
 *   spread of `shape`-scope channels across distinct shapes — V1's
 *   documented "one active continuous binding per target channel" rule,
 *   `scene.schema.json`'s `binding.composition` doc comment), and trail
 *   length at `$defs.trail.length`'s max (100 samples,
 *   `trailSystem.ts`'s `MAX_TRAIL_LENGTH_PER_SHAPE`) on a large subset of
 *   shapes. Two `path` shapes additionally reach `maxPathPoints` (500) —
 *   not in issue #70's explicit list, but a documented per-shape maximum
 *   this fixture reaches "for free" alongside the rest.
 * - `withinLimitsScene()` — a small, "typical/approved" scene, well under
 *   every cap, standing in for a normal production scene an author would
 *   actually ship (a handful of shapes, one emitter, a couple of trails,
 *   a small graph, a dozen bindings). Used to confirm the reference
 *   environment meets budget on ordinary content, not just to prove the
 *   worst case survives.
 *
 * Every id matches `schema/scene.schema.json`'s `$defs.id` pattern
 * (`^[A-Za-z0-9_-]{1,64}$`); every field matches its schema type/range so
 * the harness's own `validateScene`/`validateBehaviorGraph` calls (run
 * before any timing measurement) should pass with zero errors — if they
 * don't, the benchmark harness fails loudly rather than silently timing an
 * invalid scene.
 */

export type SceneDocument = Record<string, unknown>;

const SHAPE_TARGET_PROPERTIES = [
  'positionX',
  'positionY',
  'scaleX',
  'scaleY',
  'rotation',
  'opacity',
  'fill',
  'stroke',
] as const;

const INTERACTION_TARGET_PROPERTIES = [
  'triggerPreset',
  'toggleLayer',
  'emitParticles',
  'resetScene',
] as const;

const GRAPH_SOURCE_SIGNALS = [
  'indexTipX',
  'indexTipY',
  'handDepth',
  'pinchStrength',
  'handSpeed',
] as const;

function transform2D(overrides: Partial<Record<string, number>> = {}) {
  return {
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    scaleX: overrides.scaleX ?? 1,
    scaleY: overrides.scaleY ?? 1,
    rotation: overrides.rotation ?? 0,
    opacity: overrides.opacity ?? 1,
  };
}

function style(fill: string, stroke: string | null = null, strokeWidth = 0) {
  return { fill, stroke, strokeWidth };
}

const PALETTE_8 = [
  '#ff0044',
  '#ff8800',
  '#ffee00',
  '#33ff00',
  '#00ffcc',
  '#0088ff',
  '#7700ff',
  '#ff00cc',
];

/**
 * Builds the "reaches every documented maximum simultaneously" fixture.
 * See the module doc comment's "Graph layout" accounting below for exactly
 * how `maxGraphNodes` (100) and `maxGraphConnections` (150) are both hit
 * with a real (non-redundant) wiring.
 */
export function maxScene(): SceneDocument {
  // --- Layers: maxLayers = 200 -------------------------------------------
  // Task 111 requires every shape to own a distinct layer. Keep one layer
  // per shape so this maximum-shape fixture remains schema-valid.
  const layers = Array.from({ length: 200 }, (_, i) => ({
    id: `layer-${i}`,
    name: `Layer ${i}`,
    order: i,
    visible: true,
    locked: false,
  }));

  // --- Shapes: maxShapes = 200 --------------------------------------------
  const shapes: Record<string, unknown>[] = [];

  // 4 particleEmitters = maxParticleEmitters, rate 200 each = 800 =
  // maxTotalParticleRate, physics forces maxed (MAX_FORCE_COMPONENT = 10
  // for gravity/forceX/forceY, drag maxed at 1).
  for (let i = 0; i < 4; i++) {
    shapes.push({
      id: `emitter-${i}`,
      type: 'particleEmitter',
      layerId: `layer-${i}`,
      groupId: null,
      transform: transform2D({ x: 200 + i * 300, y: 300 }),
      style: style('#ffffff'),
      rate: 200,
      size: 10,
      lifespan: 4,
      speed: 250,
      palette: PALETTE_8,
      physics: { gravity: 10, drag: 1, forceX: 10, forceY: -10 },
    });
  }

  // 2 path shapes at maxPathPoints (500 points each) — a bonus per-shape
  // maximum, cheap to include alongside the rest.
  for (let i = 0; i < 2; i++) {
    const points = Array.from({ length: 500 }, (_, p) => ({
      x: Math.round(Math.sin(p / 7 + i) * 200),
      y: Math.round(Math.cos(p / 11 + i) * 200),
    }));
    shapes.push({
      id: `path-max-${i}`,
      type: 'path',
      layerId: `layer-${i + 4}`,
      groupId: null,
      transform: transform2D({ x: 600 + i * 200, y: 700 }),
      style: style(null as unknown as string, '#22aaff', 2),
      points,
      closed: false,
    });
  }

  // Remaining 194 shapes: mostly circles, spread across layers; 60 of them
  // carry trail.length = 100 (MAX_TRAIL_LENGTH_PER_SHAPE, the documented
  // trail maximum).
  const remaining = 200 - shapes.length; // 194
  const trailedCount = 60;
  for (let i = 0; i < remaining; i++) {
    const withTrail = i < trailedCount;
    const shape: Record<string, unknown> = {
      id: `shape-${i}`,
      type: 'circle',
      layerId: `layer-${i + 6}`,
      groupId: null,
      transform: transform2D({
        x: 40 + (i % 40) * 45,
        y: 40 + Math.floor(i / 40) * 45,
        rotation: (i * 13) % 360,
      }),
      style: style(i % 2 === 0 ? '#4f46e5' : '#e54f8a', null, 0),
      radius: 8 + (i % 5) * 2,
    };
    if (withTrail) shape.trail = { length: 100 };
    shapes.push(shape);
  }

  // --- Groups: maxGroups = 50 ---------------------------------------------
  const groups: Record<string, unknown>[] = [];

  // A chain of 6 nested groups reaching maxGroupNestingDepth (6). The
  // innermost group (depth-chain-5) holds real shape children so the
  // renderer actually walks a 6-deep transform stack, not just a validator
  // count.
  const chainLeafShapeIds = shapes.slice(0, 10).map((s) => s.id as string);
  for (let depth = 5; depth >= 0; depth--) {
    groups.push({
      id: `depth-chain-${depth}`,
      name: `Depth chain ${depth}`,
      layerId: 'layer-0',
      childIds: depth === 5 ? chainLeafShapeIds : [`depth-chain-${depth + 1}`],
      transform: transform2D({ x: depth * 2, y: depth * 2, rotation: depth }),
      visible: true,
      locked: false,
    });
  }

  // One group at maxGroupChildIds (100) — references 100 distinct shape
  // ids (referential bookkeeping only; a shape's own groupId is
  // independent, per scene.schema.json's group.childIds doc comment).
  const denseChildIds = shapes.slice(10, 110).map((s) => s.id as string);
  groups.push({
    id: 'dense-group',
    name: 'Dense group',
    layerId: 'layer-1',
    childIds: denseChildIds,
    transform: transform2D(),
    visible: true,
    locked: false,
  });

  // 43 more flat groups to reach 50 total.
  for (let i = 0; i < 43; i++) {
    groups.push({
      id: `flat-group-${i}`,
      name: `Flat group ${i}`,
      layerId: `layer-${i % 20}`,
      childIds: [],
      transform: transform2D({ x: i, y: i }),
      visible: true,
      locked: false,
    });
  }

  // --- Bindings: maxBindings = 100 -----------------------------------------
  // 96 shape-scope bindings: 12 distinct shapes x 8 target properties
  // (every allowed shape-scope channel) + 4 interaction-scope bindings
  // filling every interaction channel — "one continuous binding per target
  // channel, filling all available channels" (issue #70).
  const bindings: Record<string, unknown>[] = [];
  const boundShapeIds = shapes.slice(110, 122).map((s) => s.id as string); // 12 shapes
  let bindingIndex = 0;
  for (const shapeId of boundShapeIds) {
    for (const property of SHAPE_TARGET_PROPERTIES) {
      bindings.push({
        id: `binding-${bindingIndex++}`,
        signal: 'indexTipX',
        handTarget: 'primary',
        targetScope: 'shape',
        targetId: shapeId,
        targetProperty: property,
        composition: 'replace',
        mapping: { inMin: 0, inMax: 1, outMin: 0, outMax: 1 },
        smoothing: 0.3,
      });
    }
  }
  for (const property of INTERACTION_TARGET_PROPERTIES) {
    bindings.push({
      id: `binding-${bindingIndex++}`,
      signal: 'event:pinchStart',
      handTarget: 'primary',
      targetScope: 'interaction',
      targetId: null,
      targetProperty: property,
      composition: 'replace',
    });
  }

  // --- Graph: maxGraphNodes = 100, maxGraphConnections = 150 --------------
  //
  // Layout (see module doc comment):
  //   5 handSignal sources                                  ->  5 nodes
  //   3 ifElse condition nodes (= maxConditionalNodes) each
  //     fed by 1 source and driving 2 dedicated visual sinks -> 3 + 6 = 9 nodes, 3 + 6 = 9 connections
  //   55 `add` nodes, each with 2 inputs from the 5 sources  -> 55 nodes, 110 connections
  //   31 shapeProperty visual sinks fed from the 55 add
  //     nodes (round-robin fan-out)                          -> 31 nodes, 31 connections
  // Total nodes:       5 + 9 + 55 + 31 = 100
  // Total connections:     9 + 110 + 31 = 150
  const nodes: Record<string, unknown>[] = [];
  const connections: Record<string, unknown>[] = [];
  let connIndex = 0;
  const nextConn = (fromNodeId: string, fromPort: string, toNodeId: string, toPort: string) => {
    connections.push({
      id: `conn-${connIndex++}`,
      fromNodeId,
      fromPort,
      toNodeId,
      toPort,
    });
  };

  // 5 handSignal sources.
  for (let i = 0; i < 5; i++) {
    nodes.push({
      id: `src-${i}`,
      family: 'input',
      type: 'handSignal',
      params: { signal: GRAPH_SOURCE_SIGNALS[i] },
      position: { x: 0, y: i * 80 },
    });
  }

  // 3 ifElse condition nodes, each with 2 dedicated visual sinks.
  const graphVisualShapeIds = shapes.slice(122, 200).map((s) => s.id as string); // 78 available
  let visualCursor = 0;
  const nextVisualShapeId = () => graphVisualShapeIds[visualCursor++ % graphVisualShapeIds.length];

  for (let i = 0; i < 3; i++) {
    const condId = `cond-${i}`;
    nodes.push({
      id: condId,
      family: 'condition',
      type: 'ifElse',
      params: { comparison: 'greaterThan', threshold: 0.5, tolerance: 0.05, holdTimeMs: 0 },
      position: { x: 200, y: i * 120 },
    });
    nextConn(`src-${i % 5}`, 'value', condId, 'in');

    for (const branch of ['true', 'false'] as const) {
      const visId = `cond-vis-${i}-${branch}`;
      nodes.push({
        id: visId,
        family: 'visual',
        type: 'shapeProperty',
        params: { targetId: nextVisualShapeId(), property: 'opacity' },
        position: { x: 400, y: i * 120 + (branch === 'true' ? 0 : 40) },
      });
      nextConn(condId, branch, visId, 'in');
    }
  }

  // 55 `add` nodes, each fed by 2 of the 5 sources (round-robin).
  const addIds: string[] = [];
  for (let i = 0; i < 55; i++) {
    const addId = `add-${i}`;
    addIds.push(addId);
    nodes.push({
      id: addId,
      family: 'transform',
      type: 'add',
      params: {},
      position: { x: 200, y: 400 + i * 20 },
    });
    nextConn(`src-${(2 * i) % 5}`, 'value', addId, 'inA');
    nextConn(`src-${(2 * i + 1) % 5}`, 'value', addId, 'inB');
  }

  // 31 shapeProperty visual sinks fed from the add nodes (round-robin).
  const visualProperties = ['positionX', 'positionY', 'scaleX', 'scaleY', 'rotation', 'opacity'];
  for (let i = 0; i < 31; i++) {
    const visId = `vis-${i}`;
    nodes.push({
      id: visId,
      family: 'visual',
      type: 'shapeProperty',
      params: {
        targetId: nextVisualShapeId(),
        property: visualProperties[i % visualProperties.length],
      },
      position: { x: 600, y: 400 + i * 20 },
    });
    nextConn(addIds[i % addIds.length], 'out', visId, 'in');
  }

  return {
    schemaVersion: 1,
    id: 'benchmark-max-scene',
    canvas: { width: 1920, height: 1080, backgroundColor: '#101015' },
    renderer: { preferred: 'p5' },
    layers,
    shapes,
    groups,
    bindings,
    graph: { nodes, connections },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 42, enabled: true },
  };
}

/**
 * A small, "typical/approved" scene — well under every V1 cap — standing
 * in for an ordinary production scene: 24 shapes (one group, two with
 * trails), one particle emitter well under its rate cap, a 6-node graph,
 * and 12 bindings. Used to confirm the reference environment comfortably
 * meets budget on realistic content, not just the pathological maximum.
 */
export function withinLimitsScene(): SceneDocument {
  const layers = Array.from({ length: 24 }, (_, i) => ({
    id: `layer-${i}`,
    name: i === 0 ? 'Background' : i === 1 ? 'Foreground' : `Layer ${i}`,
    order: i,
    visible: true,
    locked: false,
  }));

  const shapes: Record<string, unknown>[] = [];
  for (let i = 0; i < 20; i++) {
    const shape: Record<string, unknown> = {
      id: `shape-${i}`,
      type: 'circle',
      layerId: `layer-${i}`,
      groupId: i < 6 ? 'group-0' : null,
      transform: transform2D({ x: 60 + (i % 10) * 60, y: 60 + Math.floor(i / 10) * 60 }),
      style: style('#4f46e5', null, 0),
      radius: 16,
    };
    if (i < 2) shape.trail = { length: 30 };
    shapes.push(shape);
  }
  shapes.push({
    id: 'emitter-0',
    type: 'particleEmitter',
    layerId: 'layer-20',
    groupId: null,
    transform: transform2D({ x: 400, y: 300 }),
    style: style('#ffffff'),
    rate: 40,
    size: 8,
    lifespan: 2,
    speed: 120,
    palette: ['#ff8800', '#ffee00'],
    physics: { gravity: 2, drag: 0.1, forceX: 0, forceY: 0 },
  });
  shapes.push({
    id: 'rect-0',
    type: 'rect',
    layerId: 'layer-21',
    groupId: null,
    transform: transform2D({ x: 900, y: 500 }),
    style: style('#22aaff', null, 0),
    width: 120,
    height: 60,
    cornerRadius: 8,
  });
  shapes.push({
    id: 'line-0',
    type: 'line',
    layerId: 'layer-22',
    groupId: null,
    transform: transform2D({ x: 100, y: 900 }),
    style: style(null as unknown as string, '#ffffff', 2),
    x2: 400,
    y2: 950,
  });
  shapes.push({
    id: 'path-0',
    type: 'path',
    layerId: 'layer-23',
    groupId: null,
    transform: transform2D({ x: 1200, y: 200 }),
    style: style(null as unknown as string, '#33ff00', 3),
    points: [
      { x: 0, y: 0 },
      { x: 40, y: 60 },
      { x: 80, y: 0 },
    ],
    closed: true,
  });

  const groups = [
    {
      id: 'group-0',
      name: 'Group',
      layerId: 'layer-0',
      childIds: shapes.slice(0, 6).map((s) => s.id as string),
      transform: transform2D(),
      visible: true,
      locked: false,
    },
  ];

  const bindings: Record<string, unknown>[] = [];
  let bindingIndex = 0;
  for (const property of ['positionX', 'positionY', 'scaleX', 'opacity'] as const) {
    for (let s = 0; s < 3; s++) {
      bindings.push({
        id: `binding-${bindingIndex++}`,
        signal: 'indexTipX',
        handTarget: 'primary',
        targetScope: 'shape',
        targetId: `shape-${s}`,
        targetProperty: property,
        composition: 'replace',
        mapping: { inMin: 0, inMax: 1, outMin: 0, outMax: 1 },
        smoothing: 0.3,
      });
    }
  }

  const nodes = [
    {
      id: 'src-0',
      family: 'input',
      type: 'handSignal',
      params: { signal: 'handDepth' },
      position: { x: 0, y: 0 },
    },
    {
      id: 'map-0',
      family: 'transform',
      type: 'mapRange',
      params: { inMin: 0, inMax: 1, outMin: 0, outMax: 1 },
      position: { x: 100, y: 0 },
    },
    {
      id: 'clamp-0',
      family: 'transform',
      type: 'clamp',
      params: { min: 0, max: 1 },
      position: { x: 200, y: 0 },
    },
    {
      id: 'cond-0',
      family: 'condition',
      type: 'ifElse',
      params: { comparison: 'greaterThan', threshold: 0.5 },
      position: { x: 300, y: 0 },
    },
    {
      id: 'vis-0',
      family: 'visual',
      type: 'shapeProperty',
      params: { targetId: 'shape-10', property: 'opacity' },
      position: { x: 400, y: 0 },
    },
    {
      id: 'vis-1',
      family: 'visual',
      type: 'shapeProperty',
      params: { targetId: 'shape-11', property: 'scaleY' },
      position: { x: 400, y: 40 },
    },
  ];
  const connections = [
    { id: 'conn-0', fromNodeId: 'src-0', fromPort: 'value', toNodeId: 'map-0', toPort: 'in' },
    { id: 'conn-1', fromNodeId: 'map-0', fromPort: 'out', toNodeId: 'clamp-0', toPort: 'in' },
    { id: 'conn-2', fromNodeId: 'clamp-0', fromPort: 'out', toNodeId: 'cond-0', toPort: 'in' },
    { id: 'conn-3', fromNodeId: 'cond-0', fromPort: 'true', toNodeId: 'vis-0', toPort: 'in' },
    { id: 'conn-4', fromNodeId: 'cond-0', fromPort: 'false', toNodeId: 'vis-1', toPort: 'in' },
  ];

  return {
    schemaVersion: 1,
    id: 'benchmark-within-limits-scene',
    canvas: { width: 1280, height: 720, backgroundColor: '#181818' },
    renderer: { preferred: 'p5' },
    layers,
    shapes,
    groups,
    bindings,
    graph: { nodes, connections },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 7, enabled: true },
  };
}
